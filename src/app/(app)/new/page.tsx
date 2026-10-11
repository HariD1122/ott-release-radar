import Filters from "@/components/Filters";
import { Grid, Notice, PageTitle } from "@/components/ui";
import { requireUser } from "@/lib/auth/auth";
import { distinctValues, eligibleReleases, getPrefs, listReleases } from "@/lib/catalogue";
import { currentParams, first, savedFilters, type SP } from "@/lib/page-helpers";
import { matchFilters, rankForFilters } from "@/lib/ranking";
import { isUpcoming, toIstDate, weeklyWindow } from "@/lib/time/window";
import Link from "next/link";

export default async function NewReleases({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const kind = first(sp.w) === "completed" ? "completed" : "current";
  const now = new Date();
  const w = weeklyWindow(now, kind);
  const prefs = await getPrefs(user.id);
  const [options, all] = await Promise.all([
    distinctValues(),
    eligibleReleases(user.id, w, kind === "current" ? now : undefined),
  ]);
  const text = first(sp.q)?.toLowerCase();
  const from = first(sp.from);
  const to = first(sp.to);
  // Same matcher the digest uses: only titles matching the saved profile filters are recommended.
  const matching = rankForFilters(all, prefs).filter(
    (r) =>
      (!text || r.title.toLowerCase().includes(text)) &&
      (!from || (r.release_date ?? "") >= from) &&
      (!to || (r.release_date ?? "") <= to),
  );
  const hidden = all.filter((r) => matchFilters(r, prefs) === null).length;
  const upcoming = (await listReleases(user.id, { ...savedFilters(prefs, true), from: toIstDate(now), limit: 200 }))
    .filter((r) => isUpcoming(r, now))
    .slice(0, 24);

  return (
    <>
      <PageTitle title="New Releases" sub={`Verified releases in the weekly window ${w.startDate} (after 6:00 PM IST) → ${w.endDate} (6:00 PM IST), recommended from your saved filters.`} />
      <div className="mb-4 flex gap-2 text-sm">
        <Link className={`btn ${kind === "current" ? "btn-primary" : ""}`} href="/new?w=current">This week so far</Link>
        <Link className={`btn ${kind === "completed" ? "btn-primary" : ""}`} href="/new?w=completed">Last completed week (digest window)</Link>
      </div>
      <Filters action="/new" current={currentParams(sp)} options={options} saved={prefs} showType showDates />
      <p className="mb-3 text-sm text-muted">
        {matching.length} release(s) match your filters. {hidden} other verified release(s) in this window are hidden by your filters.
      </p>
      <Grid releases={matching} empty="No verified releases match your saved filters in this window." />
      <h2 className="mb-2 mt-10 text-lg font-bold">Upcoming — not released yet</h2>
      <Notice>These dates are in the future and match your filters. They are not counted as confirmed releases.</Notice>
      <Grid releases={upcoming} empty="No upcoming releases match your filters." />
    </>
  );
}
