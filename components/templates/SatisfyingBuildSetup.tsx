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
import {
  SATISFYING_BUILD_CHARACTER_TYPES,
  SATISFYING_BUILD_STYLE_OPTIONS,
  SATISFYING_BUILD_TONE_OPTIONS,
} from "@/app/dashboard/template-studio/template-studio-shared";

export type SatisfyingBuildSetupProps = {
  characterType: string;
  setCharacterType: (v: string) => void;
  whatBuilding: string;
  setWhatBuilding: (v: string) => void;
  buildStyle: string;
  setBuildStyle: (v: string) => void;
  tone: string;
  setTone: (v: string) => void;
  episodeNumber: number;
  setEpisodeNumber: (v: number) => void;
};

export function SatisfyingBuildSetup({
  characterType,
  setCharacterType,
  whatBuilding,
  setWhatBuilding,
  buildStyle,
  setBuildStyle,
  tone,
  setTone,
  episodeNumber,
  setEpisodeNumber,
}: SatisfyingBuildSetupProps) {
  return (
    <>
      <div className="space-y-2">
        <Label>Character type</Label>
        <Select value={characterType} onValueChange={setCharacterType}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SATISFYING_BUILD_CHARACTER_TYPES.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="what-building">What are you building?</Label>
        <Input
          id="what-building"
          placeholder="e.g. A tiny log cabin, a marble run, a glass skyscraper"
          value={whatBuilding}
          onChange={(e) => setWhatBuilding(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Build style</Label>
        <Select value={buildStyle} onValueChange={setBuildStyle}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SATISFYING_BUILD_STYLE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Tone</Label>
        <Select value={tone} onValueChange={setTone}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SATISFYING_BUILD_TONE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="satisfying-episode-number">Episode number</Label>
        <Input
          id="satisfying-episode-number"
          type="number"
          min={1}
          value={episodeNumber}
          onChange={(e) => setEpisodeNumber(Number(e.target.value) || 1)}
        />
      </div>
    </>
  );
}
