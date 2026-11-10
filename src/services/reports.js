import { readDb } from './storage.js';
import { ok, fail, guard } from './result.js';
import { authorize } from './auth.js';

const avg = (arr) => (arr.length ? Math.round((arr.reduce((s, n) => s + n, 0) / arr.length) * 10) / 10 : 0);
const done = (db) => db.attempts.filter((a) => a.status === 'submitted' && a.result);

export const listReportStudents = (actor) => guard(() => {
  const a = authorize(actor, 'report.view'); if (!a.ok) return a;
  return ok(readDb().users.filter((u) => u.role === 'student').map(({ id, name }) => ({ id, name })));
});

export const listReportQuizzes = (actor) => guard(() => {
  const a = authorize(actor, 'report.view'); if (!a.ok) return a;
  const db = readDb(), all = done(db);
  return ok(db.quizzes.map((q) => ({ id: q.id, title: q.title, attempts: all.filter((x) => x.quizId === q.id).length })));
});

/** UC06: individual student report. */
export const studentReport = (actor, studentId) => guard(() => {
  const a = authorize(actor, 'report.view'); if (!a.ok) return a;
  const db = readDb();
  const student = db.users.find((u) => u.id === studentId && u.role === 'student');
  if (!student) return fail('NOT_FOUND', 'That student could not be found.');
  const rows = done(db).filter((x) => x.userId === studentId).sort((x, y) => y.submittedAt - x.submittedAt)
    .map((x) => ({ id: x.id, quizId: x.quizId, quizTitle: x.quizTitle, score: x.result.score, total: x.result.total, percentage: x.result.percentage,
      passed: x.result.passed, submittedAt: x.submittedAt, timeTaken: x.timeTaken, auto: x.submitReason === 'timeout' }));
  const perQuiz = [...new Set(rows.map((r) => r.quizId))].map((id) => {
    const r = rows.filter((x) => x.quizId === id);
    return { quizId: id, quizTitle: r[0].quizTitle, attempts: r.length, best: Math.max(...r.map((x) => x.percentage)), latest: r[0].percentage };
  });
  return ok({
    student: { id: student.id, name: student.name }, rows, perQuiz,
    summary: { attempts: rows.length, quizzes: perQuiz.length, average: avg(rows.map((r) => r.percentage)),
      best: rows.length ? Math.max(...rows.map((r) => r.percentage)) : 0, passRate: rows.length ? Math.round((rows.filter((r) => r.passed).length / rows.length) * 100) : 0 },
  });
});

/** UC06: class-wide report for one quiz, computed from every stored submitted attempt. */
export const classReport = (actor, quizId) => guard(() => {
  const a = authorize(actor, 'report.view'); if (!a.ok) return a;
  const db = readDb();
  const quiz = db.quizzes.find((q) => q.id === quizId);
  if (!quiz) return fail('NOT_FOUND', 'That quiz could not be found.');
  const atts = done(db).filter((x) => x.quizId === quizId);
  const rows = atts.map((x) => ({ id: x.id, name: db.users.find((u) => u.id === x.userId)?.name || 'Unknown', score: x.result.score, total: x.result.total,
    percentage: x.result.percentage, passed: x.result.passed, submittedAt: x.submittedAt, timeTaken: x.timeTaken, auto: x.submitReason === 'timeout' }))
    .sort((x, y) => y.percentage - x.percentage || x.name.localeCompare(y.name));
  const pcts = rows.map((r) => r.percentage);
  const buckets = [0, 20, 40, 60, 80].map((lo) => ({ label: lo === 80 ? '80–100' : `${lo}–${lo + 19}`, count: pcts.filter((p) => (lo === 80 ? p >= 80 : p >= lo && p < lo + 20)).length }));
  const qStats = new Map();
  atts.forEach((x) => x.questions.forEach((q) => {
    const st = x.result.items.find((i) => i.questionId === q.id)?.status;
    const e = qStats.get(q.id) || { text: q.text, answered: 0, correct: 0 };
    e.answered++; if (st === 'correct') e.correct++;
    qStats.set(q.id, e);
  }));
  return ok({
    quiz: { id: quiz.id, title: quiz.title, passingPercentage: quiz.passingPercentage },
    stats: {
      attempts: rows.length, students: new Set(atts.map((x) => x.userId)).size, average: avg(pcts),
      highest: rows.length ? Math.max(...pcts) : 0, lowest: rows.length ? Math.min(...pcts) : 0,
      passed: rows.filter((r) => r.passed).length, failed: rows.filter((r) => !r.passed).length,
      passRate: rows.length ? Math.round((rows.filter((r) => r.passed).length / rows.length) * 100) : 0,
    },
    buckets, rows,
    questions: [...qStats.values()].map((q) => ({ ...q, rate: Math.round((q.correct / q.answered) * 100) })),
  });
});
