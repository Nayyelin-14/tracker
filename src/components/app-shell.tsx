"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bell,
  Cpu,
  Flask,
  MagicWand,
  Menu,
  NavArrowDown,
  Refresh,
  X,
} from "iconoir-react";
import { clsx } from "clsx";
import { useEffect, useState, type ReactNode } from "react";
import { useSession } from "./session";
import { ThemeToggle } from "./theme-toggle";
import { BrandMark } from "./brand-mark";
import { useAsync } from "@/lib/use-async";
import { getAlerts } from "@/lib/api";
import type { AlertDto } from "@/lib/types";

const NAV = [
  { href: "/", label: "Overview", icon: Activity },
  { href: "/devices", label: "Devices", icon: Cpu },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/insights", label: "Insights", icon: MagicWand },
  { href: "/simulation", label: "Simulation", icon: Flask },
] as const;

function sectionLabel(pathname: string): string {
  if (pathname === "/") return "Overview";
  const match = NAV.find((n) => n.href !== "/" && pathname.startsWith(n.href));
  return match?.label ?? "Overview";
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-nav-accent">
        <BrandMark size={22} />
      </span>
      <div className="leading-tight">
        <div className="text-[14.5px] font-semibold tracking-tight text-nav-text-strong">
          EnergyTracker
        </div>
        <div className="text-[10.5px] font-medium text-nav-text">
          Monitor
        </div>
      </div>
    </div>
  );
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Primary">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "flex items-center gap-3 rounded-[var(--radius)] px-3 py-2 text-[13px] font-medium transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nav-accent",
              active
                ? "bg-nav-active text-nav-text-strong"
                : "text-nav-text hover:bg-nav-hover hover:text-nav-text-strong",
            )}
          >
            <Icon
              width={17}
              height={17}
              className={clsx("shrink-0", active ? "text-nav-accent" : "text-current")}
            />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function SystemStatus() {
  const { status } = useSession();
  const dot =
    status === "ready"
      ? "bg-success"
      : status === "loading"
        ? "bg-warning"
        : "bg-critical";
  const label =
    status === "ready"
      ? "System online"
      : status === "loading"
        ? "Connecting…"
        : status === "missing"
          ? "No session"
          : "Gateway offline";

  return (
    <div className="rounded-[var(--radius)] bg-nav-hover px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className={clsx("h-2 w-2 shrink-0 rounded-full", dot)} />
        <span className="text-[12px] font-medium text-nav-text-strong">{label}</span>
      </div>
      <div className="mt-1 text-[10.5px] text-nav-text">
        Simulated readings
      </div>
    </div>
  );
}

