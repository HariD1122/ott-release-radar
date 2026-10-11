// Release collection: TMDB shortlists releases (title, date, genre, language, India providers),
// RapidAPI then confirms India platform availability. Runs separately from digest delivery.
import { q } from "./db";
import { PlatformDetail, mergePlatforms, rapidToDetails } from "./platforms";
import { RapidRateLimited, indiaAvailability } from "./providers/rapidapi";
import {
  TmdbWatch, discoverMovies, discoverTv, img, movieDetails, tvDetails, tvSeason,
} from "./providers/tmdb";
import { canonicalPlatform, languageName, normalizeGenres } from "./taxonomy";
import { toIstDate } from "./time/window";

// TMDB watch-provider ids: Netflix, Prime Video, JioHotstar, Zee5, Sony LIV, Apple TV+, Lionsgate Play, Aha, SunNXT.
const TV_PROVIDER_IDS = "8|119|2336|232|237|350|561|532|309";
const MAX_PAGES = 5;
const MAX_SERIES = 60;
const QUOTA_RESERVE = 5; // never spend the last RapidAPI calls automatically

interface ReleaseRow {
  provider_key: string;
  tmdb_id: number;
  imdb_id: string | null;
  title: string;
  content_type: "movie" | "series" | "season" | "episode";
  series_tmdb_id: number | null;
  season_number: number | null;
  episode_number: number | null;
  episode_title: string | null;
  synopsis: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
  genres: string[];
  languages: string[];
  tmdb_platforms: PlatformDetail[];
  release_date: string;
  release_at: string | null;
  release_precision: "date" | "datetime";
  release_date_type: string;
  verification_status: "verified" | "date_only";
  release_note: string | null;
  runtime_minutes: number | null;
  episode_count: number | null;
  vote_average: number | null;
  source_url: string;
}

export interface CollectionResult {
  jobId: string;
  status: "success" | "partial" | "failed";
  fetched: number;
  inserted: number;
  updated: number;
  rejected: number;
  rapidapiCalls: number;
  errors: string[];
}

function tmdbPlatforms(w: TmdbWatch | undefined): PlatformDetail[] {
  const inn = w?.results?.IN;
  if (!inn) return [];
  const out: PlatformDetail[] = [];
  const add = (list: { provider_name: string }[] | undefined, kind: PlatformDetail["kind"]) =>
    list?.forEach((p) => out.push({ name: canonicalPlatform(p.provider_name).name, kind, source: "tmdb", url: inn.link }));
  add(inn.flatrate, "subscription");
  add(inn.ads, "free_ads");
  add(inn.rent, "rent");
  add(inn.buy, "buy");
  return out;
}

function langs(d: { original_language?: string; spoken_languages?: { english_name: string }[] }): string[] {
  const set = new Set<string>();
  const o = languageName(d.original_language);
  if (o) set.add(o);
  d.spoken_languages?.forEach((l) => set.add(l.english_name));
  return [...set];
}

async function pages<T extends { id: number }>(fetchPage: (p: number) => Promise<{ results: T[]; total_pages: number }>) {
  const ids: number[] = [];
  for (let p = 1; p <= MAX_PAGES; p++) {
    const r = await fetchPage(p);
    ids.push(...r.results.map((x) => x.id));
    if (p >= r.total_pages) break;
  }
  return ids;
}

async function inBatches<T>(items: T[], size: number, fn: (x: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn));
}

async function collectMovies(from: string, to: string, rows: ReleaseRow[], errors: string[]) {
  const ids = await pages((p) => discoverMovies(from, to, p));
  await inBatches(ids, 5, async (id) => {
    try {
      const m = await movieDetails(id);
      // Only the India DIGITAL (type 4) entry counts. Theatrical entries are never used.
      const digital = m.release_dates?.results
        .find((r) => r.iso_3166_1 === "IN")
        ?.release_dates.filter((d) => d.type === 4)
        .sort((a, b) => a.release_date.localeCompare(b.release_date))[0];
      if (!digital) return;
      const when = new Date(digital.release_date);
      const exact = !digital.release_date.includes("T00:00:00");
      const release_date = exact ? toIstDate(when) : digital.release_date.slice(0, 10);
      if (release_date < from || release_date > to) return;
      rows.push({
        provider_key: `tmdb:movie:${m.id}`,
        tmdb_id: m.id,
        imdb_id: m.imdb_id || null,
        title: m.title,
        content_type: "movie",
        series_tmdb_id: null,
        season_number: null,
        episode_number: null,
        episode_title: null,
        synopsis: m.overview || null,
        poster_url: img(m.poster_path, "w500"),
        backdrop_url: img(m.backdrop_path, "w1280"),
        genres: normalizeGenres(m.genres?.map((g) => g.name) ?? []),
        languages: langs(m),
        tmdb_platforms: tmdbPlatforms(m["watch/providers"]),
        release_date,
        release_at: exact ? when.toISOString() : null,
        release_precision: exact ? "datetime" : "date",
        release_date_type: "ott_digital_in",
        verification_status: exact ? "verified" : "date_only",
        release_note: digital.note || null,
        runtime_minutes: m.runtime || null,
        episode_count: null,
        vote_average: m.vote_average ? Number(m.vote_average.toFixed(1)) : null,
        source_url: `https://www.themoviedb.org/movie/${m.id}`,
      });
    } catch (e) {
      errors.push(`movie ${id}: ${(e as Error).message}`);
    }
  });
}

