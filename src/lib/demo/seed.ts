import type { DeviceDto, DeviceType, UserDto } from "@/lib/types";
import { DAY, HOUR, MINUTE, dayFloor, hash01, hourFloor, round2 } from "./util";

/**
 * Deterministic demo dataset.
 *
 * This mirrors what `DemoDataSeeder` writes against the real Java backend:
 * three demo devices, a week of hourly readings following a day/night curve,
 * a 500 kWh threshold with alerting armed. The difference is that every value
 * is derived from a pure function of (deviceId, timestamp) so a stateless
 * serverless request can rebuild the identical series without a database.
 */

export const DEMO_USER_ID = 7482910364527183;

const SEED_CREATED_AT = "2026-09-28T09:12:04.000Z";

export const BASE_USER: UserDto = {
  userId: DEMO_USER_ID,
  email: "demo@energytracker.dev",
  name: "Demo User",
  address: "24 Maple Street",
  alerting: true,
  energyAlertingThreshold: 500,
  demo: true,
  createdAt: SEED_CREATED_AT,
  updatedAt: SEED_CREATED_AT,
};

/** Names/types/locations copied from `DemoDataSeeder.DEMO_DEVICES`. */
export const BASE_DEVICES: DeviceDto[] = [
  {
    deviceId: 1001,
    name: "Living Room Meter",
    type: "THERMOSTAT" as DeviceType,
    location: "Living Room",
    userId: DEMO_USER_ID,
    createdAt: SEED_CREATED_AT,
    updatedAt: SEED_CREATED_AT,
  },
  {
    deviceId: 1002,
    name: "Kitchen AC",
    type: "LIGHT" as DeviceType,
    location: "Kitchen",
    userId: DEMO_USER_ID,
    createdAt: SEED_CREATED_AT,
    updatedAt: SEED_CREATED_AT,
  },
  {
    deviceId: 1003,
    name: "Solar Panel",
    type: "CAMERA" as DeviceType,
    location: "Roof",
    userId: DEMO_USER_ID,
    createdAt: SEED_CREATED_AT,
    updatedAt: SEED_CREATED_AT,
  },
];

/**
 * Relative draw per device so the "Energy by device" ranking has a clear
 * winner instead of three identical thirds (the raw seeder reuses one curve
 * for every device, which makes every share exactly 33.3%).
 */
const DEVICE_WEIGHT: Record<number, number> = {
  1001: 1.55,
  1002: 1.0,
  1003: 0.62,
};

/** Same curve as `DemoDataSeeder.generateReading`, anchored to wall-clock hour. */
function baseForHour(hourOfDay: number): number {
  if (hourOfDay <= 6) return 2.0;
  if (hourOfDay <= 9) return 4.0;
  if (hourOfDay <= 16) return 5.0;
  if (hourOfDay <= 21) return 8.0;
  return 3.0;
}

/** Energy (kWh) one device drew in the hour starting at `hourTs`. */
export function hourlyEnergy(deviceId: number, hourTs: number): number {
  const weight = DEVICE_WEIGHT[deviceId] ?? 1;
  const variation = hash01(deviceId, hourTs) * 2 - 1; // [-1, 1)
  const raw = baseForHour(new Date(hourTs).getHours()) + variation;
  return round2(Math.max(0.5, raw) * weight);
}

/**
 * First historical hour and last *seeded* hour for a `days` window.
 * The current hour is deliberately excluded from the seed — in the real stack
 * it only fills up once readings start arriving, so the chart's right edge is
 * live territory the Simulation page writes into.
 */
export function seededRange(days: number, now = Date.now()) {
  const curHour = hourFloor(now);
  return {
    curHour,
    start: curHour - days * DAY,
    end: curHour - HOUR,
  };
}

export interface SeededAlert {
  id: number;
  userId: number;
  message: string;
  threshold: number;
  energyConsumed: number;
  email: string;
  sent: boolean;
  createdAt: string;
}

/**
 * Two crossings already in the ledger so Overview and Alerts are populated on
 * first paint. Both are genuine threshold breaches against the 500 kWh limit
 * (the same shape the alert service records), anchored to local midnight so
 * they stay inside the 7-day window on every request.
 */
export function seededAlerts(now = Date.now()): SeededAlert[] {
  const midnight = dayFloor(now);
  const at = (daysAgo: number, hour: number, minute: number) =>
    new Date(midnight - daysAgo * DAY + hour * HOUR + minute * MINUTE).toISOString();

  return [
    {
      id: 1,
      userId: DEMO_USER_ID,
      message: "Energy consumption threshold exceeded",
      threshold: 500,
      energyConsumed: 642.31,
      email: BASE_USER.email,
      sent: true,
      createdAt: at(3, 19, 12),
    },
    {
      id: 2,
      userId: DEMO_USER_ID,
      message: "Energy consumption threshold exceeded",
      threshold: 500,
      energyConsumed: 711.08,
      email: BASE_USER.email,
      sent: true,
      createdAt: at(1, 20, 47),
    },
  ];
}
