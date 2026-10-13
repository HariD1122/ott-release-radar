// Deep production test (no Telegram sends). Usage: VT=<vercel token> node --env-file=.env.local scripts/deep-test.mjs <baseUrl>
import { execSync } from "node:child_process";
const base = process.argv[2];
const pin = process.env.SEED_PIN;
let pass = 0, failed = 0;
const ok = (name, cond, extra = "") => { (cond ? pass++ : failed++); console.log(cond ? "PASS" : "FAIL", name, extra); };
const jpost = (path, cookie, body, method = "POST") =>
  fetch(base + path, { method, headers: { cookie, "content-type": "application/json", origin: base }, body: body === undefined ? undefined : JSON.stringify(body) });

// ---- deployment / config ----
if (process.env.VT) {
  const vh = { headers: { Authorization: `Bearer ${process.env.VT}` } };
  const team = "team_eo8454HDlT2j1yAUXIUzF5lw", proj = "prj_jCToq0AayLU6UHKQlzCftbj1AK8y";
  const dep = (await (await fetch(`https://api.vercel.com/v6/deployments?projectId=${proj}&teamId=${team}&limit=1`, vh)).json()).deployments[0];
  const head = execSync("git rev-parse HEAD").toString().trim();
  ok("Vercel production deployment is READY", dep.state === "READY", dep.state);
  ok("Vercel is running the latest GitHub commit", dep.meta?.githubCommitSha === head, `${dep.meta?.githubCommitSha?.slice(0, 7)} vs ${head.slice(0, 7)}`);
  const full = await (await fetch(`https://api.vercel.com/v13/deployments/${dep.uid}?teamId=${team}`, vh)).json();
  const crons = (full.crons ?? []).map((c) => `${c.path} ${c.schedule}`);
  ok("cron: Friday 6:00 PM IST digest (30 12 * * 5)", crons.includes("/api/cron/digest 30 12 * * 5"), crons.join(" | "));
  ok("cron: daily collection", crons.some((c) => c.startsWith("/api/cron/collect")));
  const envs = (await (await fetch(`https://api.vercel.com/v10/projects/${proj}/env?teamId=${team}`, vh)).json()).envs.map((e) => e.key);
  for (const k of ["DATABASE_URL", "TMDB_ACCESS_TOKEN", "RAPIDAPI_KEY", "RAPIDAPI_HOST", "GEMINI_API_KEY", "GEMINI_MODEL", "TELEGRAM_BOT_TOKEN", "CRON_SECRET", "SESSION_SECRET"]) ok(`Vercel env ${k}`, envs.includes(k));
  ok("no secrets exposed as NEXT_PUBLIC_*", !envs.some((k) => k.startsWith("NEXT_PUBLIC_")));
}

