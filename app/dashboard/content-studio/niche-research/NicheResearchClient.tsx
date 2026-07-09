"use client";

import { useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, Check, TrendingUp, Users, Layers } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

type SampleChannel = {
  name: string;
  platform: string;
  metric: string;
};

type NicheRecommendation = {
  id: string;
  name: string;
  profitabilityScore: number;
  competition: string;
  opportunity: string;
  sampleChannels: SampleChannel[];
  growthPotential: string;
  contentPillars: string[];
};

function scoreColor(score: number): string {
  if (score >= 80) return "text-green-600 dark:text-green-400 bg-green-500/15 border-green-500/40";
  if (score >= 60) return "text-amber-600 dark:text-amber-400 bg-amber-500/15 border-amber-500/40";
  return "text-orange-600 dark:text-orange-400 bg-orange-500/15 border-orange-500/40";
}

function competitionColor(c: string): string {
  const lower = c.toLowerCase();
  if (lower === "low") return "bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/40";
  if (lower === "medium") return "bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/40";
  return "bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-500/40";
}

export default function NicheResearchClient() {
  const [interests, setInterests] = useState("");
  const [skills, setSkills] = useState("");
  const [currentAudience, setCurrentAudience] = useState("");
  const [loading, setLoading] = useState(false);
  const [niches, setNiches] = useState<NicheRecommendation[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedNiche, setSavedNiche] = useState<string | null>(null);
  const { toast } = useToast();

  const handleGenerate = useCallback(async () => {
    const trimmed = interests.trim();
    if (!trimmed) {
      toast({
        title: "Interests required",
        description: "Describe what you're interested in or passionate about.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    setNiches([]);
    try {
      const res = await fetch("/api/content-studio/niche-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interests: trimmed,
          skills: skills.trim() || undefined,
          currentAudience: currentAudience.trim() || undefined,
        }),
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
      setNiches(data.niches ?? []);
      if (!data.niches?.length) {
        toast({ title: "No results", description: "Try different or more specific interests." });
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
  }, [interests, skills, currentAudience, toast]);

  const handleSelectNiche = useCallback(
    async (niche: NicheRecommendation) => {
      setSavingId(niche.id);
      try {
        const res = await fetch("/api/brand-profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nicheIndustry: niche.name }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Failed to save");
        }
        setSavedNiche(niche.name);
        toast({
          title: "Niche saved",
          description: `"${niche.name}" is now your content niche. Future suggestions will use it.`,
        });
      } catch (e) {
        toast({
          title: "Could not save",
          description: e instanceof Error ? e.message : "Please try again.",
          variant: "destructive",
        });
      } finally {
        setSavingId(null);
      }
    },
    [toast]
  );

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Step 1: Inputs */}
      <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A]">
        <CardHeader>
          <CardTitle className="text-lg text-gray-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-orange-500" />
            Input interests & skills
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            AI suggests 5–10 niches with profitability scores, successful channels in each niche, and content pillars. Save your choice to affect all future content suggestions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="interests" className="text-gray-700 dark:text-gray-300">
              Interests <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="interests"
              placeholder="e.g. Personal finance, fitness, cooking, tech reviews, productivity, travel"
              value={interests}
              onChange={(e) => setInterests(e.target.value)}
              className="min-h-[100px] border-[#E5E7EB] dark:border-[#2A2A2A] bg-gray-50 dark:bg-[#0F0F0F]"
              disabled={loading}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="skills" className="text-gray-700 dark:text-gray-300">
                Skills / experience
              </Label>
              <Input
                id="skills"
                placeholder="e.g. Teaching, design, coding"
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-gray-50 dark:bg-[#0F0F0F]"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="audience" className="text-gray-700 dark:text-gray-300">
                Current audience (if any)
              </Label>
              <Input
                id="audience"
                placeholder="e.g. Small TikTok following, none yet"
                value={currentAudience}
                onChange={(e) => setCurrentAudience(e.target.value)}
                className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-gray-50 dark:bg-[#0F0F0F]"
                disabled={loading}
              />
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
            {loading ? "Finding niches…" : "Generate niche recommendations"}
          </Button>
        </CardContent>
      </Card>

      {/* Step 2: Results */}
      {niches.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Niche recommendations
          </h2>
          <p className="text-sm text-muted-foreground">
            Select a niche to save to your profile. Your saved niche affects Video Ideas, SEO, trends, and all future content suggestions.
          </p>
          <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
            {niches.map((niche) => {
              const isSaved = savedNiche === niche.name;
              const isSaving = savingId === niche.id;
              return (
                <Card
                  key={niche.id}
                  className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] overflow-hidden"
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base text-gray-900 dark:text-white">
                        {niche.name}
                      </CardTitle>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-sm font-medium ${scoreColor(niche.profitabilityScore)}`}
                        >
                          {niche.profitabilityScore}/100
                        </span>
                        <Badge variant="outline" className={competitionColor(niche.competition)}>
                          {niche.competition}
                        </Badge>
                      </div>
                    </div>
                    {niche.opportunity && (
                      <CardDescription className="text-gray-600 dark:text-gray-400 text-sm">
                        {niche.opportunity}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4 pt-0">
                    {niche.sampleChannels.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          Successful channels in this niche
                        </p>
                        <ul className="text-xs text-gray-700 dark:text-gray-300 space-y-0.5">
                          {niche.sampleChannels.map((ch, i) => (
                            <li key={i}>
                              {ch.name} ({ch.platform}) — {ch.metric}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {niche.growthPotential && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                          <TrendingUp className="w-3.5 h-3.5" />
                          Growth potential
                        </p>
                        <p className="text-xs text-gray-700 dark:text-gray-300">
                          {niche.growthPotential}
                        </p>
                      </div>
                    )}
                    {niche.contentPillars.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                          <Layers className="w-3.5 h-3.5" />
                          Content pillars
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {niche.contentPillars.map((p, i) => (
                            <Badge
                              key={i}
                              variant="secondary"
                              className="text-xs font-normal"
                            >
                              {p}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    <Button
                      size="sm"
                      variant={isSaved ? "secondary" : "default"}
                      onClick={() => handleSelectNiche(niche)}
                      disabled={isSaving || isSaved}
                      className={!isSaved ? "bg-orange-500 hover:bg-orange-600" : ""}
                    >
                      {isSaving ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : isSaved ? (
                        <Check className="w-4 h-4 mr-2" />
                      ) : null}
                      {isSaved ? "Saved to profile" : "Select this niche"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-10 h-10 animate-spin mb-4" />
          <p>Analyzing interests and finding niches…</p>
        </div>
      )}
    </div>
  );
}
