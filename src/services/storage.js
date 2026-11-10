import { buildSeed } from '../data/seed.js';

const KEY = 'tickmark.db.v1';
const SESSION_KEY = 'tickmark.session.v1';

function memStore() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } };
}
function pick(name) {
  try { const s = globalThis[name]; if (s) { s.setItem('__probe', '1'); s.removeItem('__probe'); return s; } } catch { /* fall through */ }
  return memStore();
}
const local = pick('localStorage');      // shared data
const session = pick('sessionStorage');  // per-tab login, so several students can sit quizzes in different tabs

/** Failure switches used by the demo "Test tools" panel and by the automated tests. */
export const faults = { failRead: false, failWrite: false };
export const setFault = (name, value) => { faults[name] = !!value; };

const err = (code) => Object.assign(new Error(code), { code });

export function readDb() {
  if (faults.failRead) throw err('STORAGE_READ');
  const raw = local.getItem(KEY);
  if (!raw) {
    const seed = buildSeed();
    try { local.setItem(KEY, JSON.stringify(seed)); } catch { /* ignore */ }
    return seed;
  }
  try { return JSON.parse(raw); } catch { throw err('STORAGE_READ'); }
}

/**
 * Read-modify-write. The mutator works on a fresh copy; nothing is committed unless the write succeeds,
 * so a failed save can never leave half-written data. A mutator returning { ok:false } skips the write
 * (unless it sets persist:true, used when an expiry must be recorded even though the request is refused).
 */
export function updateDb(mutator) {
  const db = readDb();
  const out = mutator(db);
  if (out && out.ok === false && !out.persist) return out;
  if (faults.failWrite) throw err('STORAGE_WRITE');
  try { local.setItem(KEY, JSON.stringify(db)); } catch { throw err('STORAGE_WRITE'); }
  return out;
}

export const resetDb = () => { local.setItem(KEY, JSON.stringify(buildSeed())); };
export const getSessionUserId = () => session.getItem(SESSION_KEY);
export const setSessionUserId = (id) => session.setItem(SESSION_KEY, id);
export const clearSession = () => session.removeItem(SESSION_KEY);
