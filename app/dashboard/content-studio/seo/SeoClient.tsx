"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { setVideoPrefill, getTimelineUrl } from "@/lib/video-prefill";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Search,
  Loader2,
  Copy,
  Check,
  Hash,
  BarChart3,
  Bookmark,
  Trash2,
  Film,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { SaveAsTemplateButton } from "@/components/save-as-template-button";
import { getTemplatePrefill, clearTemplatePrefill } from "@/lib/template-prefill";

type Platform = "youtube" | "tiktok" | "instagram";

type KeywordRow = {
  keyword: string;
  monthlySearches: string;
  difficulty: "low" | "medium" | "high";
  trend: "rising" | "stable" | "declining";
};

type SeoResult = {
  keywords: KeywordRow[];
  relatedKeywords: string[];
  longTailKeywords: string[];
  youtubeSuggestions: string[];
  tiktok: { trendingHashtags: string[]; nicheHashtags: string[] };
  youtube: { seoKeywords: string[] };
  instagram: { hashtagCombinations: string[] };
};

type SavedGroup = {
  id: string;
  name: string;
  platform: string;
  topic: string | null;
  tags: string[];
  createdAt: string;
};

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: "youtube", label: "YouTube" },
  { value: "tiktok", label: "TikTok" },
  { value: "instagram", label: "Instagram" },
];

function difficultyColor(d: string) {
  switch (d) {
    case "low": return "text-green-600 dark:text-green-400";
    case "high": return "text-red-600 dark:text-red-400";
    default: return "text-amber-600 dark:text-amber-400";
  }
}

function trendLabel(t: string) {
  switch (t) {
    case "rising": return "↗ Rising";
    case "declining": return "↘ Declining";
    default: return "→ Stable";
  }
}

