"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BookMarked,
  Copy,
  Check,
  Trash2,
  Plus,
  Loader2,
  Home,
  ChevronRight,
  X,
  Search,
  ChevronDown,
  ChevronUp,
  Hash,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import Link from "next/link";

type Caption = {
  id: string;
  title: string;
  caption: string;
  hashtags: string;
  platform: string;
  createdAt: string;
};

const PLATFORM_LABELS: Record<string, { label: string; color: string }> = {
  all:       { label: "All",       color: "bg-gray-100 dark:bg-[#2A2A2A] text-gray-500 dark:text-gray-400" },
  tiktok:    { label: "TikTok",    color: "bg-pink-100 dark:bg-pink-950/30 text-pink-600 dark:text-pink-400" },
  instagram: { label: "Instagram", color: "bg-purple-100 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400" },
  youtube:   { label: "YouTube",   color: "bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400" },
  twitter:   { label: "X",         color: "bg-gray-100 dark:bg-gray-800/60 text-gray-700 dark:text-gray-300" },
};

function CopyButton({ text, title = "Copy" }: { text: string; title?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#2A2A2A] transition-colors"
      title={title}
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

export default function CaptionLibraryClient() {
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const toggleExpand = (id: string) => setExpandedIds(prev => {
    const s = new Set(prev);
    s.has(id) ? s.delete(id) : s.add(id);
    return s;
  });

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formCaption, setFormCaption] = useState("");
  const [formHashtags, setFormHashtags] = useState("");
  const [formPlatform, setFormPlatform] = useState("all");

  const load = useCallback(async (platform: string) => {
    setLoading(true);
    try {
      const url = platform && platform !== "all"
        ? `/api/caption-library?platform=${platform}`
        : "/api/caption-library";
      const res = await fetch(url);
      const data = await res.json() as { captions: Caption[] };
      setCaptions(data.captions ?? []);
    } catch {
      toast({ title: "Error", description: "Failed to load captions", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(filter); }, [filter, load]);

  const saveCaption = useCallback(async () => {
    if (!formCaption.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/caption-library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle,
          caption: formCaption,
          hashtags: formHashtags,
          platform: formPlatform,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const newCaption = await res.json() as Caption;
      setCaptions((prev) => [newCaption, ...prev]);
      setShowForm(false);
      setFormTitle("");
      setFormCaption("");
      setFormHashtags("");
      setFormPlatform("all");
      toast({ title: "Caption saved ✓" });
    } catch {
      toast({ title: "Error", description: "Failed to save caption", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [formTitle, formCaption, formHashtags, formPlatform, toast]);

  const deleteCaption = useCallback(async (id: string) => {
    try {
      await fetch(`/api/caption-library?id=${id}`, { method: "DELETE" });
      setCaptions((prev) => prev.filter((c) => c.id !== id));
    } catch {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
    }
  }, [toast]);

  const tabs = ["all", "tiktok", "instagram", "youtube", "twitter"];

  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="max-w-3xl mx-auto">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-[#A0A0A0] mb-8">
          <Link href="/dashboard" className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-white transition-colors">
            <Home className="w-4 h-4" />
            Dashboard
          </Link>
          <ChevronRight className="w-4 h-4 text-gray-400 dark:text-[#666]" />
          <span className="text-gray-900 dark:text-white">Caption Library</span>
        </nav>

        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-3">
            <BookMarked className="w-7 h-7 text-orange-500" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Caption Library</h1>
          </div>
          <Button
            onClick={() => setShowForm((v) => !v)}
            className="bg-orange-500 hover:bg-orange-600 text-white gap-1.5"
            size="sm"
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? "Cancel" : "Add Caption"}
          </Button>
        </div>
        <p className="text-gray-500 dark:text-[#A0A0A0] mb-8">
          Save and reuse your best captions and hashtag sets.
        </p>

        {/* Add form */}
        {showForm && (
          <div className="mb-6 rounded-2xl border border-orange-200 dark:border-orange-900/40 bg-orange-50 dark:bg-orange-950/10 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">New Caption</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-500">Label <span className="text-gray-400">(optional)</span></Label>
                <Input
                  placeholder="e.g. Product launch teaser"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="bg-white dark:bg-[#111] border-gray-200 dark:border-[#2A2A2A]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-500">Platform</Label>
                <select
                  value={formPlatform}
                  onChange={(e) => setFormPlatform(e.target.value)}
                  className="w-full h-10 rounded-lg border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#111] text-gray-900 dark:text-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                >
                  <option value="all">All Platforms</option>
                  <option value="tiktok">TikTok</option>
                  <option value="instagram">Instagram</option>
                  <option value="youtube">YouTube</option>
                  <option value="twitter">X / Twitter</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-gray-500">Caption</Label>
                <span className={`text-[10px] font-medium ${formPlatform === "twitter" && formCaption.length > 240 ? "text-red-500" : "text-gray-400"}`}>
                  {formCaption.length}{formPlatform === "twitter" ? "/280" : " chars"}
                </span>
              </div>
              <Textarea
                placeholder="Write your caption here..."
                value={formCaption}
                onChange={(e) => setFormCaption(e.target.value)}
                className="bg-white dark:bg-[#111] border-gray-200 dark:border-[#2A2A2A] min-h-[80px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">Hashtags <span className="text-gray-400">(space-separated)</span></Label>
              <Input
                placeholder="#yourband #niche #tiktok"
                value={formHashtags}
                onChange={(e) => setFormHashtags(e.target.value)}
                className="bg-white dark:bg-[#111] border-gray-200 dark:border-[#2A2A2A]"
              />
            </div>
            <Button
              onClick={saveCaption}
              disabled={saving || !formCaption.trim()}
              className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
            >
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : "Save Caption"}
            </Button>
          </div>
        )}

        {/* Filter tabs + search */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="flex gap-1.5 flex-wrap">
            {tabs.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setFilter(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  filter === t
                    ? "bg-gray-900 dark:bg-white text-white dark:text-black border-gray-900 dark:border-white"
                    : "border-gray-200 dark:border-[#2A2A2A] text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500"
                }`}
              >
                {PLATFORM_LABELS[t]?.label ?? t}
              </button>
            ))}
          </div>
          <div className="relative ml-auto">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search captions…"
              className="h-8 pl-8 pr-3 text-xs rounded-lg border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#111] text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500/40 w-48"
            />
            {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X className="w-3 h-3" /></button>}
          </div>
        </div>

        {/* Caption cards */}
        {loading ? (
          <div className="flex items-center gap-2 text-gray-400 py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : captions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 dark:border-[#2A2A2A] p-10 text-center">
            <BookMarked className="w-8 h-8 text-gray-300 dark:text-[#444] mx-auto mb-3" />
            <p className="text-gray-500 dark:text-[#A0A0A0] text-sm">No captions saved yet.</p>
            <p className="text-gray-400 text-xs mt-1">
              Generate captions in the{" "}
              <Link href="/dashboard/content-studio/faceless-planner" className="text-orange-500 hover:underline">Faceless Planner</Link>{" "}
              or{" "}
              <Link href="/dashboard/content-studio" className="text-orange-500 hover:underline">Content Studio</Link>{" "}
              and save them here.
            </p>
          </div>
        ) : (
          <>
            {(() => {
              const filtered = captions.filter(c => {
                if (!search.trim()) return true;
                const q = search.toLowerCase();
                return c.caption.toLowerCase().includes(q) || (c.title ?? "").toLowerCase().includes(q) || (c.hashtags ?? "").toLowerCase().includes(q);
              });
              if (filtered.length === 0) return (
                <p className="text-center text-sm text-gray-400 py-8">No captions match &ldquo;{search}&rdquo;</p>
              );
              return (
                <div className="space-y-3">
                  {filtered.map((c) => {
                    const platformInfo = PLATFORM_LABELS[c.platform] ?? PLATFORM_LABELS.all;
                    const fullText = c.hashtags ? `${c.caption}\n\n${c.hashtags}` : c.caption;
                    const isLong = c.caption.length > 200;
                    const isExpanded = expandedIds.has(c.id);
                    const hashCount = c.hashtags ? c.hashtags.split(/\s+/).filter(w => w.startsWith("#")).length : 0;
                    return (
                      <div key={c.id} className="rounded-2xl border border-gray-100 dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] p-4">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            {c.title && <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{c.title}</span>}
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${platformInfo.color}`}>{platformInfo.label}</span>
                            <span className="text-[10px] text-gray-400 shrink-0">{c.caption.length}c</span>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <CopyButton text={c.caption} title="Copy caption only" />
                            {c.hashtags && <CopyButton text={c.hashtags} title="Copy hashtags only" />}
                            <CopyButton text={fullText} title="Copy all" />
                            <button onClick={() => deleteCaption(c.id)} className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                        <p className={`text-sm text-gray-700 dark:text-[#E0E0E0] leading-relaxed ${isLong && !isExpanded ? "line-clamp-3" : ""}`}>{c.caption}</p>
                        {isLong && (
                          <button onClick={() => toggleExpand(c.id)} className="mt-1.5 flex items-center gap-1 text-xs text-orange-500 hover:text-orange-600 font-medium transition-colors">
                            {isExpanded ? <><ChevronUp className="w-3 h-3" />Show less</> : <><ChevronDown className="w-3 h-3" />Show more</>}
                          </button>
                        )}
                        {c.hashtags && (
                          <div className="mt-2 flex items-start gap-1.5">
                            <Hash className="w-3 h-3 text-orange-400 shrink-0 mt-0.5" />
                            <p className="text-xs text-orange-500 leading-relaxed">{c.hashtags}</p>
                            {hashCount > 0 && <span className="ml-auto text-[10px] text-gray-400 shrink-0">{hashCount} tags</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </>
        )}
      </div>
    </main>
  );
}
