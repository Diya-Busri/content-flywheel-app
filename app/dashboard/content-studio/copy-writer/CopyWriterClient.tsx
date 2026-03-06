"use client";

import { useState, useCallback, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { setVideoPrefill, getTimelineUrl } from "@/lib/video-prefill";
import { getTemplatePrefill, clearTemplatePrefill } from "@/lib/template-prefill";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Loader2,
  Copy,
  Check,
  Sparkles,
  ListOrdered,
  Hash,
  MessageSquare,
  Film,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { SaveAsTemplateButton } from "@/components/save-as-template-button";

type Platform = "youtube" | "tiktok" | "instagram";

type TitleOption = {
  style: string;
  title: string;
  characterCount: number;
};

type DescriptionResult = {
  hook: string;
  summary: string;
  timestamps: string;
  linksPlaceholder: string;
  hashtags: string;
  ctaSuggestions: string[];
  fullDescription: string;
  characterCount: number;
};

const PLATFORMS: { value: Platform; label: string; titleLimit: number; descLimit: number }[] = [
  { value: "youtube", label: "YouTube", titleLimit: 100, descLimit: 5000 },
  { value: "tiktok", label: "TikTok", titleLimit: 150, descLimit: 150 },
  { value: "instagram", label: "Instagram", titleLimit: 125, descLimit: 2200 },
];

export default function CopyWriterClient() {
  const [topic, setTopic] = useState("");
  const [script, setScript] = useState("");
  const [platform, setPlatform] = useState<Platform>("youtube");
  const [titles, setTitles] = useState<TitleOption[]>([]);
  const [titlesLoading, setTitlesLoading] = useState(false);
  const [description, setDescription] = useState<DescriptionResult | null>(null);
  const [descriptionLoading, setDescriptionLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  // Apply template prefill when arriving from "Use Template" on /dashboard/templates
  useEffect(() => {
    const prefill = getTemplatePrefill();
    if (prefill?.content && (prefill.formatType === "copy_writer" || prefill.formatType === "other")) {
      setScript((s) => s || prefill.content);
      clearTemplatePrefill();
    }
  }, []);

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

  const handleGenerateTitles = useCallback(async () => {
    const t = topic.trim();
    if (!t) {
      toast({ title: "Enter a video topic or title", variant: "destructive" });
      return;
    }
    setTitlesLoading(true);
    setTitles([]);
    try {
      const res = await fetch("/api/content-studio/copy-writer/titles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: t, platform }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Could not generate titles",
          description: data.error ?? "Something went wrong.",
          variant: "destructive",
        });
        return;
      }
      setTitles(data.titles ?? []);
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Request failed.",
        variant: "destructive",
      });
    } finally {
      setTitlesLoading(false);
    }
  }, [topic, platform, toast]);

  const handleGenerateDescription = useCallback(async () => {
    const t = topic.trim();
    if (!t) {
      toast({ title: "Enter a video topic or title", variant: "destructive" });
      return;
    }
    setDescriptionLoading(true);
    setDescription(null);
    try {
      const res = await fetch("/api/content-studio/copy-writer/description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: t,
          title: titles[0]?.title ?? "",
          script: script.trim() || undefined,
          platform,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Could not generate description",
          description: data.error ?? "Something went wrong.",
          variant: "destructive",
        });
        return;
      }
      setDescription(data.description ?? null);
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Request failed.",
        variant: "destructive",
      });
    } finally {
      setDescriptionLoading(false);
    }
  }, [topic, script, platform, titles, toast]);

  const platformInfo = PLATFORMS.find((p) => p.value === platform);

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Inputs */}
      <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A]">
        <CardHeader>
          <CardTitle className="text-lg text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-orange-500" />
            Video details
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            Topic or working title. Optional: paste your script to auto-generate timestamps in the description.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="topic">Topic / title</Label>
            <Input
              id="topic"
              placeholder="e.g. How to grow your YouTube channel in 2026"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="script">Script (optional, for timestamps)</Label>
            <Textarea
              id="script"
              placeholder="Paste script with timestamps like 0:00 Intro or leave blank. AI can also generate timestamps from section headings."
              value={script}
              onChange={(e) => setScript(e.target.value)}
              className="mt-1 min-h-[120px]"
              rows={5}
            />
          </div>
          <div>
            <Label>Platform (character limits)</Label>
            <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
              <SelectTrigger className="mt-1 w-full max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label} — title: {p.titleLimit} chars, description: {p.descLimit} chars
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Title options */}
      <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A]">
        <CardHeader>
          <CardTitle className="text-lg text-gray-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-orange-500" />
            Title options
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            Curiosity, direct, and clickbait styles — optimized for CTR within platform limit.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleGenerateTitles}
            disabled={titlesLoading || !topic.trim()}
            className="bg-orange-500 hover:bg-orange-600"
          >
            {titlesLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            Generate titles
          </Button>
          {titles.length > 0 && (
            <>
              <div className="space-y-3 pt-2">
                {titles.map((opt, i) => (
                  <div
                    key={i}
                    className="flex items-start justify-between gap-3 rounded-lg border border-[#E5E7EB] dark:border-[#2A2A2A] p-3 bg-gray-50/50 dark:bg-[#0d0d0d]"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-medium text-orange-500 uppercase tracking-wide">
                        {opt.style}
                      </span>
                      <p className="text-sm font-medium text-gray-900 dark:text-white mt-0.5">
                        {opt.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {opt.characterCount}
                        {platformInfo ? ` / ${platformInfo.titleLimit} chars` : " chars"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 h-8 w-8 p-0"
                      onClick={() => copyToClipboard(opt.title, `title-${i}`)}
                    >
                      {copiedId === `title-${i}` ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-[#E5E7EB] dark:border-[#2A2A2A]">
                <SaveAsTemplateButton
                  content={titles.map((t) => t.title).join("\n")}
                  formatType="copy_writer"
                  defaultTitle={`Titles: ${topic.trim() || "Copy Writer"}`}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Description */}
      <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A]">
        <CardHeader>
          <CardTitle className="text-lg text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-orange-500" />
            Description
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            Hook, summary, timestamps (from script), links placeholder, hashtags, CTA. SEO-optimized.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleGenerateDescription}
            disabled={descriptionLoading || !topic.trim()}
            className="bg-orange-500 hover:bg-orange-600"
          >
            {descriptionLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            Generate description
          </Button>
          {description && (
            <div className="space-y-4 pt-2">
              {description.hook && (
                <SectionBlock
                  label="Hook (first 2 lines)"
                  value={description.hook}
                  copyId="desc-hook"
                  copiedId={copiedId}
                  onCopy={copyToClipboard}
                />
              )}
              {description.summary && (
                <SectionBlock
                  label="Summary"
                  value={description.summary}
                  copyId="desc-summary"
                  copiedId={copiedId}
                  onCopy={copyToClipboard}
                />
              )}
              {description.timestamps && (
                <SectionBlock
                  label="Timestamps"
                  value={description.timestamps}
                  copyId="desc-timestamps"
                  copiedId={copiedId}
                  onCopy={copyToClipboard}
                  icon={<ListOrdered className="w-4 h-4" />}
                />
              )}
              {description.linksPlaceholder && (
                <SectionBlock
                  label="Links"
                  value={description.linksPlaceholder}
                  copyId="desc-links"
                  copiedId={copiedId}
                  onCopy={copyToClipboard}
                />
              )}
              {description.hashtags && (
                <SectionBlock
                  label="Hashtags"
                  value={description.hashtags}
                  copyId="desc-hashtags"
                  copiedId={copiedId}
                  onCopy={copyToClipboard}
                  icon={<Hash className="w-4 h-4" />}
                />
              )}
              {description.ctaSuggestions.length > 0 && (
                <div className="rounded-lg border border-[#E5E7EB] dark:border-[#2A2A2A] p-3 bg-gray-50/50 dark:bg-[#0d0d0d]">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="w-4 h-4 text-orange-500" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      CTA suggestions
                    </span>
                  </div>
                  <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1 list-disc list-inside">
                    {description.ctaSuggestions.map((cta, i) => (
                      <li key={i}>{cta}</li>
                    ))}
                  </ul>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 text-xs"
                    onClick={() =>
                      copyToClipboard(description.ctaSuggestions.join("\n"), "desc-cta")
                    }
                  >
                    {copiedId === "desc-cta" ? (
                      <Check className="w-3 h-3 mr-1 text-green-500" />
                    ) : (
                      <Copy className="w-3 h-3 mr-1" />
                    )}
                    Copy all CTAs
                  </Button>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E5E7EB] dark:border-[#2A2A2A]">
                <span className="text-xs text-muted-foreground">
                  Full description: {description.characterCount}
                  {platformInfo ? ` / ${platformInfo.descLimit} chars` : ""}
                </span>
                <div className="flex items-center gap-2">
                  <SaveAsTemplateButton
                    content={description.fullDescription}
                    formatType="copy_writer"
                    defaultTitle={`Description: ${topic.trim() || "Copy Writer"}`}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(description.fullDescription, "desc-full")}
                  >
                    {copiedId === "desc-full" ? (
                      <Check className="w-3.5 h-3.5 mr-1 text-green-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 mr-1" />
                  )}
                    Copy full description
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {(topic.trim() || titles.length > 0 || description) && (
        <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A]">
          <CardContent className="pt-6">
            <Button
              className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600"
              onClick={() => {
                setVideoPrefill({
                  title: titles[0]?.title ?? topic.trim() || undefined,
                  description: description?.fullDescription,
                  source: "copy-writer",
                });
                router.push(getTimelineUrl());
              }}
            >
              <Film className="w-4 h-4 mr-2" />
              Create video with this title & description
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SectionBlock({
  label,
  value,
  copyId,
  copiedId,
  onCopy,
  icon,
}: {
  label: string;
  value: string;
  copyId: string;
  copiedId: string | null;
  onCopy: (text: string, id: string) => void;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[#E5E7EB] dark:border-[#2A2A2A] p-3 bg-gray-50/50 dark:bg-[#0d0d0d]">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-xs font-medium text-orange-500 flex items-center gap-1">
          {icon}
          {label}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => onCopy(value, copyId)}
        >
          {copiedId === copyId ? (
            <Check className="w-3 h-3 mr-1 text-green-500" />
          ) : (
            <Copy className="w-3 h-3 mr-1" />
          )}
          Copy
        </Button>
      </div>
      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{value}</p>
    </div>
  );
}
