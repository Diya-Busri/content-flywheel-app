"use client";

import dynamic from "next/dynamic";

const DiscoverFlow = dynamic(
  () =>
    import("./DiscoverFlow")
      .then((m) => ({ default: m?.default }))
      .catch(() =>
        import("./DiscoverLoadingWithTimeout").then((m) => ({
          default: m.DiscoverLoadFailed,
        }))
      ),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[60vh] items-center justify-center p-8">
        <div className="text-center text-[#A0A0A0]">Loading discover...</div>
      </div>
    ),
  }
);

export default function DiscoverPageClient() {
  return <DiscoverFlow />;
}
