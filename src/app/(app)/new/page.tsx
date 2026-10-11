import Filters from "@/components/Filters";
import { Grid, PageTitle, Segmented, StatPills } from "@/components/ui";
import { requireUser } from "@/lib/auth/auth";
import { distinctValues, eligibleReleases, getPrefs, listReleases } from "@/lib/catalogue";
import { currentParams, first, savedFilters, type SP } from "@/lib/page-helpers";
import { matchFilters, rankForFilters } from "@/lib/ranking";
import { isUpcoming, toIstDate, weeklyWindow } from "@/lib/time/window";

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
      <PageTitle
        title="New Releases"
        sub={`${w.startDate} → ${w.endDate}, 6 PM IST`}
        right={
          <Segmented
            active={kind}
            options={[
              { key: "current", label: "This week so far", href: "/new?w=current" },
              { key: "completed", label: "Last completed week", href: "/new?w=completed" },
            ]}
          />
        }
      />
      <Filters action="/new" current={currentParams(sp)} options={options} saved={prefs} showType showDates />
      <StatPills
        items={[
          { label: "match your filters", value: matching.length, tone: "green" },
          { label: "hidden by filters", value: hidden, tone: "slate" },
          { label: "upcoming", value: upcoming.length, tone: "amber" },
        ]}
      />
      <Grid releases={matching} empty="No verified releases match your saved filters in this window." />
      <h2 className="mb-3 mt-10 flex items-center gap-2 text-xl font-bold tracking-tight">Upcoming <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900">Not released yet</span></h2>
      <Grid releases={upcoming} empty="No upcoming releases match your filters." />
    </>
  );
}
