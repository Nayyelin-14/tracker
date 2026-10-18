"use client";

import { useEffect, useId, useRef, type ComponentProps, type ReactNode } from "react";
import { X } from "iconoir-react";
import { clsx } from "clsx";

/** Hairline card with subtle shadow (no heavy drop shadows). */
export function Card({
  className,
  raised = false,
  ...props
}: ComponentProps<"div"> & { raised?: boolean }) {
  return (
    <div
      className={clsx(raised ? "panel-raised" : "panel", "p-5", className)}
      {...props}
    />
  );
}

/** Small uppercase overline label. */
export function Overline({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={clsx("overline", className)}>{children}</div>;
}

type Tone = "neutral" | "accent" | "warning" | "critical" | "info";

const TONES: Record<Tone, string> = {
  neutral: "text-text-secondary bg-surface-2 border-border",
  accent: "text-accent-text bg-accent-soft border-accent/25",
  warning: "text-warning-text bg-warning-soft border-warning/28",
  critical: "text-critical-text bg-critical-soft border-critical/28",
  info: "text-info bg-info-soft border-info/25",
};

/** Status chip — hairline border + tint wash, optional pulse dot. */
export function Badge({
  tone = "neutral",
  dot = false,
  children,
  className,
}: {
  tone?: Tone;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex h-[22px] items-center gap-1.5 rounded-full border px-2.5 font-mono text-[11px] font-medium tabular",
        TONES[tone],
        className,
      )}
    >
      {dot && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      {children}
    </span>
  );
}

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-accent-on font-semibold hover:bg-accent-hover active:translate-y-px",
  secondary:
    "bg-surface-0 text-text border border-border-strong hover:bg-surface-2",
  danger:
    "bg-critical text-white font-semibold hover:bg-critical/90 active:translate-y-px",
  ghost: "text-text-secondary hover:text-text hover:bg-surface-2",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: "sm" | "md" }) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-[10px] font-medium transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        "disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-8 px-3 text-[12px]" : "h-9 px-4 text-[13px]",
        BUTTON_VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}

/** Text input with label support. */
export function Input({
  label,
  className,
  ...props
}: ComponentProps<"input"> & { label?: string }) {
  const id = useId();
  const input = (
    <input
      id={label ? id : undefined}
      className={clsx("field", className)}
      {...props}
    />
  );
  if (!label) return input;
  return (
    <label className="flex flex-col gap-1.5" htmlFor={id}>
      <Overline>{label}</Overline>
      {input}
    </label>
  );
}

/** Native select styled as an instrument control. */
export function Select({
  label,
  className,
  children,
  ...props
}: ComponentProps<"select"> & { label?: string }) {
  const id = useId();
  const select = (
    <select id={label ? id : undefined} className={clsx("field", className)} {...props}>
      {children}
    </select>
  );
  if (!label) return select;
  return (
    <label className="flex flex-col gap-1.5" htmlFor={id}>
      <Overline>{label}</Overline>
      {select}
    </label>
  );
}

/** Toggle switch — reflects a boolean; caller owns persistence. */
export function Switch({
  checked,
  onChange,
  disabled = false,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        "relative h-6 w-11 shrink-0 rounded-full border transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "border-accent bg-accent" : "border-border-strong bg-surface-2",
      )}
    >
      <span
        className={clsx(
          "absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow transition-all duration-150",
          checked ? "left-[24px]" : "left-[2px]",
        )}
      />
    </button>
  );
}

/** Modal dialog — Escape + overlay click close, focus restore, scroll lock. */
export function Dialog({
  title,
  children,
  onClose,
  footer,
  width = "max-w-md",
  alert = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  width?: string;
  alert?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    openerRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusable = panel?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const items = [
        ...panel.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((el) => !el.hasAttribute("disabled"));
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prevOverflow;
      openerRef.current?.focus();
    };
  }, [onClose]);

  return (
    <div
      className={clsx(
        "fixed inset-0 z-50 flex items-center justify-center p-4",
        alert ? "role-alertdialog" : "role-dialog",
      )}
      role={alert ? "alertdialog" : "dialog"}
      aria-modal="true"
      aria-label={title}
    >
      <button
        className="absolute inset-0 bg-text/45 backdrop-blur-[2px]"
        aria-label="Close dialog"
        onClick={onClose}
        tabIndex={-1}
      />
      <div
        ref={panelRef}
        className={clsx(
          "dialog-in panel relative w-full p-5 shadow-[var(--shadow-elevated)]",
          width,
        )}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="type-section text-text">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-text-muted transition-colors hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <X width={16} height={16} />
          </button>
        </div>
        {children}
        {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

/** Side drawer — detail panels. Same a11y contract as Dialog. */
export function Drawer({
  title,
  children,
  onClose,
  width = "max-w-[380px]",
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  width?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    openerRef.current = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>("button, [href], input, select")?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      openerRef.current?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        className="absolute inset-0 bg-text/45 backdrop-blur-[2px]"
        aria-label="Close drawer"
        onClick={onClose}
        tabIndex={-1}
      />
      <div
        ref={panelRef}
        className={clsx(
          "drawer-in relative flex h-full w-full flex-col border-l border-border bg-surface-0 shadow-[var(--shadow-elevated)]",
          width,
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="type-section truncate text-text">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-text-muted transition-colors hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <X width={16} height={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

/** Small indeterminate spinner. */
export function Spinner({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("animate-spin", className)}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity={0.25} strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Centered empty state with icon, title, body, and optional actions. */
export function EmptyState({
  icon,
  title,
  description,
  actions,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "panel flex flex-col items-center justify-center px-8 py-14 text-center",
        className,
      )}
    >
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent-text">
          {icon}
        </div>
      )}
      <h3 className="type-section text-text">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-text-secondary">
          {description}
        </p>
      )}
      {actions && <div className="mt-5 flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  );
}

/** Inline alert banner — degraded service / recoverable error. */
export function AlertBanner({
  tone = "critical",
  title,
  description,
  action,
  onDismiss,
}: {
  tone?: "critical" | "warning";
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  onDismiss?: () => void;
}) {
  const isCritical = tone === "critical";
  return (
    <div
      role="alert"
      className={clsx(
        "flex flex-col gap-3 rounded-[var(--radius)] border p-4 sm:flex-row sm:items-center sm:justify-between",
        isCritical
          ? "border-critical/30 bg-critical-soft"
          : "border-warning/30 bg-warning-soft",
      )}
    >
      <div>
        <div
          className={clsx(
            "text-[13px] font-semibold",
            isCritical ? "text-critical-text" : "text-warning-text",
          )}
        >
          {title}
        </div>
        {description && (
          <div className="mt-0.5 text-[12px] text-text-secondary">{description}</div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {action}
        {onDismiss && (
          <button
            onClick={onDismiss}
            aria-label="Dismiss"
            className="rounded p-1 text-text-muted transition-colors hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

/** Loading skeleton block. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={clsx("animate-pulse rounded-[var(--radius)] bg-surface-2", className)}
    />
  );
}

/** Segmented toggle (hourly/daily style). */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-full bg-surface-2 p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={clsx(
            "rounded-full px-3 py-1 text-[11px] font-medium transition-colors",
            "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
            value === opt.value
              ? "bg-accent text-accent-on shadow-[var(--shadow-card)]"
              : "text-text-muted hover:text-text-secondary",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
