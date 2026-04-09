"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import {
  Copy,
  ExternalLink,
  ShoppingBag,
  Package,
  Loader2,
  CheckCircle2,
  Eye,
  PencilLine,
  Trash2,
  Store,
  BarChart2,
  ArrowRight,
  BookOpen,
  Paintbrush,
  Upload,
  Plus,
  Mail,
  Tag,
  X,
} from "lucide-react";
import Link from "next/link";

interface LibraryItem {
  id: string;
  type: "product" | "video" | "script";
  title: string;
  thumbnail?: string;
  status: string;
  format?: string;
  isNativePublished?: boolean;
  nativePrice?: number;
}

interface StoreClientProps {
  userId: string;
}

const STORE_BASE = "https://contentflywheel.co.uk/c";

function formatPrice(pence: number) {
  return `£${(pence / 100).toFixed(2)}`;
}

function FormatBadge({ format }: { format?: string }) {
  if (!format) return null;
  const label =
    format === "ebook"
      ? "eBook"
      : format === "template"
      ? "Template"
      : format === "course"
      ? "Course"
      : format === "bundle"
      ? "Bundle"
      : format;
  return (
    <Badge variant="outline" className="text-[10px] border-white/10 text-gray-400 shrink-0">
      {label}
    </Badge>
  );
}

