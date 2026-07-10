"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
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
  UserPlus,
  Heart,
  UserCheck,
  Rocket,
  Shield,
  Trophy,
  Award,
  Gift,
  Sparkles,
  Check,
} from "lucide-react";
import Link from "next/link";
import { TRUST_FACTOR_META, getTrustLevel, TRUST_LEVELS } from "@/lib/trust-score-config";
import { REWARDS_CONFIG, CREATOR_LEVELS, getCreatorLevel } from "@/lib/rewards-config";

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

// ── Creator Growth Types ──────────────────────────────────────────────────────
type ReferralStatus = "pending_signup" | "trial_active" | "product_published" | "pro_converted" | "credit_awarded" | "expired" | "rejected";
type GrowthReferral = { id: string; referredEmail: string | null; status: ReferralStatus; createdAt: string; convertedAt: string | null; creditAwardedAt: string | null };
type CreditEvent = { id: string; type: string; amountCredits: number; description: string; createdAt: string };
type FeaturedSlot = { productId: string; niche: string; featuredUntil: string | null; active: boolean };
type GrowthSummary = {
  availableCredits: number; pendingReferrals: number;
  creditHistory: CreditEvent[]; referrals: GrowthReferral[];
  activeFeatured: FeaturedSlot[]; creatorLevel: string;
  salesCount: number; leaderboardOptIn: boolean; creatorScore: number | null;
};
type LeaderboardEntry = {
  rank: number; userId: string; displayName: string;
  profileImage: string | null; accentColor: string;
  levelLabel: string; levelEmoji: string;
  salesCount: number; revenueGbp: number;
  avgRating: number; followerCount: number; score: number;
};
type GrowthLbTab = "top-sellers" | "highest-revenue" | "fastest-growing" | "highest-rated" | "most-followed";

const REFERRAL_STATUS_META: Record<ReferralStatus, { label: string; color: string }> = {
  pending_signup:    { label: "Pending signup",    color: "text-gray-400"   },
  trial_active:      { label: "Trial active",      color: "text-blue-400"   },
  product_published: { label: "Product published", color: "text-purple-400" },
  pro_converted:     { label: "Pro converted",     color: "text-orange-400" },
  credit_awarded:    { label: "Credit awarded ✓",  color: "text-green-400"  },
  expired:           { label: "Expired",           color: "text-gray-500"   },
  rejected:          { label: "Rejected",          color: "text-red-400"    },
};

// ── Trust Score Types ─────────────────────────────────────────────────────────
type TrustLevel = "building" | "developing" | "trusted" | "excellent" | "elite";
type TrustBreakdown = Record<string, number>;
type TrustScoreData = {
  score: number; level: TrustLevel; breakdown: TrustBreakdown;
  recommendations: string[]; publicOptIn: boolean;
  adminSuppressed: boolean; adminOverrideScore: number | null;
  lastCalculatedAt: string;
};
type TrustHistoryEntry = { score: number; level: string; trigger: string; calculatedAt: string };
type ReputationEvent = { id: string; eventType: string; description: string; scoreDelta: number | null; createdAt: string };
type ProductPerformance = {
  productId: string; title: string; views: number; orders: number;
  revenueCents: number; wishlistSaves: number; avgRating: number | null;
};
interface AnalyticsData {
  totalRevenueCents: number; totalOrders: number;
  last30DaysRevenueCents: number; last30DaysOrders: number;
  dailyRevenue: DayRevenue[]; topProducts: TopProduct[];
  recentOrders: RecentOrder[]; subscriberCount: number;
  // Phase E additions
  totalViews: number; followerCount: number;
  totalWishlistSaves: number; overallAvgRating: number | null;
  conversionFunnel: ProductPerformance[];
}
interface Customer {
  email: string; name: string | null; totalCents: number;
  orders: number; lastOrderAt: string; products: string[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STORE_BASE = "https://contentflywheel.co.uk/c";

type Tab = "products" | "bundles" | "orders" | "promo" | "affiliates" | "customers" | "email" | "analytics" | "payouts" | "settings" | "trust-score" | "growth";

const TABS: { id: string; label: string; icon: React.ReactNode; href?: string }[] = [
  { id: "growth",       label: "Creator Growth", icon: <Sparkles className="w-3.5 h-3.5" /> },
  { id: "products",     label: "Products",       icon: <ShoppingBag className="w-3.5 h-3.5" /> },
  { id: "bundles",      label: "Bundles",        icon: <Layers className="w-3.5 h-3.5" /> },
  { id: "orders",       label: "Orders",         icon: <Package className="w-3.5 h-3.5" />,  href: "/dashboard/orders" },
  { id: "customers",    label: "Customers",      icon: <UserCircle className="w-3.5 h-3.5" /> },
  { id: "email",        label: "Email",          icon: <Mail className="w-3.5 h-3.5" /> },
  { id: "analytics",    label: "Analytics",      icon: <TrendingUp className="w-3.5 h-3.5" /> },
  { id: "promo",        label: "Promo Codes",    icon: <Tag className="w-3.5 h-3.5" /> },
  { id: "affiliates",   label: "Affiliates",     icon: <Users className="w-3.5 h-3.5" /> },
  { id: "trust-score",  label: "Trust Score",    icon: <Shield className="w-3.5 h-3.5" /> },
  { id: "payouts",      label: "Payouts",        icon: <CreditCard className="w-3.5 h-3.5" /> },
  { id: "reviews",      label: "Reviews",        icon: <Star className="w-3.5 h-3.5" />,     href: "/dashboard/reviews" },
  { id: "webhooks",     label: "Webhooks",       icon: <Zap className="w-3.5 h-3.5" />,      href: "/dashboard/webhooks" },
  { id: "referral",     label: "Invite Creators",icon: <UserPlus className="w-3.5 h-3.5" />,  href: "/dashboard/referral" },
  { id: "settings",     label: "Settings",       icon: <Settings className="w-3.5 h-3.5" /> },
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
  return (
    <Badge variant="outline" className="text-[10px] border-gray-300 text-gray-600 shrink-0 bg-gray-100">
      {label}
    </Badge>
  );
}

// ── Trust Score Helpers ───────────────────────────────────────────────────────

function TrustShieldIcon({ color = "#f97316", size = 20 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2L3 6V12C3 17.55 6.84 22.74 12 24C17.16 22.74 21 17.55 21 12V6L12 2Z"
        fill={color} fillOpacity="0.15" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 12L11 14L15 10" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrustScoreDonut({ score, color }: { score: number; color: string }) {
  const r = 42, circ = 2 * Math.PI * r, dash = (score / 100) * circ;
  return (
    <svg width="108" height="108" viewBox="0 0 108 108">
      <circle cx="54" cy="54" r={r} fill="none" stroke="#f3f4f6" strokeWidth="10" />
      <circle cx="54" cy="54" r={r} fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={circ * 0.25}
        strokeLinecap="round" style={{ transition: "stroke-dasharray 1s cubic-bezier(.4,0,.2,1)" }} />
      <text x="54" y="50" textAnchor="middle" fontSize="22" fontWeight="900" fill="#111827">{score}</text>
      <text x="54" y="64" textAnchor="middle" fontSize="11" fontWeight="600" fill="#9ca3af">/100</text>
    </svg>
  );
}

function TrustProgressBar({ value, color, height = 7 }: { value: number; color: string; height?: number }) {
  return (
    <div style={{ width: "100%", height: `${height}px`, borderRadius: "999px", background: "#f3f4f6", overflow: "hidden" }}>
      <div style={{ width: `${Math.max(2, value)}%`, height: "100%", borderRadius: "999px", background: color, transition: "width 0.8s cubic-bezier(.4,0,.2,1)" }} />
    </div>
  );
}

function TrustSparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 10), min = Math.min(...data);
  const w = 180, h = 40;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / (max - min + 1)) * (h - 6) - 3;
    return `${x},${y}`;
  });
  return (
    <svg width={w} height={h} style={{ overflow: "visible" }}>
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1].split(",")[0]} cy={pts[pts.length - 1].split(",")[1]} r={3} fill={color} />
    </svg>
  );
}

