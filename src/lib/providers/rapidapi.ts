// RapidAPI "OTT details" adapter. Verified contract (probe, Oct 2026):
//  GET /gettitleDetails?imdbid=tt...  returns { title, genre[], language[], released (YEAR only), type,
//       synopsis, streamingAvailability: { country: { IN: [{ platform, url }] } } }
//  No OTT date, no seasons or episodes. Basic plan: ~1 request/second and a small quota.
// We therefore use it ONLY to confirm which platforms carry a title in India.
import { z } from "zod";
import { requireEnv } from "../env";

const Availability = z.object({
  streamingAvailability: z
    .object({
      country: z
        .record(z.string(), z.array(z.object({ platform: z.string(), url: z.string().nullish() })))
        .optional(),
    })
    .optional(),
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

export async function indiaAvailability(imdbId: string): Promise<RapidAvailability> {
  const host = process.env.RAPIDAPI_HOST || "ott-details.p.rapidapi.com";
  const res = await fetch(`https://${host}/gettitleDetails?imdbid=${encodeURIComponent(imdbId)}`, {
    headers: { "x-rapidapi-key": requireEnv("RAPIDAPI_KEY"), "x-rapidapi-host": host },
    signal: AbortSignal.timeout(15_000),
  });
  const quota = Number(res.headers.get("x-ratelimit-requests-remaining"));
  if (res.status === 429) throw new RapidRateLimited();
  if (!res.ok) throw new Error(`RapidAPI ${res.status}`);
  const parsed = Availability.safeParse(await res.json());
  if (!parsed.success) throw new Error("RapidAPI response did not match the expected shape");
  return {
    platforms: parsed.data.streamingAvailability?.country?.IN ?? [],
    quotaRemaining: Number.isFinite(quota) ? quota : null,
  };
}
