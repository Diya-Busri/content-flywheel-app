"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

const MAX_FILE_SIZE_MB = 100;
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
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [mode, setMode] = useState<"file" | "link">("file");
  const [productFile, setProductFile] = useState<File | null>(null);
  const [productSalesPageLink, setProductSalesPageLink] = useState("");
  const [productType, setProductType] = useState<ProductType>("digital");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

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
    <main className="min-h-screen bg-[#0F0F0F] text-white pb-24">
      <div className="max-w-2xl mx-auto p-6 md:p-10">
        <Link
          href="/dashboard/digital-products"
          className="inline-flex items-center gap-2 text-sm text-[#A0A0A0] hover:text-orange-500 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>

        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium text-orange-500 uppercase tracking-wider">Step 1 of 3</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">Product Details</h1>
        <p className="text-[#A0A0A0] text-base mb-10">Tell us about your product</p>

        <div className="space-y-8">
          <div className="space-y-2">
            <Label htmlFor="productName" className="text-white">Product Name</Label>
            <Input
              id="productName"
              placeholder="e.g., Ultimate Budget Planner"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="bg-[#1A1A1A] border-[#2A2A2A] text-white placeholder:text-[#666] h-11"
            />
            {formErrors.productName && (
              <p className="text-sm text-red-400">{formErrors.productName}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="productDescription" className="text-white">Product description (optional)</Label>
            <Textarea
              id="productDescription"
              placeholder="Describe what your product is, who it's for, and the main benefits..."
              value={productDescription}
              onChange={(e) => setProductDescription(e.target.value)}
              rows={4}
              className="bg-[#1A1A1A] border-[#2A2A2A] text-white placeholder:text-[#666] resize-none"
            />
            <p className="text-xs text-[#A0A0A0]">The more detail you provide, the better your video scripts will be. Character count: {productDescription.length}</p>
          </div>

          <div className="space-y-3">
            <Label className="text-white">Product File or Link</Label>
            <Tabs value={mode} onValueChange={(v) => { setMode(v as "file" | "link"); setFormErrors((prev) => ({ ...prev, productFileOrLink: "" })); }}>
              <TabsList className="bg-[#1A1A1A] border border-[#2A2A2A] p-1 gap-1">
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
                      : "border-[#2A2A2A] hover:border-[#3A3A3A]"
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
                      <p className="text-sm font-medium text-white">{productFile.name}</p>
                      <p className="text-xs text-[#A0A0A0]">{formatFileSize(productFile.size)}</p>
                      <label htmlFor="product-file">
                        <Button type="button" variant="outline" size="sm" className="border-[#2A2A2A] text-[#A0A0A0] hover:bg-[#2A2A2A] cursor-pointer">
                          Change file
                        </Button>
                      </label>
                    </div>
                  ) : (
                    <label htmlFor="product-file" className="cursor-pointer block">
                      <Upload className="w-12 h-12 mx-auto text-[#666] mb-3" />
                      <p className="text-sm text-[#E0E0E0]">Drag & drop your file here</p>
                      <p className="text-sm text-[#A0A0A0] mt-1">or click to browse</p>
                      <p className="text-xs text-[#666] mt-3">PDF, EPUB, DOCX, PPTX, XLSX, ZIP</p>
                      <p className="text-xs text-[#666]">Max 100MB</p>
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
                  className="bg-[#1A1A1A] border-[#2A2A2A] text-white placeholder:text-[#666] h-11"
                />
                <p className="text-xs text-[#A0A0A0] mt-2">Paste your Gumroad, Etsy, or sales page URL</p>
              </TabsContent>
            </Tabs>
            {formErrors.productFileOrLink && (
              <p className="text-sm text-red-400">{formErrors.productFileOrLink}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-white">Product Type</Label>
            <Select value={productType} onValueChange={(v: ProductType) => setProductType(v)}>
              <SelectTrigger className="bg-[#1A1A1A] border-[#2A2A2A] text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1A1A1A] border-[#2A2A2A]">
                <SelectItem value="digital">Digital Product</SelectItem>
                <SelectItem value="physical">Physical Product</SelectItem>
                <SelectItem value="service">Service</SelectItem>
                <SelectItem value="course">Course</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#2A2A2A] bg-[#0F0F0F]/95 backdrop-blur py-4 px-4 md:px-6">
        <div className="max-w-2xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <Button variant="ghost" asChild className="text-[#A0A0A0] hover:text-white hover:bg-[#1A1A1A]">
            <Link href="/dashboard/digital-products">← Back to Selection</Link>
          </Button>
          <Button
            className="bg-orange-500 hover:bg-orange-600 text-white font-semibold h-12 px-8"
            onClick={handleGoToScripts}
          >
            Generate Scripts →
          </Button>
        </div>
      </div>
    </main>
  );
}
