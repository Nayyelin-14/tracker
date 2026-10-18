import { PROVIDER_CATALOG } from "@/lib/demo/insight";

/** Providers with a usable key in this deployment. Static on purpose — the
 *  catalog never varies per visitor, so it can ship as a prerendered response. */
export async function GET() {
  return Response.json(PROVIDER_CATALOG);
}
