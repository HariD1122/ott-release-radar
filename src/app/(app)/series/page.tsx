import Filters from "@/components/Filters";
import { Grid, PageTitle } from "@/components/ui";
import { requireUser } from "@/lib/auth/auth";
import { distinctValues, getPrefs, listReleases } from "@/lib/catalogue";
import { currentParams, filtersFromParams, savedFilters, type SP } from "@/lib/page-helpers";

export default async function Series({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const prefs = await getPrefs(user.id);
  const [options, items] = await Promise.all([
    distinctValues(),
    listReleases(user.id, { ...savedFilters(prefs), ...filtersFromParams(sp), types: ["series", "season"], limit: 120 }),
  ]);
  return (
    <>
      <PageTitle title="Series" sub="New series and seasons streaming in India" />
      <Filters action="/series" current={currentParams(sp)} options={options} saved={prefs} showDates />
      <Grid releases={items} empty="No collected series match your saved filters. Clear a filter above to see more." />
    </>
  );
}
