import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// First line of defence only: send visitors without a session cookie to /login.
// The real checks (signature, expiry, revocation) happen server-side in requireUser()/guard().
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const open = pathname === "/login" || pathname.startsWith("/api/auth/login") || pathname.startsWith("/api/cron/");
  if (!open && !req.cookies.get("ott_session")) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
