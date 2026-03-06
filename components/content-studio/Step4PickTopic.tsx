"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ArrowRight } from "lucide-react";
import type { WizardData } from "./Step1AboutYou";
import type { TopicItem } from "@/app/api/content-studio/generate-topics/route";
import { useContentStudio } from "@/app/dashboard/content-studio/create/ContentStudioContext";

type Props = {
  wizardData: WizardData;
  onNext: (data?: Partial<WizardData>) => void;
  onBack: () => void;
};

const TREND_BADGES: Record<string, { label: string; emoji: string }> = {
  hot: { label: "Hot", emoji: "🔥" },
  rising: { label: "Rising", emoji: "📈" },
  evergreen: { label: "Evergreen", emoji: "♾️" },
};

const COMPETITION_MAP: Record<string, { label: string; className: string }> = {
  low: { label: "Low", className: "text-green-600 dark:text-green-400 bg-green-500/10 border-green-500/30" },
  medium: { label: "Medium", className: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30" },
  high: { label: "High", className: "text-orange-600 dark:text-orange-400 bg-orange-500/10 border-orange-500/30" },
};

async function fetchTopics(niche: string, contentStyle: string): Promise<TopicItem[]> {
  const res = await fetch("/api/content-studio/generate-topics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ niche, content_style: contentStyle }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data.error as string) || "Failed to load topics");
  return Array.isArray(data) ? data : [];
}

export function Step4PickTopic({ wizardData: propsWizardData, onBack }: Props) {
  const router = useRouter();
  const { wizardData: contextWizardData, updateWizardData } = useContentStudio();
  const niche = contextWizardData.selected_niche ?? (propsWizardData as { selected_niche?: string })?.selected_niche ?? (propsWizardData as { selectedNiche?: string })?.selectedNiche ?? "your niche";
  const contentStyle = (contextWizardData.content_style ?? (propsWizardData as { content_style?: string })?.content_style ?? (propsWizardData as { contentStyle?: string })?.contentStyle ?? "general") as string;
  const contentStyleLabel = contentStyle === "faceless" ? "faceless" : contentStyle === "personal-brand" ? "personal brand" : contentStyle;

  console.log("Step 4 wizard data:", contextWizardData);

  const [topics, setTopics] = useState<TopicItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<TopicItem | null>(null);
  const [navigating, setNavigating] = useState(false);

  const loadTopics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const minDelay = new Promise((r) => setTimeout(r, 3000));
      const [result] = await Promise.all([
        fetchTopics(niche, contentStyle),
        minDelay,
      ]);
      setTopics(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setTopics([]);
    } finally {
      setLoading(false);
    }
  }, [niche, contentStyle]);

  useEffect(() => {
    loadTopics();
  }, [loadTopics]);

  const handleRegenerate = () => {
    loadTopics();
    setSelectedTopic(null);
  };

  const handleTopicSelect = async () => {
    const topic = selectedTopic;
    if (!topic) return;
    setNavigating(true);
    try {
      // Save selected topic; next step is script config (4.5), then scripts (5)
      await updateWizardData({
        selected_topic: { id: topic.id, title: topic.title, hook_angle: topic.hook_angle },
        current_step: 4.5,
      });
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("selected_topic", JSON.stringify(topic));
        localStorage.setItem("selected_topic_id", topic.id || topic.title);
      }
      router.push("/dashboard/content-studio/create/script-config");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save progress");
    } finally {
      setNavigating(false);
    }
  };

  if (loading && topics.length === 0) {
    return (
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
          Step 4 of 7 — Pick a Trending Topic
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Based on niche: {niche} · {contentStyleLabel} content
        </p>
        <div className="py-16 text-center">
          <Loader2 className="w-12 h-12 text-orange-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">
            Analyzing trending topics in {niche}...
          </p>
        </div>
      </div>
    );
  }

  if (error && topics.length === 0) {
    return (
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
          Step 4 of 7 — Pick a Trending Topic
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Based on niche: {niche} · {contentStyleLabel} content
        </p>
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-4 py-4 text-red-700 dark:text-red-300 mb-6">
          {error}
        </div>
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={onBack} className="border-[#E5E7EB] dark:border-[#2A2A2A]">
            Back
          </Button>
          <Button type="button" onClick={loadTopics} className="bg-orange-500 hover:bg-orange-600 text-white">
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            Step 4 of 7 — Pick a Trending Topic
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Based on niche: {niche} · {contentStyleLabel} content
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-[#E5E7EB] dark:border-[#2A2A2A] shrink-0 gap-2"
          onClick={handleRegenerate}
          disabled={loading}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "🔄"}
          Show More Topics
        </Button>
      </div>

      {loading && topics.length > 0 ? (
        <div className="py-12 text-center">
          <Loader2 className="w-10 h-10 text-orange-500 animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-600 dark:text-gray-400">Loading more topics...</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          {topics.map((topic) => {
            const trend = TREND_BADGES[topic.trend_status] ?? TREND_BADGES.rising;
            const comp = COMPETITION_MAP[topic.competition] ?? COMPETITION_MAP.medium;
            const isSelected = selectedTopic?.id === topic.id;
            const cardClass = isSelected
              ? "border-orange-500 bg-orange-500/5 dark:bg-orange-500/10"
              : "border-[#E5E7EB] dark:border-[#2A2A2A] hover:border-orange-500/50 bg-white dark:bg-[#1A1A1A]";
            return (
              <Card
                key={topic.id}
                className={`rounded-xl border-2 transition-all text-left cursor-pointer ${cardClass}`}
                onClick={() => setSelectedTopic(topic)}
              >
                <CardContent className="p-5">
                  <h3 className="font-bold text-gray-900 dark:text-white mb-2">{topic.title}</h3>
                  {topic.hook_angle && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                      {topic.hook_angle}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className="text-xs font-medium px-2 py-1 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                      {trend.emoji} {trend.label}
                    </span>
                    <span className={`text-xs font-medium px-2 py-1 rounded-md border ${comp.className}`}>
                      {comp.label} competition
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mb-2">
                    {topic.estimated_views} views/month
                  </p>
                  {topic.why_now && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
                      <span className="font-medium text-gray-700 dark:text-gray-300">Why now:</span> {topic.why_now}
                    </p>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    className={
                      isSelected
                        ? "bg-orange-500 hover:bg-orange-600 text-white w-full"
                        : "border-orange-500/50 text-orange-600 dark:text-orange-400 hover:bg-orange-500/10 w-full"
                    }
                    variant={isSelected ? "default" : "outline"}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTopic(topic);
                    }}
                  >
                    Select This Topic
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="flex justify-between items-center pt-4">
        <Button type="button" variant="outline" onClick={onBack} className="border-[#E5E7EB] dark:border-[#2A2A2A]" disabled={navigating}>
          Back
        </Button>
        <div className="flex flex-col items-end gap-1">
          <Button
            type="button"
            disabled={!selectedTopic || navigating}
            onClick={handleTopicSelect}
            className={`gap-2 px-6 py-3 rounded-lg font-semibold ${
              selectedTopic && !navigating
                ? "bg-orange-500 hover:bg-orange-600 text-white"
                : "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
            }`}
          >
            {navigating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Next: Generate Scripts
            <ArrowRight className="w-4 h-4" />
          </Button>
          {!selectedTopic && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Please select a topic to continue
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
