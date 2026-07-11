"use client";

/**
 * Admin → Motion Graphics Studio → Template Builder
 *
 * ADMIN ONLY — see access-control note in
 * app/dashboard/admin/motion-graphics-studio/page.tsx (this route inherits
 * the same app/dashboard/admin/layout.tsx guard + sidebar-only nav + every
 * /api/admin/motion-graphics/* route re-checking lib/motion-graphics/guard.ts).
 *
 * Three-column workspace:
 *   left   — SceneList (drag-and-drop scene reordering)
 *   center — PreviewPlayer (live Remotion preview) + ExportPanel
 *   right  — SceneEditorPanel (scene + element properties)
 *
 * Autosaves the whole template (debounced) to
 * PATCH /api/admin/motion-graphics/templates/:id whenever scenes/name/etc.
 * change, plus a manual "Save now" button for an immediate, explicit save.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, Loader2, Save } from "lucide-react";
import { SceneList } from "@/components/motion-graphics-studio/SceneList";
import { SceneEditorPanel } from "@/components/motion-graphics-studio/SceneEditorPanel";
import { PreviewPlayer } from "@/components/motion-graphics-studio/PreviewPlayer";
import { ExportPanel } from "@/components/motion-graphics-studio/ExportPanel";
import type { AspectRatio, Scene, Template, TemplateCategory } from "@/lib/motion-graphics/types";

const CATEGORY_OPTIONS: { id: TemplateCategory; label: string }[] = [
  { id: "tiktok", label: "TikTok" },
  { id: "instagram_reel", label: "Instagram Reel" },
  { id: "youtube_shorts", label: "YouTube Shorts" },
  { id: "product_demo", label: "Product Demo" },
  { id: "feature_showcase", label: "Feature Showcase" },
  { id: "tutorial", label: "Tutorial" },
  { id: "promo_video", label: "Promo Video" },
  { id: "landing_page_video", label: "Landing Page Video" },
  { id: "custom", label: "Custom" },
];

function blankScene(order: number): Scene {
  const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `id_${Date.now()}_${Math.random()}`);
  return {
    id: uid(),
    order,
    name: `Scene ${order + 1}`,
    durationInFrames: 90,
    background: { type: "gradient", value: "linear-gradient(160deg, #0f0c29 0%, #302b63 55%, #24243e 100%)" },
    cameraMovement: "none",
    transitionIn: "fadeIn",
    transitionInDuration: 15,
    transitionOut: "fadeIn",
    transitionOutDuration: 12,
    captions: { enabled: true, style: "wordByWord" },
    elements: [],
  };
}

export default function TemplateBuilderPage({ params }: { params: { templateId: string } }) {
  const { templateId } = params;
  const [template, setTemplate] = useState<Template | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch(`/api/admin/motion-graphics/templates/${templateId}`)
      .then((r) => r.json())
      .then((d) => {
        setTemplate(d.template);
        if (d.template?.scenes?.length) setSelectedSceneId(d.template.scenes[0].id);
      });
  }, [templateId]);

  const persist = useCallback(
    async (next: Template) => {
      setSaveState("saving");
      try {
        const res = await fetch(`/api/admin/motion-graphics/templates/${templateId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: next.name,
            category: next.category,
            aspectRatio: next.aspectRatio,
            fps: next.fps,
            scenes: next.scenes,
            status: next.scenes.length > 0 ? "ready" : "draft",
          }),
        });
        if (!res.ok) throw new Error("save failed");
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    },
    [templateId]
  );

  const scheduleSave = useCallback(
    (next: Template) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => persist(next), 1200);
    },
    [persist]
  );

  const applyChange = (patch: Partial<Template>) => {
    setTemplate((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      scheduleSave(next);
      return next;
    });
  };

  if (!template) {
    return (
      <div className="p-10 flex items-center justify-center text-muted-foreground">
        <Loader2 className="animate-spin mr-2" size={18} />
        Loading template…
      </div>
    );
  }

  const selectedScene = template.scenes.find((s) => s.id === selectedSceneId) || null;

  const updateScenes = (scenes: Scene[]) => applyChange({ scenes });

  const handleAddScene = () => {
    const scene = blankScene(template.scenes.length);
    updateScenes([...template.scenes, scene]);
    setSelectedSceneId(scene.id);
  };

  const handleDuplicateScene = (id: string) => {
    const idx = template.scenes.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `id_${Date.now()}_${Math.random()}`);
    const copy: Scene = { ...template.scenes[idx], id: uid(), name: `${template.scenes[idx].name} copy` };
    const scenes = [...template.scenes];
    scenes.splice(idx + 1, 0, copy);
    updateScenes(scenes.map((s, i) => ({ ...s, order: i })));
    setSelectedSceneId(copy.id);
  };

  const handleDeleteScene = (id: string) => {
    const scenes = template.scenes.filter((s) => s.id !== id).map((s, i) => ({ ...s, order: i }));
    updateScenes(scenes);
    if (selectedSceneId === id) setSelectedSceneId(scenes[0]?.id || null);
  };

  const handleSceneChange = (updated: Scene) => {
    updateScenes(template.scenes.map((s) => (s.id === updated.id ? updated : s)));
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-5 py-3 flex items-center gap-4 flex-wrap">
        <Link href="/dashboard/admin/motion-graphics-studio" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={18} />
        </Link>
        <Input
          value={template.name}
          onChange={(e) => applyChange({ name: e.target.value })}
          className="max-w-[240px] font-semibold"
        />
        <Select value={template.category} onValueChange={(v) => applyChange({ category: v as TemplateCategory })}>
          <SelectTrigger className="w-44">
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
        <Select value={template.aspectRatio} onValueChange={(v) => applyChange({ aspectRatio: v as AspectRatio })}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="9:16">9:16 Vertical</SelectItem>
            <SelectItem value="16:9">16:9 Landscape</SelectItem>
            <SelectItem value="1:1">1:1 Square</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          {saveState === "saving" && (
            <span className="flex items-center gap-1">
              <Loader2 size={12} className="animate-spin" /> Saving…
            </span>
          )}
          {saveState === "saved" && (
            <span className="flex items-center gap-1 text-emerald-600">
              <Check size={12} /> Saved
            </span>
          )}
          {saveState === "error" && <span className="text-destructive">Save failed</span>}
          <Button size="sm" variant="outline" onClick={() => persist(template)}>
            <Save size={13} className="mr-1.5" />
            Save now
          </Button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[260px_1fr_360px] gap-0 overflow-hidden">
        <div className="border-r p-4 overflow-y-auto">
          <SceneList
            scenes={template.scenes}
            selectedSceneId={selectedSceneId}
            onSelect={setSelectedSceneId}
            onReorder={updateScenes}
            onAdd={handleAddScene}
            onDuplicate={handleDuplicateScene}
            onDelete={handleDeleteScene}
          />
        </div>

        <div className="p-6 overflow-y-auto flex flex-col items-center gap-6">
          <PreviewPlayer inputProps={{ templateName: template.name, aspectRatio: template.aspectRatio, scenes: template.scenes }} fps={template.fps} />
          <div className="w-full max-w-md">
            <ExportPanel templateId={template.id} sceneCount={template.scenes.length} />
          </div>
        </div>

        <div className="border-l p-4 overflow-y-auto">
          <SceneEditorPanel scene={selectedScene} fps={template.fps} onChange={handleSceneChange} />
        </div>
      </div>
    </div>
  );
}
