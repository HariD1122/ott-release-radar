import Filters from "@/components/Filters";
import { Grid, Notice, PageTitle } from "@/components/ui";
import { requireUser } from "@/lib/auth/auth";
import { distinctValues, eligibleReleases, listReleases } from "@/lib/catalogue";
import { currentParams, first, type SP } from "@/lib/page-helpers";
import { isUpcoming, toIstDate, weeklyWindow } from "@/lib/time/window";
import Link from "next/link";

export default async function NewReleases({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const kind = first(sp.w) === "completed" ? "completed" : "current";
  const now = new Date();
  const w = weeklyWindow(now, kind);
  const [options, all] = await Promise.all([
    distinctValues(),
    eligibleReleases(user.id, w, kind === "current" ? now : undefined),
  ]);
  const f = { q: first(sp.q)?.toLowerCase(), type: first(sp.type), genre: first(sp.genre), language: first(sp.language), platform: first(sp.platform), from: first(sp.from), to: first(sp.to) };
  const shown = all.filter(
    (r) =>
      (!f.q || r.title.toLowerCase().includes(f.q)) &&
      (!f.type || r.content_type === f.type) &&
      (!f.genre || r.genres.includes(f.genre)) &&
      (!f.language || r.languages.includes(f.language)) &&
      (!f.platform || r.platforms.includes(f.platform)) &&
      (!f.from || (r.release_date ?? "") >= f.from) &&
      (!f.to || (r.release_date ?? "") <= f.to),
  );
  const upcoming = (await listReleases(user.id, { from: toIstDate(now), limit: 200 })).filter((r) => isUpcoming(r, now)).slice(0, 24);

  return (
    <>
      <PageTitle title="New Releases" sub={`Verified releases in the weekly window ${w.startDate} (after 6:00 PM IST) → ${w.endDate} (6:00 PM IST).`} />
      <div className="mb-4 flex gap-2 text-sm">
        <Link className={`btn ${kind === "current" ? "btn-primary" : ""}`} href="/new?w=current">This week so far</Link>
        <Link className={`btn ${kind === "completed" ? "btn-primary" : ""}`} href="/new?w=completed">Last completed week (digest window)</Link>
      </div>
      <Filters action="/new" current={currentParams(sp)} options={options} showType showDates />
      <p className="mb-3 text-sm text-muted">{shown.length} of {all.length} eligible releases.</p>
      <Grid releases={shown} empty="No verified releases match this window and these filters." />
      <h2 className="mb-2 mt-10 text-lg font-bold">Upcoming — not released yet</h2>
      <Notice>These dates are in the future. They are not counted as confirmed releases.</Notice>
      <Grid releases={upcoming} empty="No upcoming releases collected." />
    </>
  );
}
