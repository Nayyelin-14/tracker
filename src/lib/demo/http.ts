import type { NextRequest } from "next/server";

/** RFC 7807 problem response — the same shape `GlobalExceptionHandler` emits. */
export function problem(
  status: number,
  title: string,
  detail: string,
  errors?: Record<string, string>,
  headers?: Record<string, string>,
): Response {
  const body: Record<string, unknown> = { type: "about:blank", title, status, detail };
  if (errors) body.errors = errors;
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/problem+json", ...headers },
  });
}

export function notFound(detail: string): Response {
  return problem(404, "Not found", detail);
}

export function badRequest(detail: string, errors?: Record<string, string>): Response {
  return problem(400, "Bad request", detail, errors);
}

/** Route handler params are a promise in Next 15+. */
export async function param(ctx: { params: Promise<Record<string, string>> }, key: string) {
  const all = await ctx.params;
  return all[key];
}

export function parseId(raw: string | undefined | null): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export function intQuery(
  req: NextRequest,
  key: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = req.nextUrl.searchParams.get(key);
  if (raw == null) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

/** Parse a JSON body, answering with a problem document when it is malformed. */
export async function readJson<T>(req: Request): Promise<{ body: T } | { error: Response }> {
  try {
    const text = await req.text();
    if (!text) return { body: {} as T };
    return { body: JSON.parse(text) as T };
  } catch {
    return { error: problem(400, "Bad request", "Request body is not valid JSON") };
  }
}
