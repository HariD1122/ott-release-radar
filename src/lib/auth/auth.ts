// Authentication: Argon2id PIN hashes, server-side sessions (row in DB + signed HTTP-only cookie),
// failed-login lockout. Nothing here is ever sent to the browser except the opaque session cookie.
import argon2 from "argon2";
import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { q } from "../db";
import { requireEnv } from "../env";

export const COOKIE = "ott_session";
const SESSION_DAYS = 7;
const MAX_FAILS = 5;
const LOCK_MINUTES = 15;

export interface SessionUser {
  id: string;
  loginId: string;
  displayName: string;
}

export const normalizeLoginId = (s: string) => s.trim().replace(/\s+/g, " ").toUpperCase();

const secretKey = () => new TextEncoder().encode(requireEnv("SESSION_SECRET"));

export const hashPin = (pin: string) => argon2.hash(pin, { type: argon2.argon2id });

export function validatePinFormat(pin: string): string | null {
  return /^\d{4,12}$/.test(pin) ? null : "PIN must be 4 to 12 digits.";
}

/** Single-owner app: the PIN alone signs in the one active account (the login ID is never shown). */
export async function loginOwner(pin: string, ip: string | null): Promise<LoginResult> {
  const rows = await q<{ login_id: string }>("SELECT login_id FROM users WHERE status = 'active' ORDER BY created_at LIMIT 1");
  if (!rows[0]) return { ok: false, error: "Invalid PIN." };
  const r = await login(rows[0].login_id, pin, ip);
  return r.ok ? r : { ...r, error: r.error.replace("login ID or PIN", "PIN") };
}

export type LoginResult =
  | { ok: true; token: string; expires: Date }
  | { ok: false; error: string; locked?: boolean };

export async function login(rawLoginId: string, pin: string, ip: string | null): Promise<LoginResult> {
  const loginId = normalizeLoginId(rawLoginId);
  // Housekeeping: drop expired sessions and old attempts so these tables never grow without bound.
  await q("DELETE FROM sessions WHERE expires_at < now()");
  await q("DELETE FROM login_attempts WHERE created_at < now() - interval '2 days'");
  const fails = await q<{ n: number }>(
    `SELECT count(*)::int AS n FROM login_attempts
     WHERE login_id = $1 AND succeeded = false AND created_at > now() - make_interval(mins => $2)`,
    [loginId, LOCK_MINUTES],
  );
  if (fails[0].n >= MAX_FAILS) {
    return { ok: false, locked: true, error: `Too many failed attempts. Try again in ${LOCK_MINUTES} minutes.` };
  }
  const rows = await q<{ id: string; pin_hash: string; status: string }>(
    "SELECT id, pin_hash, status FROM users WHERE login_id = $1",
    [loginId],
  );
  const user = rows[0];
  // Hash even for unknown users so response time does not reveal whether the ID exists.
  const valid = user
    ? await argon2.verify(user.pin_hash, pin).catch(() => false)
    : await DUMMY_HASH.then((h) => argon2.verify(h, pin)).catch(() => false);
  if (!user || !valid || user.status !== "active") {
    await q("INSERT INTO login_attempts (login_id, ip, succeeded) VALUES ($1,$2,false)", [loginId, ip]);
    await new Promise((r) => setTimeout(r, 600 + fails[0].n * 400)); // slow down guessing
    return { ok: false, error: "Invalid login ID or PIN." };
  }
  await q("INSERT INTO login_attempts (login_id, ip, succeeded) VALUES ($1,$2,true)", [loginId, ip]);
  await q("DELETE FROM login_attempts WHERE login_id = $1 AND succeeded = false", [loginId]);
  await q("UPDATE users SET last_login_at = now() WHERE id = $1", [user.id]);
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  const s = await q<{ id: string }>(
    "INSERT INTO sessions (user_id, expires_at) VALUES ($1,$2) RETURNING id",
    [user.id, expires],
  );
  const token = await new SignJWT({ sid: s[0].id })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expires)
    .sign(secretKey());
  return { ok: true, token, expires };
}

// Real Argon2id hash of a throwaway string, used only to equalise timing for unknown login IDs.
const DUMMY_HASH = argon2.hash("timing-equaliser", { type: argon2.argon2id });

export async function setSessionCookie(token: string, expires: Date) {
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

async function sessionIdFromCookie(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    return typeof payload.sid === "string" ? payload.sid : null;
  } catch {
    return null;
  }
}

export async function getUser(): Promise<SessionUser | null> {
  const sid = await sessionIdFromCookie();
  if (!sid) return null;
  const rows = await q<{ id: string; login_id: string; display_name: string | null }>(
    `SELECT u.id, u.login_id, u.display_name FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = $1 AND s.expires_at > now() AND u.status = 'active'`,
    [sid],
  );
  return rows[0] ? { id: rows[0].id, loginId: rows[0].login_id, displayName: rows[0].display_name || rows[0].login_id } : null;
}

/** For pages and layouts: redirects to /login when not signed in. */
export async function requireUser(): Promise<SessionUser> {
  const u = await getUser();
  if (!u) redirect("/login");
  return u;
}

export async function logout() {
  const sid = await sessionIdFromCookie();
  if (sid) await q("DELETE FROM sessions WHERE id = $1", [sid]);
  (await cookies()).delete(COOKIE);
}

export async function changePin(userId: string, current: string, next: string): Promise<string | null> {
  const bad = validatePinFormat(next);
  if (bad) return bad;
  const rows = await q<{ pin_hash: string }>("SELECT pin_hash FROM users WHERE id = $1", [userId]);
  if (!rows[0] || !(await argon2.verify(rows[0].pin_hash, current).catch(() => false))) {
    return "Current PIN is incorrect.";
  }
  await q("UPDATE users SET pin_hash = $2, updated_at = now() WHERE id = $1", [userId, await hashPin(next)]);
  // Sign out every other device after a PIN change.
  const sid = await sessionIdFromCookie();
  await q("DELETE FROM sessions WHERE user_id = $1 AND id <> $2", [userId, sid ?? "00000000-0000-0000-0000-000000000000"]);
  return null;
}

/** Light CSRF defence for state-changing API calls (cookies are also SameSite=Lax). */
export async function sameOrigin(): Promise<boolean> {
  const h = await headers();
  const origin = h.get("origin");
  if (!origin) return true; // non-browser clients / same-origin GETs
  const host = h.get("x-forwarded-host") ?? h.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}
