/** Small deterministic helpers shared by the demo API. */

export const HOUR = 3_600_000;
export const DAY = 86_400_000;
export const MINUTE = 60_000;

/** Floor a timestamp to the start of its hour (UTC-independent epoch math). */
export const hourFloor = (t: number): number => Math.floor(t / HOUR) * HOUR;

/** Floor a timestamp to local midnight. */
export function dayFloor(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * 32-bit integer hash mapped to [0, 1). Deterministic for a given (a, b) pair,
 * which is what lets the seeded telemetry be regenerated identically on every
 * stateless request instead of being stored anywhere.
 */
export function hash01(a: number, b: number): number {
  let h = (Math.floor(a) ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (Math.floor(b) >>> 0), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4_294_967_296;
}

/** Local calendar date as `YYYY-MM-DD` (matches LocalDate rendering). */
export function localDate(t: number): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Whole days between two `YYYY-MM-DD` strings (b - a). */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / DAY);
}
