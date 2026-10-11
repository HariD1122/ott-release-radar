// Shared helpers for route handlers: authentication, same-origin check, JSON errors, cron secret.
import { timingSafeEqual } from "node:crypto";
import { q } from "./db";
import { ConfigError } from "./env";
import { getUser, sameOrigin, type SessionUser } from "./auth/auth";

export const json = (data: unknown, status = 200) => Response.json(data, { status });
export const fail = (error: string, status = 400) => json({ ok: false, error }, status);

/** Returns the signed-in user, or a Response to return immediately (401 / 403). */
export async function guard(): Promise<{ user: SessionUser } | { res: Response }> {
  if (!(await sameOrigin())) return { res: fail("Cross-site request blocked.", 403) };
  const user = await getUser();
  if (!user) return { res: fail("Not signed in.", 401) };
  return { user };
}

export function errorResponse(e: unknown): Response {
  if (e instanceof ConfigError) return fail(e.message, 500);
  console.error("API error:", (e as Error).message); // message only: never log secrets or request bodies
  return fail("Something went wrong on the server. Please try again.", 500);
}

export function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("authorization") ?? "";
  if (!secret) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function ownerId(): Promise<string | null> {
  const r = await q<{ id: string }>("SELECT id FROM users WHERE status='active' ORDER BY created_at LIMIT 1");
  return r[0]?.id ?? null;
}
