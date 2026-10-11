// Phase 1 probe: records what the OTT Details API really returns.
// Usage: node --env-file=.env.local scripts/probe-rapidapi.mjs
// Saves raw responses to scripts/probe-output/ (git-ignored). Never prints the key.
import { mkdirSync, writeFileSync } from "node:fs";

const key = process.env.RAPIDAPI_KEY;
const host = process.env.RAPIDAPI_HOST || "ott-details.p.rapidapi.com";
if (!key) { console.error("RAPIDAPI_KEY missing in .env.local"); process.exit(1); }

// Candidate endpoints from the public listing; each result tells us whether it exists.
const candidates = [
  "/advancedsearch?start_year=2026&end_year=2026&min_imdb=6&max_imdb=10&genre=drama&language=hindi&type=movie&sort=latest&page=1",
  "/getnew?region=IN&page=1",
  "/getnew?region=IN&page=1&type=series",
  "/gettitleDetails?imdbid=tt0111161",
  "/getFreshTitles?region=IN",
  "/search?title=Sacred%20Games&page=1",
];
mkdirSync("scripts/probe-output", { recursive: true });
for (const path of candidates) {
  await new Promise(r => setTimeout(r, 2000));
  try {
    const res = await fetch(`https://${host}${path}`, {
      headers: { "x-rapidapi-key": key, "x-rapidapi-host": host },
    });
    const body = await res.text();
    const name = path.split("?")[0].replace(/\W/g, "_");
    writeFileSync(`scripts/probe-output/${name}.json`, body);
    console.log(res.status, path.split("?")[0],
      "| quota-remaining:", res.headers.get("x-ratelimit-requests-remaining"),
      "| bytes:", body.length);
  } catch (e) { console.log("ERR", path, e.message); }
}
