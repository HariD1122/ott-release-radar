export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-4">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-surface2" />
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-[416px] w-[280px] shrink-0 animate-pulse rounded-lg bg-surface2" />)}
      </div>
    </div>
  );
}
