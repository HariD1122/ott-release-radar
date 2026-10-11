"use client";

import { Check, ChevronDown, Search } from "lucide-react";
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

function MultiSelect({
  label, options, selected, onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false;
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  return (
    <details ref={ref} className="relative">
      <summary className="input flex cursor-pointer list-none items-center gap-2 whitespace-nowrap" aria-label={`${label} filter`}>
        <span className="text-muted">{label}:</span>
        <span className="max-w-[150px] truncate font-semibold">
          {selected.length === 0 ? "Any" : selected.length <= 2 ? selected.join(", ") : `${selected.length} selected`}
        </span>
        <ChevronDown size={14} aria-hidden />
      </summary>
      <div className="absolute left-0 z-30 mt-1 max-h-72 w-60 overflow-y-auto rounded-xl border border-line bg-surface p-1.5 shadow-2xl">
        <button type="button" className="mb-1 w-full rounded-lg px-2 py-1 text-left text-xs text-muted hover:text-ink" onClick={() => onChange([])}>
          Clear (show any)
        </button>
        {options.map((o) => {
          const on = selected.includes(o.value);
          return (
            <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface2">
              <input type="checkbox" className="sr-only" checked={on} onChange={() => toggle(o.value)} />
              <span className={`flex h-4 w-4 items-center justify-center rounded border ${on ? "border-accent bg-accent text-white" : "border-line"}`}>
                {on && <Check size={12} aria-hidden />}
              </span>
              {o.label}
            </label>
          );
        })}
      </div>
    </details>
  );
}

/**
 * The site-wide permanent filter. Every change is saved to the profile (user_preferences) and stays
 * until the owner changes it again. Search text and dates are per-page and live in the URL.
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
        setStatus({ ok: true, text: "Saved to your profile" });
        router.refresh();
      } catch (e) {
        setStatus({ ok: false, text: `Not saved: ${(e as Error).message}` });
      }
    }, 500);
    return () => clearTimeout(timer.current);
  }, [p, router]);

  const opt = (a: string[]) => a.map((v) => ({ value: v, label: v }));
  const set = (key: keyof Prefs) => (v: string[]) => setP((cur) => ({ ...cur, [key]: v }));
  const merge = (a: string[], b: string[]) => [...new Set([...a, ...b])].sort();

  return (
    <div className="mb-5 rounded-xl border border-line bg-surface p-3">
      <div className="flex flex-wrap items-center gap-2">
        <MultiSelect label="Genre" options={opt(merge(options.genres, p.genres))} selected={p.genres} onChange={set("genres")} />
        <MultiSelect label="Language" options={opt(merge(options.languages, p.languages))} selected={p.languages} onChange={set("languages")} />
        <MultiSelect label="Platform" options={opt(merge(options.platforms, p.platforms))} selected={p.platforms} onChange={set("platforms")} />
        {showType && <MultiSelect label="Type" options={TYPE_OPTIONS} selected={p.contentTypes} onChange={set("contentTypes")} />}
        {status && (
          <span role="status" className={`text-xs ${status.ok ? "text-good" : "text-bad"}`}>{status.text}</span>
        )}
      </div>
      <p className="mt-2 text-xs text-muted">
        These filters are your permanent profile filters: they stay saved until you change them, and they decide what is recommended here, on the dashboard and in your Telegram digest. A platform filter only matches titles whose platform is confirmed.
      </p>
      {(showText || showDates) && (
        <form action={action} method="get" className="mt-3 flex flex-wrap items-end gap-3 border-t border-line pt-3">
          {showText && (
            <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-xs text-muted">
              Search title (this page only)
              <span className="relative">
                <Search size={15} className="absolute left-2.5 top-2.5 text-muted" aria-hidden />
                <input name="q" defaultValue={current.q ?? ""} placeholder="Search the collected catalogue" className="input w-full !pl-8" />
              </span>
            </label>
          )}
          {showDates && (
            <>
              <label className="flex flex-col gap-1 text-xs text-muted">From<input type="date" name="from" defaultValue={current.from ?? ""} className="input" /></label>
              <label className="flex flex-col gap-1 text-xs text-muted">To<input type="date" name="to" defaultValue={current.to ?? ""} className="input" /></label>
            </>
          )}
          <button className="btn btn-primary" type="submit">Apply</button>
          <a href={action} className="btn">Reset search</a>
        </form>
      )}
    </div>
  );
}