// Inline publish/edit price form used in both sections
function PriceForm({
  productId,
  initialPrice,
  isEdit,
  onSuccess,
  onCancel,
}: {
  productId: string;
  initialPrice?: number;
  isEdit: boolean;
  onSuccess: (pence: number) => void;
  onCancel: () => void;
}) {
  const [priceInput, setPriceInput] = useState(
    initialPrice ? (initialPrice / 100).toFixed(2) : ""
  );
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    const priceNum = parseFloat(priceInput);
    if (isNaN(priceNum) || priceNum < 1) {
      toast({
        title: "Invalid price",
        description: "Please enter a price of at least £1.00.",
        variant: "destructive",
      });
      return;
    }
    const pence = Math.round(priceNum * 100);
    setLoading(true);
    try {
      const res = await fetch(`/api/products/${productId}/native-publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price: pence }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to publish");
      toast({
        title: isEdit ? "Price updated!" : "Published!",
        description: isEdit
          ? `Price updated to ${data.priceLabel}`
          : `Product is now live at ${data.priceLabel}`,
      });
      onSuccess(pence);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2 mt-2">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium select-none">
          £
        </span>
        <Input
          type="number"
          min="1"
          step="0.01"
          value={priceInput}
          onChange={(e) => setPriceInput(e.target.value)}
          className="pl-7 w-28 h-8 text-sm bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-orange-500/50 focus:ring-orange-500/20"
          placeholder="9.99"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
            if (e.key === "Escape") onCancel();
          }}
        />
      </div>
      <Button
        size="sm"
        onClick={handleSubmit}
        disabled={loading}
        className="h-8 bg-orange-500 hover:bg-orange-600 text-white text-xs shrink-0"
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : isEdit ? (
          "Update"
        ) : (
          "Publish"
        )}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={onCancel}
        disabled={loading}
        className="h-8 text-xs text-gray-400 hover:text-white shrink-0"
      >
        Cancel
      </Button>
    </div>
  );
}

// Card for a published product
function PublishedProductCard({
  item,
  onRefresh,
}: {
  item: LibraryItem;
  onRefresh: () => void;
}) {
  const [editingPrice, setEditingPrice] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const { toast } = useToast();

  const handleUnpublish = async () => {
    setUnpublishing(true);
    try {
      const res = await fetch(`/api/products/${item.id}/native-publish`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to unpublish");
      toast({ title: "Unpublished", description: `"${item.title}" removed from your store.` });
      onRefresh();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to unpublish",
        variant: "destructive",
      });
    } finally {
      setUnpublishing(false);
    }
  };

  return (
    <div className="bg-card border border-white/8 rounded-2xl p-5 flex flex-col gap-3 hover:border-orange-500/20 transition-colors">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
          <Package className="w-4 h-4 text-orange-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white leading-tight truncate">{item.title}</p>
          <div className="flex items-center gap-2 mt-1">
            <Badge className="text-[10px] bg-green-500/15 text-green-400 border border-green-500/20 hover:bg-green-500/15">
              Live
            </Badge>
            <FormatBadge format={item.format} />
          </div>
        </div>
        {item.nativePrice != null && !editingPrice && (
          <span className="text-lg font-bold text-orange-400 shrink-0">
            {formatPrice(item.nativePrice)}
          </span>
        )}
      </div>

      {/* Price edit form */}
      {editingPrice && (
        <PriceForm
          productId={item.id}
          initialPrice={item.nativePrice}
          isEdit
          onSuccess={() => {
            setEditingPrice(false);
            onRefresh();
          }}
          onCancel={() => setEditingPrice(false)}
        />
      )}

      {/* Actions */}
      {!editingPrice && (
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs border-white/10 text-gray-300 hover:text-white hover:border-white/20 gap-1.5"
            onClick={() => window.open(`/product/${item.id}`, "_blank")}
          >
            <Eye className="w-3.5 h-3.5" />
            View Page
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs border-white/10 text-gray-300 hover:text-white hover:border-orange-500/30 gap-1.5"
            onClick={() => setEditingPrice(true)}
          >
            <PencilLine className="w-3.5 h-3.5" />
            Edit Price
          </Button>
          <Link href={`/dashboard/email-marketing?blast=buyers&product=${item.id}`}>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs border-white/10 text-blue-400 hover:text-blue-300 hover:border-blue-500/30 gap-1.5"
            >
              <Mail className="w-3.5 h-3.5" />
              Email Customers
            </Button>
          </Link>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs border-white/10 text-red-400 hover:text-red-300 hover:border-red-500/30 ml-auto gap-1.5"
            onClick={handleUnpublish}
            disabled={unpublishing}
          >
            {unpublishing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
            Unpublish
          </Button>
        </div>
      )}
    </div>
  );
}

// Row for an unpublished product
function UnpublishedProductRow({
  item,
  onRefresh,
}: {
  item: LibraryItem;
  onRefresh: () => void;
}) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="flex flex-col gap-1 py-3 border-b border-white/5 last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
          <BookOpen className="w-3.5 h-3.5 text-gray-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-200 truncate">{item.title}</p>
        </div>
        <FormatBadge format={item.format} />
        {!showForm && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs border-orange-500/30 text-orange-400 hover:text-orange-300 hover:border-orange-500/50 hover:bg-orange-500/5 shrink-0 gap-1.5"
            onClick={() => setShowForm(true)}
          >
            <ShoppingBag className="w-3 h-3" />
            Publish
          </Button>
        )}
      </div>
      {showForm && (
        <div className="pl-10">
          <p className="text-xs text-gray-500 mb-1">Set a price to publish to your store</p>
          <PriceForm
            productId={item.id}
            isEdit={false}
            onSuccess={() => {
              setShowForm(false);
              onRefresh();
            }}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}
    </div>
  );
}

type PromoCode = { id: string; code: string; discountPercent: number | null; discountAmount: number | null; maxUses: number | null; usedCount: number; active: boolean; expiresAt: string | null };

export function StoreClient({ userId }: StoreClientProps) {
  const storeUrl = `${STORE_BASE}/${userId}`;
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  // Promo codes state
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [promoLoading, setPromoLoading] = useState(true);
  const [showPromoForm, setShowPromoForm] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoDiscount, setPromoDiscount] = useState("");
  const [promoMaxUses, setPromoMaxUses] = useState("");
  const [promoExpiry, setPromoExpiry] = useState("");
  const [savingPromo, setSavingPromo] = useState(false);

  const fetchPromoCodes = useCallback(async () => {
    setPromoLoading(true);
    try {
      const res = await fetch("/api/creator/promo-codes");
      if (res.ok) setPromoCodes(await res.json());
    } catch {} finally { setPromoLoading(false); }
  }, []);

  useEffect(() => { fetchPromoCodes(); }, [fetchPromoCodes]);

  const fetchLibrary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/library?type=products");
      if (!res.ok) throw new Error("Failed to load library");
      const data: LibraryItem[] = await res.json();
      // Only products
      setItems(data.filter((d) => d.type === "product"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLibrary();
  }, [fetchLibrary]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(storeUrl);
      setCopied(true);
      toast({ title: "Copied!", description: "Store URL copied to clipboard." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Copy failed", description: "Please copy the URL manually.", variant: "destructive" });
    }
  };

  const published = items.filter((i) => i.isNativePublished);
  const unpublished = items.filter((i) => !i.isNativePublished);

  return (
    <div className="min-h-screen bg-background p-6 md:p-8 max-w-4xl mx-auto space-y-8">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <Store className="w-5 h-5 text-orange-400" />
            <h1 className="text-2xl font-bold text-white tracking-tight">My Store</h1>
          </div>
          <p className="text-sm text-gray-400">
            Sell your digital products directly to your audience.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/digital-products/upload">
            <Button
              size="sm"
              className="gap-2 bg-orange-500 hover:bg-orange-600 text-white h-9"
            >
              <Upload className="w-4 h-4" />
              Upload Product
            </Button>
          </Link>
          <Link href="/dashboard/store/customize">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-orange-500/30 text-orange-400 hover:text-orange-300 hover:border-orange-500/50 hover:bg-orange-500/5 h-9"
            >
              <Paintbrush className="w-4 h-4" />
              Customise Store
            </Button>
          </Link>
        </div>
      </div>

      {/* Store URL card */}
      <div className="relative rounded-2xl overflow-hidden border border-orange-500/20 bg-gradient-to-br from-orange-500/10 via-orange-500/5 to-transparent p-6">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent pointer-events-none" />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-widest text-orange-400 mb-1">
            Your Public Store
          </p>
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <div className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded-xl px-4 py-2.5">
              <p className="text-sm text-gray-200 font-mono truncate">{storeUrl}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="h-9 border-orange-500/30 text-orange-300 hover:text-orange-200 hover:border-orange-500/50 hover:bg-orange-500/10 gap-2"
                onClick={handleCopy}
              >
                {copied ? (
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                {copied ? "Copied!" : "Copy Link"}
              </Button>
              <Button
                size="sm"
                className="h-9 bg-orange-500 hover:bg-orange-600 text-white gap-2"
                onClick={() => window.open(storeUrl, "_blank")}
              >
                <ExternalLink className="w-4 h-4" />
                Open Store
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl bg-card border border-white/8 p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">
              Published
            </p>
            <p className="text-3xl font-bold text-white">{published.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">products live</p>
          </div>
          <div className="rounded-2xl bg-card border border-white/8 p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">
              In Library
            </p>
            <p className="text-3xl font-bold text-white">{items.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">total products</p>
          </div>
          <div className="col-span-2 sm:col-span-1 rounded-2xl bg-card border border-white/8 p-4 flex flex-col justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">
                Revenue
              </p>
              <p className="text-sm font-semibold text-gray-300">Sales analytics</p>
            </div>
            <Link
              href="/dashboard/admin/revenue"
              className="mt-2 inline-flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300 transition-colors"
            >
              <BarChart2 className="w-3.5 h-3.5" />
              View in Analytics
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-orange-400" />
          <p className="text-sm text-gray-400">Loading your store...</p>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center">
          <p className="text-sm text-red-400">{error}</p>
          <Button
            size="sm"
            variant="outline"
            className="mt-3 border-red-500/30 text-red-400 hover:text-red-300"
            onClick={fetchLibrary}
          >
            Try again
          </Button>
        </div>
      )}

      {/* Published products */}
      {!loading && !error && (
        <>
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400">
                Published Products
              </h2>
              {published.length > 0 && (
                <Badge className="bg-green-500/15 text-green-400 border border-green-500/20 hover:bg-green-500/15 text-xs">
                  {published.length} live
                </Badge>
              )}
            </div>

            {published.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-card p-10 text-center">
                <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mx-auto mb-4">
                  <ShoppingBag className="w-6 h-6 text-orange-400" />
                </div>
                <p className="text-sm font-medium text-gray-300 mb-1">No products published yet</p>
                <p className="text-xs text-gray-500 mb-5 max-w-xs mx-auto">
                  Upload a product you&apos;ve already made, or go to your library to publish an AI-generated one.
                </p>
                <div className="flex items-center justify-center gap-3 flex-wrap">
                  <Link href="/dashboard/digital-products/upload">
                    <Button
                      size="sm"
                      className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Upload a product
                    </Button>
                  </Link>
                  <Link href="/dashboard/library">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-white/10 text-gray-300 hover:text-white hover:border-white/20 gap-2"
                    >
                      <Package className="w-3.5 h-3.5" />
                      My Library
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {published.map((item) => (
                  <PublishedProductCard
                    key={item.id}
                    item={item}
                    onRefresh={fetchLibrary}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Unpublished products */}
          {unpublished.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400">
                  All Other Products
                </h2>
                <span className="text-xs text-gray-500">{unpublished.length} unpublished</span>
              </div>
              <div className="rounded-2xl bg-card border border-white/8 px-5 py-1">
                {unpublished.map((item) => (
                  <UnpublishedProductRow
                    key={item.id}
                    item={item}
                    onRefresh={fetchLibrary}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Add product CTA */}
          <div className="flex items-center justify-center gap-3 pt-2">
            <Link href="/dashboard/digital-products/upload">
              <Button variant="outline" size="sm" className="gap-2 border-white/10 text-gray-400 hover:text-orange-400 hover:border-orange-500/30 h-8 text-xs">
                <Upload className="w-3.5 h-3.5" />
                Upload a product
              </Button>
            </Link>
            <Link href="/dashboard/digital-products">
              <Button variant="outline" size="sm" className="gap-2 border-white/10 text-gray-400 hover:text-orange-400 hover:border-orange-500/30 h-8 text-xs">
                <Plus className="w-3.5 h-3.5" />
                Create with AI
              </Button>
            </Link>
          </div>

          {/* Promo Codes */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-orange-400" />
                <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400">Promo Codes</h2>
              </div>
              <Button size="sm" variant="outline" className="h-7 text-xs border-white/10 text-gray-300 hover:text-white gap-1.5" onClick={() => setShowPromoForm(!showPromoForm)}>
                <Plus className="w-3 h-3" />New code
              </Button>
            </div>

            {showPromoForm && (
              <div className="rounded-2xl bg-card border border-white/8 p-5 mb-4 space-y-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Create promo code</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500">Code</p>
                    <Input value={promoCode} onChange={(e) => setPromoCode(e.target.value.toUpperCase())} placeholder="SUMMER20" className="h-8 text-sm bg-white/5 border-white/10 text-white uppercase" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500">Discount % (e.g. 20)</p>
                    <Input type="number" min="1" max="100" value={promoDiscount} onChange={(e) => setPromoDiscount(e.target.value)} placeholder="20" className="h-8 text-sm bg-white/5 border-white/10 text-white" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500">Max uses (blank = unlimited)</p>
                    <Input type="number" min="1" value={promoMaxUses} onChange={(e) => setPromoMaxUses(e.target.value)} placeholder="∞" className="h-8 text-sm bg-white/5 border-white/10 text-white" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500">Expires (optional)</p>
                    <Input type="date" value={promoExpiry} onChange={(e) => setPromoExpiry(e.target.value)} className="h-8 text-sm bg-white/5 border-white/10 text-white" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white h-8 text-xs" disabled={savingPromo}
                    onClick={async () => {
                      if (!promoCode.trim() || !promoDiscount) { toast({ title: "Code and discount are required", variant: "destructive" }); return; }
                      setSavingPromo(true);
                      try {
                        const res = await fetch("/api/creator/promo-codes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: promoCode, discountPercent: parseInt(promoDiscount), maxUses: promoMaxUses || null, expiresAt: promoExpiry || null }) });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || "Failed");
                        toast({ title: "Code created!" });
                        setPromoCode(""); setPromoDiscount(""); setPromoMaxUses(""); setPromoExpiry(""); setShowPromoForm(false);
                        await fetchPromoCodes();
                      } catch (err) { toast({ title: err instanceof Error ? err.message : "Failed", variant: "destructive" }); }
                      finally { setSavingPromo(false); }
                    }}>
                    {savingPromo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Create"}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 text-xs text-gray-400" onClick={() => setShowPromoForm(false)}>Cancel</Button>
                </div>
              </div>
            )}

            {promoLoading ? (
              <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-orange-400" /></div>
            ) : promoCodes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center">
                <p className="text-sm text-gray-500">No promo codes yet — create one to offer discounts to your audience.</p>
              </div>
            ) : (
              <div className="rounded-2xl bg-card border border-white/8 divide-y divide-white/5">
                {promoCodes.map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-5 py-3 gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <code className="text-sm font-bold text-orange-400">{c.code}</code>
                      <span className="text-xs text-gray-400">
                        {c.discountPercent ? `${c.discountPercent}% off` : c.discountAmount ? `£${(c.discountAmount / 100).toFixed(2)} off` : ""}
                      </span>
                      {c.maxUses && <span className="text-xs text-gray-500">{c.usedCount}/{c.maxUses} uses</span>}
                      {c.expiresAt && <span className="text-xs text-gray-500">expires {new Date(c.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>}
                    </div>
                    <button className="text-gray-500 hover:text-red-400 transition-colors" onClick={async () => {
                      try {
                        await fetch("/api/creator/promo-codes", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: c.id }) });
                        toast({ title: "Code deleted" }); fetchPromoCodes();
                      } catch { toast({ title: "Failed", variant: "destructive" }); }
                    }}>
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
