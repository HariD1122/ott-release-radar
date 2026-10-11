// Telegram delivery + digest formatting (HTML parse mode, all dynamic text escaped).
import { q } from "./db";
import type { Digest, DigestEntry } from "./digest";

const LIMIT = 4096;
const SAFE = 3800; // leave room for the "Part x of y" line and continuation headings

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const fmtIst = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

function entryBlock(i: number, e: DigestEntry, showFeedback: boolean): string {
  const lines = [`<b>${i}. ${esc(e.title)}</b> — ${esc(e.typeLabel)}${e.detail ? ` (${esc(e.detail)})` : ""}`];
  lines.push(`📅 ${esc(e.dateLabel)}${e.datePrecision === "date" ? " (date-only)" : ""}`);
  lines.push(
    e.platforms.length
      ? `📺 ${esc(e.platforms.join(", "))}${e.platformStatus === "confirmed_both" ? " (confirmed by 2 sources)" : ""}`
      : "📺 Platform: not confirmed",
  );
  const meta = [e.genres.join(", "), e.languages.join(", ")].filter(Boolean).join(" · ");
  if (meta) lines.push(`🎭 ${esc(meta)}`);
  if (e.rec) lines.push(`${e.rec.decision === "WATCH" ? "✅ WATCH" : "⏭ SKIP"} — ${esc(e.rec.reason)}`);
  if (showFeedback && e.reasons.length) lines.push(`ℹ️ ${esc(e.reasons.join("; "))}`);
  return lines.join("\n");
}

/** Builds the Telegram messages. Two categories, never merged; titles are never dropped. */
export function renderTelegram(d: Digest): string[] {
  const intro = [
    "🎬 <b>OTT Release Radar</b>",
    `Week: ${esc(fmtIst(d.window.start))} → ${esc(fmtIst(d.window.end))} IST`,
    `Generated: ${esc(fmtIst(d.generatedAt))} IST`,
    `Confirmed eligible releases: <b>${d.eligibleCount}</b>`,
    "<i>Recommendations depend on available metadata; release dates are calendar dates from TMDB.</i>",
  ].join("\n");

  const p = d.personalized;
  const pHead = `❤️ <b>PERSONALIZED FOR YOU</b> (${p.entries.length})`;
  const pNote = p.feedbackActive
    ? `Ranked using your preferences and ${p.feedbackCount} Like/Dislike reactions.`
    : `Based on your saved preferences. It will improve as you add Likes/Dislikes (${p.feedbackCount} so far).`;
  const fHead = `🎬 <b>RECOMMENDED FOR YOUR FILTERS</b> (${d.filters.entries.length})`;
  const fNote = "Matches your selected genres, languages, platforms and types only. Newest first; Likes/Dislikes are not used.";

  type Section = { head: string; note: string; blocks: string[]; empty: string };
  const sections: Section[] = [
    { head: pHead, note: pNote, blocks: p.entries.map((e, i) => entryBlock(i + 1, e, true)), empty: "No personalized matches are available for this weekly window." },
    { head: fHead, note: fNote, blocks: d.filters.entries.map((e, i) => entryBlock(i + 1, e, false)), empty: "No titles match the selected filters for this window." },
  ];

  const parts: string[] = [];
  let cur = intro;
  const flush = () => {
    parts.push(cur);
    cur = "";
  };
  for (const s of sections) {
    const open = `${s.head}\n${s.note}`;
    if (cur.length + open.length + 2 > SAFE) flush();
    cur = cur ? `${cur}\n\n${open}` : open;
    if (!s.blocks.length) {
      cur += `\n${esc(s.empty)}`;
      continue;
    }
    for (const b of s.blocks) {
      const block = b.length > 1500 ? b.slice(0, 1500) + "…" : b;
      if (cur.length + block.length + 2 > SAFE) {
        flush();
        cur = `${s.head.replace(/\(\d+\)/, "(continued)")}`;
      }
      cur += `\n\n${block}`;
    }
  }
  if (cur) flush();
  return parts.map((t, i) => (parts.length > 1 ? `<i>Part ${i + 1} of ${parts.length}</i>\n${t}` : t)).map((t) => t.slice(0, LIMIT));
}

// ---- delivery -------------------------------------------------------------------------------------

export async function getChatId(): Promise<string | null> {
  const rows = await q<{ chat_id: string | null }>("SELECT chat_id FROM telegram_settings WHERE id = 1");
  return rows[0]?.chat_id || process.env.TELEGRAM_CHAT_ID || null;
}

export async function saveChatId(chatId: string) {
  await q("UPDATE telegram_settings SET chat_id = $1, updated_at = now() WHERE id = 1", [chatId]);
}

export interface SendResult {
  ok: boolean;
  sent: number;
  total: number;
  error?: string;
}

async function api<T>(method: string, body?: unknown): Promise<{ ok: boolean; result?: T; description?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, description: "TELEGRAM_BOT_TOKEN is not configured" };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: body ? "POST" : "GET",
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
    return (await res.json()) as { ok: boolean; result?: T; description?: string };
  } catch (e) {
    // Never include the URL (it contains the token) in errors.
    return { ok: false, description: `Network error talking to Telegram (${(e as Error).name})` };
  }
}

export async function sendMessages(texts: string[]): Promise<SendResult> {
  const chatId = await getChatId();
  if (!chatId) return { ok: false, sent: 0, total: texts.length, error: "No Telegram chat is connected yet." };
  let sent = 0;
  for (const text of texts) {
    let r = await api("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true });
    if (!r.ok && /retry after/i.test(r.description ?? "")) {
      await new Promise((res) => setTimeout(res, 3000));
      r = await api("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true });
    }
    if (!r.ok) return { ok: false, sent, total: texts.length, error: (r.description ?? "Telegram error").slice(0, 200) };
    sent++;
    if (texts.length > 1) await new Promise((res) => setTimeout(res, 400));
  }
  return { ok: true, sent, total: texts.length };
}

export async function botInfo() {
  const r = await api<{ username: string }>("getMe");
  return r.ok ? { ok: true as const, username: r.result!.username } : { ok: false as const, error: r.description ?? "unknown error" };
}

/** Finds the chat of whoever last messaged the bot (they must press Start first). */
export async function detectChat(): Promise<{ ok: boolean; chatId?: string; name?: string; error?: string }> {
  const r = await api<{ message?: { chat: { id: number; first_name?: string; title?: string } } }[]>("getUpdates");
  if (!r.ok) return { ok: false, error: r.description };
  const last = [...(r.result ?? [])].reverse().find((u) => u.message)?.message?.chat;
  if (!last) return { ok: false, error: "No messages found. Open the bot in Telegram, press Start, then try again." };
  return { ok: true, chatId: String(last.id), name: last.first_name ?? last.title };
}
