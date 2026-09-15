import { useCallback, useEffect, useState } from 'react';

// Runs an API call when `deps` change. Keeps the previous data while reloading
// so pages don't flash back to a loading state after an action.
// `refreshInterval` (ms) quietly refetches while the tab is visible.
export default function useApi(fetcher, deps = [], { refreshInterval } = {}) {
  const [state, setState] = useState({ data: null, loading: true, error: null });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await fetcher();
      setState({ data, loading: false, error: null });
    } catch (err) {
      if (!silent) setState((prev) => ({ ...prev, loading: false, error: err.message }));
    }
  }, deps);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!refreshInterval) return undefined;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') load({ silent: true });
    }, refreshInterval);
    return () => clearInterval(timer);
  }, [load, refreshInterval]);

  return { ...state, reload: () => load() };
}
