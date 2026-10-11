// End-to-end check against the deployed site. Usage: node --env-file=.env.local scripts/prod-test.mjs <baseUrl> [--send]
const base = process.argv[2];
const send = process.argv.includes("--send");
const pin = process.env.SEED_PIN;
let pass = 0, failed = 0;
const ok = (name, cond, extra = "") => { (cond ? pass++ : failed++); console.log(cond ? "PASS" : "FAIL", name, extra); };

let r = await fetch(base + "/login"); let t = await r.text();
ok("login page: PIN only, no login ID", r.status === 200 && /Enter your PIN/.test(t) && !/Login ID/i.test(t));
r = await fetch(base, { redirect: "manual" }); ok("home redirects to /login when signed out", r.status === 307 || r.status === 302);
r = await fetch(base + "/api/preferences"); ok("API rejects signed-out request", r.status === 401);
r = await fetch(base + "/api/cron/digest"); ok("cron digest rejects missing secret", r.status === 401);
r = await fetch(base + "/api/cron/digest", { headers: { authorization: "Bearer wrong" } }); ok("cron digest rejects wrong secret", r.status === 401);
r = await fetch(base + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json", origin: base }, body: JSON.stringify({ pin: "0000" }) });
ok("wrong PIN rejected", r.status === 401);
r = await fetch(base + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json", origin: base }, body: JSON.stringify({ pin }) });
ok("PIN-only login", r.status === 200);
const cookie = (r.headers.getSetCookie()[0] || "").split(";")[0];
const H = { cookie, "content-type": "application/json", origin: base };
r = await fetch(base + "/api/preferences", { method: "POST", headers: H }); ok("cross-site style POST on read route not allowed", r.status === 405);

for (const p of ["/", "/new", "/movies", "/series", "/episodes", "/watchlist", "/digest", "/profile", "/settings"]) {
  r = await fetch(base + p, { headers: { cookie }, redirect: "manual" }); t = await r.text();
  ok(`page ${p}`, r.status === 200 && /Harikrishnan D/.test(t), `status ${r.status}`);
  if (["/", "/movies", "/series", "/new"].includes(p)) ok(`  ${p} cards show synopsis line`, /Synopsis not available|min-h-\[2\.1rem\]/.test(t));
}

const prefs = await (await fetch(base + "/api/preferences", { headers: { cookie } })).json();
console.log("INFO saved filters:", JSON.stringify(prefs.preferences));
r = await fetch(base + "/api/preferences", { method: "PUT", headers: H, body: JSON.stringify(prefs.preferences) });
const again = await r.json(); ok("preferences save + read-back identical", r.status === 200 && JSON.stringify(again.preferences) === JSON.stringify(prefs.preferences));

const dg = await (await fetch(base + "/api/digest", { headers: { cookie } })).json();
const entries = [...dg.digest.personalized.entries, ...dg.digest.filters.entries];
ok("digest preview has both categories", Array.isArray(dg.digest.personalized.entries) && Array.isArray(dg.digest.filters.entries), `personalized=${dg.digest.personalized.entries.length} filters=${dg.digest.filters.entries.length} matched=${dg.digest.matchCount}/${dg.digest.eligibleCount}`);
ok("digest entries carry runtime/episodes + synopsis fields", entries.every((e) => "runtimeMinutes" in e && "episodeInfo" in e && "synopsis" in e));
// Only touch a title that has NO existing feedback / watchlist state, so real user data is never altered.
const sample = entries.find((e) => dg.digest.cards[e.releaseId].feedback === null && !dg.digest.cards[e.releaseId].in_watchlist);
if (sample) {
  // feedback + watchlist round trip on a real release, then restore
  const id = sample.releaseId;
  let f = await (await fetch(base + "/api/feedback", { method: "POST", headers: H, body: JSON.stringify({ releaseId: id, value: "like" }) })).json();
  ok("like saved", f.feedback === "like");
  f = await (await fetch(base + "/api/feedback", { method: "POST", headers: H, body: JSON.stringify({ releaseId: id, value: "dislike" }) })).json();
  ok("dislike replaces like", f.feedback === "dislike");
  f = await (await fetch(base + "/api/feedback", { method: "POST", headers: H, body: JSON.stringify({ releaseId: id, value: "dislike" }) })).json();
  ok("same click removes feedback", f.feedback === null);
  let w = await (await fetch(base + "/api/watchlist", { method: "POST", headers: H, body: JSON.stringify({ releaseId: id, on: true }) })).json();
  const wl = await (await fetch(base + "/watchlist", { headers: { cookie } })).text();
  ok("watchlist add shows on watchlist page", w.on === true && wl.includes(sample.title.replace(/&/g, "&amp;")));
  w = await (await fetch(base + "/api/watchlist", { method: "POST", headers: H, body: JSON.stringify({ releaseId: id, on: false }) })).json();
  ok("watchlist remove", w.on === false);
}

r = await fetch(base + "/api/recommendations", { method: "POST", headers: H }); const rec = await r.json();
ok("Gemini recommendations", r.status === 200 && rec.ok, rec.message);

if (send) {
  r = await fetch(base + "/api/telegram/test", { method: "POST", headers: H }); const tt = await r.json(); ok("Telegram test message", tt.ok, tt.message);
  r = await fetch(base + "/api/cron/collect", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }); const col = await r.json();
  ok("cron collect (real run)", col.ok, JSON.stringify({ status: col.result?.status, fetched: col.result?.fetched, updated: col.result?.updated, rapid: col.result?.rapidapiCalls, errors: col.result?.errors?.slice(0, 2) }));
  r = await fetch(base + "/api/digest/send", { method: "POST", headers: H }); const man = await r.json();
  ok("MANUAL digest to Telegram", man.ok, JSON.stringify(man.outcome));
  r = await fetch(base + "/api/cron/digest", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }); const auto = await r.json();
  ok("AUTOMATIC (cron) digest to Telegram", auto.ok, JSON.stringify(auto.outcome));
  r = await fetch(base + "/api/cron/digest", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }); const dup = await r.json();
  ok("second automatic run is skipped (no duplicate)", dup.outcome?.status === "skipped", dup.outcome?.message);
}
console.log(`\n${pass} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
