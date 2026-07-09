"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Copy,
  CheckCheck,
  Video,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Film,
  Download,
  Play,
  Upload,
  ImageIcon,
  X,
} from "lucide-react";
import type { RenderJob } from "@/lib/video-engine/job-store";
import { VideoAgentOutput, VideoAgentInput } from "@/lib/video-agent-prompt";
import { setVideoPrefill, getTimelineUrl } from "@/lib/video-prefill";
import { planProject } from "@/lib/video-engine/scene-planner";
import { orchestrateAssets } from "@/lib/video-engine/asset-orchestrator";
import { critiqueProject } from "@/lib/video-engine/critic-agent";
import type {
  VideoEngineProject,
  SceneAssetPlan,
  CriticReport,
  SceneType,
} from "@/lib/video-engine/schema";

// ─── Types ───────────────────────────────────────────────────────────────────

type Platform = VideoAgentInput["platform"];
type Style = VideoAgentInput["style"];

const PLATFORMS: Platform[] = ["TikTok", "Instagram Reels", "YouTube Shorts"];
const STYLES: { value: Style; label: string }[] = [
  { value: "educational", label: "📚 Educational" },
  { value: "pain-point", label: "😩 Pain Point" },
  { value: "demo", label: "🖥️ Demo" },
  { value: "motivational", label: "💪 Motivational" },
  { value: "direct sales", label: "💰 Direct Sales" },
];

// ─── Copy Button ─────────────────────────────────────────────────────────────

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleCopy}
      className="gap-1.5 text-xs h-7 shrink-0"
    >
      {copied ? <CheckCheck size={12} className="text-green-500" /> : <Copy size={12} />}
      {copied ? "Copied!" : label}
    </Button>
  );
}

// ─── Section Wrapper ──────────────────────────────────────────────────────────

