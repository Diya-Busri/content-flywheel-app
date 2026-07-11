"use client";

/**
 * Admin → Motion Graphics Studio → Templates (default tab)
 *
 * Lists saved templates (TikTok, Instagram Reel, YouTube Shorts, Product
 * Demo, Feature Showcase, Tutorial, Promo Video, Landing Page Video,
 * custom) and lets the admin create a new blank one or open an existing one
 * in the Template Builder.
 */

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Clapperboard } from "lucide-react";
import type { Template, TemplateCategory } from "@/lib/motion-graphics/types";

const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  tiktok: "TikTok",
  instagram_reel: "Instagram Reel",
  youtube_shorts: "YouTube Shorts",
  product_demo: "Product Demo",
  feature_showcase: "Feature Showcase",
  tutorial: "Tutorial",
  promo_video: "Promo Video",
  landing_page_video: "Landing Page Video",
  custom: "Custom",
};

export const TemplatesList: React.FC = () => {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch("/api/admin/motion-graphics/templates")
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates || []))
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/admin/motion-graphics/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Untitled Template",
          category: "custom",
          aspectRatio: "9:16",
          fps: 30,
          scenes: [],
          status: "draft",
        }),
      });
      const data = await res.json();
      router.push(`/dashboard/admin/motion-graphics-studio/templates/${data.template.id}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Delete this template? This cannot be undone.")) return;
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/admin/motion-graphics/templates/${id}`, { method: "DELETE" });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={handleCreate} disabled={creating}>
          <Plus size={14} className="mr-1.5" />
          New template
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading templates…</p>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <Clapperboard className="mx-auto mb-3 text-muted-foreground" size={32} />
            <p className="text-sm text-muted-foreground">
              No templates yet. Create one from scratch, or paste a script in the AI Script to Video tab.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {templates.map((t) => (
            <Card
              key={t.id}
              className="cursor-pointer hover:shadow-md transition-shadow group relative"
              onClick={() => router.push(`/dashboard/admin/motion-graphics-studio/templates/${t.id}`)}
            >
              <div
                className="flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-700 text-white/60"
                style={{ aspectRatio: t.aspectRatio === "9:16" ? "9/16" : t.aspectRatio === "1:1" ? "1/1" : "16/9" }}
              >
                <Clapperboard size={28} />
              </div>
              <CardContent className="p-3 space-y-1.5">
                <p className="text-sm font-semibold truncate">{t.name}</p>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="text-[10px]">
                    {CATEGORY_LABELS[t.category]}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {t.aspectRatio}
                  </Badge>
                  <Badge variant={t.status === "ready" ? "default" : "outline"} className="text-[10px]">
                    {t.status}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">{t.scenes.length} scene{t.scenes.length === 1 ? "" : "s"}</p>
              </CardContent>
              <button
                onClick={(e) => handleDelete(e, t.id)}
                className="absolute top-1.5 right-1.5 p-1.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Delete template"
              >
                <Trash2 size={13} />
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
