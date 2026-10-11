import type { ReactNode } from "react";
import type { ReleaseView } from "@/lib/catalogue";
import TitleCard from "./TitleCard";

export function Row({ title, count, hint, children, empty }: { title: string; count?: number; hint?: string; children?: ReactNode; empty?: string }) {
  const has = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <section className="mb-8" aria-label={title}>
      <div className="mb-2 flex items-baseline gap-2">
        <h2 className="text-lg font-bold">{title}</h2>
        {count !== undefined && <span className="chip">{count}</span>}
      </div>
      {hint && <p className="mb-2 text-xs text-muted">{hint}</p>}
      {has ? (
        <div className="row-scroll flex gap-3 overflow-x-auto pb-3">{children}</div>
      ) : (
        <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">{empty ?? "Nothing to show yet."}</p>
      )}
    </section>
  );
}

export function Grid({ releases, empty }: { releases: ReleaseView[]; empty?: string }) {
  if (!releases.length)
    return <p className="rounded-xl border border-dashed border-line p-6 text-sm text-muted">{empty ?? "No titles match."}</p>;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {releases.map((r) => (
        <TitleCard
          key={r.id}
          release={r}
          wide
          rec={r.rec_decision && r.rec_explanation ? { decision: r.rec_decision, reason: r.rec_explanation } : null}
        />
      ))}
    </div>
  );
}

export function PageTitle({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {sub && <p className="mt-1 max-w-2xl text-sm text-muted">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" }) {
  return (
    <p className={`mb-4 rounded-xl border p-3 text-sm ${tone === "warn" ? "border-accent/40 text-accent" : "border-line text-muted"}`}>{children}</p>
  );
}
