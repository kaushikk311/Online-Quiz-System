import { readDb, getSessionUserId, setSessionUserId, clearSession } from './storage.js';
import { ok, fail, guard } from './result.js';
import { hashPassword } from './hash.js';

export const PERMISSIONS = {
  admin: ['category.view', 'category.manage', 'quiz.view', 'quiz.manage', 'question.manage', 'report.view', 'leaderboard.view', 'feedback.view'],
  teacher: ['category.view', 'quiz.view', 'quiz.manage', 'question.manage', 'report.view', 'leaderboard.view', 'feedback.view'],
  student: ['category.view', 'quiz.view', 'quiz.attempt', 'leaderboard.view', 'feedback.view', 'feedback.submit'],
};

export const can = (user, perm) => !!user && !!PERMISSIONS[user.role]?.includes(perm);
export const homeFor = (role) => ({ student: '/quizzes', teacher: '/manage', admin: '/categories' }[role] || '/login');

const publicUser = ({ passwordHash, ...u }) => u;

export const login = (username, password) => guard(() => {
  const u = String(username ?? '').trim();
  const p = String(password ?? '');
  const errors = {};
  if (!u) errors.username = 'Enter your username.';
  if (!p) errors.password = 'Enter your password.';
  if (Object.keys(errors).length) return fail('MISSING', 'Enter your username and password.', errors);
  const user = readDb().users.find((x) => x.username.toLowerCase() === u.toLowerCase());
  // Same message for unknown user and wrong password, so usernames cannot be probed.
  if (!user || user.passwordHash !== hashPassword(p)) return fail('INVALID', 'Username or password is incorrect.');
  setSessionUserId(user.id);
  return ok(publicUser(user));
});

export const logout = () => clearSession();

export function currentUser() {
  try {
    const id = getSessionUserId();
    const u = id && readDb().users.find((x) => x.id === id);
    return u ? publicUser(u) : null;
  } catch { return null; }
}

/** Re-checks the actor against stored data (the role stored in the database wins over anything the UI passes in). */
export function authorize(actor, perm) {
  const u = actor && readDb().users.find((x) => x.id === actor.id);
  if (!u) return fail('UNAUTHENTICATED', 'Please sign in to continue.');
  if (perm && !PERMISSIONS[u.role]?.includes(perm)) return fail('FORBIDDEN', 'Your role does not have permission to do this.');
  return ok(u);
}
