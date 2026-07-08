"use client";

import Link from "next/link";
import { ArrowLeft, ShoppingBag } from "lucide-react";

type Product = {
  id: string;
  title: string;
  niche: string;
  format: string;
  nativePrice: number | null;
  priceLabel: string | null;
  thumbnailUrl: string | null;
  description: string;
  salesCount: number | null;
  avgRating: number | null;
  reviewCount: number;
};

type Props = {
  creatorName: string;
  bio: string | null;
  profileImageUrl: string | null;
  totalSales: number | null;
  userId: string;
  products: Product[];
};

function priceDisplay(p: Product) {
  if (p.nativePrice === 0) return "Free";
  if (p.nativePrice != null) return `£${(p.nativePrice / 100).toFixed(2)}`;
  if (p.priceLabel) return p.priceLabel;
  return "";
}

export default function CreatorMarketplaceClient({ creatorName, bio, profileImageUrl, totalSales, userId, products }: Props) {
  const initials = creatorName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#0B0B0F", padding: "40px 24px 48px" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          {/* Back link */}
          <Link href="/marketplace" style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "#9ca3af", textDecoration: "none", fontSize: "13px", fontWeight: 600, marginBottom: "32px" }}>
            <ArrowLeft size={14} /> Back to Marketplace
          </Link>

          <div style={{ display: "flex", alignItems: "center", gap: "24px", flexWrap: "wrap" }}>
            {/* Avatar */}
            <div style={{ width: "80px", height: "80px", borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: "3px solid rgba(255,255,255,0.15)" }}>
              {profileImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profileImageUrl} alt={creatorName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#f97316,#ea580c)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", fontWeight: 800, color: "#fff" }}>
                  {initials}
                </div>
              )}
            </div>

            <div>
              <h1 style={{ margin: "0 0 6px", fontSize: "28px", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>{creatorName}</h1>
              {bio && <p style={{ margin: "0 0 10px", fontSize: "15px", color: "#9ca3af", maxWidth: "480px" }}>{bio}</p>}
              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "13px", color: "#6b7280" }}>
                  <strong style={{ color: "#e5e7eb" }}>{products.length}</strong> product{products.length !== 1 ? "s" : ""}
                </span>
                {totalSales !== null && totalSales > 0 && (
                  <span style={{ fontSize: "13px", color: "#6b7280" }}>
                    <strong style={{ color: "#e5e7eb" }}>{totalSales}</strong> total sales
                  </span>
                )}
                <a href={`/c/${userId}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: "13px", color: "#f97316", fontWeight: 600, textDecoration: "none" }}>
                  Visit store →
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Products */}
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 24px" }}>
        {products.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 24px" }}>
            <ShoppingBag style={{ width: "48px", height: "48px", color: "#d1d5db", margin: "0 auto 16px" }} />
            <h2 style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: 700, color: "#374151" }}>No published products yet</h2>
            <p style={{ color: "#9ca3af", fontSize: "15px" }}>Check back soon.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: "20px" }}>
            {products.map((item) => {
              const price = priceDisplay(item);
              const isFree = item.nativePrice === 0;
              return (
                <Link key={item.id} href={`/product/${item.id}`} style={{ textDecoration: "none" }}>
                  <div style={{ borderRadius: "16px", background: "#fff", border: "1px solid #e5e7eb", overflow: "hidden", transition: "box-shadow 0.2s, transform 0.2s", cursor: "pointer" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 32px rgba(0,0,0,0.12)"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; (e.currentTarget as HTMLDivElement).style.transform = "none"; }}
                  >
                    <div style={{ aspectRatio: "4/3", background: "linear-gradient(135deg,#0f0f12 0%,#1a1a2e 100%)", position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {item.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.thumbnailUrl} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                          <span style={{ fontSize: "48px" }}>📦</span>
                        </div>
                      )}
                      <span style={{ position: "absolute", top: "10px", left: "10px", background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: "10px", fontWeight: 700, padding: "3px 8px", borderRadius: "999px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        {item.format}
                      </span>
                      {isFree && (
                        <span style={{ position: "absolute", bottom: "10px", right: "10px", background: "#10b981", color: "#fff", fontSize: "11px", fontWeight: 800, padding: "4px 10px", borderRadius: "999px" }}>FREE</span>
                      )}
                    </div>
                    <div style={{ padding: "16px" }}>
                      <p style={{ margin: "0 0 4px", fontSize: "11px", color: "#f97316", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{item.niche}</p>
                      <h3 style={{ margin: "0 0 8px", fontSize: "15px", fontWeight: 700, color: "#111827", lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {item.title}
                      </h3>
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
                        {item.salesCount !== null && item.salesCount > 0 && (
                          <span style={{ fontSize: "11px", color: "#6b7280", fontWeight: 600 }}>{item.salesCount} sale{item.salesCount !== 1 ? "s" : ""}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ textAlign: "center", padding: "32px 24px", borderTop: "1px solid #e5e7eb", marginTop: "40px" }}>
        <p style={{ margin: 0, fontSize: "13px", color: "#9ca3af" }}>
          Powered by <a href="/" style={{ color: "#f97316", fontWeight: 600, textDecoration: "none" }}>Content Flywheel</a> · <a href="/marketplace" style={{ color: "#9ca3af", textDecoration: "none" }}>Browse all products</a>
        </p>
      </div>
    </div>
  );
}
