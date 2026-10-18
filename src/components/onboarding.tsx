"use client";

import { useState } from "react";
import {
  Check,
  MagicWand,
  NavArrowLeft,
  Plus,
  Trash,
  User,
} from "iconoir-react";
import { clsx } from "clsx";
import { AlertBanner, Button, Input, Select, Switch } from "@/components/ui";
import { useSession } from "@/components/session";
import { BrandMark } from "@/components/brand-mark";
import { DEVICE_TYPES, type DeviceType } from "@/lib/types";

interface DeviceRow {
  name: string;
  type: DeviceType;
  location: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * First-run gate. Nothing exists until the visitor chooses how to start: a
 * one-click generated demo home, or their own account and devices. Rendered
 * full-screen by SessionGate while the session status is "missing".
 */
export function Onboarding() {
  const { initialize } = useSession();
  const [view, setView] = useState<"choose" | "custom">("choose");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [threshold, setThreshold] = useState("500");
  const [alerting, setAlerting] = useState(true);
  const [history, setHistory] = useState(true);
  const [devices, setDevices] = useState<DeviceRow[]>([
    { name: "", type: "THERMOSTAT", location: "" },
  ]);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      await initialize({ mode: "generate" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the demo.");
      setBusy(false);
    }
  }

  async function submitCustom(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Please enter a name.");
    if (!EMAIL_RE.test(email.trim())) return setError("Please enter a valid email address.");
    const clean = devices.filter((d) => d.name.trim() && d.location.trim());
    if (clean.length === 0) return setError("Add at least one device, or start with the demo home.");

    const thresholdValue = Number(threshold);
    if (!Number.isFinite(thresholdValue) || thresholdValue <= 0) {
      return setError("Threshold must be a positive number.");
    }

    setBusy(true);
    setError(null);
    try {
      await initialize({
        mode: "custom",
        name: name.trim(),
        email: email.trim(),
        address: address.trim(),
        energyAlertingThreshold: thresholdValue,
        alerting,
        history,
        devices: clean,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create your account.");
      setBusy(false);
    }
  }

  function updateDevice(index: number, patch: Partial<DeviceRow>) {
    setDevices((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-1 p-4">
      <div className="w-full max-w-2xl">
        <div className="mb-5 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-accent/30 bg-accent-soft text-accent-text">
            <BrandMark size={18} />
          </span>
          <div className="leading-tight">
            <div className="text-[15px] font-semibold tracking-tight text-text">EnergyTracker</div>
            <div className="font-mono text-[9px] font-medium uppercase tracking-[0.14em] text-text-muted">
              Playground
            </div>
          </div>
        </div>

        <div className="panel p-6 sm:p-7">
          {view === "choose" ? (
            <>
              <h1 className="text-xl font-semibold tracking-tight text-text">
                Welcome — let&apos;s set up your energy tracker
              </h1>
              <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-text-secondary">
                This is a self-contained demo: readings, alerts and AI tips are
                simulated in the browser, so there is nothing to install. Start
                with a ready-made home, or bring your own.
              </p>

              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => void generate()}
                  disabled={busy}
                  className={clsx(
                    "panel-raised group flex flex-col items-start gap-3 p-5 text-left transition-colors",
                    "hover:border-accent/40 disabled:cursor-not-allowed disabled:opacity-60",
                  )}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] border border-accent/25 bg-accent-soft text-accent-text">
                    <MagicWand width={18} height={18} />
                  </span>
                  <div>
                    <div className="text-[14px] font-semibold text-text">Generate a demo home</div>
                    <p className="mt-1 text-[12px] leading-snug text-text-secondary">
                      One click. Three devices, a week of realistic readings, a
                      500 kWh limit and two past alerts — ready to explore.
                    </p>
                  </div>
                  <span className="mt-auto inline-flex items-center gap-1.5 text-[12px] font-medium text-accent-text">
                    {busy ? "Setting up…" : "Start in one click"}
                    <NavArrowLeft width={13} height={13} className="rotate-180" />
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setView("custom");
                  }}
                  disabled={busy}
                  className={clsx(
                    "panel-raised group flex flex-col items-start gap-3 p-5 text-left transition-colors",
                    "hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-60",
                  )}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] border border-border bg-surface-2 text-text-secondary">
                    <User width={18} height={18} />
                  </span>
                  <div>
                    <div className="text-[14px] font-semibold text-text">Set up my own</div>
                    <p className="mt-1 text-[12px] leading-snug text-text-secondary">
                      Enter your details, pick a limit and add your own devices.
                      Optionally include a week of history.
                    </p>
                  </div>
                  <span className="mt-auto inline-flex items-center gap-1.5 text-[12px] font-medium text-text-secondary">
                    Configure it myself
                    <NavArrowLeft width={13} height={13} className="rotate-180" />
                  </span>
                </button>
              </div>

              {error && (
                <div className="mt-4">
                  <AlertBanner title="Could not start" description={error} onDismiss={() => setError(null)} />
                </div>
              )}
            </>
          ) : (
            <form onSubmit={submitCustom} className="flex flex-col gap-5">
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setView("choose");
                  }}
                  className="inline-flex items-center gap-1.5 text-[12px] font-medium text-text-muted transition-colors hover:text-text"
                >
                  <NavArrowLeft width={13} height={13} />
                  Back
                </button>
                <h1 className="mt-3 text-xl font-semibold tracking-tight text-text">
                  Create your account
                </h1>
                <p className="mt-1.5 text-[13px] text-text-secondary">
                  Everything lives in a session cookie — no sign-up, no email is sent.
                </p>
              </div>

              {error && (
                <AlertBanner title="Check your details" description={error} onDismiss={() => setError(null)} />
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Doe"
                  autoComplete="name"
                />
                <Input
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@home.dev"
                  autoComplete="email"
                />
                <Input
                  label="Address (optional)"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="24 Maple Street"
                  className="sm:col-span-2"
                />
                <Input
                  label="Alert threshold (kWh)"
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  className="font-mono tabular"
                />
                <div className="flex flex-col justify-end">
                  <div className="flex items-center justify-between rounded-[var(--radius)] border border-border bg-surface-0 px-3.5 py-2.5">
                    <span className="text-[12.5px] font-medium text-text">Alerting on</span>
                    <Switch checked={alerting} onChange={setAlerting} label="Toggle alerting" />
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="overline">Devices</span>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() =>
                      setDevices((prev) => [...prev, { name: "", type: "LIGHT", location: "" }])
                    }
                    disabled={devices.length >= 6}
                  >
                    <Plus width={13} height={13} />
                    Add device
                  </Button>
                </div>

                <div className="flex flex-col gap-3">
                  {devices.map((device, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-1 gap-2 rounded-[var(--radius)] border border-border bg-surface-0 p-3 sm:grid-cols-12"
                    >
                      <Input
                        aria-label={`Device ${i + 1} name`}
                        placeholder="Device name"
                        value={device.name}
                        onChange={(e) => updateDevice(i, { name: e.target.value })}
                        className="sm:col-span-5"
                      />
                      <Select
                        aria-label={`Device ${i + 1} type`}
                        value={device.type}
                        onChange={(e) => updateDevice(i, { type: e.target.value as DeviceType })}
                        className="sm:col-span-3"
                      >
                        {DEVICE_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </Select>
                      <Input
                        aria-label={`Device ${i + 1} location`}
                        placeholder="Location"
                        value={device.location}
                        onChange={(e) => updateDevice(i, { location: e.target.value })}
                        className="sm:col-span-3"
                      />
                      <button
                        type="button"
                        aria-label={`Remove device ${i + 1}`}
                        onClick={() => setDevices((prev) => prev.filter((_, idx) => idx !== i))}
                        disabled={devices.length <= 1}
                        className="flex items-center justify-center rounded-[var(--radius)] border border-border text-text-muted transition-colors hover:border-critical/40 hover:text-critical-text disabled:cursor-not-allowed disabled:opacity-40 sm:col-span-1"
                      >
                        <Trash width={14} height={14} />
                      </button>
                    </div>
                  ))}
                </div>

                <label className="mt-3 flex items-center justify-between gap-3 rounded-[var(--radius)] border border-border bg-surface-0 px-3.5 py-2.5">
                  <span className="text-[12.5px] text-text-secondary">
                    Include 7 days of realistic history
                  </span>
                  <Switch checked={history} onChange={setHistory} label="Toggle history" />
                </label>
              </div>

              <div className="flex items-center justify-end">
                <Button type="submit" variant="primary" disabled={busy}>
                  <Check width={14} height={14} />
                  {busy ? "Creating…" : "Create my tracker"}
                </Button>
              </div>
            </form>
          )}
        </div>

        <p className="mt-4 text-center text-[11px] text-text-muted">
          No account, no database, no email — a self-contained simulation.
        </p>
      </div>
    </div>
  );
}
