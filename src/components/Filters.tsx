import { Search } from "lucide-react";

export interface FilterOptions { genres: string[]; languages: string[]; platforms: string[] }

/** Plain GET form: filters live in the URL, work without JS, and the server page re-queries the database. */
export default function Filters({
  action, current, options, showType, showDates,
}: {
  action: string;
  current: Record<string, string | undefined>;
  options: FilterOptions;
  showType?: boolean;
  showDates?: boolean;
}) {
  const sel = (name: string, label: string, values: string[]) => (
    <label className="flex flex-col gap-1 text-xs text-muted">
      {label}
      <select name={name} defaultValue={current[name] ?? ""} className="input">
        <option value="">Any</option>
        {values.map((v) => <option key={v} value={v}>{v}</option>)}
      </select>
    </label>
  );
  return (
    <form action={action} method="get" className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-surface p-3">
      <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-xs text-muted">
        Search title
        <span className="relative">
          <Search size={15} className="absolute left-2.5 top-2.5 text-muted" aria-hidden />
          <input name="q" defaultValue={current.q ?? ""} placeholder="Search the collected catalogue" className="input w-full !pl-8" />
        </span>
      </label>
      {showType && sel("type", "Type", ["movie", "series", "season", "episode"])}
      {sel("genre", "Genre", options.genres)}
      {sel("language", "Language", options.languages)}
      {sel("platform", "Platform", options.platforms)}
      {showDates && (
        <>
          <label className="flex flex-col gap-1 text-xs text-muted">From<input type="date" name="from" defaultValue={current.from ?? ""} className="input" /></label>
          <label className="flex flex-col gap-1 text-xs text-muted">To<input type="date" name="to" defaultValue={current.to ?? ""} className="input" /></label>
        </>
      )}
      <button className="btn btn-primary" type="submit">Apply</button>
      <a href={action} className="btn">Reset</a>
    </form>
  );
}
