// Weekly window + release eligibility. This is the ONLY place that decides whether a release
// counts for a week; the website, the manual Telegram send and the automatic send all call it.
//
// Window rule: previous Friday 18:01 IST .. Friday 18:00 IST, both inclusive. IST is a fixed
// UTC+05:30 (India has no daylight saving), so plain offset arithmetic is exact.
//
// Date-only releases (TMDB gives a calendar date, not a time): a release dated D belongs to the
// window where previousFridayDate < D <= fridayDate. That puts every date in exactly one window.
// It is never treated as a confirmed exact time.

export const IST_OFFSET_MIN = 330;
const MIN = 60_000;
const DAY = 24 * 60 * MIN;

export interface WeeklyWindow {
  start: Date; // previous Friday 18:01 IST
  end: Date; // Friday 18:00 IST
  startDate: string; // IST calendar date of the previous Friday (exclusive for date-only)
  endDate: string; // IST calendar date of the closing Friday (inclusive for date-only)
}

export type WindowKind = "completed" | "current";

export function toIstDate(d: Date): string {
  return new Date(d.getTime() + IST_OFFSET_MIN * MIN).toISOString().slice(0, 10);
}

/** Closing Friday 18:00 IST at or before `now`. */
function lastFridayClose(now: Date): Date {
  const wall = new Date(now.getTime() + IST_OFFSET_MIN * MIN); // IST wall clock read via getUTC*
  const back = (wall.getUTCDay() - 5 + 7) % 7;
  let closeWall = Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate() - back, 18, 0, 0);
  if (closeWall > wall.getTime()) closeWall -= 7 * DAY; // it is Friday but before 18:00
  return new Date(closeWall - IST_OFFSET_MIN * MIN);
}

export function windowEndingAt(end: Date): WeeklyWindow {
  const prevClose = new Date(end.getTime() - 7 * DAY);
  return {
    start: new Date(prevClose.getTime() + MIN),
    end,
    startDate: toIstDate(prevClose),
    endDate: toIstDate(end),
  };
}

/**
 * "completed": the latest window whose closing Friday 18:00 IST is <= now (used by digests).
 * "current": the window still in progress, closing on the next Friday 18:00 IST.
 */
export function weeklyWindow(now: Date, kind: WindowKind = "completed"): WeeklyWindow {
  const close = lastFridayClose(now);
  return windowEndingAt(kind === "completed" ? close : new Date(close.getTime() + 7 * DAY));
}

export interface EligibilityInput {
  release_date: string | null; // YYYY-MM-DD (IST calendar date)
  release_at: Date | string | null;
  release_precision: "date" | "datetime";
  release_date_type: string;
  verification_status: "verified" | "date_only" | "unverified";
}

/** Date types that are real OTT/streaming events. Theatrical dates are never accepted. */
export const OTT_DATE_TYPES = new Set(["ott_digital_in", "tv_season_air_date", "tv_episode_air_date"]);

export function isEligible(r: EligibilityInput, w: WeeklyWindow, asOf?: Date): boolean {
  if (r.verification_status === "unverified") return false;
  if (!OTT_DATE_TYPES.has(r.release_date_type)) return false;
  if (r.release_precision === "datetime" && r.release_at) {
    const t = new Date(r.release_at).getTime();
    if (asOf && t > asOf.getTime()) return false;
    return t >= w.start.getTime() && t <= w.end.getTime();
  }
  if (!r.release_date) return false;
  if (asOf && r.release_date > toIstDate(asOf)) return false; // not out yet
  return r.release_date > w.startDate && r.release_date <= w.endDate;
}

/** Date-only or timestamped release that has not happened yet (shown separately as "upcoming"). */
export function isUpcoming(r: EligibilityInput, now: Date): boolean {
  if (r.verification_status === "unverified" || !OTT_DATE_TYPES.has(r.release_date_type)) return false;
  if (r.release_precision === "datetime" && r.release_at) return new Date(r.release_at).getTime() > now.getTime();
  return !!r.release_date && r.release_date > toIstDate(now);
}

export function formatIst(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}
