"use client";

import { useState } from "react";
import { Bell, Calendar, Cpu, GraphUp, MagicWand, NavArrowRight, User } from "iconoir-react";
import { clsx } from "clsx";
import { AlertBanner, Button } from "@/components/ui";
import { useSession } from "@/components/session";
import { BrandMark } from "@/components/brand-mark";
import { getAlerts, getCoverage, getDevicesByUser, getUsage } from "@/lib/api";
import { deviceMeta } from "@/lib/device-meta";
import { kwh } from "@/lib/format";
import type { DeviceDto, UserDto } from "@/lib/types";

interface CreatedSummary {
  demo: UserDto;
  devices: DeviceDto[];
  totalKwh: number;
  daysWithData: number;
  maxDays: number;
  alertCount: number;
  violations: number;
}

/**
 * First-run gate. The visitor starts a ready-made demo home in one click; we
 * then show exactly what was created (account, devices, history, limit and
 * alerts) before opening the app. Rendered full-screen by SessionGate while
 * the session status is "missing".
 */
export function Onboarding() {
  const { initialize, enter } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<CreatedSummary | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const demo = await initialize({ mode: "generate" });
      const [devices, usage, coverage, alerts] = await Promise.all([
        getDevicesByUser(demo.userId),
        getUsage(demo.userId, 7),
        getCoverage(demo.userId),
        getAlerts(demo.userId, 50),
      ]);
      setSummary({
        demo,
        devices,
        totalKwh: usage.devices.reduce((s, d) => s + d.energyConsumed, 0),
        daysWithData: coverage.daysWithData,
        maxDays: coverage.maxDays,
        alertCount: alerts.length,
        violations: alerts.filter((a) => a.energyConsumed > a.threshold).length,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the demo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-1 p-4">
      <div className="w-full max-w-xl">
        <div className="mb-5 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-[var(--radius)] border border-accent/30 bg-accent-soft text-accent-text">
            <BrandMark size={18} />
          </span>
          <div className="leading-tight">
            <div className="text-[15px] font-semibold tracking-tight text-text">EnergyTracker</div>
            <div className="text-[10.5px] font-medium text-text-muted">Playground</div>
          </div>
        </div>

        <div className="panel p-6 sm:p-7">
          {summary ? (
            <CreatedView summary={summary} onEnter={() => enter(summary.demo)} />
          ) : (
            <>
              <div className="overline mb-3">First run · Setup</div>
              <h1 className="text-xl font-semibold tracking-tight text-text">
                Welcome — let&apos;s set up your energy tracker
              </h1>
              <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-text-secondary">
                This is a self-contained demo: readings, alerts and AI tips are
                simulated in the browser, so there is nothing to install. Create
                a fresh account, then add your own devices and readings.
              </p>

              <button
                type="button"
                onClick={() => void generate()}
                disabled={busy}
                className={clsx(
                  "mt-6 flex w-full items-center gap-4 rounded-[var(--radius-lg)] border border-border bg-surface-0 p-5 text-left transition-colors",
                  "hover:border-accent/40 hover:bg-accent-soft/30 disabled:cursor-not-allowed disabled:opacity-60",
                )}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius)] border border-accent/25 bg-accent-soft text-accent-text">
                  <MagicWand width={20} height={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold text-text">
                    {busy ? "Creating your demo account…" : "Create a demo account"}
                  </span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-text-secondary">
                    A fresh account with a 500 kWh alert limit. Nothing is
                    pre-filled — you add the devices and dispatch the readings.
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5 text-[12px] font-medium text-accent-text">
                  {busy ? "Working…" : "Start"}
                  <NavArrowRight width={14} height={14} />
                </span>
              </button>

              {error && (
                <div className="mt-4">
                  <AlertBanner
                    title="Could not start"
                    description={error}
                    onDismiss={() => setError(null)}
                  />
                </div>
              )}
            </>
          )}
        </div>

        <p className="mt-4 text-center text-[11px] text-text-muted">
          No account, no database, no email — a self-contained simulation.
        </p>
      </div>
    </div>
  );
}

