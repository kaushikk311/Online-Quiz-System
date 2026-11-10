import { readDb, updateDb } from './storage.js';
import { ok, fail, guard } from './result.js';
import { authorize } from './auth.js';
import { now, uid } from './clock.js';

const hasPassed = (db, userId, quizId) => db.attempts.some((a) => a.userId === userId && a.quizId === quizId && a.status === 'submitted' && a.result?.passed);
const averageOf = (rows) => (rows.length ? Math.round((rows.reduce((s, f) => s + f.rating, 0) / rows.length) * 100) / 100 : null);

export const getFeedbackSummary = (actor, quizId) => guard(() => {
  const a = authorize(actor, 'feedback.view'); if (!a.ok) return a;
  const db = readDb();
  const quiz = db.quizzes.find((q) => q.id === quizId);
  if (!quiz) return fail('NOT_FOUND', 'This quiz no longer exists.');
  const rows = db.feedback.filter((f) => f.quizId === quizId);
  return ok({
    quiz: { id: quiz.id, title: quiz.title }, average: averageOf(rows), count: rows.length,
    comments: rows.filter((f) => f.comment).sort((x, y) => y.createdAt - x.createdAt)
      .map((f) => ({ id: f.id, rating: f.rating, comment: f.comment, createdAt: f.createdAt, name: db.users.find((u) => u.id === f.userId)?.name || 'Student' })),
    mine: rows.find((f) => f.userId === a.data.id) || null,
    canSubmit: a.data.role === 'student' && hasPassed(db, a.data.id, quizId),
    isStudent: a.data.role === 'student',
  });
});

/** UC13: only students who passed the quiz may rate it. */
export const submitFeedback = (actor, quizId, { rating, comment = '' }) => guard(() => {
  const a = authorize(actor, 'feedback.submit'); if (!a.ok) return a;
  return updateDb((db) => {
    if (!db.quizzes.some((q) => q.id === quizId)) return fail('NOT_FOUND', 'This quiz no longer exists.');
    if (!hasPassed(db, a.data.id, quizId)) return fail('NOT_ELIGIBLE', 'You can rate a quiz once you have passed it.');
    const r = Number(rating);
    const errors = {};
    if (rating === '' || rating === null || rating === undefined || !Number.isInteger(r) || r < 1 || r > 5) errors.rating = 'Choose a rating from 1 to 5.';
    if (String(comment).length > 500) errors.comment = 'Comments can be at most 500 characters.';
    if (Object.keys(errors).length) return fail('VALIDATION', 'Your feedback can’t be sent yet.', errors);
    const existing = db.feedback.find((f) => f.quizId === quizId && f.userId === a.data.id);
    if (existing) Object.assign(existing, { rating: r, comment: String(comment).trim(), createdAt: now() });
    else db.feedback.push({ id: uid('fb_'), quizId, userId: a.data.id, rating: r, comment: String(comment).trim(), createdAt: now() });
    return ok({ average: averageOf(db.feedback.filter((f) => f.quizId === quizId)) });
  });
});
