"use client";

import { Calendar, Check, ChevronDown, Info, Languages, LayoutGrid, Search, Tag, Tv, X, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Prefs } from "@/lib/ranking";

export interface FilterOptions {
  genres: string[];
  languages: string[];
  platforms: string[];
}

const TYPE_OPTIONS = [
  { value: "movie", label: "Movies" },
  { value: "series", label: "New series" },
  { value: "season", label: "New seasons" },
  { value: "episode", label: "New episodes" },
];

// One colour per filter so they are recognisable at a glance and consistent on every page.
const THEME = {
  genre: { idle: "border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100", on: "border-sky-700 bg-sky-700 text-white hover:bg-sky-800", box: "border-sky-700 bg-sky-700", row: "hover:bg-sky-50" },
  language: { idle: "border-teal-200 bg-teal-50 text-teal-900 hover:bg-teal-100", on: "border-teal-700 bg-teal-700 text-white hover:bg-teal-800", box: "border-teal-700 bg-teal-700", row: "hover:bg-teal-50" },
  platform: { idle: "border-violet-200 bg-violet-50 text-violet-900 hover:bg-violet-100", on: "border-violet-700 bg-violet-700 text-white hover:bg-violet-800", box: "border-violet-700 bg-violet-700", row: "hover:bg-violet-50" },
  type: { idle: "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100", on: "border-amber-700 bg-amber-700 text-white hover:bg-amber-800", box: "border-amber-700 bg-amber-700", row: "hover:bg-amber-50" },
} as const;
type Kind = keyof typeof THEME;

function FilterMenu({
  kind, label, icon: Icon, options, selected, onChange,
}: {
  kind: Kind;
  label: string;
  icon: LucideIcon;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const t = THEME[kind];
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false;
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && ref.current) ref.current.open = false;
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, []);
  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  const active = selected.length > 0;
  return (
    <details ref={ref} className="relative">
      <summary
        aria-label={`${label} filter`}
        className={`flex cursor-pointer list-none items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-semibold transition ${active ? t.on : t.idle}`}
      >
        <Icon size={15} aria-hidden />
        {label}
        {active && <span className="rounded-full bg-white/25 px-1.5 text-xs">{selected.length}</span>}
        <ChevronDown size={14} aria-hidden className="opacity-70" />
      </summary>
      <div className="absolute left-0 z-30 mt-2 w-64 rounded-xl border border-line bg-white p-2 shadow-xl">
        <div className="mb-1 flex items-center justify-between px-2 py-1 text-xs text-muted">
          <span>{active ? `${selected.length} selected` : "Any"}</span>
          {active && (
            <button type="button" className="font-semibold text-accent hover:underline" onClick={() => onChange([])}>
              Clear
            </button>
          )}
        </div>
        <div className="max-h-64 overflow-y-auto">
          {options.map((o) => {
            const on = selected.includes(o.value);
            return (
              <label key={o.value} className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm ${t.row}`}>
                <input type="checkbox" className="sr-only" checked={on} onChange={() => toggle(o.value)} />
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${on ? `${t.box} text-white` : "border-slate-300 bg-white"}`}>
                  {on && <Check size={12} aria-hidden />}
                </span>
                {o.label}
              </label>
            );
          })}
        </div>
      </div>
    </details>
  );
}

/**
 * The site-wide permanent filter toolbar: one row of colour-coded dropdown buttons. Every change is saved to the
 * profile (user_preferences) and stays until the owner changes it. Search text and dates are per-page (URL).
 */
