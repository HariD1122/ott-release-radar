// Read-only audit of the Neon database + live checks of every external service. Prints results; changes nothing.
import { q } from "../src/lib/db";

const out = (ok: boolean, name: string, extra = "") => console.log(ok ? "PASS" : "FAIL", name, extra);

const expected = ["users","sessions","login_attempts","user_preferences","releases","watchlist","user_title_feedback","followed_series","recommendations","digest_history","collection_job_history","telegram_settings","schema_migrations"];
const tables = (await q<{ t: string }>("select table_name t from information_schema.tables where table_schema='public'")).map((r) => r.t);
for (const t of expected) out(tables.includes(t), `table ${t}`);
out(true, "migrations applied", (await q<{ name: string }>("select name from schema_migrations order by name")).map((r) => r.name).join(", "));

const n = async (sql: string) => Number((await q<{ n: number }>(sql))[0].n);
out(await n("select count(*)::int n from users where status='active'") === 1, "exactly one active user");
out(await n("select count(*)::int n from users where pin_hash not like '$argon2id$%'") === 0, "all PIN hashes are Argon2id");
out(await n("select count(*)::int n from users where display_name is null") === 0, "display name set");
out(await n("select count(*)::int n from user_preferences") === 1, "preferences row exists");
console.log("INFO releases", await n("select count(*)::int n from releases"), "| by type:", JSON.stringify(await q("select content_type, count(*)::int n from releases group by 1")));
out(await n("select count(*)::int n from (select provider_key from releases group by 1 having count(*)>1) x") === 0, "no duplicate releases");
out(await n("select count(*)::int n from releases where release_date is null") === 0, "every release has a date");
out(await n("select count(*)::int n from releases where release_date_type not in ('ott_digital_in','tv_season_air_date','tv_episode_air_date')") === 0, "no theatrical/unknown date types stored");
out(await n("select count(*)::int n from releases where title is null or title=''") === 0, "no empty titles");
out(await n("select count(*)::int n from releases where content_type='episode' and (season_number is null or episode_number is null)") === 0, "episodes have season+episode numbers");
out(await n("select count(*)::int n from releases where platform_status<>'unknown' and cardinality(platforms)=0 and platform_status<>'rapidapi_only'") === 0, "platform status consistent with platforms");
console.log("INFO platform status:", JSON.stringify(await q("select platform_status, count(*)::int n from releases group by 1 order by 2 desc")));
out(await n("select count(*)::int n from user_title_feedback f left join releases r on r.id=f.release_id where r.id is null") === 0, "no orphan feedback");
out(await n("select count(*)::int n from watchlist w left join releases r on r.id=w.release_id where r.id is null") === 0, "no orphan watchlist");
out(await n("select count(*)::int n from recommendations x left join releases r on r.id=x.release_id where r.id is null") === 0, "no orphan recommendations");
const idx = (await q<{ i: string }>("select indexname i from pg_indexes where schemaname='public'")).map((r) => r.i);
for (const i of ["digest_history_idem_idx","releases_date_idx","user_title_feedback_user_id_release_id_key"]) out(idx.includes(i), `index ${i}`);
out(await n("select count(*)::int n from information_schema.table_constraints where constraint_type='CHECK' and table_name='user_title_feedback'") > 0, "feedback value CHECK constraint");
console.log("INFO sessions", await n("select count(*)::int n from sessions"), "(expired:", await n("select count(*)::int n from sessions where expires_at<now()"), ") | login_attempts", await n("select count(*)::int n from login_attempts"));
console.log("INFO digest history:", JSON.stringify(await q("select trigger_type, status, personalized_count p, filter_count f, total_unique t, attempt_count a, started_at from digest_history order by started_at desc limit 6")));
console.log("INFO collection history:", JSON.stringify(await q("select status, records_fetched f, records_updated u, rapidapi_calls r, started_at from collection_job_history order by started_at desc limit 3")));
console.log("INFO telegram chat configured:", !!(await q<{ chat_id: string }>("select chat_id from telegram_settings where id=1"))[0]?.chat_id);

// live services
const t0 = Date.now(); await q("select 1"); out(true, "Neon round trip", `${Date.now() - t0} ms`);
let r = await fetch("https://api.themoviedb.org/3/configuration", { headers: { Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}` } }); out(r.ok, "TMDB live", String(r.status));
r = await fetch("https://ott-details.p.rapidapi.com/gettitleDetails?imdbid=tt0111161", { headers: { "x-rapidapi-key": process.env.RAPIDAPI_KEY!, "x-rapidapi-host": "ott-details.p.rapidapi.com" } }); out(r.ok, "RapidAPI live", `${r.status}, quota left ${r.headers.get("x-ratelimit-requests-remaining")}`);
r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + process.env.GEMINI_MODEL, { headers: { "x-goog-api-key": process.env.GEMINI_API_KEY! } }); out(r.ok, "Gemini model available", `${process.env.GEMINI_MODEL} ${r.status}`);
const me = await (await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`)).json(); out(me.ok, "Telegram bot", me.result?.username);
process.exit(0);
