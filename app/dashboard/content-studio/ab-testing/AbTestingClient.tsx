"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ImagePlus,
  Type,
  MousePointer,
  Clock,
  Hash,
  Calculator,
  Loader2,
  Trophy,
  CheckCircle,
  Upload,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const CARD_CLASS =
  "border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A]";

const TEST_DURATION_MS = 48 * 60 * 60 * 1000; // 48 hours

type ThumbnailTest = {
  variantAUrl: string;
  variantBUrl: string;
  videoId: string;
  videoTitle: string;
  startedAt: number;
  status: "running" | "ready_to_declare" | "declared";
  result?: {
    impressionsA: number;
    clicksA: number;
    impressionsB: number;
    clicksB: number;
    winner: "A" | "B";
    confidence: number;
  };
};

const STORAGE_KEY = "content-studio-ab-thumbnail-test";

function loadThumbnailTest(): ThumbnailTest | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ThumbnailTest;
  } catch {
    return null;
  }
}

function saveThumbnailTest(t: ThumbnailTest | null) {
  if (typeof window === "undefined") return;
  if (t === null) localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
}

// Two-proportion z-test; returns { winner: 'A'|'B'|'tie', confidence: number 0-100, pValue: number }
function twoProportionZTest(
  clicksA: number,
  impressionsA: number,
  clicksB: number,
  impressionsB: number
): { winner: "A" | "B" | "tie"; confidence: number; pValue: number } {
  if (impressionsA < 1 || impressionsB < 1) {
    return { winner: "tie", confidence: 0, pValue: 1 };
  }
  const p1 = clicksA / impressionsA;
  const p2 = clicksB / impressionsB;
  const n1 = impressionsA;
  const n2 = impressionsB;
  const pooled = (clicksA + clicksB) / (n1 + n2);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2));
  if (se <= 0) return { winner: "tie", confidence: 0, pValue: 1 };
  const z = (p1 - p2) / se;
  const pValue = 2 * (1 - normalCdf(Math.abs(z)));
  const confidence = Math.max(0, Math.min(100, (1 - pValue) * 100));
  const winner = z > 0 ? "A" : z < 0 ? "B" : "tie";
  return { winner: winner as "A" | "B" | "tie", confidence, pValue };
}

// Approximate standard normal CDF (Abramowitz & Stegun)
function normalCdf(z: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429;
  const p = 0.3275911;
  const z2 = z * z;
  const t = 1 / (1 + p * Math.abs(z));
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-z2 / 2);
  const result = z >= 0 ? y : 1 - y;
  return Math.max(0, Math.min(1, result));
}

type LibraryVideo = { id: string; title: string };

