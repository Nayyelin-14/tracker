/**
 * Per-instance request budget for the insight endpoints.
 *
 * The production insight-service enforces 1 generation / 10 s and 20 / hour
 * per user to protect a paid LLM quota. This deployment has no upstream quota
 * to protect, so the limit is only here to keep the 429 + Retry-After path
 * demonstrable (spam Generate a few times) without punishing normal use.
 */

const WINDOW_MS = 10_000;
const MAX_IN_WINDOW = 8;

const hits: number[] = [];

/** Returns the Retry-After seconds when the caller is throttled, else null. */
export function rateLimit(): number | null {
  const now = Date.now();
  while (hits.length > 0 && now - (hits[0] as number) > WINDOW_MS) hits.shift();
  const oldest = hits[0];
  if (hits.length >= MAX_IN_WINDOW && oldest != null) {
    return Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000));
  }
  hits.push(now);
  return null;
}
