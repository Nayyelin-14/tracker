import type { NextRequest } from "next/server";
import { notFound, parseId } from "@/lib/demo/http";
import { buildSavingTips } from "@/lib/demo/insight";
import { resolveSelection, throttled } from "@/lib/demo/insight-route";
import { DEMO_USER_ID } from "@/lib/demo/seed";
import { readState } from "@/lib/demo/state";
import { usageStats } from "@/lib/demo/store";

type Ctx = { params: Promise<Record<string, string>> };

const encoder = new TextEncoder();

/** Split into word-boundary pieces small enough to feel token-by-token. */
function chunkText(text: string, target = 30): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    let end = Math.min(text.length, i + target);
    if (end < text.length) {
      const slice = text.slice(i, end);
      const lastSpace = slice.lastIndexOf(" ");
      if (lastSpace > target * 0.35) end = i + lastSpace + 1;
    }
    out.push(text.slice(i, end));
    i = end;
  }
  return out;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * `GET /insight/saving-tips/stream/:userId` — SSE.
 *
 * Frame order matches the contract the dashboard parses:
 * `meta` → N × `text {delta}` → `usage` → exactly one `done`, then close.
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  const userId = parseId((await ctx.params).userId);
  if (userId !== DEMO_USER_ID) return notFound(`No usage for user ${userId}`);

  const blocked = throttled();
  if (blocked) return blocked;

  const { provider, model, days } = resolveSelection(req);
  const state = await readState();
  const stats = usageStats(state, days);
  const text = buildSavingTips(stats);

  let cancelled = false;
  req.signal.addEventListener("abort", () => {
    cancelled = true;
  });

  const started = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown): boolean => {
        if (cancelled) return false;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          return true;
        } catch {
          cancelled = true;
          return false;
        }
      };

      try {
        if (!send("meta", { userId, type: "SAVING_TIPS", provider, model, cached: false })) return;
        await sleep(140);

        for (const piece of chunkText(text)) {
          if (!send("text", { delta: piece })) return;
          await sleep(20 + Math.floor(Math.random() * 22));
        }

        send("usage", {
          provider,
          model,
          promptTokens: 214,
          completionTokens: Math.max(1, Math.round(text.length / 4)),
          totalTokens: 214 + Math.max(1, Math.round(text.length / 4)),
          latencyMs: Date.now() - started,
        });
        send("done", { tips: text });
      } catch {
        send("error", { message: "Generation interrupted", partial: true });
      } finally {
        if (!cancelled) {
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
