"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import {
  AI_COOKING_VIDEO_CHEF_TYPES,
  AI_COOKING_VIDEO_SCENE_COUNT_SELECT,
  type AiCookingVideoSceneCountChoice,
  AI_COOKING_VIDEO_STYLE_OPTIONS,
  AI_COOKING_VIDEO_TONE_OPTIONS,
} from "@/app/dashboard/template-studio/template-studio-shared";
import { CreatableSelectField } from "@/components/templates/CreatableSelectField";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type AiCookingVideoSetupProps = {
  chefType: string;
  setChefType: (v: string) => void;
  dishName: string;
  setDishName: (v: string) => void;
  cookingStyle: string;
  setCookingStyle: (v: string) => void;
  tone: string;
  setTone: (v: string) => void;
  episodeNumber: number;
  setEpisodeNumber: (v: number) => void;
  openingHook: string;
  setOpeningHook: (v: string) => void;
  sceneCount: AiCookingVideoSceneCountChoice;
  setSceneCount: (v: AiCookingVideoSceneCountChoice) => void;
};

export function AiCookingVideoSetup({
  chefType,
  setChefType,
  dishName,
  setDishName,
  cookingStyle,
  setCookingStyle,
  tone,
  setTone,
  episodeNumber,
  setEpisodeNumber,
  openingHook,
  setOpeningHook,
  sceneCount,
  setSceneCount,
}: AiCookingVideoSetupProps) {
  const { toast } = useToast();
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [styleFromAi, setStyleFromAi] = useState<{ value: string; label: string }[]>([]);
  const [toneFromAi, setToneFromAi] = useState<{ value: string; label: string }[]>([]);
  const [hooksLoading, setHooksLoading] = useState(false);
  const [freshHookLines, setFreshHookLines] = useState<string[]>([]);

  const handleFreshIdeas = async () => {
    setSuggestLoading(true);
    try {
      const res = await fetch("/api/content-studio/ai-cooking-video/suggest-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dish_name: dishName.trim(),
          chef_type: chefType.trim() || "Home Cook",
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        cooking_style?: string;
        tone?: string;
        opening_hook?: string;
      };
      if (!res.ok) {
        throw new Error(data?.error ?? "Request failed");
      }
      const cs = data.cooking_style?.trim();
      const tn = data.tone?.trim();
      const hook = data.opening_hook?.trim();
      if (!cs || !tn || !hook) {
        throw new Error("Incomplete suggestion. Try again.");
      }
      setStyleFromAi([{ value: cs, label: cs }]);
      setToneFromAi([{ value: tn, label: tn }]);
      setCookingStyle(cs);
      setTone(tn);
      setOpeningHook(hook);
      toast({
        title: "Fresh setup applied",
        description: "New cooking style, tone, and opening hook—generate when you’re ready.",
      });
    } catch (e) {
      toast({
        title: "Could not suggest fresh ideas",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setSuggestLoading(false);
    }
  };

  const handleFreshHooks = async () => {
    setHooksLoading(true);
    try {
      const res = await fetch("/api/content-studio/ai-cooking-video/suggest-hooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dish_name: dishName.trim(),
          chef_type: chefType.trim() || "Home Cook",
          cooking_style: cookingStyle.trim() || undefined,
          tone: tone.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { error?: string; hooks?: string[] };
      if (!res.ok) {
        throw new Error(data?.error ?? "Request failed");
      }
      const hooks = Array.isArray(data.hooks) ? data.hooks : [];
      if (hooks.length === 0) {
        throw new Error("No hooks returned. Try again.");
      }
      setFreshHookLines(hooks);
      toast({
        title: "New hook lines ready",
        description: "Tap a line to drop it into your opening hook.",
      });
    } catch (e) {
      toast({
        title: "Could not generate hooks",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setHooksLoading(false);
    }
  };

  return (
    <>
      <div className="space-y-2">
        <CreatableSelectField
          label="Chef type"
          value={chefType}
          onValueChange={setChefType}
          options={AI_COOKING_VIDEO_CHEF_TYPES}
          storageKey="template-studio/ai-cooking/chef-type"
          addPlaceholder="Add custom chef type"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="dish-name">What are you cooking?</Label>
        <Input
          id="dish-name"
          placeholder="e.g. spicy ramen, garlic butter steak, viral cloud eggs"
          value={dishName}
          onChange={(e) => setDishName(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2 rounded-lg border border-dashed bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Skip the same presets—generate a{" "}
          <span className="font-medium text-foreground">new</span> cooking style, tone, and opening hook tailored to this dish.
        </p>
        <Button
          type="button"
          variant="secondary"
          className="shrink-0"
          disabled={suggestLoading}
          onClick={handleFreshIdeas}
        >
          {suggestLoading ? "Thinking…" : "Fresh ideas for this dish"}
        </Button>
      </div>
      <div className="space-y-2">
        <CreatableSelectField
          label="Cooking style"
          value={cookingStyle}
          onValueChange={setCookingStyle}
          options={AI_COOKING_VIDEO_STYLE_OPTIONS}
          extraOptions={styleFromAi}
          storageKey="template-studio/ai-cooking/style"
          addPlaceholder="Add custom cooking style"
        />
      </div>
      <div className="space-y-2">
        <CreatableSelectField
          label="Tone"
          value={tone}
          onValueChange={setTone}
          options={AI_COOKING_VIDEO_TONE_OPTIONS}
          extraOptions={toneFromAi}
          storageKey="template-studio/ai-cooking/tone"
          addPlaceholder="Add custom tone"
        />
      </div>
      <div className="space-y-2">
        <Label>Number of scenes (recipe steps)</Label>
        <Select
          value={sceneCount === "auto" ? "auto" : String(sceneCount)}
          onValueChange={(v) =>
            setSceneCount(v === "auto" ? "auto" : ((Number(v) || 12) as Exclude<AiCookingVideoSceneCountChoice, "auto">))
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AI_COOKING_VIDEO_SCENE_COUNT_SELECT.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Auto picks 8–16 scenes from how complex the dish is. Fixed counts lock length to exactly that many steps. Export works once every scene has image, animation, and voiceover.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="cooking-episode-number">Episode number</Label>
        <Input
          id="cooking-episode-number"
          type="number"
          min={1}
          value={episodeNumber}
          onChange={(e) => setEpisodeNumber(Number(e.target.value) || 1)}
        />
      </div>
      <div className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <Label htmlFor="cooking-opening-hook" className="sm:mb-2">
            Opening hook (optional)
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            disabled={hooksLoading}
            onClick={handleFreshHooks}
          >
            {hooksLoading ? "Writing lines…" : "Fresh hook lines"}
          </Button>
        </div>
        <Input
          id="cooking-opening-hook"
          placeholder='Type your own or tap a generated line below — e.g. "Twenty seconds, one pan, zero regrets."'
          value={openingHook}
          onChange={(e) => setOpeningHook(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          AI writes new first-spoken lines from your dish, chef, style, and tone (not recycled templates). Scene 1
          starts with this when set.
        </p>
        {freshHookLines.length > 0 && (
          <div className="flex flex-col gap-2 pt-1">
            <span className="text-xs font-medium text-muted-foreground">Pick one</span>
            <div className="flex flex-wrap gap-2">
              {freshHookLines.map((line, i) => (
                <Button
                  key={`${i}-${line.slice(0, 48)}`}
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-auto max-w-full whitespace-normal py-2 text-left font-normal leading-snug"
                  onClick={() => setOpeningHook(line)}
                >
                  {line}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