// ---- security ----
let r = await fetch(base + "/login");
const loginHtml = await r.text();
ok("no secret values in page source", !/(AQ\.Ab8|npg_[A-Za-z0-9]{8}|8890026064|vcp_[A-Za-z0-9]{20}|ghp_[A-Za-z0-9]{20}|nsk_live)/.test(loginHtml));
for (const p of ["/api/collect", "/api/digest/send", "/api/telegram/test", "/api/recommendations", "/api/feedback", "/api/watchlist"]) {
  r = await fetch(base + p, { method: "POST", headers: { origin: base } });
  ok(`signed-out POST ${p} -> 401`, r.status === 401);
}
r = await fetch(base + "/api/cron/collect");
ok("cron collect needs secret", r.status === 401);
r = await jpost("/api/auth/login", "", { pin });
const c1 = (r.headers.getSetCookie()[0] || "").split(";")[0];
ok("login ok", r.status === 200);
r = await fetch(base + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json", origin: "https://evil.example" }, body: JSON.stringify({ pin }) });
ok("cross-site login blocked", r.status === 403);
r = await fetch(base + "/api/feedback", { method: "POST", headers: { cookie: c1, "content-type": "application/json", origin: "https://evil.example" }, body: JSON.stringify({ releaseId: "x", value: "like" }) });
ok("cross-site state change blocked", r.status === 403);
r = await jpost("/api/feedback", c1, { releaseId: "not-a-uuid", value: "like" });
ok("invalid input rejected", r.status === 400);
r = await jpost("/api/preferences", c1, { genres: "x" }, "PUT");
ok("invalid preferences rejected", r.status === 400);

// session revocation
r = await jpost("/api/auth/login", "", { pin });
const c2 = (r.headers.getSetCookie()[0] || "").split(";")[0];
ok("session works before logout", (await fetch(base + "/api/preferences", { headers: { cookie: c2 } })).status === 200);
await jpost("/api/auth/logout", c2);
ok("session dead after logout (server-side revoke)", (await fetch(base + "/api/preferences", { headers: { cookie: c2 } })).status === 401);
r = await fetch(base + "/", { headers: { cookie: c2 }, redirect: "manual" });
ok("old cookie redirected to /login", r.status === 307 || r.status === 302);

// ---- filters -> digest interconnection (restores original filters) ----
const cookie = c1;
const orig = (await (await fetch(base + "/api/preferences", { headers: { cookie } })).json()).preferences;
try {
  const set = async (p) => (await jpost("/api/preferences", cookie, p, "PUT")).json();
  const digest = async () => (await (await fetch(base + "/api/digest", { headers: { cookie } })).json()).digest;
  await set({ genres: [], languages: [], platforms: [], contentTypes: [] });
  const all = await digest();
  ok("no filters -> everything eligible is matched", all.matchCount === all.eligibleCount, `${all.matchCount}/${all.eligibleCount}`);
  await set({ genres: ["Drama"], languages: [], platforms: [], contentTypes: [] });
  const dr = await digest();
  ok("genre filter narrows digest; every entry has that genre", dr.matchCount < all.matchCount && dr.filters.entries.every((e) => e.genres.includes("Drama")), `${dr.matchCount}`);
  await set({ genres: ["Drama"], languages: ["Hindi"], platforms: ["JioHotstar"], contentTypes: ["episode"] });
  const multi = await digest();
  ok("genre+language+platform+type all enforced", multi.filters.entries.every((e) => e.genres.includes("Drama") && e.languages.includes("Hindi") && e.platforms.includes("JioHotstar") && e.typeLabel === "New episode"), `${multi.filters.entries.length} entries`);
  await set({ genres: ["Drama", "Thriller"], languages: ["Hindi", "English"], platforms: [], contentTypes: ["movie", "season"] });
  const ms = await digest();
  ok("multi-select (ANY within a filter)", ms.filters.entries.every((e) => e.genres.some((g) => ["Drama", "Thriller"].includes(g)) && e.languages.some((l) => ["Hindi", "English"].includes(l))), `${ms.filters.entries.length} entries`);
  const newPage = (await (await fetch(base + "/new?w=completed", { headers: { cookie } })).text()).replace(/<!-- -->/g, "");
  ok("New Releases page reflects the saved filters", new RegExp(`>${ms.matchCount}</span><span[^>]*>match your filters`).test(newPage), `expects ${ms.matchCount}`);
  ok("personalized entries are a subset of the filter-matching set", ms.personalized.entries.every((e) => ms.filters.entries.some((f) => f.releaseId === e.releaseId)));
  ok("matched never exceeds eligible", ms.eligibleCount >= ms.matchCount);
} finally {
  const back = await jpost("/api/preferences", cookie, orig, "PUT").then((x) => x.json());
  ok("original filters restored exactly", JSON.stringify(back.preferences) === JSON.stringify(orig), JSON.stringify(back.preferences));
}

// ---- window + digest sanity ----
const d = (await (await fetch(base + "/api/digest", { headers: { cookie } })).json()).digest;
ok("window boundaries are Friday 18:01 / 18:00 IST", /T12:30:00\.000Z$/.test(d.window.end) && /T12:31:00\.000Z$/.test(d.window.start), `${d.window.start} -> ${d.window.end}`);
ok("window is exactly 7 days minus 1 minute", new Date(d.window.end) - new Date(d.window.start) === 7 * 864e5 - 60e3);
console.log("INFO digest:", `eligible ${d.eligibleCount}, matching ${d.matchCount}, personalized ${d.personalized.entries.length}, filters ${d.filters.entries.length}`);

// ---- INDIA OTT RULE: nothing without a confirmed India streaming platform is shown or recommended ----
{
  const digestNow = (await (await fetch(base + "/api/digest", { headers: { cookie } })).json()).digest;
  const entriesNow = [...digestNow.personalized.entries, ...digestNow.filters.entries];
  ok("every digest entry has a confirmed India platform", entriesNow.every((e) => e.platforms.length > 0), `${entriesNow.length} entries`);
  for (const p of ["/", "/new?w=completed", "/movies", "/series", "/episodes"]) {
    const h = await (await fetch(base + p, { headers: { cookie } })).text();
    ok(`${p} never shows "Platform not confirmed"`, !h.includes("Platform not confirmed"));
  }
  if (process.env.DATABASE_URL) {
    const { neon } = await import("@neondatabase/serverless");
    const hidden = await neon(process.env.DATABASE_URL).query("select id from releases where content_type = 'movie' and cardinality(platforms) = 0 limit 1");
    if (hidden[0]) {
      const page = await (await fetch(`${base}/title/${hidden[0].id}`, { headers: { cookie } })).text();
      ok("a title not streaming in India cannot be opened", /could not be found/i.test(page) && !/Date meaning/.test(page));
    }
  }
}

// ---- pages, titles, robustness ----
const pages = [
  ["/", "titles collected"], ["/new", "match your filters"], ["/new?w=completed", "match your filters"], ["/movies", "Streaming now on Indian platforms"],
  ["/series", "New series and seasons streaming in India"], ["/episodes", "Episode Updates"], ["/watchlist", "My Watchlist"], ["/digest", "Personalized for You"],
  ["/profile", "My Profile"], ["/settings", "Settings & Telegram"],
];
for (const [p, marker] of pages) {
  const s0 = Date.now();
  r = await fetch(base + p, { headers: { cookie }, redirect: "follow" });
  const html = (await r.text()).replace(/<!-- -->/g, "").replace(/&amp;/g, "&");
  ok(`page ${p} renders real content`, r.status === 200 && html.includes(marker) && !/Something went wrong|NEXT_NOT_FOUND/.test(html), `${r.status} ${Date.now() - s0} ms`);
}
r = await fetch(base + "/preferences", { headers: { cookie }, redirect: "manual" });
ok("old /preferences link redirects to /profile", [301, 302, 307, 308].includes(r.status) && (r.headers.get("location") ?? "").endsWith("/profile"), String(r.status));
{
  const home = await (await fetch(base + "/", { headers: { cookie } })).text();
  const slideCount = (home.match(/aria-roledescription="slide"/g) || []).length;
  ok("hero carousel has 5 to 10 slides", slideCount >= 5 && slideCount <= 10, `${slideCount} slides`);
  ok("cards are fixed-size and carry no synopsis block", /h-\[376px\]/.test(home) && !/Synopsis not available/.test(home));
}
const ids = [...d.filters.entries, ...d.personalized.entries].slice(0, 3).map((e) => e.releaseId);
for (const id of ids) {
  r = await fetch(`${base}/title/${id}`, { headers: { cookie } });
  const h = await r.text();
  ok("title detail page renders", r.status === 200 && /Date meaning/.test(h) && !/NEXT_NOT_FOUND/.test(h), id.slice(0, 8));
}
r = await fetch(`${base}/title/00000000-0000-0000-0000-000000000000`, { headers: { cookie } });
ok("unknown title shows not-found", r.status === 404 || /could not be found/i.test(await r.text()));
r = await fetch(`${base}/does-not-exist`, { headers: { cookie } });
ok("unknown page -> 404", r.status === 404);
r = await fetch(base + "/movies?q=" + encodeURIComponent("%'; DROP TABLE releases;--"), { headers: { cookie } });
ok("SQL-injection style search is harmless", r.status === 200);
r = await fetch(base + "/api/preferences", { headers: { cookie } });
ok("DB still intact after injection attempt", r.status === 200);
await jpost("/api/auth/logout", cookie);
console.log(`\n${pass} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