function UserCard({ onReset }: { onReset: () => void }) {
  const { user, status, reset } = useSession();
  const [busy, setBusy] = useState(false);
  const name = user?.name || "Demo User";
  const email = user?.email || "—";
  const initials =
    status === "ready"
      ? name
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((w) => w[0]?.toUpperCase())
          .join("")
      : "…";

  async function handleReset() {
    if (status !== "ready" || busy) return;
    const ok = window.confirm(
      "Reset this demo session?\n\nYour account, devices and alerts live only in this browser and will be cleared. You can set it all up again from scratch.",
    );
    if (!ok) return;
    setBusy(true);
    try {
      await reset();
      onReset();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2">
      <div className="flex items-center gap-3 px-1">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-nav-accent text-[12px] font-semibold text-[#0d1a14]">
          {initials}
        </span>
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[13px] font-semibold text-nav-text-strong">{name}</div>
          <div className="truncate font-mono text-[10px] text-nav-text">{email}</div>
        </div>
      </div>
      <button
        type="button"
        onClick={handleReset}
        disabled={busy || status !== "ready"}
        className={clsx(
          "mt-2 flex w-full items-center gap-2 rounded-[var(--radius)] px-3 py-1.5 text-[12px] font-medium text-nav-text transition-colors",
          "hover:bg-nav-hover hover:text-nav-text-strong disabled:opacity-50",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nav-accent",
        )}
      >
        <Refresh width={14} height={14} className="shrink-0" />
        {busy ? "Resetting…" : "Reset demo"}
      </button>
    </div>
  );
}

function SidebarContent({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center border-b border-nav-border px-5">
        <Brand />
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <NavLinks pathname={pathname} onNavigate={onNavigate} />
      </div>
      <div className="shrink-0 border-t border-nav-border p-3">
        <SystemStatus />
        <UserCard onReset={() => onNavigate?.()} />
      </div>
    </div>
  );
}

function NotificationBell() {
  const { user } = useSession();
  const alerts = useAsync<AlertDto[]>(() => getAlerts(user!.userId, 50), [user?.userId], {
    enabled: user != null,
  });
  const breaches = (alerts.data ?? []).filter((a) => a.energyConsumed > a.threshold).length;

  return (
    <Link
      href="/alerts"
      aria-label={breaches > 0 ? `Alerts — ${breaches} active` : "Alerts"}
      className="relative flex h-8 w-8 items-center justify-center rounded-[var(--radius)] text-text-secondary transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <Bell width={17} height={17} />
      {breaches > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-critical px-1 text-[10px] font-semibold text-white">
          {breaches > 9 ? "9+" : breaches}
        </span>
      )}
    </Link>
  );
}

function UserMenu() {
  const { user, status, reset } = useSession();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const name = user?.name || "Demo User";
  const email = user?.email || "—";
  const initials =
    status === "ready"
      ? name
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((w) => w[0]?.toUpperCase())
          .join("")
      : "…";

  async function handleReset() {
    setOpen(false);
    if (status !== "ready" || busy) return;
    const ok = window.confirm(
      "Reset this demo session?\n\nYour account, devices and alerts live only in this browser and will be cleared. You can set it all up again from scratch.",
    );
    if (!ok) return;
    setBusy(true);
    try {
      await reset();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-[var(--radius)] py-1 pl-1 pr-2 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-on">
          {initials}
        </span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-[12.5px] font-semibold text-text">{name}</span>
          <span className="block text-[10px] text-text-muted">System user</span>
        </span>
        <NavArrowDown width={14} height={14} className="hidden text-text-muted sm:block" />
      </button>

      {open && (
        <>
          <button
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Close user menu"
            tabIndex={-1}
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="panel-raised absolute right-0 z-50 mt-2 w-60 p-1.5"
          >
            <div className="px-2.5 py-2">
              <div className="truncate text-[13px] font-semibold text-text">{name}</div>
              <div className="truncate font-mono text-[11px] text-text-muted">{email}</div>
            </div>
            <div className="my-1 h-px bg-border" />
            <button
              type="button"
              role="menuitem"
              onClick={handleReset}
              disabled={busy || status !== "ready"}
              className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[12.5px] font-medium text-text-secondary transition-colors hover:bg-surface-2 hover:text-text disabled:opacity-50"
            >
              <Refresh width={14} height={14} />
              {busy ? "Resetting…" : "Reset demo session"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[256px_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen bg-nav-bg lg:block">
        <SidebarContent pathname={pathname} />
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-border bg-surface-0">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={menuOpen}
              className="flex h-8 w-8 items-center justify-center rounded-[var(--radius)] text-text-secondary transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:hidden"
            >
              <Menu width={20} height={20} />
            </button>

            <div className="lg:hidden">
              <BrandMark size={20} />
            </div>

            <div className="hidden min-w-0 lg:block">
              <div className="text-[13.5px] font-semibold text-text">
                {sectionLabel(pathname)}
              </div>
            </div>

            <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
              <NotificationBell />
              <ThemeToggle />
              <div className="mx-1 hidden h-5 w-px bg-border sm:block" />
              <UserMenu />
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="fade-in">{children}</div>
        </main>

        <footer className="border-t border-border">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-1 px-4 py-4 text-[11px] text-text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <span>EnergyTracker · demo environment with simulated readings</span>
            <span>Not connected to live hardware</span>
          </div>
        </footer>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          <button
            className="absolute inset-0 bg-black/50"
            aria-label="Close navigation menu"
            onClick={() => setMenuOpen(false)}
            tabIndex={-1}
          />
          <div className="drawer-in absolute inset-y-0 left-0 flex w-[280px] flex-col bg-nav-bg">
            <div className="flex h-16 items-center justify-between border-b border-nav-border pl-5 pr-3">
              <Brand />
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="Close navigation menu"
                className="flex h-8 w-8 items-center justify-center rounded-[var(--radius)] text-nav-text transition-colors hover:bg-nav-hover hover:text-nav-text-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nav-accent"
              >
                <X width={18} height={18} />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <SidebarContent pathname={pathname} onNavigate={() => setMenuOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
