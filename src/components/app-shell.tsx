"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bell,
  Cpu,
  Flask,
  InfoCircle,
  Menu,
  MagicWand,
  NavArrowLeft,
  X,
} from "iconoir-react";
import { clsx } from "clsx";
import { useEffect, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { useSession } from "./session";
import { ThemeToggle } from "./theme-toggle";
import { BrandMark } from "./brand-mark";

const SIDEBAR_KEY = "et-sidebar";

// External store for the sidebar preference, mirroring ThemeToggle's pattern:
// localStorage is the source of truth, and the toggle notifies local listeners
// because storage events don't fire in the tab that wrote them.
const sidebarListeners = new Set<() => void>();

function subscribeSidebar(listener: () => void) {
  sidebarListeners.add(listener);
  return () => {
    sidebarListeners.delete(listener);
  };
}

function getSidebarSnapshot(): "collapsed" | "expanded" {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === "collapsed" ? "collapsed" : "expanded";
  } catch {
    return "expanded";
  }
}

function getServerSidebarSnapshot(): "expanded" {
  return "expanded"; // matches the SSR default; React corrects after hydration
}

function notifySidebar() {
  for (const listener of sidebarListeners) listener();
}

const NAV = [
  { href: "/", label: "Overview", icon: Activity },
  { href: "/devices", label: "Devices", icon: Cpu },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/insights", label: "Insights", icon: MagicWand },
  { href: "/simulation", label: "Simulation", icon: Flask },
] as const;

/** Rail width when collapsed — icon + padding only. */
const SIDEBAR_RAIL = "72px";
/** Full width with labels. */
const SIDEBAR_FULL = "248px";
/** Shared easing so width, margin, and the chevron stay in sync. */
const EASE = "ease-[cubic-bezier(0.4,0,0.2,1)]";

function Brand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div
      className={clsx(
        "flex items-center gap-2.5",
        collapsed ? "justify-center px-0" : "px-0",
      )}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-accent/30 bg-accent-soft text-accent-text">
        <BrandMark size={17} />
      </span>
      <div
        className={clsx(
          "min-w-0 leading-tight transition-all duration-200 ease-out",
          collapsed ? "ml-0 max-w-0 overflow-hidden opacity-0" : "ml-2.5 max-w-[160px] opacity-100",
        )}
      >
        <div className="whitespace-nowrap text-[15px] font-semibold tracking-tight text-text">
          EnergyTracker
        </div>
        <div className="whitespace-nowrap font-mono text-[9px] font-medium uppercase tracking-[0.14em] text-text-muted">
          Playground
        </div>
      </div>
    </div>
  );
}

function ConnectionStatus({ pill = false }: { pill?: boolean }) {
  const { status } = useSession();

  const dot =
    status === "ready" ? "bg-accent" : status === "loading" ? "bg-warning" : "bg-critical";
  const label =
    status === "ready"
      ? "System running"
      : status === "loading"
        ? "Connecting…"
        : status === "missing"
          ? "No demo user"
          : "Gateway offline";

  if (pill) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-0 px-3 py-1.5 text-[12px] font-medium text-text-secondary">
        <span className={clsx("h-1.5 w-1.5 rounded-full", dot)} />
        {label}
      </span>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className={clsx("h-1.5 w-1.5 rounded-full", dot)} />
      <span className="text-[11px] text-text-secondary">{label}</span>
    </div>
  );
}

function UserProfile({ collapsed = false }: { collapsed?: boolean }) {
  const { user, status } = useSession();
  const name = user?.name || "Demo User";
  const email = user?.email || "—";
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <div
      className={clsx(
        "flex items-center",
        collapsed ? "justify-center" : "gap-3",
      )}
      title={collapsed ? `${name} · ${email}` : undefined}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent-text">
        {status === "ready" && initials ? initials : "…"}
      </span>
      <div
        className={clsx(
          "min-w-0 leading-tight transition-all duration-200 ease-out",
          collapsed ? "ml-0 max-w-0 overflow-hidden opacity-0" : "max-w-[150px] opacity-100",
        )}
      >
        <div className="truncate whitespace-nowrap text-[13px] font-semibold text-text">{name}</div>
        <div className="truncate whitespace-nowrap font-mono text-[10px] text-text-muted">{email}</div>
      </div>
    </div>
  );
}

