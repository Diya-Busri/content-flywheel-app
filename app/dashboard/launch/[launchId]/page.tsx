"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Sparkles, Check, Loader2, AlertCircle, ArrowRight,
  Package, Palette, Video, Megaphone, Search, ExternalLink,
  Rocket, ChevronDown,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

type StageStatus = "pending" | "running" | "complete" | "error";

type StageEvent = {
  id: string;
  message: string;
  status: "running" | "complete" | "error";
};

type StageState = {
  status: StageStatus;
  events: StageEvent[];
  link?: { href: string; label: string };
};

type ResearchReport = {
  insights?: string[];
  query?: string;
  reportSummary?: string;
  productOpportunities?: Array<{ title: string; description: string; type: string; priceRange: string }>;
  keywords?: Array<{ term: string; intent: string; opportunity: string; note: string }>;
  actionPlan?: Array<{ step: number; action: string; detail: string; cta?: string }>;
  competitorInsights?: Array<{ name: string; strength: string; gap: string }>;
  bestNextAction?: { action?: string; estimatedPrice?: string };
};

const STAGE_IDS = ["research", "product", "design", "video", "marketing"] as const;
type StageId = typeof STAGE_IDS[number];

const STAGE_META: Record<StageId, { label: string; icon: React.ReactNode; color: string }> = {
  research:  { label: "Market Research",   icon: <Search className="w-4 h-4" />,    color: "blue" },
  product:   { label: "Product Creation",  icon: <Package className="w-4 h-4" />,   color: "purple" },
  design:    { label: "Design Assets",     icon: <Palette className="w-4 h-4" />,   color: "pink" },
  video:     { label: "Video Script",      icon: <Video className="w-4 h-4" />,     color: "orange" },
  marketing: { label: "Launch Marketing",  icon: <Megaphone className="w-4 h-4" />, color: "green" },
};

