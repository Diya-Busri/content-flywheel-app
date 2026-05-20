"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Package, Sparkles, ArrowRight, ChevronRight, Home, X, BookOpen, Layers, Loader2, CheckCircle2, XCircle, Package2, ExternalLink, Upload, PenLine } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const SELLING_GUIDE_BANNER_KEY = "digital-products-selling-guide-banner-dismissed";

const BUNDLE_POLL_INTERVAL_MS = 2500;
const BUNDLE_POLL_TIMEOUT_MS = 20 * 60 * 1000; // 20 min per product

type BundleItemStatus = "pending" | "generating" | "done" | "failed";

const AUTO_RETRY_DELAY_MS = 3000;

type BundleItem = {
  productId: string;
  format: string;
  label: string;
  status: BundleItemStatus;
  subFocus?: string;
};

async function pollProductUntilDone(
  productId: string,
  timeoutMs: number
): Promise<"done" | "failed"> {
  const start = Date.now();
  const fetchStatus = async (): Promise<{ isCompleted: boolean; isFailed: boolean }> => {
    const res = await fetch(`/api/products/${productId}`);
    if (!res.ok) return { isCompleted: false, isFailed: res.status >= 400 };
    const data = await res.json().catch(() => ({}));
    const status = data?.status;
    const sections = data?.content?.sections ?? [];
    const hasContent = sections.length > 0 && sections.every((s: { content?: string; contentHtml?: string }) => ((s?.content ?? s?.contentHtml ?? "").trim().length > 0));
    const isCompleted = status === "draft" && hasContent;
    const isFailed = status === "failed";
    return { isCompleted, isFailed };
  };
  while (Date.now() - start < timeoutMs) {
    const { isCompleted, isFailed } = await fetchStatus();
    if (isFailed) return "failed";
    if (isCompleted) return "done";
    await new Promise((r) => setTimeout(r, BUNDLE_POLL_INTERVAL_MS));
  }
  const last = await fetchStatus();
  return last.isCompleted ? "done" : "failed";
}

