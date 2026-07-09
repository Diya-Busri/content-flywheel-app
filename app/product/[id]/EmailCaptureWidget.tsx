"use client";

import { useState } from "react";

interface EmailCaptureWidgetProps {
  creatorUserId: string;
  headline?: string;
  subtext?: string;
}

export function EmailCaptureWidget({
  creatorUserId,
  headline = "Get updates & free resources",
  subtext = "Join the list and be first to hear about new drops, discounts, and free content.",
}: EmailCaptureWidgetProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/email/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), name: name.trim() || null, userId: creatorUserId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setStatus("success");
        setMessage("You're in! Check your inbox for a welcome email.");
      } else {
        setStatus("error");
        setMessage((data as { error?: string }).error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setStatus("error");
      setMessage("Failed to connect. Please try again.");
    }
  };

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #fff7ed 0%, #fef3c7 100%)",
        border: "1.5px solid #fed7aa",
        borderRadius: "20px",
        padding: "clamp(18px, 5vw, 28px)",
        marginBottom: "24px",
      }}
    >
      <div style={{ marginBottom: "20px" }}>
        <p style={{ margin: "0 0 6px", fontSize: "18px", fontWeight: 800, color: "#111827", letterSpacing: "-0.3px" }}>
          {headline}
        </p>
        <p style={{ margin: 0, fontSize: "14px", color: "#6b7280", lineHeight: 1.6 }}>{subtext}</p>
      </div>

      {status === "success" ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "14px 18px",
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: "12px",
          }}
        >
          <span style={{ fontSize: "20px" }}>✅</span>
          <span style={{ fontSize: "14px", fontWeight: 600, color: "#15803d" }}>{message}</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <input
            type="text"
            placeholder="Your name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              padding: "10px 14px",
              borderRadius: "10px",
              border: "1.5px solid #e5e7eb",
              fontSize: "14px",
              color: "#111827",
              outline: "none",
              background: "#fff",
            }}
          />
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <input
              type="email"
              required
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                flex: "1 1 180px",
                minWidth: 0,
                padding: "10px 14px",
                borderRadius: "10px",
                border: "1.5px solid #e5e7eb",
                fontSize: "14px",
                color: "#111827",
                outline: "none",
                background: "#fff",
              }}
            />
            <button
              type="submit"
              disabled={status === "loading"}
              style={{
                flex: "0 0 auto",
                padding: "10px 20px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #f97316, #ea580c)",
                color: "#fff",
                fontSize: "14px",
                fontWeight: 700,
                border: "none",
                cursor: status === "loading" ? "not-allowed" : "pointer",
                opacity: status === "loading" ? 0.7 : 1,
                whiteSpace: "nowrap",
              }}
            >
              {status === "loading" ? "…" : "Subscribe"}
            </button>
          </div>
          {status === "error" && (
            <p style={{ margin: 0, fontSize: "13px", color: "#dc2626" }}>{message}</p>
          )}
          <p style={{ margin: 0, fontSize: "11px", color: "#9ca3af" }}>
            No spam, ever. Unsubscribe any time.
          </p>
        </form>
      )}
    </div>
  );
}
