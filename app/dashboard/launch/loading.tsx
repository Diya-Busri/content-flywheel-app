export default function LaunchLoading() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-16 animate-pulse">
      <div className="w-full max-w-xl space-y-6">
        {/* Badge */}
        <div className="flex justify-center">
          <div className="h-6 w-44 rounded-full bg-muted/40" />
        </div>
        {/* Heading */}
        <div className="space-y-2 text-center">
          <div className="h-10 w-72 rounded-xl bg-muted/40 mx-auto" />
          <div className="h-10 w-56 rounded-xl bg-muted/40 mx-auto" />
        </div>
        {/* Subtitle */}
        <div className="h-4 w-80 rounded bg-muted/30 mx-auto" />
        {/* Input card */}
        <div className="rounded-2xl border border-border bg-card/50 p-5 space-y-4">
          <div className="space-y-2">
            <div className="h-5 w-full rounded bg-muted/30" />
            <div className="h-5 w-3/4 rounded bg-muted/30" />
            <div className="h-5 w-1/2 rounded bg-muted/30" />
            <div className="h-5 w-2/3 rounded bg-muted/30" />
          </div>
          <div className="flex justify-end">
            <div className="h-10 w-28 rounded-xl bg-muted/40" />
          </div>
        </div>
        {/* Pipeline preview */}
        <div className="rounded-2xl border border-border p-5">
          <div className="flex items-center gap-0">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-muted/40" />
                <div className="h-3 w-10 rounded bg-muted/30" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
