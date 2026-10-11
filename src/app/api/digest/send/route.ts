import { deliverDigest } from "@/lib/deliver";
import { errorResponse, guard, json } from "@/lib/api";

export const maxDuration = 120;

// Manual "Send This Week's List Now". Uses already-collected data; never starts a collection.
export async function POST() {
  try {
    const g = await guard();
    if ("res" in g) return g.res;
    const outcome = await deliverDigest("manual", g.user.id);
    return json({ ok: outcome.status === "sent", outcome }, outcome.status === "failed" ? 502 : 200);
  } catch (e) {
    return errorResponse(e);
  }
}
