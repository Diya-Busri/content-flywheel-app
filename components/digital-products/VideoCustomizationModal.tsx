"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, Loader2, Video } from "lucide-react";
import { VIDEO_GUIDE_PLATFORMS } from "@/lib/video-guide-platforms";

export type ScriptForDisplay = {
  id: string;
  title: string;
  length: number;
  hook: string;
  body: string;
  cta: string;
};

export type VideoCustomizationSettings = {
  hook: string;
  body: string;
  cta: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  script: ScriptForDisplay;
  scripts?: ScriptForDisplay[];
  onGenerate: (settings: VideoCustomizationSettings, scripts: ScriptForDisplay[], platforms?: string[]) => void;
  isGenerating?: boolean;
  /** When true, modal is for creating a Video Creation Guide (not generating videos) */
  createGuide?: boolean;
};

export function VideoCustomizationModal({ open, onClose, script, scripts, onGenerate, isGenerating, createGuide }: Props) {
  const [settings, setSettings] = useState<VideoCustomizationSettings>({
    hook: script.hook,
    body: script.body,
    cta: script.cta,
  });
  const [guidePlatforms, setGuidePlatforms] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(VIDEO_GUIDE_PLATFORMS.map((p) => [p.id, p.id === "tiktok" || p.id === "instagram_reels"]))
  );

  const scriptsToGenerate = scripts && scripts.length > 1 ? scripts : [script];
  const selectedGuidePlatforms = createGuide
    ? VIDEO_GUIDE_PLATFORMS.filter((p) => guidePlatforms[p.id]).map((p) => p.id)
    : undefined;

  useEffect(() => {
    if (open) {
      setSettings({
        hook: script.hook,
        body: script.body,
        cta: script.cta,
      });
    }
  }, [open, script.hook, script.body, script.cta]);

  const handleGenerate = () => {
    const scriptsWithEdits = scriptsToGenerate.map((s) =>
      s.id === script.id ? { ...s, hook: settings.hook, body: settings.body, cta: settings.cta } : s
    );
    onGenerate(settings, scriptsWithEdits, selectedGuidePlatforms?.length ? selectedGuidePlatforms : ["tiktok"]);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !isGenerating && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto max-w-2xl bg-[#0F0F0F] border-[#2A2A2A] text-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white">
            {createGuide ? "Customize Video Creation Guide" : "Customize Your Video"}
          </DialogTitle>
          <p className="text-sm text-[#A0A0A0] mt-1">
            {scriptsToGenerate.length > 1 && !createGuide
              ? `Edit script text for all ${scriptsToGenerate.length} videos.`
              : createGuide
                ? `Edit script for your guide: ${script.title}`
                : `Edit script for: ${script.title}`}
          </p>
          <p className="text-xs text-[#A0A0A0] mt-0.5">
            {createGuide
              ? "Multi-platform video marketing guide with AI prompts, posting schedules, and platform strategies."
              : "Step-by-step Video Creation Guide with AI prompts, editing tips, and scene breakdowns."}
          </p>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Platform selection (guide mode only) */}
          {createGuide && (
            <div>
              <Label className="text-white font-medium mb-3 block">Target platforms</Label>
              <p className="text-xs text-[#A0A0A0] mb-2">Select platforms. The guide will include platform-specific strategies for each.</p>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-2">
                {VIDEO_GUIDE_PLATFORMS.map((p) => (
                  <label
                    key={p.id}
                    className={`flex items-center gap-2 cursor-pointer rounded-lg border px-2 py-1.5 transition-colors ${
                      guidePlatforms[p.id] ? "border-orange-500 bg-orange-500/10" : "border-[#2A2A2A]"
                    }`}
                  >
                    <Checkbox checked={!!guidePlatforms[p.id]} onCheckedChange={() => setGuidePlatforms((prev) => ({ ...prev, [p.id]: !prev[p.id] }))} />
                    <span className="text-sm text-[#E0E0E0] truncate">{p.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Script Editing */}
          <div>
            <Label className="text-white font-medium mb-3 block">Edit Script</Label>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-[#A0A0A0]">Hook (opening)</label>
                <Input
                  value={settings.hook}
                  onChange={(e) => setSettings((p) => ({ ...p, hook: e.target.value }))}
                  placeholder="Opening line..."
                  className="bg-[#1A1A1A] border-[#2A2A2A] text-white placeholder:text-[#666] mt-1"
                  disabled={isGenerating}
                />
              </div>
              <div>
                <label className="text-xs text-[#A0A0A0]">Body (main content)</label>
                <Textarea
                  value={settings.body}
                  onChange={(e) => setSettings((p) => ({ ...p, body: e.target.value }))}
                  placeholder="Main content..."
                  rows={4}
                  className="bg-[#1A1A1A] border-[#2A2A2A] text-white placeholder:text-[#666] resize-none mt-1"
                  disabled={isGenerating}
                />
              </div>
              <div>
                <label className="text-xs text-[#A0A0A0]">CTA (call to action)</label>
                <Input
                  value={settings.cta}
                  onChange={(e) => setSettings((p) => ({ ...p, cta: e.target.value }))}
                  placeholder="Call to action..."
                  className="bg-[#1A1A1A] border-[#2A2A2A] text-white placeholder:text-[#666] mt-1"
                  disabled={isGenerating}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-[#2A2A2A]">
          <Button variant="outline" onClick={onClose} disabled={isGenerating} className="border-[#2A2A2A] text-[#A0A0A0]">
            Cancel
          </Button>
          <Button
            className="bg-orange-500 hover:bg-orange-600 gap-2"
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : createGuide ? <FileText className="w-4 h-4" /> : <Video className="w-4 h-4" />}
            {createGuide
              ? "Create Video Guide"
              : "Create Video Guide"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
