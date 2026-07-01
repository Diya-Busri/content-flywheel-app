"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
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
};

type ApiResponse = {
  items: MarketplaceItem[];
  total: number;
  page: number;
  pageSize: number;
  niches: string[];
  formats: string[];
};

export default function MarketplaceClient() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [niche, setNiche] = useState("");
  const [format, setFormat] = useState("");
  const [page, setPage] = useState(1);
  const [inputValue, setInputValue] = useState("");

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (niche) params.set("niche", niche);
    if (format) params.set("format", format);
    params.set("page", String(page));
    const res = await fetch(`/api/marketplace?${params.toString()}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [q, niche, format, page]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => { setQ(inputValue); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [inputValue]);

  const priceDisplay = (item: MarketplaceItem) => {
    if (item.priceLabel) return item.priceLabel;
    if (item.nativePrice != null) return item.nativePrice === 0 ? "Free" : `£${(item.nativePrice / 100).toFixed(2)}`;
    return "";
  };

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
      {/* Hero header */}
      <div style={{ background: "#0B0B0F", padding: "64px 24px 48px", textAlign: "center" }}>
        <a href="/" style={{ display: "inline-block", marginBottom: "32px" }}>
          <img src="/logo.png" alt="Content Flywheel" style={{ height: "36px", objectFit: "contain" }} />
        </a>
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
      </div>

      {/* Filters bar */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "0 24px" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", gap: "16px", alignItems: "center", overflowX: "auto", padding: "12px 0" }}>
          <span style={{ fontSize: "13px", fontWeight: 600, color: "#6b7280", whiteSpace: "nowrap" }}>Filter:</span>
          <select
            value={niche}
            onChange={(e) => { setNiche(e.target.value); setPage(1); }}
            style={{ padding: "7px 12px", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px", background: "#fff", color: "#374151", cursor: "pointer" }}
          >
            <option value="">All niches</option>
            {(data?.niches ?? []).map((n) => (
              <option key={n} value={n.toLowerCase()}>{n}</option>
            ))}
          </select>
          <select
            value={format}
            onChange={(e) => { setFormat(e.target.value); setPage(1); }}
            style={{ padding: "7px 12px", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px", background: "#fff", color: "#374151", cursor: "pointer" }}
          >
            <option value="">All formats</option>
            {(data?.formats ?? []).map((f) => (
              <option key={f} value={f.toLowerCase()}>{f}</option>
            ))}
          </select>
          {(niche || format || q) && (
            <button
              onClick={() => { setNiche(""); setFormat(""); setInputValue(""); setQ(""); setPage(1); }}
              style={{ padding: "7px 12px", borderRadius: "8px", border: "1px solid #fee2e2", background: "#fef2f2", color: "#dc2626", fontSize: "13px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
            >
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
              {data?.items.map((item) => (
                <Link key={item.id} href={`/product/${item.id}`} style={{ textDecoration: "none" }}>
                  <div style={{
                    borderRadius: "16px", background: "#fff", border: "1px solid #e5e7eb",
                    overflow: "hidden", transition: "box-shadow 0.2s, transform 0.2s", cursor: "pointer",
                  }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 32px rgba(0,0,0,0.12)"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; (e.currentTarget as HTMLDivElement).style.transform = "none"; }}
                  >
                    {/* Thumbnail */}
                    <div style={{ aspectRatio: "4/3", background: "linear-gradient(135deg,#f97316 0%,#ea580c 100%)", position: "relative", overflow: "hidden" }}>
                      {item.thumbnailUrl ? (
                        <Image src={item.thumbnailUrl} alt={item.title} fill style={{ objectFit: "cover" }} sizes="280px" />
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                          <span style={{ fontSize: "48px" }}>📦</span>
                        </div>
                      )}
                      {/* Format badge */}
                      <span style={{ position: "absolute", top: "10px", left: "10px", background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: "10px", fontWeight: 700, padding: "3px 8px", borderRadius: "999px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        {item.format}
                      </span>
                    </div>

                    {/* Card body */}
                    <div style={{ padding: "16px" }}>
                      <p style={{ margin: "0 0 4px", fontSize: "11px", color: "#f97316", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{item.niche}</p>
                      <h3 style={{ margin: "0 0 8px", fontSize: "15px", fontWeight: 700, color: "#111827", lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {item.title}
                      </h3>
                      {item.description && (
                        <p style={{ margin: "0 0 12px", fontSize: "13px", color: "#6b7280", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {item.description}
                        </p>
                      )}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "16px", fontWeight: 800, color: "#111827" }}>{priceDisplay(item)}</span>
                        <span style={{ fontSize: "12px", color: "#9ca3af" }}>by {item.creatorName}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "40px" }}>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #e5e7eb", background: page === 1 ? "#f9fafb" : "#fff", color: page === 1 ? "#9ca3af" : "#374151", fontWeight: 600, fontSize: "14px", cursor: page === 1 ? "default" : "pointer" }}
                >
                  ← Prev
                </button>
                <span style={{ padding: "8px 16px", fontSize: "14px", color: "#6b7280" }}>
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #e5e7eb", background: page === totalPages ? "#f9fafb" : "#fff", color: page === totalPages ? "#9ca3af" : "#374151", fontWeight: 600, fontSize: "14px", cursor: page === totalPages ? "default" : "pointer" }}
                >
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

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
