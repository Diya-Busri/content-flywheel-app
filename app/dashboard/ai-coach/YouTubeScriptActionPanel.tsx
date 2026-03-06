"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Download, Image as ImageIcon, Film, Copy, ExternalLink } from "lucide-react";
import { setVideoPrefill, getTimelineUrl } from "@/lib/video-prefill";

const DEFAULT_VOICE_ID = "pNInz6obpgDQGcFmaJgB"; // Adam

type ScenePrompt = { scene_number: number; prompt: string };

type Props = {
  scriptText: string;
};

export function YouTubeScriptActionPanel({ scriptText }: Props) {
  const { toast } = useToast();
  const [voiceoverUrl, setVoiceoverUrl] = useState<string | null>(null);
  const [voiceoverLoading, setVoiceoverLoading] = useState(false);
  const [prompts, setPrompts] = useState<ScenePrompt[]>([]);
  const [promptsLoading, setPromptsLoading] = useState(false);
  const [sceneImages, setSceneImages] = useState<Record<number, string>>({});
  const [sceneImageLoading, setSceneImageLoading] = useState<Record<number, boolean>>({});
  const [generateAllLoading, setGenerateAllLoading] = useState(false);
  const [buildLoading, setBuildLoading] = useState(false);

  const handleGenerateVoiceover = useCallback(async () => {
    if (!scriptText.trim()) return;
    setVoiceoverLoading(true);
    setVoiceoverUrl(null);
    try {
      const res = await fetch("/api/generate-voiceover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: scriptText.trim(), voiceId: DEFAULT_VOICE_ID }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "Voiceover failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setVoiceoverUrl(url);
      toast({ title: "Voiceover ready" });
    } catch (err) {
      toast({ title: "Voiceover failed", description: err instanceof Error ? err.message : "Try again", variant: "destructive" });
    } finally {
      setVoiceoverLoading(false);
    }
  }, [scriptText, toast]);

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
          body: JSON.stringify({ prompt }),
        });
        if (!res.ok) throw new Error("Generate failed");
        const data = (await res.json()) as { url?: string };
        if (data.url) setSceneImages((prev) => ({ ...prev, [sceneNumber]: data.url! }));
      } catch {
        toast({ title: "Image failed", variant: "destructive" });
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
      const res = await fetch("/api/chat/coach/script/image-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: scriptText.trim() }),
      });
      if (!res.ok) throw new Error("Prompts failed");
      const data = (await res.json()) as { prompts?: ScenePrompt[] };
      const list = Array.isArray(data.prompts) ? data.prompts : [];
      for (let i = 0; i < list.length; i++) {
        const { scene_number, prompt } = list[i];
        setSceneImageLoading((prev) => ({ ...prev, [scene_number]: true }));
        try {
          const ir = await fetch("/api/chat/coach/generate-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt }),
          });
          if (ir.ok) {
            const j = (await ir.json()) as { url?: string };
            if (j.url) setSceneImages((prev) => ({ ...prev, [scene_number]: j.url! }));
          }
        } finally {
          setSceneImageLoading((prev) => ({ ...prev, [scene_number]: false }));
        }
      }
      setPrompts(list);
      toast({ title: "Images generated" });
    } catch {
      toast({ title: "Failed to generate images", variant: "destructive" });
    } finally {
      setGenerateAllLoading(false);
    }
  }, [scriptText, toast]);

  const handleBuildInTimeline = useCallback(async () => {
    if (!scriptText.trim()) return;
    setBuildLoading(true);
    try {
      const sceneCount = prompts.length >= 1 ? prompts.length : Math.max(1, Math.ceil(scriptText.split(/\n\n+/).length / 2));
      const chunks = splitScriptIntoScenes(scriptText.trim(), sceneCount);
      const scenesJson = chunks.map((script_text, i) => {
        const sceneNum = i + 1;
        return {
          scene_number: sceneNum,
          duration: 5,
          script_text,
          image_url: sceneImages[sceneNum] ?? null,
          caption: script_text.slice(0, 100),
        };
      });

      const createRes = await fetch("/api/saved-scripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "YouTube Script", scenes_json: scenesJson, voiceover_url: null }),
      });
      if (!createRes.ok) throw new Error("Failed to save script");
      const created = (await createRes.json()) as { id: string };

      let voiceoverUrlToSave = voiceoverUrl;
      if (voiceoverUrl && voiceoverUrl.startsWith("blob:")) {
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
              voiceoverUrlToSave = upData.url;
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
  }, [scriptText, prompts.length, sceneImages, voiceoverUrl, toast]);

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-4 max-w-[32rem]">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Post-script actions</p>

      {/* STEP 1: VOICEOVER */}
      <div>
        <p className="text-sm font-medium text-foreground mb-2">── STEP 1: VOICEOVER ──</p>
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
          {voiceoverUrl && (
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
          )}
        </div>
      </div>

      {/* STEP 2: VISUALS */}
      <div>
        <p className="text-sm font-medium text-foreground mb-2">── STEP 2: VISUALS ──</p>
        <div className="flex flex-wrap gap-2 mb-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGetImagePrompts}
            disabled={promptsLoading}
            className="gap-1.5"
          >
            {promptsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
            Get Image Prompts
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGenerateImages}
            disabled={generateAllLoading}
            className="gap-1.5"
          >
            {generateAllLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
            Generate Images
          </Button>
        </div>

        {prompts.length > 0 && (
          <div className="space-y-3">
            {prompts.map(({ scene_number, prompt }) => (
              <div key={scene_number} className="rounded-lg border border-border bg-card p-3 text-sm">
                <p className="font-medium text-muted-foreground mb-1">Scene {scene_number}</p>
                <p className="text-foreground mb-2 whitespace-pre-wrap break-words">{prompt}</p>
                <div className="flex flex-wrap gap-2 items-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1 h-8 text-xs"
                    onClick={() => {
                      window.open("https://www.midjourney.com", "_blank");
                    }}
                  >
                    <ExternalLink className="h-3 w-3" />
                    Midjourney
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1 h-8 text-xs"
                    onClick={() => {
                      window.open("https://leonardo.ai", "_blank");
                    }}
                  >
                    <ExternalLink className="h-3 w-3" />
                    Leonardo AI
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1 h-8 text-xs"
                    onClick={() => generateOneImage(scene_number, prompt)}
                    disabled={sceneImageLoading[scene_number]}
                  >
                    {sceneImageLoading[scene_number] ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                    Generate Here
                  </Button>
                  <button
                    type="button"
                    className="rounded p-1 text-muted-foreground hover:bg-muted"
                    onClick={() => {
                      navigator.clipboard.writeText(prompt);
                      toast({ title: "Copied prompt" });
                    }}
                    title="Copy prompt"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
                {sceneImages[scene_number] && (
                  <div className="mt-2 relative">
                    <img
                      src={sceneImages[scene_number]}
                      alt={`Scene ${scene_number}`}
                      className="rounded-lg max-h-40 w-auto object-contain bg-muted/50"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-1 gap-1 text-xs"
                      onClick={() => generateOneImage(scene_number, prompt)}
                      disabled={sceneImageLoading[scene_number]}
                    >
                      {sceneImageLoading[scene_number] ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                      Regenerate
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {prompts.length === 0 && generateAllLoading && (
          <p className="text-sm text-muted-foreground">Generating images…</p>
        )}
        {prompts.length > 0 && Object.keys(sceneImages).length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
            {prompts.map(({ scene_number }) => (
              <div key={scene_number} className="rounded-lg border overflow-hidden bg-muted/30">
                {sceneImageLoading[scene_number] ? (
                  <div className="aspect-square flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : sceneImages[scene_number] ? (
                  <img
                    src={sceneImages[scene_number]}
                    alt={`Scene ${scene_number}`}
                    className="w-full aspect-square object-cover"
                  />
                ) : null}
                <p className="text-xs text-center py-1 text-muted-foreground">Scene {scene_number}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* STEP 3: SEND TO TIMELINE */}
      <div>
        <p className="text-sm font-medium text-foreground mb-2">── STEP 3: SEND TO TIMELINE ──</p>
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={handleBuildInTimeline}
          disabled={buildLoading}
          className="gap-1.5 bg-orange-500 hover:bg-orange-600"
        >
          {buildLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}
          Build in Timeline
        </Button>
      </div>
    </div>
  );
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
