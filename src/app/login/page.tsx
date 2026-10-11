"use client";

import { Radar } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pin }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Sign in failed.");
      router.push("/");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setPin("");
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface2 p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-line bg-surface p-7 shadow-lg">
        <div className="mb-6 flex items-center gap-2">
          <Radar className="text-accent" aria-hidden />
          <h1 className="text-xl font-extrabold tracking-tight">OTT Release Radar</h1>
        </div>
        <label className="mb-4 flex flex-col gap-1 text-xs text-muted">
          Enter your PIN
          <input className="input" type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} autoComplete="current-password" required autoFocus />
        </label>
        {error && <p role="alert" className="mb-3 text-sm text-bad">{error}</p>}
        <button className="btn btn-primary w-full justify-center" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        <p className="mt-4 text-center text-xs text-muted">Private app. Registration is disabled.</p>
      </form>
    </main>
  );
}
