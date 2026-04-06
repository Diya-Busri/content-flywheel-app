export default function UnsubscribedPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#fafafa",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        padding: "24px",
      }}
    >
      <div style={{ maxWidth: "400px", textAlign: "center" }}>
        <div
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "50%",
            background: "#f0fdf4",
            border: "2px solid #bbf7d0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
            fontSize: "24px",
          }}
        >
          ✓
        </div>
        <h1
          style={{
            margin: "0 0 8px",
            fontSize: "22px",
            fontWeight: 700,
            color: "#111827",
          }}
        >
          You&apos;ve been unsubscribed
        </h1>
        <p style={{ margin: "0 0 24px", fontSize: "15px", color: "#6b7280", lineHeight: 1.6 }}>
          You won&apos;t receive any more emails from this creator. If this was a mistake, contact them directly.
        </p>
        <a
          href="/"
          style={{
            display: "inline-block",
            padding: "10px 24px",
            borderRadius: "8px",
            background: "#f97316",
            color: "#fff",
            fontSize: "14px",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Go to Content Flywheel
        </a>
      </div>
    </main>
  );
}
