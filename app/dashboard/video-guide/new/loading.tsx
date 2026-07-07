export default function NewVideoGuideLoading() {
  return (
    <div className="min-h-dvh bg-gray-50 dark:bg-background animate-pulse">
      {/* Back bar */}
      <div className="border-b border-gray-200 dark:border-border bg-white dark:bg-card px-4 py-4 sm:px-6">
        <div className="h-4 w-16 rounded bg-muted/40" />
      </div>

      <div className="max-w-lg mx-auto px-4 py-10 sm:py-16">
        {/* Icon */}
        <div className="flex flex-col items-center mb-8 gap-4">
          <div className="w-14 h-14 rounded-2xl bg-muted/30" />
          <div className="h-7 w-48 rounded-lg bg-muted/40" />
          <div className="h-4 w-72 rounded bg-muted/30" />
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6">
          <div className="w-6 h-6 rounded-full bg-muted/40" />
          <div className="h-3 w-20 rounded bg-muted/30" />
          <div className="w-8 h-px bg-muted/30" />
          <div className="w-6 h-6 rounded-full bg-muted/30" />
          <div className="h-3 w-16 rounded bg-muted/20" />
        </div>

        {/* Form fields */}
        <div className="space-y-5">
          <div className="h-11 rounded-lg bg-muted/30" />
          <div className="h-px w-full bg-muted/20" />
          <div className="h-11 rounded-lg border-dashed border border-muted/30" />
          <div className="h-px w-full bg-muted/20" />
          <div className="h-11 rounded-lg bg-muted/30" />
          <div className="h-24 rounded-lg bg-muted/25" />
          <div className="h-11 w-full rounded-lg bg-muted/40" />
        </div>
      </div>
    </div>
  );
}
