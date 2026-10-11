export default function Footer() {
  return (
    <footer className="mt-12 border-t border-line bg-surface2">
      <div className="mx-auto max-w-7xl px-4 py-6 text-xs leading-relaxed text-muted">
        <p className="font-semibold text-ink">OTT Release Radar</p>
        <p>
          Release data from TMDB, platform availability cross-checked with the RapidAPI OTT Details API, recommendations by Google Gemini.
          This product uses the TMDB API but is not endorsed or certified by TMDB. Release dates are calendar dates; platform names are shown only when confirmed.
        </p>
      </div>
    </footer>
  );
}