function trustFactorColor(v: number) { return v >= 70 ? "#10b981" : v >= 40 ? "#f59e0b" : "#ef4444"; }

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 ${accent ? "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800/40" : "bg-white dark:bg-[#1A1A1A] border-gray-200 dark:border-[#2A2A2A]"}`}>
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-2xl font-bold ${accent ? "text-orange-600 dark:text-orange-400" : "text-gray-900 dark:text-white"}`}>{value}</p>
    </div>
  );
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
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 text-sm font-medium select-none">\xa3</span>
        <Input type="number" min="1" step="0.01" value={priceInput} onChange={(e) => setPriceInput(e.target.value)}
          className="pl-7 w-28 h-8 text-sm bg-gray-100 border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-orange-500/60"
          placeholder="9.99" autoFocus
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); if (e.key === "Escape") onCancel(); }}
        />
      </div>
      <Button size="sm" onClick={handleSubmit} disabled={loading} className="h-8 bg-orange-500 hover:bg-orange-600 text-gray-900 text-xs shrink-0">
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isEdit ? "Update" : "Publish"}
      </Button>
      <Button size="sm" variant="ghost" onClick={onCancel} disabled={loading} className="h-8 text-xs text-gray-600 hover:text-gray-900 shrink-0">Cancel</Button>
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
    <div className="bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#2A2A2A] rounded-2xl p-5 flex flex-col gap-3 hover:border-orange-300 dark:hover:border-orange-700/50 hover:bg-gray-50 dark:hover:bg-[#1E1E1E] transition-all">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800/40 flex items-center justify-center shrink-0">
          <Package className="w-5 h-5 text-orange-600 dark:text-orange-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight truncate">{item.title}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <Badge className="text-[10px] bg-green-50 text-green-700 border border-green-200 hover:bg-green-50 font-medium">Live</Badge>
            <FormatBadge format={item.format} />
          </div>
        </div>
        {item.nativePrice != null && !editingPrice && (
          <span className="text-xl font-bold text-orange-600 shrink-0">{formatPrice(item.nativePrice)}</span>
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
          <Button size="sm" variant="outline" className="h-8 text-xs border-gray-300 text-gray-800 hover:text-gray-900 hover:border-gray-400 hover:bg-gray-100 gap-1.5" onClick={() => window.open(`/product/${item.id}`, "_blank")}>
            <Eye className="w-3.5 h-3.5" />View Page
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs border-gray-300 text-gray-800 hover:text-gray-900 hover:border-orange-400 hover:bg-orange-50 gap-1.5" onClick={() => setEditingPrice(true)}>
            <PencilLine className="w-3.5 h-3.5" />Edit Price
          </Button>
          <Link href={`/dashboard/email-marketing?blast=buyers&product=${item.id}`}>
            <Button size="sm" variant="outline" className="h-8 text-xs border-blue-200 text-blue-700 hover:text-blue-700 hover:border-blue-400 hover:bg-blue-50 gap-1.5">
              <Mail className="w-3.5 h-3.5" />Email Buyers
            </Button>
          </Link>
          <Button size="sm" variant="outline" className="h-8 text-xs border-red-200 text-red-600 hover:text-red-700 hover:border-red-400 hover:bg-red-50 ml-auto gap-1.5" onClick={handleUnpublish} disabled={unpublishing}>
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
    <div className="flex flex-col gap-1 py-3.5 border-b border-white/8 last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
          <BookOpen className="w-3.5 h-3.5 text-gray-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-900 truncate">{item.title}</p>
        </div>
        <FormatBadge format={item.format} />
        {!showForm && (
          <Button size="sm" variant="outline" className="h-7 text-xs border-orange-300 text-orange-600 hover:text-orange-200 hover:border-orange-400/50 hover:bg-orange-50 shrink-0 gap-1.5" onClick={() => setShowForm(true)}>
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

// ── LibraryPickerRow ──────────────────────────────────────────────────────────

function LibraryPickerRow({ item, publishing, onPublish }: {
  item: LibraryItem;
  publishing: boolean;
  onPublish: (price: number) => Promise<void>;
}) {
  const [showPrice, setShowPrice] = useState(false);
  const [priceInput, setPriceInput] = useState("");
  const { toast } = useToast();

  const handlePublish = async () => {
    const num = parseFloat(priceInput);
    if (isNaN(num) || num < 1) {
      toast({ title: "Enter a price of at least £1", variant: "destructive" });
      return;
    }
    await onPublish(Math.round(num * 100));
    setShowPrice(false);
    setPriceInput("");
  };

  return (
    <div className="bg-white dark:bg-[#1A1A1A] rounded-xl border border-gray-200 dark:border-[#2A2A2A] p-3.5">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800/40 flex items-center justify-center shrink-0">
          <BookOpen className="w-4 h-4 text-orange-600 dark:text-orange-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.title}</p>
          {item.format && <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{item.format}</p>}
        </div>
        {!showPrice && (
          <Button size="sm" variant="outline" className="h-7 text-xs border-orange-300 text-orange-600 hover:bg-orange-50 shrink-0 gap-1" onClick={() => setShowPrice(true)}>
            <ShoppingBag className="w-3 h-3" />Publish
          </Button>
        )}
      </div>
      {showPrice && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
          <span className="text-sm text-gray-500 shrink-0">Set price:</span>
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">£</span>
            <input type="number" min="1" step="0.01" value={priceInput} onChange={(e) => setPriceInput(e.target.value)}
              className="w-full pl-7 pr-3 h-8 text-sm rounded-lg border border-gray-300 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500/20"
              placeholder="9.99" autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handlePublish(); if (e.key === "Escape") { setShowPrice(false); setPriceInput(""); } }}
            />
          </div>
          <Button size="sm" className="h-8 text-xs bg-orange-500 hover:bg-orange-600 text-white shrink-0" disabled={publishing} onClick={handlePublish}>
            {publishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Go live"}
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs text-gray-500" onClick={() => { setShowPrice(false); setPriceInput(""); }}>
            <X className="w-3.5 h-3.5" />
          </Button>
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
    <div className="flex items-end gap-1.5 h-24 w-full">
      {last14.map((d) => {
        const pct = (d.cents / maxCents) * 100;
        const hasRevenue = d.cents > 0;
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative">
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 border border-gray-700 text-white text-[10px] rounded-lg px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none shadow-lg">
              {formatPrice(d.cents)}
            </div>
            <div className="w-full flex items-end" style={{ height: "88px" }}>
              <div
                className={`w-full rounded-t-lg transition-all ${hasRevenue ? "bg-orange-500 hover:bg-orange-400" : "bg-gray-100 dark:bg-[#2A2A2A]"}`}
                style={{ height: `${Math.max(pct, hasRevenue ? 5 : 2)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Section Header ────────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
        {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, title, subtitle, action }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string; subtitle: string; action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-[#1A1A1A] p-12 text-center">
      <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 flex items-center justify-center mx-auto mb-4">
        <Icon className="w-6 h-6 text-gray-500 dark:text-gray-400" />
      </div>
      <p className="text-sm font-medium text-gray-800 dark:text-white mb-1.5">{title}</p>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto mb-5">{subtitle}</p>
      {action}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function StoreClient({ userId }: StoreClientProps) {
  const fallbackStoreUrl = `${STORE_BASE}/${userId}`;
  const [customDomain, setCustomDomain] = useState<string | null>(null);
  const [customDomainLoaded, setCustomDomainLoaded] = useState(false);
  // Use subdomain URL if set (e.g. digitaldrift.contentflywheel.co.uk), else /c/userId
  const storeUrl = customDomain ? `https://${customDomain}` : fallbackStoreUrl;
  const router = useRouter();
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

  // Library picker
  const [showLibraryPicker, setShowLibraryPicker] = useState(false);
  const [libraryPickerPublishing, setLibraryPickerPublishing] = useState<string | null>(null);

  // Trust Score
  const [trustData, setTrustData] = useState<TrustScoreData | null>(null);
  const [trustHistory, setTrustHistory] = useState<TrustHistoryEntry[]>([]);
  const [trustEvents, setTrustEvents] = useState<ReputationEvent[]>([]);
  const [trustLoading, setTrustLoading] = useState(false);
  const [trustRecalculating, setTrustRecalculating] = useState(false);
  const [trustToggling, setTrustToggling] = useState(false);
  const [trustSubTab, setTrustSubTab] = useState<"breakdown" | "history" | "tips">("breakdown");

  // ── Growth state ────────────────────────────────────────────────────────────
  const [growthSummary, setGrowthSummary] = useState<GrowthSummary | null>(null);
  const [growthProducts, setGrowthProducts] = useState<{ id: string; title: string }[]>([]);
  const [growthLoading, setGrowthLoading] = useState(false);
  const [growthSelectedId, setGrowthSelectedId] = useState("");
  const [growthSaving, setGrowthSaving] = useState(false);
  const [growthMsg, setGrowthMsg] = useState("");
  const [growthModal, setGrowthModal] = useState<"earn" | "history" | "referrals" | null>(null);
  const [growthCopied, setGrowthCopied] = useState(false);
  const [growthLbTab, setGrowthLbTab] = useState<GrowthLbTab>("top-sellers");
  const [growthLbEntries, setGrowthLbEntries] = useState<LeaderboardEntry[]>([]);
  const [growthLbLoading, setGrowthLbLoading] = useState(false);

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
      const res = await fetch("/api/library");
      if (!res.ok) throw new Error("Failed to load library");
      const data: LibraryItem[] = await res.json();
      // Include all sellable types — ebook, template, course, workbook, product, etc.
      setItems(data.filter((d) => ["product", "ebook", "template", "course", "workbook", "guide", "checklist", "script"].includes(d.type) || d.type != null));
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

  const fetchGrowthData = useCallback(async () => {
    setGrowthLoading(true);
    try {
      const [sumRes, prodRes] = await Promise.all([
        fetch("/api/rewards/summary").then((r) => r.json()),
        fetch("/api/products").then((r) => r.json()),
      ]);
      setGrowthSummary(sumRes as GrowthSummary);
      setGrowthProducts((prodRes.products ?? []) as { id: string; title: string }[]);
    } catch {}
    setGrowthLoading(false);
  }, []);

  const fetchTrustScore = useCallback(async () => {
    setTrustLoading(true);
    try {
      const res = await fetch("/api/trust-score/opt-in");
      const data = await res.json();
      setTrustData(data.score ?? null);
      setTrustHistory(data.history ?? []);
      setTrustEvents(data.events ?? []);
    } catch {}
    setTrustLoading(false);
  }, []);

  const handleGrowthFeature = async () => {
    if (!growthSelectedId) return;
    setGrowthSaving(true); setGrowthMsg("");
    try {
      const res = await fetch("/api/marketplace/feature", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: growthSelectedId }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setGrowthMsg(data.error ?? "Error"); return; }
      toast({ title: "✅ Product featured for 7 days!" });
      fetchGrowthData();
    } catch { setGrowthMsg("Something went wrong."); }
    finally { setGrowthSaving(false); }
  };

  const handleGrowthRemove = async () => {
    await fetch("/api/marketplace/feature", { method: "DELETE" });
    toast({ title: "Featured placement removed." });
    fetchGrowthData();
  };

  const handleTrustRecalculate = async () => {
    setTrustRecalculating(true);
    try {
      await fetch("/api/trust-score/recalculate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trigger: "manual" }) });
      await fetchTrustScore();
    } catch {}
    setTrustRecalculating(false);
  };

  const handleTrustToggleOptIn = async () => {
    if (!trustData) return;
    setTrustToggling(true);
    try {
      await fetch("/api/trust-score/opt-in", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ publicOptIn: !trustData.publicOptIn }) });
      await fetchTrustScore();
    } catch {}
    setTrustToggling(false);
  };

  // Leaderboard fetch (for growth tab) — re-fetches when tab changes
  useEffect(() => {
    if (activeTab !== "growth") return;
    setGrowthLbLoading(true);
    fetch(`/api/marketplace/leaderboard?tab=${growthLbTab}&limit=5`)
      .then((r) => r.json())
      .then((d) => setGrowthLbEntries(d.entries ?? []))
      .catch(() => {})
      .finally(() => setGrowthLbLoading(false));
  }, [growthLbTab, activeTab]);

  useEffect(() => {
    fetchPromoCodes(); fetchBundles(); fetchAffiliates(); fetchLibrary(); fetchAnalytics(); fetchTrustScore(); fetchGrowthData();
    // Fetch store settings to resolve custom subdomain URL
    fetch("/api/store-settings")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.customDomain) setCustomDomain(data.customDomain as string);
      })
      .catch(() => {})
      .finally(() => setCustomDomainLoaded(true));
  }, [fetchPromoCodes, fetchBundles, fetchAffiliates, fetchLibrary, fetchAnalytics, fetchTrustScore, fetchGrowthData]);

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
    <div className="min-h-screen bg-gray-50 dark:bg-transparent">
      <div className="p-6 md:p-8 max-w-5xl mx-auto">

        {/* ── Page Header ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap mb-7">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="w-8 h-8 rounded-xl bg-orange-100 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800/40 flex items-center justify-center">
                <Store className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">My Store</h1>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Sell your digital products directly to your audience.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/digital-products/upload">
              <Button size="sm" className="gap-2 bg-orange-500 hover:bg-orange-600 text-gray-900 h-9 font-medium">
                <Upload className="w-4 h-4" />Upload Product
              </Button>
            </Link>
            <Link href="/dashboard/store/customize">
              <Button variant="outline" size="sm" className="gap-2 border-gray-300 text-gray-800 hover:text-gray-900 hover:border-gray-300 hover:bg-gray-100 h-9">
                <Paintbrush className="w-4 h-4" />Customise
              </Button>
            </Link>
          </div>
        </div>

        {/* ── Store URL Card ── */}
        <div className="relative rounded-2xl overflow-hidden border border-orange-200 dark:border-orange-800/40 bg-orange-50 dark:bg-orange-950/20 p-4 mb-6">
          <div className="relative flex items-center gap-3 flex-wrap">
            <div className="shrink-0">
              <p className="text-xs font-bold uppercase tracking-widest text-orange-600 dark:text-orange-400">Your Store</p>
              {customDomain && (
                <p className="text-[10px] text-orange-400 dark:text-orange-500 mt-0.5">Custom URL active</p>
              )}
            </div>
            <div className="flex-1 min-w-0 bg-gray-100 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#2A2A2A] rounded-xl px-4 py-2.5">
              <p className="text-sm text-gray-900 dark:text-white font-mono truncate">{storeUrl}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" variant="outline" className="h-8 border-gray-300 text-gray-800 hover:text-gray-900 hover:border-gray-300 hover:bg-gray-100 gap-2" onClick={handleCopy}>
                {copied ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied!" : "Copy"}
              </Button>
              <Button size="sm" className="h-8 bg-orange-500 hover:bg-orange-600 text-gray-900 gap-2" onClick={() => window.open(storeUrl, "_blank")}>
                <ExternalLink className="w-4 h-4" />Open
              </Button>
            </div>
          </div>
        </div>

        {/* ── Quick Stats ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-7">
          <StatCard label="Live Products" value={published.length} />
          <StatCard label="All Time Revenue" value={analyticsLoading ? "—" : formatPrice(analytics?.totalRevenueCents ?? 0)} accent />
          <StatCard label="Customers" value={analyticsLoading ? "—" : customers.length} />
          <StatCard label="Subscribers" value={analyticsLoading ? "—" : analytics?.subscriberCount ?? 0} />
        </div>

        {/* ── Trust Score Summary Card ── */}
        {trustData && (() => {
          const lm = getTrustLevel(trustData.score);
          return (
            <div
              onClick={() => setActiveTab("trust-score")}
              className="rounded-2xl border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] p-4 mb-5 flex items-center gap-4 flex-wrap cursor-pointer hover:border-orange-300 dark:hover:border-orange-700/50 transition-colors"
              style={{ borderColor: `${lm.color}30` }}
            >
              <TrustShieldIcon color={lm.color} size={32} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="text-sm font-bold text-gray-900 dark:text-white">Trust Score</span>
                  <span style={{
                    padding: "2px 10px", borderRadius: "999px",
                    background: `${lm.color}18`, border: `1px solid ${lm.color}35`,
                    fontSize: "12px", fontWeight: 700, color: lm.color,
                  }}>
                    {lm.emoji} {lm.label}
                  </span>
                </div>
                <TrustProgressBar value={trustData.score} color={lm.color} />
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span style={{ fontSize: "26px", fontWeight: 900, color: lm.color, lineHeight: 1 }}>
                  {trustData.score}<span style={{ fontSize: "13px", fontWeight: 600, color: "#9ca3af" }}>/100</span>
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); setActiveTab("trust-score"); }}
                  className="h-8 px-3 text-xs font-semibold rounded-lg border border-gray-300 text-gray-700 hover:border-orange-400 hover:text-orange-600 hover:bg-orange-50 transition-colors"
                >
                  View details →
                </button>
              </div>
            </div>
          );
        })()}

        {/* ── Tab Nav ── */}
        <div className="border-b border-gray-200 dark:border-[#2A2A2A] mb-7">
          <nav className="-mb-px flex gap-0 overflow-x-auto scrollbar-none">
            {TABS.map((tab) => (
              <button key={tab.id}
                onClick={() => tab.href ? router.push(tab.href) : setActiveTab(tab.id as Tab)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-orange-500 text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/20"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-white/5"
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
            {loading && (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="w-7 h-7 animate-spin text-orange-600" />
                <p className="text-sm text-gray-600">Loading your store...</p>
              </div>
            )}
            {!loading && error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
                <p className="text-sm text-red-600">{error}</p>
                <Button size="sm" variant="outline" className="mt-3 border-red-300 text-red-600 hover:text-red-700" onClick={fetchLibrary}>Try again</Button>
              </div>
            )}
            {!loading && !error && (
              <>
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 uppercase tracking-wider">Published Products</h2>
                    {published.length > 0 && (
                      <Badge className="bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800/40 hover:bg-green-50 text-xs font-medium">
                        {published.length} live
                      </Badge>
                    )}
                  </div>
                  {published.length === 0 ? (
                    <EmptyState
                      icon={ShoppingBag}
                      title="No products published yet"
                      subtitle="Create your first product with AI in 3–5 minutes, or upload an existing file."
                      action={
                        <div className="flex items-center justify-center gap-3 flex-wrap">
                          <Link href="/dashboard/launch">
                            <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white gap-2">
                              <Rocket className="w-3.5 h-3.5" />Launch with AI
                            </Button>
                          </Link>
                          <Link href="/dashboard/library">
                            <Button size="sm" variant="outline" className="border-gray-300 dark:border-[#2A2A2A] gap-2">
                              <Package className="w-3.5 h-3.5" />My Library
                            </Button>
                          </Link>
                          <Link href="/dashboard/digital-products/upload">
                            <Button size="sm" variant="ghost" className="gap-2 text-gray-500">
                              <Upload className="w-3.5 h-3.5" />Upload file
                            </Button>
                          </Link>
                        </div>
                      }
                    />
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {published.map((item) => <PublishedProductCard key={item.id} item={item} onRefresh={fetchLibrary} />)}
                    </div>
                  )}
                </section>

                {unpublished.length > 0 && (
                  <section>
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 uppercase tracking-wider">Unpublished</h2>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{unpublished.length} products</span>
                    </div>
                    <div className="rounded-2xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#2A2A2A] px-5 py-1">
                      {unpublished.map((item) => <UnpublishedProductRow key={item.id} item={item} onRefresh={fetchLibrary} />)}
                    </div>
                  </section>
                )}

                {/* ── Add more products bar ── */}
                <div className="rounded-2xl border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] p-4 flex items-center gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">Add products to your store</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Upload a file or pick something you&apos;ve already made in the app</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <Link href="/dashboard/digital-products/upload">
                      <Button variant="outline" size="sm" className="gap-2 border-gray-300 text-gray-700 hover:text-orange-600 hover:border-orange-300 h-8 text-xs">
                        <Upload className="w-3.5 h-3.5" />Upload file
                      </Button>
                    </Link>
                    <Button size="sm" className="gap-2 bg-orange-500 hover:bg-orange-600 text-white h-8 text-xs" onClick={() => setShowLibraryPicker((v) => !v)}>
                      <BookOpen className="w-3.5 h-3.5" />{showLibraryPicker ? "Close library" : "Pick from library"}
                    </Button>
                  </div>
                </div>

                {/* ── Library picker ── */}
                {showLibraryPicker && (
                  <div className="rounded-2xl border border-orange-200 dark:border-orange-800/40 bg-orange-50 dark:bg-orange-950/20 p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <BookOpen className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">Your library — click any item to publish it</p>
                    </div>
                    {unpublished.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Everything in your library is already published, or your library is empty.</p>
                        <Link href="/dashboard/launch">
                          <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white gap-2">
                            <Rocket className="w-3.5 h-3.5" />Launch with AI
                          </Button>
                        </Link>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {unpublished.map((item) => (
                          <LibraryPickerRow
                            key={item.id}
                            item={item}
                            publishing={libraryPickerPublishing === item.id}
                            onPublish={async (price) => {
                              setLibraryPickerPublishing(item.id);
                              try {
                                const res = await fetch(`/api/products/${item.id}/native-publish`, {
                                  method: "POST", headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ price }),
                                });
                                const data = await res.json();
                                if (!res.ok) throw new Error(data.error || "Failed to publish");
                                toast({ title: "Published!", description: `"${item.title}" is now live at ${data.priceLabel}` });
                                fetchLibrary();
                              } catch (err) {
                                toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
                              } finally { setLibraryPickerPublishing(null); }
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* BUNDLES TAB                                                           */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "bundles" && (
          <div className="space-y-4">
            <SectionHeader
              title="Product Bundles"
              subtitle="Group products and sell at a special price."
              action={
                <Button size="sm" variant="outline" className="h-8 text-xs border-gray-300 text-gray-800 hover:text-gray-900 hover:bg-gray-100 gap-1.5" onClick={() => setShowBundleForm(!showBundleForm)}>
                  <Plus className="w-3 h-3" />New bundle
                </Button>
              }
            />
            {showBundleForm && (
              <div className="rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#2A2A2A] p-5 space-y-4">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Create bundle</p>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Title</p>
                    <Input value={bundleTitle} onChange={(e) => setBundleTitle(e.target.value)} placeholder="Ultimate Creator Pack" className="h-9 text-sm bg-gray-100 dark:bg-[#111] border-gray-300 dark:border-[#333] text-gray-900 dark:text-white placeholder:text-gray-500" />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Description (optional)</p>
                    <Input value={bundleDescription} onChange={(e) => setBundleDescription(e.target.value)} placeholder="Everything you need to get started..." className="h-9 text-sm bg-gray-100 dark:bg-[#111] border-gray-300 dark:border-[#333] text-gray-900 dark:text-white placeholder:text-gray-500" />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Bundle price</p>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-400 text-sm">\xa3</span>
                      <Input type="number" min="1" step="0.01" value={bundlePrice} onChange={(e) => setBundlePrice(e.target.value)} placeholder="19.99" className="pl-7 h-9 text-sm bg-gray-100 dark:bg-[#111] border-gray-300 dark:border-[#333] text-gray-900 dark:text-white placeholder:text-gray-500" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Select products (at least 2)</p>
                    <div className="rounded-xl border border-gray-200 dark:border-[#2A2A2A] divide-y divide-gray-200 dark:divide-[#2A2A2A] max-h-48 overflow-y-auto bg-gray-50 dark:bg-[#111]">
                      {items.filter((i) => i.isNativePublished).length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400 p-4">No published products yet.</p>
                      ) : items.filter((i) => i.isNativePublished).map((item) => (
                        <label key={item.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5">
                          <input type="checkbox" checked={bundleProductIds.includes(item.id)} onChange={(e) => { if (e.target.checked) setBundleProductIds((p) => [...p, item.id]); else setBundleProductIds((p) => p.filter((id) => id !== item.id)); }} className="accent-orange-500" />
                          <span className="text-sm text-gray-900 dark:text-white">{item.title}</span>
                          {item.nativePrice != null && <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">{formatPrice(item.nativePrice)}</span>}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-gray-900 h-8 text-xs" disabled={savingBundle} onClick={async () => {
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
                  <Button size="sm" variant="ghost" className="h-8 text-xs text-gray-600 hover:text-gray-900" onClick={() => setShowBundleForm(false)}>Cancel</Button>
                </div>
              </div>
            )}
            {bundlesLoading ? (
              <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-orange-600" /></div>
            ) : bundles.length === 0 ? (
              <EmptyState icon={Layers} title="No bundles yet" subtitle="Group your products and sell them at a special price." />
            ) : (
              <div className="rounded-2xl bg-gray-50 border border-gray-200 divide-y divide-gray-200">
                {bundles.map((b) => (
                  <div key={b.id} className="flex items-center justify-between px-5 py-4 gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center shrink-0">
                        <Layers className="w-4 h-4 text-orange-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{b.title}</p>
                        <p className="text-xs text-gray-500">{b.productIds.length} products · {formatPrice(b.bundlePrice)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button size="sm" variant="outline" className="h-7 text-xs border-gray-300 text-gray-800 hover:text-gray-900 gap-1" onClick={() => window.open(`/bundle/${b.id}`, "_blank")}>
                        <Eye className="w-3 h-3" />View
                      </Button>
                      <button className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors" onClick={async () => { try { await fetch(`/api/bundles/${b.id}`, { method: "DELETE" }); toast({ title: "Bundle removed" }); fetchBundles(); } catch { toast({ title: "Failed", variant: "destructive" }); } }}>
                        <X className="w-4 h-4" />
                      </button>
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
            <SectionHeader
              title="Promo Codes"
              subtitle="Create discount codes to share with your audience."
              action={
                <Button size="sm" variant="outline" className="h-8 text-xs border-gray-300 text-gray-800 hover:text-gray-900 hover:bg-gray-100 gap-1.5" onClick={() => setShowPromoForm(!showPromoForm)}>
                  <Plus className="w-3 h-3" />New code
                </Button>
              }
            />
            {showPromoForm && (
              <div className="rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#2A2A2A] p-5 space-y-4">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Create promo code</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Code</p>
                    <Input value={promoCode} onChange={(e) => setPromoCode(e.target.value.toUpperCase())} placeholder="SUMMER20" className="h-9 text-sm bg-gray-100 dark:bg-[#111] border-gray-300 dark:border-[#333] text-gray-900 dark:text-white uppercase placeholder:text-gray-500" />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Discount %</p>
                    <Input type="number" min="1" max="100" value={promoDiscount} onChange={(e) => setPromoDiscount(e.target.value)} placeholder="20" className="h-9 text-sm bg-gray-100 dark:bg-[#111] border-gray-300 dark:border-[#333] text-gray-900 dark:text-white placeholder:text-gray-500" />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Max uses (blank = unlimited)</p>
                    <Input type="number" min="1" value={promoMaxUses} onChange={(e) => setPromoMaxUses(e.target.value)} placeholder="Unlimited" className="h-9 text-sm bg-gray-100 dark:bg-[#111] border-gray-300 dark:border-[#333] text-gray-900 dark:text-white placeholder:text-gray-500" />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Expires (optional)</p>
                    <Input type="date" value={promoExpiry} onChange={(e) => setPromoExpiry(e.target.value)} className="h-9 text-sm bg-gray-100 dark:bg-[#111] border-gray-300 dark:border-[#333] text-gray-900 dark:text-white" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-gray-900 h-8 text-xs" disabled={savingPromo} onClick={async () => {
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
                  <Button size="sm" variant="ghost" className="h-8 text-xs text-gray-600 hover:text-gray-900" onClick={() => setShowPromoForm(false)}>Cancel</Button>
                </div>
              </div>
            )}
            {promoLoading ? (
              <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-orange-600" /></div>
            ) : promoCodes.length === 0 ? (
              <EmptyState icon={Tag} title="No promo codes yet" subtitle="Create a code to offer discounts to your audience." />
            ) : (
              <div className="rounded-2xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#2A2A2A] divide-y divide-gray-200 dark:divide-[#2A2A2A]">
                {promoCodes.map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-5 py-4 gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-wrap">
                      <code className="text-sm font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 px-2 py-0.5 rounded-lg border border-orange-200 dark:border-orange-800/40">{c.code}</code>
                      <span className="text-sm text-gray-800 dark:text-gray-200">{c.discountPercent ? `${c.discountPercent}% off` : c.discountAmount ? `\xa3${(c.discountAmount / 100).toFixed(2)} off` : ""}</span>
                      {c.maxUses && <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-white/5 px-2 py-0.5 rounded-full">{c.usedCount}/{c.maxUses} uses</span>}
                      {c.expiresAt && <span className="text-xs text-gray-500 dark:text-gray-400">expires {new Date(c.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>}
                    </div>
                    <button className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0" onClick={async () => { try { await fetch("/api/creator/promo-codes", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: c.id }) }); toast({ title: "Code deleted" }); fetchPromoCodes(); } catch { toast({ title: "Failed", variant: "destructive" }); } }}>
                      <X className="w-4 h-4" />
                    </button>
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
            <SectionHeader
              title="Affiliate Links"
              subtitle="Give partners a unique link and track their sales here."
              action={
                <Button size="sm" variant="outline" className="h-8 text-xs border-gray-300 text-gray-800 hover:text-gray-900 hover:bg-gray-100 gap-1.5" onClick={() => setShowAffiliateForm(!showAffiliateForm)}>
                  <Plus className="w-3 h-3" />Add affiliate
                </Button>
              }
            />
            {showAffiliateForm && (
              <div className="rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#2A2A2A] p-5 space-y-4">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Create affiliate link</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Name</p>
                    <Input value={affiliateName} onChange={(e) => setAffiliateName(e.target.value)} placeholder="Jane Smith" className="h-9 text-sm bg-gray-100 dark:bg-[#111] border-gray-300 dark:border-[#333] text-gray-900 dark:text-white placeholder:text-gray-500" />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Email (optional)</p>
                    <Input value={affiliateEmail} onChange={(e) => setAffiliateEmail(e.target.value)} placeholder="jane@example.com" className="h-9 text-sm bg-gray-100 dark:bg-[#111] border-gray-300 dark:border-[#333] text-gray-900 dark:text-white placeholder:text-gray-500" />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Commission %</p>
                    <Input type="number" min="1" max="100" value={affiliateCommission} onChange={(e) => setAffiliateCommission(e.target.value)} placeholder="20" className="h-9 text-sm bg-gray-100 dark:bg-[#111] border-gray-300 dark:border-[#333] text-gray-900 dark:text-white placeholder:text-gray-500" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-gray-900 h-8 text-xs" disabled={savingAffiliate} onClick={async () => {
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
                  <Button size="sm" variant="ghost" className="h-8 text-xs text-gray-600 hover:text-gray-900" onClick={() => setShowAffiliateForm(false)}>Cancel</Button>
                </div>
              </div>
            )}
            {affiliatesLoading ? (
              <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-orange-600" /></div>
            ) : affiliates.length === 0 ? (
              <EmptyState icon={Users} title="No affiliates yet" subtitle="Create a link to share with partners who promote your products." />
            ) : (
              <div className="rounded-2xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#2A2A2A] divide-y divide-gray-200 dark:divide-[#2A2A2A]">
                {affiliates.map((a) => (
                  <div key={a.id} className="px-5 py-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{a.affiliateName}</p>
                        {a.affiliateEmail && <p className="text-xs text-gray-500 dark:text-gray-400">{a.affiliateEmail}</p>}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-white/5 px-2 py-1 rounded-lg">{a.salesCount} sales · {a.commissionPercent}%</span>
                        <button className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors" onClick={async () => { try { await fetch("/api/affiliates", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: a.id }) }); toast({ title: "Affiliate removed" }); fetchAffiliates(); } catch { toast({ title: "Failed", variant: "destructive" }); } }}>
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 bg-gray-100 dark:bg-[#111] border border-gray-200 dark:border-[#2A2A2A] rounded-xl px-3 py-2.5">
                      <p className="text-xs text-gray-600 dark:text-gray-400 font-mono flex-1 truncate">{a.referralUrl}</p>
                      <button className="text-gray-500 hover:text-orange-600 transition-colors shrink-0" onClick={() => { navigator.clipboard.writeText(a.referralUrl); toast({ title: "Link copied!" }); }}>
                        <Copy className="w-3.5 h-3.5" />
                      </button>
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
            <SectionHeader
              title="Customers"
              subtitle="Everyone who has bought from your store, ranked by total spend."
              action={
                <Link href="/dashboard/email-marketing?blast=buyers">
                  <Button size="sm" className="h-8 text-xs bg-orange-500 hover:bg-orange-600 text-gray-900 gap-1.5">
                    <Send className="w-3 h-3" />Email All
                  </Button>
                </Link>
              }
            />

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-gray-400" />
              <Input value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} placeholder="Search by name or email..." className="pl-9 h-9 bg-gray-100 dark:bg-[#1A1A1A] border-gray-300 dark:border-[#2A2A2A] text-gray-900 dark:text-white placeholder:text-gray-500 focus:border-orange-500/50" />
            </div>

            {analyticsLoading ? (
              <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-orange-600" /></div>
            ) : customers.length === 0 ? (
              <EmptyState icon={UserCircle} title="No customers yet" subtitle="When someone buys from your store, they'll appear here." />
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#2A2A2A] p-4 text-center">
                    <p className="text-xl font-bold text-gray-900 dark:text-white">{customers.length}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Total customers</p>
                  </div>
                  <div className="rounded-xl bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/40 p-4 text-center">
                    <p className="text-xl font-bold text-orange-600 dark:text-orange-400">{formatPrice(customers.reduce((s, c) => s + c.totalCents, 0))}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Total revenue</p>
                  </div>
                  <div className="rounded-xl bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#2A2A2A] p-4 text-center">
                    <p className="text-xl font-bold text-gray-900 dark:text-white">{customers.length > 0 ? formatPrice(Math.round(customers.reduce((s, c) => s + c.totalCents, 0) / customers.length)) : "\xa30.00"}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Avg. LTV</p>
                  </div>
                </div>

                <div className="rounded-2xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#2A2A2A] overflow-hidden">
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-3 border-b border-gray-200 dark:border-[#2A2A2A] bg-gray-50 dark:bg-[#111]">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Customer</span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 text-right">Orders</span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 text-right">Spent</span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 text-right">Action</span>
                  </div>
                  <div className="divide-y divide-gray-200">
                    {filteredCustomers.map((c, i) => (
                      <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-4 items-center hover:bg-gray-50 transition-colors">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{c.name ?? maskEmail(c.email)}</p>
                          <p className="text-xs text-gray-500 truncate">{maskEmail(c.email)}</p>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {c.products.slice(0, 2).map((p) => (
                              <span key={p} className="text-[10px] bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 truncate max-w-[140px]">{p}</span>
                            ))}
                            {c.products.length > 2 && <span className="text-[10px] text-gray-500">+{c.products.length - 2} more</span>}
                          </div>
                        </div>
                        <span className="text-sm text-gray-800 text-right font-medium">{c.orders}</span>
                        <span className="text-sm font-bold text-orange-600 text-right">{formatPrice(c.totalCents)}</span>
                        <div className="flex items-center justify-end">
                          <Link href={`/dashboard/email-marketing?to=${encodeURIComponent(c.email)}`}>
                            <button className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-orange-600 hover:bg-orange-50 transition-colors" title="Email this customer">
                              <Mail className="w-4 h-4" />
                            </button>
                          </Link>
                        </div>
                      </div>
                    ))}
                    {filteredCustomers.length === 0 && (
                      <div className="px-5 py-8 text-center">
                        <p className="text-sm text-gray-500">No customers matching &quot;{customerSearch}&quot;</p>
                      </div>
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
            <SectionHeader title="Email Marketing" subtitle="Reach your buyers and subscribers directly from your store." />

            <div className="rounded-2xl bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/40 p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-orange-100 dark:bg-orange-950/40 border border-orange-300 dark:border-orange-800/40 flex items-center justify-center shrink-0">
                <Mail className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="flex-1">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{analyticsLoading ? "—" : analytics?.subscriberCount ?? 0}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">email subscribers</p>
              </div>
              <Link href="/dashboard/email-marketing">
                <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-gray-900 gap-2 shrink-0">
                  <Mail className="w-4 h-4" />Manage List
                </Button>
              </Link>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Quick Actions</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { href: "/dashboard/email-marketing?blast=buyers", icon: ShoppingBag, color: "blue", title: "Email All Buyers", desc: "Send to everyone who has purchased from your store" },
                  { href: "/dashboard/email-marketing", icon: Users, color: "purple", title: "Email Subscribers", desc: "Broadcast to your full email list" },
                  { href: "/dashboard/email-marketing?new=sequence", icon: Zap, color: "green", title: "Welcome Sequence", desc: "Auto-send emails when someone joins your list" },
                  { href: "/dashboard/email-marketing?new=campaign", icon: Send, color: "orange", title: "New Campaign", desc: "Write and send a one-off email blast" },
                ].map((item) => {
                  const Icon = item.icon;
                  const colorMap: Record<string, string> = {
                    blue: "bg-blue-50 border-blue-200 text-blue-600 group-hover:bg-blue-100",
                    purple: "bg-purple-50 border-purple-200 text-purple-600 group-hover:bg-purple-100",
                    green: "bg-green-50 border-green-200 text-green-600 group-hover:bg-green-100",
                    orange: "bg-orange-50 border-orange-200 text-orange-600 group-hover:bg-orange-500/18",
                  };
                  return (
                    <Link key={item.href} href={item.href} className="group">
                      <div className="rounded-2xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#2A2A2A] p-5 flex items-center gap-4 hover:border-gray-300 dark:hover:border-orange-700/40 hover:bg-gray-100 dark:hover:bg-[#1E1E1E] transition-all cursor-pointer">
                        <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 transition-colors ${colorMap[item.color]}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.title}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.desc}</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-orange-600 transition-colors shrink-0" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#2A2A2A] p-5">
              <div className="flex items-center gap-2 mb-4">
                <Star className="w-4 h-4 text-orange-600" />
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Growth tips</p>
              </div>
              <div className="space-y-3">
                {[
                  { tip: "Add an email subscribe button to your store via Customise Store", action: "/dashboard/store/customize" },
                  { tip: "Send a launch email to buyers whenever you release a new product", action: "/dashboard/email-marketing?blast=buyers" },
                  { tip: "Set up a welcome sequence to nurture new subscribers automatically", action: "/dashboard/email-marketing?new=sequence" },
                ].map((item, i) => (
                  <Link key={i} href={item.action} className="flex items-start gap-3 group p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
                    <span className="text-orange-600 text-xs font-bold mt-0.5 shrink-0 w-4">{i + 1}.</span>
                    <p className="text-sm text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white transition-colors flex-1">{item.tip}</p>
                    <ArrowRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-orange-600 transition-colors shrink-0 mt-0.5" />
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
            <SectionHeader
              title="Store Analytics"
              subtitle="Revenue and performance overview."
              action={
                <Link href="/dashboard/analytics">
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                    <BarChart2 className="w-3.5 h-3.5" />Full Analytics
                  </Button>
                </Link>
              }
            />

            {analyticsLoading ? (
              <div className="flex items-center justify-center py-14"><Loader2 className="w-6 h-6 animate-spin text-orange-600" /></div>
            ) : (
              <>
                {/* ── Top-line metrics ── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatCard label="All Time Revenue" value={formatPrice(analytics?.totalRevenueCents ?? 0)} accent />
                  <StatCard label="Total Orders"     value={String(analytics?.totalOrders ?? 0)} />
                  <StatCard label="Last 30 Days"     value={formatPrice(analytics?.last30DaysRevenueCents ?? 0)} accent />
                  <StatCard label="30-Day Orders"    value={String(analytics?.last30DaysOrders ?? 0)} />
                </div>

                {/* ── Platform engagement metrics ── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded-2xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#2A2A2A] p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center shrink-0">
                      <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{(analytics?.totalViews ?? 0).toLocaleString()}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Total Views</p>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#2A2A2A] p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center shrink-0">
                      <Heart className="w-4 h-4 text-rose-500" />
                    </div>
                    <div>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{(analytics?.totalWishlistSaves ?? 0).toLocaleString()}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Wishlist Saves</p>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#2A2A2A] p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/30 flex items-center justify-center shrink-0">
                      <UserCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{(analytics?.followerCount ?? 0).toLocaleString()}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Followers</p>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#2A2A2A] p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center shrink-0">
                      <Star className="w-4 h-4 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {analytics?.overallAvgRating != null ? `${analytics.overallAvgRating} ★` : "—"}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Avg Rating</p>
                    </div>
                  </div>
                </div>

                {analytics?.dailyRevenue && analytics.dailyRevenue.length > 0 && (
                  <div className="rounded-2xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#2A2A2A] p-5">
                    <div className="flex items-center justify-between mb-5">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">Revenue — Last 14 Days</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{formatPrice(analytics.last30DaysRevenueCents)} this month</p>
                    </div>
                    <RevenueChart data={analytics.dailyRevenue} />
                    <div className="flex items-center justify-between mt-3">
                      <p className="text-[10px] text-gray-400">{analytics.dailyRevenue.slice(-14)[0]?.date}</p>
                      <p className="text-[10px] text-gray-400">{analytics.dailyRevenue[analytics.dailyRevenue.length - 1]?.date}</p>
                    </div>
                  </div>
                )}

                {analytics?.topProducts && analytics.topProducts.length > 0 && (
                  <div className="rounded-2xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#2A2A2A] p-5">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white mb-5">Top Products</p>
                    <div className="space-y-4">
                      {analytics.topProducts.slice(0, 5).map((p, i) => {
                        const maxRev = analytics.topProducts[0].revenueCents;
                        const pct = maxRev > 0 ? (p.revenueCents / maxRev) * 100 : 0;
                        return (
                          <div key={p.productId}>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm text-gray-900 dark:text-white truncate flex-1 mr-3">
                                <span className="text-gray-400 mr-2 text-xs">#{i + 1}</span>{p.title}
                              </p>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="text-xs text-gray-500 dark:text-gray-400">{p.orders} sale{p.orders !== 1 ? "s" : ""}</span>
                                <span className="text-sm font-bold text-orange-600 dark:text-orange-400">{formatPrice(p.revenueCents)}</span>
                              </div>
                            </div>
                            <div className="h-1.5 bg-gray-100 dark:bg-[#2A2A2A] rounded-full overflow-hidden">
                              <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {analytics?.recentOrders && analytics.recentOrders.length > 0 && (
                  <div className="rounded-2xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#2A2A2A] overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-200 dark:border-[#2A2A2A]">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">Recent Orders</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide border-b border-gray-200 dark:border-[#2A2A2A] bg-gray-50 dark:bg-[#111]">
                            <th className="text-left px-5 py-3 font-semibold">Date</th>
                            <th className="text-left px-5 py-3 font-semibold">Buyer</th>
                            <th className="text-left px-5 py-3 font-semibold hidden md:table-cell">Product</th>
                            <th className="text-right px-5 py-3 font-semibold">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-[#2A2A2A]">
                          {analytics.recentOrders.slice(0, 10).map((o) => (
                            <tr key={o.id} className="hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
                              <td className="px-5 py-3.5 text-gray-500 dark:text-gray-400 text-xs">{fmtDate(o.createdAt)}</td>
                              <td className="px-5 py-3.5 text-gray-800 dark:text-gray-200">{maskEmail(o.buyerEmail)}</td>
                              <td className="px-5 py-3.5 text-gray-600 dark:text-gray-400 hidden md:table-cell truncate max-w-[160px]">{o.productTitle}</td>
                              <td className="px-5 py-3.5 text-right text-orange-600 dark:text-orange-400 font-semibold">{formatPrice(o.amountCents)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ── Product Performance Table ── */}
                {analytics?.conversionFunnel && analytics.conversionFunnel.length > 0 && (
                  <div className="rounded-2xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#2A2A2A] overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-200 dark:border-[#2A2A2A]">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">Product Performance</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Views, sales, revenue, wishlists, rating, and conversion rate per product</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide border-b border-gray-200 dark:border-[#2A2A2A] bg-gray-50 dark:bg-[#111]">
                            <th className="text-left px-5 py-3 font-semibold">Product</th>
                            <th className="text-right px-4 py-3 font-semibold">Views</th>
                            <th className="text-right px-4 py-3 font-semibold">Sales</th>
                            <th className="text-right px-4 py-3 font-semibold hidden md:table-cell">Revenue</th>
                            <th className="text-right px-4 py-3 font-semibold hidden lg:table-cell">
                              <Heart className="w-3 h-3 inline-block mr-0.5 text-rose-400" />Saves
                            </th>
                            <th className="text-right px-4 py-3 font-semibold hidden lg:table-cell">Rating</th>
                            <th className="text-right px-5 py-3 font-semibold">CVR</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-[#2A2A2A]">
                          {analytics.conversionFunnel.map((p) => {
                            const cvr = p.views > 0 ? ((p.orders / p.views) * 100).toFixed(1) : null;
                            return (
                              <tr key={p.productId} className="hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
                                <td className="px-5 py-3.5 text-gray-800 dark:text-gray-200 truncate max-w-[160px] font-medium">{p.title}</td>
                                <td className="px-4 py-3.5 text-right text-gray-600 dark:text-gray-400">{p.views.toLocaleString()}</td>
                                <td className="px-4 py-3.5 text-right text-gray-600 dark:text-gray-400">{p.orders}</td>
                                <td className="px-4 py-3.5 text-right text-orange-600 dark:text-orange-400 font-semibold hidden md:table-cell">{formatPrice(p.revenueCents)}</td>
                                <td className="px-4 py-3.5 text-right text-rose-500 hidden lg:table-cell">{p.wishlistSaves > 0 ? `❤️ ${p.wishlistSaves}` : "—"}</td>
                                <td className="px-4 py-3.5 text-right text-amber-600 dark:text-amber-400 hidden lg:table-cell">{p.avgRating != null ? `${p.avgRating} ★` : "—"}</td>
                                <td className="px-5 py-3.5 text-right">
                                  {cvr != null ? (
                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${parseFloat(cvr) >= 3 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : parseFloat(cvr) >= 1 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}>
                                      {cvr}%
                                    </span>
                                  ) : <span className="text-gray-400 text-xs">—</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {(!analytics?.totalOrders || analytics.totalOrders === 0) && (analytics?.totalViews ?? 0) === 0 && (
                  <EmptyState icon={TrendingUp} title="No data yet" subtitle="Your analytics will appear here once your store starts getting views and sales." />
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
            <SectionHeader title="Payouts" subtitle="Connect Stripe to receive payments directly." />
            <div className="rounded-2xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#2A2A2A] p-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800/40 flex items-center justify-center mx-auto mb-5">
                <CreditCard className="w-7 h-7 text-orange-600 dark:text-orange-400" />
              </div>
              <p className="text-base font-semibold text-gray-900 dark:text-white mb-2">Manage your payouts</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-xs mx-auto">Connect Stripe, view your balance, and see your full transaction history.</p>
              <Link href="/dashboard/store/payouts">
                <Button className="bg-orange-500 hover:bg-orange-600 text-gray-900 gap-2">
                  <CreditCard className="w-4 h-4" />Go to Payouts<ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* CREATOR GROWTH TAB                                                    */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "growth" && (() => {
          const referralLink = typeof window !== "undefined" ? `${window.location.origin}/signup?ref=me` : "";

          const credits       = growthSummary?.availableCredits ?? 0;
          const levelMeta     = getCreatorLevel(growthSummary?.salesCount ?? 0);
          const nextLevel     = CREATOR_LEVELS.find((l) => l.minSales > (growthSummary?.salesCount ?? 0));
          const salesCount    = growthSummary?.salesCount ?? 0;
          const featuredSlot  = growthSummary?.activeFeatured?.[0] ?? null;
          const featuredUntil = featuredSlot?.featuredUntil ? new Date(featuredSlot.featuredUntil).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : null;
          const pendingCount  = (growthSummary?.referrals ?? []).filter((r) => !["credit_awarded","expired","rejected"].includes(r.status)).length;
          const earnedCount   = (growthSummary?.referrals ?? []).filter((r) => r.status === "credit_awarded").length;
          const trustLm       = trustData ? getTrustLevel(trustData.score) : null;

          // Progress to next level
          const progressPct = nextLevel
            ? Math.round(((salesCount - levelMeta.minSales) / (nextLevel.minSales - levelMeta.minSales)) * 100)
            : 100;

          const GrowthLbTabs: { id: GrowthLbTab; label: string }[] = [
            { id: "top-sellers",     label: "Top Sellers" },
            { id: "highest-revenue", label: "Revenue"     },
            { id: "fastest-growing", label: "Growing"     },
            { id: "highest-rated",   label: "Rated"       },
            { id: "most-followed",   label: "Followed"    },
          ];

          return (
            <div className="space-y-5">

              {/* ── Modals ── */}
              {growthModal === "earn" && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                  <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/10 w-full max-w-md shadow-2xl">
                    <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-white/8">
                      <div>
                        <h3 className="font-bold text-base text-gray-900 dark:text-white">Ways to Earn Featured Credits</h3>
                        <p className="text-xs text-gray-500 mt-0.5">Real creator growth = real credits</p>
                      </div>
                      <button onClick={() => setGrowthModal(null)} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={18} /></button>
                    </div>
                    <div className="p-5 space-y-2.5">
                      {[
                        { emoji: "👥", label: "Refer a creator who goes Pro", credit: "+1 credit", desc: "Awarded only after they pay their first invoice." },
                        { emoji: "🛒", label: `Every ${REWARDS_CONFIG.SALES_PER_CREDIT} verified sales`, credit: "+1 credit", desc: "Based on completed native store orders." },
                        { emoji: "💷", label: `Every £${REWARDS_CONFIG.REVENUE_PER_CREDIT_GBP} verified revenue`, credit: "+1 credit", desc: "Cumulative GBP revenue from your native store." },
                        { emoji: "🏆", label: "Product of the Week winner", credit: "+2 credits", desc: "Admin-awarded weekly prize." },
                        { emoji: "⭐", label: `${REWARDS_CONFIG.REVIEWS_PER_CREDIT} five-star reviews`, credit: "+1 credit", desc: "Verified, approved product reviews." },
                        { emoji: "✅", label: "Complete creator profile", credit: "+0.25 credits", desc: "Name, bio, photo & brand colour all set." },
                        { emoji: "🎯", label: "Community challenge completion", credit: "+0.5 credits", desc: "Complete admin-set community challenges." },
                      ].map((w) => (
                        <div key={w.label} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.06]">
                          <span className="text-xl flex-shrink-0">{w.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-gray-900 dark:text-white">{w.label}</span>
                              <span className="text-xs font-bold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30 px-2 py-0.5 rounded-full">{w.credit}</span>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{w.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {growthModal === "history" && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                  <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/10 w-full max-w-md shadow-2xl">
                    <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-white/8">
                      <h3 className="font-bold text-base text-gray-900 dark:text-white">Credit History</h3>
                      <button onClick={() => setGrowthModal(null)} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={18} /></button>
                    </div>
                    <div className="p-5 max-h-96 overflow-y-auto space-y-2">
                      {(growthSummary?.creditHistory ?? []).length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-6">No credit activity yet</p>
                      ) : (growthSummary?.creditHistory ?? []).map((e) => (
                        <div key={e.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50 dark:bg-white/[0.03]">
                          <span className={`text-sm font-black flex-shrink-0 ${e.amountCredits > 0 ? "text-green-500" : "text-red-400"}`}>
                            {e.amountCredits > 0 ? "+" : ""}{e.amountCredits % 1 === 0 ? e.amountCredits.toFixed(0) : e.amountCredits.toFixed(2)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{e.description}</p>
                            <p className="text-xs text-gray-400">{new Date(e.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {growthModal === "referrals" && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                  <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/10 w-full max-w-md shadow-2xl">
                    <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-white/8">
                      <div>
                        <h3 className="font-bold text-base text-gray-900 dark:text-white">Invite Creators</h3>
                        <p className="text-xs text-gray-500 mt-0.5">Earn 1 credit per creator who goes Pro</p>
                      </div>
                      <button onClick={() => setGrowthModal(null)} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={18} /></button>
                    </div>
                    <div className="p-5">
                      <div className="flex gap-2 mb-4">
                        <input readOnly value={referralLink} className="flex-1 text-xs bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-gray-600 dark:text-gray-300 font-mono" />
                        <button onClick={() => { navigator.clipboard.writeText(referralLink); setGrowthCopied(true); setTimeout(() => setGrowthCopied(false), 2000); }}
                          className="px-3 py-2 rounded-lg bg-violet-600 text-white text-xs font-bold flex items-center gap-1.5 hover:bg-violet-700 transition-colors">
                          {growthCopied ? <Check size={13} /> : <Copy size={13} />}{growthCopied ? "Copied" : "Copy"}
                        </button>
                      </div>
                      <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2 mb-4">
                        ⚠️ Credits are only awarded after the referred creator pays their first invoice.
                      </p>
                      <div className="max-h-52 overflow-y-auto space-y-2">
                        {(growthSummary?.referrals ?? []).length === 0 ? (
                          <p className="text-sm text-gray-400 text-center py-4">No referrals yet</p>
                        ) : (growthSummary?.referrals ?? []).map((r) => {
                          const meta = REFERRAL_STATUS_META[r.status];
                          return (
                            <div key={r.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50 dark:bg-white/[0.03]">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{r.referredEmail ?? "Creator"}</p>
                                <p className={`text-xs ${meta.color}`}>{meta.label}</p>
                              </div>
                              <span className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Loading ── */}
              {growthLoading && (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Loader2 className="w-7 h-7 animate-spin text-orange-600" />
                  <p className="text-sm text-gray-500">Loading your growth dashboard…</p>
                </div>
              )}

              {!growthLoading && (
                <>
                  {/* ── Row 1: Level + Trust Score ── */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                    {/* Creator Level card */}
                    <div className="rounded-2xl border border-violet-200 dark:border-violet-800/40 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/20 p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-2xl">{levelMeta.emoji}</span>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">Creator Level</p>
                          <p className="text-base font-black text-gray-900 dark:text-white leading-tight">{levelMeta.label}</p>
                        </div>
                      </div>
                      {nextLevel ? (
                        <>
                          <div className="w-full h-2 rounded-full bg-violet-100 dark:bg-violet-900/40 overflow-hidden mb-1.5">
                            <div className="h-full rounded-full bg-violet-600 transition-all duration-700" style={{ width: `${progressPct}%` }} />
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            <span className="font-bold text-violet-600 dark:text-violet-400">{salesCount}</span> sales ·{" "}
                            <span className="font-semibold">{nextLevel.minSales - salesCount} more</span> to reach {nextLevel.emoji} {nextLevel.label}
                          </p>
                        </>
                      ) : (
                        <p className="text-xs font-bold text-violet-600 dark:text-violet-400">💎 You&apos;ve reached the top level!</p>
                      )}
                    </div>

                    {/* Trust Score mini card */}
                    <button
                      onClick={() => setActiveTab("trust-score")}
                      className="rounded-2xl border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] p-5 text-left hover:border-orange-300 dark:hover:border-orange-700/50 transition-colors w-full"
                      style={trustLm ? { borderColor: `${trustLm.color}30` } : {}}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <TrustShieldIcon color={trustLm?.color ?? "#9ca3af"} size={18} />
                        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: trustLm?.color ?? "#9ca3af" }}>Trust Score</p>
                        {trustLm && (
                          <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${trustLm.color}18`, color: trustLm.color, border: `1px solid ${trustLm.color}35` }}>
                            {trustLm.emoji} {trustLm.label}
                          </span>
                        )}
                      </div>
                      {trustData ? (
                        <>
                          <p className="text-3xl font-black leading-none mb-2" style={{ color: trustLm?.color ?? "#111827" }}>
                            {trustData.score}<span className="text-sm font-semibold text-gray-400">/100</span>
                          </p>
                          <TrustProgressBar value={trustData.score} color={trustLm?.color ?? "#9ca3af"} />
                          <p className="text-xs text-gray-400 mt-2">Click for full breakdown →</p>
                        </>
                      ) : (
                        <p className="text-sm text-gray-400">Not calculated yet</p>
                      )}
                    </button>
                  </div>

                  {/* ── Row 2: Stats ── */}
                  <div className="grid grid-cols-3 gap-3">
                    <button onClick={() => setGrowthModal("history")}
                      className="rounded-2xl border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] p-4 text-left hover:border-violet-300 dark:hover:border-violet-600/40 transition-colors">
                      <div className="flex items-center gap-1.5 mb-1"><Gift className="w-3.5 h-3.5 text-violet-500" /><p className="text-xs text-gray-500">Available</p></div>
                      <p className="text-2xl font-black text-violet-600 dark:text-violet-400 leading-none">{credits % 1 === 0 ? credits.toFixed(0) : credits.toFixed(2)}</p>
                      <p className="text-xs text-gray-400 mt-0.5">featured credits</p>
                    </button>
                    <button onClick={() => setGrowthModal("referrals")}
                      className="rounded-2xl border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] p-4 text-left hover:border-violet-300 dark:hover:border-violet-600/40 transition-colors">
                      <div className="flex items-center gap-1.5 mb-1"><UserPlus className="w-3.5 h-3.5 text-violet-500" /><p className="text-xs text-gray-500">Referrals</p></div>
                      <p className="text-2xl font-black text-gray-900 dark:text-white leading-none">{earnedCount}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{pendingCount > 0 ? `+${pendingCount} pending` : "converted"}</p>
                    </button>
                    <div className="rounded-2xl border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] p-4">
                      <div className="flex items-center gap-1.5 mb-1"><Star className="w-3.5 h-3.5 text-yellow-500" /><p className="text-xs text-gray-500">Featured</p></div>
                      <p className="text-2xl font-black text-gray-900 dark:text-white leading-none">{featuredSlot ? "Active" : "—"}</p>
                      {featuredUntil && <p className="text-xs text-gray-400 mt-0.5">until {featuredUntil}</p>}
                    </div>
                  </div>

                  {/* ── Feature Your Product ── */}
                  <div className="rounded-2xl border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                        <Sparkles className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">Feature a Product</p>
                        <p className="text-xs text-gray-500">Pin your product at the top of the Marketplace for 7 days</p>
                      </div>
                      <span className="ml-auto text-xs font-semibold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30 px-2.5 py-1 rounded-full border border-violet-200 dark:border-violet-700/40">
                        1 credit / slot
                      </span>
                    </div>
                    {featuredSlot ? (
                      <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800/40">
                        <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 animate-pulse" />
                        <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 min-w-0 truncate">
                          <strong>{growthProducts.find((p) => p.id === featuredSlot.productId)?.title ?? "Your product"}</strong>
                          {featuredUntil && <span className="text-gray-400 ml-1">· until {featuredUntil}</span>}
                        </span>
                        <button onClick={handleGrowthRemove} className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">
                          <X size={12} /> Remove
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        <select value={growthSelectedId} onChange={(e) => setGrowthSelectedId(e.target.value)}
                          className="flex-1 min-w-0 text-sm border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 bg-gray-50 dark:bg-[#111] text-gray-700 dark:text-gray-300 focus:outline-none focus:border-violet-400">
                          <option value="">Choose a product to feature…</option>
                          {growthProducts.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                        </select>
                        <Button onClick={handleGrowthFeature} disabled={!growthSelectedId || credits < 1 || growthSaving}
                          className="bg-violet-600 hover:bg-violet-700 text-white h-9 px-4 font-bold shrink-0">
                          {growthSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Feature (1 credit)"}
                        </Button>
                        {credits < 1 && (
                          <button onClick={() => setGrowthModal("earn")} className="text-xs text-gray-400 hover:text-violet-600 transition-colors w-full text-center mt-1">
                            How to earn credits →
                          </button>
                        )}
                      </div>
                    )}
                    {growthMsg && <p className="text-xs mt-2 text-red-500">{growthMsg}</p>}
                  </div>

                  {/* ── Quick Actions ── */}
                  <div className="rounded-2xl border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] p-5">
                    <p className="text-sm font-bold text-gray-900 dark:text-white mb-3">Quick Actions</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button onClick={() => setGrowthModal("earn")}
                        className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-100 dark:border-white/8 hover:border-violet-300 dark:hover:border-violet-600/40 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-all text-center group">
                        <Award className="w-5 h-5 text-violet-500 group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">View Rewards</span>
                      </button>
                      <button onClick={() => setGrowthModal("referrals")}
                        className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-100 dark:border-white/8 hover:border-violet-300 dark:hover:border-violet-600/40 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-all text-center group">
                        <UserPlus className="w-5 h-5 text-violet-500 group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Invite Creator</span>
                      </button>
                      <Link href="/marketplace/leaderboard"
                        className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-100 dark:border-white/8 hover:border-yellow-300 dark:hover:border-yellow-600/40 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-all text-center group">
                        <Trophy className="w-5 h-5 text-yellow-500 group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Leaderboard</span>
                      </Link>
                      <button onClick={() => setActiveTab("trust-score")}
                        className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-100 dark:border-white/8 hover:border-orange-300 dark:hover:border-orange-600/40 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all text-center group">
                        <Shield className="w-5 h-5 text-orange-500 group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Trust Score</span>
                      </button>
                    </div>
                  </div>

                  {/* ── Trust Score Tips ── */}
                  {trustData && (trustData.recommendations ?? []).length > 0 && (
                    <div className="rounded-2xl border border-orange-200 dark:border-orange-800/40 bg-orange-50 dark:bg-orange-950/20 p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <TrustShieldIcon color="#f97316" size={18} />
                        <p className="text-sm font-bold text-gray-900 dark:text-white">Improve Your Trust Score</p>
                        <button onClick={() => setActiveTab("trust-score")} className="ml-auto text-xs text-orange-600 dark:text-orange-400 font-semibold hover:underline">Full breakdown →</button>
                      </div>
                      <div className="space-y-2">
                        {trustData.recommendations.slice(0, 4).map((tip, i) => (
                          <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl bg-white dark:bg-[#1A1A1A] border border-orange-100 dark:border-orange-800/30">
                            <span className="text-orange-500 flex-shrink-0 mt-0.5">💡</span>
                            <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{tip}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Leaderboard ── */}
                  <div className="rounded-2xl border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Trophy className="w-4 h-4 text-yellow-500" />
                      <p className="text-sm font-bold text-gray-900 dark:text-white">Top Creators</p>
                      <Link href="/marketplace/leaderboard" className="ml-auto text-xs text-gray-400 hover:text-yellow-600 font-semibold transition-colors">View full →</Link>
                    </div>
                    <div className="flex gap-1 mb-4 flex-wrap">
                      {GrowthLbTabs.map((t) => (
                        <button key={t.id} onClick={() => setGrowthLbTab(t.id)}
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${growthLbTab === t.id ? "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-700/40" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}>
                          {t.label}
                        </button>
                      ))}
                    </div>
                    {growthLbLoading ? (
                      <div className="py-6 text-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400 mx-auto" /></div>
                    ) : growthLbEntries.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-6">No creators on this board yet — opt in to appear!</p>
                    ) : (
                      <div className="space-y-1.5">
                        {growthLbEntries.map((e) => (
                          <a key={e.userId} href={`/c/${e.userId}`}
                            className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors group">
                            <span className={`text-sm font-black w-5 text-center flex-shrink-0 ${e.rank === 1 ? "text-yellow-500" : e.rank === 2 ? "text-gray-400" : e.rank === 3 ? "text-orange-400" : "text-gray-300"}`}>{e.rank}</span>
                            {e.profileImage ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={e.profileImage} alt={e.displayName} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                            ) : (
                              <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white" style={{ background: e.accentColor }}>
                                {e.displayName.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-gray-900 dark:text-white truncate group-hover:text-violet-600 transition-colors">{e.displayName}</p>
                              <p className="text-xs text-gray-400">{e.levelEmoji} {e.levelLabel}</p>
                            </div>
                            <div className="text-right flex-shrink-0 text-xs font-bold text-gray-700 dark:text-gray-300">
                              {growthLbTab === "top-sellers"     && `${e.salesCount} sales`}
                              {growthLbTab === "highest-revenue" && `£${e.revenueGbp.toFixed(0)}`}
                              {growthLbTab === "highest-rated"   && `★ ${e.avgRating.toFixed(1)}`}
                              {(growthLbTab === "most-followed" || growthLbTab === "fastest-growing") && `${e.followerCount} followers`}
                            </div>
                          </a>
                        ))}
                      </div>
                    )}
                    {!growthSummary?.leaderboardOptIn && (
                      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/8 text-center">
                        <p className="text-xs text-gray-400 mb-2">You&apos;re not on the leaderboard yet</p>
                        <Link href="/marketplace/leaderboard" className="text-xs font-bold text-yellow-600 dark:text-yellow-400 hover:underline">
                          Opt in to appear →
                        </Link>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* TRUST SCORE TAB                                                       */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "trust-score" && (() => {
          if (trustLoading) return (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-7 h-7 animate-spin text-orange-600" />
              <p className="text-sm text-gray-500">Loading your Trust Score…</p>
            </div>
          );

          const score = trustData?.score ?? 0;
          const lm = getTrustLevel(score);
          const color = lm.color;
          const breakdown = trustData?.breakdown ?? {};
          const recommendations = trustData?.recommendations ?? [];
          const historyScores = trustHistory.map((h) => h.score);
          const prevScore = trustHistory.length >= 2 ? trustHistory[trustHistory.length - 2].score : null;
          const scoreDelta = prevScore !== null ? score - prevScore : null;

          const factorOrder = [
            "verifiedSales", "avgRating", "reviewCount", "refundRate",
            "productCompleteness", "profileCompleteness",
            "followerGrowth", "accountAge", "communityScore", "responseTime",
          ];

          return (
            <div style={{ maxWidth: "760px" }}>
              {/* Score hero card */}
              <div style={{
                background: `linear-gradient(135deg, ${color}10 0%, ${color}05 100%)`,
                border: `1px solid ${color}25`, borderRadius: "20px", padding: "24px",
                display: "flex", alignItems: "center", gap: "24px", flexWrap: "wrap", marginBottom: "20px",
              }}>
                <TrustScoreDonut score={score} color={color} />
                <div style={{ flex: 1, minWidth: "200px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", flexWrap: "wrap" }}>
                    <span style={{ padding: "4px 12px", borderRadius: "999px", background: `${color}18`, border: `1px solid ${color}35`, fontSize: "13px", fontWeight: 700, color }}>
                      {lm.emoji} {lm.label}
                    </span>
                    {scoreDelta !== null && (
                      <span style={{ padding: "4px 10px", borderRadius: "999px", background: scoreDelta >= 0 ? "#f0fdf4" : "#fef2f2", border: `1px solid ${scoreDelta >= 0 ? "#bbf7d0" : "#fecaca"}`, fontSize: "12px", fontWeight: 700, color: scoreDelta >= 0 ? "#16a34a" : "#dc2626" }}>
                        {scoreDelta >= 0 ? "↑" : "↓"} {Math.abs(scoreDelta)} pts
                      </span>
                    )}
                  </div>
                  <p style={{ margin: "0 0 12px", fontSize: "14px", color: "#6b7280" }}>{lm.tagline}</p>
                  <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                    {TRUST_LEVELS.map((l) => (
                      <span key={l.id} style={{ padding: "3px 9px", borderRadius: "999px", fontSize: "11px", fontWeight: 600, background: l.id === lm.id ? `${l.color}18` : "#f3f4f6", color: l.id === lm.id ? l.color : "#9ca3af", border: l.id === lm.id ? `1px solid ${l.color}30` : "1px solid #f3f4f6" }}>
                        {l.emoji} {l.label}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "flex-end", flexShrink: 0 }}>
                  <button onClick={handleTrustRecalculate} disabled={trustRecalculating} style={{ padding: "9px 16px", borderRadius: "10px", background: "#111827", border: "none", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: "pointer", opacity: trustRecalculating ? 0.6 : 1 }}>
                    {trustRecalculating ? "Recalculating…" : "🔄 Recalculate"}
                  </button>
                  <button onClick={handleTrustToggleOptIn} disabled={trustToggling} style={{ padding: "9px 16px", borderRadius: "10px", background: trustData?.publicOptIn ? "#fef2f2" : "#f0fdf4", border: `1px solid ${trustData?.publicOptIn ? "#fecaca" : "#bbf7d0"}`, color: trustData?.publicOptIn ? "#dc2626" : "#16a34a", fontSize: "13px", fontWeight: 700, cursor: "pointer", opacity: trustToggling ? 0.6 : 1 }}>
                    {trustData?.publicOptIn ? "🔒 Hide from public" : "🌐 Show publicly"}
                  </button>
                  {trustData?.lastCalculatedAt && (
                    <p style={{ margin: 0, fontSize: "11px", color: "#9ca3af" }}>Updated {new Date(trustData.lastCalculatedAt).toLocaleDateString()}</p>
                  )}
                </div>
              </div>

              {/* Private notice */}
              {!trustData?.publicOptIn && (
                <div style={{ padding: "12px 16px", borderRadius: "12px", background: "#fffbeb", border: "1px solid #fde68a", fontSize: "13px", color: "#92400e", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>⚠️</span>
                  <span>Your Trust Score is <strong>private</strong>. Enable it publicly to build buyer confidence and unlock more visibility.</span>
                </div>
              )}

              {/* Sub-tabs */}
              <div style={{ display: "flex", gap: "4px", marginBottom: "18px", background: "#f9fafb", borderRadius: "12px", padding: "4px" }}>
                {(["breakdown", "history", "tips"] as const).map((tab) => (
                  <button key={tab} onClick={() => setTrustSubTab(tab)} style={{ flex: 1, padding: "9px 12px", borderRadius: "9px", border: "none", background: trustSubTab === tab ? "#fff" : "transparent", boxShadow: trustSubTab === tab ? "0 1px 4px rgba(0,0,0,0.08)" : "none", color: trustSubTab === tab ? "#111827" : "#6b7280", fontSize: "13px", fontWeight: trustSubTab === tab ? 700 : 500, cursor: "pointer", transition: "all 0.15s" }}>
                    {tab === "breakdown" ? "📊 Breakdown" : tab === "history" ? "📈 History" : "💡 How to Improve"}
                  </button>
                ))}
              </div>

              {/* Breakdown */}
              {trustSubTab === "breakdown" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {factorOrder.map((key) => {
                    const meta = TRUST_FACTOR_META[key];
                    if (!meta) return null;
                    const value = Math.round(breakdown[key] ?? 0);
                    const fc = trustFactorColor(value);
                    return (
                      <div key={key} style={{ padding: "14px", borderRadius: "14px", background: "#fff", border: "1px solid #f3f4f6", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "8px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div style={{ width: "34px", height: "34px", borderRadius: "9px", background: `${fc}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", flexShrink: 0 }}>{meta.icon}</div>
                            <div>
                              <p style={{ margin: "0 0 2px", fontSize: "14px", fontWeight: 700, color: "#111827" }}>{meta.label}</p>
                              <p style={{ margin: 0, fontSize: "12px", color: "#9ca3af" }}>{meta.description}</p>
                            </div>
                          </div>
                          <span style={{ fontSize: "17px", fontWeight: 800, color: fc, minWidth: "40px", textAlign: "right" }}>{value}%</span>
                        </div>
                        <TrustProgressBar value={value} color={fc} />
                        {value < 70 && <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#6b7280", paddingLeft: "44px" }}>💡 {meta.tip}</p>}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* History */}
              {trustSubTab === "history" && (
                <div>
                  {trustHistory.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "48px 24px", color: "#9ca3af", fontSize: "14px" }}>No history yet — recalculate your score to start tracking.</div>
                  ) : (
                    <>
                      {historyScores.length >= 2 && (
                        <div style={{ padding: "18px", borderRadius: "14px", background: "#fff", border: "1px solid #f3f4f6", marginBottom: "14px" }}>
                          <p style={{ margin: "0 0 10px", fontSize: "13px", fontWeight: 700, color: "#374151" }}>Score over time</p>
                          <TrustSparkline data={historyScores} color={color} />
                          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
                            <span style={{ fontSize: "11px", color: "#9ca3af" }}>{trustHistory[0] ? new Date(trustHistory[0].calculatedAt).toLocaleDateString() : ""}</span>
                            <span style={{ fontSize: "11px", color: "#9ca3af" }}>{trustHistory[trustHistory.length - 1] ? new Date(trustHistory[trustHistory.length - 1].calculatedAt).toLocaleDateString() : ""}</span>
                          </div>
                        </div>
                      )}
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {trustEvents.map((ev) => (
                          <div key={ev.id} style={{ padding: "11px 13px", borderRadius: "12px", background: "#fff", border: "1px solid #f3f4f6", display: "flex", alignItems: "flex-start", gap: "10px" }}>
                            <div style={{ width: "30px", height: "30px", borderRadius: "8px", flexShrink: 0, background: ev.scoreDelta && ev.scoreDelta > 0 ? "#f0fdf4" : ev.scoreDelta && ev.scoreDelta < 0 ? "#fef2f2" : "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px" }}>
                              {ev.scoreDelta && ev.scoreDelta > 0 ? "↑" : ev.scoreDelta && ev.scoreDelta < 0 ? "↓" : "•"}
                            </div>
                            <div style={{ flex: 1 }}>
                              <p style={{ margin: 0, fontSize: "13px", color: "#374151" }}>{ev.description}</p>
                              <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#9ca3af" }}>{new Date(ev.createdAt).toLocaleString()}</p>
                            </div>
                            {ev.scoreDelta !== null && <span style={{ fontSize: "12px", fontWeight: 700, color: ev.scoreDelta > 0 ? "#16a34a" : "#dc2626" }}>{ev.scoreDelta > 0 ? "+" : ""}{ev.scoreDelta} pts</span>}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Tips */}
              {trustSubTab === "tips" && (
                <div>
                  <div style={{ padding: "14px 16px", borderRadius: "14px", background: `${color}08`, border: `1px solid ${color}20`, marginBottom: "16px" }}>
                    <p style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: 700, color: "#111827" }}>🎯 Ways to increase your Trust Score</p>
                    <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>Focus on these to build buyer confidence and unlock more visibility on the marketplace.</p>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {recommendations.length > 0 ? recommendations.map((rec, i) => (
                      <div key={i} style={{ padding: "13px 15px", borderRadius: "12px", background: "#fff", border: "1px solid #f3f4f6", display: "flex", alignItems: "flex-start", gap: "10px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                        <div style={{ width: "26px", height: "26px", borderRadius: "7px", flexShrink: 0, background: `${color}15`, color, fontWeight: 800, fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</div>
                        <p style={{ margin: 0, fontSize: "14px", color: "#374151", lineHeight: 1.55 }}>{rec}</p>
                      </div>
                    )) : (
                      <div style={{ textAlign: "center", padding: "32px", color: "#9ca3af" }}>Recalculate your score to get personalised improvement tips.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* SETTINGS TAB                                                          */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "settings" && (
          <div className="space-y-6">
            <SectionHeader title="Store Settings" subtitle="Customise your store design and configure email branding." />

            <div className="rounded-2xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#2A2A2A] p-5 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800/40 flex items-center justify-center shrink-0">
                  <Paintbrush className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Store Design</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Change banner, profile image, theme and layout.</p>
                </div>
              </div>
              <Link href="/dashboard/store/customize">
                <Button variant="outline" size="sm" className="border-orange-300 text-orange-600 hover:text-orange-200 hover:border-orange-400 hover:bg-orange-50 gap-2 h-9">
                  <Paintbrush className="w-4 h-4" />Customise Store<ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>

            <div className="bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#2A2A2A] rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-1.5">
                <Mail className="w-4 h-4 text-orange-600" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Email Branding</h3>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Purchase confirmation emails are sent automatically when a buyer checks out.</p>
              <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-[#333] rounded-xl p-4 mb-4">
                <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-200 dark:border-[#2A2A2A]">
                  <div className="w-6 h-6 rounded-full bg-orange-100 dark:bg-orange-950/40 flex items-center justify-center text-orange-600 text-[10px] font-bold shrink-0">CF</div>
                  <div>
                    <p className="text-xs font-semibold text-gray-900 dark:text-white leading-none mb-0.5">Your Brand Name</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-none">via Content Flywheel · no-reply@contentflywheel.co.uk</p>
                  </div>
                </div>
                <p className="text-xs font-semibold text-gray-900 dark:text-white mb-1.5">Your purchase is confirmed 🎉</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">Hi [Buyer name], thank you for your purchase of <span className="text-orange-600 dark:text-orange-400">[Product name]</span>. Here&apos;s your download link — it&apos;s valid for 7 days...</p>
                <div className="mt-3 pt-3 border-t border-white/8 dark:border-white/5">
                  <p className="text-xs text-gray-400 italic">Your brand name from Brand Voice is used as the sender display name.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3.5 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/40 rounded-xl">
                <span className="text-orange-600 text-sm shrink-0 mt-0.5">✏️</span>
                <div>
                  <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 mb-0.5">Update your sender name</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Update it in <Link href="/dashboard/brand-voice" className="text-orange-600 dark:text-orange-400 hover:text-orange-600 underline underline-offset-2">Brand Voice settings</Link>.</p>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
