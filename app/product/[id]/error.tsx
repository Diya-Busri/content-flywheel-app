"use client";

export default function ProductPageError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main style={{ minHeight: "100vh", background: "#f5f4f0", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", padding: "48px 24px" }}>
        <p style={{ fontSize: "15px", color: "#6b7280", marginBottom: "20px" }}>Something went wrong loading this product page.</p>
        <button
          onClick={reset}
          style={{ padding: "12px 28px", borderRadius: "10px", background: "#f97316", color: "#fff", fontWeight: 700, fontSize: "15px", border: "none", cursor: "pointer" }}
        >
          Try again
        </button>
      </div>
    </main>
  );
}
