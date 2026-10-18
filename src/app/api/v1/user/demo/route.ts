import type { NextRequest } from "next/server";
import { badRequest, notFound, problem, readJson } from "@/lib/demo/http";
import type { DeviceDto } from "@/lib/types";
import { MAX_DEVICES, clearState, readState, stateFits, writeState } from "@/lib/demo/state";
import { validateDevice, type DeviceBody } from "@/lib/demo/device-input";
import { validateProfile } from "@/lib/demo/profile-input";
import { resolveUser } from "@/lib/demo/store";
import { DEMO_USER_ID } from "@/lib/demo/seed";

/**
 * The dashboard resolves the shared demo account once on mount.
 *
 * Until the visitor completes first-run onboarding there is no session, so the
 * endpoint answers 404 — the client turns that into the onboarding gate rather
 * than an error.
 */
export async function GET() {
  const state = await readState();
  if (!state.init) {
    return notFound("No demo user is provisioned for this session. Complete onboarding first.");
  }
  return Response.json(resolveUser(state));
}

interface OnboardingBody {
  mode?: unknown;
  name?: unknown;
  email?: unknown;
  address?: unknown;
  energyAlertingThreshold?: unknown;
  alerting?: unknown;
  history?: unknown;
  devices?: unknown;
}

/**
 * `POST /user/demo` — first-run provisioning.
 *
 * `mode: "generate"` provisions a fresh, empty demo account (no devices, no
 * alerts) that the visitor populates themselves. `mode: "custom"` creates the
 * visitor's own account with the devices they supplied and, optionally,
 * generated history. Either way the result lives entirely in the session
 * cookie.
 */
export async function POST(req: NextRequest) {
  const parsed = await readJson<OnboardingBody>(req);
  if ("error" in parsed) return parsed.error;
  const body = parsed.body ?? {};

  const mode = body.mode === "generate" ? "generate" : body.mode === "custom" ? "custom" : null;
  if (!mode) return badRequest('mode must be "generate" or "custom"');

  const errors: Record<string, string> = {};

  let threshold = 500;
  if (body.energyAlertingThreshold !== undefined && body.energyAlertingThreshold !== "") {
    threshold = Number(body.energyAlertingThreshold);
    if (!Number.isFinite(threshold) || threshold <= 0) {
      errors.energyAlertingThreshold = "Threshold must be a positive number";
    } else if (threshold > 100_000) {
      errors.energyAlertingThreshold = "Threshold must be 100000 kWh or less";
    }
  }

  let alerting = true;
  if (body.alerting !== undefined) {
    if (typeof body.alerting !== "boolean") errors.alerting = "Alerting must be true or false";
    else alerting = body.alerting;
  }

  let name = "Demo User";
  let email = "demo@energytracker.dev";
  let address = "24 Maple Street";
  let history = true;
  const devices: DeviceDto[] = [];

  if (mode === "custom") {
    const profile = validateProfile(body, { requireIdentity: true });
    Object.assign(errors, profile.errors);
    name = profile.values.name ?? "";
    email = profile.values.email ?? "";
    address = profile.values.address ?? "";
    history = body.history === undefined ? true : body.history === true;

    const rawDevices = Array.isArray(body.devices) ? body.devices : [];
    if (rawDevices.length > MAX_DEVICES) {
      errors.devices = `Choose ${MAX_DEVICES} devices or fewer`;
    }
    rawDevices.forEach((raw, i) => {
      const { values, errors: deviceErrors } = validateDevice((raw ?? {}) as DeviceBody);
      if (deviceErrors) {
        for (const [field, message] of Object.entries(deviceErrors)) {
          errors[`devices.${i}.${field}`] = message;
        }
        return;
      }
      if (!values) return;
      const createdAt = new Date().toISOString();
      devices.push({
        deviceId: 1001 + i,
        name: values.name,
        type: values.type,
        location: values.location,
        userId: DEMO_USER_ID,
        createdAt,
        updatedAt: createdAt,
      });
    });
  }

  if (Object.keys(errors).length > 0) {
    return badRequest("Validation failed", errors);
  }

  const state = await readState();
  state.init = true;
  // Nothing is pre-seeded: a fresh demo account starts empty so the visitor
  // builds the home themselves (register devices, then dispatch readings).
  state.seed = false;
  state.u = {
    a: alerting,
    t: Math.round(threshold * 100) / 100,
    n: mode === "generate" ? "Demo User" : name,
    e: mode === "generate" ? "demo@energytracker.dev" : email,
    ad: mode === "generate" ? "24 Maple Street" : address,
  };
  state.d = devices;
  state.hi = mode === "custom" && history ? state.d.map((d) => d.deviceId) : [];
  state.ed = {};
  state.xd = [];
  state.s = [];
  state.A = [];
  state.br = { h: 0, t: state.u.t, v: false };
  state.nd = 1001 + state.d.length;
  state.na = 1;

  if (!stateFits(state)) {
    return problem(
      413,
      "Session storage full",
      "This demo stores your session in a browser cookie. Use shorter names or fewer devices and try again.",
    );
  }

  await writeState(state);

  return Response.json(resolveUser(state), { status: 201 });
}

/**
 * `DELETE /user/demo` — forget the visitor's session. The cookie is the only
 * store, so clearing it returns the next load to first-run onboarding.
 */
export async function DELETE() {
  await clearState();
  return new Response(null, { status: 204 });
}
