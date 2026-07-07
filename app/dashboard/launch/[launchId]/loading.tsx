export default function ExecutionLoading() {
  return (
    <div className="min-h-dvh bg-background animate-pulse">
      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12 space-y-6">
        {/* Back button */}
        <div className="h-4 w-24 rounded bg-muted/30" />

        {/* Header */}
        <div className="space-y-3">
          <div className="h-7 w-64 rounded-xl bg-muted/40" />
          <div className="h-4 w-48 rounded bg-muted/30" />
          {/* Progress bar */}
          <div className="h-2 w-full rounded-full bg-muted/40 mt-4" />
        </div>

        {/* Agent cards */}
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-muted/40 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-32 rounded bg-muted/40" />
                <div className="h-3 w-48 rounded bg-muted/30" />
              </div>
              <div className="h-6 w-16 rounded-full bg-muted/30" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
