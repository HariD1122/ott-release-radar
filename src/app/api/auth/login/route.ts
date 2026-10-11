import { z } from "zod";
import { clientIp, login, sameOrigin, setSessionCookie } from "@/lib/auth/auth";
import { errorResponse, fail, json } from "@/lib/api";

const Body = z.object({ loginId: z.string().min(1).max(60), pin: z.string().min(1).max(20) });

export async function POST(req: Request) {
  try {
    if (!(await sameOrigin())) return fail("Cross-site request blocked.", 403);
    const body = Body.safeParse(await req.json().catch(() => null));
    if (!body.success) return fail("Enter your login ID and PIN.");
    const r = await login(body.data.loginId, body.data.pin, await clientIp());
    if (!r.ok) return fail(r.error, r.locked ? 429 : 401);
    await setSessionCookie(r.token, r.expires);
    return json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
