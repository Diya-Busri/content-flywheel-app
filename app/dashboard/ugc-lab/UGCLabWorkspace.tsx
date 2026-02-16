"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { User, LayoutTemplate, FileText, Film, Play, Loader2, Sparkles, Lock } from "lucide-react";
import { FaceProfiles, type FaceProfile } from "@/components/ugc-lab/FaceProfiles";
import { CampaignSelector } from "@/components/ugc-lab/CampaignSelector";
import { CampaignProductsManager } from "@/components/ugc-lab/CampaignProductsManager";
import { RankingConfirmStep } from "@/components/ugc-lab/RankingConfirmStep";
import { RankingFormatSelector } from "@/components/ugc-lab/RankingFormatSelector";
import { TemplateSelector } from "@/components/ugc-lab/TemplateSelector";
import { isRankingTemplate } from "@/lib/ugc/ranking-templates";
import { HookOptionsCard, type HookStyle, type HookTone } from "@/components/ugc-lab/HookOptionsCard";
import { VideoJobsGrid, type VideoJob } from "@/components/ugc-lab/VideoJobsGrid";
import { PreviewPlayer } from "@/components/ugc-lab/PreviewPlayer";
import { useToast } from "@/components/ui/use-toast";

type UGCLabWorkspaceProps = {
  isPremium?: boolean;
};

