import type {
  AlertDto,
  DeviceDto,
  DeviceSeriesDto,
  EnergyPointDto,
  UsageCoverageDto,
  UsageDto,
  UsageSeriesDto,
  UserDto,
} from "@/lib/types";
import { BASE_DEVICES, BASE_USER, hourlyEnergy, seededAlerts, seededRange } from "./seed";
import type { DemoState } from "./state";
import { DAY, HOUR, dayFloor, daysBetween, hourFloor, localDate, round2 } from "./util";

const SEEDED_IDS = new Set(BASE_DEVICES.map((d) => d.deviceId));

/** The seeder writes exactly one week of history — asking for more days cannot
 *  invent readings the real stack would not have. */
const SEED_DAYS = 7;

/** The demo account, with this visitor's threshold/alerting overrides applied. */
export function resolveUser(state: DemoState): UserDto {
  return {
    ...BASE_USER,
    name: state.u.n,
    email: state.u.e,
    address: state.u.ad,
    alerting: state.u.a,
    energyAlertingThreshold: state.u.t,
  };
}

/** Seeded devices (with session edits) plus devices registered this session. */
export function resolveDevices(state: DemoState): DeviceDto[] {
  if (!state.init) return [];
  const deleted = new Set(state.xd);
  const out: DeviceDto[] = [];
  if (state.seed) {
    for (const base of BASE_DEVICES) {
      if (deleted.has(base.deviceId)) continue;
      out.push(state.ed[String(base.deviceId)] ?? base);
    }
  }
  for (const dev of state.d) {
    if (deleted.has(dev.deviceId)) continue;
    out.push(dev);
  }
  return out;
}

/**
 * Hourly energy for one device across the inclusive bucket range `[start, end]`.
 *
 * Seeded devices get the regenerated history (never older than the week the
 * seeder writes); devices registered during the session have none, exactly like
 * a node added to a running system. Dispatched spikes fold into their hour.
 */
function deviceHourly(
  dev: DeviceDto,
  start: number,
  end: number,
  state: DemoState,
  now: number,
): Map<number, number> {
  const map = new Map<number, number>();
  // Base devices carry generated history when the demo home is in play; custom
  // onboarding devices carry it only when the visitor opted into history.
  const seeded = (state.seed && SEEDED_IDS.has(dev.deviceId)) || state.hi.includes(dev.deviceId);

  if (seeded) {
    const from = Math.max(start, seededRange(SEED_DAYS, now).start);
    const to = Math.min(end, hourFloor(now) - HOUR);
    for (let t = from; t <= to; t += HOUR) {
      map.set(t, hourlyEnergy(dev.deviceId, t));
    }
  }

  for (const spike of state.s) {
    if (spike.deviceId !== dev.deviceId) continue;
    if (spike.hour < start || spike.hour > end) continue;
    map.set(spike.hour, round2((map.get(spike.hour) ?? 0) + spike.energy));
  }
  return map;
}

/**
 * Trailing window for a query.
 *
 * `hour` keeps the seeder's rolling 24 h grid. `day` snaps the start to local
 * midnight so a request for `days` yields exactly `days` calendar buckets,
 * clamped to the first *whole* day the seeder covers — the first seeded hour
 * can land mid-day, and a partial leading day would otherwise surface as an
 * extra bucket sitting next to a "Last 7 days" label.
 */
function window(now: number, days: number, align: "hour" | "day" = "hour") {
  if (align === "day") {
    const firstWholeDay = dayFloor(hourFloor(now) - SEED_DAYS * DAY) + DAY;
    return {
      start: Math.max(dayFloor(now) - (days - 1) * DAY, firstWholeDay),
      end: hourFloor(now),
    };
  }
  const { start, curHour } = seededRange(days, now);
  return { start, end: curHour };
}

/** Per-device totals over the trailing window, matching `getXDaysUsageForUser`. */
export function usageTotals(state: DemoState, days = 7, now = Date.now()): UsageDto {
  const devices = resolveDevices(state);
  const { start, end } = window(now, days);

  const out = devices.map((dev) => {
    let total = 0;
    for (const v of deviceHourly(dev, start, end, state, now).values()) total += v;
    return {
      deviceId: dev.deviceId,
      name: dev.name,
      type: dev.type,
      location: dev.location,
      userId: dev.userId,
      energyConsumed: round2(total),
    };
  });

  return { devices: out };
}

/** Per-device time series, bucketed by hour or local day. */
export function usageSeries(
  state: DemoState,
  days = 7,
  interval: "hour" | "day" = "hour",
  now = Date.now(),
): UsageSeriesDto {
  const effectiveDays = interval === "hour" ? Math.min(days, 7) : Math.min(days, 90);
  const devices = resolveDevices(state);
  const { start, end } = window(now, effectiveDays, interval);

  const deviceSeries: DeviceSeriesDto[] = devices.map((dev) => {
    const hourly = deviceHourly(dev, start, end, state, now);

    let points: EnergyPointDto[];
    if (interval === "hour") {
      points = [...hourly.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([t, energyConsumed]) => ({ time: new Date(t).toISOString(), energyConsumed }));
    } else {
      const daily = new Map<number, number>();
      for (const [t, v] of hourly) {
        const day = dayFloor(t);
        daily.set(day, round2((daily.get(day) ?? 0) + v));
      }
      points = [...daily.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([t, energyConsumed]) => ({ time: new Date(t).toISOString(), energyConsumed }));
    }

    return {
      deviceId: dev.deviceId,
      name: dev.name,
      type: dev.type,
      location: dev.location,
      points,
    };
  });

  return {
    userId: BASE_USER.userId,
    interval,
    days: effectiveDays,
    devices: deviceSeries,
  };
}

