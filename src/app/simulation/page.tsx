"use client";

import { useState } from "react";
import { Activity, Check, GraphUp, Play, Refresh, WifiOff } from "iconoir-react";
import { clsx } from "clsx";
import { PageHeader } from "@/components/page-header";
import { useSession } from "@/components/session";
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Select,
  Skeleton,
  Switch,
} from "@/components/ui";
import { getDevicesByUser, simulateDevice, updateUser } from "@/lib/api";
import { useAsync } from "@/lib/use-async";
import { deviceMeta } from "@/lib/device-meta";
import { kwh } from "@/lib/format";
import { AlertEmailPreview, AlertToast } from "@/components/alert-notification";
import type { AlertDto, DeviceDto } from "@/lib/types";

interface PipelineEntry {
  id: number;
  deviceId: number;
  deviceName: string;
  mode: "normal" | "high";
  at: string;
  ok: boolean;
  detail: string;
}

export default function SimulationPage() {
  const { user, status, error, refresh, patchUser } = useSession();
  const userId = user?.userId;
  const devices = useAsync<DeviceDto[]>(() => getDevicesByUser(userId!), [userId], {
    enabled: userId != null,
  });

  const [thresholdInput, setThresholdInput] = useState<string | null>(null);
  const [alertingInput, setAlertingInput] = useState<boolean | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const [selectedDevice, setSelectedDevice] = useState<number | null>(null);
  const [dispatching, setDispatching] = useState<"normal" | "high" | null>(null);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [log, setLog] = useState<PipelineEntry[]>([]);
  const [alertToast, setAlertToast] = useState<AlertDto | null>(null);
  const [alertPreview, setAlertPreview] = useState<AlertDto | null>(null);

  if (status === "loading") return <SimulationSkeleton />;

  if (status !== "ready" || !user) {
    return (
      <>
        <PageHeader title="Simulation" description="Thresholds and synthetic telemetry" />
        <EmptyState
          icon={<WifiOff width={22} height={22} />}
          title={status === "missing" ? "Demo session not initialized" : "Demo backend unreachable"}
          description={error ?? "The request to the Next.js API layer failed. Retry in a moment."}
          actions={
            <Button variant="primary" onClick={() => void refresh()}>
              Retry
            </Button>
          }
        />
      </>
    );
  }

  const threshold = thresholdInput != null ? Number(thresholdInput) : user.energyAlertingThreshold;
  const alerting = alertingInput ?? user.alerting;
  const thresholdDirty =
    thresholdInput != null && Number(thresholdInput) !== user.energyAlertingThreshold;
  const alertingDirty = alertingInput != null && alertingInput !== user.alerting;
  const selected = (devices.data ?? []).find((d) => d.deviceId === selectedDevice) ?? null;

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    const current = user;
    if (current == null || userId == null) return;
    setSavingSettings(true);
    setSettingsError(null);
    setSettingsSaved(false);
    try {
      const updated = await updateUser(userId, {
        energyAlertingThreshold: Number(thresholdInput ?? current.energyAlertingThreshold),
        alerting: alertingInput ?? current.alerting,
      });
      patchUser(updated);
      setThresholdInput(null);
      setAlertingInput(null);
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2500);
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : "Failed to update settings.");
    } finally {
      setSavingSettings(false);
    }
  }

  async function dispatch(mode: "normal" | "high") {
    if (!selected) return;
    setDispatching(mode);
    setDispatchError(null);
    const entry: PipelineEntry = {
      id: Date.now(),
      deviceId: selected.deviceId,
      deviceName: selected.name,
      mode,
      at: new Date().toISOString(),
      ok: false,
      detail: "queued…",
    };
    setLog((prev) => [entry, ...prev].slice(0, 12));
    try {
      const res = await simulateDevice(selected.deviceId, mode);
      if (res.alert) setAlertToast(res.alert);
      setLog((prev) =>
        prev.map((l) =>
          l.id === entry.id
            ? {
                ...l,
                ok: true,
                detail:
                  res.message ??
                  `${res.readingsSent ?? (mode === "high" ? 5 : 10)} readings · ${res.totalEnergyKwh ?? "—"} kWh (${mode})`,
              }
            : l,
        ),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Dispatch failed.";
      setDispatchError(msg);
      setLog((prev) =>
        prev.map((l) => (l.id === entry.id ? { ...l, ok: false, detail: msg } : l)),
      );
    } finally {
      setDispatching(null);
    }
  }

  const noDevices = !devices.loading && !devices.refreshing && (devices.data ?? []).length === 0;

  return (
    <>
      <PageHeader
        title="Simulation"
        description="Configure alerting and dispatch synthetic telemetry through the ingestion pipeline."
        actions={
          <Button
            size="sm"
            disabled={devices.refreshing}
            onClick={() => {
              void devices.reload();
              void refresh();
            }}
          >
            <Refresh
              width={13}
              height={13}
              className={devices.refreshing ? "animate-spin" : undefined}
            />
            {devices.refreshing ? "Syncing…" : "Sync state"}
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Threshold configuration */}
        <Card className="lg:col-span-5">
          <div className="mb-1 flex items-center justify-between gap-3">
            <h2 className="type-section text-text">Threshold configuration</h2>
            <Badge tone={user.alerting ? "success" : "neutral"} dot={user.alerting}>
              {user.alerting ? "armed" : "muted"}
            </Badge>
          </div>
          <p className="mb-4 text-[12.5px] leading-relaxed text-text-secondary">
            A single ceiling evaluated against aggregate device load. When the sum crosses this
            value, the alert service emits a violation event.
          </p>

          {settingsError && (
            <div className="mb-3">
              <AlertBanner
                title="Update failed"
                description={settingsError}
                onDismiss={() => setSettingsError(null)}
              />
            </div>
          )}
          {settingsSaved && (
            <div className="mb-3">
              <AlertBanner
                tone="success"
                title="Threshold updated"
                description="New limit is live for the next evaluation cycle."
              />
            </div>
          )}

          <form onSubmit={saveSettings} className="flex flex-col gap-4">
            <Input
              label="Threshold value (kWh per window)"
              type="number"
              step="0.1"
              min="0.1"
              value={threshold}
              onChange={(e) => setThresholdInput(e.target.value)}
              className="tabular"
            />

            <div className="flex items-center justify-between rounded-[var(--radius)] border border-border bg-surface-1 px-3.5 py-3">
              <div>
                <div className="text-[13px] font-medium text-text">Edge-triggered alerting</div>
                <div className="text-[11.5px] text-text-muted">
                  Email a notification on each crossing
                </div>
              </div>
              <Switch
                checked={alerting}
                onChange={(next) => setAlertingInput(next)}
                label="Toggle edge-triggered alerting"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] text-text-muted">PUT /user/{user.userId}</span>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={savingSettings || (!thresholdDirty && !alertingDirty)}
              >
                <Check width={13} height={13} />
                {savingSettings ? "Saving…" : "Save settings"}
              </Button>
            </div>
          </form>
        </Card>

        {/* Dispatch */}
        <Card className="lg:col-span-7">
          <div className="mb-1 flex items-center justify-between gap-3">
            <h2 className="type-section text-text">Dispatch synthetic telemetry</h2>
            <Badge tone={dispatching ? "accent" : "neutral"} dot={!!dispatching}>
              {dispatching ? "pipeline active" : "idle"}
            </Badge>
          </div>
          <p className="mb-4 text-[12.5px] leading-relaxed text-text-secondary">
            Push a batch of readings for one device. Normal batches stay under the limit; the
            high-spike batch deterministically trips it.
          </p>

          {dispatchError && (
            <div className="mb-3">
              <AlertBanner
                title="Ingestion rejected"
                description={dispatchError}
                onDismiss={() => setDispatchError(null)}
              />
            </div>
          )}

          <Select
            label="Target device"
            value={selectedDevice ?? ""}
            onChange={(e) => setSelectedDevice(Number(e.target.value) || null)}
          >
            <option value="">Select a device…</option>
            {(devices.data ?? []).map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                #{d.deviceId} · {d.name} ({d.location})
              </option>
            ))}
          </Select>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              onClick={() => void dispatch("normal")}
              disabled={!selected || dispatching != null}
              className="group flex items-start gap-3 rounded-[var(--radius)] border border-border bg-surface-1 p-4 text-left transition-colors hover:border-accent/50 hover:bg-accent-soft/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius)] bg-accent-soft text-accent-text">
                <Activity width={15} height={15} />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[13px] font-semibold text-text">
                  Normal usage
                  <Play
                    width={12}
                    height={12}
                    className="text-text-muted transition-colors group-hover:text-accent-text"
                  />
                </div>
                <p className="mt-0.5 text-[11.5px] leading-snug text-text-secondary">
                  10 readings · 0.5–2.0 kWh · stays under the limit
                </p>
              </div>
            </button>

            <button
              onClick={() => void dispatch("high")}
              disabled={!selected || dispatching != null}
              className="group flex items-start gap-3 rounded-[var(--radius)] border border-border bg-surface-1 p-4 text-left transition-colors hover:border-critical/50 hover:bg-critical-soft/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius)] bg-critical-soft text-critical-text">
                <GraphUp width={15} height={15} />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[13px] font-semibold text-text">
                  High spike
                  <Play
                    width={12}
                    height={12}
                    className="text-text-muted transition-colors group-hover:text-critical-text"
                  />
                </div>
                <p className="mt-0.5 text-[11.5px] leading-snug text-text-secondary">
                  5 readings · 100–150 kWh · deterministic violation
                </p>
              </div>
            </button>
          </div>

          {(devices.loading || devices.refreshing) && (
            <div className="mt-3">
              <Skeleton className="h-9 w-full" />
            </div>
          )}
          {noDevices && (
            <p className="mt-3 text-[12px] text-text-muted">
              No devices available — register one on the Devices page first.
            </p>
          )}

          <div className="mt-5 border-t border-border pt-4">
            <div className="text-[12.5px] text-text-secondary">
              Current effective limit{" "}
              <span className="font-semibold tabular text-text">
                {kwh(user.energyAlertingThreshold, 2)} kWh
              </span>{" "}
              · alerting {user.alerting ? "armed" : "muted"}
            </div>
          </div>
        </Card>
      </div>

      {/* Pipeline activity */}
      <Card className="mt-5 p-0">
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2">
            <h2 className="type-section text-text">Pipeline activity</h2>
            <span className="font-mono text-[10.5px] text-text-muted">kafka → usage service</span>
          </div>
          <span className="text-[11px] text-text-muted">
            {log.length} dispatch{log.length === 1 ? "" : "es"}
          </span>
        </div>
        {log.length === 0 ? (
          <p className="px-5 py-8 text-center text-[12px] text-text-muted">
            No dispatches this session. Pick a device and push readings.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {log.map((entry) => {
              const meta = deviceMeta(
                (devices.data ?? []).find((d) => d.deviceId === entry.deviceId)?.type ?? "LIGHT",
              );
              const Icon = meta.icon;
              return (
                <li key={entry.id} className="flex items-center gap-3 px-5 py-2.5">
                  <span
                    className={clsx(
                      "h-2 w-2 shrink-0 rounded-full",
                      entry.ok ? "bg-success" : "bg-critical",
                    )}
                  />
                  <span
                    className={clsx(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border",
                      meta.tint,
                    )}
                  >
                    <Icon width={12} height={12} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[12.5px] font-medium text-text">
                        #{entry.deviceId} {entry.deviceName}
                      </span>
                      <Badge tone={entry.mode === "high" ? "critical" : "accent"}>
                        {entry.mode}
                      </Badge>
                    </div>
                    <div className="truncate font-mono text-[10.5px] text-text-muted">
                      {entry.detail}
                    </div>
                  </div>
                  <span className="shrink-0 font-mono text-[10.5px] text-text-muted">
                    {new Date(entry.at).toLocaleTimeString("en-US", { hour12: false })}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {alertToast && (
        <AlertToast
          alert={alertToast}
          onView={() => {
            setAlertPreview(alertToast);
            setAlertToast(null);
          }}
          onClose={() => setAlertToast(null)}
        />
      )}
      {alertPreview && (
        <AlertEmailPreview alert={alertPreview} onClose={() => setAlertPreview(null)} />
      )}
    </>
  );
}

function SimulationSkeleton() {
  return (
    <>
      <div className="mb-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <Skeleton className="h-96 lg:col-span-5" />
        <Skeleton className="h-96 lg:col-span-7" />
      </div>
      <Skeleton className="mt-5 h-40 w-full" />
    </>
  );
}
