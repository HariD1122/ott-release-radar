import { buildDigest } from "@/lib/digest";
import { errorResponse, guard, json } from "@/lib/api";

export const maxDuration = 30;

// Website preview: same buildDigest() the Telegram senders use.
export async function GET() {
  try {
    const g = await guard();
    if ("res" in g) return g.res;
    return json({ ok: true, digest: await buildDigest(g.user.id) });
  } catch (e) {
    return errorResponse(e);
  }
}
