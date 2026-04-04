"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CTA_GOAL_OPTIONS } from "@/app/dashboard/template-studio/template-studio-shared";

interface Props {
  topic: string;
  setTopic: (v: string) => void;
  sceneCount: number;
  setSceneCount: (v: number) => void;
  longMode: boolean;
  setLongMode: (v: boolean) => void;
  targetMinutes: number;
  setTargetMinutes: (v: number) => void;
  voiceId: string;
  setVoiceId: (v: string) => void;
  ctaGoal: string;
  setCtaGoal: (v: string) => void;
  introScript: string;
  setIntroScript: (v: string) => void;
  ctaScript: string;
  setCtaScript: (v: string) => void;
  outroScript: string;
  setOutroScript: (v: string) => void;
}

export const STICKMAN_SCENE_COUNT_OPTIONS = [4, 5, 6, 7, 8] as const;
export const STICKMAN_LONG_DURATION_OPTIONS = [10, 15, 20, 25, 30, 35] as const;

/** Curated ElevenLabs voices that work well for explainer narration. */
export const STICKMAN_VOICE_OPTIONS = [
  { value: "EXAVITQu4vr4xnSDxMaL", label: "Sarah (warm female)" },
  { value: "21m00Tcm4TlvDq8ikWAM", label: "Rachel (clear female)" },
  { value: "TxGEqnHWrfWFTfGW9XjX", label: "Josh (confident male)" },
  { value: "pNInz6obpgDQGcFmaJgB", label: "Adam (deep male)" },
  { value: "yoZ06aMxZJJ28mfd3POQ", label: "Sam (neutral)" },
] as const;

export function StickmanWhiteboardSetup({
  topic,
  setTopic,
  sceneCount,
  setSceneCount,
  longMode,
  setLongMode,
  targetMinutes,
  setTargetMinutes,
  voiceId,
  setVoiceId,
  ctaGoal,
  setCtaGoal,
  introScript,
  setIntroScript,
  ctaScript,
  setCtaScript,
  outroScript,
  setOutroScript,
}: Props) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="stickman-topic">Topic / Script idea</Label>
        <Input
          id="stickman-topic"
          placeholder="e.g. How compound interest works, 5 habits of productive people"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          {longMode
            ? "AI will create a long-form storyboard (chapter flow + many scenes) targeting your selected runtime."
            : "AI will split this into scenes with captions and matching stickman poses."}
        </p>
      </div>

      {!longMode && (
        <div className="space-y-2">
          <Label>Number of scenes</Label>
          <Select
            value={String(sceneCount)}
            onValueChange={(v) => setSceneCount(Number(v))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STICKMAN_SCENE_COUNT_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} scenes
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Advanced: long YouTube mode */}
      <details className="group">
        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors list-none flex items-center gap-1">
          <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
          Advanced — Long YouTube mode
        </summary>
        <div className="mt-3 space-y-3 pl-1">
          <div className="space-y-2">
            <Label>Video mode</Label>
            <Select value={longMode ? "long" : "short"} onValueChange={(v) => setLongMode(v === "long")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="short">Short explainer (preview)</SelectItem>
                <SelectItem value="long">Long YouTube (10–35 min, 20+ scenes)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {longMode && (
            <div className="space-y-2">
              <Label>Target length</Label>
              <Select
                value={String(targetMinutes)}
                onValueChange={(v) => setTargetMinutes(Number(v))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STICKMAN_LONG_DURATION_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)}>{n} minutes</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </details>

      <div className="space-y-2">
        <Label>Narrator voice</Label>
        <Select value={voiceId} onValueChange={setVoiceId}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STICKMAN_VOICE_OPTIONS.map((v) => (
              <SelectItem key={v.value} value={v.value}>
                {v.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Video CTA goal</Label>
        <Select value={ctaGoal} onValueChange={setCtaGoal}>
          <SelectTrigger>
            <SelectValue placeholder="How should the CTA scene ask viewers to act?" />
          </SelectTrigger>
          <SelectContent>
            {CTA_GOAL_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          The model reserves the second-to-last scene for a CTA (last scene is outro). That CTA always layers in subscribe or follow, like, and share, plus the goal you pick. With only 3 scenes, CTA and outro are combined on the final scene.
        </p>
      </div>

      <details className="group border rounded-lg p-3 bg-muted/20">
        <summary className="text-sm font-medium cursor-pointer list-none flex items-center gap-1">
          <span className="group-open:rotate-90 transition-transform inline-block text-xs">▶</span>
          Optional — exact intro / CTA / outro lines
        </summary>
        <p className="text-xs text-muted-foreground mt-2 mb-3">
          Leave blank to let AI write them. Intro and outro are instructed to sound like different beats (hook forward vs. sign-off). If you paste your own lines, use different wording for each. For 3 scenes, the last scene merges CTA then outro in one caption — keep those two parts distinct.
        </p>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="stickman-intro-script" className="text-xs">
              Intro (scene 1)
            </Label>
            <Textarea
              id="stickman-intro-script"
              rows={2}
              placeholder="e.g. In the next 60 seconds, here is why faceless brands win on short-form…"
              value={introScript}
              onChange={(e) => setIntroScript(e.target.value)}
              className="text-sm resize-y min-h-[60px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="stickman-cta-script" className="text-xs">
              CTA line {sceneCount >= 4 ? `(scene ${sceneCount - 1})` : sceneCount === 3 ? "(last scene, with outro if set)" : "(merged into final scene if 2 scenes)"}
            </Label>
            <Textarea
              id="stickman-cta-script"
              rows={2}
              placeholder="e.g. Follow for more faceless-brand tips — link in bio for the playbook."
              value={ctaScript}
              onChange={(e) => setCtaScript(e.target.value)}
              className="text-sm resize-y min-h-[60px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="stickman-outro-script" className="text-xs">
              Outro (last scene{sceneCount === 3 ? "; merged with CTA if both set" : ""})
            </Label>
            <Textarea
              id="stickman-outro-script"
              rows={2}
              placeholder="e.g. Thanks for watching — see you in the next one."
              value={outroScript}
              onChange={(e) => setOutroScript(e.target.value)}
              className="text-sm resize-y min-h-[60px]"
            />
          </div>
        </div>
      </details>
    </>
  );
}
