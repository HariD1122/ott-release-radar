"use client";

import { useState } from "react";

export default function PinForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/change-pin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ current, next }) });
      const j = await res.json();
      setMsg({ ok: res.ok && j.ok, text: res.ok && j.ok ? "PIN changed. Other devices were signed out." : j.error ?? "Failed." });
      if (res.ok) { setCurrent(""); setNext(""); }
    } catch {
      setMsg({ ok: false, text: "Network error." });
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-xs text-muted">Current PIN<input className="input" type="password" inputMode="numeric" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required /></label>
      <label className="flex flex-col gap-1 text-xs text-muted">New PIN (4-12 digits)<input className="input" type="password" inputMode="numeric" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required /></label>
      <button className="btn" disabled={busy}>{busy ? "Changing…" : "Change PIN"}</button>
      {msg && <p role="status" className={`w-full text-xs ${msg.ok ? "text-good" : "text-bad"}`}>{msg.text}</p>}
    </form>
  );
}
