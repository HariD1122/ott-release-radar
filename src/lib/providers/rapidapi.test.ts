import { afterEach, describe, expect, it, vi } from "vitest";
import { indiaAvailability } from "./rapidapi";

const mock = (body: unknown, status = 200) =>
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "x-ratelimit-requests-remaining": "42" } })));

afterEach(() => vi.unstubAllGlobals());
process.env.RAPIDAPI_KEY = "test-key";

describe("indiaAvailability", () => {
  it("returns India platforms and quota", async () => {
    mock({ streamingAvailability: { country: { IN: [{ platform: "hotstar", url: "https://x" }] } } });
    expect(await indiaAvailability("tt1")).toEqual({ platforms: [{ platform: "hotstar", url: "https://x" }], quotaRemaining: 42 });
  });
  it("ignores malformed entries for other countries and bad India items", async () => {
    mock({ streamingAvailability: { country: { US: "garbage", FR: [{ nope: 1 }], IN: [{ platform: "netflix" }, { bad: true }] } } });
    expect((await indiaAvailability("tt1")).platforms).toEqual([{ platform: "netflix" }]);
  });
  it("handles titles with no availability", async () => {
    mock({ title: "x" });
    expect((await indiaAvailability("tt1")).platforms).toEqual([]);
  });
  it("reports rate limiting distinctly", async () => {
    mock({ message: "limit" }, 429);
    await expect(indiaAvailability("tt1", 0)).rejects.toThrow(/rate limit/i);
  });
  it("retries once after a per-second 429 and then succeeds", async () => {
    let n = 0;
    vi.stubGlobal("fetch", vi.fn(async () => (n++ === 0 ? new Response("{}", { status: 429 }) : new Response(JSON.stringify({ streamingAvailability: { country: { IN: [{ platform: "netflix" }] } } }), { status: 200 }))));
    expect((await indiaAvailability("tt1", 0)).platforms).toEqual([{ platform: "netflix" }]);
    expect(n).toBe(2);
  });
});
