"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Calendar, Database, Refresh, WarningTriangle, WifiOff } from "iconoir-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
} from "recharts";
import { useSession } from "@/components/session";
import { PageHeader } from "@/components/page-header";
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  EmptyState,
  SegmentedControl,
  Skeleton,
  Switch,
} from "@/components/ui";
import { UsageChart, seriesToChart, hasGaps } from "@/components/dashboard/usage-chart";
import {
  getAlerts,
  getCoverage,
  getDevicesByUser,
  getUsage,
  getUsageSeries,
  updateUser,
} from "@/lib/api";
import { useAsync } from "@/lib/use-async";
import { deviceMeta } from "@/lib/device-meta";
import { compactDateTime, isWithinLastDays, kwh, percent, relativeTime } from "@/lib/format";
import type { AlertDto } from "@/lib/types";

export default function OverviewPage() {
  const { user, status, error, refresh, patchUser } = useSession();
  const [interval, setInterval] = useState<"hour" | "day">("hour");
  const userId = user?.userId;

  const devices = useAsync(() => getDevicesByUser(userId!), [userId], {
    enabled: userId != null,
  });
  const usage = useAsync(() => getUsage(userId!, 7), [userId], { enabled: userId != null });
  const series = useAsync(() => getUsageSeries(userId!, 7, interval), [userId, interval], {
    enabled: userId != null,
  });
  const coverage = useAsync(() => getCoverage(userId!), [userId], { enabled: userId != null });
  const alerts = useAsync(() => getAlerts(userId!, 50), [userId], { enabled: userId != null });

  if (status === "loading") return <DashboardSkeleton />;

  if (status === "offline") {
    return (
      <>
        <PageHeader title="Overview" description="House-wide consumption at a glance" />
        <EmptyState
          icon={<WifiOff width={22} height={22} />}
          title="Demo backend unreachable"
          description={
            error ??
            "The request to the Next.js API layer failed. Retry in a moment."
          }
          actions={
            <Button variant="primary" onClick={() => void refresh()}>
              Retry connection
            </Button>
          }
        />
      </>
    );
  }

  if (status === "missing" || !user) {
    return (
      <>
        <PageHeader title="Overview" description="House-wide consumption at a glance" />
        <EmptyState
          icon={<Database width={22} height={22} />}
          title="Demo session not initialized"
          description={
            error ??
            "GET /api/v1/user/demo returned 404. Seed the user-service database or provision a demo user to continue."
          }
          actions={
            <Button variant="primary" onClick={() => void refresh()}>
              Re-check session
            </Button>
          }
        />
      </>
    );
  }

  const chartData = series.data ? seriesToChart(series.data) : [];
  const sparkValues = chartData.filter((p) => p.total !== null).map((p) => p.total as number);
  const totalKwh = (usage.data?.devices ?? []).reduce((s, d) => s + d.energyConsumed, 0);
  const avgPerDay = totalKwh / 7;
  const threshold = user.energyAlertingThreshold ?? 0;
  const recentAlerts = alerts.data ?? [];
  const violations7d = recentAlerts.filter((a) => isWithinLastDays(a.createdAt, 7)).length;
  const deviceList = [...(usage.data?.devices ?? [])].sort(
    (a, b) => b.energyConsumed - a.energyConsumed,
  );
  const maxEnergy = deviceList[0]?.energyConsumed || 1;
  const registryCount = devices.data?.length ?? 0;
  const cov = coverage.data;
  const failedPanels = [
    usage.error && "usage",
    series.error && "telemetry",
    alerts.error && "alerts",
    devices.error && "devices",
    coverage.error && "coverage",
  ].filter(Boolean) as string[];

  const reloadAll = () => {
    void devices.reload();
    void usage.reload();
    void series.reload();
    void alerts.reload();
    void coverage.reload();
  };

  /** Any panel still revalidating after a manual refresh. */
  const refreshing =
    devices.refreshing || usage.refreshing || series.refreshing || alerts.refreshing || coverage.refreshing;

  async function toggleAlerting(next: boolean) {
    try {
      const updated = await updateUser(userId!, { alerting: next });
      patchUser(updated);
    } catch {
      // keep prior state; the badge/toggle simply reflects the last known value
    }
  }

  return (
    <>
      <PageHeader
        overline="Overview"
        title="Energy consumption"
        description="Track your energy usage, monitor thresholds, and keep your home running efficiently."
        actions={
          <>
            <span className="inline-flex items-center gap-2 rounded-[10px] border border-border bg-surface-0 px-3 py-1.5 text-[12px] font-medium text-text-secondary">
              <Calendar width={13} height={13} className="text-text-muted" />
              Last 7 days
            </span>
            <Button size="sm" onClick={reloadAll} disabled={refreshing}>
              <Refresh width={13} height={13} className={refreshing ? "animate-spin" : undefined} />
              {refreshing ? "Refreshing…" : "Refresh"}
            </Button>
          </>
        }
      />

      {failedPanels.length > 0 && (
        <div className="mb-4">
          <AlertBanner
            tone="warning"
            title={`Partial data — ${failedPanels.length} panel${failedPanels.length > 1 ? "s" : ""} failed to load`}
            description={`Failed: ${failedPanels.join(", ")}. Other values are live.`}
            action={
              <Button size="sm" onClick={reloadAll}>
                Retry all
              </Button>
            }
          />
        </div>
      )}

      {/* KPI row */}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total consumption"
          value={usage.loading || usage.refreshing ? null : kwh(totalKwh)}
          unit="kWh"
          sub={
            usage.error
              ? usage.error.status === 0
                ? "Usage service unreachable"
                : `Error ${usage.error.status}`
              : `Across ${deviceList.length} device${deviceList.length === 1 ? "" : "s"} · 7d`
          }
          subTone={usage.error ? "critical" : undefined}
          onRetry={usage.error ? () => void usage.reload() : undefined}
          spark={sparkValues}
        />
        <KpiCard
          label="Monitored devices"
          value={devices.loading || devices.refreshing ? null : String(registryCount)}
          unit=""
          sub={
            devices.error
              ? "Registry unreachable"
              : registryCount === 0
                ? "No hardware registered"
                : "active devices"
          }
          subTone={devices.error ? "critical" : undefined}
          onRetry={devices.error ? () => void devices.reload() : undefined}
        />
        <KpiCard
          label="Threshold status"
          value={user.alerting ? "Armed" : "Muted"}
          unit=""
          valueText
          sub="System-wide monitoring"
          right={
            <Switch
              checked={user.alerting}
              onChange={(v) => void toggleAlerting(v)}
              disabled={Boolean(usage.loading) || usage.refreshing}
              label="Toggle threshold alerting"
            />
          }
        />
        <KpiCard
          label="Avg. per day"
          value={usage.loading || usage.refreshing ? null : kwh(avgPerDay)}
          unit="kWh"
          sub="Mean over the 7-day window"
        />
      </div>

      {/* Chart + right column */}
      <div className="mb-5 grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
        {/* Consumption trend */}
        <Card className="lg:col-span-8">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="type-section tracking-tight text-text">Consumption trend</h2>
              <p className="mt-1 text-[12px] text-text-secondary">
                Total energy consumption (all devices) · real values, not interpolated
              </p>
            </div>
            <SegmentedControl
              value={interval}
              onChange={setInterval}
              options={[
                { value: "hour", label: "Hourly" },
                { value: "day", label: "Daily" },
              ]}
            />
          </div>

          {series.loading || series.refreshing ? (
            <Skeleton className="h-80 w-full" />
          ) : series.error ? (
            <InlineFetchError
              message={
                series.error.status === 0
                  ? "Usage service unreachable — cannot load telemetry."
                  : `Telemetry request failed (${series.error.status}).`
              }
              onRetry={() => void series.reload()}
            />
          ) : chartData.length === 0 ? (
            <EmptyState
              title={registryCount === 0 ? "No devices registered" : "No telemetry yet"}
              description={
                registryCount === 0
                  ? "Register a device, then dispatch readings from the Simulation page to populate this chart."
                  : "Devices are registered but no readings exist for this interval yet. Dispatch synthetic readings to populate it."
              }
              actions={
                <>
                  {registryCount === 0 && (
                    <Link href="/devices">
                      <Button size="sm">Manage devices</Button>
                    </Link>
                  )}
                  <Link href="/simulation">
                    <Button variant="primary" size="sm">
                      Open simulation
                    </Button>
                  </Link>
                </>
              }
              className="border-0"
            />
          ) : (
            <>
              <UsageChart data={chartData} threshold={threshold} />
              {hasGaps(chartData) && (
                <p className="mt-2 text-[11px] text-text-muted">
                  Gaps mark time buckets with no readings (not zero consumption).
                </p>
              )}
            </>
          )}

          <div className="mt-4 flex flex-col gap-2 rounded-[var(--radius)] border border-border bg-surface-1 px-3.5 py-3 text-[11px] text-text-secondary sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-2">
              <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden>
                <line x1="0" y1="6" x2="18" y2="6" stroke="var(--critical)" strokeWidth="1.5" strokeDasharray="4 3" />
              </svg>
              Threshold {kwh(threshold, 2)} kWh/bucket — buckets above the line raise a violation.
            </span>
            {cov && (
              <span
                className={`font-mono text-[10px] text-text-muted transition-opacity ${
                  coverage.refreshing ? "opacity-40" : ""
                }`}
              >
                Coverage {cov.daysWithData}/{cov.maxDays} days
                {cov.devicesWithNoData.length > 0 && ` · ${cov.devicesWithNoData.length} silent`}
              </span>
            )}
          </div>
        </Card>

        {/* Right column */}
        <div className="flex flex-col gap-5 lg:col-span-4">
          {/* Energy by device */}
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="type-section tracking-tight text-text">Energy by device</h2>
              <Link
                href="/devices"
                className="text-[12px] font-medium text-accent-text hover:text-accent"
              >
                View all
              </Link>
            </div>
            {usage.loading || usage.refreshing ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : usage.error ? (
              <InlineFetchError
                message={usage.error.status === 0 ? "Usage service unreachable." : `Error ${usage.error.status}.`}
                onRetry={() => void usage.reload()}
              />
            ) : deviceList.length === 0 ? (
              <p className="py-6 text-center text-[12px] text-text-muted">No device usage yet.</p>
            ) : (
              <ul className="flex flex-col gap-3.5">
                {deviceList.slice(0, 4).map((d) => {
                  const meta = deviceMeta(d.type);
                  const Icon = meta.icon;
                  const share = totalKwh > 0 ? (d.energyConsumed / totalKwh) * 100 : 0;
                  return (
                    <li key={`${d.deviceId ?? d.name}-${d.name}`}>
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${meta.tint}`}
                        >
                          <Icon width={15} height={15} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-[13px] font-medium text-text">
                              {d.name}
                            </span>
                            <span className="shrink-0 font-mono text-[12px] font-semibold tabular text-text">
                              {kwh(d.energyConsumed)}{" "}
                              <span className="font-normal text-text-muted">kWh</span>
                            </span>
                          </div>
                          <div className="mt-1.5 flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                              <div
                                className="h-full rounded-full bg-accent"
                                style={{ width: `${Math.max(3, (d.energyConsumed / maxEnergy) * 100)}%` }}
                              />
                            </div>
                            <span className="shrink-0 font-mono text-[10px] tabular text-text-muted">
                              {percent(share)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* Threshold & alerts */}
          <Card>
            <div className="mb-3">
              <h2 className="type-section tracking-tight text-text">Threshold &amp; alerts</h2>
            </div>
            <div className="text-[11px] text-text-muted">Current limit</div>
            <div className="mt-1 font-mono text-[24px] font-semibold tabular tracking-tight text-text">
              {kwh(threshold, 1)}{" "}
              <span className="text-[12px] font-normal text-text-muted">kWh / bucket</span>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-border pt-3.5">
              <div>
                <div className="text-[12px] font-medium text-text">Edge-triggered alerting</div>
                <div className="text-[11px] text-text-muted">
                  {user.alerting ? "Enabled" : "Disabled"} · fires once per crossing
                </div>
              </div>
              <Switch
                checked={user.alerting}
                onChange={(v) => void toggleAlerting(v)}
                label="Toggle edge-triggered alerting"
              />
            </div>
          </Card>
        </div>
      </div>

      {/* Recent devices + incidents */}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
        {/* Recent devices table */}
        <Card className="lg:col-span-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="type-section tracking-tight text-text">Recent devices</h2>
            <Link
              href="/devices"
              className="text-[12px] font-medium text-accent-text hover:text-accent"
            >
              View all
            </Link>
          </div>
          {usage.loading || usage.refreshing ? (
            <Skeleton className="h-40 w-full" />
          ) : usage.error ? (
            <InlineFetchError
              message={usage.error.status === 0 ? "Usage service unreachable." : `Error ${usage.error.status}.`}
              onRetry={() => void usage.reload()}
            />
          ) : deviceList.length === 0 ? (
            <EmptyState
              title="No devices yet"
              description="Devices you register will appear here with their 7-day usage."
              actions={
                <Link href="/devices">
                  <Button size="sm">Manage devices</Button>
                </Link>
              }
              className="border-0 py-8"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-border">
                    {["Device", "Type", "Location", "7D usage", "Share"].map((h, i) => (
                      <th
                        key={h}
                        className={`overline pb-2 ${i >= 3 ? "text-right" : ""}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {deviceList.map((d) => {
                    const meta = deviceMeta(d.type);
                    const Icon = meta.icon;
                    const share = totalKwh > 0 ? (d.energyConsumed / totalKwh) * 100 : 0;
                    return (
                      <tr
                        key={`${d.deviceId ?? d.name}-${d.name}`}
                        className="border-b border-border last:border-b-0"
                      >
                        <td className="py-2.5">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${meta.tint}`}
                            >
                              <Icon width={13} height={13} />
                            </span>
                            <span className="text-[13px] font-medium text-text">{d.name}</span>
                          </div>
                        </td>
                        <td className="py-2.5 text-[12px] text-text-secondary">{meta.label}</td>
                        <td className="py-2.5 text-[12px] text-text-secondary">{d.location}</td>
                        <td className="py-2.5 text-right font-mono text-[12px] font-semibold tabular text-text">
                          {kwh(d.energyConsumed)} <span className="font-normal text-text-muted">kWh</span>
                        </td>
                        <td className="py-2.5 text-right font-mono text-[12px] tabular text-text-secondary">
                          {percent(share)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Recent incidents */}
        <Card className="lg:col-span-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="type-section tracking-tight text-text">Recent incidents</h2>
            <Link
              href="/alerts"
              className="text-[12px] font-medium text-accent-text hover:text-accent"
            >
              View all
            </Link>
          </div>
          {alerts.loading || alerts.refreshing ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : alerts.error ? (
            <InlineFetchError
              message={alerts.error.status === 0 ? "Alert service unreachable." : `Error ${alerts.error.status}.`}
              onRetry={() => void alerts.reload()}
            />
          ) : recentAlerts.length === 0 ? (
            <p className="py-8 text-center text-[12px] text-text-muted">
              No incidents recorded. Quiet grid.
            </p>
          ) : (
            <ul className="flex flex-col">
              {recentAlerts.slice(0, 4).map((a) => (
                <IncidentRow key={a.id} alert={a} />
              ))}
            </ul>
          )}
          {violations7d > 0 && (
            <div className="mt-3 border-t border-border pt-3 text-[11px] text-text-muted">
              {violations7d} violation{violations7d === 1 ? "" : "s"} in the last 7 days.
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

/* ---------- KPI card ---------- */

function KpiCard({
  label,
  value,
  unit,
  sub,
  subTone,
  onRetry,
  spark,
  valueText = false,
  right,
}: {
  label: string;
  value: string | null;
  unit: string;
  sub: string;
  subTone?: "critical";
  onRetry?: () => void;
  spark?: number[];
  valueText?: boolean;
  right?: ReactNode;
}) {
  return (
    <Card className="flex flex-col">
      <span className="text-[12px] font-medium text-text-muted">{label}</span>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div className="flex items-baseline gap-1.5">
          {value === null ? (
            <Skeleton className="h-8 w-20" />
          ) : (
            <span
              className={`tabular font-mono font-semibold leading-none tracking-tight text-text ${
                valueText ? "text-[22px]" : "type-kpi"
              }`}
            >
              {value}
            </span>
          )}
          {unit && <span className="text-[12px] text-text-muted">{unit}</span>}
        </div>
        {spark && spark.length > 1 && <Sparkline data={spark} />}
        {right}
      </div>
      <p
        className={`mt-2 text-[11px] ${subTone === "critical" ? "text-critical-text" : "text-text-muted"}`}
      >
        {sub}
        {onRetry && (
          <>
            {" · "}
            <button onClick={onRetry} className="underline hover:no-underline">
              retry
            </button>
          </>
        )}
      </p>
    </Card>
  );
}

function Sparkline({ data }: { data: number[] }) {
  const points = data.map((v, i) => ({ i, v }));
  return (
    <div className="h-9 w-24 shrink-0" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <Area
            type="monotone"
            dataKey="v"
            stroke="var(--accent)"
            strokeWidth={2}
            fill="var(--accent-soft)"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------- incident row ---------- */

function IncidentRow({ alert }: { alert: AlertDto }) {
  const over = alert.energyConsumed > alert.threshold;
  return (
    <li className="flex items-start gap-3 border-b border-border py-3 last:border-b-0">
      <span
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
          over ? "bg-critical-soft text-critical-text" : "bg-warning-soft text-warning-text"
        }`}
      >
        <WarningTriangle width={14} height={14} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[13px] font-semibold text-text">
            {over ? "Threshold violation" : "Threshold notice"}
          </span>
          <Badge tone={over ? "critical" : "warning"}>{over ? "High" : "Warning"}</Badge>
        </div>
        <p className="mt-0.5 text-[12px] text-text-secondary">
          Load <strong className="font-mono text-critical-text">{kwh(alert.energyConsumed, 2)} kWh</strong>{" "}
          &gt; {kwh(alert.threshold, 2)} kWh limit
        </p>
        <div className="mt-0.5 font-mono text-[10px] text-text-muted">
          {compactDateTime(alert.createdAt)} · {relativeTime(alert.createdAt)} ·{" "}
          {alert.sent ? "email sent" : "not sent"}
        </div>
      </div>
    </li>
  );
}

/* ---------- shared ---------- */

function InlineFetchError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-[var(--radius)] border border-border bg-surface-1 px-6 py-8 text-center">
      <WifiOff width={18} height={18} className="text-critical-text" />
      <p className="text-[12px] text-text-secondary">{message}</p>
      <Button size="sm" onClick={onRetry}>
        <Refresh width={12} height={12} /> Retry
      </Button>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <div className="mb-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-2 h-4 w-80" />
      </div>
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
        <Skeleton className="h-96 lg:col-span-8" />
        <div className="flex flex-col gap-5 lg:col-span-4">
          <Skeleton className="h-56" />
          <Skeleton className="h-44" />
        </div>
      </div>
    </>
  );
}
