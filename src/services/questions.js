import { readDb, updateDb } from './storage.js';
import { ok, fail, guard } from './result.js';
import { authorize } from './auth.js';
import { uid } from './clock.js';

export const QUESTION_TYPES = { mcq: 'Multiple choice', tf: 'True / False', fib: 'Fill in the blank' };

export function validateQuestion(db, input, existing) {
  const e = {};
  const type = existing ? existing.type : input.type;
  if (!QUESTION_TYPES[type]) e.type = 'Choose a question type.';
  const text = String(input.text ?? '').trim();
  if (!text) e.text = 'Enter the question text.';
  else if (text.length > 300) e.text = 'Question text can be at most 300 characters.';

  if (type === 'mcq') {
    const opts = Array.isArray(input.options) ? input.options : [];
    if (opts.length < 2) e.options = 'Add at least two answer options.';
    const seen = new Set();
    opts.forEach((o) => {
      const t = String(o.text ?? '').trim().toLowerCase();
      if (!t) e['option_' + o.id] = 'This option can’t be empty.';
      else if (seen.has(t)) e['option_' + o.id] = 'Options must be different from each other.';
      seen.add(t);
    });
    if (!input.correct) e.correct = 'Select the correct answer.';
    else if (!opts.some((o) => o.id === input.correct)) e.correct = 'The selected correct answer is not one of the options.';
  } else if (type === 'tf') {
    if (input.correct !== 'true' && input.correct !== 'false') e.correct = 'Select True or False as the correct answer.';
  } else if (type === 'fib') {
    if (!String(input.correct ?? '').trim()) e.correct = 'Enter the correct answer.';
  }
  if (input.categoryId && !db.categories.some((c) => c.id === input.categoryId)) e.categoryId = 'That category no longer exists.';
  return e;
}

export const listQuestions = (actor, { categoryId = '', type = '', search = '' } = {}) => guard(() => {
  const a = authorize(actor, 'question.manage'); if (!a.ok) return a;
  const db = readDb();
  const s = search.trim().toLowerCase();
  const rows = db.questions
    .filter((q) => (!categoryId || q.categoryId === categoryId) && (!type || q.type === type) && (!s || q.text.toLowerCase().includes(s)))
    .map((q) => ({
      ...q,
      categoryName: db.categories.find((c) => c.id === q.categoryId)?.name || null,
      usedIn: db.quizzes.filter((z) => z.questionIds.includes(q.id)).length,
    }));
  return ok(rows);
});

/** Creates or updates (when input.id is set). Pass { quizId } to also add a new question to that quiz. */
export const saveQuestion = (actor, input, { quizId } = {}) => guard(() => {
  const a = authorize(actor, 'question.manage'); if (!a.ok) return a;
  return updateDb((db) => {
    const existing = input.id ? db.questions.find((q) => q.id === input.id) : null;
    if (input.id && !existing) return fail('NOT_FOUND', 'This question no longer exists, so it was not changed.');
    const errors = validateQuestion(db, input, existing);
    if (Object.keys(errors).length) return fail('VALIDATION', 'This question can’t be saved yet. Fix the highlighted fields.', errors);
    const type = existing ? existing.type : input.type;
    const q = {
      id: existing ? existing.id : uid('q_'), type, text: input.text.trim(),
      correct: type === 'fib' ? String(input.correct).trim() : input.correct,
      explanation: String(input.explanation ?? '').trim(), categoryId: input.categoryId || null,
      createdBy: existing ? existing.createdBy : a.data.id,
    };
    if (type === 'mcq') q.options = input.options.map((o) => ({ id: o.id, text: o.text.trim() }));
    if (existing) db.questions[db.questions.indexOf(existing)] = q; else db.questions.push(q);
    if (!existing && quizId) {
      const quiz = db.quizzes.find((z) => z.id === quizId);
      if (quiz && !quiz.questionIds.includes(q.id)) quiz.questionIds.push(q.id);
    }
    return ok(q);
  });
});

export const deleteQuestion = (actor, id) => guard(() => {
  const a = authorize(actor, 'question.manage'); if (!a.ok) return a;
  return updateDb((db) => {
    if (!db.questions.some((q) => q.id === id)) return fail('NOT_FOUND', 'This question no longer exists.');
    db.questions = db.questions.filter((q) => q.id !== id);
    db.quizzes.forEach((z) => { z.questionIds = z.questionIds.filter((x) => x !== id); });
    return ok({ id });                                           // past attempts keep their own copy of the question
  });
});
