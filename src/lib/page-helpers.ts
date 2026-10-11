import type { ReleaseFilters } from "./catalogue";

export type SP = Record<string, string | string[] | undefined>;
export const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export function filtersFromParams(sp: SP): ReleaseFilters {
  return {
    search: first(sp.q),
    genre: first(sp.genre),
    language: first(sp.language),
    platform: first(sp.platform),
    from: first(sp.from)?.match(/^\d{4}-\d{2}-\d{2}$/)?.[0],
    to: first(sp.to)?.match(/^\d{4}-\d{2}-\d{2}$/)?.[0],
  };
}

export const currentParams = (sp: SP) =>
  Object.fromEntries(["q", "type", "genre", "language", "platform", "from", "to"].map((k) => [k, first(sp[k])]));
