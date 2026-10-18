"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, isNetworkError } from "./api";

export interface AsyncState<T> {
  data: T | null;
  error: ApiError | null;
  /** First load for the current deps — nothing to show yet. */
  loading: boolean;
  /** A refetch is in flight and stale data is still on screen. */
  refreshing: boolean;
  reload: () => void;
}

/**
 * Minimal fetch-on-mount hook with reload. Errors are normalized to ApiError
 * so pages can branch on offline (status 0) vs HTTP failures.
 *
 * `loading` is true only while the first request for the current deps is in
 * flight; `refreshing` covers everything after that, so a manual reload can
 * swap in skeletons instead of silently leaving stale numbers on screen.
 *
 * Both flags are derived — the effect never calls setState synchronously, it
 * only records which `tick` has settled. `tick` is bumped by `reload()` in the
 * event handler, so the in-flight window opens the moment the button is
 * pressed and closes when the response lands.
 */
export function useAsync<T>(
  fn: () => Promise<T>,
  deps: readonly unknown[],
  opts?: { enabled?: boolean },
): AsyncState<T> {
  const enabled = opts?.enabled ?? true;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [tick, setTick] = useState(0);
  const [settledTick, setSettledTick] = useState(-1);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fn()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof ApiError
            ? err
            : new ApiError(
                isNetworkError(err) ? 0 : 500,
                "unknown",
                err instanceof Error ? err.message : undefined,
              ),
        );
      })
      .finally(() => {
        if (!cancelled) setSettledTick(tick);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick, enabled]);

  const inFlight = tick > settledTick;

  return {
    data,
    error,
    loading: enabled && data === null && error === null,
    refreshing: enabled && inFlight && data !== null,
    reload,
  };
}
