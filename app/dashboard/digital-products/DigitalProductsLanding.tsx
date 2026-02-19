"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Package, Sparkles, Check, ArrowRight, ChevronRight, Home, X, BookOpen, Layers, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const CARD_CLASS =
  "border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-500/5 transition-all duration-200 hover:scale-[1.01] overflow-hidden";

const SELLING_GUIDE_BANNER_KEY = "digital-products-selling-guide-banner-dismissed";

const BUNDLE_POLL_INTERVAL_MS = 2500;
const BUNDLE_POLL_TIMEOUT_MS = 20 * 60 * 1000; // 20 min per product

type BundleItemStatus = "pending" | "generating" | "done" | "failed";

type BundleItem = {
  productId: string;
  format: string;
  label: string;
  status: BundleItemStatus;
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

export default function DigitalProductsLanding() {
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [bundleOpen, setBundleOpen] = useState(false);
  const [topicInput, setTopicInput] = useState("");
  const [bundleItems, setBundleItems] = useState<BundleItem[]>([]);
  const [bundleGenerating, setBundleGenerating] = useState(false);
  const [bundleComplete, setBundleComplete] = useState(false);
  const [bundleError, setBundleError] = useState<string | null>(null);
  const { toast } = useToast();

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
      const items = (data.items ?? []).map((item: { productId: string; format: string; label: string }) => ({
        ...item,
        status: "generating" as BundleItemStatus,
      }));
      setBundleItems(items);
      const updateItem = (productId: string, status: BundleItemStatus) => {
        setBundleItems((prev) => prev.map((i) => (i.productId === productId ? { ...i, status } : i)));
      };
      await Promise.all(
        items.map(async (item: BundleItem) => {
          const result = await pollProductUntilDone(item.productId, BUNDLE_POLL_TIMEOUT_MS);
          updateItem(item.productId, result);
        })
      );
      setBundleComplete(true);
      toast({ title: "Bundle complete", description: "All 8 products are in My Library." });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to generate bundle";
      setBundleError(msg);
      toast({ title: "Bundle failed", description: msg, variant: "destructive" });
    } finally {
      setBundleGenerating(false);
    }
  };

  const closeBundleDialog = () => {
    setBundleOpen(false);
    setTopicInput("");
    setBundleItems([]);
    setBundleComplete(false);
    setBundleError(null);
  };

  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="max-w-5xl mx-auto">
        {/* Dismissable banner for new users */}
        {!bannerDismissed && (
          <div className="mb-6 rounded-lg border border-orange-500/40 bg-orange-500/10 px-4 py-3 flex items-center justify-between gap-4">
            <Link
              href="/dashboard/digital-products/selling-guide"
              className="flex items-center gap-2 text-amber-700 dark:text-amber-200 hover:text-orange-600 dark:hover:text-orange-400 transition-colors flex-1 min-w-0"
            >
              <BookOpen className="w-5 h-5 shrink-0" />
              <span className="text-sm font-medium">
                New to selling? Check our Selling Platforms Guide →
              </span>
            </Link>
            <button
              type="button"
              onClick={dismissBanner}
              className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0"
              aria-label="Dismiss banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Breadcrumb nav so main app navigation is visible */}
        <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-[#A0A0A0] mb-8">
          <Link href="/dashboard" className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-white transition-colors">
            <Home className="w-4 h-4" />
            Dashboard
          </Link>
          <ChevronRight className="w-4 h-4 text-gray-400 dark:text-[#666]" />
          <span className="text-gray-900 dark:text-white">Digital Products</span>
        </nav>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">
          Create Your Digital Product
        </h1>
        <p className="text-gray-600 dark:text-[#A0A0A0] text-base md:text-lg mb-12">
          Choose how you&apos;d like to get started
        </p>

        <div className="grid md:grid-cols-2 gap-6 items-stretch">
          {/* LEFT CARD */}
          <Card className={CARD_CLASS}>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2 text-orange-500 mb-3">
                <Package className="w-7 h-7" />
                <CardTitle className="text-xl text-gray-900 dark:text-white">I Know What I Want</CardTitle>
              </div>
              <p className="text-sm text-gray-600 dark:text-[#A0A0A0]">Perfect if you:</p>
            </CardHeader>
            <CardContent className="flex flex-col flex-1 space-y-6">
              <ul className="space-y-2 text-sm text-gray-700 dark:text-[#E0E0E0]">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500 shrink-0" />
                  Already have a product idea
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500 shrink-0" />
                  Know your target audience
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500 shrink-0" />
                  Understand your niche
                </li>
              </ul>
              <div>
                <p className="text-sm text-gray-600 dark:text-[#A0A0A0] mb-2">What you&apos;ll do:</p>
                <ul className="text-sm text-gray-700 dark:text-[#E0E0E0] space-y-1">
                  <li>→ Enter your product details</li>
                  <li>→ Customize AI-generated scripts</li>
                  <li>→ Get a Video Creation Guide in minutes</li>
                </ul>
              </div>
              <p className="text-xs text-gray-500 dark:text-[#A0A0A0]">Time: ~10 minutes</p>
              <Button
                asChild
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold h-12 text-base gap-2 mt-auto"
              >
                <Link href="/dashboard/digital-products/create">
                  Start Creating
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* RIGHT CARD */}
          <Card className={CARD_CLASS}>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2 text-orange-500 mb-3">
                <Sparkles className="w-7 h-7" />
                <CardTitle className="text-xl text-gray-900 dark:text-white">Help Me Discover</CardTitle>
              </div>
              <p className="text-sm text-gray-600 dark:text-[#A0A0A0]">Perfect if you:</p>
            </CardHeader>
            <CardContent className="flex flex-col flex-1 space-y-6">
              <ul className="space-y-2 text-sm text-gray-700 dark:text-[#E0E0E0]">
                <li>• Don&apos;t have a product idea yet</li>
                <li>• Unsure what niche to target</li>
                <li>• New to digital products</li>
                <li>• Want guidance on content strategy</li>
              </ul>
              <div>
                <p className="text-sm text-gray-600 dark:text-[#A0A0A0] mb-2">What you&apos;ll do:</p>
                <ul className="text-sm text-gray-700 dark:text-[#E0E0E0] space-y-1">
                  <li>→ Discover profitable niches</li>
                  <li>→ Get AI product recommendations</li>
                  <li>→ Learn hooks, CTAs, and strategy</li>
                  <li>→ Create product with guidance</li>
                </ul>
              </div>
              <p className="text-xs text-gray-500 dark:text-[#A0A0A0]">Time: ~20 minutes</p>
              <Button
                asChild
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold h-12 text-base gap-2 mt-auto"
              >
                <Link href="/dashboard/digital-products/discover">
                  Start Discovery
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Generate Full Bundle */}
        <div className="mt-8 flex flex-col items-center">
          <Button
            type="button"
            variant="outline"
            className="border-orange-500/50 text-orange-600 dark:text-orange-400 hover:bg-orange-500/10 hover:border-orange-500 gap-2 h-12 px-6"
            onClick={() => setBundleOpen(true)}
          >
            <Layers className="w-5 h-5" />
            Generate Full Bundle
          </Button>
          <p className="mt-2 text-sm text-gray-500 dark:text-[#A0A0A0]">
            One topic → all 8 formats (Ebook, Workbook, Planner, Journal, Checklist, Course, Notion, Spreadsheet)
          </p>
        </div>

        <p className="mt-8 text-center text-sm text-gray-500">
          Don&apos;t have a store yet?{" "}
          <Link
            href="/dashboard/digital-products/selling-guide"
            className="text-orange-500 hover:text-orange-400 font-medium"
          >
            Check our Selling Platforms Guide
          </Link>{" "}
          to find the best place to sell.
        </p>
      </div>

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
                  ? "All products are ready. They appear in My Library as a bundle."
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
          ) : (
            <div className="space-y-4 py-2">
              <ul className="space-y-2 max-h-[280px] overflow-y-auto">
                {bundleItems.map((item) => (
                  <li
                    key={item.productId}
                    className="flex items-center justify-between gap-3 rounded-md border border-[#E5E7EB] dark:border-[#2A2A2A] px-3 py-2 text-sm"
                  >
                    <span className="text-gray-900 dark:text-white font-medium">{item.label}</span>
                    {item.status === "generating" && (
                      <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating…
                      </span>
                    )}
                    {item.status === "done" && (
                      <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                        <CheckCircle2 className="w-4 h-4" />
                        Done
                      </span>
                    )}
                    {item.status === "failed" && (
                      <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
                        <XCircle className="w-4 h-4" />
                        Failed
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              {bundleComplete && (
                <DialogFooter>
                  <Button asChild className="bg-orange-500 hover:bg-orange-600">
                    <Link href="/dashboard/library" onClick={closeBundleDialog}>
                      View in My Library
                    </Link>
                  </Button>
                  <Button variant="outline" onClick={closeBundleDialog}>
                    Close
                  </Button>
                </DialogFooter>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
