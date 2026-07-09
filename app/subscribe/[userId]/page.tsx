"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

type FormState = "idle" | "loading" | "success" | "error";

type CreatorInfo = {
  brandName: string | null;
  targetAudience: string | null;
  tone: string | null;
  productCount: number;
  profileImageUrl: string | null;
  accentColor: string;
  bio: string | null;
};

export default function SubscribePage() {
  const params = useParams();
  const userId = params.userId as string;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [formState, setFormState] = useState<FormState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [creator, setCreator] = useState<CreatorInfo | null>(null);
  const [creatorLoading, setCreatorLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/public/creator/${userId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: CreatorInfo | null) => { if (data) setCreator(data); })
      .catch(() => {})
      .finally(() => setCreatorLoading(false));
  }, [userId]);

  const accent = creator?.accentColor ?? "#f97316";
  const brandName = creator?.brandName ?? null;
  const initials = brandName
    ? brandName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "CF";

  const headline = brandName
    ? `Get exclusive updates from ${brandName}`
    : "Subscribe for exclusive updates & offers";

  const subheadline = brandName && creator?.targetAudience
    ? `Join ${creator.targetAudience} already following ${brandName} — content, deals and new drops straight to your inbox.`
    : brandName
    ? `Be the first to hear about new content, deals, and offers from ${brandName}.`
    : "Join the list and be the first to know about new content, deals, and more.";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMessage("Please enter a valid email address.");
      setFormState("error");
      return;
    }
    setFormState("loading");
    setErrorMessage("");
    try {
      const res = await fetch("/api/email/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, name: name.trim() || undefined, userId }),
      });
      const data = await res.json();
      if (!res.ok) { setErrorMessage(data.error ?? "Something went wrong."); setFormState("error"); return; }
      setFormState("success");
    } catch {
      setErrorMessage("Network error. Please check your connection.");
      setFormState("error");
    }
  };

  return (
    <main style={{
      minHeight: "100vh",
      background: "#f9fafb",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px 16px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div style={{ width: "100%", maxWidth: "480px" }}>

        {/* Loading skeleton — shown until creator data arrives */}
        {creatorLoading && (
          <div style={{
            backgroundColor: "#ffffff", borderRadius: "24px", overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 20px 60px rgba(0,0,0,0.10)",
            border: "1px solid #e5e7eb",
          }}>
            <div style={{ height: "6px", background: "#e5e7eb" }} />
            <div style={{ padding: "40px 40px 36px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "#f3f4f6", flexShrink: 0 }} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ height: "16px", background: "#f3f4f6", borderRadius: "6px", width: "60%" }} />
                  <div style={{ height: "12px", background: "#f3f4f6", borderRadius: "6px", width: "40%" }} />
                </div>
              </div>
              <div style={{ height: "28px", background: "#f3f4f6", borderRadius: "8px", width: "80%" }} />
              <div style={{ height: "16px", background: "#f3f4f6", borderRadius: "6px" }} />
              <div style={{ height: "16px", background: "#f3f4f6", borderRadius: "6px", width: "70%" }} />
              <div style={{ height: "48px", background: "#f3f4f6", borderRadius: "10px" }} />
              <div style={{ height: "48px", background: "#f3f4f6", borderRadius: "10px" }} />
              <div style={{ height: "48px", background: "#f3f4f6", borderRadius: "12px" }} />
            </div>
          </div>
        )}

        {/* Card — only render once creator data is resolved */}
        {!creatorLoading && <>
        <div style={{
          backgroundColor: "#ffffff",
          borderRadius: "24px",
          overflow: "hidden",
          boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 20px 60px rgba(0,0,0,0.10)",
          border: "1px solid #e5e7eb",
        }}>

          {/* Top colour bar */}
          <div style={{ height: "6px", background: `linear-gradient(90deg, ${accent}, ${accent}cc)` }} />

          <div style={{ padding: "40px 40px 36px" }}>

            {formState === "success" ? (
              /* ── Success ── */
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <div style={{
                  width: "72px", height: "72px", borderRadius: "50%",
                  background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 24px", fontSize: "34px",
                  boxShadow: `0 8px 24px ${accent}40`,
                }}>🎉</div>
                <h1 style={{ margin: "0 0 12px", fontSize: "24px", fontWeight: "800", color: "#111827", letterSpacing: "-0.5px", lineHeight: 1.2 }}>
                  {brandName ? `You're subscribed to ${brandName}!` : "You're subscribed!"}
                </h1>
                <p style={{ margin: 0, fontSize: "15px", color: "#6b7280", lineHeight: "1.65" }}>
                  {brandName
                    ? `Check your inbox for a welcome email. You'll be the first to know about new drops from ${brandName}.`
                    : "Check your inbox for a welcome email. Excited to have you!"}
                </p>
              </div>
            ) : (
              /* ── Form ── */
              <>
                {/* Profile */}
                <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "28px" }}>
                  {creator?.profileImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={creator.profileImageUrl} alt={brandName ?? "Creator"}
                      style={{ width: "64px", height: "64px", borderRadius: "50%", objectFit: "cover", border: `3px solid ${accent}30`, flexShrink: 0 }} />
                  ) : (
                    <div style={{
                      width: "64px", height: "64px", borderRadius: "50%", flexShrink: 0,
                      background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "22px", fontWeight: "800", color: "#fff", letterSpacing: "-1px",
                      boxShadow: `0 4px 14px ${accent}40`,
                    }}>{initials}</div>
                  )}
                  <div>
                    {brandName && (
                      <p style={{ margin: "0 0 2px", fontSize: "17px", fontWeight: "800", color: "#111827", letterSpacing: "-0.3px" }}>{brandName}</p>
                    )}
                    <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>Newsletter & updates</p>
                  </div>
                </div>

                {/* Headline */}
                <h1 style={{ margin: "0 0 10px", fontSize: "24px", fontWeight: "800", color: "#111827", lineHeight: "1.25", letterSpacing: "-0.5px" }}>
                  {headline}
                </h1>
                <p style={{ margin: "0 0 24px", fontSize: "15px", color: "#6b7280", lineHeight: "1.65" }}>
                  {subheadline}
                </p>

                {/* Social proof */}
                {creator && creator.productCount > 0 && (
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: "6px",
                    background: `${accent}12`, border: `1px solid ${accent}30`,
                    borderRadius: "100px", padding: "5px 14px",
                    marginBottom: "24px", fontSize: "13px",
                    color: accent, fontWeight: "700",
                  }}>
                    🔥 {creator.productCount} digital product{creator.productCount !== 1 ? "s" : ""} available
                  </div>
                )}

                {/* Error */}
                {formState === "error" && (
                  <div style={{
                    background: "#fef2f2", border: "1px solid #fecaca",
                    borderRadius: "10px", padding: "12px 16px",
                    marginBottom: "20px", display: "flex", gap: "10px",
                  }}>
                    <span style={{ fontSize: "15px", flexShrink: 0 }}>⚠️</span>
                    <p style={{ margin: 0, fontSize: "14px", color: "#b91c1c", lineHeight: "1.5" }}>{errorMessage}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {/* Name */}
                  <div>
                    <label htmlFor="sub-name" style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#374151", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      Name <span style={{ color: "#9ca3af", fontWeight: "400", textTransform: "none" }}>(optional)</span>
                    </label>
                    <input id="sub-name" type="text" placeholder="Jane Smith"
                      value={name} onChange={(e) => setName(e.target.value)}
                      disabled={formState === "loading"}
                      style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #e5e7eb", fontSize: "15px", color: "#111827", outline: "none", boxSizing: "border-box", backgroundColor: "#fff" }}
                      onFocus={(e) => { e.target.style.borderColor = accent; e.target.style.boxShadow = `0 0 0 3px ${accent}20`; }}
                      onBlur={(e) => { e.target.style.borderColor = "#e5e7eb"; e.target.style.boxShadow = "none"; }}
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label htmlFor="sub-email" style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#374151", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      Email address <span style={{ color: accent }}>*</span>
                    </label>
                    <input id="sub-email" type="email" placeholder="you@example.com"
                      value={email} onChange={(e) => { setEmail(e.target.value); if (formState === "error") { setFormState("idle"); setErrorMessage(""); } }}
                      disabled={formState === "loading"} required
                      style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: `1.5px solid ${formState === "error" ? "#fca5a5" : "#e5e7eb"}`, fontSize: "15px", color: "#111827", outline: "none", boxSizing: "border-box", backgroundColor: "#fff" }}
                      onFocus={(e) => { e.target.style.borderColor = accent; e.target.style.boxShadow = `0 0 0 3px ${accent}20`; }}
                      onBlur={(e) => { e.target.style.borderColor = formState === "error" ? "#fca5a5" : "#e5e7eb"; e.target.style.boxShadow = "none"; }}
                    />
                  </div>

                  {/* Submit */}
                  <button type="submit" disabled={formState === "loading"}
                    style={{
                      width: "100%", padding: "14px 20px", borderRadius: "12px", border: "none",
                      background: formState === "loading" ? `${accent}cc` : accent,
                      color: "#fff", fontSize: "15px", fontWeight: "700",
                      cursor: formState === "loading" ? "not-allowed" : "pointer",
                      boxShadow: `0 4px 16px ${accent}45`,
                      display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                      marginTop: "4px", transition: "opacity 0.15s, transform 0.1s",
                    }}
                    onMouseEnter={(e) => { if (formState !== "loading") { (e.currentTarget as HTMLButtonElement).style.opacity = "0.92"; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)"; } }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)"; }}
                  >
                    {formState === "loading" ? (
                      <>
                        <span style={{ display: "inline-block", width: "16px", height: "16px", border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                        Subscribing…
                      </>
                    ) : "Subscribe Now"}
                  </button>
                </form>

                {/* Trust line */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "16px", marginTop: "20px" }}>
                  {["🔒 No spam", "✉️ Free forever", "👋 Unsubscribe anytime"].map((t) => (
                    <span key={t} style={{ fontSize: "11px", color: "#9ca3af", fontWeight: "500" }}>{t}</span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <p style={{ textAlign: "center", marginTop: "20px", fontSize: "12px", color: "#9ca3af" }}>
          Powered by <span style={{ color: accent, fontWeight: "700" }}>Content Flywheel</span>
        </p>
        </>}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}
