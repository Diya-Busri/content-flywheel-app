"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

interface BuyButtonProps {
  productId: string;
  priceLabel: string;
}

export function BuyButton({ productId, priceLabel }: BuyButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBuy = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/products/${productId}/buy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          padding: "14px 36px",
          borderRadius: "12px",
          background: loading
            ? "linear-gradient(135deg,#fb923c 0%,#f97316 100%)"
            : "linear-gradient(135deg,#f97316 0%,#ea6c0a 100%)",
          color: "#ffffff",
          fontSize: "16px",
          fontWeight: 700,
          textDecoration: "none",
          boxShadow: "0 4px 20px rgba(249,115,22,0.35)",
          letterSpacing: "-0.2px",
          border: "none",
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.85 : 1,
        }}
      >
        {loading && (
          <svg
            style={{ animation: "spin 1s linear infinite", width: 18, height: 18 }}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
        )}
        {loading ? "Redirecting…" : `Buy Now – ${priceLabel}`}
      </button>
      {error && (
        <p style={{ margin: "8px 0 0", fontSize: "13px", color: "#dc2626" }}>{error}</p>
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
