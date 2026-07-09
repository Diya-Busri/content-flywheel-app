export default function WorkspaceLoading() {
  return (
    <div className="min-h-dvh bg-background animate-pulse">
      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12 space-y-6">
        {/* Back nav */}
        <div className="flex items-center gap-3">
          <div className="h-4 w-20 rounded bg-muted/30" />
          <div className="h-4 w-1 bg-muted/20" />
          <div className="h-4 w-24 rounded bg-muted/30" />
        </div>

        {/* Header */}
        <div className="space-y-3">
          <div className="h-6 w-64 rounded-xl bg-muted/40" />
          <div className="flex gap-1.5 mt-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-muted/40" />
            ))}
          </div>
        </div>

        {/* Stage cards */}
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-muted/40 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-28 rounded bg-muted/40" />
                <div className="h-3 w-full rounded bg-muted/30" />
                <div className="h-3 w-3/4 rounded bg-muted/30" />
              </div>
            </div>
            <div className="h-16 rounded-lg bg-muted/20" />
            <div className="flex gap-2">
              <div className="h-8 w-20 rounded-lg bg-muted/30" />
              <div className="h-8 w-20 rounded-lg bg-muted/30" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
