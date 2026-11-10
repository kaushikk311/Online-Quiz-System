import { useEffect, useState } from 'react';
import { now } from '../services/clock.js';

/** Milliseconds left until `deadline`. Computed from the clock each tick, so throttled tabs never drift. */
export function useCountdown(deadline) {
  const [left, setLeft] = useState(() => deadline - now());
  useEffect(() => {
    const tick = () => setLeft(deadline - now());
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [deadline]);
  return left;
}
