import ApiButton from "@/components/ApiButton";
import PinForm from "@/components/PinForm";
import { Notice, PageTitle } from "@/components/ui";
import { requireUser } from "@/lib/auth/auth";
import { q } from "@/lib/db";
import { botInfo, getChatId } from "@/lib/telegram";
import { formatIst } from "@/lib/time/window";

export default async function Settings() {
  await requireUser();
  const [bot, chat, deliveries, jobs] = await Promise.all([
    process.env.TELEGRAM_BOT_TOKEN ? botInfo() : Promise.resolve(null),
    getChatId(),
    q<{ id: string; trigger_type: string; status: string; error_summary: string | null; started_at: string }>(
      "SELECT id, trigger_type, status, error_summary, started_at FROM digest_history ORDER BY started_at DESC LIMIT 8",
    ),
    q<{ id: string; status: string; started_at: string; records_fetched: number; records_inserted: number; records_updated: number; rapidapi_calls: number; error_details: string | null }>(
      "SELECT id, status, started_at, records_fetched, records_inserted, records_updated, rapidapi_calls, error_details FROM collection_job_history ORDER BY started_at DESC LIMIT 5",
    ),
  ]);
  const configured = (k: string) => (process.env[k] ? "configured" : "missing");
  return (
    <>
      <PageTitle title="Settings & Telegram" sub="Secrets live in server environment variables and are never shown here." />
      <section className="mb-8 rounded-xl border border-line bg-surface p-4">
        <h2 className="mb-3 text-lg font-bold">Telegram</h2>
        <ul className="mb-4 space-y-1 text-sm">
          <li>Bot token: <b className={bot?.ok ? "text-good" : "text-bad"}>{bot ? (bot.ok ? `valid (@${bot.username})` : `error: ${bot.error}`) : "missing"}</b></li>
          <li>Chat: <b className={chat ? "text-good" : "text-bad"}>{chat ? "connected" : "not connected"}</b></li>
          <li>Automatic digest: Fridays 6:00 PM IST (cron, see README for plan limits). CRON_SECRET: <b>{configured("CRON_SECRET")}</b></li>
        </ul>
        {!chat && (
          <Notice tone="warn">
            Setup: open your bot in Telegram, press <b>Start</b> and send any message, then press <b>Detect my chat</b>. For a group, add the bot, post a message, then detect.
          </Notice>
        )}
        <div className="flex flex-wrap gap-3">
          <ApiButton url="/api/telegram/detect" kind="detect">Detect my chat</ApiButton>
          <ApiButton url="/api/telegram/test">Send test message</ApiButton>
        </div>
      </section>

      <section className="mb-8 rounded-xl border border-line bg-surface p-4">
        <h2 className="mb-3 text-lg font-bold">Integrations</h2>
        <ul className="space-y-1 text-sm">
          {["TMDB_ACCESS_TOKEN", "RAPIDAPI_KEY", "GEMINI_API_KEY", "GEMINI_MODEL", "DATABASE_URL", "SESSION_SECRET"].map((k) => (
            <li key={k}>{k}: <b className={process.env[k] ? "text-good" : "text-bad"}>{configured(k)}</b></li>
          ))}
        </ul>
        <div className="mt-4">
          <ApiButton url="/api/collect" kind="collect">Refresh Data</ApiButton>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-bold">Recent collection jobs</h2>
        {jobs.length === 0 ? <p className="text-sm text-muted">No collection has run yet.</p> : (
          <ul className="space-y-1 text-sm text-muted">
            {jobs.map((j) => <li key={j.id}>{formatIst(new Date(j.started_at))} — <b>{j.status}</b>: {j.records_fetched} fetched, {j.records_inserted} new, {j.records_updated} updated, {j.rapidapi_calls} RapidAPI calls{j.error_details ? ` — ${j.error_details.split("\n")[0]}` : ""}</li>)}
          </ul>
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-bold">Recent Telegram deliveries</h2>
        {deliveries.length === 0 ? <p className="text-sm text-muted">Nothing sent yet.</p> : (
          <ul className="space-y-1 text-sm text-muted">
            {deliveries.map((d) => <li key={d.id}>{formatIst(new Date(d.started_at))} — {d.trigger_type}: <b className={d.status === "sent" ? "text-good" : "text-bad"}>{d.status}</b>{d.error_summary ? ` (${d.error_summary})` : ""}</li>)}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="mb-3 text-lg font-bold">Change PIN</h2>
        <PinForm />
      </section>
    </>
  );
}
