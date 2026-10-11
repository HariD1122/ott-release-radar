// Normalises genres, languages, platforms and preference values so every part of the app agrees.

export const LANGUAGE_NAMES: Record<string, string> = {
  hi: "Hindi", en: "English", ta: "Tamil", te: "Telugu", ml: "Malayalam", kn: "Kannada",
  bn: "Bengali", mr: "Marathi", pa: "Punjabi", gu: "Gujarati", ur: "Urdu", ko: "Korean",
  ja: "Japanese", es: "Spanish", fr: "French", de: "German", zh: "Chinese", th: "Thai",
  tr: "Turkish", it: "Italian", pt: "Portuguese", ru: "Russian", ar: "Arabic", id: "Indonesian",
};

export function languageName(code: string | null | undefined): string | null {
  if (!code || code === "xx" || code === "cn") return null;
  return LANGUAGE_NAMES[code] ?? code.toUpperCase();
}

/** TMDB genre names to ours. TV combines genres ("Sci-Fi & Fantasy"), so split them. TMDB has no "Indie" genre. */
export function normalizeGenres(names: string[]): string[] {
  const out = new Set<string>();
  for (const n of names) {
    if (n === "Sci-Fi & Fantasy") ["Science Fiction", "Fantasy"].forEach((g) => out.add(g));
    else if (n === "Action & Adventure") ["Action", "Adventure"].forEach((g) => out.add(g));
    else if (n === "War & Politics") ["War", "Politics"].forEach((g) => out.add(g));
    else out.add(n);
  }
  return [...out];
}

export const GENRE_OPTIONS = [
  "Action", "Adventure", "Animation", "Comedy", "Crime", "Documentary", "Drama", "Family", "Fantasy",
  "History", "Horror", "Music", "Mystery", "Romance", "Science Fiction", "Thriller", "War",
];

export const LANGUAGE_OPTIONS = ["Hindi", "English", "Tamil", "Telugu", "Malayalam", "Kannada", "Bengali", "Marathi", "Punjabi", "Gujarati", "Korean", "Japanese"];

export const PLATFORM_OPTIONS = [
  "Netflix", "Amazon Prime Video", "JioHotstar", "Zee5", "Sony LIV", "Apple TV+", "Lionsgate Play",
  "Aha", "SunNXT", "MX Player",
];

const PLATFORM_ALIASES: Array<[RegExp, string]> = [
  [/^netflix(?! kids)/i, "Netflix"],
  [/^(amazon prime video|prime video|prime|amazon video)(?!.*channel)/i, "Amazon Prime Video"],
  [/(jio ?hotstar|disney\+? ?hotstar|hotstar)/i, "JioHotstar"],
  [/^zee ?5/i, "Zee5"],
  [/^sony ?liv/i, "Sony LIV"],
  [/^apple tv\+?$|^appletv\+?$/i, "Apple TV+"],
  [/^lionsgate/i, "Lionsgate Play"],
  [/^aha$/i, "Aha"],
  [/^sun ?nxt/i, "SunNXT"],
  [/^mx ?player/i, "MX Player"],
];

/** Store/rental front-ends are not subscription OTT platforms. */
const STORE_PLATFORMS = /^(itunes|apple ?tv ?store|play|google ?play|youtube)/i;

export function canonicalPlatform(raw: string): { name: string; store: boolean } {
  const s = raw.trim();
  for (const [re, name] of PLATFORM_ALIASES) if (re.test(s)) return { name, store: false };
  if (STORE_PLATFORMS.test(s)) return { name: s, store: true };
  return { name: s, store: false };
}

export const CONTENT_TYPE_OPTIONS = [
  { value: "movie", label: "Movies" },
  { value: "series", label: "Newly released series" },
  { value: "season", label: "New seasons" },
  { value: "episode", label: "New episodes" },
] as const;

export type ContentType = "movie" | "series" | "season" | "episode";

export const CONTENT_TYPE_LABEL: Record<ContentType, string> = {
  movie: "Movie",
  series: "New series",
  season: "New season",
  episode: "New episode",
};
