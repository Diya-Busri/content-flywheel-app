/**
 * Video Creation Guide page - displays personalised guide for creating marketing videos.
 * Guide data is loaded from: 1) sessionStorage (after creating a new guide), or 2) library (URL ?libraryScriptId=).
 */
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import VideoCreationGuide from "@/components/digital-products/VideoCreationGuide";
import type { VideoGuideData } from "@/components/digital-products/VideoCreationGuide";

const STORAGE_KEY = "videoCreationGuide";

export default function VideoGuidePage() {
  const [guide, setGuide] = useState<VideoGuideData | null>(null);
  const [scriptTitle, setScriptTitle] = useState<string>("");
  const [preferredVoiceId, setPreferredVoiceId] = useState<string | undefined>(undefined);
  const [scriptsForGuide, setScriptsForGuide] = useState<Array<{ id: string; title: string; length: number; hook: string; body: string; cta: string }> | undefined>(undefined);
  const [productIdForGuide, setProductIdForGuide] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const libraryScriptId = searchParams.get("libraryScriptId");

  useEffect(() => {
    // 1) Load from library if libraryScriptId is in URL (saved video guide from My Library)
    if (libraryScriptId) {
      fetch(`/api/library/scripts/${libraryScriptId}`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load guide");
          return res.json();
        })
        .then((script: { content?: string; title?: string; platform?: string }) => {
          if (script.platform !== "video-guide" || !script.content) {
            setError("This library item is not a video guide.");
            return;
          }
          const data = JSON.parse(script.content) as VideoGuideData;
          if (data && data.script && Array.isArray(data.scenePrompts)) {
            setGuide(data);
            setScriptTitle(script.title?.replace(/^Video Guide:\s*/i, "") || "");
          } else {
            setError("Invalid guide data.");
          }
        })
        .catch(() => setError("Could not load guide from library."));
      return;
    }

    // 2) Load from sessionStorage (just created a new guide)
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data && data.script && Array.isArray(data.scenePrompts)) {
          setGuide(data as VideoGuideData);
          if (typeof data.scriptTitle === "string") setScriptTitle(data.scriptTitle);
          if (typeof data.preferredVoiceId === "string" && data.preferredVoiceId) setPreferredVoiceId(data.preferredVoiceId);
          if (Array.isArray(data.scriptsForGuide) && data.scriptsForGuide.length > 0) setScriptsForGuide(data.scriptsForGuide);
          if (typeof data.productIdForGuide === "string" && data.productIdForGuide) setProductIdForGuide(data.productIdForGuide);
          return;
        }
      }
      setError("No guide data found. Create a video guide from a digital product (Scripts → Results → Create Video Guide).");
    } catch {
      setError("Invalid guide data.");
    }
  }, [libraryScriptId]);

  if (error) {
    return (
      <main className="min-h-screen p-6 md:p-10 flex flex-col items-center justify-center">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-6">
            <FileText className="w-8 h-8 text-amber-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No guide found</h1>
          <p className="text-gray-600 dark:text-[#A0A0A0] mb-8">{error}</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button asChild variant="outline" className="border-[#E5E7EB] dark:border-[#2A2A2A] text-gray-600 dark:text-[#A0A0A0]">
              <Link href="/dashboard/digital-products/results">Back to Results</Link>
            </Button>
            <Button asChild variant="outline" className="border-[#E5E7EB] dark:border-[#2A2A2A] text-gray-600 dark:text-[#A0A0A0]">
              <Link href="/dashboard/library">My Library</Link>
            </Button>
            <Button asChild className="bg-orange-500 hover:bg-orange-600">
              <Link href="/dashboard/digital-products">Create Video Guide</Link>
            </Button>
          </div>
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

  return <VideoCreationGuide guide={guide} scriptTitle={scriptTitle || undefined} preferredVoiceId={preferredVoiceId} scripts={scriptsForGuide} productId={productIdForGuide} />;
}
