/**
 * Video Creation Guide page - displays personalised guide for creating marketing videos.
 * Guide data is loaded from: 1) sessionStorage (after creating a new guide), or 2) library (URL ?libraryScriptId=).
 */
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import VideoCreationGuide from "@/components/digital-products/VideoCreationGuide";
import type { VideoGuideData } from "@/components/digital-products/VideoCreationGuide";
import { mapScriptToSceneOverlays } from "@/lib/video-guide-scene-overlays";

const STORAGE_KEY = "videoCreationGuide";

export default function VideoGuidePage() {
  const [guide, setGuide] = useState<VideoGuideData | null>(null);
  const [scriptTitle, setScriptTitle] = useState<string>("");
  const [preferredVoiceId, setPreferredVoiceId] = useState<string | undefined>(undefined);
  const [scriptsForGuide, setScriptsForGuide] = useState<Array<{ id: string; title: string; length: number; hook: string; body: string; cta: string }> | undefined>(undefined);
  const [productIdForGuide, setProductIdForGuide] = useState<string | undefined>(undefined);
  const [libraryScriptIdFromStorage, setLibraryScriptIdFromStorage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const libraryScriptIdFromUrl = searchParams.get("libraryScriptId");
  const libraryScriptId = libraryScriptIdFromUrl ?? libraryScriptIdFromStorage;

  // YouTube / Content Studio context (from ?source=content-studio&channelId=...&scriptId=...&channelName=...)
  const isYouTubeMode = searchParams.get("source") === "content-studio";
  const channelId = searchParams.get("channelId") ?? undefined;
  const scriptIdFromUrl = searchParams.get("scriptId") ?? undefined;
  const channelNameFromUrl = searchParams.get("channelName") ?? undefined;
  const backUrl = isYouTubeMode
    ? `/dashboard/content-studio/create/scripts${channelId ? `?channelId=${encodeURIComponent(channelId)}` : ""}`
    : `/dashboard/digital-products/scripts${productIdForGuide ? `?productId=${productIdForGuide}` : ""}`;

  const handleProductNameChange = useCallback(
    (productName: string) => {
      setGuide((prev) => (prev ? { ...prev, productName: productName.trim() || undefined } : null));
      if (libraryScriptId && productName.trim()) {
        fetch(`/api/library/scripts/${libraryScriptId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productName: productName.trim() }),
        }).catch(() => {});
      }
    },
    [libraryScriptId]
  );

  const handleScriptRegenerated = useCallback(
    (script: { hook: string; body: string; cta: string }, updatedScenes?: VideoGuideData["scenes"]) => {
      setGuide((prev) => {
        if (!prev) return null;
        if (updatedScenes != null) return { ...prev, script, scenes: updatedScenes };
        const scenesForMapping = prev.scenes ?? prev.scenePrompts.map((s) => ({ scene: s.scene, timing: s.timing }));
        const chunks = mapScriptToSceneOverlays(script, scenesForMapping.length);
        const nextScenes = scenesForMapping.map((scene, i) => ({
          ...scene,
          textOverlay: { exactText: chunks[i] ?? "" },
        }));
        return { ...prev, script, scenes: nextScenes };
      });
    },
    []
  );

  const handleSceneVoiceoverUrlsSaved = useCallback((urls: string[]) => {
    setGuide((prev) => (prev ? { ...prev, timelineSceneVoiceoverUrls: urls } : null));
  }, []);

  const handleScriptEdited = useCallback(
    (script: { hook: string; body: string; cta: string }) => {
      setGuide((prev) => (prev ? { ...prev, script } : null));
      if (libraryScriptId) {
        fetch(`/api/library/scripts/${libraryScriptId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ script }),
        }).catch(() => {});
      }
    },
    [libraryScriptId]
  );

  const handleScenesRegenerated = useCallback(
    (payload: {
      scenes: VideoGuideData["scenes"];
      scenePrompts: VideoGuideData["scenePrompts"];
      storytellingFramework?: string;
      frameworkRationale?: string;
      engagementTriggers?: string[];
    }) => {
      setGuide((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          scenes: payload.scenes ?? prev.scenes,
          scenePrompts: payload.scenePrompts ?? prev.scenePrompts,
          ...(payload.storytellingFramework !== undefined && { storytellingFramework: payload.storytellingFramework }),
          ...(payload.frameworkRationale !== undefined && { frameworkRationale: payload.frameworkRationale }),
          ...(payload.engagementTriggers !== undefined && { engagementTriggers: payload.engagementTriggers }),
        };
      });
      if (libraryScriptId) {
        fetch(`/api/library/scripts/${libraryScriptId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scenes: payload.scenes,
            scenePrompts: payload.scenePrompts,
            ...(payload.storytellingFramework !== undefined && { storytellingFramework: payload.storytellingFramework }),
            ...(payload.frameworkRationale !== undefined && { frameworkRationale: payload.frameworkRationale }),
            ...(payload.engagementTriggers !== undefined && { engagementTriggers: payload.engagementTriggers }),
          }),
        }).catch(() => {});
      }
    },
    [libraryScriptId]
  );

  const hasTriggeredRegenerate = useRef(false);
  useEffect(() => {
    const doRegenerate = searchParams.get("regenerate") === "1" && libraryScriptId && guide && !hasTriggeredRegenerate.current;
    if (!doRegenerate) return;
    hasTriggeredRegenerate.current = true;
    fetch("/api/video-guide/regenerate-full-script", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ libraryScriptId }),
    })
      .then((res) => res.json().catch(() => ({})))
      .then((data: { script?: { hook: string; body: string; cta: string }; error?: string }) => {
        if (data.script && guide) {
          const scenesForMapping = guide.scenes ?? guide.scenePrompts.map((s) => ({ scene: s.scene, timing: s.timing }));
          const chunks = mapScriptToSceneOverlays(data.script, scenesForMapping.length);
          const updatedScenes = scenesForMapping.map((scene, i) => ({
            ...scene,
            textOverlay: { exactText: chunks[i] ?? "" },
          }));
          setGuide((prev) => (prev ? { ...prev, script: data.script!, scenes: updatedScenes } : null));
          const url = new URL(window.location.href);
          url.searchParams.delete("regenerate");
          window.history.replaceState({}, "", url.pathname + (url.search || ""));
        }
      })
      .catch(() => {});
  }, [libraryScriptId, guide, searchParams]);

  const fetchGuideFromLibrary = useCallback((scriptId: string) => {
    fetch(`/api/library/scripts/${scriptId}`, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load guide");
        return res.json();
      })
      .then(async (script: { content?: string; title?: string; platform?: string; productId?: string | null }) => {
        const isVideoGuide = script.platform === "video-guide" || script.platform === "content-studio";
        if (!isVideoGuide || !script.content) {
          setError("This library item is not a video guide.");
          return;
        }
        const data = JSON.parse(script.content) as VideoGuideData;
        if (data && data.script && Array.isArray(data.scenePrompts)) {
          setGuide(data);
          const title = script.title?.replace(/^Video Guide:\s*/i, "") || "";
          setScriptTitle(title);
          if (script.productId) setProductIdForGuide(script.productId);

          // Build the current script entry
          const currentScript = {
            id: scriptId,
            title: title || "Script",
            length: 30,
            hook: data.script.hook,
            body: data.script.body,
            cta: data.script.cta,
          };

          // If this guide belongs to a product, fetch all sibling scripts for angle tabs
          if (script.productId) {
            try {
              const siblingsRes = await fetch(
                `/api/library/scripts?productId=${encodeURIComponent(script.productId)}&platform=video-guide`,
                { cache: "no-store" }
              );
              if (siblingsRes.ok) {
                const siblings = (await siblingsRes.json()) as Array<{
                  id: string;
                  title?: string;
                  content?: string;
                }>;
                const angleScripts = siblings
                  .map((s) => {
                    try {
                      const c = typeof s.content === "string" ? JSON.parse(s.content) : s.content;
                      if (!c?.script?.hook) return null;
                      return {
                        id: s.id,
                        title: (s.title ?? "").replace(/^Video Guide:\s*/i, "") || "Script",
                        length: 30,
                        hook: c.script.hook,
                        body: c.script.body ?? "",
                        cta: c.script.cta ?? "",
                      };
                    } catch { return null; }
                  })
                  .filter((s): s is NonNullable<typeof s> => s !== null);

                if (angleScripts.length > 1) {
                  // Put current script first, keep others after
                  const others = angleScripts.filter((s) => s.id !== scriptId);
                  setScriptsForGuide([currentScript, ...others]);
                  return;
                }
              }
            } catch { /* fall through to single script */ }
          }

          setScriptsForGuide([currentScript]);
        } else {
          setError("Invalid guide data.");
        }
      })
      .catch(() => setError("Could not load guide from library."));
  }, []);

  useEffect(() => {
    // 1) Load from library if libraryScriptId is in URL (saved video guide from My Library)
    if (libraryScriptId) {
      fetchGuideFromLibrary(libraryScriptId);
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
          if (typeof data.libraryScriptId === "string" && data.libraryScriptId) setLibraryScriptIdFromStorage(data.libraryScriptId);
          return;
        }
      }
      setError("No guide data found. Create a video guide from a digital product (Scripts → Results → Create Video Guide).");
    } catch {
      setError("Invalid guide data.");
    }
  }, [libraryScriptId, fetchGuideFromLibrary]);

  // Refetch when user returns to this tab so saved voiceovers (and other edits) always show
  useEffect(() => {
    if (!libraryScriptId) return;
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") fetchGuideFromLibrary(libraryScriptId);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [libraryScriptId, fetchGuideFromLibrary]);

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

  return (
    <VideoCreationGuide
      guide={guide}
      scriptTitle={scriptTitle || undefined}
      preferredVoiceId={preferredVoiceId}
      scripts={scriptsForGuide}
      productId={productIdForGuide}
      libraryScriptId={libraryScriptId ?? undefined}
      isYouTubeMode={isYouTubeMode}
      backUrl={backUrl}
      channelName={channelNameFromUrl}
      onProductNameChange={handleProductNameChange}
      onScriptRegenerated={handleScriptRegenerated}
      onScriptEdited={handleScriptEdited}
      onSceneVoiceoverUrlsSaved={handleSceneVoiceoverUrlsSaved}
      onScenesRegenerated={handleScenesRegenerated}
    />
  );
}
