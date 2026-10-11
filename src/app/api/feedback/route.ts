import { z } from "zod";
import { toggleFeedback } from "@/lib/catalogue";
import { errorResponse, fail, guard, json } from "@/lib/api";

const Body = z.object({ releaseId: z.string().uuid(), value: z.enum(["like", "dislike"]) });

export async function POST(req: Request) {
  try {
    const g = await guard();
    if ("res" in g) return g.res;
    const body = Body.safeParse(await req.json().catch(() => null));
    if (!body.success) return fail("Invalid request.");
    const feedback = await toggleFeedback(g.user.id, body.data.releaseId, body.data.value);
    return json({ ok: true, feedback });
  } catch (e) {
    return errorResponse(e);
  }
}
