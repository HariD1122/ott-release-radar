import type { Digest, DigestEntry } from "@/lib/digest";
import { formatIst } from "@/lib/time/window";
import TitleCard from "./TitleCard";
import { Notice, StatPills } from "./ui";

function Entries({ entries, digest, empty, showReasons }: { entries: DigestEntry[]; digest: Digest; empty: string; showReasons: boolean }) {
  if (!entries.length) return <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">{empty}</p>;
  return (
    <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(250px,1fr))]">
      {entries.map((e, i) => {
        const r = digest.cards[e.releaseId];
        if (!r) return null;
        return (
          <div key={e.key} className="relative">
            <span className="absolute -left-1 -top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-ink">{i + 1}</span>
            <TitleCard
              release={r}
              wide
              detail={e.detail}
              rec={e.rec ? { decision: e.rec.decision, reason: e.rec.reason } : null}
              reasons={showReasons ? e.reasons : undefined}
              length={[e.runtimeMinutes ? `${e.runtimeMinutes} min` : null, e.episodeInfo].filter(Boolean).join(" · ") || null}
            />
          </div>
        );
      })}
    </div>
  );
}

/** Renders the same Digest object the Telegram message is built from. */
export default function DigestView({ digest }: { digest: Digest }) {
  const w = digest.window;
  const p = digest.personalized;
  return (
    <div>
      <StatPills
        items={[
          { label: "week", value: `${w.startDate.slice(5)} → ${w.endDate.slice(5)}`, tone: "blue" },
          { label: "releases in window", value: digest.eligibleCount, tone: "slate" },
          { label: "match your filters", value: digest.matchCount, tone: "green" },
          { label: "generated", value: formatIst(new Date(digest.generatedAt)), tone: "violet" },
        ]}
      />
      {digest.aiError && <Notice tone="warn">{digest.aiError}. Showing the digest without AI WATCH/SKIP opinions.</Notice>}
      <div className="grid gap-8 xl:grid-cols-2">
        <section aria-label="Personalized for You">
          <h2 className="text-lg font-bold">Personalized for You <span className="chip">{p.entries.length}</span></h2>
          <p className="mb-3 mt-1 text-xs text-muted">
            {p.feedbackActive ? `Learns from your ${p.feedbackCount} Likes and Dislikes` : `Add Likes and Dislikes to improve this (${p.feedbackCount} so far)`}
          </p>
          <Entries entries={p.entries} digest={digest} showReasons empty="No personalized matches are available for this weekly window." />
        </section>
        <section aria-label="Recommended for Your Filters">
          <h2 className="text-lg font-bold">Recommended for Your Filters <span className="chip">{digest.filters.entries.length}</span></h2>
          <p className="mb-3 mt-1 text-xs text-muted">Your saved filters only, newest first</p>
          <Entries entries={digest.filters.entries} digest={digest} showReasons={false} empty="No titles match the selected filters for this window." />
        </section>
      </div>
    </div>
  );
}
