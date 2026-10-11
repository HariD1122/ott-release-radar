import { cronAuthorized, fail, json, ownerId, errorResponse } from "@/lib/api";
import { deliverDigest } from "@/lib/deliver";

export const maxDuration = 300;

// Vercel Cron calls this with "Authorization: Bearer <CRON_SECRET>". Schedule: see vercel.json.
// Independent of the manual button: separate idempotency key, never touches manual state.
export async function GET(req: Request) {
  try {
    if (!cronAuthorized(req)) return fail("Unauthorized", 401);
    const id = await ownerId();
    if (!id) return fail("No active user", 500);
    const outcome = await deliverDigest("automatic", id);
    return json({ ok: outcome.status !== "failed", outcome }, outcome.status === "failed" ? 502 : 200);
  } catch (e) {
    return errorResponse(e);
  }
}
