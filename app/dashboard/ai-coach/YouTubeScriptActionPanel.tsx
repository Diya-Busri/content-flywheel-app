"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Download, Image as ImageIcon, Film, Copy, ExternalLink, FileText, Layout, Video, Search } from "lucide-react";
import { setVideoPrefill, getTimelineUrl } from "@/lib/video-prefill";

const DEFAULT_VOICE_ID = "pNInz6obpgDQGcFmaJgB"; // Adam

const VOICE_OPTIONS = [
  // Male voices
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", description: "Deep, confident male" },
  { id: "ErXwobaYiN019PkySvjV", name: "Antoni", description: "Warm, professional male" },
  { id: "VR6AewLTigWG4xSOukaG", name: "Arnold", description: "Crisp, authoritative male" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", description: "Dark, calm male (UK)" },
  { id: "N2lVS1w4EtoT3dr4eOWO", name: "Callum", description: "Mysterious, deep male" },
  { id: "ODq5zmih8GrVes37Dizd", name: "Patrick", description: "Trustworthy, mid-range male" },
  { id: "g5CIjZEefAph4nQFvHAz", name: "Ethan", description: "Soft, ASMR-style male" },
  { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh", description: "Young, deep, casual male" },
  { id: "yoZ06aMxZJJ28mfd3POQ", name: "Sam", description: "Raspy, intense male" },
  { id: "2EiwWnXFnvU5JabPnv8n", name: "Clyde", description: "War veteran, gruff male" },
  { id: "ZQe5CZNOzWyzPSCn5a3c", name: "James", description: "Calm, Australian male" },
  { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie", description: "Natural, conversational (AU)" },
  { id: "XB0fDUnXU5powFXDhCwa", name: "Charlotte", description: "Swedish, seductive female" },
  // Female voices
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella", description: "Soft, warm female" },
  { id: "ThT5KcBeYPX3keUQqHPh", name: "Dorothy", description: "Clear, friendly female (UK)" },
  { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi", description: "Bold, energetic female" },
  { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli", description: "Emotional, young female" },
  { id: "LcfcDJNUP1GQjkzn1xUU", name: "Emily", description: "Calm, composed female" },
  { id: "jsCqWAovK2LkecY7zXl4", name: "Freya", description: "Overly positive female" },
  { id: "z9fAnlkpzviPz146aGWa", name: "Glinda", description: "Witch-like, unique female" },
  { id: "oWAxZDx7w5VEj9dCyTzz", name: "Grace", description: "Southern American female" },
  { id: "jBpfuIE2acCO8z3wKNLl", name: "Gigi", description: "Childlike, animated female" },
  { id: "t0jbNlBVZ17f02VDIeMI", name: "Jessie", description: "Raspy, expressive female" },
  { id: "pMsXgVXv3BLzUgSXRplE", name: "Serena", description: "Pleasant, soft female" },
  { id: "D38z5RcWu1voky8WS1ja", name: "Wayne", description: "Cowboy, gruff character" },
  // Narration / documentary
  { id: "29vD33N1CtxCmqQRPOHJ", name: "Drew", description: "Well-rounded narrator" },
  { id: "CYw3kZ02Hs0563khs1Fj", name: "Dave", description: "Conversational, Essex UK" },
  { id: "flq6f7yk4E4fJM5XTYuZ", name: "Michael", description: "Authoritative narrator" },
  { id: "GBv7mTt0atIp3Br8iCZE", name: "Thomas", description: "Calm, meditative male" },
];

/** Stop patterns: start of non-narrative content (next steps, instructions, button labels, etc.) */
const NARRATIVE_STOP_PATTERNS = [
  /^\s*---\s*$/m,
  /^\s*Next steps\s*:?\s*/im,
  /^\s*\*\*Next steps\*\*\s*:?\s*/im,
  /^\s*Instructions\s*:?\s*/im,
  /^\s*\*\*Instructions\*\*\s*:?\s*/im,
  /^\s*Summary\s*:?\s*/im,
  /^\s*How to use\s+/im,
  /^\s*Use \*\*Generate Voiceover\*\*/im,
  /^\s*Use the \*\*Generate\s+/im,
  /^\s*Click \*\*Export Timeline\*\*/im,
  /^\s*Click \*\*Generate\s+/im,
  /^\s*Download SEO Package\s+/im,
  /^\s*Export Timeline for Editing\s+/im,
  /^\s*Generate Thumbnail Prompts\s+/im,
  /^\s*The Timeline holds\s+/im,
  /^\s*You can also click \*\*Generate SEO\*\*/im,
  /^\s*\(1\)\s+Export Timeline/im,
  /^\s*\(2\)\s+Download SEO/im,
  /^\s*\(3\)\s+Generate Thumbnail/im,
];

/**
 * Extracts only the script narrative (dialogue/narration) from the full AI Coach response.
 * Strips "Next steps", instructions, button labels, and post-script actions so
 * voiceover is generated only for the actual spoken content.
 */
function extractScriptNarrativeOnly(fullText: string): string {
  const trimmed = fullText.trim();
  if (!trimmed) return trimmed;

  // Split into paragraphs (double newline) so we can stop at the first non-narrative block
  const paragraphs = trimmed.split(/\n\n+/);

  for (let i = 0; i < paragraphs.length; i++) {
    const block = paragraphs[i].trim();
    if (!block) continue;
    for (const pattern of NARRATIVE_STOP_PATTERNS) {
      if (pattern.test(block)) {
        const narrative = paragraphs.slice(0, i).join("\n\n").trim();
        return narrative || trimmed;
      }
    }
  }

  return trimmed;
}

type ScenePrompt = { scene_number: number; prompt: string; section_label?: string; animation_style?: string; duration_seconds?: number };

type SeoPackage = { titles: string[]; description: string; tags: string[]; thumbnailConcept: string };

type VideoHit = { id: number; url: string; duration: number; thumbnail: string };

type Props = {
  scriptText: string;
  isAdmin?: boolean;
};

export function YouTubeScriptActionPanel({ scriptText, isAdmin = false }: Props) {
  const { toast } = useToast();
  const [voiceoverUrl, setVoiceoverUrl] = useState<string | null>(null);
  /** Per-section voiceover blob URLs (scene number 1..N). When set, timeline uses these instead of single voiceoverUrl. */
  const [sceneVoiceoverUrls, setSceneVoiceoverUrls] = useState<Record<number, string>>({});
  const [voiceoverLoading, setVoiceoverLoading] = useState(false);
  const [selectedVoiceId, setSelectedVoiceId] = useState(DEFAULT_VOICE_ID);
  const [prompts, setPrompts] = useState<ScenePrompt[]>([]);
  const [promptsLoading, setPromptsLoading] = useState(false);
  const [sceneImages, setSceneImages] = useState<Record<number, string>>({});
  const [sceneImageLoading, setSceneImageLoading] = useState<Record<number, boolean>>({});
  const [generateAllLoading, setGenerateAllLoading] = useState(false);
  const [buildLoading, setBuildLoading] = useState(false);
  const [seoPackage, setSeoPackage] = useState<SeoPackage | null>(null);
  const [seoLoading, setSeoLoading] = useState(false);
  const [thumbnailPrompts, setThumbnailPrompts] = useState<string[]>([]);
  const [thumbnailLoading, setThumbnailLoading] = useState(false);
  const [sceneVideos, setSceneVideos] = useState<Record<number, { url: string; thumbnail: string; duration: number }>>({});
  const [videoSearchQuery, setVideoSearchQuery] = useState<Record<number, string>>({});
  const [videoSearchResults, setVideoSearchResults] = useState<Record<number, VideoHit[]>>({});
  const [videoSearchLoading, setVideoSearchLoading] = useState<Record<number, boolean>>({});
  const [generateProgress, setGenerateProgress] = useState<string | null>(null);

  const handleGenerateVoiceover = useCallback(async () => {
    if (!scriptText.trim()) return;
    const narrativeOnly = extractScriptNarrativeOnly(scriptText);
    if (!narrativeOnly.trim()) {
      toast({ title: "No script narrative found", description: "The message doesn't contain script dialogue to read. Add a script first.", variant: "destructive" });
      return;
    }
    const sectionCount = prompts.length >= 1 ? prompts.length : Math.max(1, Math.ceil(narrativeOnly.split(/\n\n+/).filter(Boolean).length));
    const chunks = splitScriptIntoScenes(narrativeOnly.trim(), sectionCount);
    if (chunks.some((c) => !c.trim())) {
      toast({ title: "Empty section", description: "Some sections have no text. Add script or use Get sections.", variant: "destructive" });
      return;
    }
    setVoiceoverLoading(true);
    setVoiceoverUrl(null);
    setSceneVoiceoverUrls({});
    try {
      const urls: Record<number, string> = {};
      for (let i = 0; i < chunks.length; i++) {
        const res = await fetch("/api/generate-voiceover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: chunks[i].trim(), voiceId: selectedVoiceId }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error || `Section ${i + 1} voiceover failed`);
        }
        const blob = await res.blob();
        urls[i + 1] = URL.createObjectURL(blob);
      }
      setSceneVoiceoverUrls(urls);
      toast({ title: "Voiceover ready", description: `${chunks.length} section clip(s). Open in Video Timeline to sync.` });
    } catch (err) {
      toast({ title: "Voiceover failed", description: err instanceof Error ? err.message : "Try again", variant: "destructive" });
    } finally {
      setVoiceoverLoading(false);
    }
  }, [scriptText, prompts.length, toast]);

  const handleGetImagePrompts = useCallback(async () => {
    if (!scriptText.trim()) return;
    setPromptsLoading(true);
    setPrompts([]);
    try {
      const res = await fetch("/api/chat/coach/script/image-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: scriptText.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "Failed");
      }
      const data = (await res.json()) as { prompts?: ScenePrompt[] };
      setPrompts(Array.isArray(data.prompts) ? data.prompts : []);
      toast({ title: "Image prompts ready" });
    } catch (err) {
      toast({ title: "Failed to get prompts", description: err instanceof Error ? err.message : "Try again", variant: "destructive" });
    } finally {
      setPromptsLoading(false);
    }
  }, [scriptText, toast]);

  const generateOneImage = useCallback(
    async (sceneNumber: number, prompt: string) => {
      setSceneImageLoading((prev) => ({ ...prev, [sceneNumber]: true }));
      try {
        const res = await fetch("/api/chat/coach/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, aspectRatio: "16:9" }),
        });
        const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
        if (!res.ok) {
          const errMsg = data.error || `Request failed (${res.status})`;
          toast({ title: "Image failed", description: errMsg, variant: "destructive" });
          return;
        }
        if (data.url) setSceneImages((prev) => ({ ...prev, [sceneNumber]: data.url! }));
        else toast({ title: "No image returned", variant: "destructive" });
      } catch (err) {
        toast({
          title: "Image failed",
          description: err instanceof Error ? err.message : "Network or server error",
          variant: "destructive",
        });
      } finally {
        setSceneImageLoading((prev) => ({ ...prev, [sceneNumber]: false }));
      }
    },
    [toast]
  );

  const handleGenerateImages = useCallback(async () => {
    if (!scriptText.trim()) return;
    setGenerateAllLoading(true);
    setSceneImages({});
    try {
      let list = prompts;
      if (list.length === 0) {
        const res = await fetch("/api/chat/coach/script/image-prompts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ script: scriptText.trim() }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          toast({ title: "Failed to get sections", description: data.error || "Try again", variant: "destructive" });
          return;
        }
        const data = (await res.json()) as { prompts?: ScenePrompt[] };
        list = Array.isArray(data.prompts) ? data.prompts : [];
        setPrompts(list);
      }
      if (list.length === 0) {
        toast({ title: "No sections found", description: "Could not parse script into sections.", variant: "destructive" });
        return;
      }
      // Generate one-by-one per script section (16:9 images; URLs persisted to storage for timeline/DB)
      for (let i = 0; i < list.length; i++) {
        const { scene_number, prompt } = list[i];
        setSceneImageLoading((prev) => ({ ...prev, [scene_number]: true }));
        try {
          const ir = await fetch("/api/chat/coach/generate-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt, aspectRatio: "16:9" }),
          });
          const j = (await ir.json().catch(() => ({}))) as { url?: string; error?: string };
          if (ir.ok && j.url) setSceneImages((prev) => ({ ...prev, [scene_number]: j.url! }));
          else if (!ir.ok) toast({ title: `Section ${scene_number} failed`, description: j.error || ir.statusText, variant: "destructive" });
          if (i < list.length - 1) await new Promise((r) => setTimeout(r, 600));
        } finally {
          setSceneImageLoading((prev) => ({ ...prev, [scene_number]: false }));
        }
      }
      toast({ title: "Done", description: `${list.length} section image(s) generated.` });
    } catch (err) {
      toast({
        title: "Generate failed",
        description: err instanceof Error ? err.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setGenerateAllLoading(false);
    }
  }, [scriptText, prompts, toast]);

  /** Generate DALL-E image for each section, then Pexels search so user can choose image OR video per scene. */
  const handleGenerateImagesAndVideos = useCallback(async () => {
    if (!scriptText.trim()) return;
    setGenerateAllLoading(true);
    setGenerateProgress(null);
    setSceneImages({});
    setVideoSearchResults({});
    try {
      let list = prompts;
      if (list.length === 0) {
        const res = await fetch("/api/chat/coach/script/image-prompts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ script: scriptText.trim() }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          toast({ title: "Failed to get sections", description: data.error || "Try again", variant: "destructive" });
          return;
        }
        const data = (await res.json()) as { prompts?: ScenePrompt[] };
        list = Array.isArray(data.prompts) ? data.prompts : [];
        setPrompts(list);
      }
      if (list.length === 0) {
        toast({ title: "No sections found", description: "Could not parse script into sections.", variant: "destructive" });
        return;
      }
      const total = list.length;
      for (let i = 0; i < list.length; i++) {
        const { scene_number, prompt } = list[i];
        setGenerateProgress(`Generating visuals for Section ${i + 1} of ${total}...`);
        setSceneImageLoading((prev) => ({ ...prev, [scene_number]: true }));
        try {
          const ir = await fetch("/api/chat/coach/generate-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt, aspectRatio: "16:9" }),
          });
          const j = (await ir.json().catch(() => ({}))) as { url?: string; error?: string };
          if (ir.ok && j.url) setSceneImages((prev) => ({ ...prev, [scene_number]: j.url! }));
          else if (!ir.ok) toast({ title: `Section ${scene_number} image failed`, description: j.error || ir.statusText, variant: "destructive" });
        } finally {
          setSceneImageLoading((prev) => ({ ...prev, [scene_number]: false }));
        }
        const pexelsQuery = prompt.split(/\s+/).slice(0, 5).join(" ").replace(/[^\w\s-]/g, "") || `scene ${scene_number}`;
        try {
          const vr = await fetch(`/api/videos/search?q=${encodeURIComponent(pexelsQuery)}&per_page=8`);
          const vData = (await vr.json().catch(() => ({}))) as { videos?: VideoHit[] };
          if (vr.ok && Array.isArray(vData.videos)) setVideoSearchResults((prev) => ({ ...prev, [scene_number]: vData.videos! }));
        } catch {
          // Pexels optional; skip
        }
        if (i < list.length - 1) await new Promise((r) => setTimeout(r, 600));
      }
      setGenerateProgress(null);
      toast({ title: "Visuals ready", description: "Each section has an AI image. You can switch any section to a stock video below." });
    } catch (err) {
      setGenerateProgress(null);
      toast({
        title: "Generate failed",
        description: err instanceof Error ? err.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setGenerateAllLoading(false);
    }
  }, [scriptText, prompts, toast]);

  const handleGenerateSeoPackage = useCallback(async () => {
    if (!scriptText.trim()) return;
    setSeoLoading(true);
    setSeoPackage(null);
    try {
      const res = await fetch("/api/chat/coach/script/youtube-seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: scriptText.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as SeoPackage | { error?: string };
      if (!res.ok) {
        toast({ title: "SEO failed", description: (data as { error?: string }).error || "Try again", variant: "destructive" });
        return;
      }
      setSeoPackage(data as SeoPackage);
      toast({ title: "SEO package ready" });
    } catch (err) {
      toast({ title: "SEO failed", description: err instanceof Error ? err.message : "Try again", variant: "destructive" });
    } finally {
      setSeoLoading(false);
    }
  }, [scriptText, toast]);

  const handleDownloadSeoPackage = useCallback(() => {
    const pkg = seoPackage;
    if (!pkg) return;
    const lines = [
      "=== TITLES (3 options) ===",
      ...pkg.titles,
      "",
      "=== DESCRIPTION ===",
      pkg.description,
      "",
      "=== TAGS (30) ===",
      pkg.tags.join(", "),
      "",
      "=== THUMBNAIL CONCEPT ===",
      pkg.thumbnailConcept,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "youtube-seo-package.txt";
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Downloaded SEO package" });
  }, [seoPackage, toast]);

  const searchStockVideo = useCallback(
    async (sceneNumber: number, query: string) => {
      const q = query.trim() || (prompts.find((p) => p.scene_number === sceneNumber)?.prompt?.split(/[.\s]/).slice(0, 4).join(" ") ?? "");
      if (!q) {
        toast({ title: "Enter a search term or get sections first", variant: "destructive" });
        return;
      }
      setVideoSearchLoading((prev) => ({ ...prev, [sceneNumber]: true }));
      setVideoSearchResults((prev) => ({ ...prev, [sceneNumber]: [] }));
      try {
        const res = await fetch(`/api/videos/search?q=${encodeURIComponent(q)}&per_page=8`);
        const data = (await res.json().catch(() => ({}))) as { videos?: VideoHit[] } | { error?: string };
        if (!res.ok) {
          toast({ title: "Search failed", description: (data as { error?: string }).error || res.statusText, variant: "destructive" });
          return;
        }
        setVideoSearchResults((prev) => ({ ...prev, [sceneNumber]: Array.isArray((data as { videos?: VideoHit[] }).videos) ? (data as { videos: VideoHit[] }).videos : [] }));
      } catch (err) {
        toast({ title: "Search failed", description: err instanceof Error ? err.message : "Try again", variant: "destructive" });
      } finally {
        setVideoSearchLoading((prev) => ({ ...prev, [sceneNumber]: false }));
      }
    },
    [prompts, toast]
  );

  const selectSceneVideo = useCallback((sceneNumber: number, hit: VideoHit) => {
    setSceneVideos((prev) => ({ ...prev, [sceneNumber]: { url: hit.url, thumbnail: hit.thumbnail, duration: hit.duration } }));
    setSceneImages((prev) => {
      const next = { ...prev };
      delete next[sceneNumber];
      return next;
    });
    setVideoSearchResults((prev) => ({ ...prev, [sceneNumber]: [] }));
    toast({ title: "Stock video selected" });
  }, []);

  const clearSceneMedia = useCallback((sceneNumber: number) => {
    setSceneImages((prev) => {
      const next = { ...prev };
      delete next[sceneNumber];
      return next;
    });
    setSceneVideos((prev) => {
      const next = { ...prev };
      delete next[sceneNumber];
      return next;
    });
    setVideoSearchResults((prev) => ({ ...prev, [sceneNumber]: [] }));
  }, []);

  const handleGenerateThumbnailPrompts = useCallback(async () => {
    if (!scriptText.trim()) return;
    setThumbnailLoading(true);
    setThumbnailPrompts([]);
    try {
      const res = await fetch("/api/chat/coach/script/thumbnail-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: scriptText.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { prompts?: string[] } | { error?: string };
      if (!res.ok) {
        toast({ title: "Thumbnail prompts failed", description: (data as { error?: string }).error || "Try again", variant: "destructive" });
        return;
      }
      setThumbnailPrompts(Array.isArray((data as { prompts?: string[] }).prompts) ? (data as { prompts: string[] }).prompts : []);
      toast({ title: "Thumbnail prompts ready" });
    } catch (err) {
      toast({ title: "Thumbnail prompts failed", description: err instanceof Error ? err.message : "Try again", variant: "destructive" });
    } finally {
      setThumbnailLoading(false);
    }
  }, [scriptText, toast]);

  const handleBuildInTimeline = useCallback(async () => {
    if (!scriptText.trim()) return;
    const narrativeOnly = extractScriptNarrativeOnly(scriptText);
    const sceneCount = prompts.length >= 1 ? prompts.length : Math.max(1, Math.ceil((narrativeOnly || scriptText).split(/\n\n+/).filter(Boolean).length));
    const rawChunks = splitScriptIntoScenes((narrativeOnly || scriptText).trim(), sceneCount);
    // Ensure we always have exactly sceneCount slots — pad with "" if the script
    // has fewer paragraphs than AI-generated scene prompts, so every prompt
    // gets a timeline scene even when the script text is shorter than expected.
    const chunks: string[] = Array.from({ length: sceneCount }, (_, i) => rawChunks[i] ?? "");

    setBuildLoading(true);
    try {
      let startSec = 0;
      const scenesJson = chunks.map((script_text, i) => {
        const sceneNum = i + 1;
        const video = sceneVideos[sceneNum];
        const imageUrl = sceneImages[sceneNum] ?? (video ? video.thumbnail : null);
        const promptForScene = prompts[i];
        const durationSeconds = promptForScene?.duration_seconds ?? video?.duration ?? 30;
        const endSec = startSec + durationSeconds;
        const timestamp = formatTimestamp(startSec) + "-" + formatTimestamp(endSec);
        const sectionLabel = promptForScene?.section_label
          ? `${promptForScene.section_label} (${timestamp})`
          : `Scene ${sceneNum} (${timestamp})`;
        // Use section label as caption fallback when script text is empty (padded scene)
        const captionBase = script_text.trim() || promptForScene?.section_label || `Scene ${sceneNum}`;
        const caption = video ? `${captionBase.slice(0, 80)} [Video]` : captionBase.slice(0, 100);
        startSec = endSec;
        return {
          scene_number: sceneNum,
          duration: durationSeconds,
          script_text,
          image_url: imageUrl ?? null,
          video_url: video?.url ?? null,
          caption,
          animation_type: promptForScene?.animation_style ?? null,
          section_label: sectionLabel,
          voiceover_url: null as string | null,
        };
      });

      const createRes = await fetch("/api/saved-scripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "YouTube Script", scenes_json: scenesJson, voiceover_url: null }),
      });
      if (!createRes.ok) throw new Error("Failed to save script");
      const created = (await createRes.json()) as { id: string };

      const hasPerSceneVo = Object.keys(sceneVoiceoverUrls).length > 0;
      if (hasPerSceneVo) {
        const updatedScenes = [...scenesJson];
        for (let i = 0; i < updatedScenes.length; i++) {
          const sceneNum = i + 1;
          const blobUrl = sceneVoiceoverUrls[sceneNum];
          if (!blobUrl || !blobUrl.startsWith("blob:")) continue;
          try {
            const blobRes = await fetch(blobUrl);
            const blob = await blobRes.blob();
            const form = new FormData();
            form.append("file", blob, `voiceover-scene-${sceneNum}.mp3`);
            form.append("libraryScriptId", created.id);
            form.append("sceneIndex", String(i));
            const upRes = await fetch("/api/video-timeline/upload-voiceover", { method: "POST", body: form });
            if (upRes.ok) {
              const upData = (await upRes.json()) as { url?: string };
              if (upData.url) (updatedScenes[i] as { voiceover_url: string | null }).voiceover_url = upData.url;
            }
          } catch {
            // continue without this scene's voiceover
          }
        }
        await fetch(`/api/saved-scripts/${created.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scenes_json: updatedScenes }),
        });
      } else if (voiceoverUrl && voiceoverUrl.startsWith("blob:")) {
        try {
          const blobRes = await fetch(voiceoverUrl);
          const blob = await blobRes.blob();
          const form = new FormData();
          form.append("file", blob, "voiceover.mp3");
          form.append("libraryScriptId", created.id);
          const upRes = await fetch("/api/video-timeline/upload-voiceover", { method: "POST", body: form });
          if (upRes.ok) {
            const upData = (await upRes.json()) as { url?: string };
            if (upData.url) {
              await fetch(`/api/saved-scripts/${created.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ voiceover_url: upData.url }),
              });
            }
          }
        } catch {
          // continue without voiceover URL
        }
      }

      setVideoPrefill({ scriptId: created.id });
      window.location.href = getTimelineUrl(created.id);
    } catch (err) {
      toast({ title: "Failed to build timeline", description: err instanceof Error ? err.message : "Try again", variant: "destructive" });
    } finally {
      setBuildLoading(false);
    }
  }, [scriptText, prompts, sceneImages, sceneVideos, sceneVoiceoverUrls, voiceoverUrl, toast]);

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-4 max-w-[32rem]">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Post-script actions</p>

      {/* STEP 1: VOICEOVER */}
      <div>
        <p className="text-sm font-medium text-foreground mb-2">── STEP 1: VOICEOVER ──</p>
        {/* Voice selector */}
        <div className="mb-2">
          <select
            value={selectedVoiceId}
            onChange={(e) => setSelectedVoiceId(e.target.value)}
            className="text-xs rounded-md border border-input bg-background px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-orange-500 w-full max-w-[260px]"
          >
            {VOICE_OPTIONS.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} — {v.description}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGenerateVoiceover}
            disabled={voiceoverLoading}
            className="gap-1.5"
          >
            {voiceoverLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Generate Voiceover
          </Button>
          {(voiceoverUrl || Object.keys(sceneVoiceoverUrls).length > 0) && (
            <>
              {Object.keys(sceneVoiceoverUrls).length > 0 ? (
                <div className="flex flex-col gap-1.5 mt-1">
                  {Object.entries(sceneVoiceoverUrls)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([sceneNum, url]) => (
                      <div key={sceneNum} className="flex items-center gap-2">
                        {Object.keys(sceneVoiceoverUrls).length > 1 && (
                          <span className="text-xs text-muted-foreground shrink-0">Clip {sceneNum}:</span>
                        )}
                        <audio controls src={url} className="h-9 max-w-[220px]" />
                      </div>
                    ))}
                  <span className="text-xs text-muted-foreground">
                    {Object.keys(sceneVoiceoverUrls).length} clip(s) ready · click &ldquo;Open in Video Timeline&rdquo; below to sync
                  </span>
                </div>
              ) : voiceoverUrl ? (
                <>
                  <audio controls src={voiceoverUrl} className="h-9 max-w-[200px]" />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      const a = document.createElement("a");
                      a.href = voiceoverUrl;
                      a.download = "voiceover.mp3";
                      a.click();
                      toast({ title: "Downloaded" });
                    }}
                  >
                    <Download className="h-4 w-4" />
                    Download Audio
                  </Button>
                </>
              ) : null}
            </>
          )}
        </div>
      </div>

      {/* STEP 2: VISUALS */}
      <div>
        <p className="text-sm font-medium text-foreground mb-2">── STEP 2: VISUALS ──</p>
        <p className="text-xs text-muted-foreground mb-2">Generate an AI image per section and get Pexels video options. For each section you can keep the image or pick a stock video.</p>
        <div className="flex flex-wrap gap-2 mb-3">
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleGenerateImagesAndVideos}
            disabled={generateAllLoading || promptsLoading || !scriptText.trim()}
            className="gap-1.5 bg-orange-500 hover:bg-orange-600"
          >
            {(generateAllLoading || promptsLoading) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}
            Generate Images &amp; Videos
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGetImagePrompts}
            disabled={promptsLoading || generateAllLoading}
            className="gap-1.5"
          >
            {promptsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
            Get sections only
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGenerateImages}
            disabled={generateAllLoading || !scriptText.trim()}
            className="gap-1.5"
          >
            {generateAllLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
            Images only
          </Button>
        </div>
        {generateProgress && (
          <p className="text-sm text-muted-foreground mb-3 flex items-center gap-2" role="status">
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            {generateProgress}
          </p>
        )}

        {prompts.length > 0 && (
          <div className="space-y-4">
            {prompts.map(({ scene_number, prompt, section_label, animation_style, duration_seconds }) => (
              <div key={scene_number} className="rounded-lg border border-border bg-card overflow-hidden">
                <div className="px-3 py-2 border-b border-border bg-muted/30">
                  <p className="font-semibold text-foreground text-sm">
                    {section_label ?? `Section ${scene_number}`}
                  </p>
                  {(animation_style != null || duration_seconds != null) && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {[animation_style, duration_seconds != null ? `${duration_seconds}s` : null].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{prompt}</p>
                </div>
                <div className="p-3">
                  {sceneImageLoading[scene_number] ? (
                    <div className="aspect-video w-full rounded-lg bg-muted/50 flex items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      <span className="sr-only">Generating image for section…</span>
                    </div>
                  ) : sceneVideos[scene_number] ? (
                    <div className="space-y-2">
                      <div className="relative aspect-video w-full rounded-lg overflow-hidden bg-muted/50">
                        <img
                          src={sceneVideos[scene_number].thumbnail}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute bottom-1 left-1 rounded px-1.5 py-0.5 bg-black/70 text-white text-[10px] flex items-center gap-1">
                          <Video className="h-3 w-3" />
                          Stock video · {sceneVideos[scene_number].duration}s
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 items-center">
                        <Button type="button" variant="outline" size="sm" className="gap-1 text-xs" onClick={() => clearSceneMedia(scene_number)}>
                          Remove / choose another
                        </Button>
                        <a href={sceneVideos[scene_number].url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:underline">
                          Open video
                        </a>
                      </div>
                    </div>
                  ) : sceneImages[scene_number] ? (
                    <div className="space-y-2">
                      <img
                        src={sceneImages[scene_number]}
                        alt={section_label ?? `Section ${scene_number}`}
                        className="w-full aspect-video rounded-lg object-cover bg-muted/50"
                      />
                      <div className="flex flex-wrap gap-2 items-center">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1 text-xs"
                          onClick={() => generateOneImage(scene_number, prompt)}
                          disabled={sceneImageLoading[scene_number] || generateAllLoading}
                        >
                          {sceneImageLoading[scene_number] ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                          Regenerate image
                        </Button>
                        <Button type="button" variant="ghost" size="sm" className="gap-1 h-8 text-xs" onClick={() => clearSceneMedia(scene_number)}>
                          Remove / use stock video
                        </Button>
                        <Button type="button" variant="ghost" size="sm" className="gap-1 h-8 text-xs" onClick={() => window.open("https://www.midjourney.com", "_blank")}>
                          <ExternalLink className="h-3 w-3" /> Midjourney
                        </Button>
                        <Button type="button" variant="ghost" size="sm" className="gap-1 h-8 text-xs" onClick={() => window.open("https://leonardo.ai", "_blank")}>
                          <ExternalLink className="h-3 w-3" /> Leonardo
                        </Button>
                        <button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted" onClick={() => { navigator.clipboard.writeText(prompt); toast({ title: "Copied prompt" }); }} title="Copy prompt">
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs font-medium text-muted-foreground">Choose: AI image or stock video</p>
                      <div className="flex flex-wrap gap-2 items-center">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1 text-xs"
                          onClick={() => generateOneImage(scene_number, prompt)}
                          disabled={sceneImageLoading[scene_number] || generateAllLoading}
                        >
                          {sceneImageLoading[scene_number] ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImageIcon className="h-3 w-3" />}
                          AI image (16:9)
                        </Button>
                        <span className="text-muted-foreground text-xs">or</span>
                        <div className="flex flex-wrap gap-1.5 items-center">
                          <input
                            type="text"
                            placeholder="Search Pexels..."
                            value={videoSearchQuery[scene_number] ?? ""}
                            onChange={(e) => setVideoSearchQuery((prev) => ({ ...prev, [scene_number]: e.target.value }))}
                            onKeyDown={(e) => e.key === "Enter" && searchStockVideo(scene_number, (videoSearchQuery[scene_number] ?? "").trim())}
                            className="h-8 w-32 rounded border border-input bg-background px-2 text-xs"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1 text-xs h-8"
                            onClick={() => searchStockVideo(scene_number, (videoSearchQuery[scene_number] ?? "").trim() || prompt.split(/\s+/).slice(0, 3).join(" "))}
                            disabled={videoSearchLoading[scene_number]}
                          >
                            {videoSearchLoading[scene_number] ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                            Stock video
                          </Button>
                        </div>
                        <button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted" onClick={() => { navigator.clipboard.writeText(prompt); toast({ title: "Copied prompt" }); }} title="Copy prompt">
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {Array.isArray(videoSearchResults[scene_number]) && videoSearchResults[scene_number].length > 0 && (
                        <div className="grid grid-cols-4 gap-1.5">
                          {videoSearchResults[scene_number].map((hit) => (
                            <button
                              key={hit.id}
                              type="button"
                              onClick={() => selectSceneVideo(scene_number, hit)}
                              className="relative aspect-video rounded overflow-hidden border border-border hover:border-orange-500 focus:border-orange-500 bg-muted/50"
                            >
                              {hit.thumbnail ? (
                                <img src={hit.thumbnail} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-[10px]">Video</div>
                              )}
                              <span className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[10px] py-0.5 text-center">{hit.duration}s</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* STEP 3: OPEN IN VIDEO TIMELINE */}
      {isAdmin && <div>
        <p className="text-sm font-medium text-foreground mb-2">── STEP 3: OPEN IN VIDEO TIMELINE ──</p>
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={handleBuildInTimeline}
          disabled={buildLoading}
          className="gap-1.5 bg-orange-500 hover:bg-orange-600"
        >
          {buildLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
          Open in Video Timeline
        </Button>
        <p className="text-xs text-muted-foreground mt-1.5">Creates scene blocks (one per section) with your images/videos and voiceover. Edit or reorder scenes, then export the final video.</p>
      </div>}

      {/* STEP 4: SEO PACKAGE */}
      <div>
        <p className="text-sm font-medium text-foreground mb-2">── STEP {isAdmin ? "4" : "3"}: SEO PACKAGE ──</p>
        <div className="flex flex-wrap gap-2 mb-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGenerateSeoPackage}
            disabled={seoLoading || !scriptText.trim()}
            className="gap-1.5"
          >
            {seoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Generate SEO Package
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownloadSeoPackage}
            disabled={!seoPackage}
            className="gap-1.5"
          >
            <Download className="h-4 w-4" />
            Download SEO Package
          </Button>
        </div>
        {seoPackage && (
          <div className="rounded-lg border border-border bg-card p-3 text-xs space-y-2 max-h-32 overflow-y-auto">
            <p className="font-medium text-foreground">Titles:</p>
            <ul className="list-disc list-inside text-muted-foreground">{seoPackage.titles.map((t, i) => <li key={i}>{t}</li>)}</ul>
            <p className="font-medium text-foreground">Thumbnail concept:</p>
            <p className="text-muted-foreground line-clamp-2">{seoPackage.thumbnailConcept}</p>
          </div>
        )}
      </div>

      {/* STEP 5: THUMBNAIL PROMPTS */}
      <div>
        <p className="text-sm font-medium text-foreground mb-2">── STEP {isAdmin ? "5" : "4"}: THUMBNAIL PROMPTS ──</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleGenerateThumbnailPrompts}
          disabled={thumbnailLoading || !scriptText.trim()}
          className="gap-1.5 mb-2"
        >
          {thumbnailLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layout className="h-4 w-4" />}
          Generate Thumbnail Prompts
        </Button>
        {thumbnailPrompts.length > 0 && (
          <div className="space-y-2">
            {thumbnailPrompts.map((p, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg border border-border bg-card p-2 text-xs">
                <span className="text-muted-foreground shrink-0">{i + 1}.</span>
                <p className="text-foreground flex-1 min-w-0">{p}</p>
                <button
                  type="button"
                  className="rounded p-1 text-muted-foreground hover:bg-muted shrink-0"
                  onClick={() => { navigator.clipboard.writeText(p); toast({ title: "Copied" }); }}
                  title="Copy"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function splitScriptIntoScenes(script: string, sceneCount: number): string[] {
  if (sceneCount <= 1) return [script];
  const parts = script.split(/\n\n+/).filter(Boolean);
  if (parts.length <= sceneCount) return parts.length ? parts : [script];
  const perScene = Math.ceil(parts.length / sceneCount);
  const chunks: string[] = [];
  for (let i = 0; i < sceneCount; i++) {
    const start = i * perScene;
    const end = i === sceneCount - 1 ? parts.length : start + perScene;
    chunks.push(parts.slice(start, end).join("\n\n"));
  }
  return chunks;
}
