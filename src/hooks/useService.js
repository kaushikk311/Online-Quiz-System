import { useMemo, useState } from 'react';

/** Runs a (synchronous) service call and re-runs it when deps change or reload() is called. */
export function useService(fn, deps) {
  const [tick, setTick] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const res = useMemo(() => fn(), [...deps, tick]);
  return [res, () => setTick((t) => t + 1)];
}
