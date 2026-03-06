"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setVideoPrefill, getTimelineUrl } from "@/lib/video-prefill";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, Upload, ArrowRight, Loader2, AlertCircle, AlertTriangle, Info, Sparkles, Copy, Download, RefreshCw, Library, Film } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import type { ScriptViolation } from "@/app/api/script-checker/route";

const MAX_SCRIPT_CHARS = 5000;
const MAX_IMAGE_SIZE_MB = 5;
const MAX_IMAGE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ACCEPTED_IMAGE_EXT = ".jpg,.jpeg,.png,.webp";

type Platform = "tiktok" | "instagram" | "youtube" | "facebook" | "twitter" | "all";

const PLATFORM_LABELS: Record<Platform, string> = {
  tiktok: "TikTok",
  instagram: "Instagram Reels",
  youtube: "YouTube Shorts",
  facebook: "Facebook",
  twitter: "Twitter/X",
  all: "All platforms (strictest)",
};

function platformToApi(platform: Platform): string[] {
  if (platform === "all") return ["TikTok", "Instagram", "YouTube", "Facebook", "Twitter"];
  return [PLATFORM_LABELS[platform]];
}

function SideBySideComparison({
  originalScript,
  compliantScript,
  setCompliantScript,
  violationLineNumbers,
  onCopy,
  onDownload,
  onRecheck,
  onSaveToLibrary,
  savingToLibrary = false,
  savedScriptId,
  savedScriptTitle,
  onCreateVideo,
}: {
  originalScript: string;
  compliantScript: string;
  setCompliantScript: (s: string) => void;
  violationLineNumbers: Set<number>;
  onCopy: () => void;
  onDownload: () => void;
  onRecheck: () => void;
  onSaveToLibrary: () => void;
  savingToLibrary?: boolean;
  savedScriptId?: string | null;
  savedScriptTitle?: string | null;
  onCreateVideo?: () => void;
}) {
  const originalLines = originalScript.split("\n");

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Side-by-side comparison</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Original (violations highlighted)</p>
          <div className="rounded-lg border border-[#E5E7EB] dark:border-[#2A2A2A] bg-gray-50 dark:bg-[#0F0F0F] p-3 font-mono text-sm">
            {originalLines.map((line, i) => (
              <div
                key={i}
                className={`px-2 py-0.5 -mx-2 rounded ${
                  violationLineNumbers.has(i + 1)
                    ? "bg-red-900/40 text-red-200"
                    : "text-gray-700 dark:text-gray-300"
                }`}
              >
                <span className="text-gray-500 select-none mr-2">{i + 1}</span>
                {line || " "}
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Compliant script (editable)</p>
          <Textarea
            value={compliantScript}
            onChange={(e) => setCompliantScript(e.target.value)}
            className="font-mono text-sm min-h-[120px] min-w-0 resize-y bg-green-50 dark:bg-green-950/20 border-green-300 dark:border-green-900/50 text-gray-900 dark:text-white"
            placeholder="Compliant script will appear here..."
            rows={Math.min(40, Math.max(8, compliantScript.split("\n").length + 2))}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCopy} className="gap-1.5">
          <Copy className="w-3.5 h-3.5" />
          Copy new script
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onDownload} className="gap-1.5">
          <Download className="w-3.5 h-3.5" />
          Save as file
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onSaveToLibrary} className="gap-1.5" disabled={savingToLibrary}>
          {savingToLibrary ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Library className="w-3.5 h-3.5" />}
          Save to Library
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onRecheck} className="gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" />
          Re-check for compliance
        </Button>
        {savedScriptId && onCreateVideo && (
          <Button type="button" size="sm" onClick={onCreateVideo} className="gap-1.5 bg-orange-500 hover:bg-orange-600">
            <Film className="w-3.5 h-3.5" />
            Create video
          </Button>
        )}
      </div>
    </div>
  );
}

