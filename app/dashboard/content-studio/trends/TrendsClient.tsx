"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp,
  Loader2,
  RefreshCw,
  Hash,
  Music2,
  Layout,
  Lightbulb,
  History,
  ArrowLeft,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

type TrendLifecycle = "rising" | "peak" | "declining";

type PlatformTrend = {
  id: string;
  title: string;
  description: string;
  lifecycle: TrendLifecycle;
  suggestedAngles: string[];
  hashtags: string[];
  sounds: string[];
  formats: string[];
};

type HistoricalTrend = {
  title: string;
  whyItWorked: string;
  bestPlatform: string;
};

type PlatformTrendsData = {
  platform: "tiktok" | "youtube" | "instagram";
  platformLabel: string;
  trends: PlatformTrend[];
};

const LIFECYCLE_STYLES: Record<TrendLifecycle, string> = {
  rising: "bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/40",
  peak: "bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/40",
  declining: "bg-gray-500/20 text-gray-600 dark:text-gray-400 border-gray-500/40",
};

const LIFECYCLE_LABELS: Record<TrendLifecycle, string> = {
  rising: "Rising",
  peak: "Peak",
  declining: "Declining",
};

export default function TrendsClient() {
  const [niche, setNiche] = useState<string | null>(null);
  const [platformData, setPlatformData] = useState<PlatformTrendsData[]>([]);
  const [historical, setHistorical] = useState<HistoricalTrend[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleLoad = useCallback(async () => {
    setLoading(true);
    setPlatformData([]);
    setHistorical([]);
    try {
      const res = await fetch("/api/content-studio/trends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Could not load trends",
          description: data.error ?? "Something went wrong.",
          variant: "destructive",
        });
        return;
      }
      setNiche(data.niche ?? null);
      setPlatformData(data.platformData ?? []);
      setHistorical(data.historical ?? []);
      if (!data.platformData?.length) {
        toast({ title: "No trends", description: "Set your niche in Niche Research first." });
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
  }, [toast]);

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header + refresh */}
      <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A]">
        <CardHeader>
          <CardTitle className="text-lg text-gray-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-orange-500" />
            Real-time trends
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            Trending topics in your niche by platform. Lifecycle (rising / peak / declining), suggested angles, hashtags, sounds, and formats. Data is generated for your saved niche—integrations with TikTok Trends API, YouTube Trending API, and Google Trends can be added when keys are configured.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <Button
            onClick={handleLoad}
            disabled={loading}
            className="bg-orange-500 hover:bg-orange-600"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            {loading ? "Loading trends…" : "Load trends for my niche"}
          </Button>
          {niche && (
            <span className="text-sm text-muted-foreground">
              Niche: <span className="font-medium text-foreground">{niche}</span>
            </span>
          )}
        </CardContent>
      </Card>

      {loading && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-10 h-10 animate-spin mb-4" />
          <p>Fetching platform trends…</p>
        </div>
      )}

      {!loading && platformData.length > 0 && (
        <>
          <Tabs defaultValue="tiktok" className="w-full">
            <TabsList className="grid w-full grid-cols-3 max-w-md">
              {platformData.map((p) => (
                <TabsTrigger key={p.platform} value={p.platform}>
                  {p.platformLabel}
                </TabsTrigger>
              ))}
            </TabsList>
            {platformData.map((p) => (
              <TabsContent key={p.platform} value={p.platform} className="space-y-4 mt-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {p.platformLabel}
                </h2>
                <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
                  {p.trends.map((trend) => (
                    <Card
                      key={trend.id}
                      className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] overflow-hidden"
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-base text-gray-900 dark:text-white">
                            {trend.title}
                          </CardTitle>
                          <Badge variant="outline" className={LIFECYCLE_STYLES[trend.lifecycle]}>
                            {LIFECYCLE_LABELS[trend.lifecycle]}
                          </Badge>
                        </div>
                        {trend.description && (
                          <CardDescription className="text-gray-600 dark:text-gray-400 text-sm">
                            {trend.description}
                          </CardDescription>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-3 pt-0">
                        {trend.suggestedAngles.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                              <Lightbulb className="w-3.5 h-3.5" />
                              Suggested angles
                            </p>
                            <ul className="text-sm text-gray-700 dark:text-gray-300 list-disc list-inside space-y-0.5">
                              {trend.suggestedAngles.map((a, i) => (
                                <li key={i}>{a}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {trend.hashtags.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                              <Hash className="w-3.5 h-3.5" />
                              Hashtags
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {trend.hashtags.map((h, i) => (
                                <Badge key={i} variant="secondary" className="text-xs font-normal">
                                  {h}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {trend.sounds.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                              <Music2 className="w-3.5 h-3.5" />
                              Sounds / audio
                            </p>
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                              {trend.sounds.join(", ")}
                            </p>
                          </div>
                        )}
                        {trend.formats.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                              <Layout className="w-3.5 h-3.5" />
                              Formats
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {trend.formats.map((f, i) => (
                                <Badge key={i} variant="outline" className="text-xs font-normal">
                                  {f}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>

          {historical.length > 0 && (
            <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A]">
              <CardHeader>
                <CardTitle className="text-lg text-gray-900 dark:text-white flex items-center gap-2">
                  <History className="w-5 h-5 text-orange-500" />
                  What worked last year
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  Historical trend data for your niche—angles and formats that performed well previously.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-4">
                  {historical.map((h, i) => (
                    <li
                      key={i}
                      className="flex flex-col sm:flex-row sm:items-center gap-2 py-3 border-b border-border last:border-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground">{h.title}</p>
                        {h.whyItWorked && (
                          <p className="text-sm text-muted-foreground">{h.whyItWorked}</p>
                        )}
                      </div>
                      <Badge variant="outline" className="w-fit shrink-0">
                        {h.bestPlatform}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!loading && platformData.length === 0 && niche === null && (
        <Card className="border-dashed border-[#E5E7EB] dark:border-[#2A2A2A] bg-gray-50/50 dark:bg-[#0F0F0F]/50">
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            <p className="mb-2">Click “Load trends for my niche” to see platform-specific trends.</p>
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
