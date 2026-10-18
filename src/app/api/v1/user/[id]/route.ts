import type { NextRequest } from "next/server";
import { badRequest, notFound, param, parseId, problem, readJson } from "@/lib/demo/http";
import { DEMO_USER_ID } from "@/lib/demo/seed";
import { readState, stateFits, writeState } from "@/lib/demo/state";
import { validateProfile } from "@/lib/demo/profile-input";
import { resolveUser } from "@/lib/demo/store";
import type { UserDto } from "@/lib/types";

type Ctx = { params: Promise<Record<string, string>> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const id = parseId(await param(ctx, "id"));
  if (id !== DEMO_USER_ID) return notFound(`No user with id ${id}`);
  const state = await readState();
  if (!state.init) return notFound("No demo user is provisioned for this session.");
  return Response.json(resolveUser(state));
}

interface UpdateUserBody {
  name?: unknown;
  email?: unknown;
  address?: unknown;
  alerting?: unknown;
  energyAlertingThreshold?: unknown;
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const id = parseId(await param(ctx, "id"));
  if (id !== DEMO_USER_ID) return notFound(`No user with id ${id}`);

  const existing = await readState();
  if (!existing.init) return notFound("No demo user is provisioned for this session.");

  const parsed = await readJson<UpdateUserBody>(req);
  if ("error" in parsed) return parsed.error;
  const body = parsed.body ?? {};

  const errors: Record<string, string> = {};

  let threshold: number | undefined;
  if (body.energyAlertingThreshold !== undefined) {
    threshold = Number(body.energyAlertingThreshold);
    if (!Number.isFinite(threshold) || threshold <= 0) {
      errors.energyAlertingThreshold = "Threshold must be a positive number";
    } else if (threshold > 100_000) {
      errors.energyAlertingThreshold = "Threshold must be 100000 kWh or less";
    }
  }

  if (body.alerting !== undefined && typeof body.alerting !== "boolean") {
    errors.alerting = "Alerting must be true or false";
  }

  const profile = validateProfile(body);
  Object.assign(errors, profile.errors);

  if (Object.keys(errors).length > 0) {
    return badRequest("Validation failed", errors);
  }

  const state = await readState();
  if (threshold !== undefined) {
    state.u.t = Math.round(threshold * 100) / 100;
    // Re-arm edge detection whenever the limit moves, so the next crossing is
    // judged against the new value instead of a stale breach flag.
    state.br = { h: 0, t: state.u.t, v: false };
  }
  if (typeof body.alerting === "boolean") state.u.a = body.alerting;
  if (profile.values.name !== undefined) state.u.n = profile.values.name;
  if (profile.values.email !== undefined) state.u.e = profile.values.email;
  if (profile.values.address !== undefined) state.u.ad = profile.values.address;

  if (!stateFits(state)) {
    return problem(
      413,
      "Session storage full",
      "This demo stores your session in a browser cookie. Use a shorter value and try again.",
    );
  }

  await writeState(state);

  const user: UserDto = resolveUser(state);
  return Response.json(user);
}
