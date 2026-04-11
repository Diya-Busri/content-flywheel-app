"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { Plus, Shirt, Upload, Sparkles, ExternalLink, Loader2, CheckCircle2, AlertCircle, X, ChevronRight, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import type { SelectPodProduct } from "@/db/schema/pod-products-schema";

type Props = {
  isPrintifyConnected: boolean;
  initialProducts: SelectPodProduct[];
};

const MOCKUP_STYLES = [
  { id: "lifestyle", label: "Lifestyle", desc: "Candid street / outdoor" },
  { id: "studio", label: "Studio", desc: "Clean white background" },
  { id: "outdoor", label: "Outdoor", desc: "Golden hour editorial" },
];

export function PrintOnDemandClient({ isPrintifyConnected, initialProducts }: Props) {
  const { toast } = useToast();
  const [products, setProducts] = useState<SelectPodProduct[]>(initialProducts);
  const [view, setView] = useState<"list" | "create" | "product">("list");
  const [selectedProduct, setSelectedProduct] = useState<SelectPodProduct | null>(null);

  // Create form state
  const [title, setTitle] = useState("");
  const [designFile, setDesignFile] = useState<File | null>(null);
  const [designPreview, setDesignPreview] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mockup state
  const [generatingMockup, setGeneratingMockup] = useState(false);
  const [mockupStyle, setMockupStyle] = useState("lifestyle");

  // Connect Printify state
  const [apiKey, setApiKey] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(isPrintifyConnected);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDesignFile(file);
    setDesignPreview(URL.createObjectURL(file));
  };

  const handleCreateProduct = async () => {
    if (!title.trim()) { toast({ title: "Title required", variant: "destructive" }); return; }
    setCreating(true);
    try {
      let designFileUrl: string | null = null;
      let designFileName: string | null = null;

      if (designFile) {
        const formData = new FormData();
        formData.append("file", designFile);
        const uploadRes = await fetch("/api/upload/store-image", { method: "POST", body: formData });
        if (uploadRes.ok) {
          const data = await uploadRes.json();
          designFileUrl = data.url;
          designFileName = designFile.name;
        }
      }

      const res = await fetch("/api/printify/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), designFileUrl, designFileName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setProducts((prev) => [data.product, ...prev]);
      setSelectedProduct(data.product);
      setView("product");
      setTitle("");
      setDesignFile(null);
      setDesignPreview(null);
      toast({ title: "Product created!", description: "Now generate mockups and sync to Printify." });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleGenerateMockup = async () => {
    if (!selectedProduct) return;
    setGeneratingMockup(true);
    try {
      const res = await fetch("/api/ai-mockup/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: selectedProduct.id, style: mockupStyle }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const updated = {
        ...selectedProduct,
        mockupUrls: [...((selectedProduct.mockupUrls as string[]) ?? []), data.mockupUrl],
      } as SelectPodProduct;
      setSelectedProduct(updated);
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      toast({ title: "Mockup generated!" });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally {
      setGeneratingMockup(false);
    }
  };

  const handleConnectPrintify = async () => {
    if (!apiKey.trim()) return;
    setConnecting(true);
    try {
      const res = await fetch("/api/printify/shops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.connected) throw new Error(data.error ?? "Connection failed");
      setConnected(true);
      toast({ title: "Printify connected!", description: `Found ${data.shops?.length ?? 0} shop(s).` });
    } catch (err) {
      toast({ title: "Connection failed", description: err instanceof Error ? err.message : "Check your API key", variant: "destructive" });
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-[1280px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Shirt className="w-6 h-6 text-orange-500" />
            Print on Demand
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Design clothing & merch — AI generates lifestyle mockups, Printify handles fulfilment.
          </p>
        </div>
        {view === "list" && (
          <Button onClick={() => setView("create")} className="bg-orange-500 hover:bg-orange-600 text-white gap-2">
            <Plus className="w-4 h-4" /> New Product
          </Button>
        )}
        {view !== "list" && (
          <Button variant="ghost" onClick={() => { setView("list"); setSelectedProduct(null); }}>
            ← Back
          </Button>
        )}
      </div>

      {/* Connect Printify banner */}
      {!connected && (
        <div className="mb-8 rounded-xl border border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-900/40 p-5">
          <div className="flex items-start gap-3 mb-4">
            <AlertCircle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-900 dark:text-white text-sm">Connect Printify to sync products</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Get your API key from{" "}
                <a href="https://printify.com/app/account/api" target="_blank" rel="noreferrer" className="text-orange-500 underline">
                  printify.com/app/account/api
                </a>
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Printify API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="max-w-sm"
              type="password"
            />
            <Button onClick={handleConnectPrintify} disabled={connecting || !apiKey.trim()} className="bg-orange-500 hover:bg-orange-600 text-white shrink-0">
              {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Connect"}
            </Button>
          </div>
        </div>
      )}

      {connected && (
        <div className="mb-6 flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
          <CheckCircle2 className="w-4 h-4" />
          Printify connected
          <Link href="/dashboard/settings" className="ml-2 text-gray-400 hover:text-gray-600 flex items-center gap-1">
            <Settings className="w-3.5 h-3.5" /> Manage
          </Link>
        </div>
      )}

      {/* List view */}
      {view === "list" && (
        <>
          {products.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-[#2A2A2A] p-16 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-orange-50 dark:bg-orange-950/20 flex items-center justify-center mb-4">
                <Shirt className="w-8 h-8 text-orange-400" />
              </div>
              <p className="font-semibold text-gray-900 dark:text-white mb-1">No products yet</p>
              <p className="text-sm text-gray-500 mb-6 max-w-sm">
                Upload a design, pick a product type, and let AI generate lifestyle mockups of people wearing your brand.
              </p>
              <Button onClick={() => setView("create")} className="bg-orange-500 hover:bg-orange-600 text-white gap-2">
                <Plus className="w-4 h-4" /> Create first product
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map((product) => {
                const mockups = (product.mockupUrls as string[]) ?? [];
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => { setSelectedProduct(product); setView("product"); }}
                    className="group rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-[#2A2A2A] hover:border-orange-300 dark:hover:border-orange-700 hover:shadow-md transition-all overflow-hidden text-left"
                  >
                    <div className="aspect-square bg-gray-50 dark:bg-[#2A2A2A] relative overflow-hidden">
                      {mockups[0] ? (
                        <Image src={mockups[0]} alt={product.title} fill className="object-cover" />
                      ) : product.designFileUrl ? (
                        <Image src={product.designFileUrl} alt={product.title} fill className="object-contain p-6" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Shirt className="w-12 h-12 text-gray-300 dark:text-gray-600" />
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{product.title}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          product.printifyStatus === "synced"
                            ? "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                            : "bg-gray-100 text-gray-500 dark:bg-[#2A2A2A] dark:text-gray-400"
                        }`}>
                          {product.printifyStatus === "synced" ? "Synced to Printify" : "Draft"}
                        </span>
                        <span className="text-xs text-gray-400">{mockups.length} mockup{mockups.length !== 1 ? "s" : ""}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Create view */}
      {view === "create" && (
        <div className="max-w-lg">
          <div className="rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-[#2A2A2A] p-6 space-y-5">
            <h2 className="font-bold text-gray-900 dark:text-white text-lg">New Product</h2>

            <div>
              <Label htmlFor="pod-title">Product name</Label>
              <Input id="pod-title" placeholder="e.g. Void Hours Classic Tee" value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
            </div>

            <div>
              <Label>Design file (PNG recommended)</Label>
              <input ref={fileInputRef} type="file" accept="image/png,image/svg+xml,image/jpeg" className="hidden" onChange={handleFileChange} />
              {designPreview ? (
                <div className="mt-1 relative rounded-xl overflow-hidden border border-gray-200 dark:border-[#2A2A2A] aspect-square max-w-[200px]">
                  <Image src={designPreview} alt="Design preview" fill className="object-contain p-3" />
                  <button
                    type="button"
                    onClick={() => { setDesignFile(null); setDesignPreview(null); }}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-1 w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 dark:border-[#2A2A2A] py-8 text-gray-400 hover:border-orange-300 hover:text-orange-500 transition-colors"
                >
                  <Upload className="w-6 h-6" />
                  <span className="text-sm">Click to upload design</span>
                  <span className="text-xs">PNG, SVG or JPG — transparent background recommended</span>
                </button>
              )}
            </div>

            <Button
              onClick={handleCreateProduct}
              disabled={creating || !title.trim()}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white"
            >
              {creating ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Creating...</> : <>Create product <ChevronRight className="w-4 h-4 ml-1" /></>}
            </Button>
          </div>
        </div>
      )}

      {/* Product detail view */}
      {view === "product" && selectedProduct && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: design + mockups */}
          <div className="space-y-4">
            {/* Design */}
            {selectedProduct.designFileUrl && (
              <div className="rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-[#2A2A2A] p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Design File</p>
                <div className="aspect-square max-w-[180px] mx-auto relative">
                  <Image src={selectedProduct.designFileUrl} alt="Design" fill className="object-contain" />
                </div>
              </div>
            )}

            {/* AI Mockup Generator */}
            <div className="rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-[#2A2A2A] p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">AI Mockups</p>

              <div className="flex gap-2 mb-3">
                {MOCKUP_STYLES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setMockupStyle(s.id)}
                    className={`flex-1 rounded-lg border p-2 text-center text-xs font-medium transition-all ${
                      mockupStyle === s.id
                        ? "border-orange-500 bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400"
                        : "border-gray-200 dark:border-[#2A2A2A] text-gray-500 hover:border-orange-300"
                    }`}
                  >
                    <span className="block font-semibold">{s.label}</span>
                    <span className="text-gray-400 text-[10px]">{s.desc}</span>
                  </button>
                ))}
              </div>

              <Button
                onClick={handleGenerateMockup}
                disabled={generatingMockup}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white gap-2"
              >
                {generatingMockup
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Generating...</>
                  : <><Sparkles className="w-4 h-4" />Generate AI Mockup</>}
              </Button>

              {/* Mockup grid */}
              {((selectedProduct.mockupUrls as string[]) ?? []).length > 0 && (
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {((selectedProduct.mockupUrls as string[]) ?? []).map((url, i) => (
                    <div key={i} className="aspect-square rounded-xl overflow-hidden relative border border-gray-100 dark:border-[#2A2A2A]">
                      <Image src={url} alt={`Mockup ${i + 1}`} fill className="object-cover" />
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: product info + Printify sync */}
          <div className="space-y-4">
            <div className="rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-[#2A2A2A] p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Product Details</p>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{selectedProduct.title}</h2>
              {selectedProduct.blueprintTitle && (
                <p className="text-sm text-gray-500 dark:text-gray-400">{selectedProduct.blueprintTitle}</p>
              )}
              <div className="mt-3">
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                  selectedProduct.printifyStatus === "synced"
                    ? "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                    : "bg-gray-100 text-gray-500 dark:bg-[#2A2A2A] dark:text-gray-400"
                }`}>
                  {selectedProduct.printifyStatus === "synced" ? "✓ Synced to Printify" : "Draft — not yet synced"}
                </span>
              </div>
            </div>

            {/* Printify sync */}
            <div className="rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-[#2A2A2A] p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Printify</p>

              {!connected ? (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Connect Printify above to sync this product for fulfilment.
                </div>
              ) : selectedProduct.printifyProductId ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                    <CheckCircle2 className="w-4 h-4" />
                    Product synced to Printify
                  </div>
                  <a
                    href={`https://printify.com/app/store/products/${selectedProduct.printifyProductId}/edit`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-orange-500 hover:text-orange-600"
                  >
                    Edit in Printify <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Once your design is ready, sync it to Printify to set variants, pricing, and start selling.
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Tip: Select your product type and print provider in the Printify dashboard first, then sync here.
                  </p>
                  <Link href="https://printify.com/app/store/products" target="_blank" rel="noreferrer">
                    <Button variant="outline" size="sm" className="gap-2 border-orange-200 text-orange-600 hover:bg-orange-50">
                      Open Printify <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                </div>
              )}
            </div>

            {/* Marketing tip */}
            <div className="rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/10 border border-orange-100 dark:border-orange-900/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-orange-500 mb-2">Marketing Tip</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Generate 3–5 AI mockups in different styles, then use them in TikTok videos and your email list to drive sales before your first order arrives.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
