// Digest delivery for both triggers. Automatic and manual are separate entry points with separate
// idempotency keys, but share buildDigest() and the Telegram sender.
import { q } from "./db";
import { buildDigest } from "./digest";
import { renderTelegram, sendMessages } from "./telegram";
import { weeklyWindow } from "./time/window";

export type Trigger = "automatic" | "manual";

export interface DeliveryOutcome {
  status: "sent" | "failed" | "skipped";
  message: string;
  digestId?: string;
  personalized?: number;
  filters?: number;
  eligible?: number;
  parts?: number;
}

export async function deliverDigest(trigger: Trigger, userId: string, now = new Date()): Promise<DeliveryOutcome> {
  const window = weeklyWindow(now, "completed");
  const endIso = window.end.toISOString();
  // automatic: one row per weekly window. manual: one row per 30-second bucket (blocks double clicks only).
  const key = trigger === "automatic" ? `auto:${endIso}` : `manual:${endIso}:${Math.floor(now.getTime() / 30_000)}`;

  const ins = await q<{ id: string }>(
    `INSERT INTO digest_history (window_start, window_end, trigger_type, status, idempotency_key)
     VALUES ($1,$2,$3,'pending',$4) ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`,
    [window.start, window.end, trigger, key],
  );
  let id = ins[0]?.id;
  if (!id) {
    const prev = await q<{ id: string; status: string; started_at: string }>(
      "SELECT id, status, started_at FROM digest_history WHERE idempotency_key = $1",
      [key],
    );
    const p = prev[0];
    if (trigger === "manual") return { status: "skipped", message: "A manual send was just started. Duplicate click ignored." };
    if (p.status === "sent") return { status: "skipped", message: "This week's automatic digest was already delivered.", digestId: p.id };
    if (p.status === "pending" && Date.now() - new Date(p.started_at).getTime() < 10 * 60_000)
      return { status: "skipped", message: "Another run is already delivering this digest.", digestId: p.id };
    // failed (or stale pending): retry this same row, atomically claiming it
    const claimed = await q<{ id: string }>(
      `UPDATE digest_history SET status='pending', attempt_count = attempt_count + 1, started_at = now(), error_summary = NULL
       WHERE id = $1 AND (status = 'failed' OR (status = 'pending' AND started_at < now() - interval '10 minutes')) RETURNING id`,
      [p.id],
    );
    if (!claimed[0]) return { status: "skipped", message: "Another run claimed this digest.", digestId: p.id };
    id = claimed[0].id;
  }

  try {
    // Telegram messages carry no WATCH/SKIP opinion, so no Gemini call is needed for delivery.
    const digest = await buildDigest(userId, { now, window, ai: false });
    const texts = renderTelegram(digest);
    const res = await sendMessages(texts); // success only if Telegram confirmed every part
    const counts = [digest.personalized.entries.length, digest.filters.entries.length, digest.eligibleCount];
    await q(
      `UPDATE digest_history SET status=$2, personalized_count=$3, filter_count=$4, total_unique=$5,
         telegram_response=$6, error_summary=$7, completed_at=now() WHERE id=$1`,
      [id, res.ok ? "sent" : "failed", ...counts, res.ok ? `ok: ${res.sent}/${res.total} messages` : `sent ${res.sent}/${res.total}`, res.error ?? null],
    );
    return {
      status: res.ok ? "sent" : "failed",
      message: res.ok ? `Sent ${res.sent} Telegram message(s).` : `Telegram delivery failed: ${res.error}`,
      digestId: id, personalized: counts[0], filters: counts[1], eligible: counts[2], parts: texts.length,
    };
  } catch (e) {
    const msg = (e as Error).message.slice(0, 200);
    await q("UPDATE digest_history SET status='failed', error_summary=$2, completed_at=now() WHERE id=$1", [id, msg]);
    return { status: "failed", message: `Digest failed: ${msg}`, digestId: id };
  }
}

export async function sendTestMessage(): Promise<{ ok: boolean; message: string }> {
  const res = await sendMessages(["✅ OTT Release Radar test message. Telegram is connected."]);
  await q(
    `INSERT INTO digest_history (window_start, window_end, trigger_type, status, idempotency_key, telegram_response, error_summary, completed_at)
     VALUES (now(), now(), 'test', $1, 'test:' || gen_random_uuid(), $2, $3, now())`,
    [res.ok ? "sent" : "failed", res.ok ? "ok" : null, res.error ?? null],
  );
  return { ok: res.ok, message: res.ok ? "Test message delivered." : `Failed: ${res.error}` };
}
