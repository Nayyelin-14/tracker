"use client";

import { useSyncExternalStore } from "react";
import { MoonSat, SunLight } from "iconoir-react";
import { clsx } from "clsx";

type Theme = "dark" | "light";

// Minimal external store so the toggle re-renders when the DOM theme changes
// (including from the pre-paint script or another tab).
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify() {
  for (const listener of listeners) listener();
}

function getTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function getServerTheme(): Theme {
  return "light"; // matches the :root default and the pre-paint script fallback
}

/** Light/dark switch. The initial value is applied pre-paint by the inline
 *  script in layout.tsx; this component only mirrors and toggles it. */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getTheme, getServerTheme);

  function toggle() {
    const next: Theme = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
    try {
      localStorage.setItem("et-theme", next);
    } catch {
      // private mode — session-only theme is fine
    }
    notify();
  }

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      className={clsx(
        "flex h-8 w-8 items-center justify-center rounded-[var(--radius)]",
        "text-text-secondary transition-colors hover:bg-surface-2 hover:text-text",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
      )}
    >
      {theme === "dark" ? <SunLight width={14} height={14} /> : <MoonSat width={14} height={14} />}
    </button>
  );
}
