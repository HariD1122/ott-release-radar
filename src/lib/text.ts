/** At most two sentences, capped in length, so it fits on two lines. Never invents text: it only trims the source synopsis. */
export function shortSynopsis(s: string | null | undefined, max = 220): string | null {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  const sentences = t.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? [t];
  let out = sentences.slice(0, 2).join("").trim();
  if (out.length > max) out = out.slice(0, max).replace(/\s+\S*$/, "") + "…";
  return out;
}
