"use client";

import { useEffect } from "react";
import { Bell, Mail, X } from "iconoir-react";
import { Button, Dialog } from "@/components/ui";
import { kwh } from "@/lib/format";
import type { AlertDto } from "@/lib/types";

/**
 * The alert "delivery" moment for the demo. There is no mail server here, so
 * instead of a real email the visitor gets a toast and can open the exact
 * message that would have been sent — the same content Mailpit would show in
 * the full stack.
 */
export function AlertToast({
  alert,
  onView,
  onClose,
}: {
  alert: AlertDto;
  onView: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 9000);
    return () => window.clearTimeout(timer);
  }, [alert.id, onClose]);

  return (
    <div
      role="status"
      className="toast-in fixed bottom-4 right-4 z-40 w-[min(92vw,360px)] rounded-[var(--radius)] border border-border bg-surface-0 p-4 shadow-[var(--shadow-elevated)]"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-critical/28 bg-critical-soft text-critical-text">
          <Bell width={15} height={15} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-text">Threshold exceeded</div>
          <p className="mt-0.5 text-[11.5px] leading-snug text-text-secondary">
            Alert email sent to <span className="font-medium text-text">{alert.email}</span> —{" "}
            {kwh(alert.energyConsumed, 1)} kWh against a {kwh(alert.threshold, 0)} kWh limit.
          </p>
          <div className="mt-2.5 flex items-center gap-2">
            <Button size="sm" variant="primary" onClick={onView}>
              <Mail width={13} height={13} />
              View email
            </Button>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Dismiss notification"
          className="rounded p-1 text-text-muted transition-colors hover:text-text"
        >
          <X width={14} height={14} />
        </button>
      </div>
    </div>
  );
}

/** The rendered notification email, presented like an inbox message. */
export function AlertEmailPreview({
  alert,
  onClose,
}: {
  alert: AlertDto;
  onClose: () => void;
}) {
  const when = new Date(alert.createdAt).toLocaleString("en-US", { hour12: false });

  return (
    <Dialog title="Alert email" onClose={onClose} width="max-w-lg">
      <div className="overflow-hidden rounded-[var(--radius)] border border-border">
        <div className="border-b border-border bg-surface-2 px-4 py-3">
          <div className="text-[13px] font-semibold text-text">
            ⚠ Energy consumption threshold exceeded
          </div>
          <div className="mt-1.5 flex flex-col gap-0.5 font-mono text-[10.5px] text-text-muted">
            <span>
              From: Energy Tracker Alerts &lt;alerts@energytracker.dev&gt;
            </span>
            <span>To: {alert.email}</span>
            <span>{when}</span>
          </div>
        </div>
        <div className="bg-surface-0 px-4 py-4">
          <p className="text-[12.5px] leading-relaxed text-text-secondary">
            Hello,
          </p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-text-secondary">
            Your aggregate energy use reached{" "}
            <span className="font-mono font-semibold text-critical-text">
              {kwh(alert.energyConsumed, 2)} kWh
            </span>{" "}
            in a single evaluation window, crossing the limit you configured of{" "}
            <span className="font-mono font-semibold text-text">
              {kwh(alert.threshold, 0)} kWh
            </span>
            .
          </p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-text-secondary">
            Open the dashboard to see the hour it happened and which devices were
            drawing power.
          </p>
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1 font-mono text-[10.5px] text-text-muted">
            <Mail width={12} height={12} />
            delivered · notification #{alert.id}
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-[11px] text-text-muted">
        This is the exact email the alert service would send via Mailpit in the full stack.
      </p>
    </Dialog>
  );
}
