"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Search, ShoppingBag, Sparkles, X, TrendingUp, Star } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type MarketplaceItem = {
  id: string;
  title: string;
  niche: string;
  format: string;
  priceLabel: string | null;
  nativePrice: number | null;
  thumbnailUrl: string | null;
  description: string;
  creatorName: string;
  creatorUserId: string;
  salesCount: number | null;
  trendingCount: number;
  avgRating: number | null;
  reviewCount: number;
  featured: boolean;
};

type ApiResponse = {
  items: MarketplaceItem[];
  total: number;
  page: number;
  pageSize: number;
  niches: string[];
  formats: string[];
};

type Sort = "newest" | "best-sellers" | "trending" | "price-asc" | "price-desc" | "free";

const SORT_TABS: { id: Sort; label: string; emoji: string }[] = [
  { id: "trending",     label: "Trending",    emoji: "🔥" },
  { id: "best-sellers", label: "Best Sellers", emoji: "⭐" },
  { id: "newest",       label: "New",          emoji: "🆕" },
  { id: "price-asc",   label: "Low Price",    emoji: "💸" },
  { id: "price-desc",  label: "High Price",   emoji: "💰" },
  { id: "free",        label: "Free",          emoji: "🎁" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function priceDisplay(item: MarketplaceItem) {
  if (item.nativePrice === 0) return "Free";
  if (item.nativePrice != null) return `£${(item.nativePrice / 100).toFixed(2)}`;
  if (item.priceLabel) return item.priceLabel;
  return "";
}

function creatorInitials(name: string) {
  return name.split(" ").map((w) => w[0]?.toUpperCase() ?? "").slice(0, 2).join("") || "CF";
}

const AVATAR_COLORS = ["#f97316","#8b5cf6","#3b82f6","#10b981","#ec4899","#f59e0b","#6366f1"];
function avatarColor(userId: string) {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}

function StarRow({ rating, count, size = 13 }: { rating: number; count: number; size?: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} style={{ color: i < full ? "#f59e0b" : i === full && half ? "#f59e0b" : "#d1d5db", fontSize: `${size}px`, lineHeight: 1 }}>
          {i < full ? "★" : i === full && half ? "⯨" : "☆"}
        </span>
      ))}
      <span style={{ fontSize: `${size - 1}px`, color: "#374151", fontWeight: 700, marginLeft: "2px" }}>{rating.toFixed(1)}</span>
      <span style={{ fontSize: `${size - 2}px`, color: "#9ca3af" }}>({count})</span>
    </div>
  );
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div style={{ borderRadius: "16px", background: "#fff", border: "1px solid #f3f4f6", overflow: "hidden" }}>
      <div style={{ aspectRatio: "4/3", background: "linear-gradient(90deg,#f3f4f6 25%,#e9eaec 50%,#f3f4f6 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
      <div style={{ padding: "16px" }}>
        <div style={{ height: "10px", width: "50%", borderRadius: "6px", background: "linear-gradient(90deg,#f3f4f6 25%,#e9eaec 50%,#f3f4f6 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite", marginBottom: "10px" }} />
        <div style={{ height: "15px", width: "85%", borderRadius: "6px", background: "linear-gradient(90deg,#f3f4f6 25%,#e9eaec 50%,#f3f4f6 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite", marginBottom: "6px" }} />
        <div style={{ height: "15px", width: "60%", borderRadius: "6px", background: "linear-gradient(90deg,#f3f4f6 25%,#e9eaec 50%,#f3f4f6 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite", marginBottom: "16px" }} />
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div style={{ height: "18px", width: "30%", borderRadius: "6px", background: "linear-gradient(90deg,#f3f4f6 25%,#e9eaec 50%,#f3f4f6 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
          <div style={{ height: "18px", width: "25%", borderRadius: "6px", background: "linear-gradient(90deg,#f3f4f6 25%,#e9eaec 50%,#f3f4f6 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
        </div>
      </div>
    </div>
  );
}

// ─── Product Card ─────────────────────────────────────────────────────────────

function ProductCard({
  item,
  inWishlist,
  onWishlist,
  onQuickView,
  onNicheClick,
}: {
  item: MarketplaceItem;
  inWishlist: boolean;
  onWishlist: (id: string, e: React.MouseEvent) => void;
  onQuickView: (item: MarketplaceItem) => void;
  onNicheClick: (niche: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const isFree = item.nativePrice === 0;
  const price = priceDisplay(item);

  // Badge logic
  const badge = (() => {
    if (item.featured)                                   return { label: "⭐ Featured",    bg: "#7c3aed" };
    if (item.salesCount !== null && item.salesCount > 9) return { label: "🏆 Best Seller", bg: "#f59e0b" };
    if (item.trendingCount > 0)                          return { label: "🔥 Trending",    bg: "#ef4444" };
    if (item.salesCount !== null && item.salesCount > 0) return { label: "✅ Verified",    bg: "#10b981" };
    return null;
  })();

  const initials = creatorInitials(item.creatorName);
  const bgColor  = avatarColor(item.creatorUserId);

  return (
    <Link href={`/product/${item.id}`} style={{ textDecoration: "none", display: "flex", height: "100%" }} className="mp-card-link">
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          borderRadius: "16px",
          background: "#fff",
          border: "1px solid #e5e7eb",
          overflow: "hidden",
          cursor: "pointer",
          transition: "box-shadow 0.22s cubic-bezier(.4,0,.2,1), transform 0.22s cubic-bezier(.4,0,.2,1), border-color 0.22s",
          boxShadow: hovered ? "0 12px 36px rgba(0,0,0,0.13)" : "0 1px 4px rgba(0,0,0,0.05)",
          transform: hovered ? "translateY(-4px)" : "none",
          borderColor: hovered ? "#f97316" : "#e5e7eb",
          display: "flex",
          flexDirection: "column",
          width: "100%",
        }}
      >
        {/* Thumbnail */}
        <div style={{ aspectRatio: "4/3", background: "linear-gradient(135deg,#f97316 0%,#ea580c 100%)", position: "relative", overflow: "hidden", flexShrink: 0 }}>
          {item.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.thumbnailUrl}
              alt={item.title}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", transition: "transform 0.35s cubic-bezier(.4,0,.2,1)", transform: hovered ? "scale(1.04)" : "scale(1)" }}
            />
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", background: "linear-gradient(135deg,#1f1f2e 0%,#2d1f3d 100%)" }}>
              <ShoppingBag style={{ width: "40px", height: "40px", color: "rgba(249,115,22,0.6)" }} />
            </div>
          )}

          {/* Top-left: format */}
          <span style={{ position: "absolute", top: "10px", left: "10px", background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", color: "#fff", fontSize: "9px", fontWeight: 800, padding: "3px 8px", borderRadius: "999px", textTransform: "uppercase", letterSpacing: "0.07em" }}>
            {item.format}
          </span>

          {/* Top-right: wishlist */}
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onWishlist(item.id, e); }}
            style={{ position: "absolute", top: "8px", right: "8px", background: inWishlist ? "rgba(244,63,94,0.9)" : "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", border: "none", borderRadius: "50%", width: "32px", height: "32px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", transition: "all 0.15s", zIndex: 2, transform: hovered ? "scale(1.1)" : "scale(1)" }}
            title={inWishlist ? "Remove from wishlist" : "Save to wishlist"}
          >
            {inWishlist ? "❤️" : "🤍"}
          </button>

          {/* Social badge */}
          {badge && (
            <span style={{ position: "absolute", top: "10px", right: "48px", background: badge.bg, color: "#fff", fontSize: "9px", fontWeight: 800, padding: "3px 8px", borderRadius: "999px", letterSpacing: "0.02em", whiteSpace: "nowrap" }}>
              {badge.label}
            </span>
          )}

          {/* Free ribbon */}
          {isFree && (
            <span style={{ position: "absolute", bottom: "10px", left: "10px", background: "#10b981", color: "#fff", fontSize: "10px", fontWeight: 800, padding: "4px 10px", borderRadius: "999px", letterSpacing: "0.03em" }}>
              FREE
            </span>
          )}

          {/* Quick view — shows on hover */}
          <button
            className="mp-quick-view"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onQuickView(item); }}
            style={{ position: "absolute", bottom: "10px", left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.78)", backdropFilter: "blur(4px)", color: "#fff", fontSize: "11px", fontWeight: 800, padding: "7px 18px", borderRadius: "999px", border: "none", cursor: "pointer", whiteSpace: "nowrap", opacity: 0, transition: "opacity 0.18s", letterSpacing: "0.02em" }}
          >
            Quick View
          </button>
        </div>

        {/* Card body */}
        <div style={{ padding: "14px 16px 16px", display: "flex", flexDirection: "column", flex: 1 }}>
          {/* Niche chip */}
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onNicheClick(item.niche.toLowerCase()); }}
            style={{ display: "inline-block", fontSize: "10px", color: "#f97316", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "5px", background: "rgba(249,115,22,0.08)", padding: "2px 8px", borderRadius: "999px", border: "1px solid rgba(249,115,22,0.2)", cursor: "pointer", lineHeight: 1.6 }}
          >
            {item.niche}
          </button>

          {/* Title */}
          <h3 style={{ margin: "0 0 6px", fontSize: "14px", fontWeight: 700, color: "#111827", lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: "38px" }}>
            {item.title}
          </h3>

          {/* Star rating — always reserve height so cards align */}
          <div style={{ minHeight: "24px", marginBottom: "8px" }}>
            {item.avgRating !== null && item.reviewCount > 0 && (
              <StarRow rating={item.avgRating} count={item.reviewCount} />
            )}
          </div>

          {/* Price + creator row — pinned to bottom */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
            <span style={{ fontSize: "17px", fontWeight: 800, color: isFree ? "#10b981" : "#111827", letterSpacing: "-0.02em" }}>
              {price}
              {item.salesCount !== null && item.salesCount > 0 && (
                <span style={{ fontSize: "10px", fontWeight: 600, color: "#9ca3af", marginLeft: "6px", letterSpacing: 0 }}>
                  {item.salesCount} sold
                </span>
              )}
            </span>

            {/* Creator avatar + name */}
            <Link
              href={`/marketplace/creator/${item.creatorUserId}`}
              onClick={(e) => e.stopPropagation()}
              style={{ display: "flex", alignItems: "center", gap: "6px", textDecoration: "none" }}
              className="mp-creator-link"
            >
              <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: bgColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", fontWeight: 800, color: "#fff", flexShrink: 0 }}>
                {initials}
              </div>
              <span style={{ fontSize: "11px", color: "#6b7280", fontWeight: 600, maxWidth: "90px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.creatorName}
              </span>
            </Link>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Horizontal scroll strip ──────────────────────────────────────────────────

function ProductStrip({
  title,
  icon,
  items,
  onWishlist,
  wishlist,
  onQuickView,
  onNicheClick,
}: {
  title: string;
  icon: React.ReactNode;
  items: MarketplaceItem[];
  onWishlist: (id: string, e: React.MouseEvent) => void;
  wishlist: Set<string>;
  onQuickView: (item: MarketplaceItem) => void;
  onNicheClick: (niche: string) => void;
}) {
  if (!items.length) return null;
  return (
    <div style={{ background: "#fff", borderBottom: "1px solid #f0f0f0", padding: "20px 0" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
          {icon}
          <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#111827" }}>{title}</h2>
        </div>
        <div style={{ display: "flex", gap: "14px", overflowX: "auto", paddingBottom: "8px", scrollbarWidth: "none" }}>
          {items.map((item) => (
            <div key={item.id} style={{ flexShrink: 0, width: "180px" }}>
              <ProductCard item={item} inWishlist={wishlist.has(item.id)} onWishlist={onWishlist} onQuickView={onQuickView} onNicheClick={onNicheClick} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MarketplaceClient() {
  const [data, setData]           = useState<ApiResponse | null>(null);
  const [loading, setLoading]     = useState(true);
  const [q, setQ]                 = useState("");
  const [niche, setNiche]         = useState("");
  const [format, setFormat]       = useState("");
  const [sort, setSort]           = useState<Sort>("trending");
  const [page, setPage]           = useState(1);
  const [inputValue, setInputValue] = useState("");
  const [quickView, setQuickView]   = useState<MarketplaceItem | null>(null);
  const [newItems, setNewItems]     = useState<MarketplaceItem[]>([]);
  const [minPrice, setMinPrice]     = useState("");
  const [maxPrice, setMaxPrice]     = useState("");
  const [minRating, setMinRating]   = useState("");
  const [wishlist, setWishlist]     = useState<Set<string>>(new Set());
  const [recentlyViewed, setRecentlyViewed] = useState<MarketplaceItem[]>([]);
  const [recommended, setRecommended]       = useState<MarketplaceItem[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);

  // Load wishlist + recently viewed from localStorage
  useEffect(() => {
    try {
      const w = JSON.parse(localStorage.getItem("cf_wishlist") ?? "[]") as string[];
      setWishlist(new Set(w));
    } catch { /* ignore */ }
    try {
      const rv = JSON.parse(localStorage.getItem("cf_recently_viewed") ?? "[]") as MarketplaceItem[];
      setRecentlyViewed(rv.slice(0, 8));
    } catch { /* ignore */ }
  }, []);

  const toggleWishlist = (itemId: string, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setWishlist((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      try { localStorage.setItem("cf_wishlist", JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  };

  // Track viewed items when quick view opens
  useEffect(() => {
    if (!quickView) return;
    setRecentlyViewed((prev) => {
      const next = [quickView, ...prev.filter((i) => i.id !== quickView.id)].slice(0, 8);
      try { localStorage.setItem("cf_recently_viewed", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, [quickView]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q)         params.set("q", q);
    if (niche)     params.set("niche", niche);
    if (format)    params.set("format", format);
    if (minPrice)  params.set("minPrice", minPrice);
    if (maxPrice)  params.set("maxPrice", maxPrice);
    if (minRating) params.set("minRating", minRating);
    params.set("sort", sort);
    params.set("page", String(page));
    const res = await fetch(`/api/marketplace?${params.toString()}`);
    if (res.ok) {
      const json = await res.json();
      setData(json);
      // Build "recommended for you" from niche history
      try {
        const rv = JSON.parse(localStorage.getItem("cf_recently_viewed") ?? "[]") as MarketplaceItem[];
        const topNiches = [...new Set(rv.map((i) => i.niche.toLowerCase()))].slice(0, 3);
        if (topNiches.length > 0) {
          const recs = (json.items as MarketplaceItem[])
            .filter((i) => topNiches.includes(i.niche.toLowerCase()) && !rv.some((r) => r.id === i.id))
            .slice(0, 8);
          setRecommended(recs);
        }
      } catch { /* ignore */ }
    }
    setLoading(false);
  }, [q, niche, format, sort, page, minPrice, maxPrice, minRating]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // Fetch "new this week" once
  useEffect(() => {
    fetch("/api/marketplace?sort=newest&newThisWeek=1&page=1")
      .then((r) => r.json())
      .then((d) => setNewItems(d.items?.slice(0, 10) ?? []))
      .catch(() => {});
  }, []);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => { setQ(inputValue); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [inputValue]);

  const clearFilters = () => { setNiche(""); setFormat(""); setInputValue(""); setQ(""); setMinPrice(""); setMaxPrice(""); setMinRating(""); setPage(1); };
  const hasFilters = !!(niche || format || q || minPrice || maxPrice || minRating);
  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>

      {/* ── Compact Hero ───────────────────────────────────────────────────────── */}
      <div style={{ background: "#0B0B0F", padding: "28px 24px 22px", textAlign: "center" }}>
        {/* Logo + wishlist row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "18px", position: "relative" }}>
          <a href="/">
            <img src="/logo.png" alt="Content Flywheel" style={{ height: "44px", objectFit: "contain" }} />
          </a>
          {wishlist.size > 0 && (
            <button
              title={`${wishlist.size} saved`}
              style={{ position: "absolute", right: 0, background: "rgba(244,63,94,0.15)", border: "1px solid rgba(244,63,94,0.3)", borderRadius: "999px", padding: "5px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px", color: "#f9a8d4", fontSize: "12px", fontWeight: 700 }}
            >
              ❤️ {wishlist.size}
            </button>
          )}
        </div>

        <h1 style={{ margin: "0 0 8px", fontSize: "clamp(22px,4vw,38px)", fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", lineHeight: 1.15 }}>
          Digital Product Marketplace
        </h1>
        <p style={{ margin: "0 0 20px", fontSize: "15px", color: "#6b7280" }}>
          Templates, guides, courses & more from independent creators
        </p>

        {/* Search */}
        <div style={{ maxWidth: "540px", margin: "0 auto 16px", position: "relative" }}>
          <Search style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", color: "#6b7280", width: "17px", height: "17px", pointerEvents: "none" }} />
          <input
            ref={searchRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Search products, niches, formats…"
            style={{ width: "100%", padding: "12px 44px 12px 48px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)", fontSize: "15px", background: "#1a1a22", color: "#fff", outline: "none", boxSizing: "border-box", transition: "border-color 0.15s" }}
            onFocus={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = "#f97316"; }}
            onBlur={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = "rgba(255,255,255,0.08)"; }}
          />
          {inputValue && (
            <button onClick={() => { setInputValue(""); setQ(""); }} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#6b7280", cursor: "pointer", padding: "4px", display: "flex", alignItems: "center" }}>
              <X style={{ width: "15px", height: "15px" }} />
            </button>
          )}
        </div>

        {/* Sort tabs + leaderboard inline */}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
          {SORT_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setSort(tab.id); setPage(1); }}
              style={{
                padding: "6px 14px", borderRadius: "100px", border: "none", cursor: "pointer",
                fontSize: "12px", fontWeight: 700, transition: "all 0.15s",
                background: sort === tab.id ? "#f97316" : "rgba(255,255,255,0.08)",
                color: sort === tab.id ? "#fff" : "#9ca3af",
                boxShadow: sort === tab.id ? "0 3px 10px rgba(249,115,22,0.35)" : "none",
              }}
            >
              {tab.emoji} {tab.label}
            </button>
          ))}
          <a href="/marketplace/leaderboard" style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "12px", fontWeight: 700, color: "#fbbf24", textDecoration: "none", background: "rgba(251,191,36,0.1)", padding: "6px 12px", borderRadius: "999px", border: "1px solid rgba(251,191,36,0.2)", marginLeft: "4px" }}>
            🏆 Top Sellers
          </a>
        </div>
      </div>

      {/* ── Filters bar ─────────────────────────────────────────────────────────── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "0 24px", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", gap: "12px", alignItems: "center", overflowX: "auto", padding: "10px 0", scrollbarWidth: "none" }}>
          <span style={{ fontSize: "12px", fontWeight: 700, color: "#6b7280", whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: "0.05em" }}>Filter</span>

          <select value={niche} onChange={(e) => { setNiche(e.target.value); setPage(1); }}
            style={{ padding: "6px 10px", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px", background: niche ? "#fff7ed" : "#fff", color: niche ? "#ea580c" : "#374151", cursor: "pointer", fontWeight: niche ? 700 : 400 }}>
            <option value="">All niches</option>
            {(data?.niches ?? []).map((n) => <option key={n} value={n.toLowerCase()}>{n}</option>)}
          </select>

          <select value={format} onChange={(e) => { setFormat(e.target.value); setPage(1); }}
            style={{ padding: "6px 10px", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px", background: format ? "#fff7ed" : "#fff", color: format ? "#ea580c" : "#374151", cursor: "pointer", fontWeight: format ? 700 : 400 }}>
            <option value="">All formats</option>
            {(data?.formats ?? []).map((f) => <option key={f} value={f.toLowerCase()}>{f}</option>)}
          </select>

          <div style={{ display: "flex", alignItems: "center", gap: "4px", whiteSpace: "nowrap" }}>
            <span style={{ fontSize: "12px", color: "#9ca3af", fontWeight: 600 }}>£</span>
            <input type="number" value={minPrice} onChange={(e) => { setMinPrice(e.target.value); setPage(1); }} placeholder="Min" min={0}
              style={{ width: "56px", padding: "6px 8px", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px", background: "#fff" }} />
            <span style={{ fontSize: "12px", color: "#d1d5db" }}>–</span>
            <input type="number" value={maxPrice} onChange={(e) => { setMaxPrice(e.target.value); setPage(1); }} placeholder="Max" min={0}
              style={{ width: "56px", padding: "6px 8px", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px", background: "#fff" }} />
          </div>

          <select value={minRating} onChange={(e) => { setMinRating(e.target.value); setPage(1); }}
            style={{ padding: "6px 10px", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px", background: minRating ? "#fff7ed" : "#fff", color: minRating ? "#ea580c" : "#374151", cursor: "pointer", fontWeight: minRating ? 700 : 400 }}>
            <option value="">All ratings</option>
            <option value="4">⭐ 4.0+</option>
            <option value="3">⭐ 3.0+</option>
          </select>

          {hasFilters && (
            <button onClick={clearFilters}
              style={{ padding: "6px 12px", borderRadius: "8px", border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontSize: "12px", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "4px" }}>
              <X style={{ width: "12px", height: "12px" }} /> Clear
            </button>
          )}

          {data && (
            <span style={{ marginLeft: "auto", fontSize: "12px", color: "#9ca3af", whiteSpace: "nowrap", fontWeight: 600 }}>
              {data.total.toLocaleString()} product{data.total !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* ── AI Recommended For You ───────────────────────────────────────────── */}
      {recommended.length > 0 && !hasFilters && (
        <div style={{ background: "linear-gradient(to right, #0f0f18, #1a0f2e)", borderBottom: "1px solid rgba(139,92,246,0.2)", padding: "20px 0" }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
              <Sparkles style={{ width: "16px", height: "16px", color: "#a78bfa" }} />
              <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#e9d5ff" }}>Recommended for you</h2>
              <span style={{ fontSize: "11px", color: "#7c3aed", background: "rgba(124,58,237,0.15)", padding: "2px 8px", borderRadius: "999px", fontWeight: 700 }}>AI picks</span>
            </div>
            <div style={{ display: "flex", gap: "14px", overflowX: "auto", paddingBottom: "8px", scrollbarWidth: "none" }}>
              {recommended.map((item) => (
                <div key={item.id} style={{ flexShrink: 0, width: "180px" }}>
                  <ProductCard item={item} inWishlist={wishlist.has(item.id)} onWishlist={toggleWishlist} onQuickView={setQuickView} onNicheClick={(n) => { setNiche(n); setPage(1); }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── New this week strip ──────────────────────────────────────────────── */}
      {newItems.length > 0 && !hasFilters && (
        <ProductStrip
          title="New this week"
          icon={<span style={{ fontSize: "16px" }}>🆕</span>}
          items={newItems}
          wishlist={wishlist}
          onWishlist={toggleWishlist}
          onQuickView={setQuickView}
          onNicheClick={(n) => { setNiche(n); setPage(1); }}
        />
      )}

      {/* ── Recently viewed strip ────────────────────────────────────────────── */}
      {recentlyViewed.length > 0 && !hasFilters && (
        <ProductStrip
          title="Recently viewed"
          icon={<span style={{ fontSize: "16px" }}>👁️</span>}
          items={recentlyViewed}
          wishlist={wishlist}
          onWishlist={toggleWishlist}
          onQuickView={setQuickView}
          onNicheClick={(n) => { setNiche(n); setPage(1); }}
        />
      )}

      {/* ── Product grid ────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "24px 24px 48px" }}>

        {loading ? (
          <div className="mp-grid">
            {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : data?.items.length === 0 ? (
          <div style={{ textAlign: "center", padding: "72px 24px" }}>
            <div style={{ fontSize: "64px", marginBottom: "16px", opacity: 0.6 }}>🔍</div>
            <h2 style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: 700, color: "#374151" }}>No products found</h2>
            <p style={{ color: "#9ca3af", fontSize: "15px", marginBottom: "20px", maxWidth: "320px", margin: "0 auto 24px" }}>
              {q ? `No results for "${q}". Try different keywords.` : "No products match your current filters."}
            </p>
            {hasFilters && (
              <button onClick={clearFilters}
                style={{ padding: "10px 24px", borderRadius: "12px", background: "#f97316", color: "#fff", fontSize: "14px", fontWeight: 700, border: "none", cursor: "pointer", boxShadow: "0 4px 14px rgba(249,115,22,0.35)" }}>
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="mp-grid">
              {data?.items.map((item) => (
                <ProductCard
                  key={item.id}
                  item={item}
                  inWishlist={wishlist.has(item.id)}
                  onWishlist={toggleWishlist}
                  onQuickView={setQuickView}
                  onNicheClick={(n) => { setNiche(n); setPage(1); }}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "6px", marginTop: "40px" }}>
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  style={{ padding: "8px 18px", borderRadius: "10px", border: "1px solid #e5e7eb", background: page === 1 ? "#f9fafb" : "#fff", color: page === 1 ? "#d1d5db" : "#374151", fontWeight: 700, fontSize: "13px", cursor: page === 1 ? "default" : "pointer", transition: "all 0.15s" }}>
                  ← Prev
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                  return p <= totalPages ? (
                    <button key={p} onClick={() => setPage(p)}
                      style={{ width: "36px", height: "36px", borderRadius: "10px", border: "1px solid", borderColor: p === page ? "#f97316" : "#e5e7eb", background: p === page ? "#f97316" : "#fff", color: p === page ? "#fff" : "#374151", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>
                      {p}
                    </button>
                  ) : null;
                })}
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  style={{ padding: "8px 18px", borderRadius: "10px", border: "1px solid #e5e7eb", background: page === totalPages ? "#f9fafb" : "#fff", color: page === totalPages ? "#d1d5db" : "#374151", fontWeight: 700, fontSize: "13px", cursor: page === totalPages ? "default" : "pointer", transition: "all 0.15s" }}>
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div style={{ textAlign: "center", padding: "28px 24px", borderTop: "1px solid #e5e7eb" }}>
        <p style={{ margin: 0, fontSize: "13px", color: "#9ca3af" }}>
          Powered by <a href="/" style={{ color: "#f97316", fontWeight: 700, textDecoration: "none" }}>Content Flywheel</a>
          {" · "}
          <a href="/pricing" style={{ color: "#9ca3af", textDecoration: "none" }}>Sell your own products</a>
        </p>
      </div>

      {/* ── Quick-view panel ─────────────────────────────────────────────────── */}
      {quickView && (
        <div onClick={() => setQuickView(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "stretch", justifyContent: "flex-end", backdropFilter: "blur(2px)" }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: "460px", background: "#fff", overflowY: "auto", boxShadow: "-8px 0 48px rgba(0,0,0,0.2)", display: "flex", flexDirection: "column", animation: "slideInRight 0.22s cubic-bezier(.4,0,.2,1)" }}>

            {/* Modal header */}
            <div style={{ position: "sticky", top: 0, background: "#fff", borderBottom: "1px solid #f3f4f6", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 10 }}>
              <span style={{ fontSize: "11px", fontWeight: 800, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em" }}>Quick View</span>
              <button onClick={() => setQuickView(null)} style={{ background: "#f3f4f6", border: "none", borderRadius: "50%", width: "28px", height: "28px", fontSize: "16px", color: "#6b7280", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
            </div>

            {/* Thumbnail */}
            <div style={{ aspectRatio: "4/3", background: "linear-gradient(135deg,#f97316 0%,#ea580c 100%)", flexShrink: 0, overflow: "hidden", position: "relative" }}>
              {quickView.thumbnailUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={quickView.thumbnailUrl} alt={quickView.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}><ShoppingBag style={{ width: "52px", height: "52px", color: "rgba(255,255,255,0.5)" }} /></div>
              }
              {quickView.nativePrice === 0 && (
                <span style={{ position: "absolute", top: "12px", left: "12px", background: "#10b981", color: "#fff", fontSize: "11px", fontWeight: 800, padding: "4px 12px", borderRadius: "999px" }}>FREE</span>
              )}
            </div>

            {/* Content */}
            <div style={{ padding: "24px", flex: 1 }}>
              <span style={{ fontSize: "10px", color: "#f97316", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", background: "rgba(249,115,22,0.08)", padding: "3px 8px", borderRadius: "999px", border: "1px solid rgba(249,115,22,0.2)" }}>
                {quickView.niche} · {quickView.format}
              </span>
              <h2 style={{ margin: "12px 0 10px", fontSize: "20px", fontWeight: 800, color: "#111827", lineHeight: 1.25 }}>{quickView.title}</h2>

              {quickView.avgRating !== null && quickView.reviewCount > 0 && (
                <div style={{ marginBottom: "14px" }}>
                  <StarRow rating={quickView.avgRating} count={quickView.reviewCount} size={15} />
                </div>
              )}

              {quickView.description && (
                <p style={{ margin: "0 0 20px", fontSize: "14px", color: "#4b5563", lineHeight: 1.7 }}>{quickView.description}</p>
              )}

              {/* Creator row */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px", padding: "12px", background: "#f9fafb", borderRadius: "12px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: avatarColor(quickView.creatorUserId), display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 800, color: "#fff", flexShrink: 0 }}>
                  {creatorInitials(quickView.creatorName)}
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "#111827" }}>{quickView.creatorName}</p>
                  {quickView.salesCount !== null && quickView.salesCount > 0 && (
                    <p style={{ margin: 0, fontSize: "11px", color: "#9ca3af" }}>{quickView.salesCount} sales</p>
                  )}
                </div>
                <Link href={`/marketplace/creator/${quickView.creatorUserId}`} style={{ marginLeft: "auto", fontSize: "12px", color: "#f97316", fontWeight: 700, textDecoration: "none", background: "rgba(249,115,22,0.08)", padding: "4px 12px", borderRadius: "999px", border: "1px solid rgba(249,115,22,0.2)" }}>
                  View profile →
                </Link>
              </div>

              <div style={{ fontSize: "30px", fontWeight: 900, color: quickView.nativePrice === 0 ? "#10b981" : "#111827", marginBottom: "20px", letterSpacing: "-0.03em" }}>
                {priceDisplay(quickView)}
              </div>

              <a href={`/product/${quickView.id}`}
                style={{ display: "block", width: "100%", padding: "14px", borderRadius: "14px", background: "linear-gradient(135deg,#f97316,#ea580c)", color: "#fff", fontSize: "15px", fontWeight: 800, textAlign: "center", textDecoration: "none", boxShadow: "0 4px 18px rgba(249,115,22,0.4)", boxSizing: "border-box", letterSpacing: "0.01em" }}>
                {quickView.nativePrice === 0 ? "Get for Free →" : "Buy Now →"}
              </a>
              <a href={`/product/${quickView.id}`}
                style={{ display: "block", textAlign: "center", marginTop: "12px", fontSize: "12px", color: "#9ca3af", textDecoration: "none" }}>
                View full product page →
              </a>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .mp-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 18px;
          align-items: stretch;
        }
        @media (max-width: 640px) {
          .mp-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
        }
        @media (max-width: 400px) {
          .mp-grid { grid-template-columns: 1fr; }
        }
        .mp-card-link:hover .mp-quick-view { opacity: 1 !important; }
        .mp-creator-link:hover span { color: #f97316 !important; }
        ::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
