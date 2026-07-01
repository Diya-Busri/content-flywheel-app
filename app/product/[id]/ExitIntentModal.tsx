"use client";

import { useEffect, useRef, useState } from "react";

interface ExitIntentModalProps {
  productId: string;
  creatorUserId: string;
  priceLabel: string;
  discountPercent?: number; // e.g. 15 for 15% off
  headline?: string;
}

export function ExitIntentModal({
  productId,
  creatorUserId,
  priceLabel,
  discountPercent = 15,
  headline = "Wait — before you go!",
}: ExitIntentModalProps) {
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");
  const firedRef = useRef(false);

  useEffect(() => {
    // Only fire once per session
    const key = `exit_intent_${productId}`;
    if (sessionStorage.getItem(key)) return;

    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 10 && !firedRef.current) {
        firedRef.current = true;
        sessionStorage.setItem(key, "1");
        setVisible(true);
      }
    };

    // Small delay before attaching so we don't fire immediately on page load
    const timer = setTimeout(() => {
      document.addEventListener("mouseleave", handleMouseLeave);
    }, 4000);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [productId]);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    try {
      await fetch("/api/email/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), userId: creatorUserId, tags: ["exit-intent"] }),
      });
      setStatus("success");
    } catch {
      setStatus("success"); // still close gracefully
    }
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) setVisible(false); }}
    >
      <div
        style={{
          background: "#fff", borderRadius: "24px", padding: "36px 32px",
          maxWidth: "440px", width: "100%", position: "relative",
          boxShadow: "0 24px 80px rgba(0,0,0,0.18)",
          animation: "slideUp 0.25s ease-out",
        }}
      >
        <button
          onClick={() => setVisible(false)}
          style={{
            position: "absolute", top: "14px", right: "14px",
            background: "#f3f4f6", border: "none", borderRadius: "50%",
            width: "28px", height: "28px", cursor: "pointer",
            fontSize: "14px", color: "#6b7280", display: "flex",
            alignItems: "center", justifyContent: "center",
          }}
          aria-label="Close"
        >
          ✕
        </button>

        {status === "success" ? (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div style={{ fontSize: "48px", marginBottom: "14px" }}>🎉</div>
            <h2 style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: 800, color: "#111827" }}>
              You&apos;re on the list!
            </h2>
            <p style={{ margin: "0 0 20px", fontSize: "14px", color: "#6b7280", lineHeight: 1.6 }}>
              Check your inbox — we&apos;ll be in touch with your discount.
            </p>
            <button
              onClick={() => setVisible(false)}
              style={{
                padding: "11px 28px", borderRadius: "12px",
                background: "linear-gradient(135deg,#f97316,#ea580c)",
                color: "#fff", fontWeight: 700, fontSize: "15px", border: "none", cursor: "pointer",
              }}
            >
              Got it, thanks!
            </button>
          </div>
        ) : (
          <>
            <div style={{ textAlign: "center", marginBottom: "24px" }}>
              <div style={{ fontSize: "40px", marginBottom: "12px" }}>🎁</div>
              <h2 style={{ margin: "0 0 8px", fontSize: "22px", fontWeight: 800, color: "#111827", letterSpacing: "-0.3px" }}>
                {headline}
              </h2>
              <p style={{ margin: "0 0 6px", fontSize: "15px", color: "#374151", lineHeight: 1.6 }}>
                Subscribe and get <strong style={{ color: "#f97316" }}>{discountPercent}% off</strong> your first purchase.
              </p>
              <p style={{ margin: 0, fontSize: "13px", color: "#9ca3af" }}>
                We&apos;ll email you a discount code right away.
              </p>
            </div>

            <form onSubmit={handleSubscribe} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <input
                type="email"
                required
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  padding: "12px 16px", borderRadius: "12px",
                  border: "1.5px solid #e5e7eb", fontSize: "15px",
                  color: "#111827", outline: "none", background: "#fafafa",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#f97316")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}
              />
              <button
                type="submit"
                disabled={status === "loading"}
                style={{
                  padding: "13px", borderRadius: "12px",
                  background: "linear-gradient(135deg,#f97316 0%,#ea580c 100%)",
                  color: "#fff", fontSize: "15px", fontWeight: 700,
                  border: "none", cursor: "pointer",
                  boxShadow: "0 4px 18px rgba(249,115,22,0.35)",
                  opacity: status === "loading" ? 0.7 : 1,
                }}
              >
                {status === "loading" ? "Sending…" : `Claim ${discountPercent}% off →`}
              </button>
              <button
                type="button"
                onClick={() => setVisible(false)}
                style={{
                  background: "none", border: "none", fontSize: "13px",
                  color: "#9ca3af", cursor: "pointer", textDecoration: "underline",
                }}
              >
                No thanks, I&apos;ll pay full price
              </button>
            </form>
          </>
        )}

        <style>{`
          @keyframes slideUp {
            from { opacity: 0; transform: translateY(24px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    </div>
  );
}
