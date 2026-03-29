"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ArrowRight, Film, ChevronDown, ChevronRight, PanelRightOpen } from "lucide-react";
import type { WizardData } from "./Step1AboutYou";

type Props = {
  wizardData: WizardData;
  onNext: (data?: Partial<WizardData>) => void;
  onBack: () => void;
};

type ScenePrompt = {
  timestamp?: string;
  duration_seconds?: number;
  visual_description?: string;
  text_overlay?: string;
  music_mood?: string;
  avatar_prompt?: string;
  voiceover_text?: string;
  voiceover_full_text?: string;
  background_prompt?: string;
  ai_video_prompt?: string;
};

/** Timeline scene shape compatible with video-timeline editor (metadata.scenes). */
type TimelineScene = {
  id: string;
  title: string;
  duration: number;
  color: string;
  elements: Array<{ id: string; type: string; media: null | { url: string } }>;
};

type SceneHelper = {
  visual_note: string;
  text_overlay: string;
  music_mood: string;
  ai_video_prompt?: string;
};

const SCENE_COLORS = ["#3b82f6", "#a855f7", "#22c55e", "#f97316", "#ec4899"];

/**
 * Parse timestamp like "0:00-0:05" or "1:30-2:00" to duration in seconds.
 * Single "0:05" is treated as 5 seconds.
 */
function calculateDurationFromTimestamp(timestamp: string | undefined): number {
  if (!timestamp || typeof timestamp !== "string") return 5;
  const t = timestamp.trim();
  const range = t.split(/\s*-\s*/);
  if (range.length >= 2) {
    const start = parseTimeToSeconds(range[0].trim());
    const end = parseTimeToSeconds(range[1].trim());
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) return Math.round(end - start);
  }
  const single = parseTimeToSeconds(t);
  return Number.isFinite(single) && single > 0 ? single : 5;
}

