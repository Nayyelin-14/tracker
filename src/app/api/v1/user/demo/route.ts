import { readState } from "@/lib/demo/state";
import { resolveUser } from "@/lib/demo/store";

/** The dashboard resolves the shared demo account once on mount. */
export async function GET() {
  const state = await readState();
  return Response.json(resolveUser(state));
}
