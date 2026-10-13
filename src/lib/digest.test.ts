import { describe, expect, it } from "vitest";
import { composeDigest, shortSynopsis } from "./digest";
import { validateModelOutput } from "./gemini";
import type { ReleaseView } from "./catalogue";
import type { FeedbackItem, Prefs } from "./ranking";
import { renderTelegram, esc } from "./telegram";
import { windowEndingAt } from "./time/window";

const w = windowEndingAt(new Date("2026-10-16T12:30:00Z"));
const now = new Date("2026-10-16T12:31:00Z");
const prefs: Prefs = { genres: ["Thriller"], languages: ["Hindi"], platforms: ["Netflix"], contentTypes: ["movie", "episode"] };

const rel = (id: string, over: Partial<ReleaseView> = {}): ReleaseView => ({
  id, title: `Title <${id}> & Co`, content_type: "movie", series_tmdb_id: null, season_number: null,
  episode_number: null, episode_title: null, synopsis: "x", poster_url: null, backdrop_url: null,
  genres: ["Thriller"], languages: ["Hindi"], platforms: ["Netflix"], platform_status: "tmdb_only",
  release_date: "2026-10-12", release_at: null, release_precision: "date", release_date_type: "ott_digital_in",
  verification_status: "date_only", release_note: null, runtime_minutes: null, episode_count: null,
  vote_average: null, vote_count: null, source_url: null, last_fetched_at: now.toISOString(), feedback: null, in_watchlist: false,
  rec_decision: null, rec_explanation: null, ...over,
});

describe("composeDigest + renderTelegram", () => {
  const releases = [rel("a"), rel("b", { release_date: "2026-10-14" }), rel("c", { genres: ["Comedy"] })];

  it("builds two separate categories with the same eligible set", () => {
    const d = composeDigest(releases, prefs, [], w, now);
    expect(d.eligibleCount).toBe(3);
    expect(d.matchCount).toBe(2); // Comedy title is outside the saved genre filter
    expect(d.filters.entries.map((e) => e.releaseId)).toEqual(["b", "a"]); // Comedy excluded by genre filter
    expect(d.personalized.entries.length).toBeGreaterThan(0);
  });

  it("feedback changes only the personalized list", () => {
    const base = composeDigest(releases, prefs, [], w, now);
    const history: FeedbackItem[] = Array.from({ length: 4 }, (_, i) => ({
      value: "dislike", releaseId: `x${i}`, genres: ["Thriller"], languages: ["Hindi"], platforms: ["Netflix"], content_type: "movie",
    }));
    history.push({ value: "dislike", releaseId: "a", genres: ["Thriller"], languages: ["Hindi"], platforms: ["Netflix"], content_type: "movie" });
    const after = composeDigest(releases, prefs, history, w, now);
    expect(after.filters.entries.map((e) => e.releaseId)).toEqual(base.filters.entries.map((e) => e.releaseId));
    expect(after.personalized.entries.map((e) => e.releaseId)).not.toContain("a");
  });

  it("only recommends titles that match ALL saved filter dimensions", () => {
    const mixed = [
      rel("ok"),
      rel("wrong-lang", { languages: ["Tamil"] }),
      rel("wrong-platform", { platforms: ["Zee5"] }),
      rel("no-platform", { platforms: [] }),
      rel("wrong-genre", { genres: ["Comedy"] }),
    ];
    const d = composeDigest(mixed, prefs, [], w, now);
    expect(d.eligibleCount).toBe(4); // the title with no India platform is not counted at all
    expect(d.matchCount).toBe(1);
    expect(d.personalized.entries.map((e) => e.releaseId)).toEqual(["ok"]);
    expect(d.filters.entries.map((e) => e.releaseId)).toEqual(["ok"]);
    expect(renderTelegram(d).join(" ")).not.toContain("wrong-lang");
  });

  it("INDIA OTT RULE: titles not streaming in India are not counted, listed or sent to Telegram", () => {
    const mixed = [rel("ok"), rel("notindia", { platforms: [], platform_status: "unknown" }), rel("rentonly", { platforms: [] })];
    const d = composeDigest(mixed, { ...prefs, genres: [], languages: [], platforms: [], contentTypes: [] }, [], w, now);
    expect(d.eligibleCount).toBe(1);
    expect(d.matchCount).toBe(1);
    const ids = [...d.personalized.entries, ...d.filters.entries].map((e) => e.releaseId);
    expect(ids).not.toContain("notindia");
    expect(ids).not.toContain("rentonly");
    const text = renderTelegram(d).join(" ");
    expect(text).not.toContain("notindia");
    expect(text).not.toContain("Platform: not confirmed");
  });

  it("collapses episodes of one season into one entry", () => {
    const eps = [5, 6, 7].map((n) =>
      rel(`e${n}`, { content_type: "episode", series_tmdb_id: 9, season_number: 2, episode_number: n, release_date: `2026-10-1${n - 3}` }),
    );
    const d = composeDigest(eps, prefs, [], w, now);
    expect(d.filters.entries).toHaveLength(1);
    expect(d.filters.entries[0].detail).toContain("Episodes 5-7");
  });

  it("renders both headings, escapes HTML, and shows empty messages", () => {
    const d = composeDigest(releases, prefs, [], w, now);
    const text = renderTelegram(d).join("\n");
    expect(text).toContain("PERSONALIZED FOR YOU");
    expect(text).toContain("RECOMMENDED FOR YOUR FILTERS");
    expect(text).toContain("Title &lt;a&gt; &amp; Co");
    const empty = renderTelegram(composeDigest([], prefs, [], w, now)).join("\n");
    expect(empty).toContain("No personalized matches are available for this weekly window");
    expect(empty).toContain("No titles match the selected filters for this window.");
  });

  it("splits long digests without losing titles or headings", () => {
    const many = Array.from({ length: 80 }, (_, i) => rel(`m${i}`, { title: `Movie ${i} ${"x".repeat(60)}`, synopsis: null }));
    const d = composeDigest(many, prefs, [], w, now);
    const parts = renderTelegram(d);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((p) => p.length <= 4096)).toBe(true);
    expect(parts[1]).toMatch(/Part 2 of/);
    const all = parts.join("\n");
    for (let i = 0; i < 80; i++) expect(all).toContain(`Movie ${i} `);
    // each message that contains titles carries a category heading
    for (const p of parts.slice(1)) expect(p).toMatch(/PERSONALIZED FOR YOU|RECOMMENDED FOR YOUR FILTERS/);
  });

  it("escape helper handles markup characters", () => {
    expect(esc("<b>&")).toBe("&lt;b&gt;&amp;");
  });
});

