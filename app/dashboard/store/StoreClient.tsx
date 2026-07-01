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
  Layers,
  Users,
  CreditCard,
  Settings,
  TrendingUp,
  UserCircle,
  Search,
  Send,
  Star,
  Zap,
} from "lucide-react";
import Link from "next/link";

// ── Types ──────────────────────────────────────────────────────────────────────

interface LibraryItem {
  id: string;
  type: "product" | "video" | "script";
  title: string;
  status: string;
  format?: string;
  isNativePublished?: boolean;
  nativePrice?: number;
}

interface StoreClientProps {
  userId: string;
}

type PromoCode = {
  id: string; code: string; discountPercent: number | null;
  discountAmount: number | null; maxUses: number | null;
  usedCount: number; active: boolean; expiresAt: string | null;
};
type Bundle = {
  id: string; title: string; description: string | null;
  bundlePrice: number; productIds: string[]; active: boolean;
};
type AffiliateLink = {
  id: string; affiliateName: string; affiliateEmail: string | null;
  code: string; commissionPercent: number; salesCount: number;
  totalCommissionCents: number; referralUrl: string;
};
type RecentOrder = {
  id: string; buyerEmail: string; buyerName: string | null;
  amountCents: number; currency: string; createdAt: string;
  productTitle: string;
};
type DayRevenue = { date: string; cents: number; orders: number };
type TopProduct = { productId: string; title: string; orders: number; revenueCents: number };
interface AnalyticsData {
  totalRevenueCents: number; totalOrders: number;
  last30DaysRevenueCents: number; last30DaysOrders: number;
  dailyRevenue: DayRevenue[]; topProducts: TopProduct[];
  recentOrders: RecentOrder[]; subscriberCount: number;
}
interface Customer {
  email: string; name: string | null; totalCents: number;
  orders: number; lastOrderAt: string; products: string[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STORE_BASE = "https://contentflywheel.co.uk/c";

type Tab = "products" | "bundles" | "promo" | "affiliates" | "customers" | "email" | "analytics" | "payouts" | "settings";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "products",   label: "Products",    icon: <ShoppingBag className="w-3.5 h-3.5" /> },
  { id: "bundles",    label: "Bundles",     icon: <Layers className="w-3.5 h-3.5" /> },
  { id: "promo",      label: "Promo Codes", icon: <Tag className="w-3.5 h-3.5" /> },
  { id: "affiliates", label: "Affiliates",  icon: <Users className="w-3.5 h-3.5" /> },
  { id: "customers",  label: "Customers",   icon: <UserCircle className="w-3.5 h-3.5" /> },
  { id: "email",      label: "Email",       icon: <Mail className="w-3.5 h-3.5" /> },
  { id: "analytics",  label: "Analytics",   icon: <TrendingUp className="w-3.5 h-3.5" /> },
  { id: "payouts",    label: "Payouts",     icon: <CreditCard className="w-3.5 h-3.5" /> },
  { id: "settings",   label: "Settings",    icon: <Settings className="w-3.5 h-3.5" /> },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPrice(pence: number) { return `\xa3${(pence / 100).toFixed(2)}`; }
function maskEmail(email: string) { return email.replace(/(.{2}).*@/, "$1***@"); }
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function FormatBadge({ format }: { format?: string }) {
  if (!format) return null;
  const label = format === "ebook" ? "eBook" : format === "template" ? "Template" :
    format === "course" ? "Course" : format === "bundle" ? "Bundle" : format;
  return <Badge variant="outline" className="text-[10px] border-white/10 text-gray-400 shrink-0">{label}</Badge>;
}

// ── PriceForm ─────────────────────────────────────────────────────────────────

function PriceForm({ productId, initialPrice, isEdit, onSuccess, onCancel }: {
  productId: string; initialPrice?: number; isEdit: boolean;
  onSuccess: (pence: number) => void; onCancel: () => void;
}) {
  const [priceInput, setPriceInput] = useState(initialPrice ? (initialPrice / 100).toFixed(2) : "");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    const priceNum = parseFloat(priceInput);
    if (isNaN(priceNum) || priceNum < 1) {
      toast({ title: "Invalid price", description: "Please enter a price of at least \xa31.00.", variant: "destructive" });
      return;
    }
    const pence = Math.round(priceNum * 100);
    setLoading(true);
    try {
      const res = await fetch(`/api/products/${productId}/native-publish`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price: pence }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to publish");
      toast({ title: isEdit ? "Price updated!" : "Published!", description: isEdit ? `Price updated to ${data.priceLabel}` : `Product is now live at ${data.priceLabel}` });
      onSuccess(pence);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Something went wrong", variant: "destructive" });
    } finally { setLoading(false); }
  };

  return (
    <div className="flex items-center gap-2 mt-2">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium select-none">\xa3</span>
        <Input type="number" min="1" step="0.01" value={priceInput} onChange={(e) => setPriceInput(e.target.value)}
          className="pl-7 w-28 h-8 text-sm bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-orange-500/50"
          placeholder="9.99" autoFocus
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); if (e.key === "Escape") onCancel(); }}
        />
      </div>
      <Button size="sm" onClick={handleSubmit} disabled={loading} className="h-8 bg-orange-500 hover:bg-orange-600 text-white text-xs shrink-0">
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isEdit ? "Update" : "Publish"}
      </Button>
      <Button size="sm" variant="ghost" onClick={onCancel} disabled={loading} className="h-8 text-xs text-gray-400 hover:text-white shrink-0">Cancel</Button>
    </div>
  );
}

// ── PublishedProductCard ──────────────────────────────────────────────────────