const COLOR_CLASSES: Record<string, string> = {
  blue:   "bg-blue-500/10 border-blue-500/20 text-blue-500",
  purple: "bg-purple-500/10 border-purple-500/20 text-purple-500",
  pink:   "bg-pink-500/10 border-pink-500/20 text-pink-500",
  orange: "bg-orange-500/10 border-orange-500/20 text-orange-500",
  green:  "bg-green-500/10 border-green-500/20 text-green-500",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeId() { return Math.random().toString(36).slice(2); }

// ── Component ──────────────────────────────────────────────────────────────────

export default function LaunchExecutionPage() {
  const params = useParams();
  const router = useRouter();
  const launchId = typeof params.launchId === "string" ? params.launchId : "";

  const [goal, setGoal]                     = useState("");
  const [overallStatus, setOverallStatus]   = useState<"running" | "awaiting_approval" | "complete" | "failed">("running");
  const [stages, setStages]                 = useState<Record<StageId, StageState>>({
    research:  { status: "running", events: [] },
    product:   { status: "pending", events: [] },
    design:    { status: "pending", events: [] },
    video:     { status: "pending", events: [] },
    marketing: { status: "pending", events: [] },
  });

  // Final results for approval gate
  const [productId,       setProductId]       = useState<string | null>(null);
  const [productName,     setProductName]     = useState<string>("");
  const [bundleId,        setBundleId]        = useState<string | null>(null);
  const [libraryScriptId, setLibraryScriptId] = useState<string | null>(null);
  const [marketingData,   setMarketingData]   = useState<{ posts: string[]; emailSubject: string; hashtags: string[] } | null>(null);
  const [publishing,      setPublishing]      = useState(false);

  const hasRunRef = useRef(false);

  // ── Stage state helpers ──────────────────────────────────────────────────────

  const addEvent = useCallback((stageId: StageId, message: string, status: StageEvent["status"] = "complete") => {
    setStages(prev => ({
      ...prev,
      [stageId]: {
        ...prev[stageId],
        events: [...prev[stageId].events, { id: makeId(), message, status }],
      },
    }));
  }, []);

  const setStageStatus = useCallback((stageId: StageId, status: StageStatus, link?: { href: string; label: string }) => {
    setStages(prev => ({
      ...prev,
      [stageId]: { ...prev[stageId], status, ...(link ? { link } : {}) },
    }));
  }, []);

  // ── Save to DB ──────────────────────────────────────────────────────────────

  const saveProgress = useCallback(async (update: Record<string, unknown>) => {
    try {
      await fetch(`/api/launch/${launchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });
    } catch { /* non-blocking */ }
  }, [launchId]);

  // ── Stage runners ───────────────────────────────────────────────────────────

  const runResearch = useCallback(async (goalText: string): Promise<ResearchReport | null> => {
    setStageStatus("research", "running");
    addEvent("research", "Classifying your goal...", "running");

    try {
      const res = await fetch("/api/research/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: goalText, researchType: "product-ideas", mode: "stream" }),
      });

      if (!res.ok || !res.body) throw new Error("Research failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let report: ResearchReport | null = null;
      let analystsDone = 0;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const ev = JSON.parse(trimmed) as Record<string, unknown>;
            const evType = ev.type as string;

            if (evType === "intent-classified") {
              const label = String(ev.intentLabel ?? "");
              if (label) addEvent("research", `Identified: ${label}`, "complete");
            } else if (evType === "init") {
              addEvent("research", "Launching research analysts...", "complete");
            } else if (evType === "analyst-update" && ev.status === "done") {
              analystsDone++;
              const name = String(ev.displayName ?? "Analyst");
              addEvent("research", `${name} complete`, "complete");
              if (analystsDone === 1) addEvent("research", "Cross-referencing market signals...", "running");
            } else if (evType === "synthesis-start") {
              addEvent("research", "Synthesising insights...", "running");
            } else if (evType === "synthesis-done") {
              report = ev.report as ResearchReport;
              const opp = report?.bestNextAction?.action || report?.productOpportunities?.[0]?.title || "";
              if (opp) addEvent("research", `Best opportunity: ${opp}`, "complete");
              addEvent("research", "Market research complete ✓", "complete");
            }
          } catch { /* skip malformed lines */ }
        }
      }

      if (!report) throw new Error("No report received");

      setStageStatus("research", "complete");
      return report;
    } catch (err) {
      console.error("[runResearch]", err);
      addEvent("research", "Research failed — will continue with goal text", "error");
      setStageStatus("research", "error");
      // Return minimal fallback so pipeline can continue
      return { insights: [goalText], query: goalText };
    }
  }, [addEvent, setStageStatus]);

  const runProduct = useCallback(async (report: ResearchReport): Promise<{ productId: string; productName: string } | null> => {
    setStageStatus("product", "running");
    const topOpp = report.productOpportunities?.[0];
    const title = topOpp?.title || report.bestNextAction?.action || goal || "Digital Product";
    addEvent("product", `Building: "${title}"`, "running");
    addEvent("product", "Generating product structure...", "running");

    try {
      const res = await fetch("/api/products/create-from-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          niche:                report.query || goal,
          format:               "ebook",
          description:          topOpp?.description || "",
          audience:             "",
          reportSummary:        report.reportSummary || "",
          insights:             report.insights || [],
          productOpportunities: report.productOpportunities || [],
          keywords:             report.keywords || [],
          actionPlan:           report.actionPlan || [],
          competitorInsights:   report.competitorInsights || [],
        }),
      });

      if (!res.ok) throw new Error("Product creation failed");
      const data = await res.json() as { productId?: string; audience?: string };
      if (!data.productId) throw new Error("No productId returned");

      addEvent("product", "Product content written ✓", "complete");
      setStageStatus("product", "complete", {
        href: `/dashboard/digital-products/${data.productId}`,
        label: "View Product →",
      });
      return { productId: data.productId, productName: title };
    } catch (err) {
      console.error("[runProduct]", err);
      addEvent("product", "Product creation failed", "error");
      setStageStatus("product", "error");
      return null;
    }
  }, [addEvent, setStageStatus, goal]);

  const runDesign = useCallback(async (report: ResearchReport): Promise<{ bundleId: string } | null> => {
    setStageStatus("design", "running");
    addEvent("design", "Generating carousel slides...", "running");

    try {
      const res = await fetch("/api/research/create-carousel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          insights: report.insights || [],
          query:    report.query || goal,
          style:    "modern-business",
        }),
      });

      if (!res.ok) throw new Error("Carousel creation failed");
      const data = await res.json() as { bundleId?: string };
      if (!data.bundleId) throw new Error("No bundleId returned");

      addEvent("design", "5 carousel slides ready ✓", "complete");
      setStageStatus("design", "complete", {
        href: `/dashboard/design-studio/bundle/${data.bundleId}`,
        label: "Open in Design Studio →",
      });
      return { bundleId: data.bundleId };
    } catch (err) {
      console.error("[runDesign]", err);
      addEvent("design", "Design generation failed", "error");
      setStageStatus("design", "error");
      return null;
    }
  }, [addEvent, setStageStatus, goal]);

  const runVideo = useCallback(async (report: ResearchReport): Promise<{ libraryScriptId: string } | null> => {
    setStageStatus("video", "running");
    addEvent("video", "Writing TikTok/Reels script...", "running");

    try {
      const res = await fetch("/api/research/create-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          insights: report.insights || [],
          query:    report.query || goal,
        }),
      });

      if (!res.ok) throw new Error("Script creation failed");
      const data = await res.json() as { libraryScriptId?: string };
      if (!data.libraryScriptId) throw new Error("No libraryScriptId returned");

      addEvent("video", "Video script + scene brief ready ✓", "complete");
      setStageStatus("video", "complete", {
        href: `/dashboard/digital-products/video-guide?libraryScriptId=${encodeURIComponent(data.libraryScriptId)}`,
        label: "Open Video Guide →",
      });
      return { libraryScriptId: data.libraryScriptId };
    } catch (err) {
      console.error("[runVideo]", err);
      addEvent("video", "Script generation failed", "error");
      setStageStatus("video", "error");
      return null;
    }
  }, [addEvent, setStageStatus, goal]);

  const runMarketing = useCallback(async (report: ResearchReport, productNameArg: string): Promise<typeof marketingData | null> => {
    setStageStatus("marketing", "running");
    addEvent("marketing", "Writing launch captions...", "running");

    try {
      const priceRange = report.productOpportunities?.[0]?.priceRange || report.bestNextAction?.estimatedPrice || "";
      const res = await fetch("/api/launch/marketing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          insights:    report.insights || [],
          query:       report.query || goal,
          productName: productNameArg,
          priceRange,
        }),
      });

      if (!res.ok) throw new Error("Marketing generation failed");
      const data = await res.json() as { posts?: string[]; emailSubject?: string; hashtags?: string[] };

      addEvent("marketing", "3 captions + email subject + hashtags ready ✓", "complete");
      setStageStatus("marketing", "complete");
      return {
        posts:        Array.isArray(data.posts) ? data.posts : [],
        emailSubject: typeof data.emailSubject === "string" ? data.emailSubject : "",
        hashtags:     Array.isArray(data.hashtags) ? data.hashtags : [],
      };
    } catch (err) {
      console.error("[runMarketing]", err);
      addEvent("marketing", "Marketing generation failed", "error");
      setStageStatus("marketing", "error");
      return null;
    }
  }, [addEvent, setStageStatus, goal]);

  // ── Main pipeline ────────────────────────────────────────────────────────────

  const runPipeline = useCallback(async (goalText: string) => {
    // Stage 1: Research
    const report = await runResearch(goalText);
    const effectiveReport = report ?? { insights: [goalText], query: goalText };

    await saveProgress({ currentStage: "product", stageResults: { research: {
      insights: effectiveReport.insights ?? [],
      query: effectiveReport.query ?? goalText,
      reportSummary: effectiveReport.reportSummary,
      productOpportunities: effectiveReport.productOpportunities,
      keywords: effectiveReport.keywords,
      actionPlan: effectiveReport.actionPlan,
      competitorInsights: effectiveReport.competitorInsights,
    }}});

    // Stage 2: Product (parallel with Design + Video)
    const [productResult, designResult, videoResult] = await Promise.all([
      runProduct(effectiveReport),
      runDesign(effectiveReport),
      runVideo(effectiveReport),
    ]);

    const pName = productResult?.productName || "";
    if (productResult?.productId) setProductId(productResult.productId);
    if (productResult?.productName) setProductName(productResult.productName);
    if (designResult?.bundleId) setBundleId(designResult.bundleId);
    if (videoResult?.libraryScriptId) setLibraryScriptId(videoResult.libraryScriptId);

    await saveProgress({
      currentStage: "marketing",
      stageResults: {
        product:  productResult  ? { productId: productResult.productId, productName: productResult.productName } : undefined,
        design:   designResult   ? { bundleId: designResult.bundleId }   : undefined,
        video:    videoResult    ? { libraryScriptId: videoResult.libraryScriptId } : undefined,
      },
    });

    // Stage 5: Marketing
    const mktResult = await runMarketing(effectiveReport, pName);
    if (mktResult) setMarketingData(mktResult);

    await saveProgress({
      status: "awaiting_approval",
      currentStage: "complete",
      stageResults: { marketing: mktResult ?? undefined },
    });

    setOverallStatus("awaiting_approval");
  }, [runResearch, runProduct, runDesign, runVideo, runMarketing, saveProgress]);

  // ── Load project + start pipeline ────────────────────────────────────────────

  useEffect(() => {
    if (!launchId || hasRunRef.current) return;
    hasRunRef.current = true;

    fetch(`/api/launch/${launchId}`)
      .then(r => r.ok ? r.json() : null)
      .then(async (project: Record<string, unknown> | null) => {
        if (!project) { router.push("/dashboard/launch"); return; }

        const goalText = String(project.goal ?? "");
        setGoal(goalText);

        const status = String(project.status ?? "running");
        const results = (project.stageResults ?? {}) as Record<string, Record<string, string>>;

        if (status === "completed" || status === "awaiting_approval") {
          // Restore from DB
          if (results.product?.productId) setProductId(results.product.productId);
          if (results.product?.productName) setProductName(results.product.productName);
          if (results.design?.bundleId)  setBundleId(results.design.bundleId);
          if (results.video?.libraryScriptId) setLibraryScriptId(results.video.libraryScriptId);
          if (results.marketing) setMarketingData(results.marketing as typeof marketingData);

          // Show all stages as complete in UI
          setStages(prev => {
            const next = { ...prev };
            for (const id of STAGE_IDS) {
              next[id] = { ...next[id], status: results[id] ? "complete" : "pending", events: [
                { id: makeId(), message: "Completed (restored from save)", status: "complete" }
              ]};
            }
            return next;
          });
          setOverallStatus(status === "completed" ? "complete" : "awaiting_approval");
        } else {
          // Fresh run
          runPipeline(goalText);
        }
      })
      .catch(() => router.push("/dashboard/launch"));
  }, [launchId, router, runPipeline]);

  // ── Publish ──────────────────────────────────────────────────────────────────

  const handlePublish = async () => {
    setPublishing(true);
    try {
      await fetch(`/api/launch/${launchId}/publish`, { method: "POST" });
      setOverallStatus("complete");
    } catch { /* non-blocking */ } finally {
      setPublishing(false);
    }
  };

  // ── UI helpers ───────────────────────────────────────────────────────────────

  const currentStageIdx = STAGE_IDS.findIndex(id => stages[id].status === "running");
  const allComplete = STAGE_IDS.every(id => stages[id].status === "complete" || stages[id].status === "error");

  return (
    <main className="min-h-dvh bg-background">
      <div className="max-w-2xl mx-auto px-4 py-10 sm:py-14">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/50">
              AI Execution Mode
            </span>
            {overallStatus === "running" && (
              <span className="ml-auto flex items-center gap-1.5 text-[11px] font-semibold text-orange-500">
                <Loader2 className="w-3 h-3 animate-spin" />Running…
              </span>
            )}
            {(overallStatus === "awaiting_approval" || overallStatus === "complete") && (
              <span className="ml-auto flex items-center gap-1.5 text-[11px] font-semibold text-green-500">
                <Check className="w-3 h-3" />Ready
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold text-foreground leading-snug">
            {goal || "Launching…"}
          </h1>
        </div>

        {/* Pipeline */}
        <div className="space-y-3 mb-8">
          {STAGE_IDS.map((stageId, i) => {
            const stage = stages[stageId];
            const meta  = STAGE_META[stageId];
            const isActive = stage.status === "running";
            const isDone   = stage.status === "complete";
            const isError  = stage.status === "error";
            const isPending = stage.status === "pending";

            return (
              <div key={stageId} className="relative">
                {/* Connector line */}
                {i < STAGE_IDS.length - 1 && (
                  <div className="absolute left-[17px] top-full w-px h-3 bg-border z-10" />
                )}

                <div className={`rounded-2xl border bg-card transition-all overflow-hidden ${
                  isActive  ? "border-orange-500/30 shadow-sm shadow-orange-500/10" :
                  isDone    ? "border-green-500/20" :
                  isError   ? "border-red-500/20" :
                  "border-border opacity-60"
                }`}>
                  {/* Stage header */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 transition-all ${
                      isDone    ? "bg-green-500/10 border-green-500/25 text-green-500" :
                      isError   ? "bg-red-500/10 border-red-500/25 text-red-500" :
                      isActive  ? COLOR_CLASSES[meta.color] :
                      "bg-muted/30 border-border text-muted-foreground/40"
                    }`}>
                      {isDone    ? <Check className="w-4 h-4" /> :
                       isError   ? <AlertCircle className="w-4 h-4" /> :
                       isActive  ? <Loader2 className="w-4 h-4 animate-spin" /> :
                       meta.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[13px] font-semibold ${isPending ? "text-muted-foreground/50" : "text-foreground"}`}>
                        {meta.label}
                      </p>
                      {isActive && stage.events.length > 0 && (
                        <p className="text-[11px] text-muted-foreground truncate">
                          {stage.events[stage.events.length - 1]?.message}
                        </p>
                      )}
                    </div>
                    {isDone && stage.link && (
                      <a
                        href={stage.link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[11px] font-semibold text-orange-500 hover:text-orange-600 shrink-0"
                      >
                        {stage.link.label}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  {/* Events list — shown when running or complete */}
                  {(isActive || isDone || isError) && stage.events.length > 0 && (
                    <div className="px-4 pb-3 space-y-1.5">
                      {stage.events.map((ev) => (
                        <div key={ev.id} className="flex items-center gap-2">
                          {ev.status === "running"  ? <Loader2 className="w-2.5 h-2.5 animate-spin text-orange-500 shrink-0" /> :
                           ev.status === "complete" ? <Check   className="w-2.5 h-2.5 text-green-500 shrink-0" /> :
                                                      <AlertCircle className="w-2.5 h-2.5 text-red-500 shrink-0" />}
                          <p className="text-[11px] text-muted-foreground leading-tight">{ev.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Marketing preview */}
        {marketingData && marketingData.posts.length > 0 && (
          <div className="mb-8 rounded-2xl border border-green-500/20 bg-green-500/5 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-green-500/15">
              <Megaphone className="w-4 h-4 text-green-500" />
              <span className="text-[13px] font-semibold text-foreground">Launch Marketing Kit</span>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-1.5">Email Subject</p>
                <p className="text-[13px] text-foreground font-medium">{marketingData.emailSubject}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-1.5">Caption 1 (TikTok / Reels)</p>
                <p className="text-[12px] text-foreground/80 leading-relaxed">{marketingData.posts[0]}</p>
              </div>
              <div className="flex flex-wrap gap-1">
                {marketingData.hashtags.map((h, i) => (
                  <span key={i} className="text-[11px] font-medium text-green-600 dark:text-green-400 bg-green-500/10 px-2 py-0.5 rounded-md">{h}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Final gate — awaiting approval */}
        {(overallStatus === "awaiting_approval" || overallStatus === "complete") && (
          <div className={`rounded-2xl border overflow-hidden ${
            overallStatus === "complete"
              ? "border-green-500/30 bg-green-500/5"
              : "border-orange-500/30 bg-gradient-to-br from-orange-500/5 to-amber-500/5"
          }`}>
            {overallStatus === "complete" ? (
              <div className="p-6 text-center">
                <div className="w-14 h-14 rounded-2xl bg-green-500/10 border border-green-500/25 flex items-center justify-center mx-auto mb-3">
                  <Rocket className="w-7 h-7 text-green-500" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-1">You&apos;re live! 🎉</h2>
                <p className="text-[13px] text-muted-foreground mb-5">Your product has been published. Everything is ready to share.</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {productId && (
                    <a href={`/dashboard/digital-products/${productId}`} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-foreground text-background text-[13px] font-semibold hover:opacity-90 transition-all">
                      <Package className="w-3.5 h-3.5" />View Product
                    </a>
                  )}
                  {bundleId && (
                    <a href={`/dashboard/design-studio/bundle/${bundleId}`} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border bg-background text-[13px] font-medium hover:bg-accent transition-all">
                      <Palette className="w-3.5 h-3.5" />Design Studio
                    </a>
                  )}
                  {libraryScriptId && (
                    <a href={`/dashboard/digital-products/video-guide?libraryScriptId=${encodeURIComponent(libraryScriptId)}`} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border bg-background text-[13px] font-medium hover:bg-accent transition-all">
                      <Video className="w-3.5 h-3.5" />Video Script
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/25 flex items-center justify-center shrink-0">
                    <Rocket className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <h2 className="text-[16px] font-bold text-foreground">Everything&apos;s ready</h2>
                    <p className="text-[12px] text-muted-foreground">Review your assets, then publish to go live.</p>
                  </div>
                </div>

                {/* Asset summary */}
                <div className="space-y-2 mb-5">
                  {productId && (
                    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-border bg-background">
                      <Check className="w-4 h-4 text-green-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-foreground truncate">{productName || "Digital Product"}</p>
                        <p className="text-[11px] text-muted-foreground">Full product with content</p>
                      </div>
                      <a href={`/dashboard/digital-products/${productId}`} target="_blank" rel="noopener noreferrer" className="text-[11px] text-orange-500 font-semibold hover:underline shrink-0">
                        Review <ExternalLink className="w-2.5 h-2.5 inline" />
                      </a>
                    </div>
                  )}
                  {bundleId && (
                    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-border bg-background">
                      <Check className="w-4 h-4 text-green-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-foreground">Carousel Slides</p>
                        <p className="text-[11px] text-muted-foreground">5 slides ready in Design Studio</p>
                      </div>
                      <a href={`/dashboard/design-studio/bundle/${bundleId}`} target="_blank" rel="noopener noreferrer" className="text-[11px] text-orange-500 font-semibold hover:underline shrink-0">
                        Review <ExternalLink className="w-2.5 h-2.5 inline" />
                      </a>
                    </div>
                  )}
                  {libraryScriptId && (
                    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-border bg-background">
                      <Check className="w-4 h-4 text-green-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-foreground">Video Script</p>
                        <p className="text-[11px] text-muted-foreground">TikTok/Reels script + scene brief</p>
                      </div>
                      <a href={`/dashboard/digital-products/video-guide?libraryScriptId=${encodeURIComponent(libraryScriptId)}`} target="_blank" rel="noopener noreferrer" className="text-[11px] text-orange-500 font-semibold hover:underline shrink-0">
                        Review <ExternalLink className="w-2.5 h-2.5 inline" />
                      </a>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handlePublish}
                    disabled={publishing || !productId}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold text-[14px] transition-all"
                  >
                    {publishing ? (
                      <><Loader2 className="w-4 h-4 animate-spin" />Publishing…</>
                    ) : (
                      <><Rocket className="w-4 h-4" />Publish Product Now</>
                    )}
                  </button>
                  {productId && (
                    <a
                      href={`/dashboard/digital-products/${productId}`}
                      className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl border border-border bg-background text-[13px] font-medium hover:bg-accent transition-all"
                    >
                      Review First <ChevronDown className="w-3 h-3 -rotate-90" />
                    </a>
                  )}
                </div>

                <p className="text-[11px] text-muted-foreground text-center mt-3">
                  Publishing makes your product visible on your store. You can unpublish anytime.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Running state — show pipeline is active */}
        {overallStatus === "running" && !allComplete && (
          <div className="text-center py-4">
            <p className="text-[12px] text-muted-foreground">
              Your business is being built automatically. This takes about 2–4 minutes.
            </p>
          </div>
        )}

      </div>
    </main>
  );
}
