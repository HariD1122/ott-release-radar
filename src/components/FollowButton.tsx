"use client";

import { Bell, BellOff } from "lucide-react";
import { useState } from "react";

export default function FollowButton({ seriesTmdbId, title, initial }: { seriesTmdbId: number; title: string; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function toggle() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/follow", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ seriesTmdbId, title, on: !on }) });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error ?? "Failed");
      setOn(j.on);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <span>
      <button className="btn" onClick={toggle} disabled={busy} aria-pressed={on}>
        {on ? <BellOff size={15} /> : <Bell size={15} />} {on ? "Unfollow series" : "Follow series"}
      </button>
      {err && <span role="alert" className="ml-2 text-xs text-bad">{err}</span>}
    </span>
  );
}
