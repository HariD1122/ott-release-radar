import { z } from "zod";
import { setWatchlist } from "@/lib/catalogue";
import { errorResponse, fail, guard, json } from "@/lib/api";

const Body = z.object({ releaseId: z.string().uuid(), on: z.boolean() });

export async function POST(req: Request) {
  try {
    const g = await guard();
    if ("res" in g) return g.res;
    const body = Body.safeParse(await req.json().catch(() => null));
    if (!body.success) return fail("Invalid request.");
    await setWatchlist(g.user.id, body.data.releaseId, body.data.on);
    return json({ ok: true, on: body.data.on });
  } catch (e) {
    return errorResponse(e);
  }
}
