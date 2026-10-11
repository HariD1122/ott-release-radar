import { cronAuthorized, errorResponse, fail, json } from "@/lib/api";
import { runCollection } from "@/lib/collect";

export const maxDuration = 300;

// Daily data refresh (separate job from digest delivery).
export async function GET(req: Request) {
  try {
    if (!cronAuthorized(req)) return fail("Unauthorized", 401);
    const r = await runCollection();
    return json({ ok: r.status !== "failed", result: r });
  } catch (e) {
    return errorResponse(e);
  }
}
