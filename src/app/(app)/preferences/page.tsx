import PreferencesForm from "@/components/PreferencesForm";
import { PageTitle } from "@/components/ui";
import { requireUser } from "@/lib/auth/auth";
import { distinctValues, getPrefs } from "@/lib/catalogue";
import { GENRE_OPTIONS, LANGUAGE_OPTIONS, PLATFORM_OPTIONS } from "@/lib/taxonomy";

export default async function Preferences() {
  const user = await requireUser();
  const [prefs, seen] = await Promise.all([getPrefs(user.id), distinctValues()]);
  const merge = (base: string[], extra: string[], chosen: string[]) => [...new Set([...base, ...extra, ...chosen])];
  return (
    <>
      <PageTitle title="My Preferences" sub="Saved in the database and used by both recommendation lists. Your watchlist and feedback are never touched by changes here." />
      <PreferencesForm
        initial={prefs}
        genres={merge(GENRE_OPTIONS, seen.genres, prefs.genres)}
        languages={merge(LANGUAGE_OPTIONS, seen.languages, prefs.languages)}
        platforms={merge(PLATFORM_OPTIONS, seen.platforms.filter((p) => PLATFORM_OPTIONS.includes(p)), prefs.platforms)}
      />
    </>
  );
}
