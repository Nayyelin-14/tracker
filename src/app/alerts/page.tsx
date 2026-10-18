"use client";

import { useMemo, useState } from "react";
import {
  BellOff,
  CheckCircle,
  Mail,
  Refresh,
  WarningTriangle as TriangleAlert,
  WifiOff,
} from "iconoir-react";
import { clsx } from "clsx";
import { PageHeader } from "@/components/page-header";
import { useSession } from "@/components/session";
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  EmptyState,
  SegmentedControl,
  Skeleton,
} from "@/components/ui";
import { getAlerts } from "@/lib/api";
import { useAsync } from "@/lib/use-async";
import { compactDateTime, kwh, relativeTime } from "@/lib/format";
import type { AlertDto } from "@/lib/types";

type Filter = "all" | "violations" | "unsent";

export default function AlertsPage() {
  const { user, status, error, refresh } = useSession();
  const userId = user?.userId;
  const [filter, setFilter] = useState<Filter>("all");
  const alerts = useAsync<AlertDto[]>(() => getAlerts(userId!), [userId], {
    enabled: userId != null,
  });

  const filtered = useMemo(() => {
    const list = alerts.data ?? [];
    const sorted = [...list].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    if (filter === "violations") return sorted.filter((a) => a.energyConsumed > a.threshold);
    if (filter === "unsent") return sorted.filter((a) => !a.sent);
    return sorted;
  }, [alerts.data, filter]);

  if (status === "loading") return <AlertsSkeleton />;

  if (status !== "ready" || !user) {
    return (
      <>
        <PageHeader title="Alerts" description="Threshold violation ledger" />
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

  const total = alerts.data?.length ?? 0;
  const violationCount = (alerts.data ?? []).filter((a) => a.energyConsumed > a.threshold).length;
  const unsentCount = (alerts.data ?? []).filter((a) => !a.sent).length;

  return (
    <>
      <PageHeader
        title="Alerts"
        description="Review home threshold violations and system notifications."
        actions={
          <Button size="sm" onClick={alerts.reload} disabled={alerts.refreshing}>
            <Refresh
              width={13}
              height={13}
              className={alerts.refreshing ? "animate-spin" : undefined}
            />
            {alerts.refreshing ? "Refreshing…" : "Refresh"}
          </Button>
        }
      />

      {/* Severity summary — one panel, three readouts divided by hairlines */}
      <Card className="mb-5 grid grid-cols-1 divide-y divide-border p-0 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <SummaryCell
          icon={TriangleAlert}
          tone="critical"
          label="Threshold breaches"
          value={violationCount}
          hint="Load crossed your limit"
        />
        <SummaryCell
          icon={Mail}
          tone={unsentCount > 0 ? "warning" : "neutral"}
          label="Emails pending"
          value={unsentCount}
          hint={unsentCount > 0 ? "Awaiting delivery" : "All notifications delivered"}
        />
        <SummaryCell
          icon={CheckCircle}
          tone="neutral"
          label="Total events"
          value={total}
          hint="Across the full ledger"
        />
      </Card>

      {alerts.error && (
        <div className="mb-4">
          <AlertBanner
            title="Alert service unreachable"
            description={`GET /alert/user/${user.userId} failed (${alerts.error.status}). The ledger may be stale.`}
            action={
              <Button size="sm" onClick={alerts.reload}>
                Retry
              </Button>
            }
          />
        </div>
      )}

      <Card className="p-0">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="type-section text-text">Incident history</h2>
            <p className="mt-0.5 text-[12px] text-text-secondary">
              Every threshold evaluation, newest first.
            </p>
          </div>
          <SegmentedControl
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: `All ${total}` },
              { value: "violations", label: `Violations ${violationCount}` },
              { value: "unsent", label: `Unsent ${unsentCount}` },
            ]}
          />
        </div>

        {alerts.loading || alerts.refreshing ? (
          <div className="p-4">
            <div className="flex flex-col gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<BellOff width={22} height={22} />}
            title={filter === "all" ? "No alerts recorded" : "Nothing matches this filter"}
            description={
              filter === "all"
                ? "The alerting service emits an event whenever aggregate load crosses your threshold. Dispatch a high-spike simulation to see one land here."
                : "Switch filters or dispatch new telemetry to generate events."
            }
            className="border-0 shadow-none"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="border-b border-border bg-surface-1">
                  {["Time", "Event", "Measured", "Threshold", "Email"].map((h, i) => (
                    <th
                      key={h}
                      className={clsx(
                        "px-4 py-2.5 text-[12px] font-medium text-text-muted",
                        (i === 2 || i === 3) && "text-right",
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <AlertRow key={a.id} alert={a} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

function SummaryCell({
  icon: Icon,
  tone,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ width?: number; height?: number }>;
  tone: "critical" | "warning" | "neutral";
  label: string;
  value: number;
  hint: string;
}) {
  const iconClass = {
    critical: "bg-critical-soft text-critical-text",
    warning: "bg-warning-soft text-warning-text",
    neutral: "bg-surface-2 text-text-secondary",
  }[tone];
  const valueClass =
    tone === "critical" && value > 0 ? "text-critical-text" : "text-text";

  return (
    <div className="flex items-start gap-3.5 px-5 py-4">
      <span
        className={clsx(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius)]",
          iconClass,
        )}
      >
        <Icon width={17} height={17} />
      </span>
      <div className="min-w-0">
        <div
          className={clsx(
            "text-[24px] font-semibold leading-none tabular tracking-tight",
            valueClass,
          )}
        >
          {value}
        </div>
        <div className="mt-1.5 text-[12.5px] font-medium text-text">{label}</div>
        <div className="text-[11px] text-text-muted">{hint}</div>
      </div>
    </div>
  );
}

function AlertRow({ alert }: { alert: AlertDto }) {
  const over = alert.energyConsumed > alert.threshold;
  return (
    <tr className="border-b border-border last:border-b-0 hover:bg-surface-1">
      <td className="px-4 py-3">
        <div className="font-mono text-[12px] text-text-secondary">
          {compactDateTime(alert.createdAt)}
        </div>
        <div className="text-[10.5px] text-text-muted">{relativeTime(alert.createdAt)}</div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className={clsx(
              "h-1.5 w-1.5 shrink-0 rounded-full",
              over ? "bg-critical" : "bg-warning",
            )}
          />
          <span
            className={clsx(
              "text-[12.5px] font-semibold",
              over ? "text-critical-text" : "text-warning-text",
            )}
          >
            {over ? "Threshold violation" : "Threshold event"}
          </span>
        </div>
        <div className="mt-0.5 max-w-[360px] truncate text-[11.5px] text-text-muted">
          {alert.message}
        </div>
      </td>
      <td className="px-4 py-3 text-right text-[12.5px] font-semibold tabular">
        <span className={over ? "text-critical-text" : "text-text"}>
          {kwh(alert.energyConsumed, 2)}
        </span>
        <span className="ml-1 font-normal text-text-muted">kWh</span>
      </td>
      <td className="px-4 py-3 text-right text-[12.5px] tabular text-text-secondary">
        {kwh(alert.threshold, 2)}
        <span className="ml-1 font-normal text-text-muted">kWh</span>
      </td>
      <td className="px-4 py-3">
        <Badge tone={alert.sent ? "success" : "neutral"} dot={alert.sent}>
          {alert.sent ? "Sent" : "Unsent"}
        </Badge>
      </td>
    </tr>
  );
}

function AlertsSkeleton() {
  return (
    <>
      <div className="mb-6">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="mt-2 h-4 w-60" />
      </div>
      <Skeleton className="mb-5 h-[86px] w-full" />
      <Skeleton className="h-80 w-full" />
    </>
  );
}
