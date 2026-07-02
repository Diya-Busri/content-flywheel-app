"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Search, ShoppingBag } from "lucide-react";

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
  salesCount: number | null; // null = creator opted out of showing sales count
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
  { id: "trending",     label: "Trending",     emoji: "🔥" },
  { id: "best-sellers", label: "Best Sellers",  emoji: "⭐" },
  { id: "newest",       label: "New",           emoji: "🆕" },
  { id: "price-asc",   label: "Price: Low",    emoji: "💸" },
  { id: "price-desc",  label: "Price: High",   emoji: "💰" },
  { id: "free",        label: "Free",           emoji: "🎁" },
];

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

  // Load wishlist from localStorage on mount
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("cf_wishlist") ?? "[]") as string[];
      setWishlist(new Set(saved));
    } catch { /* ignore */ }
  }, []);

  const toggleWishlist = (itemId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setWishlist((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      try { localStorage.setItem("cf_wishlist", JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  };

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
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [q, niche, format, sort, page, minPrice, maxPrice, minRating]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // Fetch "new this week" strip once on mount
  useEffect(() => {
    fetch("/api/marketplace?sort=newest&newThisWeek=1&page=1")
      .then((r) => r.json())
      .then((d) => setNewItems(d.items ?? []))
      .catch(() => {});
  }, []);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => { setQ(inputValue); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [inputValue]);

  const priceDisplay = (item: MarketplaceItem) => {
    if (item.nativePrice === 0) return "Free";
    if (item.nativePrice != null) return `£${(item.nativePrice / 100).toFixed(2)}`;
    if (item.priceLabel) return item.priceLabel;
    return "";
  };

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  const cardBadge = (item: MarketplaceItem): { label: string; color: string } | null => {
    if (item.featured)                                   return { label: "⭐ Featured",     color: "#7c3aed" };
    if (item.trendingCount > 0)                          return { label: "🔥 Trending",    color: "#ef4444" };
    if (item.salesCount !== null && item.salesCount > 4) return { label: "⭐ Best Seller", color: "#f59e0b" };
    if (item.salesCount !== null && item.salesCount > 0) return { label: "✅ Sold",         color: "#10b981" };
    return null;
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
      {/* Hero header */}
      <div style={{ background: "#0B0B0F", padding: "64px 24px 48px", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "32px", position: "relative" }}>
          <a href="/">
            <img src="/logo.png" alt="Content Flywheel" style={{ height: "56px", objectFit: "contain" }} />
          </a>
          {wishlist.size > 0 && (
            <button
              onClick={() => setSort("trending")}
              title={`${wishlist.size} saved product${wishlist.size !== 1 ? "s" : ""}`}
              style={{ position: "absolute", right: "-48px", top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "999px", padding: "6px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px", color: "#f9a8d4", fontSize: "13px", fontWeight: 700 }}
            >
              ❤️ {wishlist.size}
            </button>
          )}
        </div>
        <h1 style={{ margin: "0 0 12px", fontSize: "clamp(28px,5vw,48px)", fontWeight: 800, color: "#fff", letterSpacing: "-0.03em" }}>
          Digital Product Marketplace
        </h1>
        <p style={{ margin: "0 0 32px", fontSize: "18px", color: "#9ca3af" }}>
          Discover templates, guides, courses and more from independent creators
        </p>

        {/* Search */}
        <div style={{ maxWidth: "560px", margin: "0 auto", position: "relative" }}>
          <Search style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", color: "#9ca3af", width: "18px", height: "18px" }} />
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Search products, niches, formats…"
            style={{ width: "100%", padding: "14px 16px 14px 48px", borderRadius: "12px", border: "none", fontSize: "16px", background: "#1e1e24", color: "#fff", outline: "none", boxSizing: "border-box" }}
          />
        </div>

        {/* Leaderboard link */}
        <div style={{ marginBottom: "12px" }}>
          <a href="/marketplace/leaderboard" style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 700, color: "#fbbf24", textDecoration: "none", background: "rgba(251,191,36,0.12)", padding: "6px 14px", borderRadius: "999px", border: "1px solid rgba(251,191,36,0.25)" }}>
            🏆 Top Sellers This Month →
          </a>
        </div>

        {/* Sort tabs */}
        <div style={{ display: "flex", justifyContent: "center", gap: "8px", flexWrap: "wrap", marginTop: "12px" }}>
          {SORT_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setSort(tab.id); setPage(1); }}
              style={{
                padding: "8px 18px", borderRadius: "100px", border: "none", cursor: "pointer",
                fontSize: "13px", fontWeight: 700, transition: "all 0.15s",
                background: sort === tab.id ? "#f97316" : "rgba(255,255,255,0.1)",
                color: sort === tab.id ? "#fff" : "#9ca3af",
                boxShadow: sort === tab.id ? "0 4px 14px rgba(249,115,22,0.4)" : "none",
              }}
            >
              {tab.emoji} {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filters bar */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "0 24px" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", gap: "16px", alignItems: "center", overflowX: "auto", padding: "12px 0" }}>
          <span style={{ fontSize: "13px", fontWeight: 600, color: "#6b7280", whiteSpace: "nowrap" }}>Filter:</span>
          <select value={niche} onChange={(e) => { setNiche(e.target.value); setPage(1); }}
            style={{ padding: "7px 12px", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px", background: "#fff", color: "#374151", cursor: "pointer" }}>
            <option value="">All niches</option>
            {(data?.niches ?? []).map((n) => <option key={n} value={n.toLowerCase()}>{n}</option>)}
          </select>
          <select value={format} onChange={(e) => { setFormat(e.target.value); setPage(1); }}
            style={{ padding: "7px 12px", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px", background: "#fff", color: "#374151", cursor: "pointer" }}>
            <option value="">All formats</option>
            {(data?.formats ?? []).map((f) => <option key={f} value={f.toLowerCase()}>{f}</option>)}
          </select>
          {/* Price range */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px", whiteSpace: "nowrap" }}>
            <span style={{ fontSize: "13px", color: "#6b7280" }}>£</span>
            <input
              type="number"
              value={minPrice}
              onChange={(e) => { setMinPrice(e.target.value); setPage(1); }}
              placeholder="Min"
              min={0}
              style={{ width: "60px", padding: "7px 8px", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px", background: "#fff", color: "#374151" }}
            />
            <span style={{ fontSize: "13px", color: "#6b7280" }}>–</span>
            <input
              type="number"
              value={maxPrice}
              onChange={(e) => { setMaxPrice(e.target.value); setPage(1); }}
              placeholder="Max"
              min={0}
              style={{ width: "60px", padding: "7px 8px", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px", background: "#fff", color: "#374151" }}
            />
          </div>

          {/* Min rating */}
          <select value={minRating} onChange={(e) => { setMinRating(e.target.value); setPage(1); }}
            style={{ padding: "7px 12px", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px", background: "#fff", color: "#374151", cursor: "pointer" }}>
            <option value="">All ratings</option>
            <option value="4">⭐ 4.0+</option>
            <option value="3">⭐ 3.0+</option>
          </select>

          {(niche || format || q || minPrice || maxPrice || minRating) && (
            <button onClick={() => { setNiche(""); setFormat(""); setInputValue(""); setQ(""); setMinPrice(""); setMaxPrice(""); setMinRating(""); setPage(1); }}
              style={{ padding: "7px 12px", borderRadius: "8px", border: "1px solid #fee2e2", background: "#fef2f2", color: "#dc2626", fontSize: "13px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
              Clear filters
            </button>
          )}
          {data && (
            <span style={{ marginLeft: "auto", fontSize: "13px", color: "#9ca3af", whiteSpace: "nowrap" }}>
              {data.total} {data.total === 1 ? "product" : "products"}
            </span>
          )}
        </div>
      </div>

      {/* New this week strip */}
      {newItems.length > 0 && (
        <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "20px 0" }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
              <span style={{ fontSize: "18px" }}>🆕</span>
              <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#111827" }}>New this week</h2>
              <span style={{ fontSize: "12px", color: "#9ca3af", marginLeft: "4px" }}>({newItems.length})</span>
            </div>
            <div style={{ display: "flex", gap: "14px", overflowX: "auto", paddingBottom: "6px" }}>
              {newItems.map((item) => (
                <Link key={item.id} href={`/product/${item.id}`} className="marketplace-card-link" style={{ textDecoration: "none", flexShrink: 0, width: "160px" }}>
                  <div style={{ borderRadius: "12px", border: "1px solid #e5e7eb", overflow: "hidden", background: "#fff", transition: "box-shadow 0.2s", cursor: "pointer" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.10)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}
                  >
                    <div style={{ aspectRatio: "4/3", background: "linear-gradient(135deg,#f97316 0%,#ea580c 100%)", position: "relative", overflow: "hidden" }}>
                      {item.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.thumbnailUrl} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                          <span style={{ fontSize: "28px" }}>📦</span>
                        </div>
                      )}
                      <button
                        className="quick-view-btn"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setQuickView(item); }}
                        style={{ position: "absolute", bottom: "6px", left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.75)", color: "#fff", fontSize: "10px", fontWeight: 700, padding: "4px 10px", borderRadius: "999px", border: "none", cursor: "pointer", whiteSpace: "nowrap", opacity: 0, transition: "opacity 0.15s" }}
                      >
                        Quick view
                      </button>
                    </div>
                    <div style={{ padding: "10px" }}>
                      <p style={{ margin: "0 0 2px", fontSize: "9px", color: "#f97316", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{item.niche}</p>
                      <p style={{ margin: 0, fontSize: "12px", fontWeight: 700, color: "#111827", lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.title}</p>
                      <p style={{ margin: "6px 0 0", fontSize: "13px", fontWeight: 800, color: item.nativePrice === 0 ? "#10b981" : "#111827" }}>
                        {item.nativePrice === 0 ? "Free" : item.nativePrice != null ? `£${(item.nativePrice / 100).toFixed(2)}` : item.priceLabel ?? ""}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Product grid */}
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 24px" }}>
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: "20px" }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} style={{ borderRadius: "16px", background: "#e5e7eb", height: "280px", animation: "pulse 1.5s ease-in-out infinite" }} />
            ))}
          </div>
        ) : data?.items.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 24px" }}>
            <ShoppingBag style={{ width: "48px", height: "48px", color: "#d1d5db", margin: "0 auto 16px" }} />
            <h2 style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: 700, color: "#374151" }}>No products found</h2>
            <p style={{ color: "#9ca3af", fontSize: "15px" }}>Try adjusting your search or filters</p>
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: "20px" }}>
              {data?.items.map((item) => {
                const badge = cardBadge(item);
                const price = priceDisplay(item);
                const isFree = item.nativePrice === 0;
                return (
                  <Link key={item.id} href={`/product/${item.id}`} style={{ textDecoration: "none" }} className="marketplace-card-link">
                    <div style={{ borderRadius: "16px", background: "#fff", border: "1px solid #e5e7eb", overflow: "hidden", transition: "box-shadow 0.2s, transform 0.2s", cursor: "pointer" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 32px rgba(0,0,0,0.12)"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; (e.currentTarget as HTMLDivElement).style.transform = "none"; }}
                    >
                      {/* Thumbnail */}
                      <div style={{ aspectRatio: "4/3", background: "linear-gradient(135deg,#f97316 0%,#ea580c 100%)", position: "relative", overflow: "hidden" }}>
                        {item.thumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.thumbnailUrl} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                            <span style={{ fontSize: "48px" }}>📦</span>
                          </div>
                        )}
                        {/* Format badge */}
                        <span style={{ position: "absolute", top: "10px", left: "10px", background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: "10px", fontWeight: 700, padding: "3px 8px", borderRadius: "999px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                          {item.format}
                        </span>
                        {/* Social proof badge */}
                        {badge && (
                          <span style={{ position: "absolute", top: "10px", right: "44px", background: badge.color, color: "#fff", fontSize: "10px", fontWeight: 700, padding: "3px 8px", borderRadius: "999px" }}>
                            {badge.label}
                          </span>
                        )}
                        {/* Wishlist heart */}
                        <button
                          onClick={(e) => toggleWishlist(item.id, e)}
                          style={{ position: "absolute", top: "8px", right: "8px", background: wishlist.has(item.id) ? "rgba(244,63,94,0.9)" : "rgba(0,0,0,0.45)", border: "none", borderRadius: "50%", width: "30px", height: "30px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", transition: "background 0.15s", zIndex: 2 }}
                          title={wishlist.has(item.id) ? "Remove from wishlist" : "Save to wishlist"}
                        >
                          {wishlist.has(item.id) ? "❤️" : "🤍"}
                        </button>
                        {/* Free ribbon */}
                        {isFree && (
                          <span style={{ position: "absolute", bottom: "10px", right: "10px", background: "#10b981", color: "#fff", fontSize: "11px", fontWeight: 800, padding: "4px 10px", borderRadius: "999px" }}>
                            FREE
                          </span>
                        )}
                        {/* Quick view button (shows on hover via CSS class) */}
                        <button
                          className="quick-view-btn"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setQuickView(item); }}
                          style={{ position: "absolute", bottom: "10px", left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.75)", color: "#fff", fontSize: "12px", fontWeight: 700, padding: "6px 16px", borderRadius: "999px", border: "none", cursor: "pointer", whiteSpace: "nowrap", opacity: 0, transition: "opacity 0.15s" }}
                        >
                          Quick view
                        </button>
                      </div>

                      {/* Card body */}
                      <div style={{ padding: "16px" }}>
                        <p
                          style={{ margin: "0 0 4px", fontSize: "11px", color: "#f97316", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", cursor: "pointer", display: "inline-block" }}
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setNiche(item.niche.toLowerCase()); setPage(1); }}
                          title={`Browse all ${item.niche} products`}
                        >
                          {item.niche}
                        </p>
                        <h3 style={{ margin: "0 0 8px", fontSize: "15px", fontWeight: 700, color: "#111827", lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {item.title}
                        </h3>
                        {item.description && (
                          <p style={{ margin: "0 0 12px", fontSize: "13px", color: "#6b7280", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                            {item.description}
                          </p>
                        )}
                        {/* Star rating */}
                        {item.avgRating !== null && item.reviewCount > 0 && (
                          <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "10px" }}>
                            <span style={{ color: "#f59e0b", fontSize: "13px", letterSpacing: "-1px" }}>
                              {"★".repeat(Math.round(item.avgRating))}{"☆".repeat(5 - Math.round(item.avgRating))}
                            </span>
                            <span style={{ fontSize: "12px", color: "#6b7280", fontWeight: 600 }}>{item.avgRating.toFixed(1)}</span>
                            <span style={{ fontSize: "11px", color: "#9ca3af" }}>({item.reviewCount})</span>
                          </div>
                        )}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: "16px", fontWeight: 800, color: isFree ? "#10b981" : "#111827" }}>{price}</span>
                          <div style={{ textAlign: "right" }}>
                            <a
                              href={`/c/${item.creatorUserId}`}
                              onClick={(e) => e.stopPropagation()}
                              style={{ display: "block", fontSize: "12px", color: "#9ca3af", textDecoration: "none" }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#f97316"; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#9ca3af"; }}
                            >
                              by {item.creatorName}
                            </a>
                            {item.salesCount !== null && item.salesCount > 0 && (
                              <span style={{ display: "block", fontSize: "11px", color: "#6b7280", fontWeight: 600 }}>
                                {item.salesCount} sale{item.salesCount !== 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "40px" }}>
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #e5e7eb", background: page === 1 ? "#f9fafb" : "#fff", color: page === 1 ? "#9ca3af" : "#374151", fontWeight: 600, fontSize: "14px", cursor: page === 1 ? "default" : "pointer" }}>
                  ← Prev
                </button>
                <span style={{ padding: "8px 16px", fontSize: "14px", color: "#6b7280" }}>{page} / {totalPages}</span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #e5e7eb", background: page === totalPages ? "#f9fafb" : "#fff", color: page === totalPages ? "#9ca3af" : "#374151", fontWeight: 600, fontSize: "14px", cursor: page === totalPages ? "default" : "pointer" }}>
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div style={{ textAlign: "center", padding: "32px 24px", borderTop: "1px solid #e5e7eb", marginTop: "40px" }}>
        <p style={{ margin: 0, fontSize: "13px", color: "#9ca3af" }}>
          Powered by <a href="/" style={{ color: "#f97316", fontWeight: 600, textDecoration: "none" }}>Content Flywheel</a> · <a href="/pricing" style={{ color: "#9ca3af", textDecoration: "none" }}>Sell your own digital products</a>
        </p>
      </div>

      {/* Quick-view modal */}
      {quickView && (
        <div
          onClick={() => setQuickView(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "flex-end" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: "480px", height: "100vh", background: "#fff", overflowY: "auto", boxShadow: "-8px 0 40px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column" }}
          >
            {/* Modal header */}
            <div style={{ position: "sticky", top: 0, background: "#fff", borderBottom: "1px solid #f3f4f6", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 10 }}>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>Quick View</span>
              <button onClick={() => setQuickView(null)} style={{ background: "none", border: "none", fontSize: "22px", color: "#6b7280", cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>

            {/* Thumbnail */}
            <div style={{ aspectRatio: "4/3", background: "linear-gradient(135deg,#f97316 0%,#ea580c 100%)", position: "relative", flexShrink: 0 }}>
              {quickView.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={quickView.thumbnailUrl} alt={quickView.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                  <span style={{ fontSize: "72px" }}>📦</span>
                </div>
              )}
            </div>

            {/* Content */}
            <div style={{ padding: "24px", flex: 1 }}>
              <p style={{ margin: "0 0 6px", fontSize: "11px", color: "#f97316", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {quickView.niche} · {quickView.format}
              </p>
              <h2 style={{ margin: "0 0 12px", fontSize: "22px", fontWeight: 800, color: "#111827", lineHeight: 1.25 }}>{quickView.title}</h2>

              {/* Star rating */}
              {quickView.avgRating !== null && quickView.reviewCount > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "16px" }}>
                  <span style={{ color: "#f59e0b", fontSize: "16px", letterSpacing: "-1px" }}>
                    {"★".repeat(Math.round(quickView.avgRating))}{"☆".repeat(5 - Math.round(quickView.avgRating))}
                  </span>
                  <span style={{ fontSize: "14px", color: "#374151", fontWeight: 700 }}>{quickView.avgRating.toFixed(1)}</span>
                  <span style={{ fontSize: "13px", color: "#9ca3af" }}>({quickView.reviewCount} review{quickView.reviewCount !== 1 ? "s" : ""})</span>
                </div>
              )}

              {quickView.description && (
                <p style={{ margin: "0 0 24px", fontSize: "15px", color: "#4b5563", lineHeight: 1.7 }}>{quickView.description}</p>
              )}

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ fontSize: "13px", color: "#9ca3af" }}>by {quickView.creatorName}</span>
                {quickView.salesCount !== null && quickView.salesCount > 0 && (
                  <span style={{ fontSize: "12px", color: "#6b7280", fontWeight: 600 }}>{quickView.salesCount} sales</span>
                )}
              </div>

              <div style={{ fontSize: "28px", fontWeight: 800, color: quickView.nativePrice === 0 ? "#10b981" : "#111827", marginBottom: "24px" }}>
                {priceDisplay(quickView)}
              </div>

              <a
                href={`/product/${quickView.id}`}
                style={{ display: "block", width: "100%", padding: "14px", borderRadius: "12px", background: "#f97316", color: "#fff", fontSize: "16px", fontWeight: 800, textAlign: "center", textDecoration: "none", boxShadow: "0 4px 14px rgba(249,115,22,0.4)", boxSizing: "border-box" }}
              >
                {quickView.nativePrice === 0 ? "Get for Free →" : "Buy Now →"}
              </a>
              <a
                href={`/product/${quickView.id}`}
                style={{ display: "block", textAlign: "center", marginTop: "12px", fontSize: "13px", color: "#9ca3af", textDecoration: "none" }}
              >
                View full product page →
              </a>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .marketplace-card-link:hover .quick-view-btn { opacity: 1 !important; }
      `}</style>
    </div>
  );
}
