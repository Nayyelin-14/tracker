import type { NextRequest } from "next/server";
import { badRequest, notFound, param, parseId, problem, readJson } from "@/lib/demo/http";
import { validateDevice, type DeviceBody } from "@/lib/demo/device-input";
import { readState, stateFits, writeState } from "@/lib/demo/state";
import { resolveDevices } from "@/lib/demo/store";
import type { DeviceDto } from "@/lib/types";

type Ctx = { params: Promise<Record<string, string>> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const id = parseId(await param(ctx, "id"));
  if (id == null) return notFound("Missing device id");
  const state = await readState();
  const device = resolveDevices(state).find((d) => d.deviceId === id);
  if (!device) return notFound(`Device not found: ${id}`);
  return Response.json(device);
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const id = parseId(await param(ctx, "id"));
  if (id == null) return notFound("Missing device id");

  const parsed = await readJson<DeviceBody>(req);
  if ("error" in parsed) return parsed.error;
  const { values, errors } = validateDevice(parsed.body);
  if (!values) return badRequest("Validation failed", errors);

  const state = await readState();
  const current = resolveDevices(state).find((d) => d.deviceId === id);
  if (!current) return notFound(`Device not found: ${id}`);

  const updated: DeviceDto = {
    ...current,
    name: values.name,
    type: values.type,
    location: values.location,
    updatedAt: new Date().toISOString(),
  };

  const createdIdx = state.d.findIndex((d) => d.deviceId === id);
  if (createdIdx >= 0) {
    state.d[createdIdx] = updated;
  } else {
    state.ed[String(id)] = updated;
  }

  if (!stateFits(state)) {
    return problem(
      413,
      "Session storage full",
      "This demo stores your session in a browser cookie. Use a shorter name/location and try again.",
    );
  }

  await writeState(state);

  return Response.json(updated);
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const id = parseId(await param(ctx, "id"));
  if (id == null) return notFound("Missing device id");

  const state = await readState();
  const exists = resolveDevices(state).some((d) => d.deviceId === id);
  if (!exists) return notFound(`Device not found: ${id}`);

  // History is retained (the seed regenerates for surviving devices only),
  // so a delete only has to drop the node from the registry.
  state.d = state.d.filter((d) => d.deviceId !== id);
  delete state.ed[String(id)];
  if (!state.xd.includes(id)) state.xd.push(id);
  await writeState(state);

  return new Response(null, { status: 204 });
}
