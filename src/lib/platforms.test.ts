import { describe, expect, it } from "vitest";
import { mergePlatforms, rapidToDetails, type PlatformDetail } from "./platforms";

const tm = (name: string, kind: PlatformDetail["kind"] = "subscription"): PlatformDetail => ({ name, kind, source: "tmdb" });

describe("mergePlatforms", () => {
  it("is confirmed_both when both sources agree", () => {
    const d = [tm("Netflix"), ...rapidToDetails([{ platform: "netflix" }])];
    expect(mergePlatforms(d)).toEqual({ platforms: ["Netflix"], status: "confirmed_both" });
  });
  it("is tmdb_only / rapidapi_only / unknown otherwise", () => {
    expect(mergePlatforms([tm("Zee5")]).status).toBe("tmdb_only");
    expect(mergePlatforms(rapidToDetails([{ platform: "hotstar" }])).status).toBe("rapidapi_only");
    expect(mergePlatforms([]).status).toBe("unknown");
  });
  it("ignores rent/buy and store front-ends as OTT platforms", () => {
    const d = [tm("Apple TV", "rent"), ...rapidToDetails([{ platform: "itunes" }, { platform: "play" }])];
    expect(mergePlatforms(d)).toEqual({ platforms: [], status: "unknown" });
  });
});
