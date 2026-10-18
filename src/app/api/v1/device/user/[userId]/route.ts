import type { NextRequest } from "next/server";
import { notFound, parseId } from "@/lib/demo/http";
import { DEMO_USER_ID } from "@/lib/demo/seed";
import { readState } from "@/lib/demo/state";
import { resolveDevices } from "@/lib/demo/store";

type Ctx = { params: Promise<Record<string, string>> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const userId = parseId((await ctx.params).userId);
  if (userId !== DEMO_USER_ID) return notFound(`No user with id ${userId}`);
  const state = await readState();
  return Response.json(resolveDevices(state));
}