function PublishedProductCard({ item, onRefresh }: { item: LibraryItem; onRefresh: () => void }) {
  const [editingPrice, setEditingPrice] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const { toast } = useToast();

  const handleUnpublish = async () => {
    setUnpublishing(true);
    try {
      const res = await fetch(`/api/products/${item.id}/native-publish`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to unpublish");
      toast({ title: "Unpublished", description: `"${item.title}" removed from your store.` });
      onRefresh();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to unpublish", variant: "destructive" });
    } finally { setUnpublishing(false); }
  };

  return (
    <div className="bg-card border border-white/8 rounded-2xl p-5 flex flex-col gap-3 hover:border-orange-500/20 transition-colors">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
          <Package className="w-4 h-4 text-orange-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white leading-tight truncate">{item.title}</p>
          <div className="flex items-center gap-2 mt-1">
            <Badge className="text-[10px] bg-green-500/15 text-green-400 border border-green-500/20 hover:bg-green-500/15">Live</Badge>
            <FormatBadge format={item.format} />
          </div>
        </div>
        {item.nativePrice != null && !editingPrice && (
          <span className="text-lg font-bold text-orange-400 shrink-0">{formatPrice(item.nativePrice)}</span>
        )}
      </div>
      {editingPrice && (
        <PriceForm productId={item.id} initialPrice={item.nativePrice} isEdit
          onSuccess={() => { setEditingPrice(false); onRefresh(); }}
          onCancel={() => setEditingPrice(false)}
        />
      )}
      {!editingPrice && (
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" className="h-8 text-xs border-white/10 text-gray-300 hover:text-white hover:border-white/20 gap-1.5" onClick={() => window.open(`/product/${item.id}`, "_blank")}>
            <Eye className="w-3.5 h-3.5" />View Page
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs border-white/10 text-gray-300 hover:text-white hover:border-orange-500/30 gap-1.5" onClick={() => setEditingPrice(true)}>
            <PencilLine className="w-3.5 h-3.5" />Edit Price
          </Button>
          <Link href={`/dashboard/email-marketing?blast=buyers&product=${item.id}`}>
            <Button size="sm" variant="outline" className="h-8 text-xs border-white/10 text-blue-400 hover:text-blue-300 hover:border-blue-500/30 gap-1.5">
              <Mail className="w-3.5 h-3.5" />Email Buyers
            </Button>
          </Link>
          <Button size="sm" variant="outline" className="h-8 text-xs border-white/10 text-red-400 hover:text-red-300 hover:border-red-500/30 ml-auto gap-1.5" onClick={handleUnpublish} disabled={unpublishing}>
            {unpublishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}Unpublish
          </Button>
        </div>
      )}
    </div>
  );
}

// ── UnpublishedProductRow ─────────────────────────────────────────────────────

function UnpublishedProductRow({ item, onRefresh }: { item: LibraryItem; onRefresh: () => void }) {
  const [showForm, setShowForm] = useState(false);
  return (
    <div className="flex flex-col gap-1 py-3 border-b border-white/5 last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
          <BookOpen className="w-3.5 h-3.5 text-gray-500" />
        </div>
        <div className="flex-1 min-w-0"><p className="text-sm text-gray-200 truncate">{item.title}</p></div>
        <FormatBadge format={item.format} />
        {!showForm && (
          <Button size="sm" variant="outline" className="h-7 text-xs border-orange-500/30 text-orange-400 hover:text-orange-300 hover:border-orange-500/50 hover:bg-orange-500/5 shrink-0 gap-1.5" onClick={() => setShowForm(true)}>
            <ShoppingBag className="w-3 h-3" />Publish
          </Button>
        )}
      </div>
      {showForm && (
        <div className="pl-10">
          <p className="text-xs text-gray-500 mb-1">Set a price to publish to your store</p>
          <PriceForm productId={item.id} isEdit={false}
            onSuccess={() => { setShowForm(false); onRefresh(); }}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}
    </div>
  );
}

// ── Revenue Mini Chart (pure CSS) ─────────────────────────────────────────────

function RevenueChart({ data }: { data: DayRevenue[] }) {
  const maxCents = Math.max(...data.map((d) => d.cents), 1);
  const last14 = data.slice(-14);
  return (
    <div className="flex items-end gap-1 h-20 w-full">
      {last14.map((d) => {
        const pct = (d.cents / maxCents) * 100;
        const hasRevenue = d.cents > 0;
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative">
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] rounded px-1.5 py-0.5 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
              {formatPrice(d.cents)}
            </div>
            <div className="w-full flex items-end" style={{ height: "72px" }}>
              <div
                className={`w-full rounded-t transition-all ${hasRevenue ? "bg-orange-500" : "bg-white/5"}`}
                style={{ height: `${Math.max(pct, hasRevenue ? 4 : 2)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function StoreClient({ userId }: StoreClientProps) {
  const storeUrl = `${STORE_BASE}/${userId}`;
  const [activeTab, setActiveTab] = useState<Tab>("products");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  // Products
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Promo codes
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [promoLoading, setPromoLoading] = useState(true);
  const [showPromoForm, setShowPromoForm] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoDiscount, setPromoDiscount] = useState("");
  const [promoMaxUses, setPromoMaxUses] = useState("");
  const [promoExpiry, setPromoExpiry] = useState("");
  const [savingPromo, setSavingPromo] = useState(false);

  // Bundles
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [bundlesLoading, setBundlesLoading] = useState(true);
  const [showBundleForm, setShowBundleForm] = useState(false);
  const [bundleTitle, setBundleTitle] = useState("");
  const [bundleDescription, setBundleDescription] = useState("");
  const [bundlePrice, setBundlePrice] = useState("");
  const [bundleProductIds, setBundleProductIds] = useState<string[]>([]);
  const [savingBundle, setSavingBundle] = useState(false);

  // Affiliates
  const [affiliates, setAffiliates] = useState<AffiliateLink[]>([]);
  const [affiliatesLoading, setAffiliatesLoading] = useState(true);
  const [showAffiliateForm, setShowAffiliateForm] = useState(false);
  const [affiliateName, setAffiliateName] = useState("");
  const [affiliateEmail, setAffiliateEmail] = useState("");
  const [affiliateCommission, setAffiliateCommission] = useState("20");
  const [savingAffiliate, setSavingAffiliate] = useState(false);

  // Analytics + Customers + Email (shared fetch)
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [customerSearch, setCustomerSearch] = useState("");

  // ── Fetchers ──

  const fetchPromoCodes = useCallback(async () => {
    setPromoLoading(true);
    try { const res = await fetch("/api/creator/promo-codes"); if (res.ok) setPromoCodes(await res.json()); }
    catch {} finally { setPromoLoading(false); }
  }, []);

  const fetchBundles = useCallback(async () => {
    setBundlesLoading(true);
    try { const res = await fetch("/api/bundles"); if (res.ok) setBundles(await res.json()); }
    catch {} finally { setBundlesLoading(false); }
  }, []);

  const fetchAffiliates = useCallback(async () => {
    setAffiliatesLoading(true);
    try { const res = await fetch("/api/affiliates"); if (res.ok) setAffiliates(await res.json()); }
    catch {} finally { setAffiliatesLoading(false); }
  }, []);

  const fetchLibrary = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/library?type=products");
      if (!res.ok) throw new Error("Failed to load library");
      const data: LibraryItem[] = await res.json();
      setItems(data.filter((d) => d.type === "product"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally { setLoading(false); }
  }, []);

  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const res = await fetch("/api/analytics/revenue");
      if (res.ok) setAnalytics(await res.json());
    } catch {} finally { setAnalyticsLoading(false); }
  }, []);

  useEffect(() => {
    fetchPromoCodes(); fetchBundles(); fetchAffiliates(); fetchLibrary(); fetchAnalytics();
  }, [fetchPromoCodes, fetchBundles, fetchAffiliates, fetchLibrary, fetchAnalytics]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(storeUrl);
      setCopied(true);
      toast({ title: "Copied!", description: "Store URL copied to clipboard." });
      setTimeout(() => setCopied(false), 2000);
    } catch { toast({ title: "Copy failed", variant: "destructive" }); }
  };

  // Derive customers from orders
  const customers: Customer[] = (analytics?.recentOrders ?? []).reduce((acc, o) => {
    const idx = acc.findIndex((c) => c.email === o.buyerEmail);
    if (idx >= 0) {
      acc[idx].totalCents += o.amountCents;
      acc[idx].orders += 1;
      if (!acc[idx].products.includes(o.productTitle)) acc[idx].products.push(o.productTitle);
      if (new Date(o.createdAt) > new Date(acc[idx].lastOrderAt)) acc[idx].lastOrderAt = o.createdAt;
    } else {
      acc.push({ email: o.buyerEmail, name: o.buyerName, totalCents: o.amountCents, orders: 1, lastOrderAt: o.createdAt, products: [o.productTitle] });
    }
    return acc;
  }, [] as Customer[]).sort((a, b) => b.totalCents - a.totalCents);

  const filteredCustomers = customers.filter((c) =>
    c.email.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.name ?? "").toLowerCase().includes(customerSearch.toLowerCase())
  );

  const published = items.filter((i) => i.isNativePublished);
  const unpublished = items.filter((i) => !i.isNativePublished);

  return (
    <div className="min-h-screen bg-background">
      <div className="p-6 md:p-8 max-w-5xl mx-auto">

        {/* ── Page Header ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <Store className="w-5 h-5 text-orange-400" />
              <h1 className="text-2xl font-bold text-white tracking-tight">My Store</h1>
            </div>
            <p className="text-sm text-gray-400">Sell your digital products directly to your audience.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/digital-products/upload">
              <Button size="sm" className="gap-2 bg-orange-500 hover:bg-orange-600 text-white h-9">
                <Upload className="w-4 h-4" />Upload Product
              </Button>
            </Link>
            <Link href="/dashboard/store/customize">
              <Button variant="outline" size="sm" className="gap-2 border-orange-500/30 text-orange-400 hover:text-orange-300 hover:border-orange-500/50 hover:bg-orange-500/5 h-9">
                <Paintbrush className="w-4 h-4" />Customise
              </Button>
            </Link>
          </div>
        </div>

        {/* ── Store URL Card ── */}
        <div className="relative rounded-2xl overflow-hidden border border-orange-500/20 bg-gradient-to-br from-orange-500/10 via-orange-500/5 to-transparent p-5 mb-6">
          <div className="relative flex items-center gap-3 flex-wrap">
            <p className="text-xs font-semibold uppercase tracking-widest text-orange-400 shrink-0">Your Store:</p>
            <div className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded-xl px-4 py-2">
              <p className="text-sm text-gray-200 font-mono truncate">{storeUrl}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" variant="outline" className="h-8 border-orange-500/30 text-orange-300 hover:text-orange-200 hover:border-orange-500/50 hover:bg-orange-500/10 gap-2" onClick={handleCopy}>
                {copied ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied!" : "Copy"}
              </Button>
              <Button size="sm" className="h-8 bg-orange-500 hover:bg-orange-600 text-white gap-2" onClick={() => window.open(storeUrl, "_blank")}>
                <ExternalLink className="w-4 h-4" />Open
              </Button>
            </div>
          </div>
        </div>

        {/* ── Quick Stats ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="rounded-2xl bg-card border border-white/8 p-4">
            <p className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold mb-1">Live Products</p>
            <p className="text-2xl font-bold text-white">{published.length}</p>
          </div>
          <div className="rounded-2xl bg-card border border-white/8 p-4">
            <p className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold mb-1">All Time Revenue</p>
            <p className="text-2xl font-bold text-orange-400">
              {analyticsLoading ? "..." : formatPrice(analytics?.totalRevenueCents ?? 0)}
            </p>
          </div>
          <div className="rounded-2xl bg-card border border-white/8 p-4">
            <p className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold mb-1">Customers</p>
            <p className="text-2xl font-bold text-white">{analyticsLoading ? "..." : customers.length}</p>
          </div>
          <div className="rounded-2xl bg-card border border-white/8 p-4">
            <p className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold mb-1">Subscribers</p>
            <p className="text-2xl font-bold text-white">{analyticsLoading ? "..." : analytics?.subscriberCount ?? 0}</p>
          </div>
        </div>

        {/* ── Tab Nav ── */}
        <div className="border-b border-white/8 mb-6">
          <nav className="-mb-px flex gap-0.5 overflow-x-auto scrollbar-none">
            {TABS.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-orange-500 text-orange-400"
                    : "border-transparent text-gray-500 hover:text-gray-300 hover:border-white/20"
                }`}
              >
                {tab.icon}{tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* PRODUCTS TAB                                                          */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "products" && (
          <div className="space-y-6">
            {loading && <div className="flex flex-col items-center justify-center py-20 gap-3"><Loader2 className="w-7 h-7 animate-spin text-orange-400" /><p className="text-sm text-gray-400">Loading your store...</p></div>}
            {!loading && error && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center">
                <p className="text-sm text-red-400">{error}</p>
                <Button size="sm" variant="outline" className="mt-3 border-red-500/30 text-red-400 hover:text-red-300" onClick={fetchLibrary}>Try again</Button>
              </div>
            )}
            {!loading && !error && (
              <>
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400">Published Products</h2>
                    {published.length > 0 && <Badge className="bg-green-500/15 text-green-400 border border-green-500/20 hover:bg-green-500/15 text-xs">{published.length} live</Badge>}
                  </div>
                  {published.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-card p-10 text-center">
                      <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mx-auto mb-4"><ShoppingBag className="w-6 h-6 text-orange-400" /></div>
                      <p className="text-sm font-medium text-gray-300 mb-1">No products published yet</p>
                      <p className="text-xs text-gray-500 mb-5 max-w-xs mx-auto">Upload a product or publish an AI-generated one from your library.</p>
                      <div className="flex items-center justify-center gap-3 flex-wrap">
                        <Link href="/dashboard/digital-products/upload"><Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white gap-2"><Upload className="w-3.5 h-3.5" />Upload a product</Button></Link>
                        <Link href="/dashboard/library"><Button size="sm" variant="outline" className="border-white/10 text-gray-300 hover:text-white hover:border-white/20 gap-2"><Package className="w-3.5 h-3.5" />My Library</Button></Link>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {published.map((item) => <PublishedProductCard key={item.id} item={item} onRefresh={fetchLibrary} />)}
                    </div>
                  )}
                </section>
                {unpublished.length > 0 && (
                  <section>
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400">Unpublished</h2>
                      <span className="text-xs text-gray-500">{unpublished.length} products</span>
                    </div>
                    <div className="rounded-2xl bg-card border border-white/8 px-5 py-1">
                      {unpublished.map((item) => <UnpublishedProductRow key={item.id} item={item} onRefresh={fetchLibrary} />)}
                    </div>
                  </section>
                )}
                <div className="flex items-center justify-center gap-3 pt-2">
                  <Link href="/dashboard/digital-products/upload">
                    <Button variant="outline" size="sm" className="gap-2 border-white/10 text-gray-400 hover:text-orange-400 hover:border-orange-500/30 h-8 text-xs"><Upload className="w-3.5 h-3.5" />Upload a product</Button>
                  </Link>
                  <Link href="/dashboard/digital-products">
                    <Button variant="outline" size="sm" className="gap-2 border-white/10 text-gray-400 hover:text-orange-400 hover:border-orange-500/30 h-8 text-xs"><Plus className="w-3.5 h-3.5" />Create with AI</Button>
                  </Link>
                </div>
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* BUNDLES TAB                                                           */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "bundles" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div><h2 className="text-base font-semibold text-white">Product Bundles</h2><p className="text-xs text-gray-500 mt-0.5">Group products and sell at a special price.</p></div>
              <Button size="sm" variant="outline" className="h-8 text-xs border-white/10 text-gray-300 hover:text-white gap-1.5" onClick={() => setShowBundleForm(!showBundleForm)}>
                <Plus className="w-3 h-3" />New bundle
              </Button>
            </div>
            {showBundleForm && (
              <div className="rounded-2xl bg-card border border-white/8 p-5 space-y-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Create bundle</p>
                <div className="space-y-3">
                  <div className="space-y-1"><p className="text-xs text-gray-500">Title</p><Input value={bundleTitle} onChange={(e) => setBundleTitle(e.target.value)} placeholder="Ultimate Creator Pack" className="h-8 text-sm bg-white/5 border-white/10 text-white" /></div>
                  <div className="space-y-1"><p className="text-xs text-gray-500">Description (optional)</p><Input value={bundleDescription} onChange={(e) => setBundleDescription(e.target.value)} placeholder="Everything you need to get started..." className="h-8 text-sm bg-white/5 border-white/10 text-white" /></div>
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500">Bundle price</p>
                    <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">\xa3</span><Input type="number" min="1" step="0.01" value={bundlePrice} onChange={(e) => setBundlePrice(e.target.value)} placeholder="19.99" className="pl-7 h-8 text-sm bg-white/5 border-white/10 text-white" /></div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500">Select products (at least 2)</p>
                    <div className="rounded-xl border border-white/8 divide-y divide-white/5 max-h-48 overflow-y-auto">
                      {items.filter((i) => i.isNativePublished).length === 0 ? (
                        <p className="text-xs text-gray-500 p-3">No published products yet.</p>
                      ) : items.filter((i) => i.isNativePublished).map((item) => (
                        <label key={item.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-white/5">
                          <input type="checkbox" checked={bundleProductIds.includes(item.id)} onChange={(e) => { if (e.target.checked) setBundleProductIds((p) => [...p, item.id]); else setBundleProductIds((p) => p.filter((id) => id !== item.id)); }} className="accent-orange-500" />
                          <span className="text-sm text-gray-200">{item.title}</span>
                          {item.nativePrice != null && <span className="text-xs text-gray-500 ml-auto">{formatPrice(item.nativePrice)}</span>}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white h-8 text-xs" disabled={savingBundle} onClick={async () => {
                    if (!bundleTitle.trim()) { toast({ title: "Title is required", variant: "destructive" }); return; }
                    if (!bundlePrice || parseFloat(bundlePrice) < 1) { toast({ title: "Price must be at least \xa31", variant: "destructive" }); return; }
                    if (bundleProductIds.length < 2) { toast({ title: "Select at least 2 products", variant: "destructive" }); return; }
                    setSavingBundle(true);
                    try {
                      const res = await fetch("/api/bundles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: bundleTitle, description: bundleDescription || null, bundlePrice: Math.round(parseFloat(bundlePrice) * 100), productIds: bundleProductIds }) });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error || "Failed");
                      toast({ title: "Bundle created!" });
                      setBundleTitle(""); setBundleDescription(""); setBundlePrice(""); setBundleProductIds([]); setShowBundleForm(false);
                      fetchBundles();
                    } catch (err) { toast({ title: err instanceof Error ? err.message : "Failed", variant: "destructive" }); }
                    finally { setSavingBundle(false); }
                  }}>
                    {savingBundle ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Create Bundle"}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 text-xs text-gray-400" onClick={() => setShowBundleForm(false)}>Cancel</Button>
                </div>
              </div>
            )}
            {bundlesLoading ? <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-orange-400" /></div>
            : bundles.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center">
                <Layers className="w-8 h-8 text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-400 mb-1">No bundles yet</p>
                <p className="text-xs text-gray-500">Group your products and sell them at a special price.</p>
              </div>
            ) : (
              <div className="rounded-2xl bg-card border border-white/8 divide-y divide-white/5">
                {bundles.map((b) => (
                  <div key={b.id} className="flex items-center justify-between px-5 py-4 gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Layers className="w-4 h-4 text-orange-400 shrink-0" />
                      <div className="min-w-0"><p className="text-sm font-semibold text-white truncate">{b.title}</p><p className="text-xs text-gray-500">{b.productIds.length} products · {formatPrice(b.bundlePrice)}</p></div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button size="sm" variant="outline" className="h-7 text-xs border-white/10 text-gray-300 hover:text-white gap-1" onClick={() => window.open(`/bundle/${b.id}`, "_blank")}><Eye className="w-3 h-3" />View</Button>
                      <button className="text-gray-500 hover:text-red-400 transition-colors" onClick={async () => { try { await fetch(`/api/bundles/${b.id}`, { method: "DELETE" }); toast({ title: "Bundle removed" }); fetchBundles(); } catch { toast({ title: "Failed", variant: "destructive" }); } }}><X className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* PROMO CODES TAB                                                       */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "promo" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div><h2 className="text-base font-semibold text-white">Promo Codes</h2><p className="text-xs text-gray-500 mt-0.5">Create discount codes to share with your audience.</p></div>
              <Button size="sm" variant="outline" className="h-8 text-xs border-white/10 text-gray-300 hover:text-white gap-1.5" onClick={() => setShowPromoForm(!showPromoForm)}><Plus className="w-3 h-3" />New code</Button>
            </div>
            {showPromoForm && (
              <div className="rounded-2xl bg-card border border-white/8 p-5 space-y-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Create promo code</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><p className="text-xs text-gray-500">Code</p><Input value={promoCode} onChange={(e) => setPromoCode(e.target.value.toUpperCase())} placeholder="SUMMER20" className="h-8 text-sm bg-white/5 border-white/10 text-white uppercase" /></div>
                  <div className="space-y-1"><p className="text-xs text-gray-500">Discount %</p><Input type="number" min="1" max="100" value={promoDiscount} onChange={(e) => setPromoDiscount(e.target.value)} placeholder="20" className="h-8 text-sm bg-white/5 border-white/10 text-white" /></div>
                  <div className="space-y-1"><p className="text-xs text-gray-500">Max uses (blank = unlimited)</p><Input type="number" min="1" value={promoMaxUses} onChange={(e) => setPromoMaxUses(e.target.value)} placeholder="∞" className="h-8 text-sm bg-white/5 border-white/10 text-white" /></div>
                  <div className="space-y-1"><p className="text-xs text-gray-500">Expires (optional)</p><Input type="date" value={promoExpiry} onChange={(e) => setPromoExpiry(e.target.value)} className="h-8 text-sm bg-white/5 border-white/10 text-white" /></div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white h-8 text-xs" disabled={savingPromo} onClick={async () => {
                    if (!promoCode.trim() || !promoDiscount) { toast({ title: "Code and discount are required", variant: "destructive" }); return; }
                    setSavingPromo(true);
                    try {
                      const res = await fetch("/api/creator/promo-codes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: promoCode, discountPercent: parseInt(promoDiscount), maxUses: promoMaxUses || null, expiresAt: promoExpiry || null }) });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error || "Failed");
                      toast({ title: "Code created!" });
                      setPromoCode(""); setPromoDiscount(""); setPromoMaxUses(""); setPromoExpiry(""); setShowPromoForm(false);
                      fetchPromoCodes();
                    } catch (err) { toast({ title: err instanceof Error ? err.message : "Failed", variant: "destructive" }); }
                    finally { setSavingPromo(false); }
                  }}>
                    {savingPromo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Create"}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 text-xs text-gray-400" onClick={() => setShowPromoForm(false)}>Cancel</Button>
                </div>
              </div>
            )}
            {promoLoading ? <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-orange-400" /></div>
            : promoCodes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center">
                <Tag className="w-8 h-8 text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-400 mb-1">No promo codes yet</p>
                <p className="text-xs text-gray-500">Create a code to offer discounts to your audience.</p>
              </div>
            ) : (
              <div className="rounded-2xl bg-card border border-white/8 divide-y divide-white/5">
                {promoCodes.map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-5 py-3.5 gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-wrap">
                      <code className="text-sm font-bold text-orange-400">{c.code}</code>
                      <span className="text-xs text-gray-400">{c.discountPercent ? `${c.discountPercent}% off` : c.discountAmount ? `\xa3${(c.discountAmount / 100).toFixed(2)} off` : ""}</span>
                      {c.maxUses && <span className="text-xs text-gray-500">{c.usedCount}/{c.maxUses} uses</span>}
                      {c.expiresAt && <span className="text-xs text-gray-500">expires {new Date(c.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>}
                    </div>
                    <button className="text-gray-500 hover:text-red-400 transition-colors shrink-0" onClick={async () => { try { await fetch("/api/creator/promo-codes", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: c.id }) }); toast({ title: "Code deleted" }); fetchPromoCodes(); } catch { toast({ title: "Failed", variant: "destructive" }); } }}><X className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* AFFILIATES TAB                                                        */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "affiliates" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div><h2 className="text-base font-semibold text-white">Affiliate Links</h2><p className="text-xs text-gray-500 mt-0.5">Give partners a unique link. Track their sales here.</p></div>
              <Button size="sm" variant="outline" className="h-8 text-xs border-white/10 text-gray-300 hover:text-white gap-1.5" onClick={() => setShowAffiliateForm(!showAffiliateForm)}><Plus className="w-3 h-3" />Add affiliate</Button>
            </div>
            {showAffiliateForm && (
              <div className="rounded-2xl bg-card border border-white/8 p-5 space-y-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Create affiliate link</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><p className="text-xs text-gray-500">Name</p><Input value={affiliateName} onChange={(e) => setAffiliateName(e.target.value)} placeholder="Jane Smith" className="h-8 text-sm bg-white/5 border-white/10 text-white" /></div>
                  <div className="space-y-1"><p className="text-xs text-gray-500">Email (optional)</p><Input value={affiliateEmail} onChange={(e) => setAffiliateEmail(e.target.value)} placeholder="jane@example.com" className="h-8 text-sm bg-white/5 border-white/10 text-white" /></div>
                  <div className="space-y-1 col-span-2"><p className="text-xs text-gray-500">Commission %</p><Input type="number" min="1" max="100" value={affiliateCommission} onChange={(e) => setAffiliateCommission(e.target.value)} placeholder="20" className="h-8 text-sm bg-white/5 border-white/10 text-white" /></div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white h-8 text-xs" disabled={savingAffiliate} onClick={async () => {
                    if (!affiliateName.trim()) { toast({ title: "Name is required", variant: "destructive" }); return; }
                    setSavingAffiliate(true);
                    try {
                      const res = await fetch("/api/affiliates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ affiliateName, affiliateEmail, commissionPercent: affiliateCommission }) });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error || "Failed");
                      toast({ title: "Affiliate link created!" });
                      setAffiliateName(""); setAffiliateEmail(""); setAffiliateCommission("20"); setShowAffiliateForm(false);
                      fetchAffiliates();
                    } catch (err) { toast({ title: err instanceof Error ? err.message : "Failed", variant: "destructive" }); }
                    finally { setSavingAffiliate(false); }
                  }}>
                    {savingAffiliate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Create"}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 text-xs text-gray-400" onClick={() => setShowAffiliateForm(false)}>Cancel</Button>
                </div>
              </div>
            )}
            {affiliatesLoading ? <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-orange-400" /></div>
            : affiliates.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center">
                <Users className="w-8 h-8 text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-400 mb-1">No affiliates yet</p>
                <p className="text-xs text-gray-500">Create a link to share with partners who promote your products.</p>
              </div>
            ) : (
              <div className="rounded-2xl bg-card border border-white/8 divide-y divide-white/5">
                {affiliates.map((a) => (
                  <div key={a.id} className="px-5 py-4">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="min-w-0"><p className="text-sm font-semibold text-white truncate">{a.affiliateName}</p>{a.affiliateEmail && <p className="text-xs text-gray-500">{a.affiliateEmail}</p>}</div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-gray-400">{a.salesCount} sales · {a.commissionPercent}% commission</span>
                        <button className="text-gray-500 hover:text-red-400 transition-colors" onClick={async () => { try { await fetch("/api/affiliates", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: a.id }) }); toast({ title: "Affiliate removed" }); fetchAffiliates(); } catch { toast({ title: "Failed", variant: "destructive" }); } }}><X className="w-4 h-4" /></button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2">
                      <p className="text-xs text-gray-400 font-mono flex-1 truncate">{a.referralUrl}</p>
                      <button className="text-gray-500 hover:text-orange-400 transition-colors shrink-0" onClick={() => { navigator.clipboard.writeText(a.referralUrl); toast({ title: "Link copied!" }); }}><Copy className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* CUSTOMERS TAB                                                         */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "customers" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-base font-semibold text-white">Customers</h2>
                <p className="text-xs text-gray-500 mt-0.5">Everyone who has bought from your store, ranked by total spend.</p>
              </div>
              <Link href="/dashboard/email-marketing?blast=buyers">
                <Button size="sm" className="h-8 text-xs bg-orange-500 hover:bg-orange-600 text-white gap-1.5"><Send className="w-3 h-3" />Email All Buyers</Button>
              </Link>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} placeholder="Search by name or email..." className="pl-9 h-9 bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-orange-500/50" />
            </div>

            {analyticsLoading ? (
              <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-orange-400" /></div>
            ) : customers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center">
                <UserCircle className="w-8 h-8 text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-400 mb-1">No customers yet</p>
                <p className="text-xs text-gray-500">When someone buys from your store, they&apos;ll appear here.</p>
              </div>
            ) : (
              <>
                {/* Summary row */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-card border border-white/8 p-3 text-center">
                    <p className="text-lg font-bold text-white">{customers.length}</p>
                    <p className="text-[11px] text-gray-500">Total customers</p>
                  </div>
                  <div className="rounded-xl bg-card border border-white/8 p-3 text-center">
                    <p className="text-lg font-bold text-orange-400">{formatPrice(customers.reduce((s, c) => s + c.totalCents, 0))}</p>
                    <p className="text-[11px] text-gray-500">Total revenue</p>
                  </div>
                  <div className="rounded-xl bg-card border border-white/8 p-3 text-center">
                    <p className="text-lg font-bold text-white">{customers.length > 0 ? formatPrice(Math.round(customers.reduce((s, c) => s + c.totalCents, 0) / customers.length)) : "\xa30.00"}</p>
                    <p className="text-[11px] text-gray-500">Avg. LTV</p>
                  </div>
                </div>

                <div className="rounded-2xl bg-card border border-white/8 overflow-hidden">
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-2.5 border-b border-white/5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    <span>Customer</span>
                    <span className="text-right">Orders</span>
                    <span className="text-right">Total Spent</span>
                    <span className="text-right">Actions</span>
                  </div>
                  <div className="divide-y divide-white/5">
                    {filteredCustomers.map((c, i) => (
                      <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-3.5 items-center hover:bg-white/3 transition-colors">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{c.name ?? maskEmail(c.email)}</p>
                          <p className="text-xs text-gray-500 truncate">{maskEmail(c.email)}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {c.products.slice(0, 2).map((p) => (
                              <span key={p} className="text-[10px] bg-white/5 text-gray-400 rounded-full px-2 py-0.5 truncate max-w-[140px]">{p}</span>
                            ))}
                            {c.products.length > 2 && <span className="text-[10px] text-gray-500">+{c.products.length - 2} more</span>}
                          </div>
                        </div>
                        <span className="text-sm text-gray-300 text-right">{c.orders}</span>
                        <span className="text-sm font-semibold text-orange-400 text-right">{formatPrice(c.totalCents)}</span>
                        <div className="flex items-center justify-end">
                          <Link href={`/dashboard/email-marketing?to=${encodeURIComponent(c.email)}`}>
                            <button className="text-gray-500 hover:text-orange-400 transition-colors" title="Email this customer"><Mail className="w-4 h-4" /></button>
                          </Link>
                        </div>
                      </div>
                    ))}
                    {filteredCustomers.length === 0 && (
                      <div className="px-5 py-6 text-center"><p className="text-sm text-gray-500">No customers matching &quot;{customerSearch}&quot;</p></div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* EMAIL TAB                                                             */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "email" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-white">Email Marketing</h2>
              <p className="text-xs text-gray-500 mt-0.5">Reach your buyers and subscribers directly from your store.</p>
            </div>

            {/* Subscriber count card */}
            <div className="rounded-2xl bg-gradient-to-br from-orange-500/10 via-orange-500/5 to-transparent border border-orange-500/20 p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center shrink-0">
                <Mail className="w-6 h-6 text-orange-400" />
              </div>
              <div className="flex-1">
                <p className="text-2xl font-bold text-white">{analyticsLoading ? "..." : analytics?.subscriberCount ?? 0}</p>
                <p className="text-xs text-gray-400">email subscribers</p>
              </div>
              <Link href="/dashboard/email-marketing">
                <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white gap-2 shrink-0">
                  <Mail className="w-4 h-4" />Manage List
                </Button>
              </Link>
            </div>

            {/* Quick actions */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Quick Actions</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Link href="/dashboard/email-marketing?blast=buyers" className="group">
                  <div className="rounded-2xl bg-card border border-white/8 p-5 flex items-center gap-4 hover:border-orange-500/30 transition-colors cursor-pointer">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 group-hover:bg-blue-500/20 transition-colors">
                      <ShoppingBag className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">Email All Buyers</p>
                      <p className="text-xs text-gray-500">Send to everyone who has purchased from your store</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-orange-400 transition-colors shrink-0" />
                  </div>
                </Link>

                <Link href="/dashboard/email-marketing" className="group">
                  <div className="rounded-2xl bg-card border border-white/8 p-5 flex items-center gap-4 hover:border-orange-500/30 transition-colors cursor-pointer">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0 group-hover:bg-purple-500/20 transition-colors">
                      <Users className="w-5 h-5 text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">Email Subscribers</p>
                      <p className="text-xs text-gray-500">Broadcast to your full email list</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-orange-400 transition-colors shrink-0" />
                  </div>
                </Link>

                <Link href="/dashboard/email-marketing?new=sequence" className="group">
                  <div className="rounded-2xl bg-card border border-white/8 p-5 flex items-center gap-4 hover:border-orange-500/30 transition-colors cursor-pointer">
                    <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0 group-hover:bg-green-500/20 transition-colors">
                      <Zap className="w-5 h-5 text-green-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">Welcome Sequence</p>
                      <p className="text-xs text-gray-500">Auto-send emails when someone joins your list</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-orange-400 transition-colors shrink-0" />
                  </div>
                </Link>

                <Link href="/dashboard/email-marketing?new=campaign" className="group">
                  <div className="rounded-2xl bg-card border border-white/8 p-5 flex items-center gap-4 hover:border-orange-500/30 transition-colors cursor-pointer">
                    <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0 group-hover:bg-orange-500/20 transition-colors">
                      <Send className="w-5 h-5 text-orange-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">New Campaign</p>
                      <p className="text-xs text-gray-500">Write and send a one-off email blast</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-orange-400 transition-colors shrink-0" />
                  </div>
                </Link>
              </div>
            </div>

            {/* Tips */}
            <div className="rounded-2xl bg-white/3 border border-white/8 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Star className="w-4 h-4 text-orange-400" />
                <p className="text-sm font-semibold text-white">Growth tips</p>
              </div>
              <div className="space-y-2.5">
                {[
                  { tip: "Add an email subscribe button to your store via Customise Store", action: "/dashboard/store/customize" },
                  { tip: "Send a launch email to buyers whenever you release a new product", action: "/dashboard/email-marketing?blast=buyers" },
                  { tip: "Set up a welcome sequence to nurture new subscribers automatically", action: "/dashboard/email-marketing?new=sequence" },
                ].map((item, i) => (
                  <Link key={i} href={item.action} className="flex items-start gap-2.5 group">
                    <span className="text-orange-400 text-xs mt-0.5 shrink-0">{i + 1}.</span>
                    <p className="text-xs text-gray-400 group-hover:text-gray-200 transition-colors">{item.tip}</p>
                    <ArrowRight className="w-3 h-3 text-gray-600 group-hover:text-orange-400 transition-colors shrink-0 mt-0.5 ml-auto" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* ANALYTICS TAB                                                         */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "analytics" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div><h2 className="text-base font-semibold text-white">Store Analytics</h2><p className="text-xs text-gray-500 mt-0.5">Revenue and performance for your store.</p></div>
              <Link href="/dashboard/admin/revenue"><Button variant="outline" size="sm" className="h-8 text-xs border-white/10 text-gray-300 hover:text-white gap-1.5"><BarChart2 className="w-3.5 h-3.5" />Full Analytics</Button></Link>
            </div>

            {analyticsLoading ? (
              <div className="flex items-center justify-center py-14"><Loader2 className="w-6 h-6 animate-spin text-orange-400" /></div>
            ) : (
              <>
                {/* Stats grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "All Time Revenue", value: formatPrice(analytics?.totalRevenueCents ?? 0), color: "text-orange-400" },
                    { label: "Total Orders", value: String(analytics?.totalOrders ?? 0), color: "text-white" },
                    { label: "Last 30 Days", value: formatPrice(analytics?.last30DaysRevenueCents ?? 0), color: "text-green-400" },
                    { label: "30-Day Orders", value: String(analytics?.last30DaysOrders ?? 0), color: "text-white" },
                  ].map((s) => (
                    <div key={s.label} className="rounded-2xl bg-card border border-white/8 p-4">
                      <p className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold mb-1.5">{s.label}</p>
                      <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* Revenue chart */}
                {analytics?.dailyRevenue && analytics.dailyRevenue.length > 0 && (
                  <div className="rounded-2xl bg-card border border-white/8 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm font-semibold text-white">Revenue — Last 14 Days</p>
                      <p className="text-xs text-gray-500">{formatPrice(analytics.last30DaysRevenueCents)} total</p>
                    </div>
                    <RevenueChart data={analytics.dailyRevenue} />
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-[10px] text-gray-600">{analytics.dailyRevenue.slice(-14)[0]?.date}</p>
                      <p className="text-[10px] text-gray-600">{analytics.dailyRevenue[analytics.dailyRevenue.length - 1]?.date}</p>
                    </div>
                  </div>
                )}

                {/* Top products */}
                {analytics?.topProducts && analytics.topProducts.length > 0 && (
                  <div className="rounded-2xl bg-card border border-white/8 p-5">
                    <p className="text-sm font-semibold text-white mb-4">Top Products</p>
                    <div className="space-y-3">
                      {analytics.topProducts.slice(0, 5).map((p, i) => {
                        const maxRev = analytics.topProducts[0].revenueCents;
                        const pct = maxRev > 0 ? (p.revenueCents / maxRev) * 100 : 0;
                        return (
                          <div key={p.productId}>
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-sm text-gray-200 truncate flex-1 mr-3">
                                <span className="text-gray-600 mr-2">#{i + 1}</span>{p.title}
                              </p>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="text-xs text-gray-500">{p.orders} sale{p.orders !== 1 ? "s" : ""}</span>
                                <span className="text-sm font-semibold text-orange-400">{formatPrice(p.revenueCents)}</span>
                              </div>
                            </div>
                            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                              <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Recent orders */}
                {analytics?.recentOrders && analytics.recentOrders.length > 0 && (
                  <div className="rounded-2xl bg-card border border-white/8 overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-white/5">
                      <p className="text-sm font-semibold text-white">Recent Orders</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-gray-500 text-[11px] uppercase tracking-wide border-b border-white/5">
                            <th className="text-left px-5 py-2.5 font-medium">Date</th>
                            <th className="text-left px-5 py-2.5 font-medium">Buyer</th>
                            <th className="text-left px-5 py-2.5 font-medium hidden md:table-cell">Product</th>
                            <th className="text-right px-5 py-2.5 font-medium">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {analytics.recentOrders.slice(0, 10).map((o) => (
                            <tr key={o.id} className="hover:bg-white/3 transition-colors">
                              <td className="px-5 py-3 text-gray-500 text-xs">{fmtDate(o.createdAt)}</td>
                              <td className="px-5 py-3 text-gray-300">{maskEmail(o.buyerEmail)}</td>
                              <td className="px-5 py-3 text-gray-400 hidden md:table-cell truncate max-w-[160px]">{o.productTitle}</td>
                              <td className="px-5 py-3 text-right text-orange-400 font-medium">{formatPrice(o.amountCents)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {(!analytics?.totalOrders || analytics.totalOrders === 0) && (
                  <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center">
                    <TrendingUp className="w-8 h-8 text-gray-600 mx-auto mb-3" />
                    <p className="text-sm text-gray-400 mb-1">No sales data yet</p>
                    <p className="text-xs text-gray-500">Your analytics will appear here once you make your first sale.</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* PAYOUTS TAB                                                           */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "payouts" && (
          <div className="space-y-4">
            <div><h2 className="text-base font-semibold text-white">Payouts</h2><p className="text-xs text-gray-500 mt-0.5">Connect Stripe to receive payments directly.</p></div>
            <div className="rounded-2xl bg-card border border-white/8 p-10 text-center">
              <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mx-auto mb-4"><CreditCard className="w-6 h-6 text-orange-400" /></div>
              <p className="text-sm font-semibold text-white mb-2">Manage your payouts</p>
              <p className="text-xs text-gray-500 mb-5 max-w-xs mx-auto">Connect Stripe, view your balance, and see your full transaction history.</p>
              <Link href="/dashboard/store/payouts"><Button className="bg-orange-500 hover:bg-orange-600 text-white gap-2"><CreditCard className="w-4 h-4" />Go to Payouts<ArrowRight className="w-4 h-4" /></Button></Link>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* SETTINGS TAB                                                          */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "settings" && (
          <div className="space-y-6">
            <div><h2 className="text-base font-semibold text-white">Store Settings</h2><p className="text-xs text-gray-500 mt-0.5">Customise your store design and configure email branding.</p></div>

            <div className="rounded-2xl bg-card border border-white/8 p-6 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0"><Paintbrush className="w-5 h-5 text-orange-400" /></div>
                <div><p className="text-sm font-semibold text-white">Store Design</p><p className="text-xs text-gray-500">Change banner, profile image, theme and layout.</p></div>
              </div>
              <Link href="/dashboard/store/customize"><Button variant="outline" size="sm" className="border-orange-500/30 text-orange-400 hover:text-orange-300 hover:border-orange-500/50 hover:bg-orange-500/5 gap-2 h-9"><Paintbrush className="w-4 h-4" />Customise Store<ArrowRight className="w-3.5 h-3.5" /></Button></Link>
            </div>

            <div className="bg-white/3 border border-white/8 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-1"><Mail className="w-4 h-4 text-orange-400" /><h3 className="text-sm font-semibold text-white">Email Branding</h3></div>
              <p className="text-xs text-gray-500 mb-5">Purchase confirmation emails are sent automatically when a buyer checks out.</p>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/10">
                  <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-400 text-[10px] font-bold shrink-0">CF</div>
                  <div><p className="text-xs font-semibold text-white leading-none mb-0.5">Your Brand Name</p><p className="text-[11px] text-gray-500 leading-none">via Content Flywheel · no-reply@contentflywheel.co.uk</p></div>
                </div>
                <p className="text-xs font-semibold text-white mb-1">Your purchase is confirmed 🎉</p>
                <p className="text-xs text-gray-400 leading-relaxed">Hi [Buyer name], thank you for your purchase of <span className="text-orange-400">[Product name]</span>. Here&apos;s your download link — it&apos;s valid for 7 days...</p>
                <div className="mt-3 pt-3 border-t border-white/10"><p className="text-[11px] text-gray-600 italic">Your brand name from Brand Voice is used as the sender display name.</p></div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-orange-500/8 border border-orange-500/20 rounded-xl">
                <span className="text-orange-400 text-sm shrink-0 mt-0.5">✏️</span>
                <div>
                  <p className="text-xs font-semibold text-orange-300 mb-0.5">Update your sender name</p>
                  <p className="text-xs text-gray-400">Update it in <Link href="/dashboard/brand-voice" className="text-orange-400 hover:text-orange-300 underline underline-offset-2">Brand Voice settings</Link>.</p>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