function CreatedView({ summary, onEnter }: { summary: CreatedSummary; onEnter: () => void }) {
  const { demo, devices, totalKwh, daysWithData, maxDays, alertCount, violations } = summary;

  return (
    <>
      <div className="overline mb-3">Demo account ready</div>
      <h1 className="text-xl font-semibold tracking-tight text-text">Your demo account is ready</h1>
      <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">
        We created a demo account for{" "}
        <span className="font-medium text-text">{demo.name || "Demo User"}</span>. It starts empty —
        nothing is connected to real hardware, so you build the home from here.
      </p>

      <div className="panel mt-5 divide-y divide-border p-0">
        <SummaryRow
          icon={User}
          label="Account"
          value={demo.name || "Demo User"}
          text
          hint={demo.email || "demo@energytracker.dev"}
        />
        <SummaryRow
          icon={GraphUp}
          label="Alert threshold"
          value={kwh(demo.energyAlertingThreshold ?? 0, 0)}
          unit="kWh"
          hint={demo.alerting ? "Alerting armed" : "Alerting muted"}
        />
        <SummaryRow
          icon={Cpu}
          label="Devices"
          value={String(devices.length)}
          hint={devices.length ? "Ready to report telemetry" : "Add them on the Devices page"}
        />
        {daysWithData > 0 && (
          <SummaryRow
            icon={Calendar}
            label="Simulated history"
            value={`${daysWithData}/${maxDays}`}
            unit="days"
            hint={`${kwh(totalKwh)} kWh of readings`}
          />
        )}
        <SummaryRow
          icon={Bell}
          label="Alerts"
          value={String(alertCount)}
          hint={
            alertCount
              ? `${violations} threshold ${violations === 1 ? "violation" : "violations"}`
              : "Raised when load crosses the limit"
          }
        />
      </div>

      {devices.length === 0 && (
        <div className="mt-5">
          <div className="overline mb-2">Next steps</div>
          <ol className="flex flex-col gap-1.5 text-[12.5px] leading-relaxed text-text-secondary">
            <li>1. Register a device on the Devices page.</li>
            <li>2. Dispatch synthetic readings from Simulation to build history.</li>
            <li>3. Generate saving tips on Insights once telemetry exists.</li>
          </ol>
        </div>
      )}

      {devices.length > 0 && (
        <div className="mt-5">
          <div className="overline mb-2">Devices created</div>
          <ul className="flex flex-col gap-2">
            {devices.map((d) => {
              const meta = deviceMeta(d.type);
              const Icon = meta.icon;
              return (
                <li key={d.deviceId} className="flex items-center gap-3">
                  <span
                    className={clsx(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius)] border",
                      meta.tint,
                    )}
                  >
                    <Icon width={14} height={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-text">{d.name}</div>
                    <div className="text-[11.5px] text-text-muted">
                      {meta.label} · {d.location}
                    </div>
                  </div>
                  <span className="shrink-0 font-mono text-[10.5px] text-text-muted">
                    DEV-{String(d.deviceId).padStart(3, "0")}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="mt-6 flex items-center justify-end">
        <Button variant="primary" onClick={onEnter}>
          Enter dashboard
          <NavArrowRight width={14} height={14} />
        </Button>
      </div>
    </>
  );
}

function SummaryRow({
  icon: Icon,
  label,
  value,
  unit,
  hint,
  text = false,
}: {
  icon: React.ComponentType<{ width?: number; height?: number }>;
  label: string;
  value: string;
  unit?: string;
  hint: string;
  text?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-surface-2 text-text-secondary">
        <Icon width={15} height={15} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[11.5px] text-text-secondary">{label}</div>
        <div className="mt-0.5 flex items-baseline gap-1.5">
          <span
            className={clsx(
              "font-semibold leading-none text-text",
              text ? "text-[14px]" : "text-[20px] tabular tracking-tight",
            )}
          >
            {value}
          </span>
          {unit && <span className="text-[11px] text-text-muted">{unit}</span>}
        </div>
        <div className="mt-0.5 text-[11px] text-text-muted">{hint}</div>
      </div>
    </div>
  );
}
