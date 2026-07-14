"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Heart, ShoppingBag, ArrowLeft, Trash2, ExternalLink } from "lucide-react";

type WishlistItem = {
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
  isNativePublished: boolean;
};

const AVATAR_COLORS = ["#f97316","#8b5cf6","#3b82f6","#10b981","#ec4899","#f59e0b","#6366f1"];
function avatarColor(userId: string) {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}
function creatorInitials(name: string) {
  return name.split(" ").map((w) => w[0]?.toUpperCase() ?? "").slice(0, 2).join("") || "CF";
}
function priceDisplay(item: WishlistItem) {
  if (item.nativePrice === 0) return "Free";
  if (item.nativePrice != null) return `£${(item.nativePrice / 100).toFixed(2)}`;
  if (item.priceLabel) return item.priceLabel;
  return "";
}

function WishlistCard({ item, onRemove }: { item: WishlistItem; onRemove: (id: string) => void }) {
  const [hovered, setHovered] = useState(false);
  const [removing, setRemoving] = useState(false);
  const isFree = item.nativePrice === 0;
  const price = priceDisplay(item);
  const bgColor = avatarColor(item.creatorUserId);
  const initials = creatorInitials(item.creatorName);

  const handleRemove = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setRemoving(true);
    onRemove(item.id);
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: "16px",
        background: "#fff",
        border: `1px solid ${hovered ? "#f97316" : "#e5e7eb"}`,
        overflow: "hidden",
        transition: "all 0.2s",
        boxShadow: hovered ? "0 8px 28px rgba(0,0,0,0.1)" : "0 1px 4px rgba(0,0,0,0.05)",
        transform: hovered ? "translateY(-2px)" : "none",
        opacity: removing ? 0.4 : 1,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Thumbnail */}
      <div style={{ aspectRatio: "4/3", position: "relative", overflow: "hidden", flexShrink: 0, background: "linear-gradient(135deg,#f97316,#ea580c)" }}>
        {item.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.thumbnailUrl} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.3s", transform: hovered ? "scale(1.04)" : "scale(1)" }} />
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", background: "linear-gradient(135deg,#1f1f2e,#2d1f3d)" }}>
            <ShoppingBag style={{ width: "36px", height: "36px", color: "rgba(249,115,22,0.5)" }} />
          </div>
        )}
        {/* Format badge */}
        <span style={{ position: "absolute", top: "10px", left: "10px", background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", color: "#fff", fontSize: "9px", fontWeight: 800, padding: "3px 8px", borderRadius: "999px", textTransform: "uppercase", letterSpacing: "0.07em" }}>
          {item.format}
        </span>
        {/* Remove button */}
        <button
          onClick={handleRemove}
          disabled={removing}
          title="Remove from wishlist"
          style={{ position: "absolute", top: "8px", right: "8px", background: "rgba(244,63,94,0.85)", backdropFilter: "blur(4px)", border: "none", borderRadius: "50%", width: "30px", height: "30px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "13px", transition: "all 0.15s", zIndex: 2 }}
        >
          ×
        </button>
        {isFree && (
          <span style={{ position: "absolute", bottom: "10px", left: "10px", background: "#10b981", color: "#fff", fontSize: "10px", fontWeight: 800, padding: "4px 10px", borderRadius: "999px" }}>FREE</span>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: "14px 16px 16px", flex: 1, display: "flex", flexDirection: "column" }}>
        <span style={{ fontSize: "10px", color: "#f97316", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", background: "rgba(249,115,22,0.08)", padding: "2px 8px", borderRadius: "999px", border: "1px solid rgba(249,115,22,0.2)", display: "inline-block", marginBottom: "6px" }}>
          {item.niche}
        </span>
        <h3 style={{ margin: "0 0 auto", fontSize: "14px", fontWeight: 700, color: "#111827", lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {item.title}
        </h3>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "12px" }}>
          <span style={{ fontSize: "17px", fontWeight: 800, color: isFree ? "#10b981" : "#111827" }}>
            {price}
          </span>
          <Link href={`/marketplace/creator/${item.creatorUserId}`} onClick={(e) => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: "5px", textDecoration: "none" }}>
            <div style={{ width: "22px", height: "22px", borderRadius: "50%", background: bgColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "8px", fontWeight: 800, color: "#fff" }}>
              {initials}
            </div>
            <span style={{ fontSize: "11px", color: "#6b7280", fontWeight: 600, maxWidth: "80px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.creatorName}</span>
          </Link>
        </div>

        {/* CTA */}
        <div style={{ marginTop: "12px", display: "flex", gap: "8px" }}>
          {item.isNativePublished ? (
            <a href={`/product/${item.id}`} style={{ flex: 1, display: "block", padding: "9px", borderRadius: "10px", background: "linear-gradient(135deg,#f97316,#ea580c)", color: "#fff", fontSize: "12px", fontWeight: 800, textAlign: "center", textDecoration: "none", boxShadow: "0 3px 10px rgba(249,115,22,0.35)" }}>
              {isFree ? "Get Free" : "Buy Now"}
            </a>
          ) : (
            <a href={`/product/${item.id}`} style={{ flex: 1, display: "block", padding: "9px", borderRadius: "10px", background: "#f3f4f6", color: "#374151", fontSize: "12px", fontWeight: 700, textAlign: "center", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
              <ExternalLink style={{ width: "12px", height: "12px" }} /> View
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function WishlistClient({ marketplaceEnabled }: { marketplaceEnabled: boolean }) {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/marketplace/wishlist")
      .then((r) => {
        if (r.status === 401) throw new Error("sign-in");
        return r.json();
      })
      .then((d) => {
        setItems(d.items ?? []);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message === "sign-in" ? "sign-in" : "Failed to load your wishlist.");
        setLoading(false);
      });
  }, []);

  const handleRemove = useCallback((id: string) => {
    // Optimistic remove
    setItems((prev) => prev.filter((i) => i.id !== id));
    fetch(`/api/marketplace/wishlist?productId=${id}`, { method: "DELETE" }).catch(() => {});
    // Sync localStorage
    try {
      const w = JSON.parse(localStorage.getItem("cf_wishlist") ?? "[]") as string[];
      localStorage.setItem("cf_wishlist", JSON.stringify(w.filter((x) => x !== id)));
    } catch { /* ignore */ }
  }, []);

  const handleClearAll = useCallback(async () => {
    if (!confirm("Remove all saved products from your wishlist?")) return;
    const ids = items.map((i) => i.id);
    setItems([]);
    try { localStorage.removeItem("cf_wishlist"); } catch { /* ignore */ }
    // Remove each from DB
    await Promise.all(ids.map((id) => fetch(`/api/marketplace/wishlist?productId=${id}`, { method: "DELETE" }).catch(() => {})));
  }, [items]);

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "20px 24px" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", display: "flex", alignItems: "center", gap: "16px" }}>
          {marketplaceEnabled ? (
            <Link href="/marketplace" style={{ display: "flex", alignItems: "center", gap: "6px", color: "#6b7280", fontSize: "13px", fontWeight: 600, textDecoration: "none", background: "#f3f4f6", padding: "7px 14px", borderRadius: "8px", transition: "all 0.15s" }}>
              <ArrowLeft style={{ width: "14px", height: "14px" }} /> Marketplace
            </Link>
          ) : (
            <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: "6px", color: "#6b7280", fontSize: "13px", fontWeight: 600, textDecoration: "none", background: "#f3f4f6", padding: "7px 14px", borderRadius: "8px", transition: "all 0.15s" }}>
              <ArrowLeft style={{ width: "14px", height: "14px" }} /> Dashboard
            </Link>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(244,63,94,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Heart style={{ width: "16px", height: "16px", color: "#f43f5e", fill: "#f43f5e" }} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#111827" }}>My Wishlist</h1>
              {!loading && !error && (
                <p style={{ margin: 0, fontSize: "12px", color: "#9ca3af", fontWeight: 500 }}>
                  {items.length === 0 ? "No saved products" : `${items.length} saved product${items.length !== 1 ? "s" : ""}`}
                </p>
              )}
            </div>
          </div>
          {items.length > 0 && (
            <button
              onClick={handleClearAll}
              style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", fontWeight: 700, color: "#9ca3af", background: "none", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "7px 14px", cursor: "pointer", transition: "all 0.15s" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#fecaca"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#9ca3af"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#e5e7eb"; }}
            >
              <Trash2 style={{ width: "12px", height: "12px" }} /> Clear all
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "32px 24px 64px" }}>
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "18px" }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ borderRadius: "16px", background: "#fff", border: "1px solid #f3f4f6", overflow: "hidden" }}>
                <div style={{ aspectRatio: "4/3", background: "linear-gradient(90deg,#f3f4f6 25%,#e9eaec 50%,#f3f4f6 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
                <div style={{ padding: "16px" }}>
                  <div style={{ height: "10px", width: "50%", borderRadius: "6px", background: "#f3f4f6", marginBottom: "10px" }} />
                  <div style={{ height: "15px", width: "85%", borderRadius: "6px", background: "#f3f4f6", marginBottom: "6px" }} />
                  <div style={{ height: "15px", width: "60%", borderRadius: "6px", background: "#f3f4f6" }} />
                </div>
              </div>
            ))}
          </div>
        ) : error === "sign-in" ? (
          <div style={{ textAlign: "center", padding: "80px 24px" }}>
            <div style={{ fontSize: "56px", marginBottom: "16px" }}>❤️</div>
            <h2 style={{ margin: "0 0 8px", fontSize: "22px", fontWeight: 800, color: "#111827" }}>Sign in to see your wishlist</h2>
            <p style={{ color: "#6b7280", fontSize: "15px", marginBottom: "24px" }}>Create an account to save products and access them from any device.</p>
            <a href="/login" style={{ display: "inline-block", padding: "12px 28px", borderRadius: "12px", background: "#f97316", color: "#fff", fontSize: "14px", fontWeight: 700, textDecoration: "none", boxShadow: "0 4px 14px rgba(249,115,22,0.35)" }}>Sign in</a>
          </div>
        ) : error ? (
          <div style={{ textAlign: "center", padding: "80px 24px", color: "#ef4444" }}>{error}</div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 24px" }}>
            <div style={{ fontSize: "56px", marginBottom: "16px" }}>🤍</div>
            <h2 style={{ margin: "0 0 8px", fontSize: "22px", fontWeight: 800, color: "#111827" }}>Your wishlist is empty</h2>
            {marketplaceEnabled ? (
              <>
                <p style={{ color: "#6b7280", fontSize: "15px", marginBottom: "24px" }}>Browse the marketplace and tap ❤️ to save products you love.</p>
                <Link href="/marketplace" style={{ display: "inline-block", padding: "12px 28px", borderRadius: "12px", background: "#f97316", color: "#fff", fontSize: "14px", fontWeight: 700, textDecoration: "none", boxShadow: "0 4px 14px rgba(249,115,22,0.35)" }}>
                  Browse marketplace
                </Link>
              </>
            ) : (
              <p style={{ color: "#6b7280", fontSize: "15px", marginBottom: "24px" }}>Products you save will show up here.</p>
            )}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "18px" }}>
            {items.map((item) => (
              <WishlistCard key={item.id} item={item} onRemove={handleRemove} />
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
