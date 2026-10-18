import type { NextRequest } from "next/server";
import { intQuery, problem } from "./http";
import { rateLimit } from "./rate-limit";

/** 429 + Retry-After when the short-burst budget is spent, else null. */
export function throttled(): Response | null {
  const retryAfter = rateLimit();
  if (retryAfter == null) return null;
  return problem(
    429,
    "Too many requests",
    `Generation is limited to a short burst — retry in ${retryAfter}s.`,
    undefined,
    { "Retry-After": String(retryAfter) },
  );
}

/** Provider / model / window every insight endpoint accepts. */
export function resolveSelection(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  return {
    provider: params.get("provider") || "groq",
    model: params.get("model") || "llama-3.3-70b-versatile",
    days: intQuery(req, "days", 7, 1, 30),
  };
}
