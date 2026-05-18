"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Palette, Trash2, MoreHorizontal, Clock, Copy, Zap, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SelectDesign, DesignData } from "@/db/schema/designs-schema";
import { SelectBundle } from "@/db/schema/bundles-schema";

type Preset = {
  label: string;
  description: string;
  emoji: string;
  width: number;
  height: number;
  background: string;
};

const PRESETS: Preset[] = [
  { label: "Poster", description: "A4 Portrait · 794 × 1123", emoji: "🖼️", width: 794, height: 1123, background: "#ffffff" },
  { label: "Invitation", description: "5×7\" · 480 × 672", emoji: "💌", width: 480, height: 672, background: "#fdf8f0" },
  { label: "Social Post", description: "Square · 800 × 800", emoji: "📱", width: 800, height: 800, background: "#ffffff" },
  { label: "Story", description: "9:16 · 450 × 800", emoji: "📲", width: 450, height: 800, background: "#000000" },
  { label: "Banner", description: "16:9 · 800 × 450", emoji: "📺", width: 800, height: 450, background: "#ffffff" },
  { label: "Business Card", description: "3.5×2\" · 336 × 192", emoji: "💼", width: 336, height: 192, background: "#1a1a1a" },
  { label: "Flyer", description: "A5 · 559 × 794", emoji: "📄", width: 559, height: 794, background: "#ffffff" },
  { label: "Square Print", description: "8×8\" · 768 × 768", emoji: "🎨", width: 768, height: 768, background: "#ffffff" },
];

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function DesignCard({
  design,
  onDelete,
  onDuplicate,
}: {
  design: SelectDesign;
  onDelete: (id: string) => void;
  onDuplicate: (design: SelectDesign) => void;
}) {
  const router = useRouter();
  const data = design.data as DesignData;
  const aspect = data.width / data.height;
  const previewH = Math.round(140 / aspect);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="group relative rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1A1A1A] overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => router.push(`/dashboard/design-studio/${design.id}`)}
    >
      {/* Preview */}
      <div
        className="w-full flex items-center justify-center overflow-hidden bg-gray-100 dark:bg-[#111]"
        style={{ height: Math.min(previewH, 200) }}
      >
        {design.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={design.previewUrl} alt={design.title} className="w-full h-full object-cover" />
        ) : (
          <div
            className="flex items-center justify-center text-gray-300 dark:text-gray-600 text-xs font-medium"
            style={{ width: "100%", height: "100%", background: data.background ?? "#fff" }}
          >
            {data.presetName ?? "Design"}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate text-gray-900 dark:text-white">{design.title}</p>
          <p className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
            <Clock className="w-3 h-3" /> {timeAgo(design.updatedAt.toString())}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 shrink-0">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={(e) => { e.stopPropagation(); onDuplicate(design); }}
            >
              <Copy className="w-4 h-4 mr-2" /> Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-red-500"
              onClick={(e) => { e.stopPropagation(); onDelete(design.id); }}
            >
              <Trash2 className="w-4 h-4 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.div>
  );
}

const STYLE_LABELS: Record<string, string> = {
  "minimal-luxury": "Minimal Luxury",
  "dark-aesthetic": "Dark Aesthetic",
  "wellness": "Wellness",
  "clean-productivity": "Clean Productivity",
  "faceless-creator": "Faceless Creator",
  "modern-business": "Modern Business",
};

function BundleCard({ bundle, onDelete }: { bundle: SelectBundle; onDelete: (id: string) => void }) {
  const router = useRouter();
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="group relative rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1A1A1A] overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => router.push(`/dashboard/design-studio/bundle/${bundle.id}`)}
    >
      {/* Cover preview */}
      <div className="w-full h-36 flex items-center justify-center overflow-hidden bg-gradient-to-br from-orange-500/20 to-purple-500/20 dark:from-orange-500/10 dark:to-purple-500/10">
        {bundle.coverPreviewUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={bundle.coverPreviewUrl} alt={bundle.title} className="w-full h-full object-cover" />
          : (
            <div className="flex flex-col items-center gap-2 text-orange-400">
              <Layers className="w-8 h-8" />
              <span className="text-xs font-medium">{bundle.slideCount} slides</span>
            </div>
          )}
      </div>

      {/* Info */}
      <div className="p-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate text-gray-900 dark:text-white">{bundle.title}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {bundle.slideCount} slide{bundle.slideCount !== 1 ? "s" : ""} · {STYLE_LABELS[bundle.style] ?? bundle.style} · {timeAgo(bundle.updatedAt.toString())}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 shrink-0">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="text-red-500"
              onClick={(e) => { e.stopPropagation(); onDelete(bundle.id); }}
            >
              <Trash2 className="w-4 h-4 mr-2" /> Delete Bundle
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.div>
  );
}

