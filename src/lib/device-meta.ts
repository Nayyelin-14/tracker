import {
  BellNotification,
  Camera,
  LightBulb,
  Lock,
  Microphone,
  TemperatureUp,
} from "iconoir-react";
import type { DeviceType } from "./types";
import type { ForwardRefExoticComponent, RefAttributes, SVGProps } from "react";

/** Iconoir icon component type — width/height/strokeWidth + standard SVG props. */
export type DeviceIcon = ForwardRefExoticComponent<
  Omit<SVGProps<SVGSVGElement>, "ref"> & RefAttributes<SVGSVGElement>
>;

/**
 * Semantic tint per device type — subtle wash chips. Colors come from CSS
 * variables (see globals.css) so each theme tunes them for contrast.
 */
export const DEVICE_META: Record<
  DeviceType,
  { icon: DeviceIcon; tint: string; label: string }
> = {
  SPEAKER: {
    icon: Microphone,
    tint: "text-device-speaker bg-device-speaker-soft border-device-speaker/25",
    label: "Speaker",
  },
  CAMERA: {
    icon: Camera,
    tint: "text-device-camera bg-device-camera-soft border-device-camera/25",
    label: "Camera",
  },
  THERMOSTAT: {
    icon: TemperatureUp,
    tint: "text-device-thermostat bg-device-thermostat-soft border-device-thermostat/25",
    label: "Thermostat",
  },
  LIGHT: {
    icon: LightBulb,
    tint: "text-device-light bg-device-light-soft border-device-light/25",
    label: "Light",
  },
  LOCK: {
    icon: Lock,
    tint: "text-device-lock bg-device-lock-soft border-device-lock/25",
    label: "Lock",
  },
  DOORBELL: {
    icon: BellNotification,
    tint: "text-device-doorbell bg-device-doorbell-soft border-device-doorbell/25",
    label: "Doorbell",
  },
};

export function deviceMeta(type: string) {
  return DEVICE_META[type as DeviceType] ?? DEVICE_META.LIGHT;
}
