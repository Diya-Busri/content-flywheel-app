"use client";

/**
 * Quick-start Video Guide page.
 * Two fields → script generation → video guide generation (which auto-saves to library) → redirect.
 * No multi-step funnel required.
 */

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Video, CheckCircle2, Package, ChevronDown, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Step = "idle" | "script" | "guide" | "done" | "error";
type Product = { id: string; title: string; niche: string; marketingAssets: { productDescription?: string } | null };

const STEPS: { key: Step; label: string }[] = [
  { key: "script", label: "Generating video script" },
  { key: "guide",  label: "Building your video guide" },
];

const ANGLES = [
  {
    id: "problem-solution",
    emoji: "🎯",
    label: "Problem → Solution",
    desc: "Call out the exact pain, then position your product as the fix.",
    example: '"I wasted 3 months doing this wrong — here\'s what actually works"',
  },
  {
    id: "transformation",
    emoji: "✨",
    label: "Transformation",
    desc: "Before vs after. Show the life change your product creates.",
    example: '"This one thing took me from overwhelmed to fully booked"',
  },
  {
    id: "how-it-works",
    emoji: "⚙️",
    label: "How It Works",
    desc: "Step-by-step walkthrough. Great for sceptical audiences.",
    example: '"Here\'s exactly what\'s inside and how to use it"',
  },
  {
    id: "story",
    emoji: "🎬",
    label: "Story / Personal",
    desc: "Authentic and relatable. Lead with your own experience.",
    example: '"I created this because I couldn\'t find it anywhere"',
  },
];