async function collectSeries(from: string, to: string, rows: ReleaseRow[], errors: string[]) {
  const ids = (await pages((p) => discoverTv(from, to, TV_PROVIDER_IDS, p))).slice(0, MAX_SERIES);
  await inBatches(ids, 4, async (id) => {
    try {
      const s = await tvDetails(id);
      const common = {
        tmdb_id: s.id,
        imdb_id: s.external_ids?.imdb_id || null,
        title: s.name,
        series_tmdb_id: s.id,
        poster_url: img(s.poster_path, "w500"),
        backdrop_url: img(s.backdrop_path, "w1280"),
        genres: normalizeGenres(s.genres?.map((g) => g.name) ?? []),
        languages: langs(s),
        tmdb_platforms: tmdbPlatforms(s["watch/providers"]),
        release_at: null,
        release_precision: "date" as const,
        verification_status: "date_only" as const,
        release_note: null,
        runtime_minutes: s.episode_run_time?.[0] || null,
        vote_average: s.vote_average ? Number(s.vote_average.toFixed(1)) : null,
        source_url: `https://www.themoviedb.org/tv/${s.id}`,
      };
      const seasons = (s.seasons ?? []).filter((x) => x.season_number > 0 && x.air_date);
      const premieredInWindow = new Set<number>();
      for (const se of seasons) {
        if (se.air_date! >= from && se.air_date! <= to) {
          premieredInWindow.add(se.season_number);
          rows.push({
            ...common,
            provider_key: `tmdb:tv:${s.id}:s${se.season_number}`,
            content_type: se.season_number === 1 ? "series" : "season",
            season_number: se.season_number,
            episode_number: null,
            episode_title: null,
            synopsis: s.overview || null,
            release_date: se.air_date!,
            release_date_type: "tv_season_air_date",
            episode_count: se.episode_count || null,
          });
        }
      }
      // Ongoing season: episode rows only where the season did not itself premiere in the window.
      const started = seasons.filter((x) => x.air_date! <= to).sort((a, b) => b.season_number - a.season_number)[0];
      if (started && !premieredInWindow.has(started.season_number)) {
        const sd = await tvSeason(s.id, started.season_number);
        for (const ep of sd.episodes ?? []) {
          if (!ep.air_date || ep.air_date < from || ep.air_date > to) continue;
          rows.push({
            ...common,
            provider_key: `tmdb:tv:${s.id}:s${started.season_number}e${ep.episode_number}`,
            content_type: "episode",
            season_number: started.season_number,
            episode_number: ep.episode_number,
            episode_title: ep.name || null,
            synopsis: ep.overview || s.overview || null,
            release_date: ep.air_date,
            release_date_type: "tv_episode_air_date",
            episode_count: null,
            runtime_minutes: ep.runtime || common.runtime_minutes,
          });
        }
      }
    } catch (e) {
      errors.push(`tv ${id}: ${(e as Error).message}`);
    }
  });
}

async function upsert(rows: ReleaseRow[]): Promise<{ inserted: number; updated: number }> {
  let inserted = 0;
  let updated = 0;
  if (!rows.length) return { inserted, updated };
  const existing = await q<{ provider_key: string; platform_details: PlatformDetail[] }>(
    "SELECT provider_key, platform_details FROM releases WHERE provider_key = ANY($1)",
    [rows.map((r) => r.provider_key)],
  );
  const prior = new Map(existing.map((e) => [e.provider_key, e.platform_details]));
  for (const r of rows) {
    // Keep earlier RapidAPI evidence; refresh the TMDB evidence.
    const keep = (prior.get(r.provider_key) ?? []).filter((d) => d.source === "rapidapi");
    const details = [...r.tmdb_platforms, ...keep];
    const m = mergePlatforms(details);
    const res = await q<{ inserted: boolean }>(
      `INSERT INTO releases (provider_key, tmdb_id, imdb_id, title, content_type, series_tmdb_id, season_number,
         episode_number, episode_title, synopsis, poster_url, backdrop_url, genres, languages, platforms,
         platform_details, platform_status, release_date, release_at, release_precision, release_date_type,
         verification_status, release_note, runtime_minutes, episode_count, vote_average, source_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
       ON CONFLICT (provider_key) DO UPDATE SET
         imdb_id=EXCLUDED.imdb_id, title=EXCLUDED.title, episode_title=EXCLUDED.episode_title,
         synopsis=EXCLUDED.synopsis, poster_url=EXCLUDED.poster_url, backdrop_url=EXCLUDED.backdrop_url,
         genres=EXCLUDED.genres, languages=EXCLUDED.languages, platforms=EXCLUDED.platforms,
         platform_details=EXCLUDED.platform_details, platform_status=EXCLUDED.platform_status,
         release_date=EXCLUDED.release_date, release_at=EXCLUDED.release_at,
         release_precision=EXCLUDED.release_precision, verification_status=EXCLUDED.verification_status,
         release_note=EXCLUDED.release_note, runtime_minutes=EXCLUDED.runtime_minutes,
         episode_count=EXCLUDED.episode_count, vote_average=EXCLUDED.vote_average,
         last_fetched_at=now(), updated_at=now()
       RETURNING (xmax = 0) AS inserted`,
      [
        r.provider_key, r.tmdb_id, r.imdb_id, r.title, r.content_type, r.series_tmdb_id, r.season_number,
        r.episode_number, r.episode_title, r.synopsis, r.poster_url, r.backdrop_url, r.genres, r.languages,
        m.platforms, JSON.stringify(details), m.status, r.release_date, r.release_at, r.release_precision,
        r.release_date_type, r.verification_status, r.release_note, r.runtime_minutes, r.episode_count,
        r.vote_average, r.source_url,
      ],
    );
    if (res[0]?.inserted) inserted++;
    else updated++;
  }
  return { inserted, updated };
}

