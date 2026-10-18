import type { NextRequest } from "next/server";
import { notFound, parseId } from "@/lib/demo/http";
import { buildOverview, insightDto } from "@/lib/demo/insight";
import { resolveSelection, throttled } from "@/lib/demo/insight-route";
import { DEMO_USER_ID } from "@/lib/demo/seed";
import { readState } from "@/lib/demo/state";
import { usageStats } from "@/lib/demo/store";

type Ctx = { params: Promise<Record<string, string>> };

/** `GET /insight/overview/:userId` — single JSON payload, no streaming. */
export async function GET(req: NextRequest, ctx: Ctx) {
  const userId = parseId((await ctx.params).userId);
  if (userId !== DEMO_USER_ID) return notFound(`No usage for user ${userId}`);

  const blocked = throttled();
  if (blocked) return blocked;

  const { provider, model, days } = resolveSelection(req);
  const state = await readState();
  const stats = usageStats(state, days);
  const text = buildOverview(stats);

  return Response.json(
    insightDto(userId, "OVERVIEW", text, stats, provider, model, 310 + Math.round(text.length / 3)),
  );
}
