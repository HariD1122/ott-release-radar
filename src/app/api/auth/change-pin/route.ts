import { z } from "zod";
import { changePin } from "@/lib/auth/auth";
import { errorResponse, fail, guard, json } from "@/lib/api";

const Body = z.object({ current: z.string().min(1).max(20), next: z.string().min(1).max(20) });

export async function POST(req: Request) {
  try {
    const g = await guard();
    if ("res" in g) return g.res;
    const body = Body.safeParse(await req.json().catch(() => null));
    if (!body.success) return fail("Enter your current and new PIN.");
    const err = await changePin(g.user.id, body.data.current, body.data.next);
    return err ? fail(err) : json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
