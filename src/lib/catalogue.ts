// Catalogue queries, preferences, watchlist, feedback, followed series. All scoped to one user.
import { q } from "./db";
import type { FeedbackItem, Prefs } from "./ranking";
import { isEligible, type WeeklyWindow } from "./time/window";

export interface ReleaseView {
  id: string;
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
  platforms: string[];
  platform_status: string;
  release_date: string | null;
  release_at: string | null;
  release_precision: "date" | "datetime";
  release_date_type: string;
  verification_status: "verified" | "date_only" | "unverified";
  release_note: string | null;
  runtime_minutes: number | null;
  episode_count: number | null;
  vote_average: string | null;
  vote_count: number | null;
  source_url: string | null;
  last_fetched_at: string;
  feedback: "like" | "dislike" | null;
  in_watchlist: boolean;
  rec_decision: "WATCH" | "SKIP" | null;
  rec_explanation: string | null;
}

const SELECT = `
  r.id, r.title, r.content_type, r.series_tmdb_id, r.season_number, r.episode_number, r.episode_title,
  r.synopsis, r.poster_url, r.backdrop_url, r.genres, r.languages, r.platforms, r.platform_status,
  r.release_date::text AS release_date, r.release_at, r.release_precision, r.release_date_type,
  r.verification_status, r.release_note, r.runtime_minutes, r.episode_count, r.vote_average::text AS vote_average, r.vote_count,
  r.source_url, r.last_fetched_at,
  f.value AS feedback, (w.release_id IS NOT NULL) AS in_watchlist,
  rec.decision AS rec_decision, rec.explanation AS rec_explanation
  FROM releases r
  LEFT JOIN user_title_feedback f ON f.release_id = r.id AND f.user_id = $1
  LEFT JOIN watchlist w ON w.release_id = r.id AND w.user_id = $1
  LEFT JOIN recommendations rec ON rec.release_id = r.id AND rec.user_id = $1`;

export interface ReleaseFilters {
  search?: string;
  types?: string[];
  genre?: string;
  genres?: string[]; // multi-select: a title matches if it has ANY of these
  languages?: string[];
  platforms?: string[]; // matched against CONFIRMED platforms only
  language?: string;
  platform?: string;
  from?: string;
  to?: string;
  watchlistOnly?: boolean;
  followedOnly?: boolean;
  limit?: number;
  offset?: number;
}

export async function listReleases(userId: string, f: ReleaseFilters = {}): Promise<ReleaseView[]> {
  const params: unknown[] = [userId];
  const where: string[] = [];
  const add = (sql: string, v: unknown) => {
    params.push(v);
    where.push(sql.replace("?", `$${params.length}`));
  };
  if (f.search?.trim()) add("r.title ILIKE ?", `%${f.search.trim().replace(/[%_\\]/g, "\\$&")}%`);
  if (f.types?.length) add("r.content_type = ANY(?)", f.types);
  if (f.genre) add("? = ANY(r.genres)", f.genre);
  if (f.language) add("? = ANY(r.languages)", f.language);
  if (f.platform) add("? = ANY(r.platforms)", f.platform);
  if (f.genres?.length) add("r.genres && ?::text[]", f.genres);
  if (f.languages?.length) add("r.languages && ?::text[]", f.languages);
  if (f.platforms?.length) add("r.platforms && ?::text[]", f.platforms);
  if (f.from) add("r.release_date >= ?::date", f.from);
  if (f.to) add("r.release_date <= ?::date", f.to);
  if (f.watchlistOnly) where.push("w.release_id IS NOT NULL");
  if (f.followedOnly)
    where.push("r.series_tmdb_id IN (SELECT series_tmdb_id FROM followed_series WHERE user_id = $1)");
  params.push(Math.min(f.limit ?? 60, 200), f.offset ?? 0);
  const sql = `SELECT ${SELECT} ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY r.release_date DESC NULLS LAST, r.title, r.id LIMIT $${params.length - 1} OFFSET $${params.length}`;
  return q<ReleaseView>(sql, params);
}

export async function getRelease(userId: string, id: string): Promise<ReleaseView | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rows = await q<ReleaseView>(`SELECT ${SELECT} WHERE r.id = $2`, [userId, id]);
  return rows[0] ?? null;
}

/** All releases whose verified date falls inside the weekly window, via the shared eligibility function. */
export async function eligibleReleases(userId: string, w: WeeklyWindow, asOf?: Date): Promise<ReleaseView[]> {
  const rows = await q<ReleaseView>(
    `SELECT ${SELECT} WHERE r.release_date > $2::date - 1 AND r.release_date <= $3::date + 1
     ORDER BY r.release_date DESC, r.title, r.id`,
    [userId, w.startDate, w.endDate],
  );
  return rows.filter((r) => isEligible(r, w, asOf));
}

export const FEATURED_MIN = 5;
export const FEATURED_MAX = 10;

/**
 * Hero carousel: the top-rated NEWLY released movies and series (new series / new seasons; not single episodes),
 * released in the last 14 days, highest TMDB rating first, always with artwork. Between 5 and 10 titles:
 * if fewer than 5 qualify in the window, the window is dropped and the best-rated released titles fill the gap.
 */
