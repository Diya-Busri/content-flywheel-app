"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { DiscoverLoadFailed } from "./DiscoverLoadingWithTimeout";

const DiscoverFlow = dynamic(
  () =>
    import("./DiscoverFlow")
      .then((m) => ({ default: m?.default }))
      .catch(() => ({ default: DiscoverLoadFailed })),
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
  const searchParams = useSearchParams();
  const initialTopic = searchParams.get("topic") ?? undefined;
  return <DiscoverFlow initialTopic={initialTopic} />;
}
