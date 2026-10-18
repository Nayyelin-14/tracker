import { cookies } from "next/headers";
import type { DeviceDto } from "@/lib/types";

/**
 * Per-visitor demo state, carried in a signed-free HTTP cookie.
 *
 * Vercel route handlers are stateless — no filesystem, no shared memory
 * between invocations — so everything a visitor changes (threshold, device
 * CRUD, dispatched spikes, the alerts those spikes raise) travels with the
 * request and comes back on the next one. Seed data is NOT stored here: it is
 * regenerated deterministically in `seed.ts`, which keeps the cookie small
 * enough to fit inside the 4 KB browser limit.
 */

const COOKIE = "et_demo";
export const MAX_CHARS = 3_600; // base64 budget, leaves headroom under the 4093 limit

const MAX_SPIKES = 12;
const MAX_ALERTS = 12;
/** Registered (non-seeded) devices allowed per session. */
export const MAX_DEVICES = 8;

/** A batch of synthetic readings, collapsed into one hour bucket. */
export interface Spike {
  deviceId: number;
  hour: number;
  energy: number;
  readings: number;
}

/** Only the fields that differ from `seededAlerts()` are stored; `message` is a constant. */
export interface SessionAlert {
  id: number;
  threshold: number;
  energyConsumed: number;
  createdAt: string;
  sent: boolean;
}

export interface DemoState {
  v: 2;
  /** true once the visitor finished first-run onboarding */
  init: boolean;
  /** true when the generated demo home (base devices + seeded alerts) applies */
  seed: boolean;
  /** ids of session devices that should carry generated history */
  hi: number[];
  /** user overrides: alerting, threshold, name, email, address */
  u: { a: boolean; t: number; n: string; e: string; ad: string };
  /** devices registered during this session */
  d: DeviceDto[];
  /** edits to seeded devices, keyed by deviceId */
  ed: Record<string, DeviceDto>;
  /** deleted device ids */
  xd: number[];
  /** dispatched readings */
  s: Spike[];
  /** below→above crossing bookkeeping for edge-triggered alerting */
  br: { h: number; t: number; v: boolean };
  /** alerts raised during this session */
  A: SessionAlert[];
  /** next device id / alert id handed out */
  nd: number;
  na: number;
}

export function defaultState(): DemoState {
  return {
    v: 2,
    init: false,
    seed: true,
    hi: [],
    u: { a: true, t: 500, n: "Demo User", e: "demo@energytracker.dev", ad: "24 Maple Street" },
    d: [],
    ed: {},
    xd: [],
    s: [],
    br: { h: 0, t: 0, v: false },
    A: [],
    // Continue the seeded 1001–1003 sequence so a registered device reads as
    // the next node the system would have handed out.
    nd: 1004,
    na: 3,
  };
}

function encode(state: DemoState): string {
  return Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
}

function decode(raw: string): DemoState | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as DemoState;
    if (parsed?.v !== 2 || typeof parsed.u !== "object" || parsed.u === null) return null;
    const base = defaultState();
    return {
      ...base,
      ...parsed,
      u: { ...base.u, ...parsed.u },
      ed: parsed.ed ?? {},
      xd: Array.isArray(parsed.xd) ? parsed.xd : [],
      s: Array.isArray(parsed.s) ? parsed.s : [],
      A: Array.isArray(parsed.A) ? parsed.A : [],
      d: Array.isArray(parsed.d) ? parsed.d : [],
      hi: Array.isArray(parsed.hi) ? parsed.hi : [],
      br: parsed.br ?? base.br,
    };
  } catch {
    return null;
  }
}

/**
 * Drop disposable telemetry (dispatched spikes and alerts) until the state
 * fits the cookie. The profile and devices are durable — they are never
 * silently dropped here, so an endpoint that grows them checks `stateFits`
 * first and refuses with 409 when the session is full.
 */
function trimTelemetry(state: DemoState): DemoState {
  const out = { ...state };
  out.s = out.s.slice(-MAX_SPIKES);
  out.A = out.A.slice(-MAX_ALERTS);

  let encoded = encode(out);
  while (encoded.length > MAX_CHARS && out.s.length > 0) {
    out.s = out.s.slice(1);
    encoded = encode(out);
  }
  while (encoded.length > MAX_CHARS && out.A.length > 0) {
    out.A = out.A.slice(1);
    encoded = encode(out);
  }
  return out;
}

function fit(state: DemoState): DemoState {
  const out = trimTelemetry(state);
  // Defensive backstop so we never emit a cookie the browser would silently
  // drop (which would reset the whole session). Unreachable in normal use:
  // device-adding endpoints gate on `stateFits` before writing.
  let encoded = encode(out);
  while (encoded.length > MAX_CHARS && out.d.length > 1) {
    out.d = out.d.slice(1);
    encoded = encode(out);
  }
  return out;
}

/** True when the durable session (profile + devices + edits) fits the cookie
 *  once disposable telemetry is trimmed. Endpoints that add devices MUST check
 *  this before writing and answer 409 when it is false. */
export function stateFits(state: DemoState): boolean {
  return encode(trimTelemetry(state)).length <= MAX_CHARS;
}

export async function readState(): Promise<DemoState> {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  if (!raw) return defaultState();
  return decode(raw) ?? defaultState();
}

export async function writeState(state: DemoState): Promise<void> {
  const store = await cookies();
  const fitted = fit(state);
  store.set(COOKIE, encode(fitted), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  });
}

/** Forget the visitor's session entirely — the next load starts onboarding. */
export async function clearState(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}
