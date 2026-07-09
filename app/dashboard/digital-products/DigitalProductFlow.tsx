"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Package,
  ArrowLeft,
  Upload,
  Copy,
  Check,
  Loader2,
  Play,
  Download,
  RefreshCw,
  FileVideo,
} from "lucide-react";

const MAX_FILE_SIZE_MB = 500;
const MAX_FILE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ACCEPTED_FILE_EXTENSIONS = ".pdf,.epub,.zip,.docx,.pptx,.xlsx";
const ACCEPTED_FILE_TYPES = [
  "application/pdf",
  "application/epub+zip",
  "application/zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type ProductType = "digital" | "physical" | "service";
type Step = 1 | 2 | 3;

interface ScriptVariation {
  id: string;
  platform: string;
  hook: string;
  body: string;
  cta: string;
  estimatedLength: string;
}

// Mock script variations for demo
const MOCK_SCRIPTS: ScriptVariation[] = [
  {
    id: "tiktok-1",
    platform: "TikTok",
    hook: "Stop scrolling. This changed how I make money online.",
    body: "I used to think you needed a huge audience. Then I found this one method that works with zero followers. It's a digital product that teaches you exactly how to sell without the algorithm holding you back. No more hoping for viral—just consistent sales.",
    cta: "Link in bio. Get it before the price goes up.",
    estimatedLength: "45 sec",
  },
  {
    id: "instagram-1",
    platform: "Instagram",
    hook: "The same product that made me $10K last month is now open for 48 hours.",
    body: "If you've been waiting to get your hands on this, now's the time. It's a step-by-step system for turning your expertise into a product people actually buy. Reels, stories, DMs—everything you need to launch without the guesswork.",
    cta: "Tap the link in my bio. Only 50 spots at this price.",
    estimatedLength: "60 sec",
  },
  {
    id: "youtube-1",
    platform: "YouTube",
    hook: "In this video I'm showing you the exact framework I use to sell digital products without a big list.",
    body: "We'll cover the three pillars: offer design, content that converts, and the tech stack that actually works. By the end you'll have a clear path to your first—or next—launch. No fluff, just what's working right now.",
    cta: "The full breakdown and templates are in the description. Subscribe and hit the bell so you don't miss the next part.",
    estimatedLength: "90 sec",
  },
];

// Mock captions per platform
const MOCK_CAPTIONS = [
  { platform: "TikTok", text: "Stop scrolling 👀 This changed how I make money online. Link in bio for the method that works with ZERO followers. #digitalproducts #makemoneyonline" },
  { platform: "Instagram", text: "The same product that made me $10K last month is open for 48 hours. Tap link in bio 👆 #sidehustle #digitalproducts" },
  { platform: "YouTube", text: "Exact framework to sell digital products without a big list. Full breakdown + templates in description. Subscribe for part 2!" },
];

export default function DigitalProductFlow() {
  const [step, setStep] = useState<Step>(1);
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productFileOrLinkMode, setProductFileOrLinkMode] = useState<"file" | "link">("file");
  const [productFile, setProductFile] = useState<File | null>(null);
  const [productSalesPageLink, setProductSalesPageLink] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [productType, setProductType] = useState<ProductType>("digital");

  const [scriptLoading, setScriptLoading] = useState(false);
  const [scripts, setScripts] = useState<ScriptVariation[]>([]);
  const [selectedScriptId, setSelectedScriptId] = useState<string>("");
  const [editingScript, setEditingScript] = useState<string | null>(null);

  const [videoLoading, setVideoLoading] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoComplete, setVideoComplete] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState<string | null>(null);

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const router = useRouter();

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("discoveryPrefill");
      if (!raw) return;
      const data = JSON.parse(raw) as { productName?: string; productDescription?: string };
      if (data.productName) setProductName(data.productName);
      if (data.productDescription) setProductDescription(data.productDescription);
      sessionStorage.removeItem("discoveryPrefill");
    } catch {
      // ignore
    }
  }, []);

  const validateStep1 = useCallback(() => {
    const errors: Record<string, string> = {};
    if (!productName.trim()) errors.productName = "Product name is required.";
    if (productFileOrLinkMode === "file") {
      if (!productFile) errors.productFileOrLink = "Please upload a file or switch to Paste Link.";
    } else {
      if (!productSalesPageLink.trim()) errors.productFileOrLink = "Please enter your sales page URL.";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [productName, productFileOrLinkMode, productFile, productSalesPageLink]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
      setFormErrors((prev) => ({ ...prev, productFileOrLink: "Please use a valid file (PDF, EPUB, ZIP, DOCX, PPTX, XLSX)." }));
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setFormErrors((prev) => ({ ...prev, productFileOrLink: `File must be under ${MAX_FILE_SIZE_MB}MB.` }));
      return;
    }
    setFormErrors((prev) => ({ ...prev, productFileOrLink: "" }));
    setProductFile(file);
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
      setFormErrors((prev) => ({ ...prev, productFileOrLink: "Please use a valid file (PDF, EPUB, ZIP, DOCX, PPTX, XLSX)." }));
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setFormErrors((prev) => ({ ...prev, productFileOrLink: `File must be under ${MAX_FILE_SIZE_MB}MB.` }));
      return;
    }
    setFormErrors((prev) => ({ ...prev, productFileOrLink: "" }));
    setProductFile(file);
  };

  const handleFileDragOver = (e: React.DragEvent<HTMLDivElement>) => e.preventDefault();

  const handleGoToScripts = () => {
    if (!validateStep1()) return;
    setFormErrors({});
    const productData = {
      productName: productName.trim(),
      productDescription: productDescription.trim(),
      productType,
      productFileOrLinkMode,
      productSalesPageLink: productSalesPageLink.trim(),
      productUrl: productUrl.trim(),
      hasFile: !!productFile,
      fileName: productFile?.name ?? "",
    };
    try {
      sessionStorage.setItem("digitalProductForm", JSON.stringify(productData));
    } catch {
      // ignore storage errors
    }
    router.push("/dashboard/digital-products/scripts");
  };

  const handleGenerateVideo = () => {
    if (!selectedScriptId) return;
    setVideoLoading(true);
    setVideoProgress(0);
    const interval = setInterval(() => {
      setVideoProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          setVideoLoading(false);
          setVideoComplete(true);
          return 100;
        }
        return p + Math.random() * 12 + 5;
      });
    }, 800);
  };

  const copyScript = (script: ScriptVariation) => {
    const full = [script.hook, script.body, script.cta].join("\n\n");
    navigator.clipboard.writeText(full);
  };

  const copyCaption = (text: string, platform: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCaption(platform);
    setTimeout(() => setCopiedCaption(null), 2000);
  };

  const resetFlow = () => {
    setStep(1);
    setProductName("");
    setProductDescription("");
    setProductFileOrLinkMode("file");
    setProductFile(null);
    setProductSalesPageLink("");
    setProductUrl("");
    setProductType("digital");
    setScripts([]);
    setSelectedScriptId("");
    setScriptLoading(false);
    setVideoLoading(false);
    setVideoProgress(0);
    setVideoComplete(false);
    setFormErrors({});
  };

  const selectedScript = scripts.find((s) => s.id === selectedScriptId);

  return (
    <main className="px-4 py-6 md:px-10 md:py-10 max-w-4xl mx-auto pb-mobile-nav">
      <Link
        href="/dashboard/digital-products"
        className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-orange-500 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Digital Products
      </Link>

      {/* Step progress */}
      <div className="flex items-center gap-2 mb-10">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                step >= s
                  ? "bg-orange-500 text-white"
                  : "bg-slate-200 dark:bg-slate-700 text-slate-500"
              }`}
            >
              {step > s ? <Check className="w-4 h-4" /> : s}
            </div>
            {s < 3 && <div className="w-8 h-px bg-slate-200 dark:bg-slate-700" />}
          </div>
        ))}
        <span className="ml-3 text-sm text-slate-500 dark:text-slate-400">
          {step === 1 && "Product details"}
          {step === 2 && "Choose script"}
          {step === 3 && "Your video"}
        </span>
      </div>

      <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
        Create Digital Product Video
      </h1>
      <p className="text-slate-600 dark:text-slate-400 mb-10">
        Flow 1 — Turn your product into conversion-focused video scripts, then generate your video.
      </p>

      {/* Step 1: Product input */}
      {step === 1 && (
        <Card className="border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-orange-500" />
              Product details
            </CardTitle>
            <CardDescription>
              Enter your product information. We&apos;ll use this to generate video scripts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="productName">Product name *</Label>
              <Input
                id="productName"
                placeholder="e.g. Ultimate Copywriting Course"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className={formErrors.productName ? "border-red-500" : ""}
              />
              {formErrors.productName && (
                <p className="text-sm text-red-500">{formErrors.productName}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="productDescription">Product description (optional but recommended)</Label>
              <Textarea
                id="productDescription"
                placeholder="Describe what your product is, who it's for, and the main benefits..."
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                rows={4}
              />
              <p className="text-xs text-slate-500">The more detail you provide, the better your video scripts will be. Character count: {productDescription.length}</p>
            </div>
            <div className="space-y-3">
              <div>
                <Label>Product File or Link *</Label>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  Upload your digital product (PDF, ebook, template) or paste a link to your sales page
                </p>
              </div>
              <RadioGroup
                value={productFileOrLinkMode}
                onValueChange={(v: "file" | "link") => {
                  setProductFileOrLinkMode(v);
                  setFormErrors((prev) => ({ ...prev, productFileOrLink: "" }));
                }}
                className="flex flex-col gap-4"
              >
                <div className="flex items-start gap-3">
                  <RadioGroupItem value="file" id="mode-file" className="mt-1" />
                  <label htmlFor="mode-file" className="flex-1 cursor-pointer">
                    <span className="font-medium text-slate-900 dark:text-white">Upload File</span>
                    {productFileOrLinkMode === "file" && (
                      <div
                        onDrop={handleFileDrop}
                        onDragOver={handleFileDragOver}
                        className={`mt-2 border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                          productFile
                            ? "border-orange-200 dark:border-orange-900/50 bg-orange-50/50 dark:bg-orange-950/20"
                            : "border-slate-200 dark:border-slate-700 hover:border-orange-300 dark:hover:border-orange-800"
                        } ${formErrors.productFileOrLink ? "border-red-500" : ""}`}
                      >
                        <input
                          type="file"
                          accept={ACCEPTED_FILE_EXTENSIONS}
                          onChange={handleFileChange}
                          className="hidden"
                          id="product-file"
                        />
                        {productFile ? (
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-slate-900 dark:text-white">{productFile.name}</p>
                            <p className="text-xs text-slate-500">{formatFileSize(productFile.size)}</p>
                            <label htmlFor="product-file">
                              <Button type="button" variant="outline" size="sm" asChild>
                                <span className="cursor-pointer">Change file</span>
                              </Button>
                            </label>
                          </div>
                        ) : (
                          <label htmlFor="product-file" className="cursor-pointer block">
                            <Upload className="w-10 h-10 mx-auto text-slate-400 mb-2" />
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              Drag & drop here, or click to browse
                            </p>
                            <p className="text-xs text-slate-500 mt-1">PDF, EPUB, ZIP, DOCX, PPTX, XLSX — max {MAX_FILE_SIZE_MB}MB</p>
                          </label>
                        )}
                      </div>
                    )}
                  </label>
                </div>
                <div className="flex items-start gap-3">
                  <RadioGroupItem value="link" id="mode-link" className="mt-1" />
                  <label htmlFor="mode-link" className="flex-1 cursor-pointer">
                    <span className="font-medium text-slate-900 dark:text-white">Paste Link</span>
                    {productFileOrLinkMode === "link" && (
                      <div className="mt-2 space-y-1.5">
                        <Input
                          type="url"
                          placeholder="https://gumroad.com/your-product or your sales page URL"
                          value={productSalesPageLink}
                          onChange={(e) => {
                            setProductSalesPageLink(e.target.value);
                            setFormErrors((prev) => ({ ...prev, productFileOrLink: "" }));
                          }}
                          className={formErrors.productFileOrLink ? "border-red-500" : ""}
                        />
                        <p className="text-xs text-slate-500">
                          We&apos;ll analyze your sales page to generate better scripts
                        </p>
                      </div>
                    )}
                  </label>
                </div>
              </RadioGroup>
              {formErrors.productFileOrLink && (
                <p className="text-sm text-red-500">{formErrors.productFileOrLink}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="productUrl">Product URL (optional)</Label>
              <Input
                id="productUrl"
                type="url"
                placeholder="https://..."
                value={productUrl}
                onChange={(e) => setProductUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Product type</Label>
              <Select value={productType} onValueChange={(v: ProductType) => setProductType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="digital">Digital product</SelectItem>
                  <SelectItem value="physical">Physical product</SelectItem>
                  <SelectItem value="service">Service</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full bg-orange-500 hover:bg-orange-600"
              size="lg"
              onClick={handleGoToScripts}
            >
              Generate Video Scripts
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Script loading */}
      {step === 2 && scriptLoading && (
        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="py-16 text-center">
            <Loader2 className="w-12 h-12 text-orange-500 animate-spin mx-auto mb-4" />
            <p className="text-slate-600 dark:text-slate-400">
              AI is analyzing your product and generating conversion-focused scripts...
            </p>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Script selection */}
      {step === 2 && !scriptLoading && scripts.length > 0 && (
        <Card className="border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle>Choose a script</CardTitle>
            <CardDescription>
              Select one script to use for your video. You can edit it before generating.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <RadioGroup value={selectedScriptId} onValueChange={setSelectedScriptId}>
              {scripts.map((script) => (
                <div
                  key={script.id}
                  className={`rounded-lg border p-4 transition-colors ${
                    selectedScriptId === script.id
                      ? "border-orange-500 bg-orange-50/50 dark:bg-orange-950/20"
                      : "border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <RadioGroupItem value={script.id} id={script.id} className="mt-1" />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="inline-flex items-center rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-medium">
                          {script.platform}
                        </span>
                        <span className="text-xs text-slate-500">{script.estimatedLength}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-slate-500"
                          onClick={() => copyScript(script)}
                        >
                          <Copy className="w-3.5 h-3.5 mr-1" />
                          Copy
                        </Button>
                      </div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{script.hook}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                        {script.body}
                      </p>
                      <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">{script.cta}</p>
                    </div>
                  </div>
                </div>
              ))}
            </RadioGroup>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={() => selectedScript && setEditingScript(editingScript ? null : selectedScriptId)}
              >
                Edit Script
              </Button>
              <Button
                className="bg-orange-500 hover:bg-orange-600"
                onClick={handleGenerateVideo}
                disabled={!selectedScriptId}
              >
                Create Video Guide
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Video loading */}
      {step === 3 && videoLoading && (
        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="py-16 space-y-6">
            <div className="text-center">
              <Loader2 className="w-12 h-12 text-orange-500 animate-spin mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-400 mb-2">
                Creating your Video Creation Guide...
              </p>
              <Progress value={Math.min(videoProgress, 100)} className="max-w-xs mx-auto h-2" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Video complete */}
      {step === 3 && videoComplete && (
        <Card className="border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileVideo className="w-5 h-5 text-orange-500" />
              Your video is ready
            </CardTitle>
            <CardDescription>
              Preview, copy captions, or generate another variation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="aspect-video max-w-2xl mx-auto rounded-lg overflow-hidden bg-slate-900 flex items-center justify-center">
              <video
                src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"
                controls
                className="w-full h-full"
              >
                Your browser does not support the video tag.
              </video>
            </div>
            <div>
              <h4 className="font-medium text-slate-900 dark:text-white mb-3">Platform captions (ready to copy)</h4>
              <div className="space-y-2">
                {MOCK_CAPTIONS.map(({ platform, text }) => (
                  <div
                    key={platform}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-700 p-3"
                  >
                    <span className="text-xs font-medium text-slate-500 w-20">{platform}</span>
                    <p className="flex-1 text-sm text-slate-700 dark:text-slate-300 truncate">{text}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyCaption(text, platform)}
                    >
                      {copiedCaption === platform ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button className="bg-orange-500 hover:bg-orange-600 gap-2">
                <Download className="w-4 h-4" />
                Download
              </Button>
              <Button variant="outline" className="gap-2">
                <RefreshCw className="w-4 h-4" />
                Generate Another Variation
              </Button>
              <Button variant="outline" onClick={resetFlow} className="gap-2">
                <Play className="w-4 h-4" />
                Start New Video
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
