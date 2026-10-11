// Two INDEPENDENT rankings over the same eligible releases.
//
//  rankForFilters(): explicit filters only. It has no feedback parameter, so Like/Dislike can never
//  change or hide anything here. Order: newest verified release first, then a stable tie-breaker.
//
//  rankPersonalized(): saved preferences + Like/Dislike history + recency. Deterministic, explainable
//  rules (no trained model). Feedback only counts once there are MIN_FEEDBACK reactions, and every
//  attribute weight is shrunk toward 0 so one Like/Dislike cannot swing the ranking.

export interface Prefs {
  genres: string[];
  languages: string[];
  platforms: string[];
  contentTypes: string[];
}

export interface Rankable {
  id: string;
  title: string;
  content_type: string;
  genres: string[];
  languages: string[];
  platforms: string[]; // confirmed platforms only
  release_date: string | null;
  release_at: Date | string | null;
}

export interface FeedbackItem {
  value: "like" | "dislike";
  releaseId: string;
  genres: string[];
  languages: string[];
  platforms: string[];
  content_type: string;
}

export const MIN_FEEDBACK = 3;
const SHRINK = 3;

const intersect = (a: string[], b: string[]) => a.filter((x) => b.includes(x));

/** Explicit filter match: every non-empty dimension must match (OR inside a dimension, AND across). */
export function matchFilters(r: Rankable, p: Prefs): string[] | null {
  const reasons: string[] = [];
  const dims: [string[], string[], string][] = [
    [p.genres, r.genres, "genre"],
    [p.languages, r.languages, "language"],
    [p.platforms, r.platforms, "platform"], // an unconfirmed platform never matches a platform filter
    [p.contentTypes, [r.content_type], "content type"],
  ];
  for (const [wanted, have, label] of dims) {
    if (!wanted.length) continue;
    const hit = intersect(wanted, have);
    if (!hit.length) return null;
    reasons.push(`${label}: ${hit.join(", ")}`);
  }
  return reasons;
}

const newestFirst = (a: Rankable, b: Rankable) => {
  const ta = a.release_at ? new Date(a.release_at).getTime() : 0;
  const tb = b.release_at ? new Date(b.release_at).getTime() : 0;
  return (
    (b.release_date ?? "").localeCompare(a.release_date ?? "") ||
    tb - ta ||
    a.title.localeCompare(b.title) ||
    a.id.localeCompare(b.id)
  );
};

export function rankForFilters<T extends Rankable>(releases: T[], prefs: Prefs): (T & { reasons: string[] })[] {
  return releases
    .map((r) => ({ r, m: matchFilters(r, prefs) }))
    .filter((x): x is { r: T; m: string[] } => x.m !== null)
    .sort((a, b) => newestFirst(a.r, b.r))
    .map((x) => ({ ...x.r, reasons: x.m }));
}

type Weights = Map<string, number>;

function affinity(history: FeedbackItem[]) {
  const counts = new Map<string, { l: number; d: number }>();
  const bump = (key: string, v: "like" | "dislike") => {
    const c = counts.get(key) ?? { l: 0, d: 0 };
    if (v === "like") c.l++;
    else c.d++;
    counts.set(key, c);
  };
  for (const f of history) {
    f.genres.forEach((g) => bump(`genre:${g}`, f.value));
    f.languages.forEach((g) => bump(`lang:${g}`, f.value));
    f.platforms.forEach((g) => bump(`plat:${g}`, f.value));
    bump(`type:${f.content_type}`, f.value);
  }
  const w: Weights = new Map();
  for (const [k, c] of counts) w.set(k, (c.l - c.d) / (c.l + c.d + SHRINK));
  return { w, counts };
}

export interface PersonalizedResult<T> {
  item: T;
  score: number;
  reasons: string[];
}

export function rankPersonalized<T extends Rankable>(
  releases: T[],
  prefs: Prefs,
  history: FeedbackItem[],
  today: string,
): { ranked: PersonalizedResult<T>[]; feedbackActive: boolean; feedbackCount: number } {
  const feedbackActive = history.length >= MIN_FEEDBACK;
  const { w, counts } = affinity(feedbackActive ? history : []);
  const directlyDisliked = new Set(history.filter((h) => h.value === "dislike").map((h) => h.releaseId));
  const ranked: PersonalizedResult<T>[] = [];

  for (const r of releases) {
    if (directlyDisliked.has(r.id)) continue; // personalised list respects explicit dislikes
    if (prefs.contentTypes.length && !prefs.contentTypes.includes(r.content_type)) continue;
    const reasons: string[] = [];
    let score = 0;

    const g = intersect(prefs.genres, r.genres);
    const l = intersect(prefs.languages, r.languages);
    const p = intersect(prefs.platforms, r.platforms);
    if (g.length) { score += 2 * Math.min(1, g.length / 2); reasons.push(`Matches your genre${g.length > 1 ? "s" : ""}: ${g.join(", ")}`); }
    if (l.length) { score += 1.5; reasons.push(`Language you chose: ${l.join(", ")}`); }
    if (p.length) { score += 1.5; reasons.push(`Confirmed on ${p.join(", ")}`); }

    let fb = 0;
    if (feedbackActive) {
      const parts: number[] = [];
      for (const gn of r.genres) parts.push(w.get(`genre:${gn}`) ?? 0);
      const genreAvg = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 0;
      fb += 3 * genreAvg;
      for (const ln of r.languages) fb += 1 * (w.get(`lang:${ln}`) ?? 0);
      for (const pn of r.platforms) fb += 0.5 * (w.get(`plat:${pn}`) ?? 0);
      fb += 0.5 * (w.get(`type:${r.content_type}`) ?? 0);
      score += fb;
      const strongest = r.genres
        .map((gn) => ({ gn, w: w.get(`genre:${gn}`) ?? 0, c: counts.get(`genre:${gn}`) }))
        .filter((x) => x.c && x.c.l + x.c.d >= 2 && Math.abs(x.w) >= 0.2)
        .sort((a, b) => Math.abs(b.w) - Math.abs(a.w))[0];
      if (strongest) {
        reasons.push(
          strongest.w > 0
            ? `Similar to ${strongest.gn} titles you liked`
            : `Less like ${strongest.gn} titles (you disliked several)`,
        );
      }
    }
    if (g.length === 0 && fb <= 0) continue; // needs a genre match or a positive feedback signal
    if (r.release_date) {
      const age = (Date.parse(today) - Date.parse(r.release_date)) / 86_400_000;
      score += Math.max(0, 1 - Math.max(0, age) / 14);
    }
    ranked.push({ item: r, score: Math.round(score * 1000) / 1000, reasons });
  }
  ranked.sort((a, b) => b.score - a.score || newestFirst(a.item, b.item));
  return { ranked, feedbackActive, feedbackCount: history.length };
}
