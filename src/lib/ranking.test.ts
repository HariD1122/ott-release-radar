import { describe, expect, it } from "vitest";
import { MIN_FEEDBACK, rankForFilters, rankPersonalized, type FeedbackItem, type Prefs, type Rankable } from "./ranking";

const mk = (id: string, genres: string[], date: string, extra: Partial<Rankable> = {}): Rankable => ({
  id, title: `T-${id}`, content_type: "movie", genres, languages: ["Hindi"], platforms: ["Netflix"],
  release_date: date, release_at: null, ...extra,
});
const prefs: Prefs = { genres: ["Thriller", "Drama"], languages: ["Hindi"], platforms: ["Netflix"], contentTypes: ["movie"] };
const today = "2026-10-16";
const fb = (releaseId: string, value: "like" | "dislike", genres: string[]): FeedbackItem => ({
  value, releaseId, genres, languages: ["Hindi"], platforms: ["Netflix"], content_type: "movie",
});

const releases = [
  mk("a", ["Thriller"], "2026-10-14"),
  mk("b", ["Drama"], "2026-10-15"),
  mk("c", ["Thriller", "Drama"], "2026-10-13"),
  mk("d", ["Comedy"], "2026-10-12"),
];
const order = (r: { item: Rankable }[]) => r.map((x) => x.item.id);

describe("rankPersonalized", () => {
  it("shows preference-based results and says feedback is inactive with too little feedback", () => {
    const r = rankPersonalized(releases, prefs, [fb("x", "like", ["Drama"])], today);
    expect(r.feedbackActive).toBe(false);
    expect(order(r.ranked)).not.toContain("d"); // Comedy: no genre match and no positive feedback signal
  });
  it("Like feedback can change the order", () => {
    const base = order(rankPersonalized(releases, prefs, [], today).ranked);
    const likes = Array.from({ length: MIN_FEEDBACK + 2 }, (_, i) => fb(`l${i}`, "like", ["Drama"]));
    const after = order(rankPersonalized(releases, prefs, likes, today).ranked);
    expect(after).not.toEqual(base);
    expect(after.indexOf("b")).toBeLessThan(base.indexOf("b") + 1);
  });
  it("Dislike feedback can change the order", () => {
    const base = order(rankPersonalized(releases, prefs, [], today).ranked);
    const dislikes = Array.from({ length: MIN_FEEDBACK + 2 }, (_, i) => fb(`d${i}`, "dislike", ["Thriller"]));
    const after = order(rankPersonalized(releases, prefs, dislikes, today).ranked);
    expect(after).not.toEqual(base);
  });
  it("drops a directly disliked title from the personalised list", () => {
    const r = rankPersonalized(releases, prefs, [fb("a", "dislike", ["Thriller"])], today);
    expect(order(r.ranked)).not.toContain("a");
  });
  it("does not overreact to a single reaction", () => {
    const one = rankPersonalized(releases, prefs, [fb("z", "like", ["Drama"])], today);
    expect(one.feedbackActive).toBe(false);
  });
  it("updates when preferences change", () => {
    const r = rankPersonalized(releases, { ...prefs, genres: ["Comedy"] }, [], today);
    expect(order(r.ranked)[0]).toBe("d");
  });
});

describe("rankForFilters", () => {
  it("is neutral: newest first and ignores feedback entirely", () => {
    const ids = rankForFilters(releases, prefs).map((r) => r.id);
    expect(ids).toEqual(["b", "a", "c"]);
  });
  it("keeps a disliked title (the function takes no feedback at all)", () => {
    expect(rankForFilters(releases, prefs).map((r) => r.id)).toContain("a");
    expect(rankForFilters.length).toBe(2); // (releases, prefs) - there is no feedback parameter
  });
  it("updates when preferences change", () => {
    expect(rankForFilters(releases, { ...prefs, genres: ["Comedy"] }).map((r) => r.id)).toEqual(["d"]);
  });
  it("does not treat an unconfirmed platform as a match", () => {
    const r = [mk("p", ["Thriller"], "2026-10-14", { platforms: [] })];
    expect(rankForFilters(r, prefs)).toEqual([]);
  });
});
