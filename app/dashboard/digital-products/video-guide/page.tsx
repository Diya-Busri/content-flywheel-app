/**
 * Video Creation Guide page - displays personalised guide for creating marketing videos.
 * Guide data is loaded from sessionStorage (set before navigation) or can be passed via URL state.
 */
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import VideoCreationGuide from "@/components/digital-products/VideoCreationGuide";
import type { VideoGuideData } from "@/components/digital-products/VideoCreationGuide";

const STORAGE_KEY = "videoCreationGuide";

export default function VideoGuidePage() {
  const [guide, setGuide] = useState<VideoGuideData | null>(null);
  const [scriptTitle, setScriptTitle] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data && data.script && Array.isArray(data.scenePrompts)) {
          setGuide(data as VideoGuideData);
          if (typeof data.scriptTitle === "string") setScriptTitle(data.scriptTitle);
          return;
        }
      }
      setError("No guide data found. Go back and generate a video creation guide.");
    } catch {
      setError("Invalid guide data.");
    }
  }, []);

  if (error) {
    return (
      <main className="min-h-screen p-6 md:p-10 flex flex-col items-center justify-center">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-6">
            <FileText className="w-8 h-8 text-amber-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No guide found</h1>
          <p className="text-gray-600 dark:text-[#A0A0A0] mb-8">{error}</p>
          <Button asChild variant="outline" className="border-[#E5E7EB] dark:border-[#2A2A2A] text-gray-600 dark:text-[#A0A0A0]">
            <Link href="/dashboard/digital-products/results">Back to Results</Link>
          </Button>
        </div>
      </main>
    );
  }

  if (!guide) {
    return (
      <main className="min-h-screen p-6 md:p-10 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-orange-500 mb-4" />
        <p className="text-gray-600 dark:text-[#A0A0A0]">Loading guide...</p>
      </main>
    );
  }

  return <VideoCreationGuide guide={guide} scriptTitle={scriptTitle || undefined} />;
}
