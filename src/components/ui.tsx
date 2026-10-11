import Link from "next/link";
import type { ReactNode } from "react";
import type { ReleaseView } from "@/lib/catalogue";
import ScrollRow from "./ScrollRow";
import TitleCard from "./TitleCard";

export function Row({ title, count, hint, children, empty }: { title: string; count?: number; hint?: string; children?: ReactNode; empty?: string }) {
  const has = Array.isArray(children) ? children.filter(Boolean).length > 0 : !!children;
  return (
    <section className="mb-9" aria-label={title}>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
        {count !== undefined && <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-bold text-accent">{count}</span>}
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </div>
      {has ? (
        <ScrollRow>{children}</ScrollRow>
      ) : (
        <p className="rounded-lg border border-dashed border-line p-4 text-sm text-muted">{empty ?? "Nothing to show yet."}</p>
      )}
    </section>
  );
}

export function Grid({ releases, empty }: { releases: ReleaseView[]; empty?: string }) {
  if (!releases.length)
    return <p className="rounded-lg border border-dashed border-line p-6 text-sm text-muted">{empty ?? "No titles match."}</p>;
  return (
    <div className="grid items-stretch gap-4 [grid-template-columns:repeat(auto-fill,minmax(270px,1fr))]">
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

/** Same page header everywhere: title, one short line, optional actions. */
export function PageTitle({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
        {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

const TONES = {
  blue: "border-sky-200 bg-sky-50 text-sky-900",
  green: "border-emerald-200 bg-emerald-50 text-emerald-900",
  violet: "border-violet-200 bg-violet-50 text-violet-900",
  amber: "border-amber-200 bg-amber-50 text-amber-900",
  slate: "border-slate-200 bg-slate-50 text-slate-800",
} as const;

/** Compact coloured stats instead of sentences. */
export function StatPills({ items }: { items: { label: string; value: ReactNode; tone?: keyof typeof TONES }[] }) {
  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {items.map((s) => (
        <div key={s.label} className={`flex items-baseline gap-1.5 rounded-lg border px-3 py-1.5 ${TONES[s.tone ?? "slate"]}`}>
          <span className="text-base font-bold leading-none">{s.value}</span>
          <span className="text-xs font-medium opacity-80">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Pill-style switch between a few options (links, so it works without JavaScript). */
export function Segmented({ options, active }: { options: { href: string; label: string; key: string }[]; active: string }) {
  return (
    <div role="tablist" className="inline-flex rounded-full border border-line bg-surface2 p-1">
      {options.map((o) => (
        <Link
          key={o.key}
          href={o.href}
          role="tab"
          aria-selected={o.key === active}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${o.key === active ? "bg-accent text-white shadow-sm" : "text-muted hover:text-ink"}`}
        >
          {o.label}
        </Link>
      ))}
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
