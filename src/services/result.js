export const ok = (data = {}) => ({ ok: true, data });
export const fail = (code, error, errors = {}) => ({ ok: false, code, error, errors });
export const failAndSave = (code, error) => ({ ...fail(code, error), persist: true });

/** Runs a service body and converts storage problems into friendly error results. */
export function guard(fn) {
  try {
    return fn();
  } catch (e) {
    if (e?.code === 'STORAGE_WRITE') return fail('SAVE_FAILED', 'Your changes could not be saved. What you entered is still on screen — try again.');
    if (e?.code === 'STORAGE_READ') return fail('LOAD_FAILED', 'The data could not be loaded right now. Please try again.');
    return fail('UNEXPECTED', 'Something went wrong. Please try again.');
  }
}
