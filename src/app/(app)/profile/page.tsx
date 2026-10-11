import NameForm from "@/components/NameForm";
import PinForm from "@/components/PinForm";
import PreferencesForm from "@/components/PreferencesForm";
import { PageTitle } from "@/components/ui";
import { requireUser } from "@/lib/auth/auth";
import { distinctValues, getPrefs, prefsUpdatedAt } from "@/lib/catalogue";
import { q } from "@/lib/db";
import { GENRE_OPTIONS, LANGUAGE_OPTIONS, PLATFORM_OPTIONS } from "@/lib/taxonomy";

export default async function Profile() {
  const user = await requireUser();
  const [prefs, seen, savedAt, acct] = await Promise.all([
    getPrefs(user.id),
    distinctValues(),
    prefsUpdatedAt(user.id),
    q<{ created_at: string; last_login_at: string | null }>("SELECT created_at, last_login_at FROM users WHERE id = $1", [user.id]),
  ]);
  const merge = (base: string[], extra: string[], chosen: string[]) => [...new Set([...base, ...extra, ...chosen])];
  const when = (s: string | null | undefined) => (s ? new Date(s).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) + " IST" : "never");
  return (
    <>
      <PageTitle
        title="My Profile"
        sub="Your permanent filters. They are stored in the database, remembered on every device and session, and decide what appears on New Releases, the dashboard and in your Telegram digest, until you change them."
      />
      <section className="mb-6 rounded-xl border border-line bg-surface p-4 text-sm">
        <h2 className="mb-2 text-lg font-bold">Account</h2>
        <p className="text-xl font-extrabold">{user.displayName}</p>
        <p className="text-muted">Created {when(acct[0]?.created_at)} · last sign-in {when(acct[0]?.last_login_at)}</p>
        <p className="mt-2 text-muted">
          Currently saved: {prefs.genres.length ? prefs.genres.join(", ") : "any genre"} · {prefs.platforms.length ? prefs.platforms.join(", ") : "any platform"} · {prefs.languages.length ? prefs.languages.join(", ") : "any language"}
        </p>
      </section>
      <section className="mb-6 rounded-xl border border-line bg-surface p-4">
        <h2 className="mb-3 text-lg font-bold">Profile name</h2>
        <NameForm initial={user.displayName} />
      </section>
      <section className="mb-8 rounded-xl border border-line bg-surface p-4">
        <h2 className="mb-3 text-lg font-bold">Filters: genres, OTT platforms, languages, content types</h2>
        <PreferencesForm
          initial={prefs}
          savedAt={savedAt}
          genres={merge(GENRE_OPTIONS, seen.genres, prefs.genres)}
          languages={merge(LANGUAGE_OPTIONS, seen.languages, prefs.languages)}
          platforms={merge(PLATFORM_OPTIONS, seen.platforms.filter((p) => PLATFORM_OPTIONS.includes(p)), prefs.platforms)}
        />
      </section>
      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="mb-3 text-lg font-bold">Change PIN</h2>
        <PinForm />
      </section>
    </>
  );
}
