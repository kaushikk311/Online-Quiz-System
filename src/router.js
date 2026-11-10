import { useEffect, useState } from 'react';

const read = () => window.location.hash.replace(/^#/, '') || '/';

export function usePath() {
  const [path, setPath] = useState(read());
  useEffect(() => {
    const on = () => setPath(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return path.split('?')[0];
}

export const navigate = (to) => { window.location.hash = to; };

export function matchPath(pattern, path) {
  const a = pattern.split('/').filter(Boolean), b = path.split('/').filter(Boolean);
  if (a.length !== b.length) return null;
  const params = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}
