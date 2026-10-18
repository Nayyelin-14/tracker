"use client";

import Link from "next/link";
import { useState, type ComponentType, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
} from "recharts";
import {
  Bell,
  Calendar,
  Cpu,
  GraphUp,
  Refresh,
  WarningTriangle,
  WifiOff,
} from "iconoir-react";
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
          description={error ?? "The request to the Next.js API layer failed. Retry in a moment."}
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

  const refreshing =
    devices.refreshing ||
    usage.refreshing ||
    series.refreshing ||
    alerts.refreshing ||
    coverage.refreshing;

  async function toggleAlerting(next: boolean) {
    try {
      const updated = await updateUser(userId!, { alerting: next });
      patchUser(updated);
    } catch {
      // keep prior state; the toggle reflects the last known value
    }
  }

  const usageLoading = usage.loading || usage.refreshing;
  const seriesLoading = series.loading || series.refreshing;

  return (
    <>
      <PageHeader
        title="Overview"
        description="Monitor your home energy usage, device status and system health."
        actions={
          <>
            <span className="inline-flex items-center gap-1.5 rounded-[var(--radius)] border border-border bg-surface-0 px-2.5 py-1.5 text-[12px] font-medium text-text-secondary">
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
        <div className="mb-5">
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

      {/* Analytical lead: trend as the primary element, KPIs supporting it */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="type-section text-text">Energy consumption</h2>
              <p className="mt-0.5 text-[12px] text-text-secondary">
                Aggregate load across every monitored device
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

          {seriesLoading ? (
            <Skeleton className="h-72 w-full" />
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
              className="border-0 shadow-none"
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

          <div className="mt-4 flex flex-col gap-2 border-t border-border pt-3 text-[11px] text-text-secondary sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-2">
              <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden>
                <line
                  x1="0"
                  y1="6"
                  x2="18"
                  y2="6"
                  stroke="var(--warning)"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                />
              </svg>
              Limit {kwh(threshold, 2)} kWh/bucket — buckets above the line raise a violation.
            </span>
            {cov && (
              <span
                className={`text-[11px] text-text-muted transition-opacity ${
                  coverage.refreshing ? "opacity-40" : ""
                }`}
              >
                Coverage {cov.daysWithData}/{cov.maxDays} days
                {cov.devicesWithNoData.length > 0 &&
                  ` · ${cov.devicesWithNoData.length} silent`}
              </span>
            )}
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:col-span-4 xl:grid-cols-1">
          <KpiCard
            className="sm:col-span-2 xl:col-span-1"
            icon={GraphUp}
            label="Total consumption"
            value={usageLoading ? null : kwh(totalKwh)}
            unit="kWh"
            sub={
              usage.error
                ? usage.error.status === 0
                  ? "Usage service unreachable"
                  : `Error ${usage.error.status}`
                : `Across ${deviceList.length} device${deviceList.length === 1 ? "" : "s"} · 7 days`
            }
            subTone={usage.error ? "critical" : undefined}
            onRetry={usage.error ? () => void usage.reload() : undefined}
            spark={sparkValues}
          />

          <Card className="divide-y divide-border p-0 sm:col-span-2 xl:col-span-1">
            <Readout
              icon={Calendar}
              label="Daily average"
              value={usageLoading ? null : kwh(avgPerDay)}
              unit="kWh"
              sub="Mean over the window"
            />
            <Readout
              icon={Cpu}
              label="Monitored devices"
              value={devices.loading || devices.refreshing ? null : String(registryCount)}
              sub={
                devices.error
                  ? "Registry unreachable"
                  : registryCount === 0
                    ? "No hardware registered"
                    : "Active this week"
              }
              subTone={devices.error ? "critical" : undefined}
              onRetry={devices.error ? () => void devices.reload() : undefined}
            />
            <Readout
              icon={Bell}
              label="Threshold status"
              value={user.alerting ? "Armed" : "Muted"}
              valueText
              sub={
                registryCount > 0
                  ? `Fire limit ${kwh(threshold, 0)} kWh/bucket`
                  : "System-wide monitoring"
              }
              right={
                <Switch
                  checked={user.alerting}
                  onChange={(v) => void toggleAlerting(v)}
                  label="Toggle threshold alerting"
                />
              }
            />
          </Card>
        </div>
      </div>
      {/* Breakdown + incidents */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="type-section text-text">Energy by device</h2>
            <Link
              href="/devices"
              className="text-[12px] font-medium text-accent-text hover:text-accent"
            >
              View all
            </Link>
          </div>
          {usageLoading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : usage.error ? (
            <InlineFetchError
              message={
                usage.error.status === 0 ? "Usage service unreachable." : `Error ${usage.error.status}.`
              }
              onRetry={() => void usage.reload()}
            />
          ) : deviceList.length === 0 ? (
            <p className="py-6 text-center text-[12px] text-text-muted">No device usage yet.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {deviceList.slice(0, 5).map((d) => {
                const meta = deviceMeta(d.type);
                const Icon = meta.icon;
                const share = totalKwh > 0 ? (d.energyConsumed / totalKwh) * 100 : 0;
                return (
                  <li key={`${d.deviceId ?? d.name}-${d.name}`}>
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius)] border ${meta.tint}`}
                      >
                        <Icon width={15} height={15} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[13px] font-medium text-text">
                            {d.name}
                          </span>
                          <span className="shrink-0 text-[12.5px] font-semibold tabular text-text">
                            {kwh(d.energyConsumed)}{" "}
                            <span className="font-normal text-text-muted">kWh</span>
                          </span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                            <div
                              className="h-full rounded-full bg-accent"
                              style={{
                                width: `${Math.max(3, (d.energyConsumed / maxEnergy) * 100)}%`,
                              }}
                            />
                          </div>
                          <span className="shrink-0 text-[11px] tabular text-text-muted">
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

        <Card className="lg:col-span-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="type-section text-text">Recent incidents</h2>
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
              message={
                alerts.error.status === 0 ? "Alert service unreachable." : `Error ${alerts.error.status}.`
              }
              onRetry={() => void alerts.reload()}
            />
          ) : recentAlerts.length === 0 ? (
            <p className="py-8 text-center text-[12px] text-text-muted">
              No incidents recorded. Quiet grid.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
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
/* ---------- compact readout row (inside a shared panel) ---------- */

function Readout({
  icon: Icon,
  label,
  value,
  unit,
  sub,
  subTone,
  onRetry,
  valueText = false,
  right,
}: {
  icon: ComponentType<{ width?: number; height?: number; className?: string }>;
  label: string;
  value: string | null;
  unit?: string;
  sub: string;
  subTone?: "critical";
  onRetry?: () => void;
  valueText?: boolean;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-surface-2 text-text-secondary">
        <Icon width={14} height={14} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[11.5px] text-text-secondary">{label}</div>
        <div className="mt-1 flex items-baseline gap-1.5">
          {value === null ? (
            <Skeleton className="h-5 w-16" />
          ) : (
            <span
              className={`tabular font-semibold leading-none text-text ${
                valueText ? "text-[16px]" : "text-[20px] tracking-tight"
              }`}
            >
              {value}
            </span>
          )}
          {unit && <span className="text-[11px] text-text-muted">{unit}</span>}
        </div>
        <p
          className={`mt-1 text-[11px] ${
            subTone === "critical" ? "text-critical-text" : "text-text-muted"
          }`}
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
      </div>
      {right}
    </div>
  );
}


function KpiCard({
  icon: Icon,
  label,
  value,
  unit,
  sub,
  subTone,
  onRetry,
  spark,
  valueText = false,
  className,
  right,
}: {
  icon: ComponentType<{ width?: number; height?: number; className?: string }>;
  label: string;
  value: string | null;
  unit?: string;
  sub: string;
  subTone?: "critical";
  onRetry?: () => void;
  spark?: number[];
  valueText?: boolean;
  className?: string;
  right?: ReactNode;
}) {
  return (
    <Card className={className}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] bg-accent-soft text-accent-text">
            <Icon width={14} height={14} />
          </span>
          <span className="text-[12px] font-medium text-text-secondary">{label}</span>
        </div>
        {right}
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="flex items-baseline gap-1.5">
          {value === null ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <span
              className={`tabular font-semibold leading-none tracking-tight text-text ${
                valueText ? "text-[22px]" : "text-[28px]"
              }`}
            >
              {value}
            </span>
          )}
          {unit && <span className="text-[12px] text-text-muted">{unit}</span>}
        </div>
        {spark && spark.length > 1 && <Sparkline data={spark} />}
      </div>

      <p
        className={`mt-3 text-[11px] ${
          subTone === "critical" ? "text-critical-text" : "text-text-muted"
        }`}
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
            strokeWidth={1.5}
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
    <li className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <span
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] ${
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
          Load{" "}
          <strong className={over ? "text-critical-text" : "text-text"}>
            {kwh(alert.energyConsumed, 2)} kWh
          </strong>{" "}
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
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Skeleton className="h-96 xl:col-span-8" />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:col-span-4 xl:grid-cols-1">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    </>
  );
}
