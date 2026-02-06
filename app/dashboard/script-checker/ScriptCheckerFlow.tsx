"use client";

import { useState } from "react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, Upload, ArrowRight, Loader2 } from "lucide-react";

const MAX_SCRIPT_CHARS = 5000;
const MAX_IMAGE_SIZE_MB = 5;
const MAX_IMAGE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ACCEPTED_IMAGE_EXT = ".jpg,.jpeg,.png,.webp";

type Platform = "tiktok" | "instagram" | "youtube" | "all";

export default function ScriptCheckerFlow() {
  const [platform, setPlatform] = useState<Platform>("tiktok");
  const [script, setScript] = useState("");
  const [productImage, setProductImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!script.trim()) errors.script = "Please paste your video script.";
    if (script.length > MAX_SCRIPT_CHARS) errors.script = `Script must be under ${MAX_SCRIPT_CHARS} characters.`;
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSubmitted(true);
    setAnalyzing(true);
    // Placeholder: results will be built next; keep spinner for now
    setTimeout(() => setAnalyzing(false), 3000);
  };

  return (
    <main className="p-6 md:p-10 max-w-3xl mx-auto">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-orange-500 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to dashboard
      </Link>

      <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
        Check Script Compliance
      </h1>
      <p className="text-slate-600 dark:text-slate-400 mb-10">
        Ensure your video scripts meet TikTok, Instagram, and YouTube guidelines
      </p>

      <form onSubmit={handleSubmit}>
        <Card className="border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="text-xl">Script details</CardTitle>
            <CardDescription>
              Paste your script and choose a platform. We&apos;ll check for policy violations and compliance issues.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* 1. Platform Selection */}
            <div className="space-y-3">
              <Label>Which platform are you posting on?</Label>
              <RadioGroup
                value={platform}
                onValueChange={(v: Platform) => setPlatform(v)}
                className="grid grid-cols-1 sm:grid-cols-2 gap-2"
              >
                <div className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-700 p-3 hover:border-orange-200 dark:hover:border-orange-900/50">
                  <RadioGroupItem value="tiktok" id="platform-tiktok" />
                  <label htmlFor="platform-tiktok" className="cursor-pointer text-sm font-medium">
                    TikTok
                  </label>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-700 p-3 hover:border-orange-200 dark:hover:border-orange-900/50">
                  <RadioGroupItem value="instagram" id="platform-instagram" />
                  <label htmlFor="platform-instagram" className="cursor-pointer text-sm font-medium">
                    Instagram Reels
                  </label>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-700 p-3 hover:border-orange-200 dark:hover:border-orange-900/50">
                  <RadioGroupItem value="youtube" id="platform-youtube" />
                  <label htmlFor="platform-youtube" className="cursor-pointer text-sm font-medium">
                    YouTube Shorts
                  </label>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-700 p-3 hover:border-orange-200 dark:hover:border-orange-900/50 sm:col-span-2">
                  <RadioGroupItem value="all" id="platform-all" />
                  <label htmlFor="platform-all" className="cursor-pointer text-sm font-medium">
                    All platforms (strictest rules)
                  </label>
                </div>
              </RadioGroup>
            </div>

            {/* 2. Video Script */}
            <div className="space-y-2">
              <Label htmlFor="script">Paste Your Video Script *</Label>
              <Textarea
                id="script"
                placeholder="Paste your video script here... We'll check for policy violations, banned words, and compliance issues."
                value={script}
                onChange={(e) => {
                  setScript(e.target.value);
                  setFormErrors((prev) => ({ ...prev, script: "" }));
                }}
                rows={10}
                className={`resize-none ${formErrors.script ? "border-red-500" : ""}`}
                maxLength={MAX_SCRIPT_CHARS}
              />
              <p className="text-xs text-slate-500">
                {script.length}/{MAX_SCRIPT_CHARS} characters
              </p>
              {formErrors.script && (
                <p className="text-sm text-red-500">{formErrors.script}</p>
              )}
            </div>

            {/* 3. Product Image (optional) */}
            <div className="space-y-2">
              <Label>Product Image (optional)</Label>
              <div
                onDrop={handleImageDrop}
                onDragOver={(e) => e.preventDefault()}
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  imagePreview
                    ? "border-orange-200 dark:border-orange-900/50 bg-orange-50/50 dark:bg-orange-950/20"
                    : "border-slate-200 dark:border-slate-700 hover:border-orange-300 dark:hover:border-orange-800"
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
                    <p className="text-sm text-slate-600 dark:text-slate-400 truncate max-w-xs mx-auto">{productImage?.name}</p>
                    <label htmlFor="script-checker-image">
                      <Button type="button" variant="outline" size="sm" asChild>
                        <span className="cursor-pointer">Change image</span>
                      </Button>
                    </label>
                  </div>
                ) : (
                  <label htmlFor="script-checker-image" className="cursor-pointer block">
                    <Upload className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Drag & drop or click to upload
                    </p>
                    <p className="text-xs text-slate-500 mt-1">JPG, PNG, WebP — max 5MB</p>
                  </label>
                )}
              </div>
              <p className="text-xs text-slate-500">
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

      {/* Results section (placeholder) */}
      {submitted && (
        <Card className="border-slate-200 dark:border-slate-800 mt-8">
          <CardHeader>
            <CardTitle className="text-xl">Results</CardTitle>
            <CardDescription>
              Compliance analysis for your script
            </CardDescription>
          </CardHeader>
          <CardContent>
            {analyzing ? (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-4" />
                <p className="text-slate-600 dark:text-slate-400">
                  Analyzing script for compliance issues...
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-500 py-4">
                Results will be shown here. (Next step: build results UI)
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  );
}
