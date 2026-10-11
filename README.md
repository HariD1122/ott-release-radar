# OTT Release Radar — Version 12

> **Database:** this project uses **Neon PostgreSQL** (not Supabase). Connection is the `DATABASE_URL` environment variable; tables are created by `npm run db:migrate`.

A private, single-owner web app that collects new OTT releases for India, ranks them two independent ways, and sends a categorised weekly digest to Telegram (automatically every Friday 6:00 PM IST, or on demand).

Stack: Next.js (App Router, TypeScript) · Tailwind · Neon PostgreSQL · TMDB + RapidAPI OTT Details · Gemini Flash · Telegram Bot API · Vercel.

## How the data sources are used (verified, not assumed)

| Source | What it really provides | What we use it for |
|---|---|---|
| **TMDB** | India **digital (type 4)** release date per movie, TV season/episode `air_date`, genres, languages, posters, India watch providers | Shortlisting releases, dates, genres, languages, platform evidence |
| **RapidAPI OTT Details** | `/gettitleDetails?imdbid=` → India streaming platforms (`streamingAvailability.country.IN`). `released` is a **year only**; no OTT date, no episodes | Second opinion on **which platform** carries a title in India |
| **Gemini Flash** | Opinions only | WATCH/SKIP + short reason. Never a source of facts |

Platform status per release: `confirmed_both` (TMDB and RapidAPI agree), `tmdb_only`, `rapidapi_only`, or `unknown` (shown as "Platform not confirmed").

## Weekly window and date rules

* Window = previous Friday **6:01 PM IST** through Friday **6:00 PM IST**, inclusive, in `Asia/Kolkata` (fixed UTC+05:30). Code: `src/lib/time/window.ts`.
* TMDB gives **calendar dates, not times**. A date-only release dated *D* belongs to the window where `previousFriday < D <= closingFriday`, so each date falls in exactly one window. These are always labelled "date only" and never presented as an exact time. Records with an exact timestamp (none from current sources) would be compared to the minute.
* Theatrical dates are never used; fetch/insert dates are never used as release dates; unknown dates are excluded.
* Digests always use the **latest completed window** (closing Friday 6:00 PM IST at or before "now"). A manual send on Wednesday therefore sends last Friday's completed window; the Home "New This Week" row and `New Releases → This week so far` show the in-progress window.
* Episodes of the same season are grouped into one digest entry ("Season 2 – Episodes 5–7"). A season premiere in the window is one "New season/series" entry instead of one entry per episode.

## Two independent recommendation lists

* **Personalized for You** (`rankPersonalized`): saved genres/languages/platforms/types + Like/Dislike history + recency. Transparent rules, not a trained model. Feedback only counts once there are 3+ reactions, and weights are shrunk so one reaction cannot swing results. Directly disliked titles are dropped from this list. Needs a genre match or positive feedback signal.
* **Recommended for Your Filters** (`rankForFilters`): explicit filters only (AND across genre/language/platform/type, OR within each), newest release first. The function takes **no feedback argument**, so Like/Dislike cannot change or hide anything here. Disliked titles stay visible.

## Project layout / Components Map

```
USER ──> Next.js website (src/app)
 ├─ /login → src/lib/auth/auth.ts  (Argon2id, DB sessions, signed HTTP-only cookie, lockout)
 ├─ proxy.ts  (cookie-presence redirect) + requireUser()/guard() (real checks)
 ├─ Pages: Home, New Releases, Movies, Series, Episodes, Watchlist, Weekly Digest, Profile (permanent filters), Settings, Title detail
 ├─ API routes (src/app/api): feedback, watchlist, follow, preferences, collect, recommendations,
 │      digest (preview), digest/send (MANUAL), telegram/test|detect, cron/collect, cron/digest (AUTOMATIC)
 └─ Services (src/lib)
     ├─ providers/tmdb.ts, providers/rapidapi.ts   verified adapters + validation
     ├─ collect.ts          TMDB shortlist → upsert → RapidAPI India check → job history
     ├─ time/window.ts      weekly window + isEligible (the ONLY eligibility logic)
     ├─ catalogue.ts        search/filters, preferences, watchlist, feedback, follows
     ├─ ranking.ts          rankPersonalized / rankForFilters
     ├─ gemini.ts           validated WATCH/SKIP opinions, cached in `recommendations`
     ├─ digest.ts           buildDigest(): the ONE two-category generator (website + Telegram)
     ├─ telegram.ts         HTML formatter, message splitting, sender
     └─ deliver.ts          deliverDigest('automatic' | 'manual'): idempotency, history, retries
NEON POSTGRES: users, sessions, login_attempts, user_preferences, releases, watchlist,
 user_title_feedback, followed_series, recommendations, digest_history, collection_job_history, telegram_settings
```

