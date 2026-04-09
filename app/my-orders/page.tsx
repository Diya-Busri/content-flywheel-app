"use client";

import { useState } from "react";

type Order = {
  id: string;
  productTitle: string;
  amountCents: number;
  currency: string;
  createdAt: string;
  downloadToken: string | null;
  productId: string;
  downloadExpiresAt: string | null;
};

function formatAmount(amountCents: number, currency: string): string {
  const symbol = currency.toLowerCase() === "gbp" ? "£" : currency.toLowerCase() === "usd" ? "$" : currency.toUpperCase() + " ";
  return `${symbol}${(amountCents / 100).toFixed(2)}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

export default function MyOrdersPage() {
  const [email, setEmail] = useState("");
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setOrders(null);

    try {
      const res = await fetch("/api/my-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Something went wrong. Please try again.");
        return;
      }

      const data = (await res.json()) as Order[];
      setOrders(data);
      setSearched(true);
    } catch {
      setError("Failed to connect. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#fff",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "48px 16px 80px",
      }}
    >
      <div style={{ width: "100%", maxWidth: "560px" }}>
        {/* Header */}
        <div style={{ marginBottom: "32px", textAlign: "center" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "48px",
              height: "48px",
              borderRadius: "14px",
              background: "#fff7ed",
              border: "1.5px solid #fed7aa",
              fontSize: "22px",
              marginBottom: "16px",
            }}
          >
            📦
          </div>
          <h1
            style={{
              margin: "0 0 8px",
              fontSize: "26px",
              fontWeight: 800,
              color: "#111827",
              letterSpacing: "-0.5px",
            }}
          >
            My Orders
          </h1>
          <p style={{ margin: 0, fontSize: "15px", color: "#6b7280", lineHeight: 1.6 }}>
            Enter your email address to find your purchases and re-download your files.
          </p>
        </div>

        {/* Search form */}
        <form onSubmit={handleSubmit} style={{ marginBottom: "32px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <label
                htmlFor="email"
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#374151",
                  marginBottom: "6px",
                }}
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={{
                  display: "block",
                  width: "100%",
                  padding: "11px 14px",
                  borderRadius: "10px",
                  border: "1.5px solid #e5e7eb",
                  fontSize: "15px",
                  color: "#111827",
                  outline: "none",
                  boxSizing: "border-box",
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#f97316")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "12px 24px",
                borderRadius: "10px",
                background: loading ? "#e5e7eb" : "linear-gradient(135deg,#f97316 0%,#ea580c 100%)",
                color: loading ? "#9ca3af" : "#fff",
                fontSize: "15px",
                fontWeight: 700,
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: loading ? "none" : "0 4px 14px rgba(249,115,22,0.35)",
                transition: "opacity 0.15s",
                letterSpacing: "-0.2px",
              }}
            >
              {loading ? "Searching…" : "Find my orders"}
            </button>
          </div>
        </form>

        {/* Error */}
        {error && (
          <div
            style={{
              padding: "14px 16px",
              borderRadius: "10px",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#991b1b",
              fontSize: "14px",
              marginBottom: "24px",
            }}
          >
            {error}
          </div>
        )}

        {/* Results */}
        {searched && orders !== null && (
          <>
            {orders.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "48px 24px",
                  background: "#fafafa",
                  borderRadius: "16px",
                  border: "1.5px dashed #e5e7eb",
                }}
              >
                <div style={{ fontSize: "32px", marginBottom: "12px" }}>🔍</div>
                <p style={{ margin: "0 0 6px", fontWeight: 700, fontSize: "16px", color: "#111827" }}>
                  No orders found
                </p>
                <p style={{ margin: 0, fontSize: "14px", color: "#6b7280", lineHeight: 1.6 }}>
                  We couldn&apos;t find any completed orders for <strong>{email}</strong>. Make sure you&apos;re using the same email you used at checkout.
                </p>
              </div>
            ) : (
              <div>
                <p
                  style={{
                    margin: "0 0 16px",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#6b7280",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  {orders.length} order{orders.length !== 1 ? "s" : ""} found
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {orders.map((order) => {
                    const expired = isExpired(order.downloadExpiresAt);
                    const hasDownload = !!order.downloadToken && !!order.productId;
                    return (
                      <div
                        key={order.id}
                        style={{
                          background: "#fff",
                          border: "1.5px solid #f3f4f6",
                          borderRadius: "14px",
                          padding: "18px 20px",
                          boxShadow: "0 1px 6px rgba(0,0,0,0.04)",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            justifyContent: "space-between",
                            gap: "12px",
                            marginBottom: "12px",
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p
                              style={{
                                margin: "0 0 4px",
                                fontWeight: 700,
                                fontSize: "15px",
                                color: "#111827",
                                lineHeight: 1.3,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {order.productTitle}
                            </p>
                            <p style={{ margin: 0, fontSize: "13px", color: "#9ca3af" }}>
                              {formatDate(order.createdAt)} · {formatAmount(order.amountCents, order.currency)}
                            </p>
                          </div>
                          {expired && (
                            <span
                              style={{
                                display: "inline-block",
                                padding: "3px 8px",
                                borderRadius: "6px",
                                background: "#fef2f2",
                                color: "#b91c1c",
                                fontSize: "11px",
                                fontWeight: 700,
                                textTransform: "uppercase",
                                letterSpacing: "0.04em",
                                flexShrink: 0,
                              }}
                            >
                              Expired
                            </span>
                          )}
                        </div>

                        {hasDownload && (
                          <a
                            href={`/download/${order.productId}?token=${order.downloadToken}`}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              padding: "8px 16px",
                              borderRadius: "8px",
                              background: expired ? "#f9fafb" : "#fff7ed",
                              border: `1.5px solid ${expired ? "#e5e7eb" : "#fed7aa"}`,
                              color: expired ? "#9ca3af" : "#c2410c",
                              fontSize: "13px",
                              fontWeight: 700,
                              textDecoration: "none",
                              transition: "background 0.15s",
                            }}
                          >
                            <span>📥</span>
                            {expired ? "Download (expired)" : "Download Again"}
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* Footer note */}
        <p
          style={{
            textAlign: "center",
            marginTop: "40px",
            fontSize: "12px",
            color: "#d1d5db",
          }}
        >
          Powered by <span style={{ color: "#f97316", fontWeight: 600 }}>Content Flywheel</span>
        </p>
      </div>
    </main>
  );
}
