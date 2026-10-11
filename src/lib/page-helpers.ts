import type { ReleaseFilters } from "./catalogue";
import type { Prefs } from "./ranking";

export type SP = Record<string, string | string[] | undefined>;
export const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

/** Per-page, temporary filters: title search and dates. */
export function filtersFromParams(sp: SP): ReleaseFilters {
  return {
    search: first(sp.q),
    from: first(sp.from)?.match(/^\d{4}-\d{2}-\d{2}$/)?.[0],
    to: first(sp.to)?.match(/^\d{4}-\d{2}-\d{2}$/)?.[0],
  };
}

/** The permanent profile filters as catalogue query filters (empty list = any). */
export const savedFilters = (p: Prefs, withTypes = false): ReleaseFilters => ({
  genres: p.genres,
  languages: p.languages,
  platforms: p.platforms,
  ...(withTypes && p.contentTypes.length ? { types: p.contentTypes } : {}),
});

export const currentParams = (sp: SP) => Object.fromEntries(["q", "from", "to"].map((k) => [k, first(sp[k])]));
