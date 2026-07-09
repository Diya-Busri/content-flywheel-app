"use client";

/**
 * AvatarVideoPanel
 * Multi-provider AI avatar promo video generator.
 * Adapts UI based on detected provider: falai | did | heygen
 *
 * Provider auto-detected server-side from env vars:
 *   FAL_API_KEY  → fal.ai SadTalker (~$0.01/video) ← cheapest
 *   DID_API_KEY  → D-ID (~$0.10/video)
 *   HEYGEN_API_KEY → HeyGen (most expensive, highest quality)
 */
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Sparkles, Download, RefreshCw, Video, Play, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { registerPendingVideo } from "@/components/video-notification-watcher";

// Shared types mirroring server responses
type FacePreset = { id: string; label: string; url?: string };
type VoiceOption = { id: string; label: string };
type HeyGenAvatar = { avatar_id: string; avatar_name: string; gender?: string; premium?: boolean };

type ProviderInfo = {
  provider: "falai" | "did" | "heygen" | "unknown";
  available: boolean;
  missingEnv?: string | null;
  facePresets: FacePreset[];
  voices: VoiceOption[];
  avatars: HeyGenAvatar[];
};

type AvatarVideoPanelProps = {
  productId: string;
  productTitle?: string;
  existingVideoUrl?: string | null;
  existingVideoStatus?: string | null;
  existingVideoId?: string | null;
  onVideoReady?: (url: string) => void;
};

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 72; // ~6 min

const BACKGROUND_PRESETS = [
  { value: "office", label: "Office (light grey)" },
  { value: "studio", label: "Studio (dark)" },
  { value: "bedroom", label: "Bedroom (warm)" },
  { value: "gradient", label: "Gradient (blue-purple)" },
  { value: "warm", label: "Warm (cream)" },
];

const PROVIDER_LABELS: Record<string, string> = {
  falai: "fal.ai SadTalker (~$0.01/video)",
  did: "D-ID (~$0.10/video)",
  heygen: "HeyGen",
};

