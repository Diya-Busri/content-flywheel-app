"use client";

import { useState } from "react";

interface BuyButtonProps {
  productId: string;
  priceLabel: string;
  creatorUserId: string;
}

export function BuyButton({ productId, priceLabel, creatorUserId }: BuyButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoValidating, setPromoValidating] = useState(false);
  const [promoResult, setPromoResult] = useState<{ discount: string; code: string } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);

  const validatePromo = async () => {
    if (!promoCode.trim()) return;
    setPromoValidating(true);
    setPromoError(null);
    setPromoResult(null);
    try {
      const res = await fetch("/api/creator/promo-codes/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promoCode.trim(), creatorUserId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid code");
      const discount = data.discountPercent
        ? `${data.discountPercent}% off`
        : `£${(data.discountAmount / 100).toFixed(2)} off`;
      setPromoResult({ discount, code: data.code });
    } catch (err) {
      setPromoError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setPromoValidating(false);
    }
  };

  const handleBuy = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/products/${productId}/buy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promoCode: promoResult?.code ?? null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      if (!data.url) throw new Error("No checkout URL returned");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start checkout");
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleBuy}
        disabled={loading}
        style={{
          display: "inline-flex", alignItems: "center", gap: "8px", width: "100%",
          padding: "14px 36px", borderRadius: "12px", justifyContent: "center",
          background: loading ? "linear-gradient(135deg,#fb923c 0%,#f97316 100%)" : "linear-gradient(135deg,#f97316 0%,#ea6c0a 100%)",
          color: "#ffffff", fontSize: "16px", fontWeight: 700, boxShadow: "0 4px 20px rgba(249,115,22,0.35)",
          letterSpacing: "-0.2px", border: "none", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.85 : 1,
        }}
      >
        {loading && (
          <svg style={{ animation: "spin 1s linear infinite", width: 18, height: 18 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
        )}
        {loading ? "Redirecting…" : promoResult ? `Buy Now – ${priceLabel} (${promoResult.discount})` : `Buy Now – ${priceLabel}`}
      </button>

      {/* Promo code section */}
      <div style={{ marginTop: "12px" }}>
        {!promoOpen ? (
          <button onClick={() => setPromoOpen(true)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: "#9ca3af", textDecoration: "underline", padding: 0 }}>
            Have a promo code?
          </button>
        ) : (
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <input
              type="text"
              value={promoCode}
              onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setPromoResult(null); setPromoError(null); }}
              placeholder="ENTER CODE"
              style={{ flex: 1, padding: "8px 12px", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}
              onKeyDown={(e) => { if (e.key === "Enter") validatePromo(); }}
            />
            <button onClick={validatePromo} disabled={promoValidating || !promoCode.trim()} style={{ padding: "8px 14px", borderRadius: "8px", background: "#111827", color: "#fff", fontSize: "13px", fontWeight: 600, border: "none", cursor: "pointer", opacity: promoValidating ? 0.7 : 1 }}>
              {promoValidating ? "..." : "Apply"}
            </button>
          </div>
        )}
        {promoResult && (
          <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#16a34a", fontWeight: 600 }}>✓ Code applied — {promoResult.discount}</p>
        )}
        {promoError && (
          <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#dc2626" }}>{promoError}</p>
        )}
      </div>

      {error && <p style={{ margin: "8px 0 0", fontSize: "13px", color: "#dc2626" }}>{error}</p>}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