/** Poll until done/failed; if failed, auto-retry once after 3s then poll again. */
async function pollWithAutoRetry(
  productId: string,
  timeoutMs: number,
  retryBody: { niche: string; productName: string; format: string; subFocus?: string }
): Promise<"done" | "failed"> {
  let result = await pollProductUntilDone(productId, timeoutMs);
  if (result === "failed") {
    await new Promise((r) => setTimeout(r, AUTO_RETRY_DELAY_MS));
    const retryRes = await fetch(`/api/products/${productId}/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        retry: true,
        niche: retryBody.niche,
        productName: retryBody.productName,
        format: retryBody.format,
        subFocus: retryBody.subFocus ?? undefined,
      }),
    });
    if (retryRes.ok) result = await pollProductUntilDone(productId, timeoutMs);
  }
  return result;
}


export default function DigitalProductsLanding() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [bundleOpen, setBundleOpen] = useState(false);
  const [topicInput, setTopicInput] = useState("");
  const [bundleItems, setBundleItems] = useState<BundleItem[]>([]);
  const [bundleNiche, setBundleNiche] = useState("");
  const [bundleGenerating, setBundleGenerating] = useState(false);
  const [bundleComplete, setBundleComplete] = useState(false);
  const [bundleError, setBundleError] = useState<string | null>(null);
  const { toast } = useToast();

  // Background generation banner — polls the product until done, then shows a "ready" banner.
  const [bgGeneratingId, setBgGeneratingId] = useState<string | null>(null);
  const [bgGeneratingDone, setBgGeneratingDone] = useState(false);
  const [bgGeneratingFailed, setBgGeneratingFailed] = useState(false);
  const [bgSectionsDone, setBgSectionsDone] = useState(0);
  const [bgSectionsTotal, setBgSectionsTotal] = useState(0);
  const [blankOpen, setBlankOpen] = useState(false);
  const [blankTitle, setBlankTitle] = useState("");
  const [blankPageCount, setBlankPageCount] = useState("5");
  const [blankCreating, setBlankCreating] = useState(false);
  const bgProductIdRef = useRef<string | null>(null);
  const bgIntentRef = useRef<string | null>(null);
  const bgContentStyleRef = useRef<string | null>(null);

  useEffect(() => {
    const id = searchParams.get("generatingId");
    if (!id) return;
    bgProductIdRef.current = id;
    bgIntentRef.current = searchParams.get("intent");
    bgContentStyleRef.current = searchParams.get("contentStyle");
    setBgGeneratingId(id);
    setBgGeneratingDone(false);
    setBgGeneratingFailed(false);
    // Remove query params from URL so a reload doesn't restart polling
    router.replace("/dashboard/digital-products");

    let cancelled = false;
    const INTERVAL = 3000;
    const poll = async () => {
      while (!cancelled) {
        try {
          const res = await fetch(`/api/products/${id}`);
          if (!res.ok) { await new Promise(r => setTimeout(r, INTERVAL)); continue; }
          const data = await res.json().catch(() => ({}));
          const status = data?.status;
          const sections: Array<{ content?: string; contentHtml?: string }> = data?.content?.sections ?? [];
          const doneSections = sections.filter(s => ((s?.content ?? s?.contentHtml ?? "").trim().length > 0)).length;
          const hasContent = sections.length > 0 && doneSections === sections.length;
          if (!cancelled && sections.length > 0) {
            setBgSectionsTotal(sections.length);
            setBgSectionsDone(doneSections);
          }
          if (status === "failed") { if (!cancelled) { setBgGeneratingFailed(true); setBgGeneratingId(null); } return; }
          if (status === "draft" && hasContent) {
            if (!cancelled) { setBgGeneratingDone(true); setBgGeneratingId(null); }
            return;
          }
        } catch { /* transient error, keep polling */ }
        await new Promise(r => setTimeout(r, INTERVAL));
      }
    };
    poll();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // only on mount — searchParams is stable from the initial URL

  useEffect(() => {
    try {
      if (localStorage.getItem(SELLING_GUIDE_BANNER_KEY) === "1") setBannerDismissed(true);
    } catch {}
  }, []);

  const dismissBanner = () => {
    try {
      localStorage.setItem(SELLING_GUIDE_BANNER_KEY, "1");
      setBannerDismissed(true);
    } catch {}
  };

  const startBundle = async () => {
    const topic = topicInput.trim();
    if (!topic) {
      toast({ title: "Enter a topic", description: "Type your niche or topic to generate the bundle.", variant: "destructive" });
      return;
    }
    setBundleError(null);
    setBundleGenerating(true);
    try {
      const res = await fetch("/api/products/bundle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche: topic }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to start bundle");
      }
      // Close modal immediately — generation continues in the background.
      // The BundleProgressBanner in the layout will poll and show live status.
      closeBundleDialog();
      toast({
        title: "Generating in background ✨",
        description: `Your ${topic} bundle is being created — you'll see live progress in the banner above. We'll email you when it's ready.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to generate bundle";
      setBundleError(msg);
      toast({ title: "Bundle failed", description: msg, variant: "destructive" });
    } finally {
      setBundleGenerating(false);
    }
  };

  const handleRetryBundleItem = async (item: BundleItem) => {
    setBundleItems((prev) => prev.map((i) => (i.productId === item.productId ? { ...i, status: "generating" as BundleItemStatus } : i)));
    try {
      const res = await fetch(`/api/products/${item.productId}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          retry: true,
          niche: bundleNiche,
          productName: item.label,
          format: item.format,
          subFocus: item.subFocus ?? undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Retry failed");
      }
      const result = await pollProductUntilDone(item.productId, BUNDLE_POLL_TIMEOUT_MS);
      setBundleItems((prev) => prev.map((i) => (i.productId === item.productId ? { ...i, status: result } : i)));
      if (result === "done") toast({ title: "Done", description: `${item.label} generated successfully.` });
      else toast({ title: "Retry failed", description: `${item.label} failed again. Try again later.`, variant: "destructive" });
    } catch (err) {
      setBundleItems((prev) => prev.map((i) => (i.productId === item.productId ? { ...i, status: "failed" as BundleItemStatus } : i)));
      toast({ title: "Retry failed", description: err instanceof Error ? err.message : "Could not retry.", variant: "destructive" });
    }
  };

  const handleCreateBlank = async () => {
    if (!blankTitle.trim()) return;
    setBlankCreating(true);
    try {
      const res = await fetch("/api/products/create-blank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: blankTitle.trim(), pageCount: parseInt(blankPageCount) || 5 }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.productId) {
        router.push(`/dashboard/digital-products/${data.productId}/edit?ai=1`);
      }
    } catch {
      // ignore
    }
    setBlankCreating(false);
  };

  const closeBundleDialog = () => {
    setBundleOpen(false);
    setTopicInput("");
    setBundleItems([]);
    setBundleNiche("");
    setBundleComplete(false);
    setBundleError(null);
  };

  return (
    <main className="min-h-screen p-5 md:p-10">
      <div className="max-w-4xl mx-auto">
        {/* Background generation banner */}
        {(bgGeneratingId || bgGeneratingDone || bgGeneratingFailed) && (
          <div className={`mb-4 rounded-xl border px-4 py-3 ${bgGeneratingFailed ? "border-red-400/40 bg-red-500/10" : bgGeneratingDone ? "border-green-500/40 bg-green-500/10" : "border-orange-500/40 bg-orange-500/10"}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {bgGeneratingId && <Loader2 className="w-4 h-4 animate-spin text-orange-500 shrink-0" />}
                {bgGeneratingDone && <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />}
                {bgGeneratingFailed && <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
                <span className="text-sm font-medium truncate">
                  {bgGeneratingId && (bgSectionsTotal > 0
                    ? `Generating — ${bgSectionsDone} of ${bgSectionsTotal} sections done`
                    : "Your product is generating in the background…")}
                  {bgGeneratingDone && "Your product is ready!"}
                  {bgGeneratingFailed && "Generation failed. Open the product to retry."}
                </span>
                {bgGeneratingId && bgSectionsTotal > 0 && (
                  <span className="text-xs font-semibold text-orange-400 shrink-0">
                    {Math.round((bgSectionsDone / bgSectionsTotal) * 100)}%
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {bgGeneratingDone && bgProductIdRef.current && (
                  <Button
                    size="sm"
                    className="bg-orange-500 hover:bg-orange-600 text-white h-8 text-xs px-3"
                    onClick={() => {
                      setBgGeneratingDone(false);
                      const id = bgProductIdRef.current!;
                      if (bgIntentRef.current === "video-guide") {
                        router.push(`/dashboard/digital-products/scripts?productId=${encodeURIComponent(id)}&intent=video-guide${bgContentStyleRef.current ? `&contentStyle=${encodeURIComponent(bgContentStyleRef.current)}` : ""}`);
                      } else {
                        router.push(`/dashboard/digital-products/${id}/edit?created=1`);
                      }
                    }}
                  >
                    Open Product →
                  </Button>
                )}
                <button
                  type="button"
                  onClick={() => { setBgGeneratingId(null); setBgGeneratingDone(false); setBgGeneratingFailed(false); }}
                  className="p-1 rounded text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                  aria-label="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            {bgGeneratingId && bgSectionsTotal > 0 && (
              <div className="mt-2.5">
                <div className="w-full h-1.5 rounded-full bg-orange-500/20 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-orange-500 transition-all duration-500"
                    style={{ width: `${Math.round((bgSectionsDone / bgSectionsTotal) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Selling guide banner */}
        {!bannerDismissed && (
          <div className="mb-6 rounded-xl border border-orange-500/30 bg-orange-500/8 px-4 py-3 flex items-center justify-between gap-4">
            <Link
              href="/dashboard/digital-products/selling-guide"
              className="flex items-center gap-2 text-amber-700 dark:text-amber-300 hover:text-orange-600 dark:hover:text-orange-400 transition-colors flex-1 min-w-0"
            >
              <BookOpen className="w-4 h-4 shrink-0" />
              <span className="text-sm font-medium">New to selling? Read the Selling Platforms Guide →</span>
            </Link>
            <button
              type="button"
              onClick={dismissBanner}
              className="p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors shrink-0"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Header */}
        <nav className="flex items-center gap-2 text-sm text-gray-400 dark:text-[#A0A0A0] mb-6">
          <Link href="/dashboard" className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-white transition-colors">
            <Home className="w-3.5 h-3.5" />
            Dashboard
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-gray-300 dark:text-[#555]" />
          <span className="text-gray-700 dark:text-white">Digital Products</span>
        </nav>

        <div className="mb-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-1">
                Digital Products
              </h1>
              <p className="text-gray-500 dark:text-[#A0A0A0] text-sm">
                Choose how you&apos;d like to get started
              </p>
            </div>
            <Link
              href="/dashboard/library?tab=products"
              className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-orange-500 dark:hover:text-orange-400 font-medium transition-colors shrink-0 mt-1"
            >
              <ExternalLink className="w-3 h-3" />
              My Products
            </Link>
          </div>
        </div>

        {/* ── Start creating ── */}
        <div className="mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* I Know What I Want */}
            <Link
              href="/dashboard/digital-products/create"
              className="group flex flex-col gap-4 rounded-2xl border border-[#E5E7EB] dark:border-[#232323] bg-white dark:bg-[#161616] p-6 hover:border-orange-400/50 dark:hover:border-orange-500/30 hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/20 transition-all duration-200"
            >
              <div className="flex items-start justify-between">
                <div className="w-11 h-11 rounded-xl bg-orange-500/10 flex items-center justify-center">
                  <Package className="w-5 h-5 text-orange-500" />
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white mb-1">I Know What I Want</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                  You have an idea and audience in mind. AI generates your product in minutes.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {["Has an idea", "Knows their niche"].map((tag) => (
                  <span key={tag} className="text-[11px] font-medium bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 px-2.5 py-1 rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            </Link>

            {/* Help Me Discover */}
            <Link
              href="/dashboard/digital-products/discover"
              className="group flex flex-col gap-4 rounded-2xl border border-[#E5E7EB] dark:border-[#232323] bg-white dark:bg-[#161616] p-6 hover:border-orange-400/50 dark:hover:border-orange-500/30 hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/20 transition-all duration-200"
            >
              <div className="flex items-start justify-between">
                <div className="w-11 h-11 rounded-xl bg-orange-500/10 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-orange-500" />
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white mb-1">Help Me Discover</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                  Not sure what to create yet. AI guides you through finding a profitable niche and product.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {["New to products", "Exploring ideas"].map((tag) => (
                  <span key={tag} className="text-[11px] font-medium bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 px-2.5 py-1 rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            </Link>

            {/* Upload Existing */}
            <Link
              href="/dashboard/digital-products/upload"
              className="group flex flex-col gap-4 rounded-2xl border border-[#E5E7EB] dark:border-[#232323] bg-white dark:bg-[#161616] p-6 hover:border-orange-400/50 dark:hover:border-orange-500/30 hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/20 transition-all duration-200"
            >
              <div className="flex items-start justify-between">
                <div className="w-11 h-11 rounded-xl bg-orange-500/10 flex items-center justify-center">
                  <Upload className="w-5 h-5 text-orange-500" />
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white mb-1">Upload Existing</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                  Already made something in Canva or Notion? Upload your PDF or file and start selling.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {["Has a file ready", "PDF / Canva / Notion"].map((tag) => (
                  <span key={tag} className="text-[11px] font-medium bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 px-2.5 py-1 rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            </Link>

            {/* Start from Scratch */}
            <button
              type="button"
              onClick={() => setBlankOpen(true)}
              className="group flex flex-col gap-4 rounded-2xl border border-[#E5E7EB] dark:border-[#232323] bg-white dark:bg-[#161616] p-6 hover:border-orange-400/50 dark:hover:border-orange-500/30 hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/20 transition-all duration-200 text-left"
            >
              <div className="flex items-start justify-between">
                <div className="w-11 h-11 rounded-xl bg-orange-500/10 flex items-center justify-center">
                  <PenLine className="w-5 h-5 text-orange-500" />
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white mb-1">Start from Scratch</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                  Open a blank canvas and build with AI assistance. Great for colouring books, journals, and custom designs.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {["Full creative control", "AI-assisted"].map((tag) => (
                  <span key={tag} className="text-[11px] font-medium bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 px-2.5 py-1 rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            </button>
          </div>
        </div>

        {/* Advanced actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-6 border-t border-[#E5E7EB] dark:border-[#1E1E1E]">
          <button
            type="button"
            onClick={() => setBundleOpen(true)}
            className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-[#E5E7EB] dark:border-[#232323] bg-white dark:bg-[#161616] text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-orange-400/50 hover:text-orange-600 dark:hover:text-orange-400 transition-all"
          >
            <Layers className="w-4 h-4 text-orange-500 shrink-0" />
            <span>Generate Full Bundle</span>
            <span className="text-xs text-gray-400 ml-auto">One topic → 8 formats</span>
          </button>
          <Link
            href="/dashboard/digital-products/bundle"
            className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-[#E5E7EB] dark:border-[#232323] bg-white dark:bg-[#161616] text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-orange-400/50 hover:text-orange-600 dark:hover:text-orange-400 transition-all"
          >
            <Package2 className="w-4 h-4 text-orange-500 shrink-0" />
            <span>Bundle Creator</span>
            <span className="text-xs text-gray-400 ml-auto">Package + pricing</span>
          </Link>
        </div>
      </div>

      {/* Start from Scratch dialog */}
      <Dialog open={blankOpen} onOpenChange={(open) => { setBlankOpen(open); if (!open) { setBlankTitle(""); setBlankPageCount("5"); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Start from Scratch</DialogTitle>
            <DialogDescription>Give your product a name and choose how many blank pages to start with. Your AI assistant will help you fill it in.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="blank-title">Product name</Label>
              <Input
                id="blank-title"
                placeholder="e.g. Kids Colouring Book"
                value={blankTitle}
                onChange={(e) => setBlankTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateBlank()}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="blank-pages">Number of pages</Label>
              <Input
                id="blank-pages"
                type="number"
                min={1}
                max={50}
                value={blankPageCount}
                onChange={(e) => setBlankPageCount(e.target.value)}
              />
              <p className="text-xs text-gray-500">You can add or remove pages later.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlankOpen(false)}>Cancel</Button>
            <Button
              className="bg-orange-500 hover:bg-orange-600 text-white"
              onClick={handleCreateBlank}
              disabled={!blankTitle.trim() || blankCreating}
            >
              {blankCreating ? <><Loader2 className="w-4 h-4 animate-spin mr-1.5" /> Creating…</> : "Create Product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Full Bundle dialog */}
      <Dialog open={bundleOpen} onOpenChange={(open) => !open && closeBundleDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-orange-500" />
              Generate Full Bundle
            </DialogTitle>
            <DialogDescription>
              {bundleItems.length === 0
                ? "Enter your niche or topic. We'll create all 8 product formats for the same topic."
                : bundleComplete
                  ? bundleItems.some((i) => i.status === "failed")
                    ? "Partially complete. Retry failed formats below or view the rest in My Library."
                    : "All products are ready. They appear in My Library as a bundle."
                  : "Generating each format. This may take several minutes."}
            </DialogDescription>
          </DialogHeader>

          {bundleError && (
            <div className="flex items-center gap-2 rounded-md bg-red-500/10 text-red-600 dark:text-red-400 px-3 py-2 text-sm">
              <XCircle className="w-4 h-4 shrink-0" />
              {bundleError}
            </div>
          )}

          {bundleItems.length === 0 ? (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="bundle-topic">Your topic / niche</Label>
                <Input
                  id="bundle-topic"
                  placeholder="e.g. Budget planning for new parents"
                  value={topicInput}
                  onChange={(e) => setTopicInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && startBundle()}
                  disabled={bundleGenerating}
                  className="bg-white dark:bg-[#1A1A1A]"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeBundleDialog} disabled={bundleGenerating}>
                  Cancel
                </Button>
                <Button
                  onClick={startBundle}
                  disabled={bundleGenerating || !topicInput.trim()}
                  className="bg-orange-500 hover:bg-orange-600"
                >
                  {bundleGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Starting…
                    </>
                  ) : (
                    "Start generating"
                  )}
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

    </main>
  );
}