describe("digest entry details (runtime, episodes, synopsis)", () => {
  it("shows runtime and a trimmed two-sentence synopsis in Telegram", () => {
    const long = "First sentence here. Second sentence follows. Third sentence must be dropped.";
    const d = composeDigest([rel("m", { runtime_minutes: 142, synopsis: long })], prefs, [], w, now);
    const text = renderTelegram(d).join(" ");
    expect(text).toContain("142 min");
    expect(text).toContain("First sentence here. Second sentence follows.");
    expect(text).not.toContain("Third sentence");
  });
  it("shows episode counts for seasons and grouped episodes", () => {
    const season = rel("s", { content_type: "season", season_number: 2, episode_count: 8, runtime_minutes: 45 });
    const eps = [1, 2].map((n) => rel(`e${n}`, { content_type: "episode", series_tmdb_id: 7, season_number: 3, episode_number: n, runtime_minutes: 30 }));
    const text = renderTelegram(composeDigest([season, ...eps], { ...prefs, contentTypes: [] }, [], w, now)).join(" ");
    expect(text).toContain("8 episodes");
    expect(text).toContain("2 new episodes");
  });
  it("Telegram never shows WATCH/SKIP, even when an AI opinion exists", () => {
    const d = composeDigest([rel("w")], prefs, [], w, now);
    for (const e of [...d.personalized.entries, ...d.filters.entries]) e.rec = { decision: "WATCH", reason: "Great fit.", matchedPreferences: [], confidence: 0.9, dataLimitations: [] };
    const text = renderTelegram(d).join(" ");
    expect(text).not.toMatch(/WATCH|SKIP|Great fit/);
  });
  it("says so when a synopsis is missing instead of inventing one", () => {
    expect(renderTelegram(composeDigest([rel("n", { synopsis: null })], prefs, [], w, now)).join(" ")).toContain("Synopsis not available");
  });
  it("shortSynopsis caps long text and handles empty input", () => {
    expect(shortSynopsis("")).toBeNull();
    expect(shortSynopsis("x ".repeat(300))!.length).toBeLessThanOrEqual(222);
  });
});

describe("validateModelOutput", () => {
  const inputs = [{ id: "a", title: "A", content_type: "movie", synopsis: null, genres: ["Thriller"], languages: ["Hindi"], platforms: [], release_date: "2026-10-12" }];
  it("accepts valid output and strips unsupported preference matches", () => {
    const raw = JSON.stringify({ recommendations: [{ id: "a", decision: "WATCH", reason: "Thriller in Hindi.", matchedPreferences: ["Thriller", "Netflix"], confidence: 0.7, dataLimitations: [] }] });
    const m = validateModelOutput(raw, inputs, prefs);
    expect(m.get("a")?.matchedPreferences).toEqual(["Thriller"]); // Netflix not on this title
  });
  it("accepts a single string where a list is expected", () => {
    const raw = JSON.stringify({ recommendations: [{ id: "a", decision: "SKIP", reason: "Not a fit.", dataLimitations: "No cast data." }] });
    expect(validateModelOutput(raw, inputs, prefs).get("a")?.dataLimitations).toEqual(["No cast data."]);
  });
  it("rejects invalid JSON and invalid decisions", () => {
    expect(() => validateModelOutput("nope", inputs, prefs)).toThrow();
    expect(() => validateModelOutput(JSON.stringify({ recommendations: [{ id: "a", decision: "MAYBE", reason: "xx yy" }] }), inputs, prefs)).toThrow();
  });
  it("ignores ids that were never requested (cannot create release records)", () => {
    const raw = JSON.stringify({ recommendations: [{ id: "ghost", decision: "WATCH", reason: "Looks good." }] });
    expect(validateModelOutput(raw, inputs, prefs).size).toBe(0);
  });
});