function NavLinks({
  pathname,
  onNavigate,
  collapsed,
}: {
  pathname: string;
  onNavigate?: () => void;
  collapsed: boolean;
}) {
  return (
    <nav className="flex flex-col gap-1 p-3" aria-label="Primary">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            title={collapsed ? label : undefined}
            className={clsx(
              "flex items-center rounded-[10px] py-2 text-[13px] font-medium transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              collapsed ? "justify-center px-0" : "gap-3 px-3",
              active
                ? "bg-accent-soft text-accent-text"
                : "text-text-secondary hover:bg-surface-2 hover:text-text",
            )}
          >
            <Icon width={16} height={16} className="shrink-0" />
            <span
              className={clsx(
                "truncate whitespace-nowrap transition-all duration-200 ease-out",
                collapsed ? "ml-0 max-w-0 opacity-0" : "ml-0 max-w-[160px] opacity-100",
              )}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarContent({
  pathname,
  onNavigate,
  collapsed,
}: {
  pathname: string;
  onNavigate?: () => void;
  collapsed: boolean;
}) {
  return (
    <>
      <div className="flex h-16 shrink-0 items-center border-b border-border px-5">
        <Brand collapsed={collapsed} />
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        <NavLinks pathname={pathname} onNavigate={onNavigate} collapsed={collapsed} />
      </div>
      <div className="shrink-0 border-t border-border p-3">
        <div
          className={clsx(
            "mb-3 flex items-start rounded-[10px] bg-info-soft",
            collapsed ? "justify-center px-2 py-2.5" : "gap-2.5 px-3 py-2.5",
          )}
          title={
            collapsed
              ? "Simulated data — demo environment with generated readings."
              : undefined
          }
        >
          <InfoCircle width={15} height={15} className="shrink-0 text-info" />
          <div
            className={clsx(
              "min-w-0 leading-snug transition-all duration-200 ease-out",
              collapsed ? "ml-0 max-w-0 overflow-hidden opacity-0" : "max-w-[180px] opacity-100",
            )}
          >
            <div className="whitespace-nowrap text-[12px] font-semibold text-text">Simulated data</div>
            <div className="text-[11px] text-text-secondary">
              Demo environment with generated readings.
            </div>
          </div>
        </div>
        <UserProfile collapsed={collapsed} />
      </div>
    </>
  );
}

/** Edge-hugging toggle that rides the sidebar border. */
function SidebarToggle({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      aria-expanded={!collapsed}
      title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      className={clsx(
        "group fixed top-[4.5rem] z-40 hidden h-6 w-6 -translate-x-1/2 items-center justify-center",
        "rounded-full border border-border bg-surface-0 text-text-muted shadow-[var(--shadow-card)]",
        "transition-colors hover:border-border-strong hover:bg-surface-2 hover:text-text",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        "lg:flex",
      )}
      style={{ left: "var(--sidebar-w)" }}
    >
      <NavArrowLeft
        width={13}
        height={13}
        className={clsx(
          `transition-transform duration-300 ${EASE}`,
          collapsed && "rotate-180",
        )}
      />
    </button>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // Desktop sidebar: expanded on the server, then corrected from localStorage
  // by useSyncExternalStore (no hydration error, no effect-driven setState).
  const stored = useSyncExternalStore(
    subscribeSidebar,
    getSidebarSnapshot,
    getServerSidebarSnapshot,
  );
  const collapsed = stored === "collapsed";

  // Transitions start disabled so the restored width snaps in on load, then
  // enable a frame later so user toggles animate smoothly.
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setAnimated(true), 60);
    return () => window.clearTimeout(timer);
  }, []);

  function toggleSidebar() {
    try {
      localStorage.setItem(SIDEBAR_KEY, collapsed ? "expanded" : "collapsed");
    } catch {
      // private mode — session-only preference is fine
    }
    notifySidebar();
  }

  // Lock scroll while the drawer is open.
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
    <div
      className="flex min-h-screen"
      style={
        {
          "--sidebar-w": collapsed ? SIDEBAR_RAIL : SIDEBAR_FULL,
        } as CSSProperties
      }
    >
      {/* Desktop sidebar */}
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-30 hidden w-[var(--sidebar-w)] flex-col overflow-hidden",
          "border-r border-border bg-surface-0 lg:flex",
          animated && `transition-[width] duration-300 ${EASE}`,
        )}
      >
        <SidebarContent pathname={pathname} collapsed={collapsed} />
      </aside>

      {/* Desktop collapse toggle — rides the sidebar's right edge */}
      <SidebarToggle collapsed={collapsed} onToggle={toggleSidebar} />

      {/* Mobile top bar */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-surface-0 px-4 lg:hidden">
        <button
          onClick={() => setMenuOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={menuOpen}
          className="rounded-[10px] p-1.5 text-text-secondary transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <Menu width={20} height={20} />
        </button>
        <div className="flex min-w-0 flex-1 items-center">
          <Brand />
        </div>
        <ThemeToggle />
      </header>

      {/* Mobile drawer */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          <button
            className="absolute inset-0 bg-text/45 backdrop-blur-[2px]"
            aria-label="Close navigation menu"
            onClick={() => setMenuOpen(false)}
            tabIndex={-1}
          />
          <div className="drawer-in absolute inset-y-0 left-0 flex w-[280px] flex-col border-r border-border bg-surface-0 shadow-[var(--shadow-elevated)]">
            <div className="flex h-16 items-center justify-between border-b border-border px-5">
              <Brand />
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="Close navigation menu"
                className="rounded p-1 text-text-muted transition-colors hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <X width={18} height={18} />
              </button>
            </div>
            <div className="flex flex-1 flex-col overflow-hidden">
              <SidebarContent pathname={pathname} onNavigate={() => setMenuOpen(false)} collapsed={false} />
            </div>
          </div>
        </div>
      )}

      {/* Content column */}
      <div
        className={clsx(
          "flex min-w-0 flex-1 flex-col lg:ml-[var(--sidebar-w)]",
          animated && `transition-[margin-left] duration-300 ${EASE}`,
        )}
      >
        {/* Desktop top bar */}
        <header className="sticky top-0 z-20 hidden h-16 shrink-0 items-center justify-end gap-3 border-b border-border bg-surface-0/80 px-6 backdrop-blur lg:flex lg:px-8 xl:px-10">
          <ConnectionStatus pill />
          <ThemeToggle />
        </header>

        <main className="flex-1 px-4 pb-10 pt-[calc(4rem+1rem)] sm:px-6 lg:px-8 lg:py-7 lg:pt-7 xl:px-10">
          <div className="w-full fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