function parseTimeToSeconds(s: string): number {
  const parts = s.split(":").map((p) => parseInt(p.trim(), 10));
  if (parts.length === 1 && !Number.isNaN(parts[0])) return parts[0];
  if (parts.length === 2 && parts.every((n) => !Number.isNaN(n))) return parts[0] * 60 + parts[1];
  if (parts.length >= 3 && parts.every((n) => !Number.isNaN(n))) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

function buildInitialScenes(
  scenePrompts: ScenePrompt[]
): { scenes: TimelineScene[]; helpers: SceneHelper[] } {
  const scenes: TimelineScene[] = [];
  const helpers: SceneHelper[] = [];
  scenePrompts.forEach((prompt, index) => {
    const id = `scene-${index}`;
    const duration =
      typeof prompt.duration_seconds === "number" && prompt.duration_seconds > 0
        ? prompt.duration_seconds
        : calculateDurationFromTimestamp(prompt.timestamp);
    const title =
      (prompt.visual_description ?? prompt.voiceover_full_text ?? prompt.voiceover_text ?? prompt.avatar_prompt ?? prompt.ai_video_prompt ?? "").trim().slice(0, 80) ||
      (prompt.text_overlay ?? "").trim().slice(0, 80) ||
      `Scene ${index + 1}`;
    const color = SCENE_COLORS[index % SCENE_COLORS.length] ?? "#1a1a1a";
    scenes.push({
      id,
      title,
      duration,
      color,
      elements: [{ id: `${id}-bg`, type: "background", media: null }],
    });
    helpers.push({
      visual_note:
        (prompt.visual_description ?? prompt.voiceover_full_text ?? prompt.voiceover_text ?? prompt.avatar_prompt ?? "").trim() || "—",
      text_overlay: (prompt.text_overlay ?? "").trim() || "—",
      music_mood: (prompt.music_mood ?? "").trim() || "—",
      ai_video_prompt: (prompt.ai_video_prompt ?? "").trim() || undefined,
    });
  });
  return { scenes, helpers };
}

export function Step6Timeline({ wizardData, onNext, onBack }: Props) {
  const scriptStrategy = (wizardData.script_strategy ?? (wizardData as { scriptStrategy?: unknown }).scriptStrategy) as {
    scene_prompts?: ScenePrompt[];
    timelineData?: { scenes?: TimelineScene[]; scene_helpers?: SceneHelper[] };
  } | undefined;

  const rawPrompts = scriptStrategy?.scene_prompts ?? [];
  const existingTimeline = scriptStrategy?.timelineData;

  const { scenes: initialScenes, helpers: sceneHelpers } = useMemo(() => {
    if (existingTimeline?.scenes?.length && Array.isArray(existingTimeline.scene_helpers)) {
      const helpers = existingTimeline.scene_helpers as SceneHelper[];
      const scenes = existingTimeline.scenes as TimelineScene[];
      return {
        scenes,
        helpers: scenes.map((_, i) => ({
          visual_note: helpers[i]?.visual_note ?? "—",
          text_overlay: helpers[i]?.text_overlay ?? "—",
          music_mood: helpers[i]?.music_mood ?? "—",
          ai_video_prompt: helpers[i]?.ai_video_prompt,
        })),
      };
    }
    if (existingTimeline?.scenes?.length) {
      const scenes = existingTimeline.scenes as TimelineScene[];
      const fromPrompts = buildInitialScenes(rawPrompts);
      return {
        scenes,
        helpers: scenes.map((_, i) => fromPrompts.helpers[i] ?? { visual_note: "—", text_overlay: "—", music_mood: "—" }),
      };
    }
    return buildInitialScenes(rawPrompts);
  }, [rawPrompts, existingTimeline?.scenes, existingTimeline?.scene_helpers]);

  const [selectedSceneIndex, setSelectedSceneIndex] = useState(0);
  const [helperOpen, setHelperOpen] = useState(true);

  const currentHelper = sceneHelpers[selectedSceneIndex];
  const totalDuration = initialScenes.reduce((acc, s) => acc + s.duration, 0);
  const rawPromptsForScene = rawPrompts[selectedSceneIndex];
  const isAiGenerated = !!(currentHelper?.ai_video_prompt?.trim() || rawPromptsForScene?.ai_video_prompt?.trim());

  const handleSaveAndContinue = () => {
    const existing = wizardData.script_strategy ?? (wizardData as { scriptStrategy?: Record<string, unknown> }).scriptStrategy ?? {};
    onNext({
      script_strategy: {
        ...existing,
        timelineData: {
          scenes: initialScenes,
          scene_helpers: sceneHelpers,
          exportedAt: null,
        },
      },
    });
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
        Step 6 of 7 — Video Timeline
      </h2>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        Pre-populated from your blueprint. Edit captions, add footage, and adjust timing in the full editor.
      </p>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main: Timeline / scene list + link to editor */}
        <div className="flex-1 min-w-0">
          <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] overflow-hidden">
            <CardContent className="p-0">
              <div className="aspect-video bg-gray-100 dark:bg-gray-800 flex flex-col items-center justify-center text-center border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
                <Film className="w-16 h-16 text-gray-400 dark:text-gray-500 mb-4" />
                <p className="text-gray-600 dark:text-gray-400 font-medium mb-2">
                  Video Timeline Editor
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500 max-w-md mb-4">
                  {initialScenes.length} scene{initialScenes.length !== 1 ? "s" : ""} · ~{Math.round(totalDuration)}s total. Open the editor to add stock footage, captions, and music.
                </p>
                <Link
                  href="/dashboard/video-timeline"
                  className="text-sm text-orange-500 hover:text-orange-600 font-medium"
                >
                  Open Video Timeline Editor →
                </Link>
              </div>
              {/* Scene list */}
              <div className="p-4 border-t border-[#E5E7EB] dark:border-[#2A2A2A]">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Scenes (from blueprint)</p>
                <ul className="space-y-2">
                  {initialScenes.map((scene, i) => (
                    <li key={scene.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedSceneIndex(i)}
                        className={`w-full text-left rounded-lg px-3 py-2 text-sm transition-colors ${
                          selectedSceneIndex === i
                            ? "bg-orange-500/15 border border-orange-500/50 text-gray-900 dark:text-white"
                            : "border border-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        <span className="font-medium">Scene {i + 1}</span>
                        <span className="text-gray-500 dark:text-gray-400 ml-2">
                          {scene.duration}s
                        </span>
                        <span className="block truncate text-gray-600 dark:text-gray-400 mt-0.5">
                          {scene.title}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Collapsible Scene Helper sidebar */}
        <Collapsible open={helperOpen} onOpenChange={setHelperOpen} className="lg:w-80 shrink-0">
          <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A]">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="w-full flex items-center justify-between gap-2 p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <span className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <PanelRightOpen className="w-4 h-4" />
                  Scene Helper
                </span>
                {helperOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 pb-4">
                {isAiGenerated ? (
                  <>
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      🎥 AI Video Generation Guide
                    </p>
                    <ol className="text-xs text-gray-600 dark:text-gray-400 space-y-1 list-decimal list-inside mb-4">
                      <li>Copy AI prompt from Step 5</li>
                      <li>Generate video in Runway/Pika/Luma</li>
                      <li>Download video file</li>
                      <li>Upload to timeline scene</li>
                      <li>Add captions/music in timeline editor</li>
                      <li>Export final video</li>
                    </ol>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      This scene — AI prompt:
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap mb-3">
                      {currentHelper?.ai_video_prompt ?? rawPromptsForScene?.ai_video_prompt ?? "—"}
                    </p>
                    <div className="rounded-lg border border-dashed border-[#E5E7EB] dark:border-[#2A2A2A] bg-gray-50 dark:bg-gray-800/50 p-3 mb-2 text-center">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                        Upload your AI-generated video here
                      </p>
                      <p className="text-xs text-orange-600 dark:text-orange-400">
                        (Use the Video Timeline Editor to add files)
                      </p>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Don&apos;t have the video yet? Copy the prompt above and paste into{" "}
                      <a
                        href="https://runwayml.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-orange-500 hover:text-orange-600 underline"
                      >
                        Runway ML
                      </a>
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                      This scene should show:
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {currentHelper?.visual_note ?? "—"}
                    </p>
                    {currentHelper?.text_overlay && currentHelper.text_overlay !== "—" && (
                      <>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-3 mb-1">
                          Text overlay
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          &quot;{currentHelper.text_overlay}&quot;
                        </p>
                      </>
                    )}
                    {currentHelper?.music_mood && currentHelper.music_mood !== "—" && (
                      <>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-3 mb-1">
                          Music mood
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {currentHelper.music_mood}
                        </p>
                      </>
                    )}
                  </>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>

      <div className="flex justify-between items-center pt-6">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="border-[#E5E7EB] dark:border-[#2A2A2A] text-gray-700 dark:text-gray-300"
        >
          Back
        </Button>
        <Button
          type="button"
          onClick={handleSaveAndContinue}
          className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
        >
          Save & Continue
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
