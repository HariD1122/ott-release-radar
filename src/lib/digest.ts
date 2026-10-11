// The ONE digest generator. The website preview, the manual Telegram send and the automatic Telegram
// send all call buildDigest(); nothing else decides eligibility, categories or ordering.
import { eligibleReleases, feedbackHistory, getPrefs, type ReleaseView } from "./catalogue";
import { ensureRecommendations, type Rec } from "./gemini";
import { matchFilters, rankForFilters, rankPersonalized, type FeedbackItem, type Prefs } from "./ranking";
import { CONTENT_TYPE_LABEL } from "./taxonomy";
import { toIstDate, weeklyWindow, type WeeklyWindow } from "./time/window";

export interface DigestEntry {
  key: string;
  releaseId: string; // representative release (the newest one when episodes are grouped)
  releaseIds: string[];
  title: string;
  typeLabel: string;
  detail: string | null; // e.g. "Season 2 - Episodes 5-7 (3 new)"
  dateLabel: string; // IST calendar date(s)
  datePrecision: "date" | "datetime";
  platforms: string[];
  platformStatus: string;
  genres: string[];
  languages: string[];
  reasons: string[]; // rule-based evidence, from preferences / feedback
  rec: Rec | null; // AI opinion (separate from the factual fields above)
}

export interface Digest {
  window: { start: string; end: string; startDate: string; endDate: string };
  generatedAt: string;
  eligibleCount: number; // all verified releases in the window
  matchCount: number; // those that match the saved profile filters (the only ones that are recommended)
  appliedFilters: Prefs;
  personalized: { entries: DigestEntry[]; feedbackActive: boolean; feedbackCount: number };
  filters: { entries: DigestEntry[] };
  aiError: string | null;
  /** Release rows behind the entries, for rendering cards on the website. Not used by Telegram. */
  cards: Record<string, ReleaseView>;
}

const fmtDate = (d: string) =>
  new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(new Date(d + "T00:00:00Z"));

/** Collapses several episodes of one season into one entry, keeping the first (best-ranked) position. */
function toEntries<T extends ReleaseView>(ranked: { item: T; reasons: string[] }[]): DigestEntry[] {
  const out: DigestEntry[] = [];
  const groups = new Map<string, { entry: DigestEntry; items: T[] }>();
  for (const { item: r, reasons } of ranked) {
    const isEp = r.content_type === "episode";
    const key = isEp ? `ep:${r.series_tmdb_id}:${r.season_number}` : r.id;
    const existing = groups.get(key);
    if (existing) {
      existing.items.push(r);
      continue;
    }
    const entry: DigestEntry = {
      key,
      releaseId: r.id,
      releaseIds: [r.id],
      title: r.title,
      typeLabel: CONTENT_TYPE_LABEL[r.content_type],
      detail: null,
      dateLabel: r.release_date ? fmtDate(r.release_date) : "Date unavailable",
      datePrecision: r.release_precision,
      platforms: r.platforms,
      platformStatus: r.platform_status,
      genres: r.genres,
      languages: r.languages,
      reasons,
      rec: null,
    };
    if (r.content_type === "season" || r.content_type === "series") {
      entry.detail = `Season ${r.season_number}${r.episode_count ? ` - ${r.episode_count} episodes` : ""}`;
    }
    groups.set(key, { entry, items: [r] });
    out.push(entry);
  }
  for (const { entry, items } of groups.values()) {
    if (items[0].content_type !== "episode") continue;
    const nums = items.map((i) => i.episode_number ?? 0).sort((a, b) => a - b);
    const dates = items.map((i) => i.release_date ?? "").filter(Boolean).sort();
    entry.releaseIds = items.map((i) => i.id);
    entry.releaseId = [...items].sort((a, b) => (b.release_date ?? "").localeCompare(a.release_date ?? ""))[0].id;
    entry.detail =
      items.length === 1
        ? `S${items[0].season_number}E${nums[0]}${items[0].episode_title ? ` "${items[0].episode_title}"` : ""}`
        : `Season ${items[0].season_number} - Episodes ${nums[0]}-${nums[nums.length - 1]} (${items.length} new)`;
    entry.dateLabel =
      dates[0] === dates[dates.length - 1] ? fmtDate(dates[0]) : `${fmtDate(dates[0])} to ${fmtDate(dates[dates.length - 1])}`;
  }
  return out;
}

