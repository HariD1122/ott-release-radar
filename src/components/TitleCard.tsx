"use client";

import { Bookmark, BookmarkCheck, Film, ThumbsDown, ThumbsUp } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReleaseView } from "@/lib/catalogue";
import { CONTENT_TYPE_LABEL } from "@/lib/taxonomy";
import { dateText, shortSynopsis } from "@/lib/text";

export interface CardRec {
  decision: "WATCH" | "SKIP";
  reason: string;
}

type Sync = { id: string; feedback?: "like" | "dislike" | null; inList?: boolean };

/** Same title shown twice on a page (e.g. both recommendation columns) stays in sync via a window event. */
const EVENT = "ott:title-sync";

/** Uniform landscape card: 16:9 thumbnail, fixed text structure, actions pinned to the bottom. */
export default function TitleCard({
  release: r,
  detail,
  rec,
  reasons,
  synopsis,
  length,
  wide,
}: {
  release: ReleaseView;
  detail?: string | null;
  rec?: CardRec | null;
  reasons?: string[];
  synopsis?: string | null;
  length?: string | null;
  wide?: boolean;
}) {
  const lengthText =
    length ??
    ([
      r.runtime_minutes ? `${r.runtime_minutes} min` : null,
      r.content_type === "episode" ? `S${r.season_number}E${r.episode_number}` : r.episode_count ? `${r.episode_count} episodes` : null,
    ]
      .filter(Boolean)
      .join(" · ") || null);
  const synopsisText = synopsis ?? shortSynopsis(r.synopsis);
  const image = r.backdrop_url ?? r.poster_url;
  const [feedback, setFeedback] = useState(r.feedback);
  const [inList, setInList] = useState(r.in_watchlist);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent<Sync>).detail;
      if (d.id !== r.id) return;
      if (d.feedback !== undefined) setFeedback(d.feedback);
      if (d.inList !== undefined) setInList(d.inList);
    };
    window.addEventListener(EVENT, h);
    return () => window.removeEventListener(EVENT, h);
  }, [r.id]);

  const broadcast = (d: Sync) => window.dispatchEvent(new CustomEvent(EVENT, { detail: d }));

  async function post(url: string, body: unknown) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error ?? "Request failed");
      return j;
    } catch (e) {
      setErr((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function react(value: "like" | "dislike") {
    const j = await post("/api/feedback", { releaseId: r.id, value });
    if (j) broadcast({ id: r.id, feedback: j.feedback });
  }
  async function toggleList() {
    const j = await post("/api/watchlist", { releaseId: r.id, on: !inList });
    if (j) broadcast({ id: r.id, inList: j.on });
  }

  return (
    <article className={`card group flex shrink-0 flex-col overflow-hidden rounded-lg border border-line bg-surface ${wide ? "w-full" : "w-[280px]"}`}>
      <Link href={`/title/${r.id}`} className="relative block aspect-video overflow-hidden bg-surface2" aria-label={`Open ${r.title}`}>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={`Artwork for ${r.title}`} loading="lazy" className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted">
            <Film aria-hidden size={26} />
            <span className="text-xs">No artwork available</span>
          </div>
        )}
        <span className="absolute left-2 top-2 rounded bg-white/95 px-2 py-0.5 text-[11px] font-semibold text-ink shadow-sm">
          {CONTENT_TYPE_LABEL[r.content_type]}
        </span>
        {rec && (
          <span className={`absolute right-2 top-2 rounded px-2 py-0.5 text-[11px] font-bold text-white shadow-sm ${rec.decision === "WATCH" ? "bg-good" : "bg-bad"}`}>
            {rec.decision}
          </span>
        )}
        {lengthText && (
          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2.5 pb-1.5 pt-6 text-right text-xs font-semibold text-white">
            {lengthText}
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <Link href={`/title/${r.id}`} className="line-clamp-1 text-[15px] font-semibold leading-snug text-ink hover:text-accent">
          {r.title}
        </Link>
        {detail && <p className="line-clamp-1 text-xs font-medium text-accent">{detail}</p>}
        <p className="line-clamp-1 text-xs text-muted">
          {dateText(r)} · {r.platforms.length ? r.platforms.join(", ") : "Platform not confirmed"}
        </p>
        <div className="flex flex-wrap gap-1">
          {r.genres.slice(0, 2).map((g) => <span key={g} className="chip">{g}</span>)}
          {r.languages.slice(0, 1).map((g) => <span key={g} className="chip">{g}</span>)}
        </div>
        <p className="line-clamp-2 min-h-[2.1rem] text-xs leading-snug text-muted">{synopsisText ?? "Synopsis not available"}</p>
        {rec && <p className="line-clamp-2 text-xs leading-snug text-ink">{rec.reason}</p>}
        {reasons && reasons.length > 0 && <p className="line-clamp-2 text-[11px] leading-snug text-muted">{reasons.join(" · ")}</p>}

        <div className="mt-auto flex items-center gap-1.5 pt-2">
          <button className="btn !px-2.5 !py-1.5" aria-pressed={feedback === "like"} aria-label="Like" disabled={busy} onClick={() => react("like")}>
            <ThumbsUp size={15} className={feedback === "like" ? "fill-accent text-accent" : ""} />
          </button>
          <button className="btn !px-2.5 !py-1.5" aria-pressed={feedback === "dislike"} aria-label="Dislike" disabled={busy} onClick={() => react("dislike")}>
            <ThumbsDown size={15} className={feedback === "dislike" ? "fill-bad text-bad" : ""} />
          </button>
          <button className="btn ml-auto !px-2.5 !py-1.5" aria-pressed={inList} aria-label={inList ? "Remove from watchlist" : "Add to watchlist"} disabled={busy} onClick={toggleList}>
            {inList ? <BookmarkCheck size={15} className="text-accent" /> : <Bookmark size={15} />}
          </button>
        </div>
        {err && <p role="alert" className="text-xs text-bad">{err}</p>}
      </div>
    </article>
  );
}
