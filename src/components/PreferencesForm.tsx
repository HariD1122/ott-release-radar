"use client";

import { useState } from "react";
import { CONTENT_TYPE_OPTIONS } from "@/lib/taxonomy";
import type { Prefs } from "@/lib/ranking";

function Group({ legend, options, selected, onToggle }: { legend: string; options: { value: string; label: string }[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <fieldset className="mb-6">
      <legend className="mb-2 text-sm font-bold">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = selected.includes(o.value);
          return (
            <label key={o.value} className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${on ? "border-accent bg-accent/15 text-accent" : "border-line text-muted hover:text-ink"}`}>
              <input type="checkbox" className="sr-only" checked={on} onChange={() => onToggle(o.value)} />
              {o.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function PreferencesForm({ initial, genres, languages, platforms }: { initial: Prefs; genres: string[]; languages: string[]; platforms: string[] }) {
  const [p, setP] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const toggle = (key: keyof Prefs) => (v: string) =>
    setP((cur) => ({ ...cur, [key]: cur[key].includes(v) ? cur[key].filter((x) => x !== v) : [...cur[key], v] }));
  const opt = (a: string[]) => a.map((v) => ({ value: v, label: v }));

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/preferences", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(p) });
      const j = await res.json();
      setMsg({ ok: res.ok && j.ok, text: res.ok && j.ok ? "Preferences saved." : j.error ?? "Could not save." });
    } catch {
      setMsg({ ok: false, text: "Network error. Preferences were not saved." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Group legend="Genres" options={opt(genres)} selected={p.genres} onToggle={toggle("genres")} />
      <p className="-mt-4 mb-6 text-xs text-muted">TMDB has no &ldquo;Indie&rdquo; genre, so Indie Drama is covered by Drama.</p>
      <Group legend="Languages" options={opt(languages)} selected={p.languages} onToggle={toggle("languages")} />
      <Group legend="Streaming platforms" options={opt(platforms)} selected={p.platforms} onToggle={toggle("platforms")} />
      <p className="-mt-4 mb-6 text-xs text-muted">A preferred platform is only matched when availability is confirmed. Disney+ Hotstar is now JioHotstar.</p>
      <Group legend="Content types" options={[...CONTENT_TYPE_OPTIONS]} selected={p.contentTypes} onToggle={toggle("contentTypes")} />
      <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save preferences"}</button>
      {msg && <p role="status" className={`mt-2 text-sm ${msg.ok ? "text-good" : "text-bad"}`}>{msg.text}</p>}
    </div>
  );
}
