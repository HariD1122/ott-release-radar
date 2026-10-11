"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

type Json = Record<string, unknown> & {
  ok?: boolean;
  error?: string;
  message?: string;
  name?: string;
  outcome?: { message?: string };
  result?: { status: string; fetched: number; inserted: number; updated: number; rapidapiCalls: number; errors: string[] };
};

function summarize(kind: string | undefined, j: Json, ok: boolean): string {
  if (kind === "collect") {
    const r = j.result;
    if (!r) return j.error ?? "Failed";
    const errs = r.errors?.length ? `, ${r.errors.length} error(s): ${r.errors[0]}` : "";
    return `Collection ${r.status}: ${r.fetched} fetched, ${r.inserted} new, ${r.updated} updated, ${r.rapidapiCalls} RapidAPI calls${errs}.`;
  }
  if (kind === "detect") return j.ok ? `Connected to the chat of ${j.name ?? "your account"}.` : (j.error ?? "Failed");
  return j.outcome?.message ?? j.message ?? j.error ?? (ok ? "Done." : "Failed.");
}

/** Calls a protected server endpoint and shows its real result (success, failure, or loading). */
export default function ApiButton({
  url, children, primary, confirm, kind, refresh = true,
}: {
  url: string;
  children: ReactNode;
  primary?: boolean;
  confirm?: string;
  kind?: "collect" | "detect";
  refresh?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function run() {
    if (confirm && !window.confirm(confirm)) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(url, { method: "POST" });
      const j: Json = await res.json().catch(() => ({}));
      setMsg({ ok: res.ok && j.ok !== false, text: summarize(kind, j, res.ok) });
      if (refresh) router.refresh();
    } catch {
      setMsg({ ok: false, text: "Network error. Nothing was changed." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button className={`btn ${primary ? "btn-primary" : ""}`} onClick={run} disabled={busy}>
        {busy ? "Working…" : children}
      </button>
      {msg && (
        <p role="status" className={`max-w-md text-xs ${msg.ok ? "text-good" : "text-bad"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
