import type { NextRequest } from "next/server";
import { notFound, parseId } from "@/lib/demo/http";
import { buildSavingTips, insightDto } from "@/lib/demo/insight";
import { resolveSelection, throttled } from "@/lib/demo/insight-route";
import { DEMO_USER_ID } from "@/lib/demo/seed";
import { readState } from "@/lib/demo/state";
import { usageStats } from "@/lib/demo/store";

type Ctx = { params: Promise<Record<string, string>> };

/** `GET /insight/saving-tips/:userId` — one-shot JSON, no streaming. */
export async function GET(req: NextRequest, ctx: Ctx) {
  const userId = parseId((await ctx.params).userId);
  if (userId !== DEMO_USER_ID) return notFound(`No usage for user ${userId}`);

  const blocked = throttled();
  if (blocked) return blocked;

  const { provider, model, days } = resolveSelection(req);
  const state = await readState();
  const stats = usageStats(state, days);
  const tips = buildSavingTips(stats);

  return Response.json(
    insightDto(userId, "SAVING_TIPS", tips, stats, provider, model, 480 + Math.round(tips.length / 3)),
  );
}
