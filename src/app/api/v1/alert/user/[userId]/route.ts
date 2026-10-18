import type { NextRequest } from "next/server";
import { intQuery, notFound, parseId } from "@/lib/demo/http";
import { DEMO_USER_ID } from "@/lib/demo/seed";
import { readState } from "@/lib/demo/state";
import { alerts } from "@/lib/demo/store";

type Ctx = { params: Promise<Record<string, string>> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const userId = parseId((await ctx.params).userId);
  if (userId !== DEMO_USER_ID) return notFound(`No alerts for user ${userId}`);

  const limit = req.nextUrl.searchParams.has("limit")
    ? intQuery(req, "limit", 100, 1, 500)
    : undefined;

  const state = await readState();
  return Response.json(alerts(state, limit));
}
