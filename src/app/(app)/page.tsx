import ApiButton from "@/components/ApiButton";
import Filters from "@/components/Filters";
import TitleCard from "@/components/TitleCard";
import { Notice, PageTitle, Row } from "@/components/ui";
import { counts, distinctValues, eligibleReleases, listReleases } from "@/lib/catalogue";
import { requireUser } from "@/lib/auth/auth";
import { buildDigest } from "@/lib/digest";
import { getPrefs } from "@/lib/catalogue";
import { first, savedFilters, type SP } from "@/lib/page-helpers";
import { matchFilters } from "@/lib/ranking";
import { toIstDate, weeklyWindow } from "@/lib/time/window";
import Link from "next/link";

const rec = (r: { rec_decision: "WATCH" | "SKIP" | null; rec_explanation: string | null }) =>
  r.rec_decision && r.rec_explanation ? { decision: r.rec_decision, reason: r.rec_explanation } : null;

export default async function Dashboard({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const search = first((await searchParams).q);
  const now = new Date();
  const today = toIstDate(now);
  const win = weeklyWindow(now, "current");

  if (search) {
    const found = await listReleases(user.id, { search, limit: 60 });
    return (
      <>
        <PageTitle title={`Search: "${search}"`} sub={`${found.length} result(s) in the collected catalogue`} />
        <Row title="Results" empty="No collected titles match that search.">
          {found.map((r) => <TitleCard key={r.id} release={r} rec={rec(r)} />)}
        </Row>
      </>
    );
  }

  const prefs = await getPrefs(user.id);
  const f = savedFilters(prefs);
  const [options, c, digest, thisWeekAll, movies, series, seasons, episodes, watch] = await Promise.all([
    distinctValues(),
    counts(),
    buildDigest(user.id, { ai: "cached" }),
    eligibleReleases(user.id, win, now),
    listReleases(user.id, { ...f, types: ["movie"], to: today, limit: 12 }),
    listReleases(user.id, { ...f, types: ["series"], to: today, limit: 12 }),
    listReleases(user.id, { ...f, types: ["season"], to: today, limit: 12 }),
    listReleases(user.id, { ...f, types: ["episode"], to: today, limit: 12 }),
    listReleases(user.id, { watchlistOnly: true, limit: 24 }),
  ]);
  const thisWeek = thisWeekAll.filter((r) => matchFilters(r, prefs) !== null);
  const genreRows = await Promise.all(prefs.genres.slice(0, 3).map(async (g) => ({ g, items: await listReleases(user.id, { ...f, genres: [g], to: today, limit: 12 }) })));
  const langRows = await Promise.all(prefs.languages.slice(0, 3).map(async (l) => ({ l, items: await listReleases(user.id, { ...f, languages: [l], to: today, limit: 12 }) })));

  return (
    <>
      <PageTitle
        title="Home"
        sub={`${c.total} collected records: ${c.movies} movies, ${c.series} new series, ${c.seasons} new seasons, ${c.episodes} episodes.`}
        right={
          <div className="flex flex-wrap items-start gap-3">
            <ApiButton url="/api/digest/send" primary confirm="Send this week's digest to Telegram now?">Send This Week&apos;s List Now</ApiButton>
            <ApiButton url="/api/collect" kind="collect">Refresh Data</ApiButton>
          </div>
        }
      />
      <Filters action="/" current={{}} options={options} saved={prefs} showType showText={false} />
      {c.total === 0 && <Notice tone="warn">No data has been collected yet. Press Refresh Data to fetch releases.</Notice>}

      <Row title="New This Week" count={thisWeek.length} hint={`Released so far in the current weekly window (closes ${win.endDate} 6:00 PM IST) and matching your saved filters.`} empty="No verified releases yet in the current weekly window.">
        {thisWeek.slice(0, 24).map((r) => <TitleCard key={r.id} release={r} rec={rec(r)} />)}
      </Row>

      <Row
        title="Personalized for You"
        count={digest.personalized.entries.length}
        hint={`Last completed window (${digest.window.startDate} → ${digest.window.endDate}). ${digest.personalized.feedbackActive ? `Uses your preferences and ${digest.personalized.feedbackCount} reactions.` : "Preference-based for now; Like/Dislike titles to improve it."}`}
        empty="No personalized matches are available for this weekly window."
      >
        {digest.personalized.entries.slice(0, 20).map((e) => digest.cards[e.releaseId] && <TitleCard key={e.key} release={digest.cards[e.releaseId]} detail={e.detail} reasons={e.reasons} rec={rec(digest.cards[e.releaseId])} />)}
      </Row>

      <Row
        title="Recommended for Your Filters"
        count={digest.filters.entries.length}
        hint="Your saved genres, languages, platforms and types only. Newest first, independent of Like/Dislike."
        empty="No titles match the selected filters for this window."
      >
        {digest.filters.entries.slice(0, 20).map((e) => digest.cards[e.releaseId] && <TitleCard key={e.key} release={digest.cards[e.releaseId]} detail={e.detail} rec={rec(digest.cards[e.releaseId])} />)}
      </Row>

      <Row title="Latest Movies" count={c.movies} empty="No movies collected yet.">{movies.map((r) => <TitleCard key={r.id} release={r} rec={rec(r)} />)}</Row>
      <Row title="Latest Series" count={c.series} empty="No new series collected yet.">{series.map((r) => <TitleCard key={r.id} release={r} rec={rec(r)} />)}</Row>
      <Row title="New Seasons" count={c.seasons} empty="No new seasons collected yet.">{seasons.map((r) => <TitleCard key={r.id} release={r} rec={rec(r)} />)}</Row>
      <Row title="New Episodes" count={c.episodes} empty="No episodes collected yet.">{episodes.map((r) => <TitleCard key={r.id} release={r} rec={rec(r)} />)}</Row>
      <Row title="My Watchlist" count={watch.length} empty="Your watchlist is empty. Use the bookmark button on any title.">{watch.map((r) => <TitleCard key={r.id} release={r} rec={rec(r)} />)}</Row>
      {genreRows.map(({ g, items }) => <Row key={g} title={`Genre: ${g}`} empty="Nothing collected for this genre.">{items.map((r) => <TitleCard key={r.id} release={r} rec={rec(r)} />)}</Row>)}
      {langRows.map(({ l, items }) => <Row key={l} title={`Language: ${l}`} empty="Nothing collected for this language.">{items.map((r) => <TitleCard key={r.id} release={r} rec={rec(r)} />)}</Row>)}
      <p className="text-xs text-muted">Edit what drives these rows in <Link className="underline" href="/preferences">My Preferences</Link>.</p>
    </>
  );
}