Automatic and manual delivery are separate entry points with separate idempotency keys (`auto:<window end>` vs `manual:<window end>:<30 s bucket>`) and share `buildDigest()` + the Telegram sender. Manual send never starts a collection and never touches automatic state.

## Local setup (beginner steps)

1. Install Node 20+ and run `npm install`.
2. Copy `.env.example` to `.env.local` and fill in every value (see below).
3. Create the database tables: `npm run db:migrate`
4. Create your account once (the site signs in with the PIN only; the login ID is internal): set `SEED_LOGIN_ID` and `SEED_PIN` in `.env.local`, then `npm run db:seed`. Re-running never changes an existing account or PIN. Change the PIN later in **Settings**. Afterwards you can delete `SEED_PIN` from `.env.local`.
5. Fetch data: `npm run collect` (or the **Refresh Data** button). The first run takes ~2 minutes.
6. Start the app: `npm run dev`, open http://localhost:3000.

### Environment variables

| Name | Where to get it |
|---|---|
| `DATABASE_URL` | Neon → your project → Connection string (pooled) |
| `TMDB_ACCESS_TOKEN` | themoviedb.org → Settings → API → "API Read Access Token" |
| `RAPIDAPI_KEY`, `RAPIDAPI_HOST` | RapidAPI → OTT details → your key. Basic plan is tiny (~100 calls); `RAPIDAPI_MAX_CALLS_PER_RUN` caps use per run |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Google AI Studio. Models are listed by `GET https://generativelanguage.googleapis.com/v1beta/models`; `gemini-2.5-flash` was rejected for new users, `gemini-3.8-flash` works |
| `TELEGRAM_BOT_TOKEN` | Telegram → @BotFather → your bot |
| `SESSION_SECRET`, `CRON_SECRET` | any long random string: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

Never commit `.env.local`. Never prefix secrets with `NEXT_PUBLIC_`.

### Telegram setup

1. Create a bot with @BotFather and put its token in `TELEGRAM_BOT_TOKEN`.
2. Open the bot in Telegram, press **Start**, send any message.
3. In the app: **Settings → Detect my chat**, then **Send test message**. Success is only shown after Telegram confirms.

### Testing the two triggers

* Manual: **Send This Week's List Now** (Home or Weekly Digest). Uses already-collected data. The result is shown next to the button. Every send is still recorded in the `digest_history` table (used for duplicate protection); the website no longer displays that history.
* Automatic (simulate locally):
  ```bash
  curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/digest
  ```
  Calling it twice for the same window returns "already delivered" (no duplicate message). A failed delivery is retried on the next call.

## Tests

