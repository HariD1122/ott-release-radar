/** At most two sentences, capped in length, so it fits on two lines. Never invents text: it only trims the source synopsis. */
export function shortSynopsis(s: string | null | undefined, max = 220): string | null {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  const sentences = t.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? [t];
  let out = sentences.slice(0, 2).join("").trim();
  if (out.length > max) out = out.slice(0, max).replace(/\s+\S*$/, "") + "…";
  return out;
}

/** Human-readable release date. Date-only sources are labelled so they are never mistaken for an exact time. */
export function dateText(r: { release_date: string | null; release_precision: "date" | "datetime" }): string {
  if (!r.release_date) return "Release date unavailable";
  const d = new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(
    new Date(r.release_date + "T00:00:00Z"),
  );
  return r.release_precision === "date" ? `${d} (date only)` : d;
}
