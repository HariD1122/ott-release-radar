import Filters from "@/components/Filters";
import { Grid, PageTitle } from "@/components/ui";
import { requireUser } from "@/lib/auth/auth";
import { distinctValues, listReleases } from "@/lib/catalogue";
import { currentParams, filtersFromParams, first, type SP } from "@/lib/page-helpers";

export default async function Series({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const t = first(sp.type);
  const types = t === "series" || t === "season" ? [t] : ["series", "season"];
  const [options, items] = await Promise.all([distinctValues(), listReleases(user.id, { ...filtersFromParams(sp), types, limit: 120 })]);
  return (
    <>
      <PageTitle title="Series" sub="New series and new seasons, with season and episode counts where TMDB provides them." />
      <Filters action="/series" current={currentParams(sp)} options={options} showDates />
      <Grid releases={items} empty="No collected series match." />
    </>
  );
}
