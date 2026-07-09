/**
 * Settings page loading skeleton — mirrors the real page structure
 * so there's no layout shift when the server component resolves.
 */
export default function SettingsLoading() {
  return (
    <div className="p-6 md:p-10 animate-pulse">
      {/* Header */}
      <div className="h-8 w-32 bg-gray-200 dark:bg-gray-800 rounded mb-2" />
      <div className="h-4 w-64 bg-gray-200 dark:bg-gray-800 rounded mb-8" />

      {/* Card skeleton */}
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-[#E5E7EB] dark:border-[#1E1E1E] bg-white dark:bg-[#111] p-6 space-y-3">
            <div className="h-5 w-40 bg-gray-200 dark:bg-gray-800 rounded" />
            <div className="h-3 w-full bg-gray-100 dark:bg-gray-900 rounded" />
            <div className="h-3 w-3/4 bg-gray-100 dark:bg-gray-900 rounded" />
            <div className="h-9 w-28 bg-gray-200 dark:bg-gray-800 rounded-lg mt-2" />
          </div>
        ))}
      </div>
    </div>
  );
}
