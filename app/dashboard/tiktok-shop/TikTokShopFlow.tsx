"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Upload, ArrowRight, Library, Loader2, CheckCircle, ExternalLink, Download, RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const PROGRESS_STAGES = [
  { label: "Analyzing product...", pct: 20 },
  { label: "Generating script...", pct: 40 },
  { label: "Creating voiceover...", pct: 60 },
  { label: "Rendering video...", pct: 95 },
  { label: "Finalizing...", pct: 100 },
] as const;

const MAX_IMAGE_SIZE_MB = 5;
const MAX_IMAGE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ACCEPTED_IMAGE_EXT = ".jpg,.jpeg,.png,.webp";

type VideoStyle = "unboxing" | "demo" | "before-after";

const PLATFORMS = [
  { id: "tiktok", label: "TikTok Shop", defaultChecked: true },
  { id: "instagram", label: "Instagram Reels", defaultChecked: false },
  { id: "youtube", label: "YouTube Shorts", defaultChecked: false },
] as const;

export default function TikTokShopFlow() {
  const [productLink, setProductLink] = useState("");
  const [productImage, setProductImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [productDescription, setProductDescription] = useState("");
  const [videoStyle, setVideoStyle] = useState<VideoStyle>("unboxing");
  const [platforms, setPlatforms] = useState<Record<string, boolean>>({
    tiktok: true,
    instagram: false,
    youtube: false,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [progressStage, setProgressStage] = useState(0);
  const [progressPct, setProgressPct] = useState(0);
  const [generated, setGenerated] = useState<{
    title: string;
    videoUrl: string;
    thumbnailDataUrl: string | null;
  } | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [savingToLibrary, setSavingToLibrary] = useState(false);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();

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

  const handlePlatformChange = (id: string, checked: boolean) => {
    setPlatforms((prev) => ({ ...prev, [id]: checked }));
  };

  const getProductImageUrl = async (): Promise<string | undefined> => {
    if (!productImage) return undefined;
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
      reader.onload = async () => {
        const base64 = reader.result as string;
        try {
          const res = await fetch("/api/goals/proof-upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageBase64: base64 }),
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok && data.url) resolve(data.url);
          else resolve(undefined);
        } catch {
          resolve(undefined);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(productImage);
    });
  };

  const saveToLibrary = async (title: string, videoUrl: string, platformsList: string[]) => {
    const res = await fetch("/api/library/videos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        thumbnailUrl: videoUrl,
        platforms: platformsList.length ? platformsList : ["tiktok"],
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Failed to save to library");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!productLink.trim()) errors.productLink = "Product link is required.";
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    setGenerated(null);
    setGenerateError(null);
    setProgressStage(0);
    setProgressPct(0);
    toast({ title: "Video generation started...", description: "This may take a minute or two." });

    const progressInterval = setInterval(() => {
      setProgressStage((prev) => {
        const next = Math.min(prev + 1, PROGRESS_STAGES.length - 1);
        setProgressPct(PROGRESS_STAGES[next].pct);
        return next;
      });
    }, 4000);
    progressIntervalRef.current = progressInterval;

    try {
      let productImageUrl: string | undefined;
      try {
        productImageUrl = await getProductImageUrl();
      } catch {
        productImageUrl = undefined;
      }

      const platformsList = Object.entries(platforms)
        .filter(([, v]) => v)
        .map(([k]) => k);

      const res = await fetch("/api/tiktok-shop/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productLink: productLink.trim(),
          productImage: productImageUrl,
          productDescription: productDescription.trim() || undefined,
          videoStyle,
          platforms: platformsList.length ? platformsList : ["tiktok"],
        }),
      });

      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      setProgressStage(PROGRESS_STAGES.length - 1);
      setProgressPct(100);

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data.error ?? "Video generation failed";
        setGenerateError(msg);
        toast({ title: "Generation failed", description: msg, variant: "destructive" });
        setSubmitting(false);
        return;
      }

      const videoUrl = data.videoUrl as string | undefined;
      if (!videoUrl) {
        setGenerateError("No video URL returned");
        toast({ title: "Error", description: "No video URL returned", variant: "destructive" });
        setSubmitting(false);
        return;
      }

      const title = productDescription.trim()
        ? productDescription.slice(0, 80) + (productDescription.length > 80 ? "…" : "")
        : (() => {
            try {
              return new URL(productLink).hostname.replace("www.", "") + " – TikTok Shop Video";
            } catch {
              return "TikTok Shop Video";
            }
          })();

      setGenerated({
        title,
        videoUrl,
        thumbnailDataUrl: imagePreview,
      });

      try {
        setSavingToLibrary(true);
        await saveToLibrary(title, videoUrl, platformsList);
        toast({ title: "Video ready! Check your library", description: "Saved to My Library." });
      } catch (err) {
        toast({
          title: "Video ready",
          description: "Could not save to library. You can still download.",
          variant: "default",
        });
      } finally {
        setSavingToLibrary(false);
      }
    } catch (err) {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      const msg = err instanceof Error ? err.message : "Video generation failed";
      setGenerateError(msg);
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveToLibrary = async () => {
    if (!generated) return;
    setSavingToLibrary(true);
    try {
      const platformsList = Object.entries(platforms)
        .filter(([, v]) => v)
        .map(([k]) => k);
      await saveToLibrary(generated.title, generated.videoUrl, platformsList);
      toast({ title: "Saved to Library", description: "Your video is now in My Library." });
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

  return (
    <main className="p-6 md:p-10 max-w-3xl mx-auto">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-orange-500 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to dashboard
      </Link>

      {/* Step progress: Step 1 of 3 */}
      <div className="flex items-center gap-2 mb-8">
        <div className="flex items-center gap-1.5">
          <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm font-semibold">
            1
          </div>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Step 1 of 3</span>
        </div>
        <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700 max-w-[80px]" />
        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-sm text-slate-500">
          2
        </div>
        <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700 max-w-[80px]" />
        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-sm text-slate-500">
          3
        </div>
      </div>

      <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
        Generate TikTok Shop Video
      </h1>
      <p className="text-slate-600 dark:text-slate-400 mb-10">
        Create product demo videos optimized for TikTok Shop sales
      </p>

      <form onSubmit={handleSubmit}>
        <Card className="border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="text-xl">Product details</CardTitle>
            <CardDescription>
              Add your product link and optional details. We&apos;ll use this to create your video.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* 1. Product Link */}
            <div className="space-y-2">
              <Label htmlFor="productLink">TikTok Shop or Product Link *</Label>
              <Input
                id="productLink"
                type="url"
                placeholder="Paste your TikTok Shop product link, Amazon link, or any product URL"
                value={productLink}
                onChange={(e) => {
                  setProductLink(e.target.value);
                  setFormErrors((prev) => ({ ...prev, productLink: "" }));
                }}
                className={formErrors.productLink ? "border-red-500" : ""}
              />
              <p className="text-xs text-slate-500">We&apos;ll fetch product details automatically</p>
              {formErrors.productLink && (
                <p className="text-sm text-red-500">{formErrors.productLink}</p>
              )}
            </div>

            {/* 2. Product Image (optional) */}
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
                  id="tiktok-product-image"
                />
                {imagePreview ? (
                  <div className="space-y-2">
                    <img
                      src={imagePreview}
                      alt="Product"
                      className="max-h-32 mx-auto rounded-lg object-contain"
                    />
                    <p className="text-sm text-slate-600 dark:text-slate-400">{productImage?.name}</p>
                    <label htmlFor="tiktok-product-image">
                      <Button type="button" variant="outline" size="sm" asChild>
                        <span className="cursor-pointer">Change image</span>
                      </Button>
                    </label>
                  </div>
                ) : (
                  <label htmlFor="tiktok-product-image" className="cursor-pointer block">
                    <Upload className="w-9 h-9 mx-auto text-slate-400 mb-2" />
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Drag & drop or click to upload
                    </p>
                    <p className="text-xs text-slate-500 mt-1">JPG, PNG, WebP — max 5MB</p>
                  </label>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Upload a product photo if the link doesn&apos;t have good images
              </p>
              {formErrors.productImage && (
                <p className="text-sm text-red-500">{formErrors.productImage}</p>
              )}
            </div>

            {/* 3. Product Description (optional) */}
            <div className="space-y-2">
              <Label htmlFor="productDescription">Product Description (optional)</Label>
              <Textarea
                id="productDescription"
                placeholder="Add details about the product, key features, benefits..."
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-slate-500">
                The more detail, the better the AI scripts. Or leave blank and we&apos;ll extract from the link.
              </p>
            </div>

            {/* 4. Video Style */}
            <div className="space-y-3">
              <Label>Video Style</Label>
              <RadioGroup
                value={videoStyle}
                onValueChange={(v: VideoStyle) => setVideoStyle(v)}
                className="flex flex-col gap-3"
              >
                <div className="flex items-start gap-3 rounded-lg border border-slate-200 dark:border-slate-700 p-3 hover:border-orange-200 dark:hover:border-orange-900/50">
                  <RadioGroupItem value="unboxing" id="style-unboxing" className="mt-0.5" />
                  <label htmlFor="style-unboxing" className="cursor-pointer flex-1">
                    <span className="font-medium text-slate-900 dark:text-white">Unboxing & Review</span>
                    <p className="text-xs text-slate-500 mt-0.5">Show product reveal, test it</p>
                  </label>
                </div>
                <div className="flex items-start gap-3 rounded-lg border border-slate-200 dark:border-slate-700 p-3 hover:border-orange-200 dark:hover:border-orange-900/50">
                  <RadioGroupItem value="demo" id="style-demo" className="mt-0.5" />
                  <label htmlFor="style-demo" className="cursor-pointer flex-1">
                    <span className="font-medium text-slate-900 dark:text-white">Product Demo</span>
                    <p className="text-xs text-slate-500 mt-0.5">Show how it works, key features</p>
                  </label>
                </div>
                <div className="flex items-start gap-3 rounded-lg border border-slate-200 dark:border-slate-700 p-3 hover:border-orange-200 dark:hover:border-orange-900/50">
                  <RadioGroupItem value="before-after" id="style-before-after" className="mt-0.5" />
                  <label htmlFor="style-before-after" className="cursor-pointer flex-1">
                    <span className="font-medium text-slate-900 dark:text-white">Before/After</span>
                    <p className="text-xs text-slate-500 mt-0.5">Show problem → solution</p>
                  </label>
                </div>
              </RadioGroup>
            </div>

            {/* 5. Target Platform */}
            <div className="space-y-3">
              <Label>Optimize for</Label>
              <p className="text-xs text-slate-500 mb-2">Select all platforms you want to optimize for</p>
              <div className="flex flex-col gap-2">
                {PLATFORMS.map(({ id, label, defaultChecked }) => (
                  <div key={id} className="flex items-center gap-3">
                    <Checkbox
                      id={`platform-${id}`}
                      checked={platforms[id] ?? defaultChecked}
                      onCheckedChange={(checked) => handlePlatformChange(id, checked === true)}
                    />
                    <label
                      htmlFor={`platform-${id}`}
                      className="text-sm font-medium text-slate-900 dark:text-white cursor-pointer"
                    >
                      {label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {submitting && (
              <div className="space-y-2">
                <Progress value={progressPct} className="h-2" />
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {PROGRESS_STAGES[progressStage]?.label ?? "Processing..."}
                </p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-orange-500 hover:bg-orange-600 text-white h-12 text-base font-medium gap-2"
              size="lg"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {PROGRESS_STAGES[progressStage]?.label ?? "Processing..."}
                </>
              ) : (
                <>
                  Generate TikTok Shop Video
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </form>

      {generateError && !submitting && (
        <Card className="border-red-200 dark:border-red-900/50 mt-8">
          <CardHeader>
            <CardTitle className="text-lg text-red-700 dark:text-red-400">Generation failed</CardTitle>
            <CardDescription>
              {generateError}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => {
                setGenerateError(null);
                handleSubmit({ preventDefault: () => {} } as React.FormEvent);
              }}
            >
              <RefreshCw className="w-4 h-4" />
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {generated && (
        <Card className="border-slate-200 dark:border-slate-800 mt-8">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-green-500" />
              Video ready
            </CardTitle>
            <CardDescription>
              Your TikTok Shop video has been generated and saved to your library.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-900">
              <video
                src={generated.videoUrl}
                controls
                className="w-full aspect-[9/16] max-h-[70vh] object-contain"
                playsInline
              >
                Your browser does not support the video tag.
              </video>
            </div>
            <p className="font-medium text-slate-900 dark:text-white truncate">{generated.title}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="default"
                className="gap-2 bg-orange-500 hover:bg-orange-600"
                asChild
              >
                <a href={generated.videoUrl} download target="_blank" rel="noopener noreferrer">
                  <Download className="w-4 h-4" />
                  Download video
                </a>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleSaveToLibrary}
                disabled={savingToLibrary}
                className="gap-2"
              >
                {savingToLibrary ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Library className="w-4 h-4" />
                )}
                Save to Library again
              </Button>
              <Button type="button" variant="ghost" size="sm" asChild>
                <Link href="/dashboard/library" className="gap-2">
                  <ExternalLink className="w-4 h-4" />
                  View My Library
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
