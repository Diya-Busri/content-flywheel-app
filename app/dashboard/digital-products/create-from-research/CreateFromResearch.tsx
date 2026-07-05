"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen, GraduationCap, FileText, Layout, NotebookPen,
  Wrench, Video, Sparkles, ArrowRight, ArrowLeft,
  Loader2, Package, ChevronRight, Clock, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ResearchPrefill {
  title: string;
  description: string;
  niche: string;
  audience: string;
  estimatedPrice: string;
  query: string;
  reportSummary: string;
}

interface ExistingDraft {
  id: string;
  title: string;
  format: string;
  updatedAt?: string;
}

type Step = "details" | "drafts" | "creating";

// ─── Format definitions ───────────────────────────────────────────────────────

const FORMATS = [
  {
    id: "ebook",
    label: "Ebook",
    emoji: "📘",
    icon: BookOpen,
    description: "Written guide, PDF, structured chapters",
    route: null,
  },
  {
    id: "course",
    label: "Course",
    emoji: "🎓",
    icon: GraduationCap,
    description: "Multi-module learning experience",
    route: null,
  },
  {
    id: "template",
    label: "Template",
    emoji: "📋",
    icon: FileText,
    description: "Reusable file (doc, sheet, design)",
    route: null,
  },
  {
    id: "notion-template",
    label: "Notion Template",
    emoji: "📔",
    icon: Layout,
    description: "Notion workspace or system",
    route: null,
  },
  {
    id: "workbook",
    label: "Workbook",
    emoji: "📓",
    icon: NotebookPen,
    description: "Exercises, prompts and worksheets",
    route: null,
  },
  {
    id: "toolkit",
    label: "Toolkit",
    emoji: "🧰",
    icon: Wrench,
    description: "Bundle of tools, resources or swipe files",
    route: null,
  },
  {
    id: "video-guide",
    label: "Video Guide",
    emoji: "🎬",
    icon: Video,
    description: "Script-first video product",
    route: "/dashboard/video-guide/new",
  },
  {
    id: "digital",
    label: "Custom Product",
    emoji: "✨",
    icon: Sparkles,
    description: "Something that doesn't fit a template",
    route: null,
  },
] as const;

type FormatId = typeof FORMATS[number]["id"];

const STORAGE_KEY = "cf-research-prefill";

// ─── Component ────────────────────────────────────────────────────────────────

