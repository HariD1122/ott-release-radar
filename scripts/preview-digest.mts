// Builds the digest exactly as the senders do (with Gemini) and prints the Telegram text. Sends nothing.
import { q } from "../src/lib/db";
import { buildDigest } from "../src/lib/digest";
import { renderTelegram } from "../src/lib/telegram";

const [{ id }] = await q<{ id: string }>("SELECT id FROM users ORDER BY created_at LIMIT 1");
const t = Date.now();
const d = await buildDigest(id, { ai: "generate" });
console.log("built in", Date.now() - t, "ms | eligible", d.eligibleCount, "| personalized", d.personalized.entries.length, "| filters", d.filters.entries.length, "| aiError", d.aiError);
console.log("with AI:", [...d.personalized.entries, ...d.filters.entries].filter((e) => e.rec).length);
const parts = renderTelegram(d);
console.log("telegram parts:", parts.length, "sizes:", parts.map((p) => p.length).join(","));
console.log(parts[0].slice(0, 1800));