export default function Filters({
  action, current, options, saved, showType, showDates, showText = true,
}: {
  action: string;
  current: Record<string, string | undefined>;
  options: FilterOptions;
  saved: Prefs;
  showType?: boolean;
  showDates?: boolean;
  showText?: boolean;
}) {
  const router = useRouter();
  const [p, setP] = useState<Prefs>(saved);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastSaved = useRef(JSON.stringify(saved));
  const datesRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    // Only write when the selection really differs from what is stored (no save on page load).
    if (JSON.stringify(p) === lastSaved.current) return;
    setStatus({ ok: true, text: "Saving…" });
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/preferences", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(p) });
        const j = await res.json();
        if (!res.ok || !j.ok) throw new Error(j.error ?? "Could not save");
        lastSaved.current = JSON.stringify(p);
        setStatus({ ok: true, text: "Saved" });
        router.refresh();
      } catch (e) {
        setStatus({ ok: false, text: `Not saved: ${(e as Error).message}` });
      }
    }, 500);
    return () => clearTimeout(timer.current);
  }, [p, router]);

  useEffect(() => {
    if (status?.text !== "Saved") return;
    const t = setTimeout(() => setStatus(null), 2500);
    return () => clearTimeout(t);
  }, [status]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (datesRef.current?.open && !datesRef.current.contains(e.target as Node)) datesRef.current.open = false;
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const opt = (a: string[]) => a.map((v) => ({ value: v, label: v }));
  const set = (key: keyof Prefs) => (v: string[]) => setP((cur) => ({ ...cur, [key]: v }));
  const merge = (a: string[], b: string[]) => [...new Set([...a, ...b])].sort();
  const hasPageFilters = !!(current.q || current.from || current.to);

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface2 p-2.5">
      <FilterMenu kind="genre" label="Genre" icon={Tag} options={opt(merge(options.genres, p.genres))} selected={p.genres} onChange={set("genres")} />
      <FilterMenu kind="language" label="Language" icon={Languages} options={opt(merge(options.languages, p.languages))} selected={p.languages} onChange={set("languages")} />
      <FilterMenu kind="platform" label="Platform" icon={Tv} options={opt(merge(options.platforms, p.platforms))} selected={p.platforms} onChange={set("platforms")} />
      {showType && <FilterMenu kind="type" label="Type" icon={LayoutGrid} options={TYPE_OPTIONS} selected={p.contentTypes} onChange={set("contentTypes")} />}

      <span
        tabIndex={0}
        role="img"
        aria-label="About these filters"
        title="These are your permanent profile filters. They stay saved until you change them and decide what is recommended on every page and in your Telegram digest. A platform filter only matches titles whose platform is confirmed."
        className="flex h-8 w-8 cursor-help items-center justify-center rounded-full text-muted hover:bg-white hover:text-ink"
      >
        <Info size={16} aria-hidden />
      </span>
      {status && (
        <span role="status" className={`text-xs font-semibold ${status.ok ? "text-good" : "text-bad"}`}>
          {status.text === "Saved" && <Check size={13} className="mr-0.5 inline" aria-hidden />}
          {status.text}
        </span>
      )}

      {(showText || showDates) && (
        <form action={action} method="get" className="contents">
          <span className="mx-1 hidden h-6 w-px bg-line lg:block" aria-hidden />
          {showText && (
            <label className="relative min-w-[200px] flex-1">
              <span className="sr-only">Search titles</span>
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
              <input name="q" defaultValue={current.q ?? ""} placeholder="Search titles" className="input w-full !rounded-full !py-2 !pl-9" />
            </label>
          )}
          {showDates && (
            <details ref={datesRef} className="relative">
              <summary className={`flex cursor-pointer list-none items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-semibold transition ${current.from || current.to ? "border-slate-800 bg-slate-800 text-white" : "border-slate-300 bg-white text-ink hover:bg-slate-50"}`}>
                <Calendar size={15} aria-hidden /> Dates <ChevronDown size={14} aria-hidden className="opacity-70" />
              </summary>
              <div className="absolute right-0 z-30 mt-2 flex w-64 flex-col gap-3 rounded-xl border border-line bg-white p-3 shadow-xl">
                <label className="flex flex-col gap-1 text-xs text-muted">From<input type="date" name="from" defaultValue={current.from ?? ""} className="input" /></label>
                <label className="flex flex-col gap-1 text-xs text-muted">To<input type="date" name="to" defaultValue={current.to ?? ""} className="input" /></label>
              </div>
            </details>
          )}
          <button className="btn btn-primary !rounded-full" type="submit">Apply</button>
          {hasPageFilters && (
            <a href={action} className="btn !rounded-full" aria-label="Clear search and dates">
              <X size={14} aria-hidden /> Clear
            </a>
          )}
        </form>
      )}
    </div>
  );
}
