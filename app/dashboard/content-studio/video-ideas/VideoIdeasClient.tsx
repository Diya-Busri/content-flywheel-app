"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
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
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, Calendar, FileText, Eye, Lightbulb } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

type VideoIdeaFilter = "trending" | "evergreen" | "viral" | "beginner";

type VideoIdea = {
  id: string;
  title: string;
  hook: string;
  whyItWorks: string;
  estViews: string;
  contentStructure?: string;
  psychology?: string;
};

const FILTERS: { value: VideoIdeaFilter; label: string }[] = [
  { value: "trending", label: "Trending" },
  { value: "evergreen", label: "Evergreen" },
  { value: "viral", label: "Viral potential" },
  { value: "beginner", label: "Beginner-friendly" },
];

function buildCalendarUrl(idea: VideoIdea): string {
  const base = "/dashboard/content-calendar";
  const params = new URLSearchParams();
  params.set("ideaTitle", idea.title);
  if (idea.hook) params.set("ideaHook", idea.hook);
  return `${base}?${params.toString()}`;
}

/** Navigate to Video Timeline with idea pre-filled so user can generate script and create video. */
function goToTimelineWithIdea(idea: VideoIdea, router: ReturnType<typeof useRouter>): void {
  setVideoPrefill({
    title: idea.title,
    description: idea.hook ?? undefined,
    source: "video-ideas",
  });
  router.push(getTimelineUrl());
}

export default function VideoIdeasClient() {
  const [filter, setFilter] = useState<VideoIdeaFilter>("trending");
  const [niche, setNiche] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<VideoIdea[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setIdeas([]);
    try {
      const res = await fetch("/api/content-studio/video-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filter, count: 20 }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Could not generate",
          description: data.error ?? "Something went wrong.",
          variant: "destructive",
        });
        return;
      }
      setIdeas(data.ideas ?? []);
      setNiche(data.niche ?? null);
      if (!data.ideas?.length) {
        toast({ title: "No ideas", description: "Try a different filter or set your niche in Niche Research." });
      }
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Request failed.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [filter, toast]);

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Niche + filters + generate */}
      <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A]">
        <CardHeader>
          <CardTitle className="text-lg text-gray-900 dark:text-white flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-orange-500" />
            Video ideas
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            AI generates 20 video ideas for your niche. Each idea shows hook, why it works, and estimated views. Generate Script takes you to Video Timeline. Save ideas to calendar. Complete flow: Idea → Script → Video.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Filter</p>
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <Button
                  key={f.value}
                  variant={filter === f.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter(f.value)}
                  className={filter === f.value ? "bg-orange-500 hover:bg-orange-600" : ""}
                >
                  {f.label}
                </Button>
              ))}
            </div>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={loading}
            className="bg-orange-500 hover:bg-orange-600"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            {loading ? "Generating ideas…" : "Generate 20 ideas"}
          </Button>
          {niche && (
            <p className="text-sm text-muted-foreground">
              Niche: <span className="font-medium text-foreground">{niche}</span>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Grid of idea cards */}
      {ideas.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Ideas
          </h2>
          <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
            {ideas.map((idea) => (
              <Card
                key={idea.id}
                className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] overflow-hidden flex flex-col"
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-gray-900 dark:text-white line-clamp-2">
                    {idea.title}
                  </CardTitle>
                  {idea.hook && (
                    <CardDescription className="text-sm italic border-l-2 border-orange-500/50 pl-3 text-gray-600 dark:text-gray-400">
                      “{idea.hook}”
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-3 pt-0 flex-1 flex flex-col">
                  {idea.whyItWorks && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-0.5 flex items-center gap-1">
                        <Lightbulb className="w-3.5 h-3.5" />
                        Why it works
                      </p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {idea.whyItWorks}
                      </p>
                    </div>
                  )}
                  {idea.psychology && (
                    <p className="text-xs text-muted-foreground">
                      {idea.psychology}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-auto pt-2">
                    <Badge variant="secondary" className="text-xs font-normal gap-1">
                      <Eye className="w-3 h-3" />
                      {idea.estViews}
                    </Badge>
                  </div>
                  {idea.contentStructure && (
                    <p className="text-xs text-muted-foreground">
                      Structure: {idea.contentStructure}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                    <Button variant="outline" size="sm" asChild className="text-xs">
                      <Link href={buildCalendarUrl(idea)}>
                        <Calendar className="w-3.5 h-3.5 mr-1.5" />
                        Save to Calendar
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      className="text-xs bg-orange-500 hover:bg-orange-600"
                      onClick={() => goToTimelineWithIdea(idea, router)}
                    >
                      <FileText className="w-3.5 h-3.5 mr-1.5" />
                      Generate Script
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-10 h-10 animate-spin mb-4" />
          <p>Generating video ideas…</p>
        </div>
      )}

      {!loading && ideas.length === 0 && niche === null && (
        <Card className="border-dashed border-[#E5E7EB] dark:border-[#2A2A2A] bg-gray-50/50 dark:bg-[#0F0F0F]/50">
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            <p className="mb-2">Choose a filter and click “Generate 20 ideas” to get started.</p>
            <p>
              No niche yet?{" "}
              <Link href="/dashboard/content-studio/niche-research" className="text-orange-500 hover:underline">
                Set your niche in Niche Research
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
