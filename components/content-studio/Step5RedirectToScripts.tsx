"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { WizardData } from "./Step1AboutYou";

type Props = {
  wizardData: WizardData;
  onNext: (data?: Partial<WizardData>) => void;
  onBack: () => void;
};

/**
 * Step 5: Redirect to Content Studio scripts page with channelId and topic context.
 * Scripts page loads wizard progress for topic/niche and uses URL params for channel/topic override.
 */
export function Step5RedirectToScripts(_props: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const channelId =
      searchParams.get("channelId") ||
      (typeof localStorage !== "undefined" ? localStorage.getItem("selected_youtube_channel_id") : null);
    const topic =
      searchParams.get("topic") ||
      (typeof localStorage !== "undefined" ? localStorage.getItem("selected_topic") : null);

    const params = new URLSearchParams();
    if (channelId) params.set("channelId", channelId);
    if (topic) params.set("topic", topic);
    const query = params.toString();
    const path = `/dashboard/content-studio/create/scripts${query ? `?${query}` : ""}`;
    router.push(path);
  }, [router, searchParams]);

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400">Loading script generator...</p>
      </div>
    </div>
  );
}
