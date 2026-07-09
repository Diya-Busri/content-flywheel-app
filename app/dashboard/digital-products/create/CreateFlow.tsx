"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Upload } from "lucide-react";

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

type ProductType = "digital" | "physical" | "service" | "course";

export default function CreateFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [creatorExpertise, setCreatorExpertise] = useState("");
  const [mode, setMode] = useState<"file" | "link">("file");
  const [productFile, setProductFile] = useState<File | null>(null);
  const [productSalesPageLink, setProductSalesPageLink] = useState("");
  const [productType, setProductType] = useState<ProductType>("digital");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    // Pre-fill from onboarding wizard URL param (takes priority)
    const topicParam = searchParams.get("topic");
    if (topicParam) {
      setProductName(topicParam);
      return;
    }
    // Fallback: legacy sessionStorage prefill
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
  }, [searchParams]);

  const validate = useCallback(() => {
    const errors: Record<string, string> = {};
    if (!productName.trim()) errors.productName = "Product name is required.";
    if (mode === "file") {
      if (!productFile) errors.productFileOrLink = "Please upload a file or switch to Paste Link.";
    } else {
      if (!productSalesPageLink.trim()) errors.productFileOrLink = "Please enter your sales page URL.";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [productName, mode, productFile, productSalesPageLink]);

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
      setFormErrors((prev) => ({ ...prev, productFileOrLink: "Please use a valid file type." }));
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setFormErrors((prev) => ({ ...prev, productFileOrLink: `File must be under ${MAX_FILE_SIZE_MB}MB.` }));
      return;
    }
    setFormErrors((prev) => ({ ...prev, productFileOrLink: "" }));
    setProductFile(file);
  };

  const handleGoToScripts = () => {
    if (!validate()) return;
    setFormErrors({});
    const productData = {
      productName: productName.trim(),
      productDescription: productDescription.trim(),
      creatorExpertise: creatorExpertise.trim(),
      productType,
      productFileOrLinkMode: mode,
      productSalesPageLink: productSalesPageLink.trim(),
      productUrl: "",
      hasFile: !!productFile,
      fileName: productFile?.name ?? "",
    };
    try {
      sessionStorage.setItem("digitalProductForm", JSON.stringify(productData));
    } catch {
      // ignore
    }
    router.push("/dashboard/digital-products/scripts");
  };

  return (
    <main className="min-h-dvh bg-white dark:bg-[#0F0F0F] text-gray-900 dark:text-white pb-44">
      <div className="max-w-2xl mx-auto px-4 py-6 md:px-10 md:py-10">
        <Link
          href="/dashboard/digital-products"
          className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-[#A0A0A0] hover:text-orange-500 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>

        {/* Step breadcrumb */}
        <div className="flex items-center gap-1.5 mb-3 text-[11px] font-medium">
          <span className="text-orange-500 uppercase tracking-wider">Step 1</span>
          <span className="text-gray-300 dark:text-[#444]">→</span>
          <span className="text-gray-400 dark:text-[#666]">Step 2: Scripts</span>
          <span className="text-gray-300 dark:text-[#444]">→</span>
          <span className="text-gray-400 dark:text-[#666]">Step 3: Review</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-1">Product Details</h1>
        <p className="text-gray-500 dark:text-[#A0A0A0] text-sm mb-3">
          Upload your product file — AI creates video scripts and marketing copy tailored to your offer.
        </p>
        {/* What you'll get strip */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-gray-400 dark:text-[#666] mb-8 border border-gray-100 dark:border-[#1F1F1F] bg-gray-50 dark:bg-[#151515] rounded-xl px-4 py-2.5">
          <span className="font-semibold text-gray-500 dark:text-[#888] text-[10px] uppercase tracking-wider mr-1">You&apos;ll get:</span>
          <span>🎬 Video scripts</span>
          <span className="text-gray-200 dark:text-[#333]">·</span>
          <span>📱 Social captions</span>
          <span className="text-gray-200 dark:text-[#333]">·</span>
          <span>📧 Email copy</span>
          <span className="text-gray-200 dark:text-[#333]">·</span>
          <span>🔖 Hashtags</span>
        </div>

        <div className="space-y-8">
          <div className="space-y-2">
            <Label htmlFor="productName" className="text-gray-900 dark:text-white">Product Name</Label>
            <Input
              id="productName"
              placeholder="e.g., Ultimate Budget Planner"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="bg-white dark:bg-[#1A1A1A] border-gray-200 dark:border-[#2A2A2A] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-[#666] h-11"
            />
            {formErrors.productName && (
              <p className="text-sm text-red-500">{formErrors.productName}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="productDescription" className="text-gray-900 dark:text-white">Product description <span className="text-gray-400 dark:text-[#A0A0A0] font-normal">(optional)</span></Label>
            <Textarea
              id="productDescription"
              placeholder="Describe what your product is, who it's for, and the main benefits..."
              value={productDescription}
              onChange={(e) => setProductDescription(e.target.value)}
              rows={4}
              className="bg-white dark:bg-[#1A1A1A] border-gray-200 dark:border-[#2A2A2A] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-[#666] resize-none"
            />
            <p className="text-xs text-gray-500 dark:text-[#A0A0A0]">
              {productDescription.length > 0 ? (
                <span>
                  <span className={productDescription.length < 80 ? "text-amber-500" : "text-green-500"}>{productDescription.length} chars</span>
                  {productDescription.length < 80 ? " · Add more detail for better scripts" : " · Great — more detail means better AI output"}
                </span>
              ) : (
                "The more detail you provide, the better your video scripts will be."
              )}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="creatorExpertise" className="text-gray-900 dark:text-white">
              Your expertise or unique angle{" "}
              <span className="text-gray-400 dark:text-[#A0A0A0] font-normal">(optional)</span>
            </Label>
            <Textarea
              id="creatorExpertise"
              placeholder="e.g. I've paid off £12k of debt using this method. I'm a finance grad who discovered most budgeting advice is overcomplicated..."
              value={creatorExpertise}
              onChange={(e) => setCreatorExpertise(e.target.value)}
              rows={3}
              className="bg-white dark:bg-[#1A1A1A] border-gray-200 dark:border-[#2A2A2A] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-[#666] resize-none"
            />
            <p className="text-xs text-gray-500 dark:text-[#A0A0A0]">Your personal experience or angle — this makes the AI output sound like <span className="text-orange-500">you</span>, not a generic template.</p>
          </div>

          <div className="space-y-3">
            <Label className="text-gray-900 dark:text-white">Product File or Link</Label>
            <Tabs value={mode} onValueChange={(v) => { setMode(v as "file" | "link"); setFormErrors((prev) => ({ ...prev, productFileOrLink: "" })); }}>
              <TabsList className="bg-gray-100 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#2A2A2A] p-1 gap-1">
                <TabsTrigger value="file" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">Upload File</TabsTrigger>
                <TabsTrigger value="link" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">Paste Link</TabsTrigger>
              </TabsList>
              <TabsContent value="file" className="mt-4">
                <div
                  onDrop={handleFileDrop}
                  onDragOver={(e) => e.preventDefault()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                    productFile
                      ? "border-orange-500/50 bg-orange-500/10"
                      : "border-gray-200 dark:border-[#2A2A2A] hover:border-gray-300 dark:hover:border-[#3A3A3A] bg-gray-50 dark:bg-transparent"
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
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{productFile.name}</p>
                      <p className="text-xs text-gray-500 dark:text-[#A0A0A0]">{formatFileSize(productFile.size)}</p>
                      <label htmlFor="product-file">
                        <Button type="button" variant="outline" size="sm" className="cursor-pointer">
                          Change file
                        </Button>
                      </label>
                    </div>
                  ) : (
                    <label htmlFor="product-file" className="cursor-pointer block">
                      <Upload className="w-12 h-12 mx-auto text-gray-300 dark:text-[#666] mb-3" />
                      <p className="text-sm text-gray-700 dark:text-[#E0E0E0]">Drag & drop your file here</p>
                      <p className="text-sm text-gray-400 dark:text-[#A0A0A0] mt-1">or click to browse</p>
                      <p className="text-xs text-gray-400 dark:text-[#666] mt-3">PDF, EPUB, DOCX, PPTX, XLSX, ZIP</p>
                      <p className="text-xs text-gray-400 dark:text-[#666]">Max {MAX_FILE_SIZE_MB}MB</p>
                    </label>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="link" className="mt-4">
                <Input
                  type="url"
                  placeholder="https://..."
                  value={productSalesPageLink}
                  onChange={(e) => { setProductSalesPageLink(e.target.value); setFormErrors((prev) => ({ ...prev, productFileOrLink: "" })); }}
                  className="bg-white dark:bg-[#1A1A1A] border-gray-200 dark:border-[#2A2A2A] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-[#666] h-11"
                />
                <p className="text-xs text-gray-500 dark:text-[#A0A0A0] mt-2">Paste your Gumroad, Etsy, or sales page URL</p>
              </TabsContent>
            </Tabs>
            {formErrors.productFileOrLink && (
              <p className="text-sm text-red-500">{formErrors.productFileOrLink}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-gray-900 dark:text-white">
              Product Type{" "}
              <span className="text-gray-400 dark:text-[#A0A0A0] font-normal text-xs">(helps tailor your scripts)</span>
            </Label>
            <Select value={productType} onValueChange={(v: ProductType) => setProductType(v)}>
              <SelectTrigger className="bg-white dark:bg-[#1A1A1A] border-gray-200 dark:border-[#2A2A2A]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="digital">Digital Product (eBook, template, PDF…)</SelectItem>
                <SelectItem value="course">Course or Workshop</SelectItem>
                <SelectItem value="service">Service or Coaching</SelectItem>
                <SelectItem value="physical">Physical Product</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 md:left-[220px] z-40 border-t border-gray-200 dark:border-[#2A2A2A] bg-white/95 dark:bg-[#0F0F0F]/95 backdrop-blur px-4 md:px-6 pt-3 pb-mobile-nav">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <Button variant="ghost" asChild size="sm" className="shrink-0">
            <Link href="/dashboard/digital-products">← Back</Link>
          </Button>
          <Button
            className="bg-orange-500 hover:bg-orange-600 text-white font-semibold h-11 px-6 flex-1 sm:flex-none sm:min-w-[180px]"
            onClick={handleGoToScripts}
          >
            Continue →
          </Button>
        </div>
      </div>
    </main>
  );
}
