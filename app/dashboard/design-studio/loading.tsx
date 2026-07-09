export default function DesignStudioLoading() {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden animate-pulse">
      <div className="max-w-6xl mx-auto px-3 md:px-8 py-6 md:py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 md:mb-8">
          <div className="space-y-2">
            <div className="h-7 w-44 rounded-lg bg-muted/40" />
            <div className="h-4 w-64 rounded bg-muted/30 hidden sm:block" />
          </div>
          <div className="h-9 w-32 rounded-lg bg-muted/40" />
        </div>

        {/* Bulk Content Designer banner */}
        <div className="mb-8 rounded-2xl border border-border bg-muted/10 p-5 flex items-center gap-4 h-20" />

        {/* Promote This banner */}
        <div className="mb-8 rounded-2xl border border-border bg-muted/10 p-5 flex items-center gap-4 h-20" />

        {/* Section header */}
        <div className="flex items-center gap-2 mb-4">
          <div className="h-4 w-4 rounded bg-muted/40" />
          <div className="h-5 w-36 rounded bg-muted/40" />
          <div className="h-4 w-16 rounded bg-muted/30" />
        </div>

        {/* Design grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="w-full h-36 bg-muted/30" />
              <div className="p-3 space-y-2">
                <div className="h-4 w-3/4 rounded bg-muted/40" />
                <div className="h-3 w-1/2 rounded bg-muted/30" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
