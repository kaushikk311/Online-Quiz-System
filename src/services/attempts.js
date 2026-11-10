import { readDb, updateDb } from './storage.js';
import { ok, fail, failAndSave, guard } from './result.js';
import { authorize, can } from './auth.js';
import { now, uid, random } from './clock.js';
import { isOnline } from './network.js';
import { availability } from './quizzes.js';
import { buildSnapshot, evaluate, checkAnswer } from './scoring.js';

const SESSION_ENDED = 'Time is up. Your attempt was submitted automatically and further answers are blocked.';

/** Ends an attempt and stores its result. Safe to call twice. */
function finalize(a, reason, at) {
  if (a.status === 'submitted') return a;
  const end = Math.min(at, reason === 'timeout' ? a.deadline : at);
  a.status = 'submitted';
  a.submitReason = reason;
  a.submittedAt = end;
  a.pendingSubmit = false;
  a.timeTaken = Math.max(0, Math.round((Math.min(end, a.deadline) - a.startedAt) / 1000));
  a.result = evaluate(a);
  return a;
}

/** Auto-submits any in-progress attempt whose time has run out (UC03/UC05). */
function sweep(userId) {
  const t = now();
  const due = readDb().attempts.some((a) => a.status === 'in_progress' && a.userId === userId && t >= a.deadline);
  if (!due) return;
  updateDb((db) => {
    db.attempts.forEach((a) => { if (a.status === 'in_progress' && a.userId === userId && t >= a.deadline) finalize(a, 'timeout', a.deadline); });
    return ok();
  });
}

/** Validates answers against the attempt's own question copy. Returns { clean } or { invalid }. */
function cleanAnswers(attempt, map) {
  const clean = {};
  for (const [qid, v] of Object.entries(map || {})) {
    const q = attempt.questions.find((x) => x.id === qid);
    if (!q) return { invalid: qid };
    if (v === '' || v === null || v === undefined) { clean[qid] = null; continue; }
    if (typeof v !== 'string' || v.length > 500) return { invalid: qid };
    if (q.type === 'mcq' && !q.options.some((o) => o.id === v)) return { invalid: qid };
    if (q.type === 'tf' && v !== 'true' && v !== 'false') return { invalid: qid };
    clean[qid] = v;
  }
  return { clean };
}
const applyAnswers = (attempt, clean) => Object.entries(clean).forEach(([k, v]) => { if (v === null) delete attempt.answers[k]; else attempt.answers[k] = v; });

const mine = (db, actor, id) => { const a = db.attempts.find((x) => x.id === id); return a && a.userId === actor.id ? a : null; };

export const getEligibility = (actor, quizId) => guard(() => {
  const au = authorize(actor, 'quiz.attempt'); if (!au.ok) return au;
  sweep(actor.id);
  const db = readDb(), t = now();
  const quiz = db.quizzes.find((q) => q.id === quizId);
  if (!quiz) return fail('NOT_FOUND', 'This quiz does not exist or has been removed.');
  const count = quiz.questionIds.filter((id) => db.questions.some((q) => q.id === id)).length;
  const av = availability(quiz, t, count);
  const used = db.attempts.filter((a) => a.userId === actor.id && a.quizId === quizId).length;
  const inProgress = db.attempts.find((a) => a.userId === actor.id && a.quizId === quizId && a.status === 'in_progress');
  const exhausted = !inProgress && quiz.maxAttempts != null && used >= quiz.maxAttempts;
  let code = null, reason = null;
  if (!av.open) { code = av.code; reason = av.message; }
  else if (exhausted) {
    code = 'ATTEMPTS_EXHAUSTED';
    reason = quiz.maxAttempts === 1 ? 'This quiz allows a single attempt and you have already used it.' : `You have used all ${quiz.maxAttempts} attempts allowed for this quiz.`;
  }
  return ok({
    quiz: { id: quiz.id, title: quiz.title, timeLimit: quiz.timeLimit, passingPercentage: quiz.passingPercentage, maxAttempts: quiz.maxAttempts,
      questionCount: count, startTime: quiz.startTime, endTime: quiz.endTime, subjectName: db.categories.find((c) => c.id === quiz.subjectId)?.name },
    availability: av, attemptsUsed: used, attemptsLeft: quiz.maxAttempts == null ? null : Math.max(0, quiz.maxAttempts - used),
    inProgressId: inProgress?.id || null, canStart: !code, code, reason,
  });
});

