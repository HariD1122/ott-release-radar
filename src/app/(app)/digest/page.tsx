import ApiButton from "@/components/ApiButton";
import DigestView from "@/components/DigestView";
import Filters from "@/components/Filters";
import { PageTitle } from "@/components/ui";
import { requireUser } from "@/lib/auth/auth";
import { distinctValues, getPrefs } from "@/lib/catalogue";
import { buildDigest } from "@/lib/digest";

export const maxDuration = 60;

export default async function DigestPage() {
  const user = await requireUser();
  const [digest, options, prefs] = await Promise.all([
    buildDigest(user.id),
    distinctValues(),
    getPrefs(user.id),
  ]);
  return (
    <>
      <PageTitle
        title="Weekly Digest"
        sub="Exactly what Telegram receives"
        right={
          <div className="flex flex-wrap items-start gap-3">
            <ApiButton url="/api/recommendations">Generate AI recommendations</ApiButton>
            <ApiButton url="/api/digest/send" primary confirm="Send this digest to Telegram now?">Send This Week&apos;s List Now</ApiButton>
          </div>
        }
      />
      <Filters action="/digest" current={{}} options={options} saved={prefs} showType showText={false} />
      <DigestView digest={digest} />
    </>
  );
}
