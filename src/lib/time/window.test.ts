import { describe, expect, it } from "vitest";
import { isEligible, weeklyWindow, windowEndingAt, type EligibilityInput } from "./window";

// 2026-10-16 is a Friday. 18:00 IST = 12:30 UTC.
const FRI_CLOSE = new Date("2026-10-16T12:30:00Z");

const base: EligibilityInput = {
  release_date: null,
  release_at: null,
  release_precision: "date",
  release_date_type: "ott_digital_in",
  verification_status: "date_only",
};

describe("weeklyWindow", () => {
  it("matches the spec example for a run exactly at Friday 18:00 IST", () => {
    const w = weeklyWindow(FRI_CLOSE);
    expect(w.end.toISOString()).toBe("2026-10-16T12:30:00.000Z");
    // previous Friday 9 Oct 18:01 IST = 12:31 UTC
    expect(w.start.toISOString()).toBe("2026-10-09T12:31:00.000Z");
    expect(w.startDate).toBe("2026-10-09");
    expect(w.endDate).toBe("2026-10-16");
  });
  it("uses the previous window when it is Friday before 18:00 IST", () => {
    const w = weeklyWindow(new Date("2026-10-16T12:29:59Z"));
    expect(w.endDate).toBe("2026-10-09");
  });
  it("tolerates cron jitter after 18:00 (same window until next Friday)", () => {
    expect(weeklyWindow(new Date("2026-10-16T13:20:00Z")).endDate).toBe("2026-10-16");
    expect(weeklyWindow(new Date("2026-10-20T05:00:00Z")).endDate).toBe("2026-10-16");
  });
  it("'current' window closes the next Friday", () => {
    expect(weeklyWindow(new Date("2026-10-20T05:00:00Z"), "current").endDate).toBe("2026-10-23");
  });
  it("uses the IST date, not the UTC date, near midnight", () => {
    // 2026-10-16 19:00 UTC is already Saturday 00:30 IST
    expect(weeklyWindow(new Date("2026-10-16T19:00:00Z")).endDate).toBe("2026-10-16");
  });
});

describe("isEligible - timestamped", () => {
  const w = windowEndingAt(FRI_CLOSE);
  const ts = (iso: string): EligibilityInput => ({
    ...base,
    release_at: new Date(iso),
    release_precision: "datetime",
    verification_status: "verified",
  });
  it("includes both inclusive boundaries", () => {
    expect(isEligible(ts("2026-10-09T12:31:00Z"), w)).toBe(true); // Fri 18:01 IST
    expect(isEligible(ts("2026-10-16T12:30:00Z"), w)).toBe(true); // Fri 18:00 IST
  });
  it("excludes just outside both boundaries", () => {
    expect(isEligible(ts("2026-10-09T12:30:59Z"), w)).toBe(false); // 18:00:59 prev Friday
    expect(isEligible(ts("2026-10-16T12:30:01Z"), w)).toBe(false);
  });
});

describe("isEligible - date only", () => {
  const w = windowEndingAt(FRI_CLOSE);
  const d = (date: string, extra: Partial<EligibilityInput> = {}): EligibilityInput => ({
    ...base,
    release_date: date,
    ...extra,
  });
  it("assigns each calendar date to exactly one window", () => {
    expect(isEligible(d("2026-10-09"), w)).toBe(false); // belongs to the previous window
    expect(isEligible(d("2026-10-10"), w)).toBe(true);
    expect(isEligible(d("2026-10-16"), w)).toBe(true);
    expect(isEligible(d("2026-10-17"), w)).toBe(false);
  });
  it("rejects unknown/unverified dates and theatrical date types", () => {
    expect(isEligible({ ...base, release_date: null }, w)).toBe(false);
    expect(isEligible(d("2026-10-12", { verification_status: "unverified" }), w)).toBe(false);
    expect(isEligible(d("2026-10-12", { release_date_type: "theatrical" }), w)).toBe(false);
  });
  it("does not count releases after asOf as available", () => {
    expect(isEligible(d("2026-10-14"), w, new Date("2026-10-12T00:00:00Z"))).toBe(false);
    expect(isEligible(d("2026-10-11"), w, new Date("2026-10-12T00:00:00Z"))).toBe(true);
  });
});