function ViolationCard({ violation }: { violation: ScriptViolation }) {
  const severityConfig = {
    critical: {
      icon: AlertCircle,
      label: "Critical",
      className: "border-red-900/50 bg-red-950/20",
      iconClassName: "text-red-400",
    },
    warning: {
      icon: AlertTriangle,
      label: "Warning",
      className: "border-amber-900/50 bg-amber-950/20",
      iconClassName: "text-amber-400",
    },
    suggestion: {
      icon: Info,
      label: "Suggestion",
      className: "border-blue-900/50 bg-blue-950/20",
      iconClassName: "text-blue-400",
    },
  };
  const config = severityConfig[violation.severity] ?? severityConfig.warning;
  const Icon = config.icon;

  const categories = violation.categories ?? (violation.category ? [violation.category] : ["Compliance issue"]);
  const hasMultiple = categories.length > 1;

  return (
    <div className={`rounded-lg border p-4 ${config.className}`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${config.iconClassName}`} />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                {config.label}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Line {violation.lineNumber}{hasMultiple ? ": Multiple issues" : ""}
              </span>
            </div>
            {hasMultiple ? (
              <ul className="list-disc list-inside text-xs text-gray-500 dark:text-gray-400 space-y-0.5 ml-0.5">
                {categories.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            ) : (
              <span className="text-xs text-gray-500 dark:text-gray-400">{categories[0]}</span>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Violates: {violation.platforms.join(", ")}
            </p>
          </div>
          <p className="text-base font-semibold text-gray-900 dark:text-white">
            &ldquo;{violation.exactText}&rdquo;
          </p>
          <div className="pt-2">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">Suggested fix:</p>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{violation.suggestedFix}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ScriptCheckerFlow() {
  const [platform, setPlatform] = useState<Platform>("tiktok");
  const [script, setScript] = useState("");
  const [productImage, setProductImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [violations, setViolations] = useState<ScriptViolation[]>([]);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [compliantScript, setCompliantScript] = useState<string | null>(null);
  const [generatingCompliant, setGeneratingCompliant] = useState(false);
  const [compliantError, setCompliantError] = useState<string | null>(null);
  const [savingToLibrary, setSavingToLibrary] = useState(false);
  const { toast } = useToast();

  const violationLineNumbers = new Set(violations.map((v) => v.lineNumber));

  const handleGenerateCompliant = async () => {
    setGeneratingCompliant(true);
    setCompliantError(null);
    try {
      const res = await fetch("/api/script-checker/generate-compliant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: script.trim(), violations }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setCompliantScript(data.compliantScript ?? "");
    } catch (err) {
      setCompliantError(err instanceof Error ? err.message : "Failed to generate compliant script");
    } finally {
      setGeneratingCompliant(false);
    }
  };

  const handleCopyCompliant = () => {
    if (!compliantScript) return;
    navigator.clipboard.writeText(compliantScript);
    toast({ title: "Copied!", description: "Compliant script copied to clipboard." });
  };

  const handleDownloadCompliant = () => {
    if (!compliantScript) return;
    const blob = new Blob([compliantScript], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "compliant-script.txt";
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Downloaded!", description: "Saved as compliant-script.txt" });
  };

  const runCheck = async (scriptToCheck: string) => {
    setAnalyzing(true);
    setCheckError(null);
    try {
      const res = await fetch("/api/script-checker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: scriptToCheck.trim(),
          platforms: platformToApi(platform),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");
      setViolations(data.violations ?? []);
    } catch (err) {
      setCheckError(err instanceof Error ? err.message : "Failed to analyze script");
      setViolations([]);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleRecheckCompliant = () => {
    const toCheck = compliantScript ?? script;
    setScript(toCheck);
    setCompliantScript(null);
    runCheck(toCheck);
  };

  const [savedScriptId, setSavedScriptId] = useState<string | null>(null);
  const [savedScriptTitle, setSavedScriptTitle] = useState<string | null>(null);
  const router = useRouter();

  const handleSaveToLibrary = async () => {
    const content = compliantScript ?? script;
    if (!content?.trim()) return;
    setSavingToLibrary(true);
    setSavedScriptId(null);
    setSavedScriptTitle(null);
    try {
      const res = await fetch("/api/library/scripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Script – ${PLATFORM_LABELS[platform]}`,
          content,
          platform,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed to save");
      const inserted = data as { id?: string; title?: string };
      if (inserted?.id) {
        setSavedScriptId(inserted.id);
        setSavedScriptTitle(typeof inserted.title === "string" ? inserted.title : `Script – ${PLATFORM_LABELS[platform]}`);
      }
      toast({ title: "Saved to Library", description: "Your script is now in My Library." });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Could not save to library",
        variant: "destructive",
      });
    } finally {
      setSavingToLibrary(false);
    }
  };

  const handleCreateVideo = () => {
    if (!savedScriptId) return;
    setVideoPrefill({
      scriptId: savedScriptId,
      title: savedScriptTitle ?? undefined,
      source: "script-checker",
    });
    router.push(getTimelineUrl(savedScriptId));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setFormErrors((prev) => ({ ...prev, productImage: "Use JPG, PNG, or WebP." }));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setFormErrors((prev) => ({ ...prev, productImage: `Max size ${MAX_IMAGE_SIZE_MB}MB.` }));
      return;
    }
    setFormErrors((prev) => ({ ...prev, productImage: "" }));
    setProductImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleImageDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setFormErrors((prev) => ({ ...prev, productImage: "Use JPG, PNG, or WebP." }));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setFormErrors((prev) => ({ ...prev, productImage: `Max size ${MAX_IMAGE_SIZE_MB}MB.` }));
      return;
    }
    setFormErrors((prev) => ({ ...prev, productImage: "" }));
    setProductImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!script.trim()) errors.script = "Please paste your video script.";
    if (script.length > MAX_SCRIPT_CHARS) errors.script = `Script must be under ${MAX_SCRIPT_CHARS} characters.`;
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSubmitted(true);
    setCompliantScript(null);
    await runCheck(script);
  };

  return (
    <main className="p-6 md:p-10 max-w-3xl mx-auto">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-orange-500 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to dashboard
      </Link>

      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        Check Script Compliance
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-10">
        Ensure your video scripts meet TikTok, Instagram, YouTube, Facebook, and Twitter guidelines
      </p>

      <form onSubmit={handleSubmit}>
        <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A]">
          <CardHeader>
            <CardTitle className="text-xl text-gray-900 dark:text-white">Script details</CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              Paste your script and choose a platform. We&apos;ll check for policy violations and compliance issues.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* 1. Platform Selection */}
            <div className="space-y-3">
              <Label className="text-gray-300">Which platform(s) are you posting on?</Label>
              <RadioGroup
                value={platform}
                onValueChange={(v: Platform) => setPlatform(v)}
                className="grid grid-cols-1 sm:grid-cols-2 gap-2"
              >
                <div className="flex items-center gap-3 rounded-lg border border-[#E5E7EB] dark:border-[#2A2A2A] p-3 hover:border-orange-500/50">
                  <RadioGroupItem value="tiktok" id="platform-tiktok" />
                  <label htmlFor="platform-tiktok" className="cursor-pointer text-sm font-medium text-gray-900 dark:text-white">
                    TikTok
                  </label>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-[#E5E7EB] dark:border-[#2A2A2A] p-3 hover:border-orange-500/50">
                  <RadioGroupItem value="instagram" id="platform-instagram" />
                  <label htmlFor="platform-instagram" className="cursor-pointer text-sm font-medium text-gray-900 dark:text-white">
                    Instagram Reels
                  </label>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-[#E5E7EB] dark:border-[#2A2A2A] p-3 hover:border-orange-500/50">
                  <RadioGroupItem value="youtube" id="platform-youtube" />
                  <label htmlFor="platform-youtube" className="cursor-pointer text-sm font-medium text-gray-900 dark:text-white">
                    YouTube Shorts
                  </label>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-[#E5E7EB] dark:border-[#2A2A2A] p-3 hover:border-orange-500/50">
                  <RadioGroupItem value="facebook" id="platform-facebook" />
                  <label htmlFor="platform-facebook" className="cursor-pointer text-sm font-medium text-gray-900 dark:text-white">
                    Facebook
                  </label>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-[#E5E7EB] dark:border-[#2A2A2A] p-3 hover:border-orange-500/50">
                  <RadioGroupItem value="twitter" id="platform-twitter" />
                  <label htmlFor="platform-twitter" className="cursor-pointer text-sm font-medium text-gray-900 dark:text-white">
                    Twitter/X
                  </label>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-[#E5E7EB] dark:border-[#2A2A2A] p-3 hover:border-orange-500/50 sm:col-span-2">
                  <RadioGroupItem value="all" id="platform-all" />
                  <label htmlFor="platform-all" className="cursor-pointer text-sm font-medium text-gray-900 dark:text-white">
                    All platforms (strictest rules)
                  </label>
                </div>
              </RadioGroup>
            </div>

            {/* 2. Video Script */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="script" className="text-gray-300">Paste Your Video Script *</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs text-gray-500 hover:text-orange-500"
                  onClick={() =>
                    setScript(
                      "This supplement will CURE your acne in 24 hours - guaranteed! Studies show it works 100% of the time.\n\nDM me for the link - I make a commission but trust me it's amazing.\n\nYou'll never have skin problems again, I promise."
                    )
                  }
                >
                  Try sample script (known violations)
                </Button>
              </div>
              <Textarea
                id="script"
                placeholder="Paste your video script here... We'll check for policy violations, banned words, and compliance issues."
                value={script}
                onChange={(e) => {
                  setScript(e.target.value);
                  setFormErrors((prev) => ({ ...prev, script: "" }));
                }}
                rows={10}
                className={`resize-none bg-gray-50 dark:bg-[#0F0F0F] border-[#E5E7EB] dark:border-[#2A2A2A] text-gray-900 dark:text-white placeholder:text-gray-500 ${formErrors.script ? "border-red-500" : ""}`}
                maxLength={MAX_SCRIPT_CHARS}
              />
              <p className="text-xs text-gray-500">
                {script.length}/{MAX_SCRIPT_CHARS} characters
              </p>
              {formErrors.script && (
                <p className="text-sm text-red-500">{formErrors.script}</p>
              )}
            </div>

            {/* 3. Product Image (optional) */}
            <div className="space-y-2">
              <Label className="text-gray-300">Product Image (optional)</Label>
              <div
                onDrop={handleImageDrop}
                onDragOver={(e) => e.preventDefault()}
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  imagePreview
                    ? "border-orange-200 dark:border-orange-900/50 bg-orange-50/50 dark:bg-orange-950/20"
                    : "border-[#E5E7EB] dark:border-[#2A2A2A] hover:border-orange-500/50"
                } ${formErrors.productImage ? "border-red-500" : ""}`}
              >
                <input
                  type="file"
                  accept={ACCEPTED_IMAGE_EXT}
                  onChange={handleImageChange}
                  className="hidden"
                  id="script-checker-image"
                />
                {imagePreview ? (
                  <div className="space-y-2">
                    <img
                      src={imagePreview}
                      alt="Product"
                      className="max-h-24 mx-auto rounded-lg object-contain"
                    />
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs mx-auto">{productImage?.name}</p>
                    <label htmlFor="script-checker-image">
                      <Button type="button" variant="outline" size="sm" asChild>
                        <span className="cursor-pointer">Change image</span>
                      </Button>
                    </label>
                  </div>
                ) : (
                  <label htmlFor="script-checker-image" className="cursor-pointer block">
                    <Upload className="w-8 h-8 mx-auto text-gray-500 dark:text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Drag & drop or click to upload
                    </p>
                    <p className="text-xs text-gray-500 mt-1">JPG, PNG, WebP — max 5MB</p>
                  </label>
                )}
              </div>
              <p className="text-xs text-gray-500">
                Upload if your script references visual elements
              </p>
              {formErrors.productImage && (
                <p className="text-sm text-red-500">{formErrors.productImage}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-orange-500 hover:bg-orange-600 text-white h-12 text-base font-medium gap-2"
              size="lg"
              disabled={submitted && analyzing}
            >
              Check Compliance
              <ArrowRight className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>
      </form>

      {/* Results section */}
      {submitted && (
        <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] mt-8">
          <CardHeader>
            <CardTitle className="text-xl">Results</CardTitle>
            <CardDescription>
              Compliance analysis for {PLATFORM_LABELS[platform]}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {analyzing ? (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-4" />
                <p className="text-gray-600 dark:text-gray-400">
                  Analyzing script for compliance issues...
                </p>
              </div>
            ) : checkError ? (
              <div className="py-6 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 px-4">
                <p className="text-sm text-red-700 dark:text-red-300">{checkError}</p>
              </div>
            ) : violations.length === 0 ? (
              <div className="py-8 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/50 px-4 text-center">
                <p className="text-green-700 dark:text-green-300 font-medium">No violations found</p>
                <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                  Your script looks compliant with {PLATFORM_LABELS[platform]} guidelines. Keep in mind platform rules can change; always review official policies.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSaveToLibrary}
                  disabled={savingToLibrary}
                  className="mt-4 gap-1.5"
                >
                  {savingToLibrary ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Library className="w-3.5 h-3.5" />}
                  Save to Library
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Found {violations.length} issue{violations.length !== 1 ? "s" : ""} to review:
                  </p>
                  <Button
                    type="button"
                    className="bg-orange-500 hover:bg-orange-600 gap-2"
                    onClick={handleGenerateCompliant}
                    disabled={generatingCompliant}
                  >
                    {generatingCompliant ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    Generate Compliant Script
                  </Button>
                </div>
                {compliantError && (
                  <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 px-4 py-2">
                    <p className="text-sm text-red-700 dark:text-red-300">{compliantError}</p>
                  </div>
                )}
                {compliantScript && (
                  <SideBySideComparison
                    originalScript={script}
                    compliantScript={compliantScript}
                    setCompliantScript={setCompliantScript}
                    violationLineNumbers={violationLineNumbers}
                    onCopy={handleCopyCompliant}
                    onDownload={handleDownloadCompliant}
                    onRecheck={handleRecheckCompliant}
                    onSaveToLibrary={handleSaveToLibrary}
                    savingToLibrary={savingToLibrary}
                    savedScriptId={savedScriptId}
                    savedScriptTitle={savedScriptTitle}
                    onCreateVideo={handleCreateVideo}
                  />
                )}
                <div className="space-y-4">
                  {violations.map((v, i) => (
                    <ViolationCard key={i} violation={v} />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  );
}
