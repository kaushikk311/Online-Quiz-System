import { readDb } from './storage.js';
import { ok, fail, guard } from './result.js';
import { authorize } from './auth.js';

export const TIE_RULE = 'Students with the same score share a rank and the next rank is skipped (1, 2, 2, 4). Tied students are listed alphabetically.';

/** UC07: ranks each student's best attempt on one quiz, highest score first. */
export const getLeaderboard = (actor, quizId) => guard(() => {
  const a = authorize(actor, 'leaderboard.view'); if (!a.ok) return a;
  const db = readDb();
  const quiz = db.quizzes.find((q) => q.id === quizId);
  if (!quiz) return fail('NOT_FOUND', 'That quiz could not be found.');
  const best = new Map();
  db.attempts.filter((x) => x.quizId === quizId && x.status === 'submitted' && x.result).forEach((x) => {
    const cur = best.get(x.userId);
    if (!cur || x.result.score > cur.result.score || (x.result.score === cur.result.score && x.timeTaken < cur.timeTaken)) best.set(x.userId, x);
  });
  const sorted = [...best.values()].map((x) => ({
    userId: x.userId, name: db.users.find((u) => u.id === x.userId)?.name || 'Unknown',
    score: x.result.score, total: x.result.total, percentage: x.result.percentage, timeTaken: x.timeTaken,
  })).sort((p, q) => q.score - p.score || p.name.localeCompare(q.name));
  let rank = 0;
  const entries = sorted.map((e, i) => {
    if (i === 0 || e.score !== sorted[i - 1].score) rank = i + 1;
    return { ...e, rank, tied: sorted.filter((o) => o.score === e.score).length > 1 };
  });
  return ok({ quiz: { id: quiz.id, title: quiz.title }, entries, tieRule: TIE_RULE });
});
