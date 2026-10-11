// RapidAPI "OTT details" adapter. Verified contract (probe, Oct 2026):
//  GET /gettitleDetails?imdbid=tt...  returns { title, genre[], language[], released (YEAR only), type,
//       synopsis, streamingAvailability: { country: { IN: [{ platform, url }] } } }
//  No OTT date, no seasons or episodes. Basic plan: ~1 request/second and a small quota.
// We therefore use it ONLY to confirm which platforms carry a title in India.
import { z } from "zod";
import { requireEnv } from "../env";

// Only India matters, so only the IN list is validated; a malformed entry for another country must not
// discard the whole response. Individual malformed IN items are skipped.
const Item = z.object({ platform: z.string().min(1), url: z.string().nullish() });
const Availability = z.object({
  streamingAvailability: z.object({ country: z.record(z.string(), z.unknown()).optional() }).optional(),
});

export interface RapidAvailability {
  platforms: { platform: string; url?: string | null }[];
  quotaRemaining: number | null;
}

export class RapidRateLimited extends Error {
  constructor() {
    super("RapidAPI rate limit or quota reached");
  }
}

export async function indiaAvailability(imdbId: string, retryDelayMs = 2500, retried = false): Promise<RapidAvailability> {
  const host = process.env.RAPIDAPI_HOST || "ott-details.p.rapidapi.com";
  const res = await fetch(`https://${host}/gettitleDetails?imdbid=${encodeURIComponent(imdbId)}`, {
    headers: { "x-rapidapi-key": requireEnv("RAPIDAPI_KEY"), "x-rapidapi-host": host },
    signal: AbortSignal.timeout(15_000),
  });
  const quota = Number(res.headers.get("x-ratelimit-requests-remaining"));
  if (res.status === 429) {
    // The plan also limits requests per second: wait once and retry before treating it as a quota problem.
    if (!retried) {
      await new Promise((r) => setTimeout(r, retryDelayMs));
      return indiaAvailability(imdbId, retryDelayMs, true);
    }
    throw new RapidRateLimited();
  }
  if (!res.ok) throw new Error(`RapidAPI ${res.status}`);
  const parsed = Availability.safeParse(await res.json());
  if (!parsed.success) throw new Error("RapidAPI response did not match the expected shape");
  const inRaw = parsed.data.streamingAvailability?.country?.IN;
  const inItems = Array.isArray(inRaw) ? inRaw.flatMap((x) => { const p = Item.safeParse(x); return p.success ? [p.data] : []; }) : [];
  return {
    platforms: inItems,
    quotaRemaining: Number.isFinite(quota) ? quota : null,
  };
}
