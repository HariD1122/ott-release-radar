import { detectChat, saveChatId } from "@/lib/telegram";
import { errorResponse, fail, guard, json } from "@/lib/api";

// Saves the chat that last messaged the bot (the user must press Start in Telegram first).
export async function POST() {
  try {
    const g = await guard();
    if ("res" in g) return g.res;
    const r = await detectChat();
    if (!r.ok || !r.chatId) return fail(r.error ?? "Could not detect a chat.");
    await saveChatId(r.chatId);
    return json({ ok: true, name: r.name });
  } catch (e) {
    return errorResponse(e);
  }
}
