"use client";

import { useState } from "react";

export function EmbedSubscribeForm({ userId, brandName }: { userId: string; brandName: string }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/email/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setStatus("success");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", padding: "24px", textAlign: "center", background: "#fff", borderRadius: "12px" }}>
        <div style={{ fontSize: "32px", marginBottom: "12px" }}>🎉</div>
        <p style={{ margin: 0, fontWeight: 700, fontSize: "16px", color: "#111827" }}>You&apos;re subscribed!</p>
        <p style={{ margin: "8px 0 0", fontSize: "14px", color: "#6b7280" }}>Check your inbox for a welcome email.</p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", padding: "20px", background: "#fff", borderRadius: "12px" }}>
      <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: "15px", color: "#111827" }}>Subscribe to {brandName}</p>
      <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#6b7280" }}>Get updates, tips and exclusive content.</p>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Your name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e5e7eb", marginBottom: "8px", fontSize: "14px", boxSizing: "border-box" }}
        />
        <input
          type="email"
          placeholder="Your email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e5e7eb", marginBottom: "8px", fontSize: "14px", boxSizing: "border-box" }}
        />
        {status === "error" && <p style={{ margin: "0 0 8px", fontSize: "13px", color: "#ef4444" }}>{errorMsg}</p>}
        <button
          type="submit"
          disabled={status === "loading"}
          style={{ width: "100%", padding: "11px", borderRadius: "8px", background: "#f97316", color: "#fff", fontWeight: 700, fontSize: "15px", border: "none", cursor: "pointer" }}
        >
          {status === "loading" ? "Subscribing..." : "Subscribe"}
        </button>
      </form>
    </div>
  );
}