export default function AbTestingClient() {
  const [thumbnailTest, setThumbnailTest] = useState<ThumbnailTest | null>(null);
  const [variantAFile, setVariantAFile] = useState<File | null>(null);
  const [variantBFile, setVariantBFile] = useState<File | null>(null);
  const [variantAPreview, setVariantAPreview] = useState<string | null>(null);
  const [variantBPreview, setVariantBPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [libraryVideos, setLibraryVideos] = useState<LibraryVideo[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState("");
  const [declareResults, setDeclareResults] = useState({
    impressionsA: 1200,
    clicksA: 84,
    impressionsB: 1180,
    clicksB: 71,
  });
  const [applying, setApplying] = useState(false);
  const [calcInputs, setCalcInputs] = useState({
    impressionsA: 1000,
    clicksA: 50,
    impressionsB: 1000,
    clicksB: 38,
  });
  const [calcResult, setCalcResult] = useState<{
    winner: "A" | "B" | "tie";
    confidence: number;
    pValue: number;
  } | null>(null);
  const { toast } = useToast();

  const loadVideos = useCallback(async () => {
    try {
      const res = await fetch("/api/library");
      const data = await res.json();
      const items = Array.isArray(data) ? data : [];
      const list = items
        .filter((v: { type?: string; id?: string }) => v?.type === "video" && v?.id)
        .map((v: { id: string; title?: string }) => ({ id: v.id, title: v.title || "Untitled" }));
      setLibraryVideos(list);
      if (list.length > 0 && !selectedVideoId) setSelectedVideoId(list[0].id);
    } catch {
      setLibraryVideos([]);
    }
  }, [selectedVideoId]);

  useEffect(() => {
    setThumbnailTest(loadThumbnailTest());
    loadVideos();
  }, []);

  useEffect(() => {
    if (!thumbnailTest) return;
    if (thumbnailTest.status === "running") {
      const elapsed = Date.now() - thumbnailTest.startedAt;
      if (elapsed >= TEST_DURATION_MS) {
        setThumbnailTest((prev) =>
          prev ? { ...prev, status: "ready_to_declare" } : null
        );
        saveThumbnailTest({ ...thumbnailTest, status: "ready_to_declare" });
      }
    }
  }, [thumbnailTest?.status, thumbnailTest?.startedAt]);

  const handleFileA = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setVariantAFile(f);
      setVariantAPreview(URL.createObjectURL(f));
    }
  };
  const handleFileB = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setVariantBFile(f);
      setVariantBPreview(URL.createObjectURL(f));
    }
  };

  const uploadFile = async (file: File): Promise<string> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/video-timeline/upload-asset", {
      method: "POST",
      body: form,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Upload failed");
    if (!data.url) throw new Error("No URL returned");
    return data.url;
  };

  const startThumbnailTest = async () => {
    if (!variantAFile || !variantBFile || !selectedVideoId) {
      toast({ title: "Upload both thumbnails and select a video.", variant: "destructive" });
      return;
    }
    const video = libraryVideos.find((v) => v.id === selectedVideoId);
    setStarting(true);
    try {
      const [urlA, urlB] = await Promise.all([
        uploadFile(variantAFile),
        uploadFile(variantBFile),
      ]);
      const test: ThumbnailTest = {
        variantAUrl: urlA,
        variantBUrl: urlB,
        videoId: selectedVideoId,
        videoTitle: video?.title ?? "Video",
        startedAt: Date.now(),
        status: "running",
      };
      setThumbnailTest(test);
      saveThumbnailTest(test);
      setVariantAFile(null);
      setVariantBFile(null);
      setVariantAPreview(null);
      setVariantBPreview(null);
      toast({ title: "A/B test started. Each variant is shown to 50% of the audience. Check back in 48 hours to declare a winner." });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Failed to start test", variant: "destructive" });
    } finally {
      setStarting(false);
    }
  };

  const declareWinner = () => {
    if (!thumbnailTest) return;
    const { impressionsA, clicksA, impressionsB, clicksB } = declareResults;
    const { winner, confidence, pValue } = twoProportionZTest(
      clicksA,
      impressionsA,
      clicksB,
      impressionsB
    );
    const result = {
      impressionsA,
      clicksA,
      impressionsB,
      clicksB,
      winner: winner === "tie" ? "A" : winner,
      confidence,
    };
    const updated: ThumbnailTest = { ...thumbnailTest, status: "declared", result };
    setThumbnailTest(updated);
    saveThumbnailTest(updated);
    toast({ title: `Winner: Variant ${result.winner} (${confidence.toFixed(1)}% confidence)` });
  };

  const applyWinner = async () => {
    if (!thumbnailTest?.result) return;
    const url =
      thumbnailTest.result.winner === "A"
        ? thumbnailTest.variantAUrl
        : thumbnailTest.variantBUrl;
    setApplying(true);
    try {
      const res = await fetch("/api/content-studio/thumbnails/attach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: thumbnailTest.videoId, imageUrl: url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Attach failed");
      toast({ title: "Winning thumbnail applied to video permanently." });
      setThumbnailTest(null);
      saveThumbnailTest(null);
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Apply failed", variant: "destructive" });
    } finally {
      setApplying(false);
    }
  };

  const runCalculator = () => {
    const { impressionsA, clicksA, impressionsB, clicksB } = calcInputs;
    setCalcResult(
      twoProportionZTest(clicksA, impressionsA, clicksB, impressionsB)
    );
  };

  const remainingMs = thumbnailTest?.status === "running"
    ? Math.max(0, thumbnailTest.startedAt + TEST_DURATION_MS - Date.now())
    : 0;
  const hoursLeft = Math.floor(remainingMs / (60 * 60 * 1000));
  const minsLeft = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));

  return (
    <Tabs defaultValue="thumbnails" className="space-y-6">
      <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1">
        <TabsTrigger value="thumbnails" className="flex items-center gap-1.5">
          <ImagePlus className="w-4 h-4" />
          Thumbnails
        </TabsTrigger>
        <TabsTrigger value="titles" className="flex items-center gap-1.5">
          <Type className="w-4 h-4" />
          Titles
        </TabsTrigger>
        <TabsTrigger value="hooks" className="flex items-center gap-1.5">
          <MousePointer className="w-4 h-4" />
          Hooks
        </TabsTrigger>
        <TabsTrigger value="times" className="flex items-center gap-1.5">
          <Clock className="w-4 h-4" />
          Posting times
        </TabsTrigger>
        <TabsTrigger value="hashtags" className="flex items-center gap-1.5">
          <Hash className="w-4 h-4" />
          Hashtags
        </TabsTrigger>
        <TabsTrigger value="calculator" className="flex items-center gap-1.5">
          <Calculator className="w-4 h-4" />
          Calculator
        </TabsTrigger>
      </TabsList>

      <TabsContent value="thumbnails" className="space-y-6">
        <Card className={CARD_CLASS}>
          <CardHeader>
            <CardTitle>Thumbnail A/B test</CardTitle>
            <CardDescription>
              Upload 2 thumbnail variations. The system shows each to 50% of the audience. After 48 hours, enter results and declare a winner with confidence %, then apply the winning thumbnail to your video.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!thumbnailTest ? (
              <>
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Variant A</Label>
                    <div className="border rounded-lg p-4 flex flex-col items-center gap-2 min-h-[140px]">
                      {variantAPreview ? (
                        <img
                          src={variantAPreview}
                          alt="Variant A"
                          className="max-h-32 w-auto object-contain rounded"
                        />
                      ) : (
                        <Upload className="w-10 h-10 text-muted-foreground" />
                      )}
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleFileA}
                        className="cursor-pointer"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Variant B</Label>
                    <div className="border rounded-lg p-4 flex flex-col items-center gap-2 min-h-[140px]">
                      {variantBPreview ? (
                        <img
                          src={variantBPreview}
                          alt="Variant B"
                          className="max-h-32 w-auto object-contain rounded"
                        />
                      ) : (
                        <Upload className="w-10 h-10 text-muted-foreground" />
                      )}
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleFileB}
                        className="cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Apply winning thumbnail to video</Label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={selectedVideoId}
                    onChange={(e) => setSelectedVideoId(e.target.value)}
                  >
                    {libraryVideos.length === 0 && (
                      <option value="">No videos in library</option>
                    )}
                    {libraryVideos.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.title}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  onClick={startThumbnailTest}
                  disabled={!variantAFile || !variantBFile || !selectedVideoId || starting}
                >
                  {starting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Starting…
                    </>
                  ) : (
                    "Start A/B test (48 hours)"
                  )}
                </Button>
                {libraryVideos.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Add videos in <Link href="/dashboard/library" className="text-orange-500 hover:underline">My Library</Link> or <Link href="/dashboard/video-timeline" className="text-orange-500 hover:underline">Video Timeline</Link> first.
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="flex flex-wrap gap-4 items-center">
                  <div className="rounded-lg border overflow-hidden max-w-[160px]">
                    <img src={thumbnailTest.variantAUrl} alt="Variant A" className="w-full h-auto" />
                    <p className="text-xs text-center py-1 bg-muted">A</p>
                  </div>
                  <div className="rounded-lg border overflow-hidden max-w-[160px]">
                    <img src={thumbnailTest.variantBUrl} alt="Variant B" className="w-full h-auto" />
                    <p className="text-xs text-center py-1 bg-muted">B</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Video: <strong>{thumbnailTest.videoTitle}</strong>
                  </p>
                </div>

                {thumbnailTest.status === "running" && (
                  <p className="text-sm font-medium text-orange-600 dark:text-orange-400">
                    Test running. Time remaining: {hoursLeft}h {minsLeft}m
                  </p>
                )}

                {(thumbnailTest.status === "ready_to_declare" ||
                  thumbnailTest.status === "declared") && (
                  <div className="space-y-4">
                    <Label>Enter results (impressions & clicks per variant)</Label>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-xs">Variant A: impressions / clicks</Label>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            min={0}
                            value={declareResults.impressionsA}
                            onChange={(e) =>
                              setDeclareResults((r) => ({
                                ...r,
                                impressionsA: parseInt(e.target.value, 10) || 0,
                              }))
                            }
                          />
                          <Input
                            type="number"
                            min={0}
                            value={declareResults.clicksA}
                            onChange={(e) =>
                              setDeclareResults((r) => ({
                                ...r,
                                clicksA: parseInt(e.target.value, 10) || 0,
                              }))
                            }
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Variant B: impressions / clicks</Label>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            min={0}
                            value={declareResults.impressionsB}
                            onChange={(e) =>
                              setDeclareResults((r) => ({
                                ...r,
                                impressionsB: parseInt(e.target.value, 10) || 0,
                              }))
                            }
                          />
                          <Input
                            type="number"
                            min={0}
                            value={declareResults.clicksB}
                            onChange={(e) =>
                              setDeclareResults((r) => ({
                                ...r,
                                clicksB: parseInt(e.target.value, 10) || 0,
                              }))
                            }
                          />
                        </div>
                      </div>
                    </div>
                    {thumbnailTest.status === "ready_to_declare" && (
                      <Button onClick={declareWinner}>Declare winner</Button>
                    )}
                  </div>
                )}

                {thumbnailTest.status === "declared" && thumbnailTest.result && (
                  <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                    <div className="flex items-center gap-2 font-medium">
                      <Trophy className="w-5 h-5 text-orange-500" />
                      Winner: Variant {thumbnailTest.result.winner} —{" "}
                      {thumbnailTest.result.confidence.toFixed(1)}% confidence
                    </div>
                    <p className="text-sm text-muted-foreground">
                      CTR A: {((thumbnailTest.result.clicksA / thumbnailTest.result.impressionsA) * 100).toFixed(2)}% · 
                      CTR B: {((thumbnailTest.result.clicksB / thumbnailTest.result.impressionsB) * 100).toFixed(2)}%
                    </p>
                    <Button onClick={applyWinner} disabled={applying}>
                      {applying ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Applying…
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Apply winning thumbnail to video permanently
                        </>
                      )}
                    </Button>
                  </div>
                )}

                <Button
                  variant="outline"
                  onClick={() => {
                    setThumbnailTest(null);
                    saveThumbnailTest(null);
                  }}
                >
                  Clear test
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="titles">
        <Card className={CARD_CLASS}>
          <CardHeader>
            <CardTitle>Title A/B test (CTR)</CardTitle>
            <CardDescription>
              Test two titles; which had higher CTR. Enter impressions and clicks for each after your test period.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Use the <strong>Statistical significance calculator</strong> tab: enter Title A impressions/clicks and Title B impressions/clicks, then get the winner with confidence %.
            </p>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="hooks">
        <Card className={CARD_CLASS}>
          <CardHeader>
            <CardTitle>Hook A/B test (first 3s retention)</CardTitle>
            <CardDescription>
              Test two opening hooks; which kept more viewers past the first 3 seconds. Compare retention metrics.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Run two versions and compare &quot;retention at 3s&quot; (or drop-off rate). Use the calculator tab with Variant A = hook A retained views, Variant B = hook B retained views.
            </p>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="times">
        <Card className={CARD_CLASS}>
          <CardHeader>
            <CardTitle>Posting time A/B test</CardTitle>
            <CardDescription>
              Test different posting times (e.g. 6pm vs 9am). Compare views or engagement after the same window.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Post the same content at different times on different days, then compare total views or engagement. Use the calculator to check if the difference is statistically significant.
            </p>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="hashtags">
        <Card className={CARD_CLASS}>
          <CardHeader>
            <CardTitle>Hashtag combination A/B test</CardTitle>
            <CardDescription>
              Test two hashtag sets on similar posts. Compare reach or engagement.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Use two hashtag combinations on similar content, then enter impressions and clicks (or engagement) in the calculator to see which set performed better with confidence %.
            </p>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="calculator" className="space-y-6">
        <Card className={CARD_CLASS}>
          <CardHeader>
            <CardTitle>Statistical significance calculator</CardTitle>
            <CardDescription>
              Two-proportion z-test. Enter impressions and clicks (or other binary metric) for Variant A and B. Get winner and confidence %.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Variant A: impressions / clicks</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={0}
                    value={calcInputs.impressionsA}
                    onChange={(e) =>
                      setCalcInputs((c) => ({
                        ...c,
                        impressionsA: parseInt(e.target.value, 10) || 0,
                      }))
                    }
                  />
                  <Input
                    type="number"
                    min={0}
                    value={calcInputs.clicksA}
                    onChange={(e) =>
                      setCalcInputs((c) => ({
                        ...c,
                        clicksA: parseInt(e.target.value, 10) || 0,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Variant B: impressions / clicks</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={0}
                    value={calcInputs.impressionsB}
                    onChange={(e) =>
                      setCalcInputs((c) => ({
                        ...c,
                        impressionsB: parseInt(e.target.value, 10) || 0,
                      }))
                    }
                  />
                  <Input
                    type="number"
                    min={0}
                    value={calcInputs.clicksB}
                    onChange={(e) =>
                      setCalcInputs((c) => ({
                        ...c,
                        clicksB: parseInt(e.target.value, 10) || 0,
                      }))
                    }
                  />
                </div>
              </div>
            </div>
            <Button onClick={runCalculator}>Calculate</Button>
            {calcResult && (
              <div className="rounded-lg border bg-muted/50 p-4 space-y-1">
                <p className="font-medium">
                  Winner: Variant {calcResult.winner === "tie" ? "— tie" : calcResult.winner}
                </p>
                <p className="text-sm text-muted-foreground">
                  Confidence: {calcResult.confidence.toFixed(1)}% · p-value: {calcResult.pValue.toFixed(4)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
