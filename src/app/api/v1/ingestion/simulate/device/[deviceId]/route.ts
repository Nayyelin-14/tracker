import type { NextRequest } from "next/server";
import { badRequest, notFound, param, parseId } from "@/lib/demo/http";
import { readState, writeState } from "@/lib/demo/state";
import { ALERT_MESSAGE, hourTotal, resolveDevices } from "@/lib/demo/store";
import { hourFloor, round2 } from "@/lib/demo/util";
import { DEMO_USER_ID } from "@/lib/demo/seed";
import type { AlertDto } from "@/lib/types";

type Ctx = { params: Promise<Record<string, string>> };

const PIPELINE_MESSAGE =
  "Readings sent through the ingestion pipeline. The threshold checker runs every 10 seconds — check alerts shortly.";

/**
 * `POST /ingestion/simulate/device/:deviceId?mode=normal|high`
 *
 * Stands in for Kafka → usage-service → threshold checker. Readings are folded
 * into the current hour bucket, then the same below→above edge detection the
 * scheduled checker performs decides whether an alert is raised.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const deviceId = parseId(await param(ctx, "deviceId"));
  if (deviceId == null) return badRequest("A numeric device id is required");

  const state = await readState();
  const device = resolveDevices(state).find((d) => d.deviceId === deviceId);
  if (!device) return notFound(`Device not found: ${deviceId}`);

  const mode = (req.nextUrl.searchParams.get("mode") ?? "normal").toLowerCase();
  const high = mode === "high";
  const readings = high ? 5 : 10;
  const min = high ? 100.0 : 0.5;
  const max = high ? 150.0 : 2.0;

  const now = Date.now();
  const curHour = hourFloor(now);

  let sent = 0;
  for (let i = 0; i < readings; i++) {
    sent += min + Math.random() * (max - min);
  }
  const totalSent = round2(sent);

  // Collapse the batch into the current hour bucket (one spike entry per
  // device per hour keeps the cookie small no matter how often it is pressed).
  const bucket = state.s.find((s) => s.deviceId === deviceId && s.hour === curHour);
  if (bucket) {
    bucket.energy = round2(bucket.energy + totalSent);
    bucket.readings += readings;
  } else {
    state.s.push({ deviceId, hour: curHour, energy: totalSent, readings });
  }

  const aggregate = hourTotal(state, curHour, now);
  const threshold = state.u.t;
  const above = aggregate > threshold;
  const sameHour = state.br.h === curHour && state.br.t === threshold;
  const wasAbove = sameHour && state.br.v;

  // Edge-triggered: fire once on the way up, stay quiet while it stays high,
  // re-arm as soon as the aggregate comes back under. Alerting being muted
  // suppresses the notification but still tracks the crossing, so re-arming
  // mid-violation cannot produce a duplicate.
  let raisedAlert: AlertDto | null = null;
  if (above && !wasAbove) {
    state.br = { h: curHour, t: threshold, v: true };
    if (state.u.a) {
      const createdAt = new Date(now).toISOString();
      state.A.push({
        id: state.na,
        threshold,
        energyConsumed: aggregate,
        createdAt,
        sent: true,
      });
      // Shape the same DTO the alert ledger serves, so the dashboard can show
      // the notification email the moment the crossing happens.
      raisedAlert = {
        id: state.na,
        userId: DEMO_USER_ID,
        message: ALERT_MESSAGE,
        threshold,
        energyConsumed: aggregate,
        email: state.u.e,
        sent: true,
        createdAt,
      };
      state.na += 1;
    }
  } else {
    state.br = { h: curHour, t: threshold, v: above };
  }

  await writeState(state);

  return Response.json(
    {
      status: "accepted",
      deviceId,
      deviceName: device.name ?? "",
      mode,
      readingsSent: readings,
      totalEnergyKwh: totalSent,
      alertRaised: raisedAlert != null,
      alert: raisedAlert,
      message: PIPELINE_MESSAGE,
    },
    { status: 202 },
  );
}