export default function NewVideoGuidePage() {
  const router = useRouter();
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    // Use the library API — same source as My Library page, consistently reliable
    fetch("/api/library?type=products")
      .then((r) => r.ok ? r.json() : [])
      .then((data: unknown) => {
        const items = Array.isArray(data) ? data : [];
        const mapped: Product[] = items.map((p: Record<string, unknown>) => ({
          id: String(p.id ?? ""),
          title: String(p.title ?? "Untitled"),
          niche: String(p.niche ?? p.format ?? ""),
          marketingAssets: p.productDescription
            ? { productDescription: String(p.productDescription) }
            : null,
        }));
        setProducts(mapped);
      })
      .catch(() => {});
  }, []);

  const selectProduct = (p: Product) => {
    setSelectedProduct(p);
    setProductName(p.title);
    const desc = p.marketingAssets?.productDescription?.trim() || p.niche?.trim() || "";
    setDescription(desc);
  };
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [formStep, setFormStep] = useState<1 | 2>(1);
  const [selectedAngle, setSelectedAngle] = useState<string>("problem-solution");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      let text = "";
      if (file.name.endsWith(".txt")) {
        text = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve((ev.target?.result as string) ?? "");
          reader.readAsText(file);
        });
      } else {
        // PDF — send to extraction endpoint
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/extract-pdf-text", { method: "POST", body: fd });
        if (res.ok) {
          const data = (await res.json()) as { text?: string };
          text = data.text ?? "";
        }
      }
      if (text.trim()) {
        const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
        // First non-empty line → product name (truncated), rest → description
        if (lines.length > 0) setProductName(lines[0].slice(0, 120));
        if (lines.length > 1) setDescription(lines.slice(1, 8).join(" ").slice(0, 600));
      }
    } catch { /* non-blocking */ }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const currentStepIdx = STEPS.findIndex((s) => s.key === step);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formStep === 1) { setFormStep(2); return; }
    if (!productName.trim() || !description.trim()) return;
    setError(null);
    setStep("script");

    const angleLabel = ANGLES.find((a) => a.id === selectedAngle)?.label ?? selectedAngle;

    try {
      // ── Step 1: Generate a script ──────────────────────────────────────────
      const scriptRes = await fetch("/api/digital-products/generate-scripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: {
            title: productName.trim(),
            hook_angle: `${description.trim()} — Use a "${angleLabel}" angle for the script hook.`,
          },
        }),
      });
      if (!scriptRes.ok) {
        const err = await scriptRes.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to generate script");
      }
      const scriptData = (await scriptRes.json()) as {
        scripts?: Array<{ hook: string; body: string; cta: string }>;
      };
      const scripts = scriptData.scripts ?? [];
      if (!scripts.length) throw new Error("No scripts returned — please try again");
      const { hook, body: bodyText, cta } = scripts[0];

      // ── Step 2: Build video guide (auto-saves to library, returns libraryScriptId) ──
      setStep("guide");
      const guideRes = await fetch("/api/video-guide/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hook,
          body: bodyText,
          cta,
          productName: productName.trim(),
          productDescription: description.trim(),
          platforms: ["tiktok", "instagram_reels"],
        }),
      });
      if (!guideRes.ok) {
        const err = await guideRes.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to build video guide");
      }
      const guide = (await guideRes.json()) as { libraryScriptId?: string };
      if (!guide.libraryScriptId) throw new Error("Guide was created but could not be saved — please try again");

      // ── Redirect to guide ──────────────────────────────────────────────────
      setStep("done");
      router.push(
        `/dashboard/digital-products/video-guide?libraryScriptId=${encodeURIComponent(guide.libraryScriptId)}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStep("error");
    }
  };

  const isLoading = step === "script" || step === "guide";

  return (
    <main className="min-h-dvh bg-gray-50 dark:bg-background">
      {/* Back link */}
      <div className="border-b border-gray-200 dark:border-border bg-white dark:bg-card px-4 py-4 sm:px-6">
        <Link
          href="/dashboard/digital-products"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-muted-foreground hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
      </div>

      <div className="max-w-lg mx-auto px-4 py-10 sm:py-16">
        {/* Icon + headline */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-orange-500/10 flex items-center justify-center mx-auto mb-4">
            <Video className="w-7 h-7 text-orange-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Create a Video Guide
          </h1>
          <p className="text-sm text-gray-500 dark:text-muted-foreground mt-2 max-w-sm mx-auto">
            Two fields and you&apos;re done — we&apos;ll generate a full video script, scene prompts, and
            social kit in under a minute.
          </p>
        </div>

        {/* ── Form ──────────────────────────────────────────────────────────── */}
        {(step === "idle" || step === "error") && (
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-2">
              {[1, 2].map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    formStep === s ? "bg-orange-500 text-white" : formStep > s ? "bg-emerald-500 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-400"
                  }`}>{s}</div>
                  <span className={`text-xs font-medium ${formStep === s ? "text-gray-900 dark:text-white" : "text-gray-400"}`}>
                    {s === 1 ? "Your product" : "Script angle"}
                  </span>
                  {s < 2 && <div className="w-8 h-px bg-gray-200 dark:bg-gray-700 mx-1" />}
                </div>
              ))}
            </div>

            {/* ── Form step 1: Product details ── */}
            {formStep === 1 && (
              <div className="space-y-5">

                {/* Option 1: Select from library */}
                <div className="space-y-1.5">
                  <Label>Select from your Digital Products</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full h-11 justify-between font-normal"
                        disabled={products.length === 0}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <Package className="h-4 w-4 shrink-0 text-orange-500" />
                          <span className="truncate text-left">
                            {products.length === 0
                              ? "No products yet — create one in Digital Products"
                              : selectedProduct
                              ? selectedProduct.title
                              : "Choose from your Digital Products…"}
                          </span>
                        </span>
                        {products.length > 0 && <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
                      </Button>
                    </DropdownMenuTrigger>
                    {products.length > 0 && (
                      <DropdownMenuContent className="w-full min-w-[320px]">
                        {products.map((p) => (
                          <DropdownMenuItem key={p.id} onClick={() => selectProduct(p)} className="flex flex-col items-start gap-0.5 py-2">
                            <span className="font-medium">{p.title}</span>
                            {p.niche && <span className="text-xs text-muted-foreground">{p.niche}</span>}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    )}
                  </DropdownMenu>
                  {selectedProduct && <p className="text-xs text-green-600 dark:text-green-400">✓ Fields pre-filled — edit below if needed.</p>}
                </div>

                {/* Divider */}
                <div className="relative flex items-center gap-2">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">or upload a file</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* Option 2: Upload PDF or text file */}
                <div className="space-y-1.5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.txt"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-11 border-dashed gap-2"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploading ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Extracting text…</>
                    ) : (
                      <><Upload className="h-4 w-4 text-orange-500" /> Upload PDF or .txt file</>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    We&apos;ll extract the key info and fill in the fields below.
                  </p>
                </div>

                {/* Divider */}
                <div className="relative flex items-center gap-2">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">or fill in manually</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* Option 3: Manual fields */}
                <div className="space-y-1.5">
                  <Label htmlFor="productName">Product or offer name</Label>
                  <Input id="productName" placeholder="e.g. 30-Day Social Media Planner" value={productName} onChange={(e) => setProductName(e.target.value)} required autoFocus className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="description">What does it do / who is it for?</Label>
                  <Textarea id="description" placeholder="e.g. A planner for content creators who want to post consistently without burnout" value={description} onChange={(e) => setDescription(e.target.value)} required rows={3} className="resize-none" />
                </div>

                <Button type="submit" className="w-full h-11 bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm" disabled={!productName.trim() || !description.trim()}>
                  Next: Pick your angle →
                </Button>
              </div>
            )}

            {/* ── Form step 2: Script angle ── */}
            {formStep === 2 && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">What angle should the script take?</p>
                  <p className="text-xs text-gray-500 dark:text-muted-foreground">This shapes the hook and overall narrative of your video.</p>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {ANGLES.map((angle) => (
                    <button
                      key={angle.id}
                      type="button"
                      onClick={() => setSelectedAngle(angle.id)}
                      className={`text-left rounded-xl border-2 p-4 transition-all ${
                        selectedAngle === angle.id
                          ? "border-orange-500 bg-orange-50 dark:bg-orange-950/20"
                          : "border-gray-200 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-700 bg-white dark:bg-card"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl">{angle.emoji}</span>
                        <span className={`font-semibold text-sm ${selectedAngle === angle.id ? "text-orange-600 dark:text-orange-400" : "text-gray-900 dark:text-white"}`}>{angle.label}</span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-muted-foreground mb-1.5">{angle.desc}</p>
                      <p className={`text-xs italic ${selectedAngle === angle.id ? "text-orange-500" : "text-gray-400"}`}>{angle.example}</p>
                    </button>
                  ))}
                </div>

                {error && (
                  <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/20 rounded-lg px-4 py-3 border border-red-200 dark:border-red-800/30">{error}</p>
                )}

                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={() => setFormStep(1)} className="h-11 px-5">← Back</Button>
                  <Button type="submit" className="flex-1 h-11 bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm">
                    Generate My Video Guide →
                  </Button>
                </div>
                <p className="text-center text-xs text-gray-400 dark:text-muted-foreground">Takes ~20–40 seconds. Saved automatically to My Library.</p>
              </div>
            )}
          </form>
        )}

        {/* ── Progress ──────────────────────────────────────────────────────── */}
        {(isLoading || step === "done") && (
          <div className="space-y-3">
            {STEPS.map((s, i) => {
              const isDone = i < currentStepIdx || step === "done";
              const isActive = s.key === step;
              return (
                <div
                  key={s.key}
                  className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all ${
                    isDone
                      ? "border-green-200 dark:border-green-800/40 bg-green-50 dark:bg-green-950/20"
                      : isActive
                      ? "border-orange-300 dark:border-orange-600/40 bg-orange-50 dark:bg-orange-950/20"
                      : "border-gray-200 dark:border-border bg-white dark:bg-card opacity-40"
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                  ) : isActive ? (
                    <Loader2 className="w-5 h-5 text-orange-500 animate-spin shrink-0" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-border shrink-0" />
                  )}
                  <span
                    className={`text-sm font-medium ${
                      isDone
                        ? "text-green-700 dark:text-green-400"
                        : isActive
                        ? "text-orange-700 dark:text-orange-400"
                        : "text-gray-400 dark:text-muted-foreground"
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}

            {step !== "done" && (
              <p className="text-center text-xs text-gray-400 dark:text-muted-foreground pt-2">
                This usually takes 20–40 seconds…
              </p>
            )}
            {step === "done" && (
              <p className="text-center text-xs text-green-600 dark:text-green-400 font-medium pt-2">
                Opening your video guide…
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
