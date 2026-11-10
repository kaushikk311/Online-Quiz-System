import { readDb, updateDb } from './storage.js';
import { ok, fail, guard } from './result.js';
import { authorize } from './auth.js';
import { now, uid } from './clock.js';
import { formatDateTime } from '../utils/format.js';

/** UC10: decides whether a student may open a quiz right now. */
export function availability(quiz, t, questionCount) {
  if (!quiz.startTime || !quiz.endTime) return { state: 'unscheduled', open: false, code: 'NOT_SCHEDULED', message: 'This quiz has not been scheduled yet.' };
  if (t < quiz.startTime) return { state: 'upcoming', open: false, code: 'NOT_STARTED', message: `Not open yet. Opens ${formatDateTime(quiz.startTime)}.` };
  if (t > quiz.endTime) return { state: 'closed', open: false, code: 'ENDED', message: `This quiz closed on ${formatDateTime(quiz.endTime)}.` };
  if (!questionCount) return { state: 'empty', open: false, code: 'NO_QUESTIONS', message: 'This quiz has no questions yet.' };
  return { state: 'open', open: true, code: 'OPEN', message: `Open until ${formatDateTime(quiz.endTime)}.` };
}

const toMs = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  if (typeof v === 'number') return v;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? NaN : t;
};
const wholeNumber = (raw, label, min, max, unit = '') => {
  const s = String(raw ?? '').trim();
  if (s === '') return { error: `Enter ${label}.` };
  const n = Number(s);
  if (!Number.isFinite(n)) return { error: `${label[0].toUpperCase() + label.slice(1)} must be a number.` };
  if (!Number.isInteger(n)) return { error: `${label[0].toUpperCase() + label.slice(1)} must be a whole number.` };
  if (n < min || n > max) return { error: `${label[0].toUpperCase() + label.slice(1)} must be between ${min} and ${max}${unit}.` };
  return { value: n };
};

export function validateQuiz(db, input) {
  const e = {};
  const title = String(input.title ?? '').trim();
  if (!title) e.title = 'Enter a quiz title.';
  else if (title.length < 3) e.title = 'Title needs at least 3 characters.';
  else if (title.length > 80) e.title = 'Title can be at most 80 characters.';
  if (!input.subjectId) e.subjectId = 'Choose a subject.';
  else if (!db.categories.some((c) => c.id === input.subjectId)) e.subjectId = 'That subject no longer exists.';

  const tl = wholeNumber(input.timeLimit, 'a time limit', 1, 300, ' minutes');
  if (tl.error) e.timeLimit = tl.error.replace('Enter a time limit.', 'Enter a time limit in minutes.').replace('A time limit', 'Time limit');
  const pp = wholeNumber(input.passingPercentage, 'a passing percentage', 0, 100);
  if (pp.error) e.passingPercentage = pp.error.replace('Enter a passing percentage.', 'Enter a passing percentage (0–100).').replace('A passing percentage', 'Passing percentage');

  if (!['', 'unlimited', null, undefined].includes(input.maxAttempts)) {
    const ma = wholeNumber(input.maxAttempts, 'attempts allowed', 1, 10);
    if (ma.error) e.maxAttempts = ma.error;
  }
  if (![0, 0.25, 0.5, 1].includes(Number(input.unansweredPenalty || 0))) e.unansweredPenalty = 'Choose one of the listed penalties.';

  const s = toMs(input.startTime), en = toMs(input.endTime);
  if (Number.isNaN(s)) e.startTime = 'Enter a valid start date and time.';
  if (Number.isNaN(en)) e.endTime = 'Enter a valid end date and time.';
  if (!e.startTime && !e.endTime) {
    if (s === null && en !== null) e.startTime = 'Set a start time — a schedule needs both a start and an end.';
    if (en === null && s !== null) e.endTime = 'Set an end time — a schedule needs both a start and an end.';
    if (s !== null && en !== null && en <= s) e.endTime = 'End time must be after the start time.';
  }
  return e;
}

const normalizeQuiz = (i) => ({
  title: i.title.trim(), subjectId: i.subjectId, timeLimit: Number(i.timeLimit), passingPercentage: Number(i.passingPercentage),
  maxAttempts: ['', 'unlimited', null, undefined].includes(i.maxAttempts) ? null : Number(i.maxAttempts),
  unansweredPenalty: Number(i.unansweredPenalty || 0), shuffleQuestions: !!i.shuffleQuestions, shuffleOptions: !!i.shuffleOptions,
  startTime: toMs(i.startTime), endTime: toMs(i.endTime),
});

const validCount = (db, quiz) => quiz.questionIds.filter((id) => db.questions.some((q) => q.id === id)).length;
const ratingOf = (db, quizId) => {
  const r = db.feedback.filter((f) => f.quizId === quizId);
  return { count: r.length, average: r.length ? Math.round((r.reduce((s, f) => s + f.rating, 0) / r.length) * 100) / 100 : null };
};
const ORDER = { open: 0, upcoming: 1, unscheduled: 2, empty: 2, closed: 3 };

