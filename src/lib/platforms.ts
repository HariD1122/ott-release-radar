// Merges platform evidence from TMDB (watch providers, India) and RapidAPI (India availability).
import { canonicalPlatform } from "./taxonomy";

export interface PlatformDetail {
  name: string;
  kind: "subscription" | "free_ads" | "rent" | "buy" | "store";
  source: "tmdb" | "rapidapi";
  url?: string | null;
}

export type PlatformStatus = "confirmed_both" | "tmdb_only" | "rapidapi_only" | "unknown";

export function rapidToDetails(items: { platform: string; url?: string | null }[]): PlatformDetail[] {
  return items.map((i) => {
    const c = canonicalPlatform(i.platform);
    return { name: c.name, kind: c.store ? "store" : "subscription", source: "rapidapi", url: i.url };
  });
}

/** Subscription (or free-with-ads) platforms only: rent/buy/store entries do not count as an OTT platform. */
export function mergePlatforms(details: PlatformDetail[]): { platforms: string[]; status: PlatformStatus } {
  const isStreaming = (d: PlatformDetail) => d.kind === "subscription" || d.kind === "free_ads";
  const tmdb = new Set(details.filter((d) => d.source === "tmdb" && isStreaming(d)).map((d) => d.name));
  const rapid = new Set(details.filter((d) => d.source === "rapidapi" && isStreaming(d)).map((d) => d.name));
  const platforms = [...new Set([...tmdb, ...rapid])];
  const both = [...tmdb].some((n) => rapid.has(n));
  const status: PlatformStatus =
    both ? "confirmed_both" : tmdb.size ? "tmdb_only" : rapid.size ? "rapidapi_only" : "unknown";
  return { platforms, status };
}
