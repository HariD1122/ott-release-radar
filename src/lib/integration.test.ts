// Integration tests against the real Neon database using a throw-away user. Telegram, Gemini and
// collection are mocked: nothing is sent and no external API is called. Skipped without DATABASE_URL.
import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const sendMessages = vi.fn();
const runCollection = vi.fn();
vi.mock("./telegram", async (orig) => ({ ...(await orig<typeof import("./telegram")>()), sendMessages }));
vi.mock("./gemini", () => ({ ensureRecommendations: async () => ({ recs: new Map(), error: "mocked" }) }));
vi.mock("./collect", () => ({ runCollection }));

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("database integration", () => {
  let q: typeof import("./db").q;
  let auth: typeof import("./auth/auth");
  let cat: typeof import("./catalogue");
  let deliver: typeof import("./deliver");
  const loginId = `ITEST ${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
  let userId = "";
  let releaseId = "";
  // A window far in the past so it can never collide with real digest rows.
  const past = new Date("2020-01-10T13:00:00Z");

  beforeAll(async () => {
    ({ q } = await import("./db"));
    auth = await import("./auth/auth");
    cat = await import("./catalogue");
    deliver = await import("./deliver");
    const hash = await auth.hashPin("4321");
    const u = await q<{ id: string }>("INSERT INTO users (login_id, pin_hash) VALUES ($1,$2) RETURNING id", [loginId, hash]);
    userId = u[0].id;
    const r = await q<{ id: string }>(
      `INSERT INTO releases (provider_key, tmdb_id, title, content_type, genres, languages, platforms, release_date,
         release_date_type, verification_status) VALUES ($1, 1, 'ITEST Movie', 'movie', '{Thriller}', '{Hindi}', '{Netflix}',
         '2020-01-08', 'ott_digital_in', 'date_only') RETURNING id`,
      [`itest:${loginId}`],
    );
    releaseId = r[0].id;
    await cat.savePrefs(userId, { genres: ["Thriller"], languages: ["Hindi"], platforms: ["Netflix"], contentTypes: ["movie"] });
  });

  afterAll(async () => {
    await q("DELETE FROM digest_history WHERE window_end < '2021-01-01'");
    await q("DELETE FROM releases WHERE provider_key = $1", [`itest:${loginId}`]);
    await q("DELETE FROM releases WHERE provider_key LIKE $1", [`itest-feat:${loginId}:%`]);
    await q("DELETE FROM login_attempts WHERE login_id = $1", [loginId]);
    await q("DELETE FROM users WHERE id = $1", [userId]);
  });

  it("stores the PIN as an Argon2id hash, never plaintext", async () => {
    const [row] = await q<{ pin_hash: string }>("SELECT pin_hash FROM users WHERE id=$1", [userId]);
    expect(row.pin_hash).toMatch(/^\$argon2id\$/);
    expect(row.pin_hash).not.toContain("4321");
  });

  it("logs in with a normalised login ID and rejects a wrong PIN", async () => {
    const ok = await auth.login(`  ${loginId.toLowerCase()}  `, "4321", "127.0.0.1");
    expect(ok.ok).toBe(true);
    const bad = await auth.login(loginId, "0000", "127.0.0.1");
    expect(bad).toMatchObject({ ok: false });
    if (!bad.ok) expect(bad.error).toBe("Invalid login ID or PIN.");
  });

  it("locks out after repeated failures", async () => {
    let last: Awaited<ReturnType<typeof auth.login>> | null = null;
    for (let i = 0; i < 6; i++) last = await auth.login(loginId, "1111", null);
    expect(last).toMatchObject({ ok: false, locked: true });
    await q("DELETE FROM login_attempts WHERE login_id = $1", [loginId]);
  }, 120_000);

  it("seeding again does not overwrite an existing PIN", async () => {
    const [{ pin_hash: before }] = await q<{ pin_hash: string }>("SELECT pin_hash FROM users WHERE id=$1", [userId]);
    execSync("npx tsx scripts/seed.mts", {
      env: { ...process.env, SEED_LOGIN_ID: loginId, SEED_PIN: "9999" },
      stdio: "pipe",
    });
    const [{ pin_hash: after }] = await q<{ pin_hash: string }>("SELECT pin_hash FROM users WHERE id=$1", [userId]);
    expect(after).toBe(before);
  });

  it("feedback: like, replace with dislike, click again removes; one row per user+title", async () => {
    expect(await cat.toggleFeedback(userId, releaseId, "like")).toBe("like");
    expect(await cat.toggleFeedback(userId, releaseId, "dislike")).toBe("dislike");
    const rows = await q("SELECT 1 FROM user_title_feedback WHERE user_id=$1 AND release_id=$2", [userId, releaseId]);
    expect(rows).toHaveLength(1);
    expect(await cat.toggleFeedback(userId, releaseId, "dislike")).toBeNull();
    expect(await q("SELECT 1 FROM user_title_feedback WHERE user_id=$1", [userId])).toHaveLength(0);
  });

  it("watchlist persists and survives a preference change", async () => {
    await cat.setWatchlist(userId, releaseId, true);
    await cat.savePrefs(userId, { genres: ["Comedy"], languages: [], platforms: [], contentTypes: ["movie"] });
    const list = await cat.listReleases(userId, { watchlistOnly: true });
    expect(list.map((r) => r.id)).toContain(releaseId);
    await cat.setWatchlist(userId, releaseId, false);
    expect(await cat.listReleases(userId, { watchlistOnly: true })).toHaveLength(0);
    await cat.savePrefs(userId, { genres: ["Thriller"], languages: ["Hindi"], platforms: ["Netflix"], contentTypes: ["movie"] });
  });

  it("search finds collected titles and ignores LIKE wildcards in input", async () => {
    expect((await cat.listReleases(userId, { search: "itest mov" })).length).toBe(1);
    expect(await cat.listReleases(userId, { search: "%%%zzz" })).toHaveLength(0);
  });

  it("multi-select filters: ANY within a dimension, ALL across; platform needs a confirmed match", async () => {
    const n = async (f: Parameters<typeof cat.listReleases>[1]) => (await cat.listReleases(userId, { search: "itest mov", ...f })).length;
    expect(await n({ genres: ["Comedy", "Thriller"] })).toBe(1);
    expect(await n({ genres: ["Comedy"] })).toBe(0);
    expect(await n({ genres: ["Thriller"], languages: ["Tamil", "Hindi"], platforms: ["Zee5", "Netflix"] })).toBe(1);
    expect(await n({ genres: ["Thriller"], platforms: ["Zee5"] })).toBe(0);
  });

  it("saved filters persist across a new session (read back from the database)", async () => {
    await cat.savePrefs(userId, { genres: ["Drama", "Thriller"], languages: ["Hindi", "Tamil"], platforms: ["Netflix"], contentTypes: ["movie", "series"] });
    const again = await cat.getPrefs(userId);
    expect(again).toEqual({ genres: ["Drama", "Thriller"], languages: ["Hindi", "Tamil"], platforms: ["Netflix"], contentTypes: ["movie", "series"] });
    await cat.savePrefs(userId, { genres: ["Thriller"], languages: ["Hindi"], platforms: ["Netflix"], contentTypes: ["movie"] });
  });

  it("hero carousel: top-rated new movies/series, never episodes, always 5 to 10", async () => {
    const key = (n: string) => `itest-feat:${loginId}:${n}`;
    const ins = (n: string, title: string, type: string, date: string, rating: number | null) =>
      q(
        `INSERT INTO releases (provider_key, tmdb_id, title, content_type, season_number, episode_number, backdrop_url, release_date,
           release_date_type, verification_status, vote_average, vote_count) VALUES ($1, 9, $2, $3, $4, $5, 'https://x/y.jpg', $6, 'ott_digital_in', 'date_only', $7, 100)`,
        [key(n), title, type, type === "episode" ? 1 : null, type === "episode" ? 1 : null, date, rating],
      );
    // 12 recent movies rated 5.0 .. 9.5, a 9.9-rated episode (must be excluded), a duplicate title
    for (let i = 0; i < 12; i++) await ins(`m${i}`, `ITF Movie ${i}`, "movie", "2020-06-25", 5 + i * 0.4);
    await ins("ep", "ITF Episode", "episode", "2020-06-25", 9.9);
    await ins("dup", "ITF Movie 11", "season", "2020-06-26", 9.4);
    const top = await cat.featuredReleases(userId, "2020-06-30");
    expect(top.length).toBeGreaterThanOrEqual(5);
    expect(top.length).toBeLessThanOrEqual(10);
    expect(top.map((r) => r.title)).not.toContain("ITF Episode");
    const ratings = top.map((r) => Number(r.vote_average));
    expect(ratings).toEqual([...ratings].sort((a, b) => b - a));
    expect(new Set(top.map((r) => r.title)).size).toBe(top.length);
    expect(top[0].title).toBe("ITF Movie 11");

    // A single 10/10 vote must not beat a well-voted title.
    await ins("lucky", "ITF One Vote", "movie", "2020-06-25", 10);
    await q("UPDATE releases SET vote_count = 1 WHERE provider_key = $1", [key("lucky")]);
    expect((await cat.featuredReleases(userId, "2020-06-30"))[0].title).toBe("ITF Movie 11");

    // Only 3 titles in the 14-day window: the carousel is topped up to at least 5 from older releases.
    const sparse = await cat.featuredReleases(userId, "2020-07-20");
    expect(sparse.length).toBeGreaterThanOrEqual(5);
    expect(sparse.length).toBeLessThanOrEqual(10);
  });

  it("automatic delivery is idempotent; manual is independent; failures are recorded; no collection runs", async () => {
    sendMessages.mockResolvedValue({ ok: true, sent: 1, total: 1 });
    const a1 = await deliver.deliverDigest("automatic", userId, past);
    expect(a1.status).toBe("sent");
    expect(a1.eligible).toBe(1); // the 2020-01-08 release is inside the 2020-01-03..2020-01-10 window
    expect(a1.personalized).toBe(1);
    expect(a1.filters).toBe(1);
    const a2 = await deliver.deliverDigest("automatic", userId, past);
    expect(a2.status).toBe("skipped"); // duplicate scheduled run
    expect(sendMessages).toHaveBeenCalledTimes(1);

    const m1 = await deliver.deliverDigest("manual", userId, past);
    expect(m1.status).toBe("sent"); // manual still works after the automatic one
    const m2 = await deliver.deliverDigest("manual", userId, past);
    expect(m2.status).toBe("skipped"); // accidental double click within 30s
    expect(runCollection).not.toHaveBeenCalled();
  });

  it("a failed automatic send is logged as failed and retried on the same row", async () => {
    const later = new Date("2020-01-17T13:00:00Z");
    sendMessages.mockResolvedValueOnce({ ok: false, sent: 0, total: 1, error: "Bad Request: chat not found" });
    const f = await deliver.deliverDigest("automatic", userId, later);
    expect(f.status).toBe("failed");
    const [row] = await q<{ status: string; error_summary: string }>("SELECT status, error_summary FROM digest_history WHERE id=$1", [f.digestId]);
    expect(row).toMatchObject({ status: "failed", error_summary: "Bad Request: chat not found" });

    sendMessages.mockResolvedValueOnce({ ok: true, sent: 1, total: 1 });
    const retry = await deliver.deliverDigest("automatic", userId, later);
    expect(retry.status).toBe("sent");
    const [after] = await q<{ attempt_count: number; status: string }>("SELECT attempt_count, status FROM digest_history WHERE id=$1", [f.digestId]);
    expect(after).toEqual({ attempt_count: 2, status: "sent" });
  });
});
