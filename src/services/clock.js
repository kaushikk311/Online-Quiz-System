// Central clock + randomness so that schedules, timers and shuffling are testable.
const OFFSET_KEY = 'tickmark.clockOffset';
let fixed = null;
let rnd = Math.random;

function readOffset() {
  try { return Number(globalThis.sessionStorage?.getItem(OFFSET_KEY)) || 0; } catch { return 0; }
}

export const now = () => (fixed !== null ? fixed : Date.now() + readOffset());
export const setNow = (t) => { fixed = t; };           // tests
export const resetClock = () => { fixed = null; };
export const clockOffset = () => readOffset();
export function shiftClock(ms) {                       // demo "time travel" tool
  try {
    if (ms === 0) globalThis.sessionStorage?.removeItem(OFFSET_KEY);
    else globalThis.sessionStorage?.setItem(OFFSET_KEY, String(readOffset() + ms));
  } catch { /* ignore */ }
}
export const random = () => rnd();
export const setRandom = (fn) => { rnd = fn || Math.random; };
export const uid = (prefix = '') => prefix + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
