"use client";

import { useEffect, useId, useRef, type ComponentProps, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "iconoir-react";
import { clsx } from "clsx";

/**
 * Renders children into document.body.
 *
 * Overlays must not mount inside the page subtree: any ancestor with a
 * `transform` (including the page's `.fade-in` entrance animation, which keeps
 * a transform after it finishes) becomes the containing block for
 * `position: fixed`, so a radius-0 `inset-0` overlay would size itself to that
 * subtree instead of the viewport — the sidebar stayed undimmed. Portalling to
 * the body escapes every transformed ancestor.
 *
 * Dialog/Drawer only mount after a user interaction, so this never runs during
 * SSR; the `typeof document` guard covers any future server-rendered use.
 */
export function Portal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

/** Soft-edged card with a whisper of elevation. */
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

/** Small sentence-case section label. Use sparingly. */
export function Overline({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={clsx("overline", className)}>{children}</div>;
}

type Tone = "neutral" | "accent" | "success" | "warning" | "critical" | "info";

const TONES: Record<Tone, string> = {
  neutral: "text-text-secondary border-border bg-surface-1",
  accent: "text-accent-text border-accent/30 bg-accent-soft",
  success: "text-success-text border-success/30 bg-success-soft",
  warning: "text-warning-text border-warning/30 bg-warning-soft",
  critical: "text-critical-text border-critical/30 bg-critical-soft",
  info: "text-info-text border-info/30 bg-info-soft",
};

/** Status chip — tinted wash + matching hairline, optional pulse dot. */
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
        "inline-flex h-5 items-center gap-1.5 rounded-[var(--radius-sm)] border px-1.5 text-[11px] font-medium tabular",
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
  primary: "bg-accent text-accent-on font-semibold hover:bg-accent-hover",
  secondary: "bg-surface-0 text-text border border-border-strong hover:bg-surface-2",
  danger: "bg-critical text-white font-semibold hover:opacity-90",
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
        "inline-flex items-center justify-center gap-2 rounded-[var(--radius)] font-medium transition-colors",
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
      <span className="text-[12px] font-medium text-text-secondary">{label}</span>
      {input}
    </label>
  );
}

/** Native select styled to match the form controls. */
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
      <span className="text-[12px] font-medium text-text-secondary">{label}</span>
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
        "relative h-5 w-9 shrink-0 rounded-full border transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "border-accent bg-accent" : "border-border-strong bg-surface-3",
      )}
    >
      <span
        className={clsx(
          "absolute top-[3px] h-3 w-3 rounded-full bg-white transition-all duration-150",
          checked
            ? "left-[21px] bg-accent-on"
            : "left-[3px] bg-surface-0 shadow-[0_1px_2px_rgba(0,0,0,0.2)]",
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
    <Portal>
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 lg:left-64"
      role={alert ? "alertdialog" : "dialog"}
      aria-modal="true"
      aria-label={title}
    >
      <button
        className="absolute inset-0 bg-black/50"
        aria-label="Close dialog"
        onClick={onClose}
        tabIndex={-1}
      />
      <div
        ref={panelRef}
        className={clsx("dialog-in panel-raised relative w-full p-5", width)}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="type-section text-text">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <X width={16} height={16} />
          </button>
        </div>
        {children}
        {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
    </Portal>
  );
}

/** Side drawer — detail panels. Same a11y contract as Dialog. */
export function Drawer({
  title,
  children,
  onClose,
  width = "max-w-[400px]",
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
    <Portal>
    <div
      className="fixed inset-0 z-50 flex justify-end lg:left-64"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        className="absolute inset-0 bg-black/50"
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
            className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <X width={16} height={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
    </Portal>
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
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-[var(--radius)] bg-accent-soft text-accent-text">
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
  tone?: "critical" | "warning" | "success";
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  onDismiss?: () => void;
}) {
  const styles = {
    critical: "border-critical/30 bg-critical-soft text-critical-text",
    warning: "border-warning/30 bg-warning-soft text-warning-text",
    success: "border-success/30 bg-success-soft text-success-text",
  }[tone];
  return (
    <div
      role="alert"
      className={clsx(
        "flex flex-col gap-3 rounded-[var(--radius)] border p-4 sm:flex-row sm:items-center sm:justify-between",
        styles,
      )}
    >
      <div>
        <div className="text-[13px] font-semibold">{title}</div>
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
            className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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

/** Segmented toggle — a real control with a raised active thumb. */
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
    <div className="inline-flex items-center gap-0.5 rounded-[var(--radius)] border border-border bg-surface-2 p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          className={clsx(
            "rounded-[var(--radius-sm)] px-3 py-1 text-[11.5px] font-medium transition-colors",
            "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
            value === opt.value
              ? "bg-surface-0 text-text shadow-[var(--shadow-card)]"
              : "text-text-muted hover:text-text",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
