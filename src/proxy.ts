import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Open access: no sign-in required. The old /login page just sends visitors to the home page.
export function proxy(req: NextRequest) {
  if (req.nextUrl.pathname === "/login") return NextResponse.redirect(new URL("/", req.url));
  return NextResponse.next();
}

export const config = { matcher: ["/login"] };
