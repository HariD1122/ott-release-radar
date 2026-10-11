import Filters from "@/components/Filters";
import TitleCard from "@/components/TitleCard";
import { Grid, Notice, PageTitle, Row } from "@/components/ui";
import { requireUser } from "@/lib/auth/auth";
import { distinctValues, getPrefs, listReleases } from "@/lib/catalogue";
import { q } from "@/lib/db";
import { currentParams, filtersFromParams, savedFilters, type SP } from "@/lib/page-helpers";

export default async function Episodes({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const prefs = await getPrefs(user.id);
  const [options, items, followedRows, following] = await Promise.all([
    distinctValues(),
    listReleases(user.id, { ...savedFilters(prefs), ...filtersFromParams(sp), types: ["episode", "season"], limit: 120 }),
    listReleases(user.id, { followedOnly: true, limit: 60 }),
    q<{ series_tmdb_id: number; series_title: string }>("SELECT series_tmdb_id, series_title FROM followed_series WHERE user_id=$1 ORDER BY series_title", [user.id]),
  ]);
  return (
    <>
      <PageTitle title="Episode Updates" sub="Season premieres and episodes with an air date from TMDB. Follow a series from its title page to see its updates here." />
      <Notice>Episode dates are TMDB air dates (calendar dates, not region-specific). Not every show is covered, and a show is not assumed to release weekly.</Notice>
      <Row title="Series you follow" count={following.length} hint={following.map((f) => f.series_title).join(", ") || undefined} empty="You are not following any series yet. Open a series and press Follow.">
        {followedRows.map((r) => <TitleCard key={r.id} release={r} detail={r.content_type === "episode" ? `S${r.season_number}E${r.episode_number}` : `Season ${r.season_number}`} />)}
      </Row>
      <h2 className="mb-2 text-lg font-bold">Episode and season updates matching your filters</h2>
      <Filters action="/episodes" current={currentParams(sp)} options={options} saved={prefs} showDates />
      <Grid releases={items} empty="No episode updates match your saved filters." />
    </>
  );
}