export default function UGCLabWorkspace({ isPremium = false }: UGCLabWorkspaceProps) {
  const [faceProfiles, setFaceProfiles] = useState<FaceProfile[]>([]);
  const [selectedFaceProfileId, setSelectedFaceProfileId] = useState<string | null>(null);
  const [faceValidated, setFaceValidated] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>("selfie-talk");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [campaignProductCount, setCampaignProductCount] = useState(0);
  const [campaignProducts, setCampaignProducts] = useState<
    { id: string; productName: string; role: "primary" | "comparison"; orderIndex: number }[]
  >([]);
  const [rankingConfirmed, setRankingConfirmed] = useState(false);
  const [selectedFormatId, setSelectedFormatId] = useState<string | null>(null);
  const [hookStyle, setHookStyle] = useState<HookStyle>("");
  const [hookTone, setHookTone] = useState<HookTone>("");
  const [batchId, setBatchId] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<VideoJob | null>(null);
  const [productContext, setProductContext] = useState("");
  const provider = "faceswap" as const;
  const [generateLoading, setGenerateLoading] = useState(false);
  const { toast } = useToast();

  const fetchFaceProfiles = useCallback(async () => {
    try {
      const res = await fetch("/api/ugc-lab/face-profiles");
      const data = await res.json();
      if (data.profiles) setFaceProfiles(data.profiles);
    } catch {
      setFaceProfiles([]);
    }
  }, []);

  useEffect(() => {
    fetchFaceProfiles();
  }, [fetchFaceProfiles]);

  useEffect(() => {
    if (!selectedCampaignId) {
      setCampaignProductCount(0);
      setRankingConfirmed(false);
    }
  }, [selectedCampaignId]);

  useEffect(() => {
    if (!isRankingTemplate(selectedTemplateId)) setRankingConfirmed(false);
  }, [selectedTemplateId]);

  const isRankingMode = Boolean(
    selectedCampaignId &&
    campaignProductCount >= 2 &&
    isRankingTemplate(selectedTemplateId)
  );

  const hasFaceProfile = !!selectedFaceProfileId;
  const hasProductContext = productContext.trim().length > 0;
  const hasTemplate = !!selectedTemplateId;
  const canGenerate =
    isPremium &&
    hasFaceProfile &&
    hasProductContext &&
    hasTemplate &&
    (!isRankingMode || rankingConfirmed);

  // Debug: log disabled condition
  useEffect(() => {
    if (!canGenerate && !generateLoading) {
      const blockers: string[] = [];
      if (!isPremium) blockers.push("premium_membership");
      if (!hasFaceProfile) blockers.push("face_profile_id");
      if (!hasProductContext) blockers.push("product_context");
      if (!hasTemplate) blockers.push("template");
      if (isRankingMode && !rankingConfirmed) blockers.push("ranking_confirmed");
      console.debug("[UGC Lab] Generate disabled:", { blockers, isPremium, hasFaceProfile, hasProductContext, hasTemplate, isRankingMode, rankingConfirmed });
    }
  }, [canGenerate, generateLoading, isPremium, hasFaceProfile, hasProductContext, hasTemplate, isRankingMode, rankingConfirmed]);

  const handleGenerate = async () => {
    setGenerateLoading(true);
    try {
      const res = await fetch("/api/ugc-lab/generate-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
          faceProfileId: selectedFaceProfileId ?? undefined,
          productContext: productContext.trim() || undefined,
          campaignId: selectedCampaignId ?? undefined,
          hookStyle: hookStyle || undefined,
          tone: hookTone || undefined,
          provider,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generate failed");
      setBatchId(data.batchId);
      toast({
        title: "Video rendering started",
        description: "Select the job below to preview when ready (~1–3 min).",
      });
    } catch (err) {
      toast({
        title: "Generate failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setGenerateLoading(false);
    }
  };

  return (
    <div className="h-[calc(100vh-2rem)] flex flex-col m-4 gap-0 overflow-hidden relative">
      {!isPremium && (
        <>
          <div
            className="absolute inset-0 z-10 backdrop-blur-md bg-white/60 dark:bg-slate-900/60 pointer-events-none"
            aria-hidden
          />
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <Card className="pointer-events-auto max-w-sm mx-4 shadow-xl border-2 border-orange-200 dark:border-orange-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Lock className="w-5 h-5 text-orange-500" />
                  UGC Lab – Premium Feature
                </CardTitle>
                <CardDescription>
                  Unlock advanced face swap + UGC campaign builder
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full" size="lg">
                  <Link href="/upgrade">Upgrade</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </>
      )}
      <header className="flex-shrink-0 pb-3 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
          UGC Lab
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Face Swap Video Builder · Advanced creator workspace
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
          1. Select face · 2. Add product context · 3. Generate · 4. Select job to preview video (~1–3 min)
        </p>
      </header>

      <div className="flex-1 grid grid-cols-[280px_1fr_320px] gap-4 min-h-0 pt-4">
        {/* Left Panel */}
        <aside className="flex flex-col gap-4 min-w-0 overflow-y-auto">
          <FaceProfiles
            profiles={faceProfiles}
            onRefresh={fetchFaceProfiles}
            selectedProfileId={selectedFaceProfileId}
            onSelectProfile={(id) => {
              setSelectedFaceProfileId(id);
              setFaceValidated(!!id);
            }}
          />

          <CampaignSelector
            selectedId={selectedCampaignId}
            onSelect={setSelectedCampaignId}
          />

          {selectedCampaignId && (
            <CampaignProductsManager
              campaignId={selectedCampaignId}
              onProductsChange={(products) => {
                setCampaignProductCount(products.length);
                setCampaignProducts(
                  products.map((p) => ({
                    id: p.id,
                    productName: p.productName,
                    role: p.role,
                    orderIndex: p.orderIndex,
                  }))
                );
              }}
            />
          )}

          {isRankingMode && (
            <RankingFormatSelector
              productCount={campaignProductCount}
              selectedFormatId={selectedFormatId}
              onSelect={setSelectedFormatId}
            />
          )}

          {isRankingMode && (
            <RankingConfirmStep
              campaignId={selectedCampaignId!}
              products={campaignProducts}
              productContext={productContext}
              onProductsChange={async () => {
                setRankingConfirmed(false);
                try {
                  const res = await fetch(`/api/ugc-lab/campaigns/${selectedCampaignId}`);
                  const data = await res.json();
                  if (data.products) {
                    setCampaignProducts(
                      data.products.map((p: { id: string; productName: string; role: string; orderIndex: number }) => ({
                        id: p.id,
                        productName: p.productName,
                        role: p.role as "primary" | "comparison",
                        orderIndex: p.orderIndex,
                      }))
                    );
                  }
                } catch {
                  // ignore
                }
              }}
              onRankingConfirmed={() => setRankingConfirmed(true)}
              isConfirmed={rankingConfirmed}
            />
          )}

          <Card className="flex-shrink-0">
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <LayoutTemplate className="w-4 h-4" />
                Template Selector
              </CardTitle>
              <CardDescription className="text-xs">
                Choose UGC template style
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <TemplateSelector
                selectedId={selectedTemplateId}
                onSelect={setSelectedTemplateId}
                productCount={selectedCampaignId ? campaignProductCount : 1}
              />
            </CardContent>
          </Card>
        </aside>

        {/* Middle Panel */}
        <main className="flex flex-col gap-4 min-w-0 overflow-y-auto">
          <Card className="flex-1 min-h-0 flex flex-col">
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Script Builder
              </CardTitle>
              <CardDescription className="text-xs">
                Write and edit your script
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 flex-1 min-h-0">
              <Label className="text-xs text-slate-500">Product context (required)</Label>
              <Textarea
                placeholder="Product name, description, or key selling points. Used to tailor script variations."
                value={productContext}
                onChange={(e) => setProductContext(e.target.value)}
                className="mt-1 min-h-[100px] resize-none"
              />
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4 flex-shrink-0">
            <HookOptionsCard
              hookStyle={hookStyle}
              tone={hookTone}
              onHookStyleChange={setHookStyle}
              onToneChange={setHookTone}
            />
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-medium">Generate Video</CardTitle>
                <CardDescription className="text-xs">
                  Select a face above, add product context, then Generate
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                {isRankingMode && !rankingConfirmed && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">
                    Confirm ranking in left panel to enable Generate.
                  </p>
                )}
                <Button
                  className="w-full gap-2"
                  onClick={handleGenerate}
                  disabled={generateLoading || !canGenerate}
                  title={
                    !isPremium
                      ? "Premium membership required"
                      : !hasFaceProfile
                        ? "Select a face profile"
                        : !hasProductContext
                          ? "Add product context"
                          : !hasTemplate
                            ? "Select a template"
                            : isRankingMode && !rankingConfirmed
                              ? "Confirm ranking in left panel"
                              : undefined
                  }
                >
                  {generateLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  Generate
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>

        {/* Right Panel */}
        <aside className="flex flex-col gap-4 min-w-0 overflow-y-auto">
          <VideoJobsGrid
            batchId={batchId}
            onViewAll={() => setBatchId(null)}
            onSelectJob={setSelectedJob}
            selectedJobId={selectedJob?.id ?? null}
            productContext={productContext}
          />

          <Card className="flex-shrink-0">
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Play className="w-4 h-4" />
                Preview Player
              </CardTitle>
              <CardDescription className="text-xs">
                {selectedJob ? "View full script or preview video" : "Select a job to view script"}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <PreviewPlayer job={selectedJob} />
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
