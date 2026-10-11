import { runCollection } from "@/lib/collect";
import { errorResponse, guard, json } from "@/lib/api";

export const maxDuration = 300;

// Protected "Refresh Data" action. Collection only; it never sends a digest.
export async function POST() {
  try {
    const g = await guard();
    if ("res" in g) return g.res;
    const r = await runCollection();
    return json({ ok: r.status !== "failed", result: r });
  } catch (e) {
    return errorResponse(e);
  }
}
