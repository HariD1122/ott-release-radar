import { logout, sameOrigin } from "@/lib/auth/auth";
import { errorResponse, fail, json } from "@/lib/api";

export async function POST() {
  try {
    if (!(await sameOrigin())) return fail("Cross-site request blocked.", 403);
    await logout();
    return json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
