"use client";

/**
 * Quick-start Video Guide page.
 * Two fields → script generation → video guide generation (which auto-saves to library) → redirect.
 * No multi-step funnel required.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Video, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type Step = "idle" | "script" | "guide" | "done" | "error";

const STEPS: { key: Step; label: string }[] = [
  { key: "script", label: "Generating video script" },
  { key: "guide",  label: "Building your video guide" },
];

export default function NewVideoGuidePage() {
  const router = useRouter();
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);

  const currentStepIdx = STEPS.findIndex((s) => s.key === step);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim() || !description.trim()) return;
    setError(null);
    setStep("script");

    try {
      // ── Step 1: Generate a script ──────────────────────────────────────────
      const scriptRes = await fetch("/api/digital-products/generate-scripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: {
            title: productName.trim(),
            hook_angle: description.trim(),
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
            <div className="space-y-1.5">
              <Label htmlFor="productName">Product or offer name</Label>
              <Input
                id="productName"
                placeholder="e.g. 30-Day Social Media Planner"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                required
                autoFocus
                className="h-11"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">What does it do / who is it for?</Label>
              <Textarea
                id="description"
                placeholder="e.g. A step-by-step planner for content creators who want to post consistently without burnout"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                rows={3}
                className="resize-none"
              />
            </div>

            {error && (
              <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/20 rounded-lg px-4 py-3 border border-red-200 dark:border-red-800/30">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full h-11 bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm"
              disabled={!productName.trim() || !description.trim()}
            >
              Generate My Video Guide →
            </Button>

            <p className="text-center text-xs text-gray-400 dark:text-muted-foreground">
              Takes ~20–40 seconds. Saved automatically to My Library.
            </p>
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
