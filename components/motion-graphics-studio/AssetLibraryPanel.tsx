"use client";

/**
 * Admin → Motion Graphics Studio → Asset Library
 *
 * Upload/list/delete images, videos, logos, audio, background music, and
 * sound effects. Uploads go to Cloudflare R2 via
 * app/api/admin/motion-graphics/assets/route.ts (lib/storage.ts) — the
 * resulting public URL is what gets referenced from Scene elements /
 * voiceover / sound fields.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Music, Image as ImageIcon, Video as VideoIcon, Sparkles, Volume2, Trash2, Upload, Loader2 } from "lucide-react";
import type { AssetKind, MotionGraphicsAsset } from "@/lib/motion-graphics/types";

const KIND_TABS: { id: AssetKind | "all"; label: string; icon: React.ReactNode }[] = [
  { id: "all", label: "All", icon: <Sparkles size={14} /> },
  { id: "image", label: "Images", icon: <ImageIcon size={14} /> },
  { id: "video", label: "Video", icon: <VideoIcon size={14} /> },
  { id: "logo", label: "Logos", icon: <ImageIcon size={14} /> },
  { id: "audio", label: "Voiceover", icon: <Volume2 size={14} /> },
  { id: "music", label: "Music", icon: <Music size={14} /> },
  { id: "sfx", label: "SFX", icon: <Volume2 size={14} /> },
];

export const AssetLibraryPanel: React.FC = () => {
  const [assets, setAssets] = useState<MotionGraphicsAsset[]>([]);
  const [activeTab, setActiveTab] = useState<AssetKind | "all">("all");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadKind, setUploadKind] = useState<AssetKind>("image");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/motion-graphics/assets");
      const data = await res.json();
      setAssets(data.assets || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleUploadClick = (kind: AssetKind) => {
    setUploadKind(kind);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("kind", uploadKind);
      const res = await fetch("/api/admin/motion-graphics/assets", { method: "POST", body: formData });
      if (!res.ok) throw new Error((await res.json()).error || "Upload failed");
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (assetId: string) => {
    setAssets((prev) => prev.filter((a) => a.id !== assetId));
    await fetch(`/api/admin/motion-graphics/assets/${assetId}`, { method: "DELETE" });
  };

  const filtered = activeTab === "all" ? assets : assets.filter((a) => a.kind === activeTab);

  return (
    <div className="space-y-4">
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AssetKind | "all")}>
          <TabsList>
            {KIND_TABS.map((t) => (
              <TabsTrigger key={t.id} value={t.id} className="gap-1.5">
                {t.icon}
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={uploading} onClick={() => handleUploadClick(activeTab === "all" ? "image" : (activeTab as AssetKind))}>
            {uploading ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Upload size={14} className="mr-1.5" />}
            Upload {activeTab === "all" ? "asset" : KIND_TABS.find((t) => t.id === activeTab)?.label}
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading assets…</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No assets yet. Upload images, video, logos, voiceover, music, or SFX to use in your scenes.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filtered.map((asset) => (
            <Card key={asset.id} className="overflow-hidden group relative">
              <div className="aspect-square bg-black/5 dark:bg-white/5 flex items-center justify-center">
                {asset.kind === "image" || asset.kind === "logo" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={asset.url} alt={asset.name} className="w-full h-full object-cover" />
                ) : asset.kind === "video" ? (
                  <video src={asset.url} className="w-full h-full object-cover" muted />
                ) : (
                  <Music size={28} className="text-muted-foreground" />
                )}
              </div>
              <CardContent className="p-2">
                <p className="text-xs font-medium truncate">{asset.name}</p>
              </CardContent>
              <button
                onClick={() => handleDelete(asset.id)}
                className="absolute top-1.5 right-1.5 p-1.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Delete asset"
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