export function AvatarVideoPanel({
  productId,
  productTitle = "Digital Product",
  existingVideoUrl,
  existingVideoStatus,
  existingVideoId,
  onVideoReady,
}: AvatarVideoPanelProps) {
  const [step, setStep] = useState<"idle" | "configure" | "generating" | "done" | "failed">(
    existingVideoUrl ? "done" : existingVideoStatus === "processing" ? "generating" : "idle"
  );

  const [providerInfo, setProviderInfo] = useState<ProviderInfo | null>(null);
  const [loadingProvider, setLoadingProvider] = useState(false);

  // Shared config
  const [selectedFaceId, setSelectedFaceId] = useState<string>("");
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("");
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>("");
  const [backgroundPreset, setBackgroundPreset] = useState("office");
  const [script, setScript] = useState("");
  const [generatingScript, setGeneratingScript] = useState(false);

  // Job state
  const [currentJobId, setCurrentJobId] = useState<string | null>(existingVideoId ?? null);
  const [currentProvider, setCurrentProvider] = useState<string>("falai");
  const [videoUrl, setVideoUrl] = useState<string | null>(existingVideoUrl ?? null);
  const [pollAttempt, setPollAttempt] = useState(0);

  const { toast } = useToast();

  const loadProviderInfo = useCallback(async () => {
    setLoadingProvider(true);
    try {
      const res = await fetch(`/api/products/${productId}/avatar-video`);
      const data = await res.json() as ProviderInfo;
      setProviderInfo(data);
      setCurrentProvider(data.provider);
      if (data.facePresets[0]) setSelectedFaceId(data.facePresets[0].id);
      if (data.voices[0]) setSelectedVoiceId(data.voices[0].id);
      if (data.avatars[0]) setSelectedAvatarId(data.avatars[0].avatar_id);
    } catch {
      setProviderInfo({ provider: "unknown", available: false, facePresets: [], voices: [], avatars: [] });
    } finally {
      setLoadingProvider(false);
    }
  }, [productId]);

  const handleOpenConfigure = () => {
    setStep("configure");
    if (!providerInfo) loadProviderInfo();
  };

  const handleGenerateScript = async () => {
    setGeneratingScript(true);
    try {
      const res = await fetch(`/api/products/${productId}/avatar-video/script`, { method: "POST" });
      if (res.ok) {
        const data = await res.json() as { script?: string };
        if (data.script) setScript(data.script);
      }
    } catch { /* silent — user can type manually */ }
    finally { setGeneratingScript(false); }
  };

  const handleGenerate = async () => {
    if (!providerInfo) return;
    const provider = providerInfo.provider;

    // Validate selections
    if (provider === "heygen" && !selectedAvatarId) {
      toast({ title: "Select an avatar first", variant: "destructive" }); return;
    }
    if ((provider === "falai" || provider === "did") && !selectedFaceId) {
      toast({ title: "Select a presenter first", variant: "destructive" }); return;
    }

    setStep("generating");
    setPollAttempt(0);

    try {
      const body: Record<string, string | undefined> = {
        script: script || undefined,
        backgroundPreset,
      };

      if (provider === "heygen") {
        body.avatarId = selectedAvatarId;
        body.voiceId = selectedVoiceId;
      } else if (provider === "falai") {
        body.facePresetId = selectedFaceId;
        body.ttsVoice = selectedVoiceId;
      } else if (provider === "did") {
        body.facePresetId = selectedFaceId;
        body.voiceId = selectedVoiceId;
      }

      const res = await fetch(`/api/products/${productId}/avatar-video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json() as {
        jobId?: string;
        provider?: string;
        script?: string;
        videoUrl?: string;
        error?: string;
      };

      if (!res.ok) throw new Error(data.error ?? "Failed to start video generation");

      if (data.videoUrl) {
        // HeyGen synchronous response
        setVideoUrl(data.videoUrl);
        setStep("done");
        onVideoReady?.(data.videoUrl);
        toast({ title: "Promo video ready! 🎉" });
        return;
      }

      if (!data.jobId) throw new Error("No job ID returned");
      setCurrentJobId(data.jobId);
      setCurrentProvider(data.provider ?? provider);
      if (data.script && !script) setScript(data.script);
      // Register with the global watcher so notifications fire even after navigation
      registerPendingVideo({
        productId,
        jobId: data.jobId,
        provider: data.provider ?? provider,
        productTitle,
      });
      toast({ title: "Video generating…", description: "We'll poll until it's ready (1–4 min)." });
    } catch (err) {
      setStep("failed");
      toast({ title: "Failed to start video", description: err instanceof Error ? err.message : "Try again.", variant: "destructive" });
    }
  };

  // Auto-poll
  useEffect(() => {
    if (step !== "generating" || !currentJobId || currentJobId === "heygen-sync") return;
    if (pollAttempt >= MAX_POLL_ATTEMPTS) {
      setStep("failed");
      toast({ title: "Timed out", description: "Check your provider dashboard.", variant: "destructive" });
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/products/${productId}/avatar-video/status?videoId=${currentJobId}&provider=${currentProvider}`
        );
        const data = await res.json() as { status?: string; videoUrl?: string; error?: string };
        if (data.status === "completed" && data.videoUrl) {
          setVideoUrl(data.videoUrl);
          setStep("done");
          onVideoReady?.(data.videoUrl);
          toast({ title: "Promo video ready! 🎉" });
        } else if (data.status === "failed") {
          setStep("failed");
          toast({ title: "Video failed", description: data.error ?? "Generation failed", variant: "destructive" });
        } else {
          setPollAttempt((p) => p + 1);
        }
      } catch {
        setPollAttempt((p) => p + 1);
      }
    }, POLL_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [step, currentJobId, pollAttempt, productId, currentProvider, onVideoReady, toast]);

  const handleReset = () => {
    setStep("configure");
    setCurrentJobId(null);
    setVideoUrl(null);
    setPollAttempt(0);
    if (!providerInfo) loadProviderInfo();
  };

  // ── Idle ──────────────────────────────────────────────────
  if (step === "idle") {
    return (
      <div className="space-y-3">
        <div>
          <p className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
            <Video className="w-3.5 h-3.5 text-orange-500" />
            AI Avatar Promo Video
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Create a 9:16 vertical video with an AI presenter — perfect for TikTok, Reels & Shorts.
          </p>
        </div>
        <Button type="button" size="sm" className="w-full bg-orange-500 hover:bg-orange-600 gap-2" onClick={handleOpenConfigure}>
          <Sparkles className="w-4 h-4" /> Create Promo Video
        </Button>
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 flex items-center justify-center h-24">
          <div className="text-center space-y-1">
            <Play className="w-5 h-5 text-gray-300 mx-auto" />
            <p className="text-xs text-gray-400">No video yet</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Configure ─────────────────────────────────────────────
  if (step === "configure") {
    const provider = providerInfo?.provider;
    const providerLabel = provider ? PROVIDER_LABELS[provider] ?? provider : "Loading…";

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
            <Video className="w-3.5 h-3.5 text-orange-500" /> Configure Promo Video
          </p>
          {providerInfo?.provider && (
            <span className="text-xs text-gray-400 bg-gray-100 rounded px-2 py-0.5">
              via {providerLabel}
            </span>
          )}
        </div>

        {loadingProvider && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Detecting provider…
          </div>
        )}

        {providerInfo && !providerInfo.available && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700 space-y-1">
            <p className="font-medium">Provider not configured</p>
            <p>Add <code className="bg-amber-100 px-1 rounded">{providerInfo.missingEnv}</code> to your <code className="bg-amber-100 px-1 rounded">.env.local</code> to enable avatar videos.</p>
            <p className="text-amber-600">Cheapest option: add <code className="bg-amber-100 px-1 rounded">FAL_API_KEY</code> + <code className="bg-amber-100 px-1 rounded">BLOB_READ_WRITE_TOKEN</code></p>
          </div>
        )}

        {providerInfo?.available && (
          <div className="space-y-3">
            {/* Face / Avatar picker */}
            {(provider === "falai" || provider === "did") && providerInfo.facePresets.length > 0 && (
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Presenter</Label>
                <Select value={selectedFaceId} onValueChange={setSelectedFaceId}>
                  <SelectTrigger className="h-8 text-xs border-gray-200">
                    <SelectValue placeholder="Pick a presenter" />
                  </SelectTrigger>
                  <SelectContent>
                    {providerInfo.facePresets.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {provider === "heygen" && providerInfo.avatars.length > 0 && (
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Avatar</Label>
                <Select value={selectedAvatarId} onValueChange={setSelectedAvatarId}>
                  <SelectTrigger className="h-8 text-xs border-gray-200">
                    <SelectValue placeholder="Select avatar" />
                  </SelectTrigger>
                  <SelectContent>
                    {providerInfo.avatars.slice(0, 20).map((a) => (
                      <SelectItem key={a.avatar_id} value={a.avatar_id} className="text-xs">
                        {a.avatar_name} {a.premium ? "⭐" : ""} {a.gender ? `(${a.gender})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Voice picker */}
            {providerInfo.voices.length > 0 && (
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">
                  {provider === "falai" ? "Voice (OpenAI TTS)" : "Voice"}
                </Label>
                <Select value={selectedVoiceId} onValueChange={setSelectedVoiceId}>
                  <SelectTrigger className="h-8 text-xs border-gray-200">
                    <SelectValue placeholder="Select voice" />
                  </SelectTrigger>
                  <SelectContent>
                    {providerInfo.voices.map((v) => (
                      <SelectItem key={v.id} value={v.id} className="text-xs">{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Background (HeyGen only) */}
            {provider === "heygen" && (
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Background</Label>
                <Select value={backgroundPreset} onValueChange={setBackgroundPreset}>
                  <SelectTrigger className="h-8 text-xs border-gray-200"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BACKGROUND_PRESETS.map((bg) => (
                      <SelectItem key={bg.value} value={bg.value} className="text-xs">{bg.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Script */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs text-gray-600">Script (auto-generated if blank)</Label>
                <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs text-orange-500 hover:text-orange-600"
                  onClick={handleGenerateScript} disabled={generatingScript}>
                  {generatingScript ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  {generatingScript ? " Writing…" : " Auto-write"}
                </Button>
              </div>
              <Textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                placeholder="Hey! I just found the most amazing resource…"
                className="text-xs min-h-[72px] border-gray-200 resize-none"
                maxLength={500}
              />
              <p className="text-xs text-gray-400 mt-0.5">
                {script.length}/500 · ~{Math.max(5, Math.round(script.split(/\s+/).filter(Boolean).length / 2))}s video
              </p>
            </div>

            <div className="flex gap-2">
              <Button type="button" size="sm" className="flex-1 bg-orange-500 hover:bg-orange-600 gap-1" onClick={handleGenerate}>
                <Video className="w-3.5 h-3.5" /> Generate
              </Button>
              <Button type="button" variant="outline" size="sm" className="border-gray-200 text-gray-500" onClick={() => setStep("idle")}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Generating ────────────────────────────────────────────
  if (step === "generating") {
    const elapsed = Math.round((pollAttempt * POLL_INTERVAL_MS) / 1000);
    return (
      <div className="space-y-3">
        <p className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
          <Video className="w-3.5 h-3.5 text-orange-500" /> Generating Promo Video
        </p>
        <div className="rounded-xl border border-dashed border-orange-200 bg-orange-50 flex flex-col items-center justify-center gap-3 py-8">
          <Loader2 className="w-7 h-7 animate-spin text-orange-400" />
          <div className="text-center">
            <p className="text-xs font-medium text-orange-600">AI is creating your video…</p>
            <p className="text-xs text-gray-400 mt-0.5">{elapsed}s elapsed · usually 1–4 min</p>
            <p className="text-xs text-gray-300 mt-0.5">via {PROVIDER_LABELS[currentProvider] ?? currentProvider}</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Done ──────────────────────────────────────────────────
  if (step === "done" && videoUrl) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Promo Video Ready
          </p>
          <div className="flex gap-1.5">
            <Button type="button" variant="outline" size="sm" className="gap-1 h-8 border-gray-200"
              onClick={() => window.open(videoUrl, "_blank")}>
              <Download className="w-3.5 h-3.5" /> Download
            </Button>
            <Button type="button" variant="outline" size="sm" className="gap-1 h-8 border-gray-200 text-gray-500" onClick={handleReset}>
              <RefreshCw className="w-3.5 h-3.5" /> Regenerate
            </Button>
          </div>
        </div>
        <div className="rounded-xl overflow-hidden border border-gray-100 shadow-sm bg-black flex items-center justify-center" style={{ minHeight: 200 }}>
          <video src={videoUrl} controls playsInline className="w-full" style={{ maxHeight: 320 }} />
        </div>
        {currentProvider === "did" && (
          <p className="text-xs text-gray-400">D-ID video links may expire — download to save permanently.</p>
        )}
      </div>
    );
  }

  // ── Failed ────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-red-100 bg-red-50 p-3 flex items-start gap-2">
        <XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-medium text-red-700">Video generation failed</p>
          <p className="text-xs text-red-500 mt-0.5">Check your provider plan limits or try again.</p>
        </div>
      </div>
      <Button type="button" size="sm" className="w-full bg-orange-500 hover:bg-orange-600 gap-1" onClick={handleReset}>
        <RefreshCw className="w-3.5 h-3.5" /> Try Again
      </Button>
    </div>
  );
}
