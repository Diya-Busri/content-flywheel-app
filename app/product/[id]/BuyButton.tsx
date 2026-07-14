"use client";

import { useState, useEffect } from "react";
import { REFUND_POLICY_TEXT, CONSENT_CHECKBOX_TEXT } from "@/lib/refund-policy";

function ConsentCheckbox({
  checked,
  onChange,
  showError,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  showError: boolean;
}) {
  return (
    <div style={{ marginBottom: "12px" }}>
      <label
        style={{
          display: "flex", alignItems: "flex-start", gap: "9px", cursor: "pointer",
          padding: "11px 13px", borderRadius: "10px",
          background: showError ? "#fef2f2" : "#f9fafb",
          border: `1.5px solid ${showError ? "#fca5a5" : "#e5e7eb"}`,
        }}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          required
          style={{ marginTop: "2px", width: "16px", height: "16px", accentColor: "#f97316", cursor: "pointer", flexShrink: 0 }}
        />
        <span style={{ fontSize: "12.5px", lineHeight: 1.5, color: "#4b5563" }}>{CONSENT_CHECKBOX_TEXT}</span>
      </label>
      {showError && (
        <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#dc2626", fontWeight: 600 }}>
          Please check the box above to continue.
        </p>
      )}
    </div>
  );
}

interface BuyButtonProps {
  productId: string;
  priceLabel: string;
  creatorUserId: string;
  isFree?: boolean;
  refCode?: string | null;
  autoCoupon?: string | null;
  payWhatYouWant?: boolean;
  minPrice?: number | null;
}

