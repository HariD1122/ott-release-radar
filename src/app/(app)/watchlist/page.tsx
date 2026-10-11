import { Grid, PageTitle } from "@/components/ui";
import { requireUser } from "@/lib/auth/auth";
import { listReleases } from "@/lib/catalogue";

export default async function Watchlist() {
  const user = await requireUser();
  const items = await listReleases(user.id, { watchlistOnly: true, limit: 200 });
  return (
    <>
      <PageTitle title="My Watchlist" sub="Titles you saved manually. Changing preferences never removes anything here." />
      <Grid releases={items} empty="Nothing saved yet. Use the bookmark button on any title card." />
    </>
  );
}