`npm test` runs unit tests (window boundaries, eligibility, ranking independence, digest + Telegram splitting/escaping, Gemini validation) and **integration tests against your real Neon DB** with a throw-away user (Argon2 hash, login normalisation, lockout, seed doesn't overwrite PIN, feedback toggle, watchlist/preferences, automatic idempotency, manual independence, failure + retry). Telegram, Gemini and collection are mocked in those tests, so nothing is sent. `npm run typecheck` and `npx next build` must also pass.

## Deploy to Vercel

1. Push to GitHub (private repo): `git init`, `git add .`, `git commit`, add remote, `git push`.
2. Vercel → Add New Project → import the repo.
3. Add every variable from `.env.example` under Settings → Environment Variables (except the SEED ones). Run `npm run db:migrate` locally against the same Neon database first.
4. Deploy. `vercel.json` registers two crons:
   * `/api/cron/collect` daily at `30 6 * * *` UTC (12:00 PM IST): refreshes data.
   * `/api/cron/digest` at `30 12 * * 5` UTC = **Friday 6:00 PM IST**.
   Vercel sends `Authorization: Bearer $CRON_SECRET` automatically when `CRON_SECRET` is set.
5. Verify in Vercel → Project → Cron Jobs (use "Run" once), then check your Telegram chat (and the `digest_history` table in Neon).

**Plan limits (verify for your plan):** on Vercel's free Hobby plan cron jobs may run only once per day and can fire anywhere within the scheduled hour, so "exactly 6:00 PM" is not guaranteed there; a Pro plan gives per-minute precision. Because the digest window is computed as "latest closing Friday 6:00 PM IST at or before now", a late run still produces the correct window. Collection can take up to ~2 minutes; the routes set `maxDuration = 300`, which your plan must allow.

## Known limitations

* TMDB provides **date-only** release dates; exact-minute eligibility is impossible with the current sources. Date-only releases are labelled as such.
* TV air dates are TMDB's general air dates, not India-specific. TV titles are only collected when TMDB lists a flatrate India provider among the major platforms in `collect.ts`.
* TMDB watch providers show *current* availability, not "since when".
* RapidAPI Basic plan: ~1 request/second and a small quota, so only recent titles are checked, cached 7 days. It has no episode or OTT date data.
* Episode tracking depends on TMDB season data; not every show is covered.
* "Indie Drama" is not a TMDB genre; it is covered by Drama. "Disney+ Hotstar" is now JioHotstar.
* Gemini opinions are cached per user/title and regenerated when metadata, preferences or feedback counts change; generation is triggered by Telegram sends or the "Generate AI recommendations" button, not by page views.
* A full week can be ~7 Telegram messages when many titles match; nothing is dropped, and each part keeps its category heading.

## Manual testing checklist

- [ ] Wrong PIN shows a generic error; correct login works; logout then visiting `/` redirects to `/login`
- [ ] Profile page: genres/platforms/languages save, show "confirmed in your database", and survive logout/login on another device
- [ ] Like → Dislike replaces → click again clears; same title stays in sync across both columns
- [ ] Watchlist add/remove persists after reload
- [ ] Search (header) and filters (Movies, Series, Episodes, New Releases) change results
- [ ] Weekly Digest shows both categories; Telegram message has the same two categories and counts
- [ ] Refresh Data reports real counts; Send This Week's List Now does not start a collection
- [ ] Test message succeeds only when Telegram confirms

## Security notes

Secrets are server-side only; PINs are Argon2id-hashed; sessions are DB-backed (logout revokes); failed logins lock out after 5 attempts for 15 minutes; state-changing routes check same-origin; cron routes require `CRON_SECRET`. Rotate any key that has ever been pasted into chat or a ticket.

## Version 12 changelog (final)

* Permanent multi-select filters (profile) drive New Releases, the dashboard and the Telegram digest.
* Profile page (display name, genres, OTT platforms, languages, types) with database read-back confirmation.
* PIN-only sign-in, azure blue theme.
* Every Telegram entry and web card shows runtime or episode count and a two-line synopsis.
* Fixed: title detail page crashed (client helper called from a server page); RapidAPI parsing of foreign-country entries; filter bar re-saving on load; old /preferences link now redirects server-side.
* RapidAPI quota protection (default 5 calls per run, 5 calls kept in reserve, titles with unknown platforms checked first); expired sessions and old login attempts are cleaned automatically.
* Test tooling: `npm test` (53 tests), `scripts/audit.mts` (database + live service audit), `scripts/deep-test.mjs` and `scripts/prod-test.mjs` (end-to-end checks against a deployed URL).
