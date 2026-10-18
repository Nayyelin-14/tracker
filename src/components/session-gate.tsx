"use client";

import type { ReactNode } from "react";
import { WifiOff } from "iconoir-react";
import { Button, EmptyState, Spinner } from "@/components/ui";
import { useSession } from "@/components/session";
import { Onboarding } from "@/components/onboarding";
import { BrandMark } from "@/components/brand-mark";

/**
 * Decides what the visitor sees before the app itself renders:
 * a boot screen while the session resolves, onboarding when there is no
 * session yet, a retry screen when the API layer is unreachable, and the
 * real app once the session is ready.
 */
export function SessionGate({ children }: { children: ReactNode }) {
  const { status, error, refresh } = useSession();

  if (status === "loading") return <BootScreen />;
  if (status === "missing") return <Onboarding />;
  if (status === "offline") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-1 p-4">
        <div className="w-full max-w-md">
          <EmptyState
            icon={<WifiOff width={22} height={22} />}
            title="Demo backend unreachable"
            description={error ?? "The request to the Next.js API layer failed. Retry in a moment."}
            actions={
              <Button variant="primary" onClick={() => void refresh()}>
                Retry
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function BootScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-1">
      <span className="flex h-11 w-11 items-center justify-center rounded-[12px] border border-accent/30 bg-accent-soft text-accent-text">
        <BrandMark size={22} />
      </span>
      <div className="flex items-center gap-2 text-[12px] text-text-muted">
        <Spinner size={14} />
        Starting the playground…
      </div>
    </div>
  );
}
