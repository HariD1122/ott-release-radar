import { z } from "zod";
import { q } from "@/lib/db";
import { errorResponse, fail, guard, json } from "@/lib/api";

const Body = z.object({ displayName: z.string().trim().min(1).max(60) });

export async function PUT(req: Request) {
  try {
    const g = await guard();
    if ("res" in g) return g.res;
    const body = Body.safeParse(await req.json().catch(() => null));
    if (!body.success) return fail("Enter a name (1-60 characters).");
    const r = await q<{ display_name: string }>("UPDATE users SET display_name=$2, updated_at=now() WHERE id=$1 RETURNING display_name", [g.user.id, body.data.displayName]);
    return json({ ok: true, displayName: r[0].display_name });
  } catch (e) {
    return errorResponse(e);
  }
}
