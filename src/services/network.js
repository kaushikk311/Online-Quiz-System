let override = null;
export const isOnline = () => (override !== null ? override : typeof navigator === 'undefined' || navigator.onLine !== false);
export function setOnline(value) {
  override = value === null ? null : !!value;
  try { globalThis.dispatchEvent?.(new Event(isOnline() ? 'online' : 'offline')); } catch { /* ignore */ }
}
