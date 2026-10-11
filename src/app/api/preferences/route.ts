import { z } from "zod";
import { getPrefs, prefsUpdatedAt, savePrefs } from "@/lib/catalogue";
import { errorResponse, fail, guard, json } from "@/lib/api";

const list = z.array(z.string().min(1).max(60)).max(60);
const Body = z.object({
  genres: list,
  languages: list,
  platforms: list,
  contentTypes: z.array(z.enum(["movie", "series", "season", "episode"])),
});

export async function GET() {
  const g = await guard();
  if ("res" in g) return g.res;
  return json({ ok: true, preferences: await getPrefs(g.user.id), updatedAt: await prefsUpdatedAt(g.user.id) });
}

export async function PUT(req: Request) {
  try {
    const g = await guard();
    if ("res" in g) return g.res;
    const body = Body.safeParse(await req.json().catch(() => null));
    if (!body.success) return fail("Invalid preferences.");
    await savePrefs(g.user.id, body.data);
    // Read back from the database so the client can show what is really stored.
    return json({ ok: true, preferences: await getPrefs(g.user.id), updatedAt: await prefsUpdatedAt(g.user.id) });
  } catch (e) {
    return errorResponse(e);
  }
}
