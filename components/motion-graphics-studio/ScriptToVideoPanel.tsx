"use client";

/**
 * Admin → Motion Graphics Studio → AI Script to Video
 *
 * Paste a script → POST /api/admin/motion-graphics/ai/generate (splits into
 * scenes, picks animations/transitions, drafts captions via OpenAI) → opens
 * the resulting draft Template directly in the Template Builder.
 */

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2 } from "lucide-react";
import type { AspectRatio, TemplateCategory } from "@/lib/motion-graphics/types";

const CATEGORY_OPTIONS: { id: TemplateCategory; label: string }[] = [
  { id: "tiktok", label: "TikTok" },
  { id: "instagram_reel", label: "Instagram Reel" },
  { id: "youtube_shorts", label: "YouTube Shorts" },
  { id: "product_demo", label: "Product Demo" },
  { id: "feature_showcase", label: "Feature Showcase" },
  { id: "tutorial", label: "Tutorial" },
  { id: "promo_video", label: "Promo Video" },
  { id: "landing_page_video", label: "Landing Page Video" },
];

export const ScriptToVideoPanel: React.FC = () => {
  const router = useRouter();
  const [script, setScript] = useState("");
  const [category, setCategory] = useState<TemplateCategory>("tiktok");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("9:16");
  const [tone, setTone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!script.trim()) {
      setError("Paste a script first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/motion-graphics/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script, category, aspectRatio, tone: tone || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      router.push(`/dashboard/admin/motion-graphics-studio/templates/${data.template.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <Card>
        <CardContent className="p-5 space-y-4">
          <div>
            <Label htmlFor="mgs-script">Paste your script</Label>
            <Textarea
              id="mgs-script"
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder="Paste the full voiceover script here. The AI will split it into scenes, choose animations and transitions, position on-screen text, and draft captions."
              className="mt-1.5 min-h-[220px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Template category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as TemplateCategory)}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Aspect ratio</Label>
              <Select value={aspectRatio} onValueChange={(v) => setAspectRatio(v as AspectRatio)}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="9:16">9:16 — Vertical</SelectItem>
                  <SelectItem value="16:9">16:9 — Landscape</SelectItem>
                  <SelectItem value="1:1">1:1 — Square</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="mgs-tone">Tone (optional)</Label>
            <Input
              id="mgs-tone"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              placeholder="e.g. energetic, calm product demo, playful"
              className="mt-1.5"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button onClick={handleGenerate} disabled={loading} className="w-full">
            {loading ? <Loader2 size={16} className="animate-spin mr-2" /> : <Sparkles size={16} className="mr-2" />}
            {loading ? "Generating scenes…" : "Generate video from script"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
