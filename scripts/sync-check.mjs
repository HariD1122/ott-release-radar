// Compares GitHub, Vercel and Neon. Usage: VT=<vercel token> GH=<github token> node --env-file=.env.local scripts/sync-check.mjs
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
const team = "team_eo8454HDlT2j1yAUXIUzF5lw", proj = "prj_jCToq0AayLU6UHKQlzCftbj1AK8y";
const vh = { headers: { Authorization: `Bearer ${process.env.VT}` } };
let bad = 0;
const row = (ok, name, extra = "") => { if (!ok) bad++; console.log(ok ? "SYNCED " : "MISMATCH", name, extra); };
const h = (s) => createHash("sha256").update(s ?? "").digest("hex").slice(0, 10);

// 1. code: local == GitHub == Vercel production
const local = execSync("git rev-parse HEAD").toString().trim();
const dirty = execSync("git status --porcelain").toString().trim();
const gh = (await (await fetch("https://api.github.com/repos/HariD1122/ott-release-radar/commits/main", { headers: { Authorization: `Bearer ${process.env.GH}`, "User-Agent": "sync" } })).json()).sha;
const dep = (await (await fetch(`https://api.vercel.com/v6/deployments?projectId=${proj}&teamId=${team}&limit=1&target=production`, vh)).json()).deployments[0];
row(!dirty, "no uncommitted local changes");
row(local === gh, "local commit == GitHub main", `${local.slice(0, 7)} / ${gh.slice(0, 7)}`);
row(dep.state === "READY" && dep.meta?.githubCommitSha === gh, "Vercel production == GitHub main", `${dep.meta?.githubCommitSha?.slice(0, 7)} ${dep.state}`);

// 2. database schema == migrations in the repo
const sql = neon(process.env.DATABASE_URL);
const applied = (await sql.query("select name from schema_migrations order by name")).map((r) => r.name);
const files = readdirSync("db/migrations").filter((f) => f.endsWith(".sql")).sort();
row(JSON.stringify(applied) === JSON.stringify(files), "Neon migrations == repo migrations", applied.join(", "));
const cols = (await sql.query("select column_name from information_schema.columns where table_name='releases'")).map((r) => r.column_name);
for (const c of ["vote_count", "backdrop_url", "platform_status", "release_date_type"]) row(cols.includes(c), `releases.${c} exists`);
const ucols = (await sql.query("select column_name from information_schema.columns where table_name='users'")).map((r) => r.column_name);
row(ucols.includes("display_name"), "users.display_name exists");

// 3. Vercel env == local env (compared by hash; values never printed)
const envs = (await (await fetch(`https://api.vercel.com/v10/projects/${proj}/env?teamId=${team}`, vh)).json()).envs;
for (const k of ["DATABASE_URL", "TMDB_ACCESS_TOKEN", "RAPIDAPI_KEY", "RAPIDAPI_HOST", "GEMINI_API_KEY", "GEMINI_MODEL", "TELEGRAM_BOT_TOKEN", "CRON_SECRET", "SESSION_SECRET"]) {
  const e = envs.find((x) => x.key === k);
  if (!e) { row(false, `Vercel env ${k}`, "missing"); continue; }
  const v = (await (await fetch(`https://api.vercel.com/v1/projects/${proj}/env/${e.id}?teamId=${team}`, vh)).json()).value;
  row(h(v) === h(process.env[k]), `Vercel env ${k} == local`, (e.target ?? []).join("+"));
}
console.log(bad ? `\n${bad} mismatch(es)` : "\nEverything in sync");
