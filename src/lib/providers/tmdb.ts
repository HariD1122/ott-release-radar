// TMDB adapter. Verified contract (probe, Oct 2026):
//  - discover/movie with region=IN & with_release_type=4 filters on the India DIGITAL release date.
//  - movie/{id}?append_to_response=release_dates,watch/providers gives per-country release entries
//    {type, release_date (ISO, usually T00:00:00.000Z = date only), note} and IN watch providers.
//  - tv episodes/seasons have air_date (calendar date, not region specific).
import { requireEnv } from "../env";

const BASE = "https://api.themoviedb.org/3";

export class ProviderError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

export async function tmdb<T>(path: string, attempt = 0): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      headers: { Authorization: `Bearer ${requireEnv("TMDB_ACCESS_TOKEN")}`, Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    if (attempt < 2) return tmdb<T>(path, attempt + 1);
    throw new ProviderError(`TMDB network error: ${(e as Error).message}`);
  }
  if ((res.status === 429 || res.status >= 500) && attempt < 3) {
    const wait = Number(res.headers.get("retry-after")) * 1000 || 800 * (attempt + 1);
    await new Promise((r) => setTimeout(r, wait));
    return tmdb<T>(path, attempt + 1);
  }
  if (!res.ok) throw new ProviderError(`TMDB ${res.status} for ${path.split("?")[0]}`, res.status);
  return (await res.json()) as T;
}

export interface TmdbProvider { provider_name: string }
export interface TmdbWatch {
  results?: Record<
    string,
    { link?: string; flatrate?: TmdbProvider[]; ads?: TmdbProvider[]; rent?: TmdbProvider[]; buy?: TmdbProvider[] }
  >;
}
export interface TmdbMovie {
  id: number;
  title: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  genres?: { name: string }[];
  original_language?: string;
  spoken_languages?: { english_name: string; iso_639_1: string }[];
  runtime?: number | null;
  vote_average?: number;
  imdb_id?: string | null;
  release_dates?: {
    results: { iso_3166_1: string; release_dates: { type: number; release_date: string; note?: string }[] }[];
  };
  "watch/providers"?: TmdbWatch;
}
export interface TmdbTv {
  id: number;
  name: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  genres?: { name: string }[];
  original_language?: string;
  spoken_languages?: { english_name: string; iso_639_1: string }[];
  episode_run_time?: number[];
  vote_average?: number;
  seasons?: { season_number: number; air_date: string | null; episode_count: number }[];
  external_ids?: { imdb_id?: string | null };
  "watch/providers"?: TmdbWatch;
}
export interface TmdbSeason {
  episodes?: { episode_number: number; name?: string; overview?: string; air_date: string | null; runtime?: number | null }[];
}

export const img = (p: string | null | undefined, size: "w500" | "w780" | "w1280") =>
  p ? `https://image.tmdb.org/t/p/${size}${p}` : null;

export const discoverMovies = (from: string, to: string, page: number) =>
  tmdb<{ results: { id: number }[]; total_pages: number }>(
    `/discover/movie?region=IN&with_release_type=4&release_date.gte=${from}&release_date.lte=${to}` +
      `&sort_by=primary_release_date.desc&page=${page}`,
  );

export const movieDetails = (id: number) =>
  tmdb<TmdbMovie>(`/movie/${id}?append_to_response=release_dates,watch/providers`);

/** providerIds are TMDB watch-provider ids joined with "|", e.g. "8|119|2336". */
export const discoverTv = (from: string, to: string, providerIds: string, page: number) =>
  tmdb<{ results: { id: number }[]; total_pages: number }>(
    `/discover/tv?air_date.gte=${from}&air_date.lte=${to}&watch_region=IN` +
      `&with_watch_providers=${encodeURIComponent(providerIds)}` +
      `&with_watch_monetization_types=flatrate&sort_by=popularity.desc&page=${page}`,
  );

export const tvDetails = (id: number) =>
  tmdb<TmdbTv>(`/tv/${id}?append_to_response=external_ids,watch/providers`);

export const tvSeason = (id: number, n: number) => tmdb<TmdbSeason>(`/tv/${id}/season/${n}`);
