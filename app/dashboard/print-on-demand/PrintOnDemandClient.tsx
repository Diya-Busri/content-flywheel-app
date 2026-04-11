"use client";

import { useState, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus, Shirt, Upload, Sparkles, ExternalLink, Loader2,
  CheckCircle2, AlertCircle, X, ChevronRight, Settings,
  ArrowLeft, RefreshCw, ChevronDown, ChevronUp, Wand2, Shuffle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import type { SelectPodProduct } from "@/db/schema/pod-products-schema";

type Props = {
  isPrintifyConnected: boolean;
  initialProducts: SelectPodProduct[];
};

type Blueprint = { id: number; title: string; brand: string; images: string[] };
type Provider = { id: number; title: string; location: { country: string } };
type Variant = { id: number; title: string; options: Record<string, string>; placeholders: Array<{ position: string }> };

const DESIGN_PROMPTS = [
  { label: "Wolf & moon", prompt: "A lone wolf howling at a full moon with a geometric mountain landscape", style: "bold" },
  { label: "Snake & roses", prompt: "A coiled snake wrapped around a blooming rose, detailed illustration", style: "lineart" },
  { label: "Sunset mountains", prompt: "Layered mountain range silhouette at sunset with gradient sky", style: "minimalist" },
  { label: "Skull floral", prompt: "A decorative skull surrounded by intricate flowers and vines", style: "vintage" },
  { label: "Tiger face", prompt: "A fierce symmetrical tiger face, bold and graphic, frontal view", style: "bold" },
  { label: "Celestial eye", prompt: "An all-seeing eye surrounded by moon phases, stars and celestial symbols", style: "lineart" },
  { label: "City skyline", prompt: "Minimal city skyline silhouette at night with a large moon behind it", style: "minimalist" },
  { label: "Retro surf", prompt: "Retro 70s surf graphic with waves, sun and tropical palms", style: "vintage" },
  { label: "Geometric bear", prompt: "Low-poly geometric bear face with triangular facets and bold colors", style: "abstract" },
  { label: "Koi fish", prompt: "Two koi fish swimming in a yin-yang circle surrounded by waves", style: "lineart" },
  { label: "Eagle wings", prompt: "Spread eagle wings with a bold banner, American eagle style graphic", style: "bold" },
  { label: "Desert cactus", prompt: "A single saguaro cactus under a starry desert night sky, minimal", style: "minimalist" },
];

const MOCKUP_STYLES = [
  { id: "lifestyle", label: "Lifestyle", desc: "Candid street / outdoor" },
  { id: "studio", label: "Studio", desc: "Clean white background" },
  { id: "outdoor", label: "Outdoor", desc: "Golden hour editorial" },
];

// ─── Step indicator ───────────────────────────────────────────────────────────
function Steps({ current, steps }: { current: number; steps: string[] }) {
  return (
    <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
      {steps.map((label, i) => (
        <div key={label} className="flex items-center gap-1 shrink-0">
          <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-all ${
            i + 1 === current
              ? "bg-orange-500 text-white"
              : i + 1 < current
              ? "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400"
              : "bg-gray-100 text-gray-400 dark:bg-[#2A2A2A] dark:text-gray-500"
          }`}>
            {i + 1 < current ? <CheckCircle2 className="w-3 h-3" /> : <span>{i + 1}</span>}
            {label}
          </div>
          {i < steps.length - 1 && <ChevronRight className="w-3 h-3 text-gray-300 shrink-0" />}
        </div>
      ))}
    </div>
  );
}

const CREATE_STEPS = ["Design", "Product type", "Provider", "Variants", "Review"];

export function PrintOnDemandClient({ isPrintifyConnected, initialProducts }: Props) {
  const { toast } = useToast();
  const router = useRouter();
  const [products, setProducts] = useState<SelectPodProduct[]>(initialProducts);
  const [view, setView] = useState<"list" | "create" | "product">("list");
  const [selectedProduct, setSelectedProduct] = useState<SelectPodProduct | null>(null);

  // ── Create wizard state ──────────────────────────────────────────────────────
  const [createStep, setCreateStep] = useState(1);
  const [title, setTitle] = useState("");
  const [designFile, setDesignFile] = useState<File | null>(null);
  const [designPreview, setDesignPreview] = useState<string | null>(null);
  const [designUrl, setDesignUrl] = useState<string | null>(null);
  const [uploadingDesign, setUploadingDesign] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Catalog state ────────────────────────────────────────────────────────────
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [selectedBlueprint, setSelectedBlueprint] = useState<Blueprint | null>(null);
  const [blueprintSearch, setBlueprintSearch] = useState("");

  // ── Provider state ───────────────────────────────────────────────────────────
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);

  // ── Variant state ────────────────────────────────────────────────────────────
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [selectedVariants, setSelectedVariants] = useState<Set<number>>(new Set());
  const [variantPrices, setVariantPrices] = useState<Record<number, string>>({});
  const [variantsExpanded, setVariantsExpanded] = useState(false);

  // ── AI design generator state ────────────────────────────────────────────────
  const [designTab, setDesignTab] = useState<"upload" | "generate">("upload");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiStyle, setAiStyle] = useState("bold");
  const [generatingDesign, setGeneratingDesign] = useState(false);

  // ── Mockup state ─────────────────────────────────────────────────────────────
  const [generatingMockup, setGeneratingMockup] = useState(false);
  const [mockupStyle, setMockupStyle] = useState("lifestyle");

  // ── Sync state ───────────────────────────────────────────────────────────────
  const [syncing, setSyncing] = useState(false);
  const [creating, setCreating] = useState(false);

  // ── Printify connect state ───────────────────────────────────────────────────
  const [apiKey, setApiKey] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(isPrintifyConnected);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const resetCreate = () => {
    setCreateStep(1);
    setTitle("");
    setDesignFile(null);
    setDesignPreview(null);
    setDesignUrl(null);
    setSelectedBlueprint(null);
    setSelectedProvider(null);
    setVariants([]);
    setSelectedVariants(new Set());
    setVariantPrices({});
    setBlueprintSearch("");
    setDesignTab("upload");
    setAiPrompt("");
    setAiStyle("bold");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDesignFile(file);
    setDesignPreview(URL.createObjectURL(file));
  };

  // AI design generation
  const handleGenerateDesign = async () => {
    if (!aiPrompt.trim()) { toast({ title: "Enter a prompt first", variant: "destructive" }); return; }
    setGeneratingDesign(true);
    setDesignPreview(null);
    setDesignUrl(null);
    setDesignFile(null);
    try {
      const res = await fetch("/api/ai-design/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt.trim(), style: aiStyle }),
      });
      const data = await res.json() as { url?: string; error?: string; code?: string; redirectTo?: string };
      if (res.status === 402) {
        toast({
          title: "No credits",
          description: "You need 1 video credit to generate a design.",
          variant: "destructive",
        });
        router.push(data.redirectTo ?? "/dashboard/video-credits");
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setDesignPreview(data.url!);
      setDesignUrl(data.url!);
      // Auto-fill product name from prompt if user hasn't typed one yet
      if (!title.trim()) {
        const words = aiPrompt.trim().split(/\s+/).slice(0, 4).join(" ");
        const suggested = words.charAt(0).toUpperCase() + words.slice(1);
        setTitle(suggested);
      }
    } catch (err) {
      toast({ title: "Generation failed", description: err instanceof Error ? err.message : "Try again", variant: "destructive" });
    } finally {
      setGeneratingDesign(false);
    }
  };

  // Step 1 → 2: upload design (or use AI-generated URL), then load catalog
  const handleStep1Next = async () => {
    if (!title.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    if (!designPreview) { toast({ title: designTab === "generate" ? "Generate a design first" : "Upload a design first", variant: "destructive" }); return; }

    // AI path: designUrl already set from generation
    if (designUrl) {
      // Skip upload, go straight to catalog
    } else {
      if (!designFile) { toast({ title: "Upload a design first", variant: "destructive" }); return; }
      setUploadingDesign(true);
      try {
        const formData = new FormData();
        formData.append("file", designFile);
        const res = await fetch("/api/upload/store-image", { method: "POST", body: formData });
        if (!res.ok) throw new Error("Upload failed");
        const data = await res.json() as { url?: string };
        setDesignUrl(data.url!);
      } catch {
        toast({ title: "Upload failed", variant: "destructive" });
        setUploadingDesign(false);
        return;
      }
      setUploadingDesign(false);
    }

    // Load catalog
    if (blueprints.length === 0 && connected) {
      setLoadingCatalog(true);
      try {
        const res = await fetch("/api/printify/catalog");
        const data = await res.json();
        setBlueprints(data.blueprints ?? []);
      } catch {
        toast({ title: "Could not load catalog", variant: "destructive" });
      } finally {
        setLoadingCatalog(false);
      }
    }
    setCreateStep(2);
  };

  // Step 2 → 3: pick blueprint, load providers
  const handleSelectBlueprint = async (bp: Blueprint) => {
    setSelectedBlueprint(bp);
    setSelectedProvider(null);
    setVariants([]);
    setSelectedVariants(new Set());
    setLoadingProviders(true);
    setCreateStep(3);
    try {
      const res = await fetch(`/api/printify/catalog?blueprintId=${bp.id}`);
      const data = await res.json();
      setProviders(data.providers ?? []);
    } catch {
      toast({ title: "Could not load providers", variant: "destructive" });
    } finally {
      setLoadingProviders(false);
    }
  };

  // Step 3 → 4: pick provider, load variants
  const handleSelectProvider = async (prov: Provider) => {
    setSelectedProvider(prov);
    setVariants([]);
    setSelectedVariants(new Set());
    setLoadingVariants(true);
    setCreateStep(4);
    try {
      const res = await fetch(`/api/printify/catalog?blueprintId=${selectedBlueprint!.id}&providerId=${prov.id}`);
      const data = await res.json();
      const variantList: Variant[] = data.variants?.variants ?? data.variants ?? [];
      setVariants(variantList);
      // Default: select all, price £25.00
      const ids = new Set(variantList.map((v) => v.id));
      setSelectedVariants(ids);
      const prices: Record<number, string> = {};
      variantList.forEach((v) => { prices[v.id] = "25.00"; });
      setVariantPrices(prices);
    } catch {
      toast({ title: "Could not load variants", variant: "destructive" });
    } finally {
      setLoadingVariants(false);
    }
  };

  // Step 4 → 5: confirm variants
  const handleStep4Next = () => {
    if (selectedVariants.size === 0) { toast({ title: "Select at least one variant", variant: "destructive" }); return; }
    setCreateStep(5);
  };

  // Step 5: create product + sync to Printify
  const handleFinish = async () => {
    setCreating(true);
    try {
      // 1. Upload design to Printify image library
      let printifyImageId: string | null = null;
      if (designUrl) {
        try {
          const imgRes = await fetch("/api/printify/upload-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageUrl: designUrl, fileName: designFile?.name ?? "design.png" }),
          });
          const imgData = await imgRes.json();
          printifyImageId = imgData.imageId ?? null;
        } catch {
          // Non-blocking — sync will still work without image
        }
      }

      // 2. Create local product record
      const createRes = await fetch("/api/printify/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          designFileUrl: designUrl,
          designFileName: designFile?.name,
          blueprintId: selectedBlueprint?.id,
          blueprintTitle: selectedBlueprint?.title,
          printProviderId: selectedProvider?.id,
          printProviderTitle: selectedProvider?.title,
        }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error);

      const productId = createData.product.id;

      // 3. Sync to Printify if connected
      if (connected && selectedBlueprint && selectedProvider) {
        const variantPayload = variants
          .filter((v) => selectedVariants.has(v.id))
          .map((v) => ({
            id: v.id,
            price: Math.round(parseFloat(variantPrices[v.id] ?? "25") * 100),
            enabled: true,
          }));

        await fetch("/api/printify/products", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId, variants: variantPayload, printifyImageId }),
        });
      }

      // 4. Fetch updated product and show it
      const listRes = await fetch("/api/printify/products");
      const listData = await listRes.json();
      const newProduct = (listData.products ?? []).find((p: SelectPodProduct) => p.id === productId) ?? createData.product;

      setProducts(listData.products ?? [createData.product]);
      setSelectedProduct(newProduct);
      setView("product");
      resetCreate();
      toast({ title: "Product created!", description: connected ? "Synced to Printify." : "Generate mockups next." });
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
      const updated = { ...selectedProduct, mockupUrls: [...((selectedProduct.mockupUrls as string[]) ?? []), data.mockupUrl] } as SelectPodProduct;
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
      setApiKey("");
      toast({ title: "Printify connected!" });
    } catch (err) {
      toast({ title: "Connection failed", description: err instanceof Error ? err.message : "Check your API key", variant: "destructive" });
    } finally {
      setConnecting(false);
    }
  };

  const filteredBlueprints = blueprints.filter((b) =>
    !blueprintSearch || b.title.toLowerCase().includes(blueprintSearch.toLowerCase()) || b.brand.toLowerCase().includes(blueprintSearch.toLowerCase())
  );

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 md:p-10 max-w-[1280px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Shirt className="w-6 h-6 text-orange-500" /> Print on Demand
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Design clothing & merch — AI mockups, Printify fulfilment.
          </p>
        </div>
        {view === "list" && (
          <Button onClick={() => { resetCreate(); setView("create"); }} className="bg-orange-500 hover:bg-orange-600 text-white gap-2">
            <Plus className="w-4 h-4" /> New Product
          </Button>
        )}
        {view !== "list" && (
          <Button variant="ghost" onClick={() => { setView("list"); setSelectedProduct(null); resetCreate(); }}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
        )}
      </div>

      {/* Connect banner */}
      {!connected && (
        <div className="mb-8 rounded-xl border border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-900/40 p-5">
          <div className="flex items-start gap-3 mb-4">
            <AlertCircle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-900 dark:text-white text-sm">Connect Printify to sync products</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Get your API key from{" "}
                <a href="https://printify.com/app/account/api" target="_blank" rel="noreferrer" className="text-orange-500 underline">printify.com/app/account/api</a>
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Input placeholder="Printify API key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="max-w-sm" type="password" />
            <Button onClick={handleConnectPrintify} disabled={connecting || !apiKey.trim()} className="bg-orange-500 hover:bg-orange-600 text-white shrink-0">
              {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Connect"}
            </Button>
          </div>
        </div>
      )}

      {connected && view === "list" && (
        <div className="mb-5 flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
          <CheckCircle2 className="w-4 h-4" /> Printify connected
          <Link href="/dashboard/settings" className="ml-2 text-gray-400 hover:text-gray-600 flex items-center gap-1 text-xs">
            <Settings className="w-3.5 h-3.5" /> Manage
          </Link>
        </div>
      )}

      {/* ── LIST ── */}
      {view === "list" && (
        products.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-[#2A2A2A] p-16 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-orange-50 dark:bg-orange-950/20 flex items-center justify-center mb-4">
              <Shirt className="w-8 h-8 text-orange-400" />
            </div>
            <p className="font-semibold text-gray-900 dark:text-white mb-1">No products yet</p>
            <p className="text-sm text-gray-500 mb-6 max-w-sm">Upload a design, pick a product type and variants, then let AI generate lifestyle mockups.</p>
            <Button onClick={() => { resetCreate(); setView("create"); }} className="bg-orange-500 hover:bg-orange-600 text-white gap-2">
              <Plus className="w-4 h-4" /> Create first product
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((product) => {
              const mockups = (product.mockupUrls as string[]) ?? [];
              return (
                <button key={product.id} type="button" onClick={() => { setSelectedProduct(product); setView("product"); }}
                  className="group rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-[#2A2A2A] hover:border-orange-300 dark:hover:border-orange-700 hover:shadow-md transition-all overflow-hidden text-left">
                  <div className="aspect-square bg-gray-50 dark:bg-[#2A2A2A] relative overflow-hidden">
                    {mockups[0] ? (
                      <Image src={mockups[0]} alt={product.title} fill className="object-cover" />
                    ) : product.designFileUrl ? (
                      <Image src={product.designFileUrl} alt={product.title} fill className="object-contain p-6" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center"><Shirt className="w-12 h-12 text-gray-300 dark:text-gray-600" /></div>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{product.title}</p>
                    {product.blueprintTitle && <p className="text-xs text-gray-400 mt-0.5 truncate">{product.blueprintTitle}</p>}
                    <div className="flex items-center justify-between mt-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${product.printifyStatus === "synced" ? "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400" : "bg-gray-100 text-gray-500 dark:bg-[#2A2A2A] dark:text-gray-400"}`}>
                        {product.printifyStatus === "synced" ? "Synced" : "Draft"}
                      </span>
                      <span className="text-xs text-gray-400">{mockups.length} mockup{mockups.length !== 1 ? "s" : ""}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )
      )}

      {/* ── CREATE WIZARD ── */}
      {view === "create" && (
        <div className="max-w-2xl">
          <Steps current={createStep} steps={CREATE_STEPS} />

          {/* Step 1: Design + name */}
          {createStep === 1 && (
            <div className="rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-[#2A2A2A] p-6 space-y-5">
              <h2 className="font-bold text-gray-900 dark:text-white">Your design</h2>

              {/* Product name */}
              <div>
                <Label htmlFor="pod-title">Product name</Label>
                <Input id="pod-title" placeholder="e.g. Void Hours Classic Tee" value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
              </div>

              {/* Tab switcher */}
              <div className="flex rounded-xl bg-gray-100 dark:bg-[#2A2A2A] p-1 gap-1">
                <button
                  type="button"
                  onClick={() => { setDesignTab("upload"); setDesignPreview(null); setDesignUrl(null); setDesignFile(null); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-1.5 rounded-lg transition-all ${designTab === "upload" ? "bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white shadow-sm" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}
                >
                  <Upload className="w-3.5 h-3.5" /> Upload
                </button>
                <button
                  type="button"
                  onClick={() => { setDesignTab("generate"); setDesignPreview(null); setDesignUrl(null); setDesignFile(null); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-1.5 rounded-lg transition-all ${designTab === "generate" ? "bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white shadow-sm" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}
                >
                  <Wand2 className="w-3.5 h-3.5" /> Generate with AI
                </button>
              </div>

              {/* Upload tab */}
              {designTab === "upload" && (
                <div>
                  <input ref={fileInputRef} type="file" accept="image/png,image/svg+xml,image/jpeg" className="hidden" onChange={handleFileChange} />
                  {designPreview ? (
                    <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-[#2A2A2A] bg-gray-50 dark:bg-[#2A2A2A] w-40 h-40">
                      <Image src={designPreview} alt="Design" fill className="object-contain p-3" />
                      <button type="button" onClick={() => { setDesignFile(null); setDesignPreview(null); setDesignUrl(null); }}
                        className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/50 text-white flex items-center justify-center">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => fileInputRef.current?.click()}
                      className="w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 dark:border-[#2A2A2A] py-8 text-gray-400 hover:border-orange-300 hover:text-orange-500 transition-colors">
                      <Upload className="w-6 h-6" />
                      <span className="text-sm">Click to upload design</span>
                      <span className="text-xs">PNG with transparent background recommended</span>
                    </button>
                  )}
                </div>
              )}

              {/* Generate tab */}
              {designTab === "generate" && (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label htmlFor="ai-prompt">Describe your design</Label>
                      <button
                        type="button"
                        onClick={() => {
                          const pick = DESIGN_PROMPTS[Math.floor(Math.random() * DESIGN_PROMPTS.length)];
                          setAiPrompt(pick.prompt);
                          setAiStyle(pick.style);
                        }}
                        className="flex items-center gap-1 text-xs text-orange-500 hover:text-orange-600 font-medium"
                      >
                        <Shuffle className="w-3 h-3" /> Inspire me
                      </button>
                    </div>
                    <textarea
                      id="ai-prompt"
                      rows={3}
                      placeholder="e.g. A wolf howling at the moon with a geometric mountain landscape..."
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#0F0F0F] px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                    />
                    {/* Quick idea chips */}
                    {!aiPrompt && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {DESIGN_PROMPTS.slice(0, 6).map((idea) => (
                          <button
                            key={idea.label}
                            type="button"
                            onClick={() => { setAiPrompt(idea.prompt); setAiStyle(idea.style); }}
                            className="text-xs px-2.5 py-1 rounded-full bg-gray-100 dark:bg-[#2A2A2A] text-gray-600 dark:text-gray-400 hover:bg-orange-50 hover:text-orange-600 dark:hover:bg-orange-950/20 dark:hover:text-orange-400 border border-transparent hover:border-orange-200 dark:hover:border-orange-900/40 transition-all"
                          >
                            {idea.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Style presets */}
                  <div>
                    <Label>Style</Label>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {[
                        { id: "bold", label: "Bold Graphic" },
                        { id: "vintage", label: "Vintage" },
                        { id: "minimalist", label: "Minimalist" },
                        { id: "lineart", label: "Line Art" },
                        { id: "abstract", label: "Abstract" },
                      ].map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setAiStyle(s.id)}
                          className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${aiStyle === s.id ? "bg-orange-500 border-orange-500 text-white" : "border-gray-200 dark:border-[#2A2A2A] text-gray-600 dark:text-gray-400 hover:border-orange-300"}`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Generate button */}
                  <Button
                    type="button"
                    onClick={handleGenerateDesign}
                    disabled={generatingDesign || !aiPrompt.trim()}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    {generatingDesign ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-2" />Generating...</>
                    ) : (
                      <><Sparkles className="w-4 h-4 mr-2" />{designPreview ? "Regenerate" : "Generate design"}</>
                    )}
                  </Button>

                  {/* Preview */}
                  {designPreview && !generatingDesign && (
                    <div className="space-y-3">
                      <div className="relative rounded-2xl overflow-hidden border border-gray-200 dark:border-[#2A2A2A] bg-[#f8f8f8] dark:bg-[#2A2A2A] aspect-square w-full">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={designPreview} alt="Generated design" className="w-full h-full object-contain p-6" />
                        <button
                          type="button"
                          onClick={() => { setDesignPreview(null); setDesignUrl(null); }}
                          className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-xs text-center text-gray-400 dark:text-gray-500">
                        Not quite right? Tweak the prompt or style and regenerate.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <Button
                onClick={handleStep1Next}
                disabled={uploadingDesign || !title.trim() || !designPreview}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white"
              >
                {uploadingDesign ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" />Uploading...</>
                ) : !designPreview ? (
                  <>Add a design to continue</>
                ) : !title.trim() ? (
                  <>Add a product name to continue</>
                ) : (
                  <>Next: Pick product type <ChevronRight className="w-4 h-4 ml-1" /></>
                )}
              </Button>
            </div>
          )}

          {/* Step 2: Blueprint catalog */}
          {createStep === 2 && (
            <div className="rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-[#2A2A2A] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-gray-900 dark:text-white">Choose product type</h2>
                <button type="button" onClick={() => setCreateStep(1)} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                  <ArrowLeft className="w-3 h-3" /> Back
                </button>
              </div>
              {!connected ? (
                <p className="text-sm text-amber-600 dark:text-amber-400">Connect Printify above to browse the catalog.</p>
              ) : loadingCatalog ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 py-8 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading catalog...
                </div>
              ) : (
                <>
                  <Input placeholder="Search t-shirts, hoodies, mugs..." value={blueprintSearch} onChange={(e) => setBlueprintSearch(e.target.value)} />
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[420px] overflow-y-auto pr-1">
                    {filteredBlueprints.map((bp) => (
                      <button key={bp.id} type="button" onClick={() => handleSelectBlueprint(bp)}
                        className="rounded-xl border border-gray-200 dark:border-[#2A2A2A] hover:border-orange-400 hover:shadow-sm transition-all p-3 text-left">
                        {bp.images?.[0] && (
                          <div className="aspect-square rounded-lg overflow-hidden bg-gray-50 dark:bg-[#2A2A2A] mb-2 relative">
                            <Image src={bp.images[0]} alt={bp.title} fill className="object-contain p-1" />
                          </div>
                        )}
                        <p className="text-xs font-semibold text-gray-900 dark:text-white leading-tight">{bp.title}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{bp.brand}</p>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 3: Print provider */}
          {createStep === 3 && (
            <div className="rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-[#2A2A2A] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-gray-900 dark:text-white">Choose print provider</h2>
                  <p className="text-xs text-gray-400 mt-0.5">for {selectedBlueprint?.title}</p>
                </div>
                <button type="button" onClick={() => setCreateStep(2)} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                  <ArrowLeft className="w-3 h-3" /> Back
                </button>
              </div>
              {loadingProviders ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 py-8 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading providers...
                </div>
              ) : (
                <div className="space-y-2">
                  {providers.map((prov) => (
                    <button key={prov.id} type="button" onClick={() => handleSelectProvider(prov)}
                      className="w-full flex items-center justify-between rounded-xl border border-gray-200 dark:border-[#2A2A2A] hover:border-orange-400 p-4 text-left transition-all">
                      <div>
                        <p className="font-semibold text-sm text-gray-900 dark:text-white">{prov.title}</p>
                        <p className="text-xs text-gray-400">{prov.location?.country}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 4: Variants */}
          {createStep === 4 && (
            <div className="rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-[#2A2A2A] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-gray-900 dark:text-white">Select variants & set prices</h2>
                  <p className="text-xs text-gray-400 mt-0.5">{selectedBlueprint?.title} · {selectedProvider?.title}</p>
                </div>
                <button type="button" onClick={() => setCreateStep(3)} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                  <ArrowLeft className="w-3 h-3" /> Back
                </button>
              </div>

              {loadingVariants ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 py-8 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading variants...
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{selectedVariants.size} of {variants.length} selected</span>
                    <div className="flex gap-3">
                      <button type="button" onClick={() => setSelectedVariants(new Set(variants.map((v) => v.id)))} className="text-orange-500 hover:text-orange-600">Select all</button>
                      <button type="button" onClick={() => setSelectedVariants(new Set())} className="hover:text-gray-700">Clear</button>
                    </div>
                  </div>

                  <div className={`space-y-1.5 overflow-y-auto transition-all ${variantsExpanded ? "max-h-[500px]" : "max-h-[280px]"}`}>
                    {variants.map((v) => {
                      const checked = selectedVariants.has(v.id);
                      return (
                        <div key={v.id} className={`flex items-center gap-3 rounded-lg px-3 py-2 border transition-all ${checked ? "border-orange-200 bg-orange-50/50 dark:bg-orange-950/10 dark:border-orange-900/30" : "border-gray-100 dark:border-[#2A2A2A]"}`}>
                          <input type="checkbox" checked={checked} onChange={() => setSelectedVariants((prev) => {
                            const next = new Set(prev);
                            if (next.has(v.id)) next.delete(v.id); else next.add(v.id);
                            return next;
                          })} className="accent-orange-500" />
                          <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 truncate">{v.title}</span>
                          {checked && (
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-xs text-gray-400">£</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={variantPrices[v.id] ?? "25.00"}
                                onChange={(e) => setVariantPrices((prev) => ({ ...prev, [v.id]: e.target.value }))}
                                className="w-16 text-xs rounded-md border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#0F0F0F] px-2 py-1 text-right"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {variants.length > 6 && (
                    <button type="button" onClick={() => setVariantsExpanded((e) => !e)}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mx-auto">
                      {variantsExpanded ? <><ChevronUp className="w-3 h-3" />Show less</> : <><ChevronDown className="w-3 h-3" />Show all {variants.length}</>}
                    </button>
                  )}

                  <Button onClick={handleStep4Next} disabled={selectedVariants.size === 0} className="w-full bg-orange-500 hover:bg-orange-600 text-white">
                    Review & create <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Step 5: Review */}
          {createStep === 5 && (
            <div className="rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-[#2A2A2A] p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-gray-900 dark:text-white">Review & create</h2>
                <button type="button" onClick={() => setCreateStep(4)} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                  <ArrowLeft className="w-3 h-3" /> Back
                </button>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex gap-4">
                  {designPreview && (
                    <div className="w-20 h-20 rounded-xl border border-gray-100 dark:border-[#2A2A2A] bg-gray-50 dark:bg-[#2A2A2A] relative shrink-0 overflow-hidden">
                      <Image src={designPreview} alt="Design" fill className="object-contain p-2" />
                    </div>
                  )}
                  <div className="space-y-1">
                    <p className="font-semibold text-gray-900 dark:text-white">{title}</p>
                    <p className="text-gray-500">{selectedBlueprint?.title}</p>
                    <p className="text-gray-400 text-xs">{selectedProvider?.title} · {selectedProvider?.location?.country}</p>
                  </div>
                </div>
                <div className="rounded-lg bg-gray-50 dark:bg-[#2A2A2A] px-4 py-3 text-xs text-gray-600 dark:text-gray-400">
                  <span className="font-semibold text-gray-900 dark:text-white">{selectedVariants.size}</span> variant{selectedVariants.size !== 1 ? "s" : ""} selected
                  {connected && <span className="ml-2 text-green-600 dark:text-green-400">· Will sync to Printify</span>}
                </div>
              </div>

              <Button onClick={handleFinish} disabled={creating} className="w-full bg-orange-500 hover:bg-orange-600 text-white">
                {creating ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Creating...</> : "Create product"}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── PRODUCT DETAIL ── */}
      {view === "product" && selectedProduct && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            {selectedProduct.designFileUrl && (
              <div className="rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-[#2A2A2A] p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Design File</p>
                <div className="aspect-square max-w-[160px] mx-auto relative">
                  <Image src={selectedProduct.designFileUrl} alt="Design" fill className="object-contain" />
                </div>
              </div>
            )}

            <div className="rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-[#2A2A2A] p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">AI Mockups</p>
              <div className="flex gap-2 mb-3">
                {MOCKUP_STYLES.map((s) => (
                  <button key={s.id} type="button" onClick={() => setMockupStyle(s.id)}
                    className={`flex-1 rounded-lg border p-2 text-center text-xs font-medium transition-all ${mockupStyle === s.id ? "border-orange-500 bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400" : "border-gray-200 dark:border-[#2A2A2A] text-gray-500 hover:border-orange-300"}`}>
                    <span className="block font-semibold">{s.label}</span>
                    <span className="text-gray-400 text-[10px]">{s.desc}</span>
                  </button>
                ))}
              </div>
              <Button onClick={handleGenerateMockup} disabled={generatingMockup} className="w-full bg-orange-500 hover:bg-orange-600 text-white gap-2">
                {generatingMockup ? <><Loader2 className="w-4 h-4 animate-spin" />Generating...</> : <><Sparkles className="w-4 h-4" />Generate AI Mockup</>}
              </Button>
              {((selectedProduct.mockupUrls as string[]) ?? []).length > 0 && (
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {((selectedProduct.mockupUrls as string[]) ?? []).map((url, i) => (
                    <div key={i} className="aspect-square rounded-xl overflow-hidden relative border border-gray-100 dark:border-[#2A2A2A]">
                      <Image src={url} alt={`Mockup ${i + 1}`} fill className="object-cover" />
                      <a href={url} target="_blank" rel="noreferrer"
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70">
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-[#2A2A2A] p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Product Details</p>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{selectedProduct.title}</h2>
              {selectedProduct.blueprintTitle && <p className="text-sm text-gray-500">{selectedProduct.blueprintTitle}</p>}
              {selectedProduct.printProviderTitle && <p className="text-xs text-gray-400 mt-0.5">{selectedProduct.printProviderTitle}</p>}
              <div className="mt-3">
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${selectedProduct.printifyStatus === "synced" ? "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400" : "bg-gray-100 text-gray-500 dark:bg-[#2A2A2A] dark:text-gray-400"}`}>
                  {selectedProduct.printifyStatus === "synced" ? "✓ Synced to Printify" : "Draft"}
                </span>
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-[#2A2A2A] p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Printify</p>
              {selectedProduct.printifyProductId ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                    <CheckCircle2 className="w-4 h-4" /> Synced to Printify
                  </div>
                  <a href={`https://printify.com/app/store/products/${selectedProduct.printifyProductId}/edit`} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-orange-500 hover:text-orange-600">
                    Edit in Printify <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              ) : (
                <div className="space-y-2 text-sm text-gray-500">
                  <p>Not yet synced to Printify.</p>
                  <Link href="https://printify.com/app/store/products" target="_blank" rel="noreferrer">
                    <Button variant="outline" size="sm" className="gap-2 border-orange-200 text-orange-600 hover:bg-orange-50">
                      Open Printify <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/10 border border-orange-100 dark:border-orange-900/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-orange-500 mb-2">Marketing Tip</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Generate 3–5 AI mockups in different styles, then use them in TikTok videos and your email list to drive sales.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