export const startAttempt = (actor, quizId) => guard(() => {
  const au = authorize(actor, 'quiz.attempt'); if (!au.ok) return au;
  sweep(actor.id);
  const db0 = readDb(), t = now();
  const quiz = db0.quizzes.find((q) => q.id === quizId);
  if (!quiz) return fail('NOT_FOUND', 'This quiz does not exist or has been removed.');
  const count = quiz.questionIds.filter((id) => db0.questions.some((q) => q.id === id)).length;
  const av = availability(quiz, t, count);
  if (!av.open) return fail(av.code, av.message);
  const existing = db0.attempts.find((a) => a.userId === actor.id && a.quizId === quizId && a.status === 'in_progress');
  if (existing) return ok(existing);                                   // resume after refresh / network loss
  const used = db0.attempts.filter((a) => a.userId === actor.id && a.quizId === quizId).length;
  if (quiz.maxAttempts != null && used >= quiz.maxAttempts) {
    return fail('ATTEMPTS_EXHAUSTED', quiz.maxAttempts === 1 ? 'This quiz allows a single attempt and you have already used it.' : `You have used all ${quiz.maxAttempts} attempts allowed for this quiz.`);
  }
  return updateDb((db) => {
    const att = {
      id: uid('at_'), quizId, quizTitle: quiz.title, userId: actor.id, status: 'in_progress', startedAt: t,
      deadline: Math.min(t + quiz.timeLimit * 60000, quiz.endTime), timeLimit: quiz.timeLimit,
      questions: buildSnapshot(quiz, db.questions, { shuffleQuestions: quiz.shuffleQuestions, shuffleOptions: quiz.shuffleOptions, random }),
      answers: {}, scoring: { unansweredPenalty: quiz.unansweredPenalty, passingPercentage: quiz.passingPercentage },
    };
    db.attempts.push(att);
    return ok(att);
  });
});

export const getAttempt = (actor, id) => guard(() => {
  const au = authorize(actor, 'quiz.attempt'); if (!au.ok) return au;
  sweep(actor.id);
  const a = mine(readDb(), actor, id);
  return a ? ok(a) : fail('NOT_FOUND', 'Attempt not found.');
});

/** Saves one or more answers. Refused (and the attempt auto-submitted) once the timer has reached zero. */
export const saveAnswers = (actor, attemptId, map) => guard(() => {
  const au = authorize(actor, 'quiz.attempt'); if (!au.ok) return au;
  return updateDb((db) => {
    const a = mine(db, actor, attemptId);
    if (!a) return fail('NOT_FOUND', 'Attempt not found.');
    if (a.status === 'submitted') return fail('SESSION_ENDED', 'This attempt has already been submitted, so answers can no longer be changed.');
    if (now() >= a.deadline) { finalize(a, 'timeout', a.deadline); return failAndSave('SESSION_ENDED', SESSION_ENDED); }
    const { clean, invalid } = cleanAnswers(a, map);
    if (invalid) return fail('INVALID_ANSWER', 'That answer isn’t valid for this question, so it was not saved.');
    applyAnswers(a, clean);
    return ok({ answers: a.answers });
  });
});
export const saveAnswer = (actor, attemptId, questionId, value) => saveAnswers(actor, attemptId, { [questionId]: value });

/** reason: 'manual' | 'timeout'. Pass the latest local answers so nothing typed is lost. */
export const submitAttempt = (actor, attemptId, { reason = 'manual', answers } = {}) => guard(() => {
  const au = authorize(actor, 'quiz.attempt'); if (!au.ok) return au;
  const cur = mine(readDb(), actor, attemptId);
  if (!cur) return fail('NOT_FOUND', 'Attempt not found.');
  if (cur.status === 'submitted') return ok(cur);                      // idempotent: no double scoring
  const late = now() >= cur.deadline;

  if (reason === 'manual' && !late && !isOnline()) {                   // NFR3: queue instead of failing
    return updateDb((db) => {
      const a = mine(db, actor, attemptId);
      const { clean } = cleanAnswers(a, answers);
      if (clean) applyAnswers(a, clean);
      a.pendingSubmit = true;
      return failAndSave('OFFLINE', 'You’re offline. Your answers are saved on this device and will be submitted automatically when you reconnect.');
    });
  }
  return updateDb((db) => {
    const a = mine(db, actor, attemptId);
    const { clean } = cleanAnswers(a, answers);
    if (clean) applyAnswers(a, clean);
    finalize(a, late ? 'timeout' : reason, late ? a.deadline : now());
    return ok(a);
  });
});