function distinctDays(state: DemoState, days: number, now: number): string[] {
  const devices = resolveDevices(state);
  const { start, end } = window(now, days, "day");
  const seen = new Set<string>();
  for (const dev of devices) {
    for (const t of deviceHourly(dev, start, end, state, now).keys()) seen.add(localDate(t));
  }
  return [...seen].sort();
}

/** How much history actually exists, using the same rules as `getCoverage`. */
export function coverage(state: DemoState, days = 30, now = Date.now()): UsageCoverageDto {
  const devices = resolveDevices(state);
  if (devices.length === 0) {
    return {
      firstDataDay: null,
      lastDataDay: null,
      maxDays: 0,
      daysWithData: 0,
      deviceCount: 0,
      devicesWithNoData: [],
      hasAnyData: false,
    };
  }

  const { start, end } = window(now, days, "day");
  const devicesWithNoData: number[] = [];
  for (const dev of devices) {
    if (deviceHourly(dev, start, end, state, now).size === 0) {
      devicesWithNoData.push(dev.deviceId);
    }
  }

  const sortedDays = distinctDays(state, days, now);
  if (sortedDays.length === 0) {
    return {
      firstDataDay: null,
      lastDataDay: null,
      maxDays: 0,
      daysWithData: 0,
      deviceCount: devices.length,
      devicesWithNoData,
      hasAnyData: false,
    };
  }

  const firstDataDay = sortedDays[0];
  const lastDataDay = sortedDays[sortedDays.length - 1];

  return {
    firstDataDay,
    lastDataDay,
    maxDays: Math.max(1, daysBetween(firstDataDay, localDate(now)) + 1),
    daysWithData: sortedDays.length,
    deviceCount: devices.length,
    devicesWithNoData,
    hasAnyData: true,
  };
}

export const ALERT_MESSAGE = "Energy consumption threshold exceeded";

/** Seeded history plus anything this visitor's spikes raised, newest first. */
export function alerts(state: DemoState, limit?: number, now = Date.now()): AlertDto[] {
  if (!state.init) return [];

  const session: AlertDto[] = state.A.map((a) => ({
    id: a.id,
    userId: BASE_USER.userId,
    message: ALERT_MESSAGE,
    threshold: a.threshold,
    energyConsumed: a.energyConsumed,
    email: state.u.e,
    sent: a.sent,
    createdAt: a.createdAt,
  }));

  const merged = [
    ...(state.seed ? seededAlerts(now).map<AlertDto>((a) => ({ ...a })) : []),
    ...session,
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return limit != null ? merged.slice(0, limit) : merged;
}

/** Sum of every device's energy in one hour bucket — what the checker compares. */
export function hourTotal(state: DemoState, hourTs: number, now = Date.now()): number {
  let total = 0;
  for (const dev of resolveDevices(state)) {
    const points = deviceHourly(dev, hourTs, hourTs, state, now);
    total += points.get(hourTs) ?? 0;
  }
  return round2(total);
}

/** Aggregate stats the insight text is assembled from. */
export interface UsageStats {
  requestedDays: number;
  effectiveDays: number;
  periodAdjusted: boolean;
  total: number;
  avgPerDay: number;
  deviceCount: number;
  top: { name: string; type: string; energy: number; share: number } | null;
  peakHour: number | null;
  alertCount: number;
  threshold: number;
  alerting: boolean;
}

export function usageStats(state: DemoState, days: number, now = Date.now()): UsageStats {
  const dataDays = distinctDays(state, days, now).length;
  const effectiveDays = Math.max(1, Math.min(days, dataDays || days));

  const totals = usageTotals(state, days, now);
  const total = round2(totals.devices.reduce((s, d) => s + d.energyConsumed, 0));
  const ranked = [...totals.devices].sort((a, b) => b.energyConsumed - a.energyConsumed);
  const top = ranked[0];

  const series = usageSeries(state, Math.min(days, 7), "hour", now);
  const byHour = new Map<number, number>();
  for (const d of series.devices) {
    for (const p of d.points) {
      if (!p.time) continue;
      const h = new Date(p.time).getHours();
      byHour.set(h, round2((byHour.get(h) ?? 0) + p.energyConsumed));
    }
  }
  let peakHour: number | null = null;
  let peakValue = -1;
  for (const [h, v] of byHour) {
    if (v > peakValue) {
      peakValue = v;
      peakHour = h;
    }
  }

  return {
    requestedDays: days,
    effectiveDays,
    periodAdjusted: effectiveDays < days,
    total,
    avgPerDay: round2(total / effectiveDays),
    deviceCount: totals.devices.length,
    top: top
      ? {
          name: top.name,
          type: top.type,
          energy: top.energyConsumed,
          share: total > 0 ? top.energyConsumed / total : 0,
        }
      : null,
    peakHour,
    alertCount: alerts(state, undefined, now).length,
    threshold: state.u.t,
    alerting: state.u.a,
  };
}
