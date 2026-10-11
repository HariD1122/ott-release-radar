import Filters from "@/components/Filters";
import { Grid, PageTitle } from "@/components/ui";
import { requireUser } from "@/lib/auth/auth";
import { distinctValues, getPrefs, listReleases } from "@/lib/catalogue";
import { currentParams, filtersFromParams, savedFilters, type SP } from "@/lib/page-helpers";

export default async function Movies({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const prefs = await getPrefs(user.id);
  const [options, items] = await Promise.all([
    distinctValues(),
    listReleases(user.id, { ...savedFilters(prefs), ...filtersFromParams(sp), types: ["movie"], limit: 120 }),
  ]);
  return (
    <>
      <PageTitle title="Movies" sub="Collected movies with a verified India digital release date, filtered by your saved profile filters." />
      <Filters action="/movies" current={currentParams(sp)} options={options} saved={prefs} showDates />
      <Grid releases={items} empty="No collected movies match your saved filters. Clear a filter above to see more." />
    </>
  );
}
