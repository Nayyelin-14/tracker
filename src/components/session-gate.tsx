"use client";

import type { ReactNode } from "react";
import { WifiOff } from "iconoir-react";
import { Button, EmptyState } from "@/components/ui";
import { useSession } from "@/components/session";
import { Onboarding } from "@/components/onboarding";

/**
 * Decides what the visitor sees before the app itself renders: onboarding when
 * there is no session yet, a retry screen when the API layer is unreachable,
 * and the real app otherwise.
 *
 * While the session is still resolving (`loading`) we render the shell and the
 * page's own skeleton rather than replacing the whole tree with a boot screen.
 * That matters under Cache Components: the `loading` state is the one that
 * exists during prerender, so any branch that swaps out `children` here would
 * drop the route's page segment from the static pass entirely — which is
 * exactly what produced the "could not validate ... instant navigation"
 * warning across every route. Keeping the segment in the tree lets Instant
 * Navigation validate it and gives an instant shell on navigation.
 */
export function SessionGate({ children }: { children: ReactNode }) {
  const { status, error, refresh } = useSession();

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
