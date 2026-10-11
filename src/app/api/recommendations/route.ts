import { buildDigest } from "@/lib/digest";
import { errorResponse, guard, json } from "@/lib/api";

export const maxDuration = 120;

// Generates (and caches) Gemini WATCH/SKIP opinions for the current digest. Failures are reported, never hidden.
export async function POST() {
  try {
    const g = await guard();
    if ("res" in g) return g.res;
    const d = await buildDigest(g.user.id, { ai: "generate" });
    const entries = [...d.personalized.entries, ...d.filters.entries];
    const have = new Set(entries.filter((e) => e.rec).map((e) => e.releaseId));
    const total = new Set(entries.map((e) => e.releaseId)).size;
    const message = d.aiError ? `${d.aiError}. ${have.size}/${total} have AI opinions.` : `AI opinions ready for ${have.size} of ${total} titles.`;
    return json({ ok: !d.aiError, message }, d.aiError ? 502 : 200);
  } catch (e) {
    return errorResponse(e);
  }
}