/** Submits attempts that were queued while offline. */
export const flushPending = (actor) => guard(() => {
  const au = authorize(actor, 'quiz.attempt'); if (!au.ok) return au;
  if (!isOnline()) return ok({ attemptIds: [] });
  const ids = readDb().attempts.filter((a) => a.userId === actor.id && a.status === 'in_progress' && a.pendingSubmit).map((a) => a.id);
  if (!ids.length) return ok({ attemptIds: [] });
  return updateDb((db) => {
    db.attempts.forEach((a) => { if (ids.includes(a.id) && a.status === 'in_progress') finalize(a, now() >= a.deadline ? 'timeout' : 'manual', now() >= a.deadline ? a.deadline : now()); });
    return ok({ attemptIds: ids });
  });
});

const summarize = (a, db) => ({
  id: a.id, quizId: a.quizId, quizTitle: a.quizTitle, status: a.status, startedAt: a.startedAt, submittedAt: a.submittedAt || null,
  score: a.result?.score ?? null, total: a.result?.total ?? a.questions?.length ?? 0, percentage: a.result?.percentage ?? null,
  passed: a.result?.passed ?? null, timeTaken: a.timeTaken ?? null, submitReason: a.submitReason || null,
  quizExists: db.quizzes.some((q) => q.id === a.quizId),
});

/** UC12: students see only their own history; staff with report access may view a student's. */
export const listAttempts = (actor, userId) => guard(() => {
  const au = authorize(actor); if (!au.ok) return au;
  const me = au.data, target = userId || me.id;
  if (me.role === 'student' && target !== me.id) return fail('FORBIDDEN', 'You can only view your own attempt history.');
  if (me.role !== 'student' && !can(me, 'report.view')) return fail('FORBIDDEN', 'Your role does not have permission to do this.');
  if (me.role === 'student') sweep(me.id);
  const db = readDb();
  const student = db.users.find((u) => u.id === target);
  if (!student) return fail('NOT_FOUND', 'That student does not exist.');
  const rows = db.attempts.filter((a) => a.userId === target).sort((x, y) => y.startedAt - x.startedAt).map((a) => summarize(a, db));
  return ok({ student: { id: student.id, name: student.name }, rows });
});

const label = (q, v) => {
  if (v === undefined || v === null || v === '') return null;
  if (q.type === 'mcq') return q.options?.find((o) => o.id === v)?.text ?? null;
  if (q.type === 'tf') return v === 'true' ? 'True' : v === 'false' ? 'False' : null;
  return String(v);
};
const correctLabel = (q) => (q.type === 'fib' ? String(q.correct).split('|').join('  /  ') : label(q, q.correct));

/** UC08: only the owner, only after submission. */
export const getReview = (actor, attemptId) => guard(() => {
  const au = authorize(actor, 'quiz.attempt'); if (!au.ok) return au;
  sweep(actor.id);
  const db = readDb();
  const a = db.attempts.find((x) => x.id === attemptId);
  if (!a) return fail('NOT_FOUND', 'This attempt does not exist.');
  if (a.userId !== actor.id) return fail('FORBIDDEN', 'This attempt belongs to another student, so you can’t open it.');
  if (a.status !== 'submitted') return fail('NOT_SUBMITTED', 'Review opens after you submit this quiz.');
  if (!Array.isArray(a.questions) || !a.result) return fail('UNAVAILABLE', 'Review details aren’t available for this attempt.');
  const items = a.questions.map((q) => {
    const sel = a.answers?.[q.id];
    const status = a.result.items?.find((i) => i.questionId === q.id)?.status ?? checkAnswer(q, sel);
    return {
      id: q.id, type: q.type, text: q.text, options: q.options, status,
      selectedLabel: label(q, sel), selectedId: sel ?? null, correctLabel: correctLabel(q), correctId: q.correct,
      explanation: status === 'correct' ? null : q.explanation || null,       // explanations only for incorrect answers
    };
  });
  return ok({ attempt: summarize(a, db), items });
});

export const getResult = (actor, attemptId) => guard(() => {
  const au = authorize(actor, 'quiz.attempt'); if (!au.ok) return au;
  sweep(actor.id);
  const db = readDb();
  const a = db.attempts.find((x) => x.id === attemptId);
  if (!a) return fail('NOT_FOUND', 'This attempt does not exist.');
  if (a.userId !== actor.id) return fail('FORBIDDEN', 'This attempt belongs to another student, so you can’t open it.');
  if (a.status !== 'submitted') return fail('NOT_SUBMITTED', 'The result appears as soon as you submit this quiz.');
  return ok({ ...summarize(a, db), result: { correct: a.result.correct, incorrect: a.result.incorrect, unanswered: a.result.unanswered, invalid: a.result.invalid },
    passingPercentage: a.scoring.passingPercentage, autoSubmitted: a.submitReason === 'timeout' });
});