function ResultSection({
  title,
  copyText,
  copyLabel,
  children,
  defaultOpen = true,
}: {
  title: string;
  copyText: string;
  copyLabel?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors text-sm font-semibold"
      >
        <span>{title}</span>
        <div className="flex items-center gap-2">
          <span onClick={(e) => e.stopPropagation()}>
            <CopyButton text={copyText} label={copyLabel} />
          </span>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>
      {open && <div className="px-4 py-4">{children}</div>}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

// ─── Duration parser ─────────────────────────────────────────────────────────
// Converts strings like "5 seconds", "3–5s", "0:05" to a plain number of seconds.

function parseDurationSeconds(raw: string): number {
  const s = raw.toLowerCase().trim();
  // Range like "3-5 seconds" or "3–5s" → take the average
  const range = s.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/);
  if (range) return Math.round((parseFloat(range[1]) + parseFloat(range[2])) / 2);
  // Colon notation like "0:05" or "1:30"
  const colon = s.match(/^(\d+):(\d{2})$/);
  if (colon) return parseInt(colon[1]) * 60 + parseInt(colon[2]);
  // Plain number or "5 seconds", "5s", "5 sec"
  const num = parseFloat(s);
  if (!isNaN(num) && num > 0) return Math.round(num);
  return 5; // safe fallback
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function VideoAgentPage() {
  const router = useRouter();

  // Form state
  const [goal, setGoal] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [platform, setPlatform] = useState<Platform>("TikTok");
  const [style, setStyle] = useState<Style>("educational");
  const [cta, setCta] = useState("");

  // Request state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VideoAgentOutput | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportDone, setExportDone] = useState(false);

  // Engine state
  const [engineProject, setEngineProject] = useState<VideoEngineProject | null>(null);
  const [engineAssets, setEngineAssets] = useState<SceneAssetPlan[] | null>(null);
  const [engineCritic, setEngineCritic] = useState<CriticReport | null>(null);
  const [enginePreparing, setEnginePreparing] = useState(false);

  // Render state
  const [renderJob, setRenderJob] = useState<RenderJob | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Per-scene asset upload state
  const [sceneUploadLoading, setSceneUploadLoading] = useState<Record<string, boolean>>({});

  // Placeholder generation state
  const [placeholderLoading, setPlaceholderLoading] = useState(false);

  const canSubmit = goal.trim() && targetAudience.trim() && cta.trim() && !loading;

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/admin/video-agent/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, targetAudience, platform, style, cta }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error ?? `Request failed (${res.status})`);
        return;
      }

      setResult(data);
      // Scroll result into view smoothly
      setTimeout(() => {
        document.getElementById("video-agent-result")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleExportToTimeline() {
    if (!result || exportLoading) return;
    setExportLoading(true);

    const timelineScenes = result.scenes.map((scene) => ({
      scene_number: scene.scene,
      duration_seconds: parseDurationSeconds(scene.duration),
      visual: scene.visual,           // B-roll / recording notes
      text_overlay: scene.onScreenText,
      voiceover_line: scene.voiceover,
    }));

    setVideoPrefill({
      title: `Video Agent: ${goal.slice(0, 60)}${goal.length > 60 ? "…" : ""}`,
      description: result.caption,
      hashtags: result.hashtags.join(" "),
      source: "campaign-mode",         // closest supported source type
      timelineScenes,
    });

    setExportDone(true);
    router.push(getTimelineUrl());
  }

  // ── Render handlers ────────────────────────────────────────────────────────

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const startPolling = useCallback((jobId: string) => {
    stopPolling();
    let consecutiveFailures = 0;

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/admin/video-engine/status/${jobId}`);

        if (!res.ok) {
          consecutiveFailures++;
          // After 5 consecutive non-OK responses (~10s), surface a visible error.
          // This catches the module-isolation case where the server can't find the
          // job (404) or any other unexpected server error.
          if (consecutiveFailures >= 5) {
            stopPolling();
            let detail = `HTTP ${res.status}`;
            try { const d = await res.json(); detail = d?.error ?? detail; } catch { /* ignore */ }
            setRenderError(`Render status unavailable: ${detail}. Check the server console for logs.`);
          }
          return;
        }

        consecutiveFailures = 0;
        const job: RenderJob = await res.json();
        setRenderJob(job);

        if (job.stage === 'complete' || job.stage === 'error') {
          stopPolling();
          if (job.stage === 'complete') {
            setTimeout(() => {
              document.getElementById('render-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 200);
          }
        }
      } catch {
        // Transient network error — keep polling
        consecutiveFailures++;
      }
    }, 2000);
  }, [stopPolling]);

  async function handleRenderVideo() {
    if (!engineProject) return;
    setRenderError(null);
    setRenderJob(null);

    try {
      const res = await fetch('/api/admin/video-engine/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(engineProject),
      });
      const data = await res.json();
      if (!res.ok) {
        setRenderError(data?.error ?? `Failed to start render (${res.status})`);
        return;
      }
      // Seed initial job state while first poll arrives
      setRenderJob({
        jobId: data.jobId,
        projectId: engineProject.id,
        projectTitle: engineProject.title,
        stage: 'queued',
        progress: 0,
        message: 'Starting…',
        createdAt: new Date().toISOString(),
      });
      startPolling(data.jobId);
    } catch {
      setRenderError('Network error — could not start render.');
    }
  }

  // ── Asset upload handlers ──────────────────────────────────────────────────

  async function handleSceneAssetUpload(sceneId: string, file: File) {
    setSceneUploadLoading((prev) => ({ ...prev, [sceneId]: true }));
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/video-engine/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        console.error("[video-engine] upload failed:", data.error);
        return;
      }
      setEngineProject((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          scenes: prev.scenes.map((s) =>
            s.id === sceneId ? { ...s, assetUrl: data.url } : s
          ),
        };
      });
    } catch (err) {
      console.error("[video-engine] upload error:", err);
    } finally {
      setSceneUploadLoading((prev) => ({ ...prev, [sceneId]: false }));
    }
  }

  function clearSceneAsset(sceneId: string) {
    setEngineProject((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        scenes: prev.scenes.map((s) =>
          s.id === sceneId ? { ...s, assetUrl: undefined } : s
        ),
      };
    });
  }

  function handlePrepareEngine() {
    if (!result || enginePreparing) return;
    setEnginePreparing(true);
    try {
      const project = planProject(result, { goal, platform });
      const assets = orchestrateAssets(project);
      const critic = critiqueProject(project);
      setEngineProject(project);
      setEngineAssets(assets);
      setEngineCritic(critic);
      // Reset if user re-generates
      setTimeout(() => {
        document.getElementById("video-engine-draft")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } finally {
      setEnginePreparing(false);
    }
  }

  async function handleGeneratePlaceholders() {
    if (!engineProject || placeholderLoading) return;
    setPlaceholderLoading(true);
    try {
      const scenes = engineProject.scenes.map((s) => ({
        id: s.id,
        sceneNumber: s.sceneNumber,
        sceneType: s.sceneType,
        onScreenText: s.onScreenText,
      }));
      const res = await fetch('/api/admin/video-engine/placeholders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: engineProject.id, scenes }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error('[video-engine] placeholder gen failed:', data.error);
        return;
      }
      const assetUrls: Record<string, string> = data.assetUrls;
      setEngineProject((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          scenes: prev.scenes.map((s) =>
            assetUrls[s.id] ? { ...s, assetUrl: assetUrls[s.id] } : s
          ),
        };
      });
    } catch (err) {
      console.error('[video-engine] placeholder error:', err);
    } finally {
      setPlaceholderLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center shrink-0">
          <Video size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Video Agent</h1>
          <p className="text-sm text-muted-foreground">
            Generate hooks, scripts, scenes, and captions for Content Flywheel promos
          </p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Video brief</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGenerate} className="space-y-5">
            {/* Goal */}
            <div className="space-y-1.5">
              <Label htmlFor="goal">
                Video goal <span className="text-orange-500">*</span>
              </Label>
              <Textarea
                id="goal"
                placeholder="e.g. Promote the digital product generator feature"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                rows={2}
                className="resize-none"
              />
            </div>

            {/* Target audience */}
            <div className="space-y-1.5">
              <Label htmlFor="audience">
                Target audience <span className="text-orange-500">*</span>
              </Label>
              <Textarea
                id="audience"
                placeholder="e.g. Beginners who want to start a faceless business and have never made money online"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                rows={2}
                className="resize-none"
              />
            </div>

            {/* Platform + Style (side by side on md+) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>
                  Platform <span className="text-orange-500">*</span>
                </Label>
                <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>
                  Style <span className="text-orange-500">*</span>
                </Label>
                <Select value={style} onValueChange={(v) => setStyle(v as Style)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STYLES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* CTA */}
            <div className="space-y-1.5">
              <Label htmlFor="cta">
                Call to action <span className="text-orange-500">*</span>
              </Label>
              <Textarea
                id="cta"
                placeholder='e.g. Start your 7-day free trial at contentflywheel.com'
                value={cta}
                onChange={(e) => setCta(e.target.value)}
                rows={2}
                className="resize-none"
              />
            </div>

            {/* Error */}
            {error && (
              <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            {/* Submit */}
            <Button
              type="submit"
              disabled={!canSubmit}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Generate video content
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <div id="video-agent-result" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Generated content</h2>
            <div className="flex items-center gap-2">
              <CopyButton
                text={JSON.stringify(result, null, 2)}
                label="Copy full JSON"
              />
              <Button
                size="sm"
                onClick={handleExportToTimeline}
                disabled={exportLoading || exportDone}
                className="gap-1.5 text-xs h-7 bg-orange-500 hover:bg-orange-600 text-white shrink-0"
              >
                {exportLoading ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : exportDone ? (
                  <CheckCheck size={12} />
                ) : (
                  <Film size={12} />
                )}
                {exportDone ? "Sent to Timeline" : "Export to Video Timeline"}
              </Button>
              <Button
                size="sm"
                onClick={handlePrepareEngine}
                disabled={enginePreparing}
                variant="outline"
                className="gap-1.5 text-xs h-7 shrink-0 border-orange-300 text-orange-600 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-950/30"
              >
                {enginePreparing ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : engineProject ? (
                  <CheckCheck size={12} />
                ) : (
                  <Sparkles size={12} />
                )}
                {engineProject ? "Engine Draft Ready" : "Prepare Video Engine Draft"}
              </Button>
            </div>
          </div>

          {/* Best Hook */}
          <ResultSection
            title="⭐ Best hook"
            copyText={result.bestHook}
            copyLabel="Copy hook"
          >
            <p className="text-sm font-medium leading-relaxed">{result.bestHook}</p>
          </ResultSection>

          {/* All Hooks */}
          <ResultSection
            title="🎣 All 5 hooks"
            copyText={result.hooks.join("\n\n")}
            copyLabel="Copy all"
            defaultOpen={false}
          >
            <ol className="space-y-3">
              {result.hooks.map((hook, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 text-xs flex items-center justify-center font-bold">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{hook}</span>
                </li>
              ))}
            </ol>
          </ResultSection>

          {/* Script */}
          <ResultSection
            title="📝 30–45 second script"
            copyText={result.script}
            copyLabel="Copy script"
          >
            <p className="text-sm leading-relaxed whitespace-pre-line">{result.script}</p>
          </ResultSection>

          {/* Scene breakdown */}
          <ResultSection
            title="🎬 Scene-by-scene breakdown"
            copyText={result.scenes
              .map(
                (s) =>
                  `Scene ${s.scene} (${s.duration})\nVisual: ${s.visual}\nVoiceover: ${s.voiceover}\nOn-screen text: ${s.onScreenText}`
              )
              .join("\n\n")}
            copyLabel="Copy scenes"
          >
            <div className="space-y-4">
              {result.scenes.map((scene) => (
                <div
                  key={scene.scene}
                  className="border border-border rounded-lg p-3 space-y-2 text-sm"
                >
                  <div className="flex items-center gap-2 font-semibold text-orange-500">
                    <span>Scene {scene.scene}</span>
                    <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded">
                      {scene.duration}
                    </span>
                  </div>
                  <div className="grid gap-1.5">
                    <div>
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Visual / B-roll
                      </span>
                      <p className="leading-snug mt-0.5">{scene.visual}</p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Voiceover
                      </span>
                      <p className="leading-snug mt-0.5">{scene.voiceover}</p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        On-screen text
                      </span>
                      <p className="leading-snug mt-0.5 font-medium">{scene.onScreenText}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ResultSection>

          {/* Caption */}
          <ResultSection
            title="✍️ Caption"
            copyText={result.caption}
            copyLabel="Copy caption"
          >
            <p className="text-sm leading-relaxed whitespace-pre-line">{result.caption}</p>
          </ResultSection>

          {/* Hashtags */}
          <ResultSection
            title="# Hashtags"
            copyText={result.hashtags.join(" ")}
            copyLabel="Copy hashtags"
          >
            <div className="flex flex-wrap gap-2">
              {result.hashtags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800 px-2.5 py-1 rounded-full font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>
          </ResultSection>

          {/* CTA */}
          <ResultSection
            title="📣 CTA line"
            copyText={result.cta}
            copyLabel="Copy CTA"
          >
            <p className="text-sm font-medium leading-relaxed">{result.cta}</p>
          </ResultSection>
        </div>
      )}

      {/* ── Video Engine Draft ─────────────────────────────────────────────── */}
      {engineProject && engineAssets && engineCritic && (
        <div id="video-engine-draft" className="space-y-4 pt-2">
          {/* Section header */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-orange-500 flex items-center justify-center">
                <Sparkles size={14} className="text-white" />
              </div>
              <h2 className="text-base font-semibold">Video Engine Draft</h2>
              <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded">
                {engineProject.id}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <CopyButton
                text={JSON.stringify({ project: engineProject, assetPlan: engineAssets, criticReport: engineCritic }, null, 2)}
                label="Copy engine JSON"
              />
              <Button
                size="sm"
                onClick={handleGeneratePlaceholders}
                disabled={placeholderLoading}
                variant="outline"
                className="gap-1.5 text-xs h-7 shrink-0 border-purple-300 text-purple-600 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-400 dark:hover:bg-purple-950/30"
              >
                {placeholderLoading ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <ImageIcon size={12} />
                )}
                {placeholderLoading ? 'Generating…' : 'Generate Placeholder Visuals'}
              </Button>
              <Button
                size="sm"
                onClick={handleRenderVideo}
                disabled={!!renderJob && renderJob.stage !== 'complete' && renderJob.stage !== 'error'}
                className="gap-1.5 text-xs h-7 bg-orange-500 hover:bg-orange-600 text-white shrink-0"
              >
                {renderJob && renderJob.stage !== 'complete' && renderJob.stage !== 'error' ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Play size={12} />
                )}
                {renderJob && renderJob.stage !== 'complete' && renderJob.stage !== 'error'
                  ? 'Rendering…'
                  : 'Render Video'}
              </Button>
            </div>
          </div>

          {/* Critic report */}
          <div
            className={`rounded-xl border px-4 py-3 text-sm space-y-2 ${
              engineCritic.passed
                ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20"
                : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20"
            }`}
          >
            <p className="font-semibold">{engineCritic.summary}</p>
            {engineCritic.issues.length > 0 && (
              <ul className="space-y-1.5">
                {engineCritic.issues.map((issue, i) => (
                  <li key={i} className="flex gap-2 text-xs leading-snug">
                    <span className={`shrink-0 font-bold uppercase tracking-wide ${issue.severity === "error" ? "text-red-500" : "text-amber-500"}`}>
                      {issue.severity === "error" ? "✕" : "⚠"}
                    </span>
                    <span>
                      <span className="font-medium">{issue.message}</span>
                      {issue.suggestion && (
                        <span className="text-muted-foreground"> — {issue.suggestion}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Project metadata strip */}
          <div className="flex flex-wrap gap-2 text-xs">
            {[
              { label: "Platform", value: engineProject.platform },
              { label: "Aspect ratio", value: engineProject.aspectRatio },
              { label: "Scenes", value: String(engineProject.scenes.length) },
              {
                label: "Total duration",
                value: `${engineProject.scenes.reduce((s, sc) => s + sc.durationSeconds, 0)}s`,
              },
              { label: "Status", value: engineProject.status },
            ].map(({ label, value }) => (
              <span key={label} className="bg-muted px-2.5 py-1 rounded-full text-muted-foreground">
                <span className="font-medium text-foreground">{label}:</span> {value}
              </span>
            ))}
          </div>

          {/* Scene cards */}
          <div className="space-y-3">
            {engineProject.scenes.map((scene, i) => {
              const plan = engineAssets[i];
              return (
                <div
                  key={scene.id}
                  className="border border-border rounded-xl overflow-hidden text-sm"
                >
                  {/* Scene header */}
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/40">
                    <span className="font-bold text-orange-500">Scene {scene.sceneNumber}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">{scene.durationSeconds}s</span>
                    <span className="text-muted-foreground">·</span>
                    <SceneTypePill type={scene.sceneType} />
                    {scene.transition && (
                      <>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">→ {scene.transition}</span>
                      </>
                    )}
                  </div>

                  {/* Scene body */}
                  <div className="px-4 py-3 grid gap-2.5">
                    {/* Voiceover */}
                    <div>
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Voiceover</span>
                      <p className="mt-0.5 leading-snug">{scene.voiceover}</p>
                    </div>

                    {/* On-screen text */}
                    {scene.onScreenText && (
                      <div>
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">On-screen text</span>
                        <p className="mt-0.5 font-medium">{scene.onScreenText}</p>
                      </div>
                    )}

                    {/* Visual prompt (ai_visual only) */}
                    {scene.visualPrompt && (
                      <div>
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                          Visual prompt (Higgsfield)
                        </span>
                        <p className="mt-0.5 text-muted-foreground italic leading-snug">{scene.visualPrompt}</p>
                      </div>
                    )}

                    {/* ── Visual Asset Upload ──────────────────────────── */}
                    <div>
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                        Visual Asset
                      </span>

                      {scene.assetUrl ? (
                        /* Uploaded — show thumbnail + remove */
                        <div className="mt-1.5 flex items-start gap-3">
                          {isImageUrl(scene.assetUrl) ? (
                            <img
                              src={scene.assetUrl}
                              alt="Scene asset"
                              className="w-14 h-24 object-cover rounded-lg border border-border shrink-0"
                            />
                          ) : (
                            <div className="w-14 h-24 rounded-lg border border-border bg-muted flex flex-col items-center justify-center gap-1 shrink-0">
                              <Film size={18} className="text-muted-foreground" />
                              <span className="text-[9px] text-muted-foreground">Video</span>
                            </div>
                          )}
                          <div className="flex flex-col gap-1 min-w-0 pt-1">
                            <p className="text-xs font-medium truncate">
                              {scene.assetUrl.split("/").pop()}
                            </p>
                            <p className="text-[10px] text-green-600 dark:text-green-400 font-medium">
                              ✓ Ready for render
                            </p>
                            {/* Replace */}
                            <label className="cursor-pointer mt-1">
                              <input
                                type="file"
                                accept="image/*,video/mp4,video/webm,video/quicktime"
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) handleSceneAssetUpload(scene.id, f);
                                  e.target.value = "";
                                }}
                              />
                              <span className="text-[10px] text-orange-500 hover:text-orange-600 underline cursor-pointer">
                                Replace
                              </span>
                            </label>
                            <button
                              type="button"
                              onClick={() => clearSceneAsset(scene.id)}
                              className="text-[10px] text-muted-foreground hover:text-red-500 transition-colors text-left"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Empty — show upload button */
                        <label className="mt-1.5 flex cursor-pointer">
                          <input
                            type="file"
                            accept="image/*,video/mp4,video/webm,video/quicktime"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleSceneAssetUpload(scene.id, f);
                              e.target.value = "";
                            }}
                          />
                          <div
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed text-xs transition-colors ${
                              sceneUploadLoading[scene.id]
                                ? "border-orange-300 text-orange-500 bg-orange-50 dark:bg-orange-950/20"
                                : "border-border text-muted-foreground hover:border-orange-400 hover:text-orange-500"
                            }`}
                          >
                            {sceneUploadLoading[scene.id] ? (
                              <Loader2 size={12} className="animate-spin shrink-0" />
                            ) : (
                              <Upload size={12} className="shrink-0" />
                            )}
                            {sceneUploadLoading[scene.id] ? "Uploading…" : "Upload image or video"}
                          </div>
                        </label>
                      )}
                    </div>

                    {/* Asset plan note */}
                    {plan && !scene.assetUrl && (
                      <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs space-y-0.5">
                        <p className="text-muted-foreground">{plan.strategy}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Render Status + Download ─────────────────────────────────────── */}
      {(renderJob || renderError) && (
        <div id="render-result" className="space-y-4 pt-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-orange-500 flex items-center justify-center">
              <Film size={14} className="text-white" />
            </div>
            <h2 className="text-base font-semibold">Render</h2>
          </div>

          {/* Error */}
          {renderError && (
            <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
              {renderError}
            </p>
          )}

          {/* Job card */}
          {renderJob && (
            <div className="border border-border rounded-xl overflow-hidden">
              {/* Stage + message */}
              <div className="px-4 py-3 flex items-center justify-between gap-3 bg-muted/30">
                <div className="flex items-center gap-2 text-sm">
                  {renderJob.stage === 'complete' ? (
                    <CheckCheck size={15} className="text-green-500 shrink-0" />
                  ) : renderJob.stage === 'error' ? (
                    <span className="text-red-500 font-bold shrink-0">✕</span>
                  ) : (
                    <Loader2 size={15} className="animate-spin text-orange-500 shrink-0" />
                  )}
                  <span className="font-medium truncate">{renderJob.message}</span>
                </div>
                <StageBadge stage={renderJob.stage} />
              </div>

              {/* Progress bar */}
              {renderJob.stage !== 'complete' && renderJob.stage !== 'error' && (
                <div className="px-4 py-3 space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Progress</span>
                    <span>{renderJob.progress}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-orange-500 transition-all duration-500"
                      style={{ width: `${renderJob.progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Error detail */}
              {renderJob.stage === 'error' && renderJob.error && (
                <div className="px-4 py-3 text-sm text-red-500 bg-red-50 dark:bg-red-950/20">
                  {renderJob.error}
                </div>
              )}

              {/* Download + preview */}
              {renderJob.stage === 'complete' && renderJob.downloadUrl && (
                <div className="px-4 py-4 space-y-3">
                  {/* Video preview */}
                  <video
                    src={renderJob.downloadUrl}
                    controls
                    playsInline
                    className="w-full max-w-[320px] mx-auto rounded-xl border border-border shadow-lg"
                    style={{ aspectRatio: '9/16', background: '#000' }}
                  />
                  {/* Download button */}
                  <div className="flex justify-center">
                    <a
                      href={renderJob.downloadUrl}
                      download={`cf-video-${renderJob.projectId}.mp4`}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors"
                    >
                      <Download size={14} />
                      Download MP4
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Asset URL helpers ────────────────────────────────────────────────────────

function isImageUrl(url: string): boolean {
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
  return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'bmp', 'svg'].includes(ext);
}

// ─── Stage badge ─────────────────────────────────────────────────────────────

const STAGE_STYLES: Record<string, { label: string; className: string }> = {
  queued:            { label: 'Queued',           className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
  generating_audio:  { label: 'Generating audio', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  bundling:          { label: 'Bundling',         className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  rendering:         { label: 'Rendering',        className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  complete:          { label: 'Complete ✓',       className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  error:             { label: 'Error',            className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
};

function StageBadge({ stage }: { stage: string }) {
  const { label, className } = STAGE_STYLES[stage] ?? STAGE_STYLES.queued;
  return (
    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide shrink-0 ${className}`}>
      {label}
    </span>
  );
}

// ─── Scene type pill ──────────────────────────────────────────────────────────

const SCENE_TYPE_STYLES: Record<SceneType, { label: string; className: string }> = {
  ai_visual:       { label: "AI Visual",       className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
  app_screenshot:  { label: "App Screenshot",  className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  product_mockup:  { label: "Product Mockup",  className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  cta:             { label: "CTA",             className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
  text_slide:      { label: "Text Slide",      className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300" },
};

function SceneTypePill({ type }: { type: SceneType }) {
  const { label, className } = SCENE_TYPE_STYLES[type];
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${className}`}>
      {label}
    </span>
  );
}
