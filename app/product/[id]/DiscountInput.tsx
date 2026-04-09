"use client";
import { useState } from "react";

interface AppliedDiscount {
  codeId: string;
  discountPercent: number | null;
  discountAmount: number | null;
}

export default function DiscountInput({
  productId,
  onApply,
}: {
  productId: string;
  onApply: (discount: AppliedDiscount | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function apply() {
    if (!code.trim()) return;
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/creator-promo-codes/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim(), productId }),
      });
      const data = await res.json();
      if (data.valid) {
        setStatus("success");
        const label = data.discountPercent
          ? `${data.discountPercent}% off applied!`
          : data.discountAmount
          ? `£${(data.discountAmount / 100).toFixed(2)} off applied!`
          : "Discount applied!";
        setMessage(label);
        onApply({ codeId: data.codeId, discountPercent: data.discountPercent, discountAmount: data.discountAmount });
      } else {
        setStatus("error");
        setMessage(data.error || "Invalid code");
        onApply(null);
      }
    } catch {
      setStatus("error");
      setMessage("Something went wrong. Try again.");
      onApply(null);
    }
  }

  return (
    <div style={{ marginTop: "12px" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ background: "none", border: "none", color: "#f97316", fontSize: "13px", fontWeight: 600, cursor: "pointer", padding: 0 }}
      >
        {open ? "▲ Hide promo code" : "🎟️ Have a promo code?"}
      </button>
      {open && (
        <div style={{ marginTop: "8px", display: "flex", gap: "8px" }}>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && apply()}
            placeholder="ENTER CODE"
            style={{
              flex: 1,
              padding: "10px 14px",
              borderRadius: "10px",
              border: `1px solid ${status === "success" ? "#86efac" : status === "error" ? "#fca5a5" : "#e5e7eb"}`,
              fontSize: "13px",
              fontWeight: 600,
              letterSpacing: "0.08em",
              outline: "none",
              background: status === "success" ? "#f0fdf4" : "#fff",
            }}
          />
          <button
            onClick={apply}
            disabled={status === "loading" || !code.trim()}
            style={{
              padding: "10px 18px",
              borderRadius: "10px",
              background: "#111827",
              color: "#fff",
              fontWeight: 700,
              fontSize: "13px",
              border: "none",
              cursor: status === "loading" || !code.trim() ? "not-allowed" : "pointer",
              opacity: status === "loading" || !code.trim() ? 0.6 : 1,
            }}
          >
            {status === "loading" ? "…" : "Apply"}
          </button>
        </div>
      )}
      {message && (
        <p style={{ margin: "6px 0 0", fontSize: "12px", color: status === "success" ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
          {message}
        </p>
      )}
    </div>
  );
}
