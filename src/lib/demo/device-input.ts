import { DEVICE_TYPES, type DeviceType } from "@/lib/types";

export interface DeviceBody {
  name?: unknown;
  type?: unknown;
  location?: unknown;
  userId?: unknown;
}

export interface DeviceValues {
  name: string;
  type: DeviceType;
  location: string;
}

/** Field errors shaped like the RFC 7807 `errors` map `GlobalExceptionHandler` emits. */
export function validateDevice(body: DeviceBody): {
  values?: DeviceValues;
  errors?: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) errors.name = "Device name is required";
  else if (name.length > 80) errors.name = "Device name must be 80 characters or fewer";

  const location = typeof body.location === "string" ? body.location.trim() : "";
  if (!location) errors.location = "Location is required";
  else if (location.length > 80) errors.location = "Location must be 80 characters or fewer";

  const type = typeof body.type === "string" ? (body.type as DeviceType) : ("LIGHT" as DeviceType);
  if (!DEVICE_TYPES.includes(type)) {
    errors.type = `Unsupported device type: ${String(body.type)}`;
  }

  if (Object.keys(errors).length > 0) return { errors };
  return { values: { name, type, location } };
}
