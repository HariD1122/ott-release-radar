import type { ReactNode } from "react";
import type { ReleaseView } from "@/lib/catalogue";
import TitleCard from "./TitleCard";

export function Row({ title, count, hint, children, empty }: { title: string; count?: number; hint?: string; children?: ReactNode; empty?: string }) {
  const has = Array.isArray(children) ? children.filter(Boolean).length > 0 : !!children;
  return (
    <section className="mb-10" aria-label={title}>
      <div className="mb-1 flex items-baseline gap-2">
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
        {count !== undefined && <span className="chip">{count}</span>}
      </div>
      {hint && <p className="mb-3 text-sm text-muted">{hint}</p>}
      {has ? (
        <div className="row-scroll -mx-1 flex items-stretch gap-4 overflow-x-auto px-1 pb-4 pt-1">{children}</div>
      ) : (
        <p className="mt-2 rounded-lg border border-dashed border-line p-4 text-sm text-muted">{empty ?? "Nothing to show yet."}</p>
      )}
    </section>
  );
}

export function Grid({ releases, empty }: { releases: ReleaseView[]; empty?: string }) {
  if (!releases.length)
    return <p className="rounded-lg border border-dashed border-line p-6 text-sm text-muted">{empty ?? "No titles match."}</p>;
  return (
    <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(270px,1fr))] items-stretch">
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
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
        {sub && <p className="mt-1 max-w-2xl text-sm text-muted">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" }) {
  return (
    <p className={`mb-4 rounded-lg border p-3 text-sm ${tone === "warn" ? "border-amber-300 bg-amber-50 text-amber-900" : "border-line bg-surface2 text-muted"}`}>
      {children}
    </p>
  );
}
