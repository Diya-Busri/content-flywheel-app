"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SATISFYING_BUILD_CHARACTER_TYPES,
  SATISFYING_BUILD_IMAGE_STYLE_OPTIONS,
  SATISFYING_BUILD_STYLE_OPTIONS,
  SATISFYING_BUILD_TONE_OPTIONS,
  OPENING_HOOK_STYLE_PRESETS,
} from "@/app/dashboard/template-studio/template-studio-shared";
import { CreatableSelectField } from "@/components/templates/CreatableSelectField";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SatisfyingBuildSetupProps = {
  characterType: string;
  setCharacterType: (v: string) => void;
  whatBuilding: string;
  setWhatBuilding: (v: string) => void;
  buildStyle: string;
  setBuildStyle: (v: string) => void;
  tone: string;
  setTone: (v: string) => void;
  openingHook: string;
  setOpeningHook: (v: string) => void;
  imageStyle: string;
  setImageStyle: (v: string) => void;
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
  openingHook,
  setOpeningHook,
  imageStyle,
  setImageStyle,
}: SatisfyingBuildSetupProps) {
  return (
    <>
      <div className="space-y-2">
        <CreatableSelectField
          label="Character type"
          value={characterType}
          onValueChange={setCharacterType}
          options={SATISFYING_BUILD_CHARACTER_TYPES}
          storageKey="template-studio/satisfying-build/character-type"
          addPlaceholder="Add custom character type"
        />
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
        <CreatableSelectField
          label="Build style"
          value={buildStyle}
          onValueChange={setBuildStyle}
          options={SATISFYING_BUILD_STYLE_OPTIONS}
          storageKey="template-studio/satisfying-build/build-style"
          addPlaceholder="Add custom build style"
        />
        {buildStyle === "Transformation" && (
          <p className="text-xs text-muted-foreground">
            Scenes will follow a Before → During → After arc showing the full transformation.
          </p>
        )}
      </div>
      <div className="space-y-2">
        <CreatableSelectField
          label="Image style"
          value={imageStyle}
          onValueChange={setImageStyle}
          options={SATISFYING_BUILD_IMAGE_STYLE_OPTIONS}
          storageKey="template-studio/satisfying-build/image-style"
          addPlaceholder="Add custom image style"
        />
        {imageStyle === "Realistic Photography" && (
          <p className="text-xs text-muted-foreground">
            Images will use realistic photography — natural lighting, real textures, no cartoons or miniatures.
          </p>
        )}
      </div>
      <div className="space-y-2">
        <CreatableSelectField
          label="Tone"
          value={tone}
          onValueChange={setTone}
          options={SATISFYING_BUILD_TONE_OPTIONS}
          storageKey="template-studio/satisfying-build/tone"
          addPlaceholder="Add custom tone"
        />
      </div>
      <div className="space-y-2">
        <Label>Hook style presets</Label>
        <Select onValueChange={setOpeningHook}>
          <SelectTrigger>
            <SelectValue placeholder="Pick a hook style to autofill" />
          </SelectTrigger>
          <SelectContent>
            {OPENING_HOOK_STYLE_PRESETS.map((opt) => (
              <SelectItem key={opt.label} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="satisfying-opening-hook">Opening hook (optional)</Label>
        <Input
          id="satisfying-opening-hook"
          placeholder='e.g. "This tiny mansion starts with one impossible block..."'
          value={openingHook}
          onChange={(e) => setOpeningHook(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          If provided, scene 1 starts with this hook.
        </p>
      </div>
    </>
  );
}