export async function featuredReleases(userId: string, today: string): Promise<ReleaseView[]> {
  const base = `WHERE r.content_type IN ('movie','series','season') AND r.backdrop_url IS NOT NULL
     AND r.release_date <= $2::date`;
  // Vote-weighted rating (Bayesian average, prior 6.5 worth 10 votes) so a title with one 10/10 vote cannot top the list.
  const order = `ORDER BY (COALESCE(r.vote_count, 0) >= 3 AND r.vote_average > 0) DESC,
     ((COALESCE(r.vote_count, 0)::numeric / (COALESCE(r.vote_count, 0) + 10)) * COALESCE(r.vote_average, 0)
       + (10::numeric / (COALESCE(r.vote_count, 0) + 10)) * 6.5) DESC, r.release_date DESC, r.id LIMIT 60`;
  const pick = (rows: ReleaseView[]) => {
    const seen = new Set<string>();
    const out: ReleaseView[] = [];
    for (const r of rows) {
      const key = r.title.toLowerCase();
      if (seen.has(key)) continue; // one slide per title
      seen.add(key);
      out.push(r);
      if (out.length >= FEATURED_MAX) break;
    }
    return out;
  };
  let out = pick(await q<ReleaseView>(`SELECT ${SELECT} ${base} AND r.release_date >= $2::date - 14 ${order}`, [userId, today]));
  if (out.length < FEATURED_MIN) out = pick(await q<ReleaseView>(`SELECT ${SELECT} ${base} ${order}`, [userId, today]));
  return out;
}

export async function distinctValues(): Promise<{ genres: string[]; languages: string[]; platforms: string[] }> {
  const [g, l, p] = await Promise.all([
    q<{ v: string }>("SELECT DISTINCT unnest(genres) AS v FROM releases ORDER BY 1"),
    q<{ v: string }>("SELECT DISTINCT unnest(languages) AS v FROM releases ORDER BY 1"),
    q<{ v: string }>("SELECT DISTINCT unnest(platforms) AS v FROM releases ORDER BY 1"),
  ]);
  return { genres: g.map((x) => x.v), languages: l.map((x) => x.v), platforms: p.map((x) => x.v) };
}

export async function counts() {
  const r = await q<Record<string, number>>(`
    SELECT count(*)::int AS total,
      count(*) FILTER (WHERE content_type='movie')::int AS movies,
      count(*) FILTER (WHERE content_type='series')::int AS series,
      count(*) FILTER (WHERE content_type='season')::int AS seasons,
      count(*) FILTER (WHERE content_type='episode')::int AS episodes
    FROM releases`);
  return r[0];
}

// ---- preferences -------------------------------------------------------------------------------

export async function getPrefs(userId: string): Promise<Prefs> {
  const rows = await q<{ genres: string[]; languages: string[]; platforms: string[]; content_types: string[] }>(
    "SELECT genres, languages, platforms, content_types FROM user_preferences WHERE user_id = $1",
    [userId],
  );
  const r = rows[0];
  return { genres: r?.genres ?? [], languages: r?.languages ?? [], platforms: r?.platforms ?? [], contentTypes: r?.content_types ?? [] };
}

export async function prefsUpdatedAt(userId: string): Promise<string | null> {
  const r = await q<{ updated_at: string }>("SELECT updated_at FROM user_preferences WHERE user_id = $1", [userId]);
  return r[0]?.updated_at ?? null;
}

export async function savePrefs(userId: string, p: Prefs) {
  await q(
    `INSERT INTO user_preferences (user_id, genres, languages, platforms, content_types)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (user_id) DO UPDATE SET genres=$2, languages=$3, platforms=$4, content_types=$5, updated_at=now()`,
    [userId, p.genres, p.languages, p.platforms, p.contentTypes],
  );
}

// ---- watchlist / feedback / follow --------------------------------------------------------------

export async function setWatchlist(userId: string, releaseId: string, on: boolean) {
  if (on) {
    await q("INSERT INTO watchlist (user_id, release_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [userId, releaseId]);
  } else {
    await q("DELETE FROM watchlist WHERE user_id=$1 AND release_id=$2", [userId, releaseId]);
  }
}

/** Like -> Dislike replaces; clicking the active choice again clears it. Returns the new state. */
export async function toggleFeedback(userId: string, releaseId: string, value: "like" | "dislike") {
  const cur = await q<{ value: string }>(
    "SELECT value FROM user_title_feedback WHERE user_id=$1 AND release_id=$2",
    [userId, releaseId],
  );
  if (cur[0]?.value === value) {
    await q("DELETE FROM user_title_feedback WHERE user_id=$1 AND release_id=$2", [userId, releaseId]);
    return null;
  }
  await q(
    `INSERT INTO user_title_feedback (user_id, release_id, value) VALUES ($1,$2,$3)
     ON CONFLICT (user_id, release_id) DO UPDATE SET value=$3, updated_at=now()`,
    [userId, releaseId, value],
  );
  return value;
}

export async function feedbackHistory(userId: string): Promise<FeedbackItem[]> {
  const rows = await q<{ value: "like" | "dislike"; release_id: string; genres: string[]; languages: string[]; platforms: string[]; content_type: string }>(
    `SELECT f.value, f.release_id, r.genres, r.languages, r.platforms, r.content_type
     FROM user_title_feedback f JOIN releases r ON r.id = f.release_id WHERE f.user_id = $1`,
    [userId],
  );
  return rows.map((r) => ({ value: r.value, releaseId: r.release_id, genres: r.genres, languages: r.languages, platforms: r.platforms, content_type: r.content_type }));
}

export async function setFollow(userId: string, seriesTmdbId: number, title: string, on: boolean) {
  if (on) {
    await q(
      "INSERT INTO followed_series (user_id, series_tmdb_id, series_title) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
      [userId, seriesTmdbId, title],
    );
  } else {
    await q("DELETE FROM followed_series WHERE user_id=$1 AND series_tmdb_id=$2", [userId, seriesTmdbId]);
  }
}

export async function followedIds(userId: string): Promise<number[]> {
  const rows = await q<{ series_tmdb_id: number }>("SELECT series_tmdb_id FROM followed_series WHERE user_id=$1", [userId]);
  return rows.map((r) => r.series_tmdb_id);
}