export function DesignStudioLanding() {
  const router = useRouter();
  const [designs, setDesigns] = useState<SelectDesign[]>([]);
  const [bundles, setBundles] = useState<SelectBundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/designs").then((r) => r.json()),
      fetch("/api/design-bundles").then((r) => r.json()),
    ]).then(([designsData, bundlesData]) => {
      setDesigns(designsData.designs ?? []);
      setBundles(bundlesData.bundles ?? []);
    }).finally(() => setLoading(false));
  }, []);

  async function createDesign(preset: Preset) {
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${preset.label} — ${new Date().toLocaleDateString()}`,
          data: {
            width: preset.width,
            height: preset.height,
            background: preset.background,
            elements: [],
            presetName: preset.label,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.design?.id) {
        setCreateError(json.error ?? "Failed to create design. Please try again.");
        return;
      }
      router.push(`/dashboard/design-studio/${json.design.id}`);
    } catch {
      setCreateError("Network error — please try again.");
    } finally {
      setCreating(false);
    }
  }

  async function deleteDesign(id: string) {
    await fetch(`/api/designs/${id}`, { method: "DELETE" });
    setDesigns((prev) => prev.filter((d) => d.id !== id));
  }

  async function deleteBundle(id: string) {
    await fetch(`/api/design-bundles/${id}`, { method: "DELETE" });
    setBundles((prev) => prev.filter((b) => b.id !== id));
  }

  async function duplicateDesign(design: SelectDesign) {
    const res = await fetch("/api/designs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: `Copy of ${design.title}`, data: design.data }),
    });
    const json = await res.json();
    if (json.design) setDesigns((prev) => [json.design, ...prev]);
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Palette className="w-6 h-6 text-orange-500" /> Design Studio
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Create posters, invitations, social posts, and more
            </p>
          </div>
          <Button
            className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
            onClick={() => setShowNew(true)}
          >
            <Plus className="w-4 h-4" /> New Design
          </Button>
        </div>

        {/* Bulk Content Designer banner */}
        <div
          onClick={() => router.push("/dashboard/design-studio/bulk")}
          className="mb-8 rounded-2xl border border-orange-200 dark:border-orange-500/30 bg-gradient-to-r from-orange-50 to-purple-50 dark:from-orange-500/10 dark:to-purple-500/10 p-5 flex items-center gap-4 cursor-pointer hover:border-orange-400 dark:hover:border-orange-500/60 transition-colors group"
        >
          <div className="w-12 h-12 rounded-xl bg-orange-500 flex items-center justify-center shrink-0 group-hover:bg-orange-600 transition-colors">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
              Bulk Content Designer <span className="text-xs font-semibold bg-orange-500 text-white px-2 py-0.5 rounded-full">NEW</span>
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Generate 10–30 branded social posts from one topic · AI content + instant design
            </p>
          </div>
          <div className="shrink-0 text-orange-500 group-hover:translate-x-1 transition-transform">→</div>
        </div>

        {/* Bundles section */}
        {loading ? (
          <div className="mb-8">
            <div className="h-5 w-32 rounded bg-gray-200 dark:bg-[#2A2A2A] animate-pulse mb-4" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl bg-gray-100 dark:bg-[#1A1A1A] animate-pulse h-48" />
              ))}
            </div>
          </div>
        ) : bundles.length > 0 ? (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Layers className="w-4 h-4 text-orange-500" />
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Content Bundles</h2>
              <span className="text-xs text-gray-400 ml-1">{bundles.length} bundle{bundles.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              <AnimatePresence>
                {bundles.map((b) => (
                  <BundleCard key={b.id} bundle={b} onDelete={deleteBundle} />
                ))}
              </AnimatePresence>
            </div>
          </div>
        ) : null}

        {/* Single Designs grid */}
        {!loading && bundles.length > 0 && designs.length > 0 && (
          <div className="flex items-center gap-2 mb-4">
            <Palette className="w-4 h-4 text-orange-500" />
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Single Designs</h2>
            <span className="text-xs text-gray-400 ml-1">{designs.length} design{designs.length !== 1 ? "s" : ""}</span>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-gray-100 dark:bg-[#1A1A1A] animate-pulse h-48" />
            ))}
          </div>
        ) : designs.length === 0 && bundles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 rounded-2xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center mb-4">
              <Palette className="w-10 h-10 text-orange-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">No designs yet</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Create your first poster, invitation, or social post
            </p>
            <Button
              className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
              onClick={() => setShowNew(true)}
            >
              <Plus className="w-4 h-4" /> Create a Design
            </Button>
          </div>
        ) : designs.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            <AnimatePresence>
              {designs.map((d) => (
                <DesignCard key={d.id} design={d} onDelete={deleteDesign} onDuplicate={duplicateDesign} />
              ))}
            </AnimatePresence>
          </div>
        ) : null}
      </div>

      {/* New Design Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Choose a canvas size</DialogTitle>
          </DialogHeader>
          {createError && (
            <p className="mt-2 text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{createError}</p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                disabled={creating}
                onClick={() => createDesign(preset)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-gray-200 dark:border-white/10 hover:border-orange-400 dark:hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors text-left group disabled:opacity-50"
              >
                <span className="text-3xl">{preset.emoji}</span>
                <div className="text-center">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{preset.label}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{preset.description}</p>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
