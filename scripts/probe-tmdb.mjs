const h = { Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}` };
const g = async (p) => { const r = await fetch("https://api.themoviedb.org/3" + p, { headers: h }); return [r.status, await r.json()]; };
let [s, j] = await g("/discover/movie?region=IN&with_release_type=4&release_date.gte=2026-10-02&release_date.lte=2026-10-09&sort_by=primary_release_date.desc");
console.log("movie discover", s, j.total_results, (j.results||[]).slice(0,3).map(m=>[m.id,m.title,m.release_date,m.original_language,m.genre_ids]));
const id = j.results?.[0]?.id;
if (id) { [s, j] = await g(`/movie/${id}?append_to_response=release_dates,watch/providers`);
  console.log("detail", s, JSON.stringify(j.release_dates.results.find(r=>r.iso_3166_1==="IN")), JSON.stringify(j["watch/providers"].results.IN)); }
[s, j] = await g("/discover/tv?air_date.gte=2026-10-02&air_date.lte=2026-10-09&watch_region=IN&with_watch_providers=8|119|122&sort_by=popularity.desc");
console.log("tv discover", s, j.total_results, (j.results||[]).slice(0,3).map(m=>[m.id,m.name]));
[s, j] = await g("/watch/providers/movie?watch_region=IN");
console.log("providers", (j.results||[]).filter(p=>/netflix|prime|hotstar|zee5|sony|jio/i.test(p.provider_name)).map(p=>[p.provider_id,p.provider_name]));
