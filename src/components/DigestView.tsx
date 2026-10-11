import type { Digest, DigestEntry } from "@/lib/digest";
import { formatIst } from "@/lib/time/window";
import TitleCard from "./TitleCard";
import { Notice } from "./ui";

function Entries({ entries, digest, empty, showReasons }: { entries: DigestEntry[]; digest: Digest; empty: string; showReasons: boolean }) {
  if (!entries.length) return <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">{empty}</p>;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
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
              synopsis={e.synopsis}
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
      <Notice>
        Window: <b>{formatIst(new Date(w.start))}</b> → <b>{formatIst(new Date(w.end))}</b> IST · Generated {formatIst(new Date(digest.generatedAt))} IST ·{" "}
        <b>{digest.eligibleCount}</b> confirmed releases, <b>{digest.matchCount}</b> match your saved filters (only those are recommended and sent to Telegram). Release dates are calendar dates (TMDB provides no exact time), so each date belongs to exactly one weekly window.
      </Notice>
      {digest.aiError && <Notice tone="warn">{digest.aiError}. Showing the digest without AI WATCH/SKIP opinions.</Notice>}
      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-label="Personalized for You">
          <h2 className="text-lg font-bold">❤️ Personalized for You <span className="chip">{p.entries.length}</span></h2>
          <p className="mb-3 mt-1 text-xs text-muted">
            {p.feedbackActive
              ? `Ranked from your preferences and ${p.feedbackCount} Like/Dislike reactions.`
              : `Based on your saved preferences. It improves as you add Likes/Dislikes (${p.feedbackCount} so far).`}
          </p>
          <Entries entries={p.entries} digest={digest} showReasons empty="No personalized matches are available for this weekly window." />
        </section>
        <section aria-label="Recommended for Your Filters">
          <h2 className="text-lg font-bold">🎬 Recommended for Your Filters <span className="chip">{digest.filters.entries.length}</span></h2>
          <p className="mb-3 mt-1 text-xs text-muted">Matches your selected genres, languages, platforms and types only. Newest first; Likes/Dislikes never affect this list.</p>
          <Entries entries={digest.filters.entries} digest={digest} showReasons={false} empty="No titles match the selected filters for this window." />
        </section>
      </div>
    </div>
  );
}
