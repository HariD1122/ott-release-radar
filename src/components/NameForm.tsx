"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NameForm({ initial }: { initial: string }) {
  const router = useRouter();
  const [name, setName] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/profile", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ displayName: name }) });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error ?? "Failed");
      setName(j.displayName);
      setMsg({ ok: true, text: "Name saved." });
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: `Not saved: ${(err as Error).message}` });
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-xs text-muted">Display name<input className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} required /></label>
      <button className="btn" disabled={busy}>{busy ? "Saving…" : "Save name"}</button>
      {msg && <p role="status" className={`w-full text-xs ${msg.ok ? "text-good" : "text-bad"}`}>{msg.text}</p>}
    </form>
  );
}