export const listQuizzes = (actor, { categoryId = '' } = {}) => guard(() => {
  const a = authorize(actor, 'quiz.view'); if (!a.ok) return a;
  const db = readDb(), t = now(), me = a.data;
  const rows = db.quizzes.filter((q) => !categoryId || q.subjectId === categoryId).map((q) => {
    const count = validCount(db, q), r = ratingOf(db, q.id);
    const row = {
      ...q, subjectName: db.categories.find((c) => c.id === q.subjectId)?.name || 'Uncategorised',
      questionCount: count, availability: availability(q, t, count), avgRating: r.average, ratingCount: r.count,
    };
    if (me.role === 'student') {
      const mine = db.attempts.filter((x) => x.quizId === q.id && x.userId === me.id);
      const done = mine.filter((x) => x.status === 'submitted').sort((x, y) => y.submittedAt - x.submittedAt);
      row.attemptsUsed = mine.length;
      row.attemptsLeft = q.maxAttempts == null ? null : Math.max(0, q.maxAttempts - mine.length);
      row.inProgressId = mine.find((x) => x.status === 'in_progress' && t < x.deadline)?.id || null;
      row.lastAttemptId = done[0]?.id || null;
      row.passed = done.some((x) => x.result?.passed);
    }
    return row;
  });
  rows.sort((x, y) => ORDER[x.availability.state] - ORDER[y.availability.state] || x.title.localeCompare(y.title));
  return ok(rows);
});

export const getQuiz = (actor, id) => guard(() => {
  const a = authorize(actor, 'quiz.manage'); if (!a.ok) return a;
  const db = readDb();
  const quiz = db.quizzes.find((q) => q.id === id);
  if (!quiz) return fail('NOT_FOUND', 'This quiz no longer exists.');
  const questions = quiz.questionIds.map((qid) => db.questions.find((q) => q.id === qid)).filter(Boolean)
    .map((q) => ({ ...q, categoryName: db.categories.find((c) => c.id === q.categoryId)?.name || null }));
  return ok({ quiz, questions });
});

export const createQuiz = (actor, input) => guard(() => {
  const a = authorize(actor, 'quiz.manage'); if (!a.ok) return a;
  return updateDb((db) => {
    const errors = validateQuiz(db, input);
    if (Object.keys(errors).length) return fail('VALIDATION', 'The quiz can’t be saved yet. Fix the highlighted fields.', errors);
    const quiz = { id: uid('qz_'), ...normalizeQuiz(input), questionIds: [], createdBy: a.data.id, createdAt: now() };
    db.quizzes.push(quiz);
    return ok(quiz);
  });
});

export const updateQuiz = (actor, id, input) => guard(() => {
  const a = authorize(actor, 'quiz.manage'); if (!a.ok) return a;
  return updateDb((db) => {
    const quiz = db.quizzes.find((q) => q.id === id);
    if (!quiz) return fail('NOT_FOUND', 'This quiz no longer exists.');
    const errors = validateQuiz(db, input);
    if (Object.keys(errors).length) return fail('VALIDATION', 'The quiz can’t be saved yet. Fix the highlighted fields.', errors);
    Object.assign(quiz, normalizeQuiz(input));
    return ok(quiz);
  });
});

/** UC10: saves only the availability window. */
export const setSchedule = (actor, id, { startTime, endTime }) => guard(() => {
  const a = authorize(actor, 'quiz.manage'); if (!a.ok) return a;
  return updateDb((db) => {
    const quiz = db.quizzes.find((q) => q.id === id);
    if (!quiz) return fail('NOT_FOUND', 'This quiz no longer exists.');
    const s = toMs(startTime), e = toMs(endTime), errors = {};
    if (s === null || Number.isNaN(s)) errors.startTime = 'Enter a valid start date and time.';
    if (e === null || Number.isNaN(e)) errors.endTime = 'Enter a valid end date and time.';
    if (!errors.startTime && !errors.endTime && e <= s) errors.endTime = 'End time must be after the start time.';
    if (Object.keys(errors).length) return fail('VALIDATION', 'The schedule can’t be saved yet. Fix the highlighted fields.', errors);
    quiz.startTime = s; quiz.endTime = e;
    return ok(quiz);
  });
});

export const deleteQuiz = (actor, id) => guard(() => {
  const a = authorize(actor, 'quiz.manage'); if (!a.ok) return a;
  return updateDb((db) => {
    if (!db.quizzes.some((q) => q.id === id)) return fail('NOT_FOUND', 'This quiz was already deleted.');
    db.quizzes = db.quizzes.filter((q) => q.id !== id);
    db.feedback = db.feedback.filter((f) => f.quizId !== id);     // past attempts stay in student history
    return ok({ id });
  });
});

/** FR1: import existing bank questions into a quiz. */
export const importQuestions = (actor, quizId, questionIds) => guard(() => {
  const a = authorize(actor, 'quiz.manage'); if (!a.ok) return a;
  if (!Array.isArray(questionIds) || !questionIds.length) return fail('NO_SELECTION', 'Select at least one question to import.');
  return updateDb((db) => {
    const quiz = db.quizzes.find((q) => q.id === quizId);
    if (!quiz) return fail('NOT_FOUND', 'This quiz no longer exists.');
    const add = [...new Set(questionIds)].filter((id) => db.questions.some((q) => q.id === id) && !quiz.questionIds.includes(id));
    if (!add.length) return fail('NOTHING_TO_ADD', 'Those questions are already in this quiz.');
    quiz.questionIds.push(...add);
    return ok({ added: add.length });
  });
});

export const removeQuestionFromQuiz = (actor, quizId, questionId) => guard(() => {
  const a = authorize(actor, 'quiz.manage'); if (!a.ok) return a;
  return updateDb((db) => {
    const quiz = db.quizzes.find((q) => q.id === quizId);
    if (!quiz) return fail('NOT_FOUND', 'This quiz no longer exists.');
    quiz.questionIds = quiz.questionIds.filter((id) => id !== questionId);
    return ok({});
  });
});
