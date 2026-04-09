"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  Upload,
  FileText,
  Image,
  X,
  Check,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Package,
  Sparkles,
} from "lucide-react";

// File type display names
const FILE_TYPE_LABELS: Record<string, string> = {
  "application/pdf": "PDF",
  "application/zip": "ZIP",
  "application/x-zip-compressed": "ZIP",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word Doc",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PowerPoint",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
  "application/epub+zip": "EPUB",
  "image/png": "PNG",
  "image/jpeg": "JPG",
  "image/webp": "WEBP",
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Step = 1 | 2 | 3;

export default function UploadProductClient() {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>(1);

  // Product file
  const [productFile, setProductFile] = useState<File | null>(null);
  const [productFileUrl, setProductFileUrl] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);
  const [fileDragOver, setFileDragOver] = useState(false);
  const productFileRef = useRef<HTMLInputElement>(null);

  // Cover image
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [uploadingCover, setUploadingCover] = useState(false);
  const coverFileRef = useRef<HTMLInputElement>(null);

  // Product details
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceLabel, setPriceLabel] = useState("");

  // Submission
  const [submitting, setSubmitting] = useState(false);

  // ── File upload handlers ────────────────────────────────────────────────

  const uploadProductFile = useCallback(async (file: File) => {
    setUploadingFile(true);
    setProductFile(file);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload/product-file", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setProductFileUrl(data.url);
      toast({ title: "File uploaded ✓" });
    } catch (err) {
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : "Try again", variant: "destructive" });
      setProductFile(null);
    } finally {
      setUploadingFile(false);
    }
  }, [toast]);

  const uploadCoverImage = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    setUploadingCover(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", "product-cover");
      const res = await fetch("/api/upload/store-image", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setCoverUrl(data.url);
    } catch (err) {
      toast({ title: "Cover upload failed", description: err instanceof Error ? err.message : "Try again", variant: "destructive" });
    } finally {
      setUploadingCover(false);
    }
  }, [toast]);

  // ── Drag & drop ─────────────────────────────────────────────────────────

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setFileDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadProductFile(file);
  }, [uploadProductFile]);

  // ── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!title.trim()) { toast({ title: "Product name is required", variant: "destructive" }); return; }
    if (!productFileUrl) { toast({ title: "Please upload your product file first", variant: "destructive" }); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/products/create-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          fileUrl: productFileUrl,
          fileName: productFile?.name ?? null,
          fileType: productFile?.type ?? null,
          coverImageUrl: coverUrl || null,
          priceLabel: priceLabel.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create product");

      toast({ title: "Product listed! 🎉", description: "You can now set pricing, publish to Stripe, and more." });
      router.push(`/dashboard/digital-products/${data.id}/edit`);
    } catch (err) {
      toast({ title: "Failed", description: err instanceof Error ? err.message : "Something went wrong", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  const steps = [
    { n: 1, label: "Upload file" },
    { n: 2, label: "Product details" },
    { n: 3, label: "Cover & price" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0B0B0F]">
      <div className="max-w-2xl mx-auto px-4 py-10">

        {/* Back */}
        <button
          type="button"
          onClick={() => router.push("/dashboard/digital-products")}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-orange-500 transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" /> Back to products
        </button>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
              <Upload className="w-5 h-5 text-orange-500" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Upload Your Product</h1>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Sell any digital product you&apos;ve already made — Canva PDF, Notion template, ZIP, course slides, and more.
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={s.n} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${
                step > s.n ? "bg-green-500 text-white" :
                step === s.n ? "bg-orange-500 text-white" :
                "bg-gray-200 dark:bg-white/10 text-gray-400"
              }`}>
                {step > s.n ? <Check className="w-3.5 h-3.5" /> : s.n}
              </div>
              <span className={`text-xs font-medium hidden sm:block ${step === s.n ? "text-orange-500" : "text-gray-400"}`}>
                {s.label}
              </span>
              {i < steps.length - 1 && (
                <div className={`flex-1 h-px mx-2 ${step > s.n ? "bg-green-300" : "bg-gray-200 dark:bg-white/10"}`} />
              )}
            </div>
          ))}
        </div>

        {/* ── STEP 1: Upload file ── */}
        {step === 1 && (
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-gray-200 dark:border-white/10 p-6 space-y-6">
            <div>
              <h2 className="font-bold text-gray-900 dark:text-white text-lg mb-1">Upload your product file</h2>
              <p className="text-sm text-gray-500">PDF, ZIP, DOCX, PPTX, XLSX, EPUB — max 50MB</p>
            </div>

            {!productFile ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setFileDragOver(true); }}
                onDragLeave={() => setFileDragOver(false)}
                onDrop={handleFileDrop}
                onClick={() => productFileRef.current?.click()}
                className={`rounded-xl border-2 border-dashed p-12 text-center cursor-pointer transition-all ${
                  fileDragOver
                    ? "border-orange-400 bg-orange-50 dark:bg-orange-500/10"
                    : "border-gray-200 dark:border-white/10 hover:border-orange-300 hover:bg-orange-50/50 dark:hover:bg-orange-500/5"
                }`}
              >
                <div className="w-14 h-14 rounded-2xl bg-orange-500/10 flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-7 h-7 text-orange-500" />
                </div>
                <p className="font-semibold text-gray-900 dark:text-white mb-1">
                  {fileDragOver ? "Drop it here!" : "Drop your file here"}
                </p>
                <p className="text-sm text-gray-400 mb-4">or click to browse</p>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {["PDF", "ZIP", "DOCX", "PPTX", "XLSX", "EPUB"].map((ext) => (
                    <span key={ext} className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 font-mono">
                      .{ext.toLowerCase()}
                    </span>
                  ))}
                </div>
                <input
                  ref={productFileRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.zip,.docx,.pptx,.xlsx,.epub,.png,.jpg,.webp"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadProductFile(f);
                    e.target.value = "";
                  }}
                />
              </div>
            ) : (
              <div className={`rounded-xl border border-gray-200 dark:border-white/10 p-4 ${uploadingFile ? "bg-orange-50 dark:bg-orange-500/5" : "bg-green-50 dark:bg-green-500/5 border-green-200 dark:border-green-500/20"}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${uploadingFile ? "bg-orange-100 dark:bg-orange-500/10" : "bg-green-100 dark:bg-green-500/10"}`}>
                    {uploadingFile ? <Loader2 className="w-5 h-5 text-orange-500 animate-spin" /> : <FileText className="w-5 h-5 text-green-600 dark:text-green-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{productFile.name}</p>
                    <p className="text-xs text-gray-400">
                      {FILE_TYPE_LABELS[productFile.type] ?? "File"} · {formatBytes(productFile.size)}
                      {uploadingFile ? " · Uploading…" : " · Ready ✓"}
                    </p>
                  </div>
                  {!uploadingFile && (
                    <button
                      type="button"
                      onClick={() => { setProductFile(null); setProductFileUrl(""); }}
                      className="w-7 h-7 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 flex-shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            <Button
              onClick={() => setStep(2)}
              disabled={!productFileUrl || uploadingFile}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white h-12 text-base font-semibold"
            >
              Continue <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </div>
        )}

        {/* ── STEP 2: Product details ── */}
        {step === 2 && (
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-gray-200 dark:border-white/10 p-6 space-y-5">
            <div>
              <h2 className="font-bold text-gray-900 dark:text-white text-lg mb-1">Product details</h2>
              <p className="text-sm text-gray-500">Give your product a name and description for your store page.</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Product name <span className="text-orange-500">*</span>
              </Label>
              <Input
                placeholder="e.g. Social Media Caption Pack, Canva Budget Planner…"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="border-gray-200 dark:border-white/10 focus-visible:ring-orange-500 h-11"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Description <span className="text-gray-400 font-normal text-xs">(optional but recommended)</span>
                </Label>
                <span className="text-xs text-gray-400">{description.length}/500</span>
              </div>
              <Textarea
                placeholder="What's inside? Who is it for? What problem does it solve?"
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 500))}
                className="border-gray-200 dark:border-white/10 focus-visible:ring-orange-500 min-h-32 resize-none text-sm"
              />
            </div>

            {/* What's in the file tip */}
            <div className="flex items-start gap-3 rounded-xl bg-orange-50 dark:bg-orange-500/10 border border-orange-100 dark:border-orange-500/20 p-4">
              <Sparkles className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-orange-700 dark:text-orange-400 mb-0.5">Tip</p>
                <p className="text-xs text-orange-600 dark:text-orange-300">
                  After creating, you can generate AI marketing copy (title, description, hashtags) and set up Stripe payments from the product editor.
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1 border-gray-200 dark:border-white/10">
                <ArrowLeft className="mr-2 w-4 h-4" /> Back
              </Button>
              <Button
                onClick={() => setStep(3)}
                disabled={!title.trim()}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
              >
                Continue <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Cover image & price ── */}
        {step === 3 && (
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-gray-200 dark:border-white/10 p-6 space-y-5">
            <div>
              <h2 className="font-bold text-gray-900 dark:text-white text-lg mb-1">Cover image & price</h2>
              <p className="text-sm text-gray-500">Add a cover photo and set your price. Both can be changed later.</p>
            </div>

            {/* Cover image */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Cover image <span className="text-gray-400 font-normal text-xs">(optional)</span>
              </Label>
              <p className="text-xs text-gray-400">Shown on your store and product page. JPG, PNG, WEBP — max 5MB.</p>

              {coverPreview ? (
                <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={coverPreview} alt="Cover" className="w-full max-h-52 object-cover" />
                  {uploadingCover && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => { setCoverFile(null); setCoverPreview(""); setCoverUrl(""); }}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => coverFileRef.current?.click()}
                  className="rounded-xl border-2 border-dashed border-gray-200 dark:border-white/10 p-8 text-center cursor-pointer hover:border-orange-300 hover:bg-orange-50/50 dark:hover:bg-orange-500/5 transition-all"
                >
                  <Image className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Click to upload a cover image</p>
                  <p className="text-xs text-gray-300 mt-0.5">Your product thumbnail from Canva works great here</p>
                </div>
              )}
              <input
                ref={coverFileRef}
                type="file"
                className="hidden"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadCoverImage(f);
                  e.target.value = "";
                }}
              />
            </div>

            {/* Price */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Price <span className="text-gray-400 font-normal text-xs">(optional — can set later)</span>
              </Label>
              <Input
                placeholder="e.g. £19, $27, Free"
                value={priceLabel}
                onChange={(e) => setPriceLabel(e.target.value)}
                className="border-gray-200 dark:border-white/10 focus-visible:ring-orange-500 h-11"
              />
              <p className="text-xs text-gray-400">
                After creating, go to the product editor to set up Stripe payments and start selling natively.
              </p>
            </div>

            <div className="flex gap-3 pt-1">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1 border-gray-200 dark:border-white/10">
                <ArrowLeft className="mr-2 w-4 h-4" /> Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || uploadingCover}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold"
              >
                {submitting ? (
                  <><Loader2 className="mr-2 w-4 h-4 animate-spin" /> Creating…</>
                ) : (
                  <><Package className="mr-2 w-4 h-4" /> List product</>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* File summary (persistent) */}
        {step > 1 && productFile && (
          <div className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-white/10">
            <FileText className="w-4 h-4 text-orange-400 flex-shrink-0" />
            <p className="text-xs text-gray-500 truncate flex-1">{productFile.name}</p>
            <span className="text-xs text-gray-400 flex-shrink-0">{formatBytes(productFile.size)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
