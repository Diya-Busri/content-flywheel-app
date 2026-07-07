/**
 * LoadingCard — skeleton loading placeholder
 * ──────────────────────────────────────────────────────────────────────────────
 * Usage:
 *   <LoadingCard lines={3} />
 *   <LoadingGrid count={6} />
 *   <LoadingPageHeader />
 */

/* ─── Base pulse line ─────────────────────────────────────────────────────────── */
function PulseLine({ w = "w-full", h = "h-4" }: { w?: string; h?: string }) {
  return (
    <div
      className={`${w} ${h} rounded bg-gray-200 dark:bg-gray-800 animate-pulse`}
    />
  );
}

/* ─── Single card skeleton ───────────────────────────────────────────────────── */
export function LoadingCard({
  lines = 2,
  showAvatar = false,
  showImage = false,
  className = "",
}: {
  lines?: number;
  showAvatar?: boolean;
  showImage?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-[#E5E7EB] dark:border-[#1E1E1E] bg-white dark:bg-[#111] p-4 ${className}`}
    >
      {showImage && (
        <div className="w-full h-32 rounded-lg bg-gray-200 dark:bg-gray-800 animate-pulse mb-4" />
      )}

      <div className="flex items-start gap-3">
        {showAvatar && (
          <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-800 animate-pulse shrink-0" />
        )}
        <div className="flex-1 space-y-2.5">
          <PulseLine w="w-3/4" h="h-4" />
          {Array.from({ length: lines - 1 }).map((_, i) => (
            <PulseLine
              key={i}
              w={i === lines - 2 ? "w-1/2" : "w-full"}
              h="h-3"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Grid of loading cards ──────────────────────────────────────────────────── */
export function LoadingGrid({
  count = 6,
  cols = "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  className = "",
}: {
  count?: number;
  cols?: string;
  className?: string;
}) {
  return (
    <div className={`grid ${cols} gap-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <LoadingCard key={i} lines={3} />
      ))}
    </div>
  );
}

/* ─── Page header skeleton ───────────────────────────────────────────────────── */
export function LoadingPageHeader() {
  return (
    <div className="py-4 px-4 sm:px-6 md:px-8">
      <PulseLine w="w-32" h="h-3" />
      <div className="mt-2 flex items-center justify-between gap-4">
        <PulseLine w="w-64" h="h-7" />
        <div className="h-8 w-28 rounded-lg bg-gray-200 dark:bg-gray-800 animate-pulse shrink-0" />
      </div>
    </div>
  );
}

/* ─── Inline list item skeleton ──────────────────────────────────────────────── */
export function LoadingListItem({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 p-3 ${className}`}>
      <div className="h-9 w-9 rounded-lg bg-gray-200 dark:bg-gray-800 animate-pulse shrink-0" />
      <div className="flex-1 space-y-2">
        <PulseLine w="w-40" h="h-3.5" />
        <PulseLine w="w-24" h="h-2.5" />
      </div>
      <div className="h-7 w-16 rounded-lg bg-gray-200 dark:bg-gray-800 animate-pulse shrink-0" />
    </div>
  );
}

/* ─── Full-page loading state ────────────────────────────────────────────────── */
export function LoadingPage() {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <LoadingPageHeader />
      <div className="px-4 sm:px-6 md:px-8 pb-12 space-y-6">
        <LoadingGrid count={3} cols="grid-cols-1 sm:grid-cols-3" />
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <LoadingListItem
              key={i}
              className="rounded-xl border border-[#E5E7EB] dark:border-[#1E1E1E]"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
