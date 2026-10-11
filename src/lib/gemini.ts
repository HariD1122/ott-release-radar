// Gemini = opinion layer only. It never supplies dates, platforms, episode numbers or title facts;
// those come from the database. Output is validated; anything invalid is rejected.
import { GoogleGenAI } from "@google/genai";
import { createHash } from "node:crypto";
import { z } from "zod";
import { q } from "./db";
import { requireEnv } from "./env";
import type { Prefs } from "./ranking";

export interface RecInput {
  id: string;
  title: string;
  content_type: string;
  synopsis: string | null;
  genres: string[];
  languages: string[];
  platforms: string[];
  release_date: string | null;
  season_number?: number | null;
}

export interface Rec {
  decision: "WATCH" | "SKIP";
  reason: string;
  matchedPreferences: string[];
  confidence: number | null;
  dataLimitations: string[];
}

/** Models sometimes return a single string where a list is expected; accept that, reject anything else. */
const list = z.preprocess((v) => (typeof v === "string" ? [v] : v ?? []), z.array(z.string()));

const ItemSchema = z.object({
  id: z.string(),
  decision: z.enum(["WATCH", "SKIP"]),
  reason: z.string().min(3),
  matchedPreferences: list,
  confidence: z.number().min(0).max(1).nullish(),
  dataLimitations: list,
});
export const ResponseSchema = z.object({ recommendations: z.array(ItemSchema) });
const Envelope = z.object({ recommendations: z.array(z.unknown()) });

/** Validates model output and drops anything not backed by the input (unknown ids, invented preference matches). */
export function validateModelOutput(raw: string, inputs: RecInput[], prefs: Prefs): Map<string, Rec> {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error("Gemini returned invalid JSON");
  }
  const env = Envelope.safeParse(json);
  if (!env.success) throw new Error("Gemini output failed validation");
  // Validate item by item: one malformed item must not discard the rest of the batch.
  const items = env.data.recommendations.flatMap((x) => {
    const p = ItemSchema.safeParse(x);
    return p.success ? [p.data] : [];
  });
  if (!items.length && env.data.recommendations.length) throw new Error("Gemini output failed validation");
  const parsed = { data: { recommendations: items } };
  const byId = new Map(inputs.map((i) => [i.id, i]));
  const allowed = new Set([...prefs.genres, ...prefs.languages, ...prefs.platforms]);
  const out = new Map<string, Rec>();
  for (const r of parsed.data.recommendations) {
    const src = byId.get(r.id);
    if (!src) continue;
    const have = new Set([...src.genres, ...src.languages, ...src.platforms]);
    out.set(r.id, {
      decision: r.decision,
      reason: r.reason.trim().slice(0, 400),
      matchedPreferences: r.matchedPreferences.map((m) => m.replace(/^(genres?|languages?|platforms?):\s*/i, "")).filter((m) => allowed.has(m) && have.has(m)),
      confidence: r.confidence ?? null,
      dataLimitations: r.dataLimitations,
    });
  }
  return out;
}

function cacheKey(i: RecInput, prefs: Prefs, model: string, fbSig: string) {
  return createHash("sha1")
    .update(JSON.stringify([i.title, i.synopsis, i.genres, i.languages, i.platforms, i.release_date, i.season_number, prefs, model, fbSig]))
    .digest("hex");
}

async function callGemini(inputs: RecInput[], prefs: Prefs, fbSummary: string, model: string): Promise<Map<string, Rec>> {
  const ai = new GoogleGenAI({ apiKey: requireEnv("GEMINI_API_KEY"), httpOptions: { timeout: 45_000 } });
  const prompt = `You help one person decide whether to watch newly released OTT titles in India.
Use ONLY the facts below. Do not invent cast, ratings, release dates, platforms or plot. If something is missing, say so in dataLimitations.
The user's saved preferences: ${JSON.stringify(prefs)}.
Feedback signal: ${fbSummary}
For each title return decision WATCH or SKIP, a reason of at most two short sentences that cites only the facts or preferences above, matchedPreferences (exact values from the preferences that this title really has), confidence 0..1, and dataLimitations.
Respond as JSON: {"recommendations":[{"id","decision","reason","matchedPreferences","confidence","dataLimitations"}]}.
Titles: ${JSON.stringify(inputs.map((i) => ({ ...i, synopsis: i.synopsis?.slice(0, 500) ?? null })))}`;
  const res = await ai.models.generateContent({
    model,
    contents: prompt,
    config: { responseMimeType: "application/json", temperature: 0.2, thinkingConfig: { thinkingBudget: 0 } },
  });
  try {
    return validateModelOutput(res.text ?? "", inputs, prefs);
  } catch (e) {
    console.error("Gemini validation failed. Output starts:", (res.text ?? "").slice(0, 400)); // titles only, no secrets
    throw e;
  }
}

export interface EnsureResult {
  recs: Map<string, Rec>;
  error: string | null;
}

/** Returns cached recommendations, generating missing ones in one batch. Never throws: failures return `error`. */
export async function ensureRecommendations(
  userId: string,
  inputs: RecInput[],
  prefs: Prefs,
  fbSummary: string,
  opts: { generate?: boolean; max?: number } = {},
): Promise<EnsureResult> {
  const model = process.env.GEMINI_MODEL;
  const recs = new Map<string, Rec>();
  if (!inputs.length) return { recs, error: null };
  if (!model) return { recs, error: "GEMINI_MODEL is not configured" };
  const keys = new Map(inputs.map((i) => [i.id, cacheKey(i, prefs, model, fbSummary)]));
  const cached = await q<{
    release_id: string; cache_key: string; decision: "WATCH" | "SKIP"; explanation: string;
    confidence: string | null; matched_preferences: string[]; data_limitations: string[];
  }>("SELECT release_id, cache_key, decision, explanation, confidence::text, matched_preferences, data_limitations FROM recommendations WHERE user_id=$1 AND release_id = ANY($2)", [userId, inputs.map((i) => i.id)]);
  for (const c of cached) {
    if (keys.get(c.release_id) === c.cache_key) {
      recs.set(c.release_id, {
        decision: c.decision, reason: c.explanation, matchedPreferences: c.matched_preferences,
        confidence: c.confidence ? Number(c.confidence) : null, dataLimitations: c.data_limitations,
      });
    }
  }
  const missing = inputs.filter((i) => !recs.has(i.id)).slice(0, opts.max ?? 25);
  if (!missing.length || opts.generate === false) return { recs, error: null };
  try {
    const fresh = await callGemini(missing, prefs, fbSummary, model);
    for (const [id, r] of fresh) {
      recs.set(id, r);
      await q(
        `INSERT INTO recommendations (user_id, release_id, decision, explanation, confidence, matched_preferences, data_limitations, model_id, cache_key)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (user_id, release_id) DO UPDATE SET decision=$3, explanation=$4, confidence=$5,
           matched_preferences=$6, data_limitations=$7, model_id=$8, cache_key=$9, generated_at=now()`,
        [userId, id, r.decision, r.reason, r.confidence, r.matchedPreferences, r.dataLimitations, model, keys.get(id)],
      );
    }
    return { recs, error: null };
  } catch (e) {
    const raw = (e as Error).message;
    let msg = raw;
    try { msg = JSON.parse(raw).error?.message ?? raw; } catch {}
    return { recs, error: `AI recommendations unavailable: ${msg.slice(0, 140)}` };
  }
}