export default function SeoClient() {
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SeoResult | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savedGroups, setSavedGroups] = useState<SavedGroup[]>([]);
  const [saveName, setSaveName] = useState("");
  const [savePlatform, setSavePlatform] = useState<Platform>("tiktok");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const copyToClipboard = useCallback(
    (text: string, id: string) => {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          setCopiedId(id);
          setTimeout(() => setCopiedId(null), 2000);
          toast({ title: "Copied to clipboard" });
        })
        .catch(() => toast({ title: "Copy failed", variant: "destructive" }));
    },
    [toast]
  );

  const loadSavedGroups = useCallback(async () => {
    try {
      const res = await fetch("/api/content-studio/seo/saved-groups");
      const data = await res.json();
      if (res.ok && Array.isArray(data.groups)) setSavedGroups(data.groups);
    } catch {
      setSavedGroups([]);
    }
  }, []);

  useEffect(() => {
    loadSavedGroups();
  }, [loadSavedGroups]);

  useEffect(() => {
    const prefill = getTemplatePrefill();
    if (prefill?.content && prefill.formatType === "seo") {
      const topicFromTitle = prefill.title?.replace(/^SEO:\s*/i, "").trim();
      const topicFromContent = prefill.content.split("\n")[0]?.replace(/^Keywords:\s*/i, "").trim();
      setTopic((t) => t || topicFromTitle || topicFromContent || prefill.content.slice(0, 200));
      clearTemplatePrefill();
    }
  }, []);

  const handleResearch = useCallback(async () => {
    const t = topic.trim();
    if (!t) {
      toast({ title: "Enter a video topic", variant: "destructive" });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/content-studio/seo/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: t }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Research failed",
          description: data.error ?? "Something went wrong.",
          variant: "destructive",
        });
        return;
      }
      setResult(data.result ?? null);
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Request failed.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [topic, toast]);

  const handleSaveGroup = useCallback(async () => {
    const name = saveName.trim();
    if (!name) {
      toast({ title: "Enter a name for this group", variant: "destructive" });
      return;
    }
    let tags: string[] = [];
    if (result) {
      if (savePlatform === "tiktok") {
        tags = [...result.tiktok.trendingHashtags, ...result.tiktok.nicheHashtags];
      } else if (savePlatform === "youtube") {
        tags = result.youtube.seoKeywords.map((t) => (t.startsWith("#") ? t : t));
      } else {
        tags = result.instagram.hashtagCombinations[0]
          ? result.instagram.hashtagCombinations[0].split(/\s+/).filter(Boolean)
          : [];
      }
    }
    if (tags.length === 0) {
      toast({ title: "Run research first and select a platform", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/content-studio/seo/saved-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          platform: savePlatform,
          tags,
          topic: topic.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.error ?? "Failed to save", variant: "destructive" });
        return;
      }
      setSaveName("");
      toast({ title: "Saved" });
      loadSavedGroups();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [saveName, savePlatform, result, topic, toast, loadSavedGroups]);

  const deleteSavedGroup = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/content-studio/seo/saved-groups/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          toast({ title: "Could not delete", variant: "destructive" });
          return;
        }
        loadSavedGroups();
        toast({ title: "Deleted" });
      } catch {
        toast({ title: "Delete failed", variant: "destructive" });
      }
    },
    [loadSavedGroups, toast]
  );

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Topic + Research */}
      <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A]">
        <CardHeader>
          <CardTitle className="text-lg text-gray-900 dark:text-white flex items-center gap-2">
            <Search className="w-5 h-5 text-orange-500" />
            Keyword research
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            Enter your video topic. We use YouTube autocomplete and AI for search volume, competition, trend, and platform hashtags.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="topic">Video topic</Label>
              <Input
                id="topic"
                placeholder="e.g. morning routine for productivity"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleResearch()}
                className="mt-1"
              />
            </div>
            <Button
              onClick={handleResearch}
              disabled={loading || !topic.trim()}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Search className="w-4 h-4 mr-2" />
              )}
              Research
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <SaveAsTemplateButton
              content={[
                "Keywords: " + result.keywords.map((k) => k.keyword).join(", "),
                "Related: " + result.relatedKeywords.join(", "),
                "Long-tail: " + result.longTailKeywords.join(", "),
                "YouTube: " + result.youtubeSuggestions.join(", "),
                "TikTok: " + [...(result.tiktok?.trendingHashtags ?? []), ...(result.tiktok?.nicheHashtags ?? [])].join(" "),
                "YT tags: " + (result.youtube?.seoKeywords ?? []).join(", "),
              ].join("\n")}
              formatType="seo"
              defaultTitle={`SEO: ${topic.trim() || "Research"}`}
            />
          </div>
          {/* Keywords table */}
          <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A]">
            <CardHeader>
              <CardTitle className="text-lg text-gray-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-orange-500" />
                Keywords & volume
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Monthly searches, difficulty, and trend (Google Keyword Planner–style estimates).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
                      <th className="text-left py-2 font-medium text-gray-700 dark:text-gray-300">Keyword</th>
                      <th className="text-left py-2 font-medium text-gray-700 dark:text-gray-300">Monthly searches</th>
                      <th className="text-left py-2 font-medium text-gray-700 dark:text-gray-300">Difficulty</th>
                      <th className="text-left py-2 font-medium text-gray-700 dark:text-gray-300">Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.keywords.map((k, i) => (
                      <tr key={i} className="border-b border-[#E5E7EB]/50 dark:border-[#2A2A2A]/50">
                        <td className="py-2 text-gray-900 dark:text-white">{k.keyword}</td>
                        <td className="py-2 text-muted-foreground">{k.monthlySearches}</td>
                        <td className={`py-2 capitalize ${difficultyColor(k.difficulty)}`}>{k.difficulty}</td>
                        <td className="py-2 text-muted-foreground">{trendLabel(k.trend)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Related + Long-tail + YouTube suggestions */}
          <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A]">
            <CardHeader>
              <CardTitle className="text-lg text-gray-900 dark:text-white">Related & long-tail</CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Related keywords, long-tail phrases, and YouTube autocomplete suggestions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {result.relatedKeywords.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-orange-500 mb-1">Related keywords</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {result.relatedKeywords.join(" · ")}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1 h-7 text-xs"
                    onClick={() => copyToClipboard(result.relatedKeywords.join(", "), "related")}
                  >
                    {copiedId === "related" ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                    Copy
                  </Button>
                </div>
              )}
              {result.longTailKeywords.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-orange-500 mb-1">Long-tail</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {result.longTailKeywords.join(" · ")}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1 h-7 text-xs"
                    onClick={() => copyToClipboard(result.longTailKeywords.join(", "), "longtail")}
                  >
                    {copiedId === "longtail" ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                    Copy
                  </Button>
                </div>
              )}
              {result.youtubeSuggestions.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-orange-500 mb-1">YouTube search suggestions</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {result.youtubeSuggestions.join(" · ")}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1 h-7 text-xs"
                    onClick={() => copyToClipboard(result.youtubeSuggestions.join("\n"), "yt-suggest")}
                  >
                    {copiedId === "yt-suggest" ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                    Copy
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Platform hashtags */}
          <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A]">
            <CardHeader>
              <CardTitle className="text-lg text-gray-900 dark:text-white flex items-center gap-2">
                <Hash className="w-5 h-5 text-orange-500" />
                Platform hashtags
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                TikTok: trending + niche. YouTube: SEO tags for title/description. Instagram: 30-hashtag combinations.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* TikTok */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">TikTok</h4>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Trending</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 break-words">
                      {result.tiktok.trendingHashtags.join(" ")}
                    </p>
                    <Button variant="ghost" size="sm" className="h-7 text-xs mt-1" onClick={() => copyToClipboard(result.tiktok.trendingHashtags.join(" "), "tt-trend")}>
                      {copiedId === "tt-trend" ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                      Copy
                    </Button>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Niche</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 break-words">
                      {result.tiktok.nicheHashtags.join(" ")}
                    </p>
                    <Button variant="ghost" size="sm" className="h-7 text-xs mt-1" onClick={() => copyToClipboard(result.tiktok.nicheHashtags.join(" "), "tt-niche")}>
                      {copiedId === "tt-niche" ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                      Copy
                    </Button>
                  </div>
                </div>
              </div>

              {/* YouTube */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">YouTube (SEO tags)</h4>
                <p className="text-sm text-gray-700 dark:text-gray-300 break-words">
                  {result.youtube.seoKeywords.join(", ")}
                </p>
                <Button variant="ghost" size="sm" className="h-7 text-xs mt-1" onClick={() => copyToClipboard(result.youtube.seoKeywords.join(", "), "yt-tags")}>
                  {copiedId === "yt-tags" ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                  Copy
                </Button>
              </div>

              {/* Instagram */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Instagram (hashtag combinations)</h4>
                <div className="space-y-2">
                  {result.instagram.hashtagCombinations.map((row, i) => (
                    <div key={i} className="rounded border border-[#E5E7EB] dark:border-[#2A2A2A] p-2 bg-gray-50/50 dark:bg-[#0d0d0d]">
                      <p className="text-sm text-gray-700 dark:text-gray-300 break-words">{row}</p>
                      <Button variant="ghost" size="sm" className="h-7 text-xs mt-1" onClick={() => copyToClipboard(row, `ig-${i}`)}>
                        {copiedId === `ig-${i}` ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                        Copy
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A]">
            <CardContent className="pt-6">
              <Button
                className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600"
                onClick={() => {
                  const hashtagStr = [
                    ...result.tiktok.trendingHashtags,
                    ...result.tiktok.nicheHashtags,
                  ].join(" ");
                  setVideoPrefill({
                    title: topic.trim() || undefined,
                    hashtags: hashtagStr || undefined,
                    source: "seo",
                  });
                  router.push(getTimelineUrl());
                }}
              >
                <Film className="w-4 h-4 mr-2" />
                Create video with these hashtags
              </Button>
            </CardContent>
          </Card>

          {/* Save group */}
          <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A]">
            <CardHeader>
              <CardTitle className="text-lg text-gray-900 dark:text-white flex items-center gap-2">
                <Bookmark className="w-5 h-5 text-orange-500" />
                Save hashtag group
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Save the current platform hashtags for reuse.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="w-48">
                  <Label>Name</Label>
                  <Input placeholder="e.g. Fitness Reels" value={saveName} onChange={(e) => setSaveName(e.target.value)} className="mt-1" />
                </div>
                <div className="w-36">
                  <Label>Platform</Label>
                  <Select value={savePlatform} onValueChange={(v) => setSavePlatform(v as Platform)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PLATFORMS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleSaveGroup} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  Save group
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Saved groups */}
      <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A]">
        <CardHeader>
          <CardTitle className="text-lg text-gray-900 dark:text-white flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-orange-500" />
            Saved hashtag groups
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            Your saved groups. Copy or delete.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {savedGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No saved groups yet. Run research and save a group above.</p>
          ) : (
            <ul className="space-y-2">
              {savedGroups.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-2 rounded-lg border border-[#E5E7EB] dark:border-[#2A2A2A] p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{g.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {g.platform} {g.topic ? ` · ${g.topic}` : ""}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 truncate mt-1">
                      {g.tags.slice(0, 5).join(" ")}{g.tags.length > 5 ? " …" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8"
                      onClick={() => copyToClipboard(g.tags.join(" "), `saved-${g.id}`)}
                    >
                      {copiedId === `saved-${g.id}` ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 text-red-500 hover:text-red-600" onClick={() => deleteSavedGroup(g.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
