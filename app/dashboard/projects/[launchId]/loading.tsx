export default function ProjectDetailLoading() {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto animate-pulse">
      {/* Sticky header skeleton */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 sm:px-6 md:px-8 py-4 flex items-center gap-4">
        <div className="h-4 w-20 rounded bg-muted/30" />
        <div className="flex-1 space-y-1.5">
          <div className="h-5 w-56 rounded bg-muted/40" />
          <div className="h-3 w-36 rounded bg-muted/30" />
        </div>
        <div className="h-8 w-24 rounded-lg bg-muted/30" />
      </div>

      <div className="px-4 sm:px-6 md:px-8 py-6 max-w-5xl mx-auto space-y-6">
        {/* Summary strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="rounded-xl border border-border bg-card px-4 py-3 space-y-2">
              <div className="h-3 w-16 rounded bg-muted/30" />
              <div className="h-7 w-10 rounded bg-muted/40" />
            </div>
          ))}
        </div>

        {/* Main content cards */}
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-muted/40 shrink-0" />
              <div className="h-5 w-40 rounded bg-muted/40" />
            </div>
            <div className="space-y-2">
              <div className="h-3 w-full rounded bg-muted/30" />
              <div className="h-3 w-5/6 rounded bg-muted/30" />
              <div className="h-3 w-4/6 rounded bg-muted/30" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
