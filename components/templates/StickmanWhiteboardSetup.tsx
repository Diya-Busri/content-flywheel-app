"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  topic: string;
  setTopic: (v: string) => void;
  sceneCount: number;
  setSceneCount: (v: number) => void;
  voiceId: string;
  setVoiceId: (v: string) => void;
}

export const STICKMAN_SCENE_COUNT_OPTIONS = [4, 5, 6, 7, 8] as const;

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
  voiceId,
  setVoiceId,
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
          AI will split this into scenes with captions and matching stickman poses.
        </p>
      </div>

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
    </>
  );
}
