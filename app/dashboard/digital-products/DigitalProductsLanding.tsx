"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
import { Package, Sparkles, Check, ArrowRight, ChevronRight, Home, X, BookOpen, Layers, Loader2, CheckCircle2, XCircle, RefreshCw, Package2, Pencil, ExternalLink, Repeat2, Upload } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { RepurposeDialog } from "@/components/RepurposeDialog";

const CARD_CLASS =
  "border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-500/5 transition-all duration-200 hover:scale-[1.01] overflow-hidden";

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

type MyProduct = {
  id: string;
  title: string;
  format?: string;
};

const FORMAT_LABELS: Record<string, string> = {
  ebook: "Ebook",
  guide: "Guide",
  workbook: "Workbook",
  planner: "Planner",
  journal: "Journal",
  checklist: "Checklist Pack",
  course: "Course Outline",
  notion: "Notion Template",
  template: "Template",
  spreadsheet: "Spreadsheet Guide",
};

export default function DigitalProductsLanding() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [myProducts, setMyProducts] = useState<MyProduct[]>([]);
  const [myProductsLoading, setMyProductsLoading] = useState(true);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [bundleOpen, setBundleOpen] = useState(false);
  const [topicInput, setTopicInput] = useState("");
  const [bundleItems, setBundleItems] = useState<BundleItem[]>([]);
  const [bundleNiche, setBundleNiche] = useState("");
  const [bundleGenerating, setBundleGenerating] = useState(false);
  const [bundleComplete, setBundleComplete] = useState(false);
  const [bundleError, setBundleError] = useState<string | null>(null);
  const [repurposeProduct, setRepurposeProduct] = useState<{ id: string; title: string } | null>(null);
  const { toast } = useToast();

  // Background generation banner — polls the product until done, then shows a "ready" banner.
  const [bgGeneratingId, setBgGeneratingId] = useState<string | null>(null);
  const [bgGeneratingDone, setBgGeneratingDone] = useState(false);
  const [bgGeneratingFailed, setBgGeneratingFailed] = useState(false);
  const [bgSectionsDone, setBgSectionsDone] = useState(0);
  const [bgSectionsTotal, setBgSectionsTotal] = useState(0);
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

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((data) => setMyProducts(Array.isArray(data.products) ? data.products : []))
      .catch(() => setMyProducts([]))
      .finally(() => setMyProductsLoading(false));
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
    setBundleNiche(topic);
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
      const items = (data.items ?? []).map((item: { productId: string; format: string; label: string; subFocus?: string }) => ({
        ...item,
        status: "generating" as BundleItemStatus,
        subFocus: item.subFocus,
      }));
      setBundleItems(items);
      const updateItem = (productId: string, status: BundleItemStatus) => {
        setBundleItems((prev) => prev.map((i) => (i.productId === productId ? { ...i, status } : i)));
      };
      const results = await Promise.all(
        items.map(async (item: BundleItem) => {
          const result = await pollWithAutoRetry(
            item.productId,
            BUNDLE_POLL_TIMEOUT_MS,
            { niche: topic, productName: item.label, format: item.format, subFocus: item.subFocus }
          );
          updateItem(item.productId, result);
          return result;
        })
      );
      setBundleComplete(true);
      const failed = results.filter((r) => r === "failed").length;
      if (failed > 0) {
        toast({ title: "Partially complete", description: `${failed} format(s) failed. You can retry them below.` });
      } else {
        toast({ title: "Bundle complete", description: "All 8 products are in My Library." });
      }
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

  const closeBundleDialog = () => {
    setBundleOpen(false);
    setTopicInput("");
    setBundleItems([]);
    setBundleNiche("");
    setBundleComplete(false);
    setBundleError(null);
  };

  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="max-w-5xl mx-auto">
        {/* Background generation banner */}
        {(bgGeneratingId || bgGeneratingDone || bgGeneratingFailed) && (
          <div className={`mb-4 rounded-lg border px-4 py-3 ${bgGeneratingFailed ? "border-red-400/40 bg-red-500/10" : bgGeneratingDone ? "border-green-500/40 bg-green-500/10" : "border-orange-500/40 bg-orange-500/10"}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {bgGeneratingId && <Loader2 className="w-4 h-4 animate-spin text-orange-500 shrink-0" />}
                {bgGeneratingDone && <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />}
                {bgGeneratingFailed && <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
                <span className="text-sm font-medium truncate">
                  {bgGeneratingId && (bgSectionsTotal > 0
                    ? `Generating sections — ${bgSectionsDone} of ${bgSectionsTotal} done`
                    : "Your product is generating in the background — you can use the app freely.")}
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

        {/* ── My Products section ── */}
        {myProductsLoading ? null : myProducts.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">My Products</h2>
              <Link
                href="/dashboard/library?tab=products"
                className="inline-flex items-center gap-1.5 text-sm text-orange-500 hover:text-orange-400 font-medium transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View all in Library
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {myProducts.map((product) => (
                <div
                  key={product.id}
                  className="group flex flex-col gap-3 rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] p-4 hover:border-orange-400/60 dark:hover:border-orange-500/40 hover:shadow-md transition-all"
                >
                  <Link href={`/dashboard/digital-products/${product.id}/edit`} className="flex items-start gap-3 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Package className="w-5 h-5 text-orange-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      {product.format && (
                        <span className="inline-block text-[10px] font-medium uppercase tracking-wide text-orange-600 dark:text-orange-400 bg-orange-500/10 rounded px-1.5 py-0.5 mb-1.5">
                          {FORMAT_LABELS[product.format] ?? product.format}
                        </span>
                      )}
                      <p className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2 leading-snug">
                        {product.title}
                      </p>
                    </div>
                    <Pencil className="w-4 h-4 text-gray-400 group-hover:text-orange-500 transition-colors shrink-0 mt-1" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => setRepurposeProduct({ id: product.id, title: product.title })}
                    className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-orange-500 transition-colors self-start"
                  >
                    <Repeat2 className="w-3.5 h-3.5" />
                    Repurpose content
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6 items-stretch">
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

          {/* UPLOAD CARD */}
          <Card className={CARD_CLASS}>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2 text-orange-500 mb-3">
                <Upload className="w-7 h-7" />
                <CardTitle className="text-xl text-gray-900 dark:text-white">Upload Existing</CardTitle>
              </div>
              <p className="text-sm text-gray-600 dark:text-[#A0A0A0]">Perfect if you:</p>
            </CardHeader>
            <CardContent className="flex flex-col flex-1 space-y-6">
              <ul className="space-y-2 text-sm text-gray-700 dark:text-[#E0E0E0]">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500 shrink-0" />
                  Already made a product in Canva
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500 shrink-0" />
                  Have a Notion template or PDF
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500 shrink-0" />
                  Want to sell your own files
                </li>
              </ul>
              <div>
                <p className="text-sm text-gray-600 dark:text-[#A0A0A0] mb-2">What you&apos;ll do:</p>
                <ul className="text-sm text-gray-700 dark:text-[#E0E0E0] space-y-1">
                  <li>→ Upload your file (PDF, ZIP, etc.)</li>
                  <li>→ Add title, description & cover</li>
                  <li>→ Set price &amp; collect payments</li>
                  <li>→ List on your store instantly</li>
                </ul>
              </div>
              <p className="text-xs text-gray-500 dark:text-[#A0A0A0]">Time: ~2 minutes</p>
              <Button
                asChild
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold h-12 text-base gap-2 mt-auto"
              >
                <Link href="/dashboard/digital-products/upload">
                  Upload Product
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Bottom actions */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <div className="flex flex-col items-center">
            <Button
              type="button"
              variant="outline"
              className="border-orange-500/50 text-orange-600 dark:text-orange-400 hover:bg-orange-500/10 hover:border-orange-500 gap-2 h-12 px-6"
              onClick={() => setBundleOpen(true)}
            >
              <Layers className="w-5 h-5" />
              Generate Full Bundle
            </Button>
            <p className="mt-2 text-xs text-gray-500 dark:text-[#A0A0A0] text-center">
              One topic → all 8 formats
            </p>
          </div>
          <div className="hidden sm:block w-px h-10 bg-gray-200 dark:bg-gray-700" />
          <div className="flex flex-col items-center">
            <Button
              asChild
              variant="outline"
              className="border-orange-500/50 text-orange-600 dark:text-orange-400 hover:bg-orange-500/10 hover:border-orange-500 gap-2 h-12 px-6"
            >
              <Link href="/dashboard/digital-products/bundle">
                <Package2 className="w-5 h-5" />
                Bundle Creator
              </Link>
            </Button>
            <p className="mt-2 text-xs text-gray-500 dark:text-[#A0A0A0] text-center">
              Package existing products with AI copy &amp; pricing
            </p>
          </div>
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
                        <XCircle className="w-4 h-4 shrink-0" />
                        Failed
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 shrink-0"
                          onClick={() => handleRetryBundleItem(item)}
                        >
                          <RefreshCw className="w-3.5 h-3.5 mr-1" />
                          Retry
                        </Button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              {bundleItems.some((i) => i.status === "done") && (
                <div className="rounded-md border border-[#E5E7EB] dark:border-[#2A2A2A] bg-gray-50 dark:bg-[#1A1A1A]/50 px-4 py-3 text-sm">
                  <p className="text-gray-700 dark:text-[#E0E0E0] mb-3">
                    Ready to view? Head to My Library to start editing completed products — the rest will appear there automatically once generated.
                  </p>
                  <Button asChild size="sm" className="bg-orange-500 hover:bg-orange-600">
                    <Link href="/dashboard/library" onClick={closeBundleDialog}>
                      Open My Library
                    </Link>
                  </Button>
                </div>
              )}
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

      {repurposeProduct && (
        <RepurposeDialog
          open={!!repurposeProduct}
          onClose={() => setRepurposeProduct(null)}
          productId={repurposeProduct.id}
          productTitle={repurposeProduct.title}
        />
      )}
    </main>
  );
}
