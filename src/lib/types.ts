/** Types mirroring the energy-tracker backend DTOs. */

export type DeviceType =
  | "SPEAKER"
  | "CAMERA"
  | "THERMOSTAT"
  | "LIGHT"
  | "LOCK"
  | "DOORBELL";

export const DEVICE_TYPES: DeviceType[] = [
  "SPEAKER",
  "CAMERA",
  "THERMOSTAT",
  "LIGHT",
  "LOCK",
  "DOORBELL",
];

export interface UserDto {
  userId: number;
  email: string;
  name: string;
  address: string;
  alerting: boolean;
  energyAlertingThreshold: number;
  demo: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface DeviceDto {
  deviceId: number;
  name: string;
  type: DeviceType;
  location: string;
  userId: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface UsageDeviceDto {
  deviceId?: number;
  name: string;
  type: string;
  location: string;
  energyConsumed: number;
}

export interface UsageDto {
  devices: UsageDeviceDto[];
}

export interface EnergyPointDto {
  energyConsumed: number;
  /** Bucket start (ISO instant) — emitted by the usage service; optional
   *  only for defensive tolerance of older payloads. */
  time?: string;
}

export interface DeviceSeriesDto {
  deviceId?: number;
  name: string;
  type: string;
  location: string;
  points: EnergyPointDto[];
}

export interface UsageSeriesDto {
  userId?: number;
  interval: "hour" | "day";
  days?: number;
  devices: DeviceSeriesDto[];
}

export interface UsageCoverageDto {
  firstDataDay: string | null;
  lastDataDay: string | null;
  maxDays: number;
  daysWithData: number;
  deviceCount: number;
  devicesWithNoData: number[];
  hasAnyData: boolean;
}

export interface AlertDto {
  id: number;
  userId: number;
  message: string;
  threshold: number;
  energyConsumed: number;
  email: string;
  sent: boolean;
  createdAt: string;
}

export type InsightType = "SAVING_TIPS" | "OVERVIEW";

export interface LlmUsageMetrics {
  model?: string;
  provider?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  latencyMs?: number;
}

export interface InsightDto {
  userId: number;
  type: InsightType;
  tips: string;
  energyUsage: number;
  requestedDays: number | null;
  effectiveDays: number | null;
  periodAdjusted: boolean;
  metrics?: LlmUsageMetrics;
}

export interface ProviderCatalogDto {
  defaultProvider?: string;
  defaultModel?: string;
  maxDays?: number;
  defaultDays?: number;
  providers: ProviderEntry[];
}

export interface ProviderEntry {
  id: string;
  displayName: string;
  models: ModelInfo[];
}

export interface ModelInfo {
  id: string;
  displayName: string;
}

export interface SimulateResponse {
  deviceId?: number;
  mode?: string;
  // ingestion-service returns `readingsSent` / `totalEnergyKwh`
  readingsSent?: number;
  totalEnergyKwh?: number;
  message?: string;
  /** Demo extension: set when this dispatch crossed the threshold on the way up. */
  alertRaised?: boolean;
  alert?: AlertDto | null;
}
