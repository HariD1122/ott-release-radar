import Filters from "@/components/Filters";
import { Grid, PageTitle } from "@/components/ui";
import { requireUser } from "@/lib/auth/auth";
import { distinctValues, listReleases } from "@/lib/catalogue";
import { currentParams, filtersFromParams, type SP } from "@/lib/page-helpers";

export default async function Movies({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const [options, items] = await Promise.all([distinctValues(), listReleases(user.id, { ...filtersFromParams(sp), types: ["movie"], limit: 120 })]);
  return (
    <>
      <PageTitle title="Movies" sub="Every collected movie with a verified India digital release date, including titles outside your preferences." />
      <Filters action="/movies" current={currentParams(sp)} options={options} showDates />
      <Grid releases={items} empty="No collected movies match." />
    </>
  );
}
