import type { NextRequest } from "next/server";
import { badRequest, problem, readJson } from "@/lib/demo/http";
import { validateDevice, type DeviceBody } from "@/lib/demo/device-input";
import { DEMO_USER_ID } from "@/lib/demo/seed";
import { MAX_DEVICES, readState, stateFits, writeState } from "@/lib/demo/state";
import type { DeviceDto } from "@/lib/types";

export async function POST(req: NextRequest) {
  const parsed = await readJson<DeviceBody>(req);
  if ("error" in parsed) return parsed.error;

  const { values, errors } = validateDevice(parsed.body);
  if (!values) return badRequest("Validation failed", errors);

  const userId = typeof parsed.body.userId === "number" ? parsed.body.userId : NaN;
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    return badRequest("Validation failed", { userId: "A valid userId is required" });
  }
  if (userId !== DEMO_USER_ID) {
    return problem(403, "Forbidden", "This playground only manages the demo account's devices");
  }

  const state = await readState();
  if (state.d.length >= MAX_DEVICES) {
    return problem(
      409,
      "Device limit reached",
      `The demo session allows up to ${MAX_DEVICES} registered devices`,
    );
  }

  const now = new Date().toISOString();
  const device: DeviceDto = {
    deviceId: state.nd,
    name: values.name,
    type: values.type,
    location: values.location,
    userId,
    createdAt: now,
    updatedAt: now,
  };
  state.nd += 1;
  state.d.push(device);

  if (!stateFits(state)) {
    return problem(
      413,
      "Session storage full",
      "This demo stores your session in a browser cookie. Delete a device or use shorter names and try again.",
    );
  }

  await writeState(state);

  return Response.json(device, { status: 201 });
}