/** RapidAPI India-availability check for recent titles (quota is tiny, so cap calls and cache for 7 days). */
async function enrichAvailability(maxCalls: number, errors: string[]): Promise<number> {
  const todo = await q<{ imdb_id: string }>(
    `SELECT imdb_id FROM releases
     WHERE imdb_id IS NOT NULL AND release_date >= (now() - interval '21 days')::date
       AND (availability_checked_at IS NULL OR availability_checked_at < now() - interval '7 days')
     GROUP BY imdb_id
     ORDER BY max((platform_status = 'unknown')::int) DESC, max(release_date) DESC LIMIT $1`,
    [maxCalls],
  );
  let calls = 0;
  let lowQuota = false;
  for (const { imdb_id } of todo) {
    if (lowQuota) {
      errors.push(`rapidapi: stopped early to keep the last ${QUOTA_RESERVE} calls of quota in reserve`);
      break;
    }
    try {
      await new Promise((r) => setTimeout(r, 1200)); // plan limit is about 1 request/second
      const a = await indiaAvailability(imdb_id);
      calls++;
      lowQuota = a.quotaRemaining !== null && a.quotaRemaining <= QUOTA_RESERVE;
      const rapid = rapidToDetails(a.platforms);
      const rows = await q<{ id: string; platform_details: PlatformDetail[] }>(
        "SELECT id, platform_details FROM releases WHERE imdb_id = $1",
        [imdb_id],
      );
      for (const row of rows) {
        const details = [...row.platform_details.filter((d) => d.source !== "rapidapi"), ...rapid];
        const m = mergePlatforms(details);
        await q(
          `UPDATE releases SET platform_details=$2, platforms=$3, platform_status=$4,
             availability_checked_at=now(), updated_at=now() WHERE id=$1`,
          [row.id, JSON.stringify(details), m.platforms, m.status],
        );
      }
    } catch (e) {
      errors.push(`rapidapi ${imdb_id}: ${(e as Error).message}`);
      if (e instanceof RapidRateLimited) break;
    }
  }
  return calls;
}

export async function runCollection(opts: { daysBack?: number; daysForward?: number; maxRapidCalls?: number } = {}): Promise<CollectionResult> {
  const { daysBack = 16, daysForward = 7, maxRapidCalls = Number(process.env.RAPIDAPI_MAX_CALLS_PER_RUN ?? 5) } = opts;
  const day = 86_400_000;
  const from = toIstDate(new Date(Date.now() - daysBack * day));
  const to = toIstDate(new Date(Date.now() + daysForward * day));
  const job = await q<{ id: string }>(
    "INSERT INTO collection_job_history (job_type, status) VALUES ('collect', 'running') RETURNING id",
  );
  const errors: string[] = [];
  const rows: ReleaseRow[] = [];
  let inserted = 0, updated = 0, calls = 0;
  try {
    await collectMovies(from, to, rows, errors);
    await collectSeries(from, to, rows, errors);
    ({ inserted, updated } = await upsert(rows));
    calls = await enrichAvailability(maxRapidCalls, errors);
  } catch (e) {
    errors.push((e as Error).message);
  }
  const status = rows.length === 0 && errors.length ? "failed" : errors.length ? "partial" : "success";
  await q(
    `UPDATE collection_job_history SET status=$2, completed_at=now(), records_fetched=$3, records_inserted=$4,
       records_updated=$5, records_rejected=$6, rapidapi_calls=$7, error_details=$8 WHERE id=$1`,
    [job[0].id, status, rows.length, inserted, updated, errors.length, calls, errors.slice(0, 20).join("\n") || null],
  );
  return { jobId: job[0].id, status, fetched: rows.length, inserted, updated, rejected: errors.length, rapidapiCalls: calls, errors: errors.slice(0, 20) };
}