export function summarizeFeedback(history: FeedbackItem[]): string {
  if (!history.length) return "No Like/Dislike feedback yet.";
  const tally = (v: "like" | "dislike") => {
    const c = new Map<string, number>();
    history.filter((h) => h.value === v).forEach((h) => h.genres.forEach((g) => c.set(g, (c.get(g) ?? 0) + 1)));
    return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([g, n]) => `${g}(${n})`).join(", ") || "none";
  };
  return `${history.filter((h) => h.value === "like").length} likes, ${history.filter((h) => h.value === "dislike").length} dislikes. Liked genres: ${tally("like")}. Disliked genres: ${tally("dislike")}.`;
}

/** Pure part: eligible releases in, two independent categories out. No I/O, no AI. */
export function composeDigest(
  eligible: ReleaseView[],
  prefs: Prefs,
  history: FeedbackItem[],
  window: WeeklyWindow,
  now: Date,
): Digest {
  // The saved profile filters are permanent: nothing outside them is recommended or sent to Telegram.
  const matching = eligible.filter((r) => matchFilters(r, prefs) !== null);
  const p = rankPersonalized(matching, prefs, history, toIstDate(now));
  const f = rankForFilters(matching, prefs);
  return {
    window: {
      start: window.start.toISOString(),
      end: window.end.toISOString(),
      startDate: window.startDate,
      endDate: window.endDate,
    },
    generatedAt: now.toISOString(),
    eligibleCount: eligible.length,
    matchCount: matching.length,
    appliedFilters: prefs,
    personalized: {
      entries: toEntries(p.ranked.map((x) => ({ item: x.item, reasons: x.reasons }))),
      feedbackActive: p.feedbackActive,
      feedbackCount: p.feedbackCount,
    },
    filters: { entries: toEntries(f.map((x) => ({ item: x, reasons: x.reasons }))) },
    aiError: null,
    cards: Object.fromEntries(matching.map((r) => [r.id, r])),
  };
}

export async function buildDigest(userId: string, opts: { now?: Date; window?: WeeklyWindow; ai?: false | "cached" | "generate" } = {}): Promise<Digest> {
  const now = opts.now ?? new Date();
  const window = opts.window ?? weeklyWindow(now, "completed");
  const [eligible, prefs, history] = await Promise.all([eligibleReleases(userId, window), getPrefs(userId), feedbackHistory(userId)]);
  const digest = composeDigest(eligible, prefs, history, window, now);
  const mode = opts.ai ?? "cached";
  if (mode === false) return digest;

  // AI opinions: one per entry, via the representative release. Failures never block the digest.
  const byId = new Map(eligible.map((r) => [r.id, r]));
  const all = [...digest.personalized.entries, ...digest.filters.entries];
  const unique = [...new Map(all.map((e) => [e.releaseId, e])).values()];
  const inputs = unique.map((e) => {
    const r = byId.get(e.releaseId)!;
    return {
      id: r.id, title: r.title, content_type: r.content_type, synopsis: r.synopsis, genres: r.genres,
      languages: r.languages, platforms: r.platforms, release_date: r.release_date, season_number: r.season_number,
    };
  });
  const fb = summarizeFeedback(history);
  let recs = new Map<string, Rec>();
  let error: string | null = null;
  for (let i = 0; i < 3; i++) {
    const res = await ensureRecommendations(userId, inputs, prefs, fb, { max: 20, generate: mode === "generate" });
    recs = res.recs;
    error = res.error;
    if (mode === "cached" || error || inputs.every((x) => recs.has(x.id))) break;
  }
  for (const e of all) e.rec = recs.get(e.releaseId) ?? null;
  digest.aiError = error;
  return digest;
}
