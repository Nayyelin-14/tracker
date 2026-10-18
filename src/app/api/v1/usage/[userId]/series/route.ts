import type { NextRequest } from "next/server";
import { intQuery, notFound, parseId } from "@/lib/demo/http";
import { DEMO_USER_ID } from "@/lib/demo/seed";
import { readState } from "@/lib/demo/state";
import { usageSeries } from "@/lib/demo/store";

type Ctx = { params: Promise<Record<string, string>> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const userId = parseId((await ctx.params).userId);
  if (userId !== DEMO_USER_ID) return notFound(`No usage for user ${userId}`);

  const days = intQuery(req, "days", 7, 1, 90);
  const raw = req.nextUrl.searchParams.get("interval");
  const interval = raw === "day" ? "day" : "hour";

  const state = await readState();
  return Response.json(usageSeries(state, days, interval));
}