export default function CreateFromResearch() {
  const router = useRouter();
  const [prefill, setPrefill] = useState<ResearchPrefill | null>(null);

  // Form fields
  const [title, setTitle]           = useState("");
  const [description, setDescription] = useState("");
  const [audience, setAudience]     = useState("");
  const [price, setPrice]           = useState("");
  const [format, setFormat]         = useState<FormatId>("ebook");

  // Flow state
  const [step, setStep]             = useState<Step>("details");
  const [drafts, setDrafts]         = useState<ExistingDraft[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [creating, setCreating]     = useState(false);
  const [error, setError]           = useState<string | null>(null);

  // ── Load prefill from sessionStorage on mount ─────────────────────────────
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as ResearchPrefill;
      setPrefill(data);
      setTitle(data.title ?? "");
      setDescription(data.description ?? "");
      setAudience(data.audience ?? "");
      setPrice(data.estimatedPrice ?? "");
      sessionStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }
  }, []);

  // ── Step 1 → fetch drafts ─────────────────────────────────────────────────
  const handleContinue = useCallback(async () => {
    if (!title.trim()) { setError("Please enter a product title."); return; }
    setError(null);

    const selectedFormat = FORMATS.find((f) => f.id === format)!;

    // Video Guide → save context and redirect immediately
    if (selectedFormat.route) {
      try {
        sessionStorage.setItem("cf-video-prefill", JSON.stringify({
          title, description, audience, price,
          query: prefill?.query ?? title,
        }));
      } catch { /* ignore */ }
      router.push(selectedFormat.route);
      return;
    }

    // For all other formats, check for existing drafts
    setLoadingDrafts(true);
    setStep("drafts");
    try {
      const res  = await fetch("/api/products");
      const json = await res.json() as { products?: ExistingDraft[] };
      const all  = json.products ?? [];
      const drafts = all.filter((p) => p.format !== "physical" && p.format !== "service");
      setDrafts(drafts);
    } catch { setDrafts([]); }
    finally { setLoadingDrafts(false); }
  }, [title, description, audience, price, format, prefill, router]);

  // ── Create new product and redirect to editor ─────────────────────────────
  const handleCreate = useCallback(async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/products/create-blank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title:       title.trim() || "Untitled Product",
          niche:       prefill?.niche ?? prefill?.query ?? "",
          format,
          description: description.trim(),
        }),
      });
      const json = await res.json() as { productId?: string; error?: string };
      if (json.productId) {
        // Store context so editor can pre-fill marketing assets
        try {
          sessionStorage.setItem("cf-product-context", JSON.stringify({
            title, description, audience, price, format,
            query: prefill?.query ?? "",
            reportSummary: prefill?.reportSummary ?? "",
          }));
        } catch { /* ignore */ }
        router.push(`/dashboard/digital-products/${json.productId}/edit`);
      } else {
        setError(json.error ?? "Failed to create product. Please try again.");
        setCreating(false);
      }
    } catch {
      setError("Network error — please try again.");
      setCreating(false);
    }
  }, [title, description, audience, price, format, prefill, router]);

  // ── Resume an existing draft ──────────────────────────────────────────────
  const handleResume = useCallback((draftId: string) => {
    router.push(`/dashboard/digital-products/${draftId}/edit`);
  }, [router]);

  // ─────────────────────────────────────────────────────────────────────────
  // UI
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#F9FAFB] dark:bg-[#0F0F0F] flex flex-col">

      {/* Top bar */}
      <header className="shrink-0 h-14 border-b border-border bg-background/95 backdrop-blur-sm flex items-center px-6 gap-4">
        <button
          onClick={() => (step === "drafts" ? setStep("details") : router.back())}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {step === "drafts" ? "Back" : "Research"}
        </button>
        <div className="h-4 w-px bg-border" />
        <span className="text-sm font-semibold text-foreground">Create This Product</span>

        {/* Step indicator */}
        <div className="ml-auto flex items-center gap-2">
          {(["details", "drafts"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <div className="w-6 h-px bg-border" />}
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors",
                step === s || (step === "creating" && i === 1)
                  ? "bg-orange-500 text-white"
                  : i === 0 && step !== "details"
                  ? "bg-emerald-500 text-white"
                  : "bg-muted text-muted-foreground"
              )}>
                {i + 1}
              </div>
            </div>
          ))}
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-start justify-center py-10 px-4">
        <div className="w-full max-w-2xl space-y-6">

          {/* ── STEP 1: Details + Format ──────────────────────────────────── */}
          {step === "details" && (
            <>
              {/* Research context badge */}
              {prefill?.query && (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-orange-500/20 bg-orange-500/5 text-[12px] text-orange-600 dark:text-orange-400">
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span>Pre-filled from your research: <strong>{prefill.query}</strong></span>
                </div>
              )}

              {/* Heading */}
              <div>
                <h1 className="text-2xl font-bold text-foreground">Create This Product</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Review the details, choose a format, and we'll set everything up.
                </p>
              </div>

              {/* Details card */}
              <div className="rounded-2xl border border-border bg-background p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60">Product Title</label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. The Morning Routine Framework"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60">
                    Description <span className="text-muted-foreground/40 font-normal normal-case tracking-normal">(optional)</span>
                  </label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="A brief description of what this product helps people achieve…"
                    rows={2}
                    className="text-sm resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60">Target Audience</label>
                    <Input
                      value={audience}
                      onChange={(e) => setAudience(e.target.value)}
                      placeholder="e.g. Busy entrepreneurs"
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60">Suggested Price</label>
                    <Input
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="e.g. $27–$47"
                      className="text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Format picker */}
              <div className="rounded-2xl border border-border bg-background p-6 space-y-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">What are you creating?</p>
                  <p className="text-[12px] text-muted-foreground mt-0.5">Choose a format — you can change this later.</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {FORMATS.map((f) => {
                    const Icon = f.icon;
                    const active = format === f.id;
                    return (
                      <button
                        key={f.id}
                        onClick={() => setFormat(f.id)}
                        className={cn(
                          "flex flex-col items-start gap-2 p-3.5 rounded-xl border text-left transition-all",
                          active
                            ? "border-orange-500/60 bg-orange-500/8 shadow-sm"
                            : "border-border bg-background hover:border-orange-500/20 hover:bg-orange-500/4"
                        )}
                      >
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center text-base leading-none shrink-0",
                          active ? "bg-orange-500/15" : "bg-muted"
                        )}>
                          {f.emoji}
                        </div>
                        <div>
                          <p className={cn("text-[13px] font-semibold leading-tight", active ? "text-orange-600 dark:text-orange-400" : "text-foreground")}>
                            {f.label}
                          </p>
                          <p className="text-[10px] text-muted-foreground leading-snug mt-0.5 hidden sm:block">
                            {f.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-sm text-red-600 dark:text-red-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              {/* CTA */}
              <Button
                onClick={handleContinue}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white text-[15px] font-bold py-6 rounded-xl gap-2 shadow-lg shadow-orange-500/20"
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </Button>
            </>
          )}

          {/* ── STEP 2: Draft check ───────────────────────────────────────── */}
          {step === "drafts" && (
            <>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Ready to build</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Creating <strong>{title}</strong> as {FORMATS.find((f) => f.id === format)?.label ?? format}.
                </p>
              </div>

              {loadingDrafts ? (
                <div className="rounded-2xl border border-border bg-background p-8 flex items-center justify-center gap-3 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                  Checking for existing drafts…
                </div>
              ) : drafts.length > 0 ? (
                <>
                  {/* Existing drafts found */}
                  <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-amber-500" />
                      <p className="text-sm font-semibold text-foreground">
                        You have {drafts.length} existing draft{drafts.length > 1 ? "s" : ""}
                      </p>
                    </div>
                    <p className="text-[12px] text-muted-foreground">
                      Would you like to resume an existing draft, or start fresh with your research pre-filled?
                    </p>
                    <div className="space-y-2">
                      {drafts.slice(0, 5).map((draft) => (
                        <button
                          key={draft.id}
                          onClick={() => handleResume(draft.id)}
                          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-background hover:border-orange-500/30 hover:bg-orange-500/4 transition-all text-left group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 text-sm">
                            {FORMATS.find((f) => f.id === draft.format)?.emoji ?? "📦"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{draft.title}</p>
                            <p className="text-[11px] text-muted-foreground capitalize">
                              {FORMATS.find((f) => f.id === draft.format)?.label ?? draft.format} · Draft
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-orange-500 transition-colors shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="relative flex items-center gap-3">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-[11px] font-medium text-muted-foreground">or</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>

                  <Button
                    onClick={handleCreate}
                    disabled={creating}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white text-[15px] font-bold py-6 rounded-xl gap-2 shadow-lg shadow-orange-500/20"
                  >
                    {creating ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</>
                    ) : (
                      <><Sparkles className="w-4 h-4" /> Start Fresh</>
                    )}
                  </Button>
                </>
              ) : (
                /* No drafts — confirm and create */
                <div className="rounded-2xl border border-border bg-background p-6 space-y-5">
                  <div className="flex items-center gap-3 py-2">
                    <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-2xl leading-none shrink-0">
                      {FORMATS.find((f) => f.id === format)?.emoji ?? "📦"}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{title}</p>
                      <p className="text-[12px] text-muted-foreground">
                        {FORMATS.find((f) => f.id === format)?.label ?? format}
                        {price ? ` · ${price}` : ""}
                        {audience ? ` · ${audience}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl bg-muted/30 border border-border/40 px-4 py-3 flex items-center gap-2 text-[12px] text-muted-foreground">
                    <Clock className="w-3.5 h-3.5 shrink-0 text-orange-400" />
                    Your research context will be loaded into the editor to pre-fill content and marketing assets.
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-sm text-red-600 dark:text-red-400">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {error}
                    </div>
                  )}

                  <Button
                    onClick={handleCreate}
                    disabled={creating}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white text-[15px] font-bold py-6 rounded-xl gap-2 shadow-lg shadow-orange-500/20"
                  >
                    {creating ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Creating product…</>
                    ) : (
                      <><Sparkles className="w-4 h-4" /> Create This Product</>
                    )}
                  </Button>
                </div>
              )}
            </>
          )}

        </div>
      </main>
    </div>
  );
}
