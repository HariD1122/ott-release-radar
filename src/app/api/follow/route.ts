import { z } from "zod";
import { setFollow } from "@/lib/catalogue";
import { errorResponse, fail, guard, json } from "@/lib/api";

const Body = z.object({ seriesTmdbId: z.number().int(), title: z.string().min(1).max(200), on: z.boolean() });

export async function POST(req: Request) {
  try {
    const g = await guard();
    if ("res" in g) return g.res;
    const body = Body.safeParse(await req.json().catch(() => null));
    if (!body.success) return fail("Invalid request.");
    await setFollow(g.user.id, body.data.seriesTmdbId, body.data.title, body.data.on);
    return json({ ok: true, on: body.data.on });
  } catch (e) {
    return errorResponse(e);
  }
}