export function BuyButton({ productId, priceLabel, creatorUserId, isFree, refCode, autoCoupon, payWhatYouWant, minPrice }: BuyButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState(autoCoupon ?? "");
  const [promoOpen, setPromoOpen] = useState(!!autoCoupon);
  const [pwywAmount, setPwywAmount] = useState<string>(
    minPrice ? (minPrice / 100).toFixed(2) : "0.00"
  );
  // Free product state
  const [freeEmail, setFreeEmail] = useState("");
  const [freeName, setFreeName] = useState("");
  const [freeStatus, setFreeStatus] = useState<"idle" | "loading" | "success">("idle");
  const [promoValidating, setPromoValidating] = useState(false);
  const [promoResult, setPromoResult] = useState<{ discount: string; code: string } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  // Required pre-payment consent checkbox — must never default to checked.
  const [consentChecked, setConsentChecked] = useState(false);
  const [consentError, setConsentError] = useState(false);

  // Auto-validate coupon from URL on first render
  useEffect(() => {
    if (autoCoupon) {
      validatePromo(autoCoupon);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validatePromo = async (codeOverride?: string) => {
    const code = (codeOverride ?? promoCode).trim();
    if (!code) return;
    setPromoValidating(true);
    setPromoError(null);
    setPromoResult(null);
    try {
      const res = await fetch("/api/creator/promo-codes/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, creatorUserId }),
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
    if (!consentChecked) {
      setConsentError(true);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const buyUrl = refCode
        ? `/api/products/${productId}/buy?ref=${encodeURIComponent(refCode)}`
        : `/api/products/${productId}/buy`;
      const body: Record<string, unknown> = { promoCode: promoResult?.code ?? null, consent: true };
      if (payWhatYouWant) {
        const parsed = Math.round(parseFloat(pwywAmount || "0") * 100);
        const minPence = minPrice ?? 0;
        if (parsed < minPence) {
          setError(`Minimum amount is £${(minPence / 100).toFixed(2)}`);
          setLoading(false);
          return;
        }
        body.customAmount = parsed;
      }
      const res = await fetch(buyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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

  const handleFreeGet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!freeEmail.trim()) return;
    if (!consentChecked) {
      setConsentError(true);
      return;
    }
    setFreeStatus("loading");
    try {
      const res = await fetch("/api/email/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: freeEmail.trim(),
          name: freeName.trim() || null,
          userId: creatorUserId,
          tags: ["free-product"],
          leadMagnetProductId: productId,
          consent: true,
        }),
      });
      if (res.ok || res.status === 409) {
        setFreeStatus("success");
      } else {
        const d = await res.json().catch(() => ({}));
        setError((d as { error?: string }).error ?? "Something went wrong");
        setFreeStatus("idle");
      }
    } catch {
      setError("Failed to connect. Please try again.");
      setFreeStatus("idle");
    }
  };

  // Free product flow — collect email and deliver via lead magnet system
  if (isFree) {
    if (freeStatus === "success") {
      return (
        <div style={{ padding: "20px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "14px", textAlign: "center" }}>
          <div style={{ fontSize: "32px", marginBottom: "8px" }}>🎉</div>
          <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: "15px", color: "#15803d" }}>Check your inbox!</p>
          <p style={{ margin: 0, fontSize: "13px", color: "#16a34a" }}>Your download link is on its way to {freeEmail}.</p>
        </div>
      );
    }
    return (
      <form onSubmit={handleFreeGet} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <input
          type="text"
          placeholder="Your name (optional)"
          value={freeName}
          onChange={(e) => setFreeName(e.target.value)}
          style={{ padding: "11px 14px", borderRadius: "10px", border: "1.5px solid #e5e7eb", fontSize: "14px", color: "#111827", outline: "none" }}
        />
        <input
          type="email"
          required
          placeholder="your@email.com"
          value={freeEmail}
          onChange={(e) => setFreeEmail(e.target.value)}
          style={{ padding: "11px 14px", borderRadius: "10px", border: "1.5px solid #e5e7eb", fontSize: "14px", color: "#111827", outline: "none" }}
        />
        <ConsentCheckbox
          checked={consentChecked}
          onChange={(v) => { setConsentChecked(v); if (v) setConsentError(false); }}
          showError={consentError}
        />
        <button
          type="submit"
          disabled={freeStatus === "loading" || !consentChecked}
          style={{
            width: "100%", padding: "14px", borderRadius: "12px", justifyContent: "center",
            background: "linear-gradient(135deg,#f97316 0%,#ea6c0a 100%)",
            color: "#fff", fontSize: "16px", fontWeight: 700, border: "none",
            cursor: freeStatus === "loading" || !consentChecked ? "not-allowed" : "pointer",
            boxShadow: "0 4px 20px rgba(249,115,22,0.35)",
            opacity: freeStatus === "loading" || !consentChecked ? 0.5 : 1,
          }}
        >
          {freeStatus === "loading" ? "Sending…" : "Get this product free"}
        </button>
        {error && <p style={{ margin: 0, fontSize: "13px", color: "#dc2626" }}>{error}</p>}
        <p style={{ margin: 0, fontSize: "11px", color: "#9ca3af", textAlign: "center" }}>No spam. Unsubscribe any time.</p>
      </form>
    );
  }

  return (
    <div>
      {/* Pay-what-you-want amount input */}
      {payWhatYouWant && (
        <div style={{ marginBottom: "12px" }}>
          <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#374151", marginBottom: "6px" }}>
            Name your price
            {minPrice && minPrice > 0 && (
              <span style={{ fontWeight: 400, color: "#9ca3af", marginLeft: "6px" }}>
                (min £{(minPrice / 100).toFixed(2)})
              </span>
            )}
          </label>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "15px", fontWeight: 700, color: "#374151" }}>£</span>
            <input
              type="number"
              min={minPrice ? (minPrice / 100).toFixed(2) : "0"}
              step="0.01"
              value={pwywAmount}
              onChange={(e) => setPwywAmount(e.target.value)}
              style={{ width: "100%", padding: "11px 14px 11px 28px", borderRadius: "10px", border: "1.5px solid #e5e7eb", fontSize: "16px", fontWeight: 700, color: "#111827", outline: "none", boxSizing: "border-box" }}
            />
          </div>
        </div>
      )}

      <ConsentCheckbox
        checked={consentChecked}
        onChange={(v) => { setConsentChecked(v); if (v) setConsentError(false); }}
        showError={consentError}
      />

      <button
        onClick={handleBuy}
        disabled={loading || !consentChecked}
        style={{
          display: "inline-flex", alignItems: "center", gap: "8px", width: "100%",
          padding: "14px 36px", borderRadius: "12px", justifyContent: "center",
          background: loading ? "linear-gradient(135deg,#fb923c 0%,#f97316 100%)" : "linear-gradient(135deg,#f97316 0%,#ea6c0a 100%)",
          color: "#ffffff", fontSize: "16px", fontWeight: 700, boxShadow: "0 4px 20px rgba(249,115,22,0.35)",
          letterSpacing: "-0.2px", border: "none", cursor: loading || !consentChecked ? "not-allowed" : "pointer", opacity: loading ? 0.85 : !consentChecked ? 0.5 : 1,
        }}
      >
        {loading && (
          <svg style={{ animation: "spin 1s linear infinite", width: 18, height: 18 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
        )}
        {loading
          ? "Redirecting…"
          : payWhatYouWant
          ? `Support with £${parseFloat(pwywAmount || "0").toFixed(2)} →`
          : promoResult
          ? `Get instant access for ${priceLabel} (${promoResult.discount})`
          : `Get instant access for ${priceLabel}`}
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
          <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#16a34a", fontWeight: 600 }}>✓ Code applied: {promoResult.discount}</p>
        )}
        {promoError && (
          <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#dc2626" }}>{promoError}</p>
        )}
      </div>

      {error && <p style={{ margin: "8px 0 0", fontSize: "13px", color: "#dc2626" }}>{error}</p>}

      {/* Refund / cancellation policy */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginTop: "14px", padding: "12px 14px", borderRadius: "10px", background: "#f9fafb", border: "1px solid #e5e7eb" }}>
        <span style={{ fontSize: "14px", lineHeight: 1.4 }}>ℹ️</span>
        <span style={{ fontSize: "11.5px", lineHeight: 1.55, color: "#6b7280" }}>{REFUND_POLICY_TEXT}</span>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
