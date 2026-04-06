"use client";

import { useState } from "react";
import { useParams } from "next/navigation";

type FormState = "idle" | "loading" | "success" | "error";

export default function SubscribePage() {
  const params = useParams();
  const userId = params.userId as string;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [formState, setFormState] = useState<FormState>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const trimmedEmail = email.trim();
    const trimmedName = name.trim();

    if (!trimmedEmail) {
      setErrorMessage("Please enter your email address.");
      setFormState("error");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
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
        body: JSON.stringify({
          email: trimmedEmail,
          name: trimmedName || undefined,
          userId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error ?? "Something went wrong. Please try again.");
        setFormState("error");
        return;
      }

      setFormState("success");
    } catch {
      setErrorMessage("Network error. Please check your connection and try again.");
      setFormState("error");
    }
  };

  const handleReset = () => {
    setFormState("idle");
    setErrorMessage("");
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #fff7ed 0%, #ffedd5 40%, #fed7aa 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif",
      }}
    >
      <div style={{ width: "100%", maxWidth: "440px" }}>
        {/* Card */}
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "24px",
            padding: "48px 40px 40px",
            boxShadow:
              "0 4px 6px -1px rgba(0,0,0,0.07), 0 20px 60px -10px rgba(249,115,22,0.15)",
            border: "1px solid rgba(249,115,22,0.1)",
          }}
        >
          {formState === "success" ? (
            /* ---- Success state ---- */
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  width: "72px",
                  height: "72px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg,#f97316,#fb923c)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 24px",
                  fontSize: "32px",
                }}
              >
                🎉
              </div>
              <h1
                style={{
                  margin: "0 0 12px",
                  fontSize: "22px",
                  fontWeight: "700",
                  color: "#111827",
                  lineHeight: "1.3",
                }}
              >
                You&rsquo;re subscribed!
              </h1>
              <p
                style={{
                  margin: "0",
                  fontSize: "15px",
                  color: "#6b7280",
                  lineHeight: "1.65",
                }}
              >
                Check your inbox for a welcome email. We&rsquo;re excited to have you&nbsp;on board!
              </p>
            </div>
          ) : (
            /* ---- Form state ---- */
            <>
              {/* Icon */}
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "16px",
                  background: "linear-gradient(135deg,#f97316,#fb923c)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "24px",
                  fontSize: "24px",
                  boxShadow: "0 4px 12px rgba(249,115,22,0.3)",
                }}
              >
                ✉️
              </div>

              {/* Headline */}
              <h1
                style={{
                  margin: "0 0 8px",
                  fontSize: "26px",
                  fontWeight: "800",
                  color: "#111827",
                  lineHeight: "1.25",
                  letterSpacing: "-0.4px",
                }}
              >
                Subscribe for exclusive updates &amp; offers
              </h1>
              <p
                style={{
                  margin: "0 0 32px",
                  fontSize: "15px",
                  color: "#6b7280",
                  lineHeight: "1.6",
                }}
              >
                Join the list and be the first to know about new content, deals, and more.
              </p>

              {/* Error banner */}
              {formState === "error" && (
                <div
                  style={{
                    backgroundColor: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: "10px",
                    padding: "12px 16px",
                    marginBottom: "20px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                  }}
                >
                  <span style={{ fontSize: "16px", flexShrink: 0, marginTop: "1px" }}>⚠️</span>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "14px",
                      color: "#b91c1c",
                      lineHeight: "1.5",
                    }}
                  >
                    {errorMessage}
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* Name field */}
                <div>
                  <label
                    htmlFor="sub-name"
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "#374151",
                      marginBottom: "6px",
                      letterSpacing: "0.01em",
                    }}
                  >
                    Name{" "}
                    <span style={{ color: "#9ca3af", fontWeight: "400" }}>(optional)</span>
                  </label>
                  <input
                    id="sub-name"
                    type="text"
                    placeholder="Jane Smith"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={formState === "loading"}
                    style={{
                      width: "100%",
                      padding: "11px 14px",
                      borderRadius: "10px",
                      border: "1.5px solid #e5e7eb",
                      fontSize: "15px",
                      color: "#111827",
                      outline: "none",
                      transition: "border-color 0.15s",
                      boxSizing: "border-box",
                      backgroundColor: formState === "loading" ? "#f9fafb" : "#ffffff",
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = "#f97316";
                      e.target.style.boxShadow = "0 0 0 3px rgba(249,115,22,0.12)";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "#e5e7eb";
                      e.target.style.boxShadow = "none";
                    }}
                  />
                </div>

                {/* Email field */}
                <div>
                  <label
                    htmlFor="sub-email"
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "#374151",
                      marginBottom: "6px",
                      letterSpacing: "0.01em",
                    }}
                  >
                    Email address <span style={{ color: "#f97316" }}>*</span>
                  </label>
                  <input
                    id="sub-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (formState === "error") handleReset();
                    }}
                    disabled={formState === "loading"}
                    required
                    style={{
                      width: "100%",
                      padding: "11px 14px",
                      borderRadius: "10px",
                      border: `1.5px solid ${formState === "error" ? "#fca5a5" : "#e5e7eb"}`,
                      fontSize: "15px",
                      color: "#111827",
                      outline: "none",
                      transition: "border-color 0.15s",
                      boxSizing: "border-box",
                      backgroundColor: formState === "loading" ? "#f9fafb" : "#ffffff",
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = "#f97316";
                      e.target.style.boxShadow = "0 0 0 3px rgba(249,115,22,0.12)";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor =
                        formState === "error" ? "#fca5a5" : "#e5e7eb";
                      e.target.style.boxShadow = "none";
                    }}
                  />
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={formState === "loading"}
                  style={{
                    width: "100%",
                    padding: "13px 20px",
                    borderRadius: "10px",
                    border: "none",
                    background:
                      formState === "loading"
                        ? "#fb923c"
                        : "linear-gradient(135deg,#f97316 0%,#ea6c0a 100%)",
                    color: "#ffffff",
                    fontSize: "15px",
                    fontWeight: "700",
                    cursor: formState === "loading" ? "not-allowed" : "pointer",
                    transition: "opacity 0.15s, transform 0.1s",
                    boxShadow: "0 4px 14px rgba(249,115,22,0.35)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    marginTop: "4px",
                  }}
                  onMouseEnter={(e) => {
                    if (formState !== "loading") {
                      (e.currentTarget as HTMLButtonElement).style.opacity = "0.92";
                      (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.opacity = "1";
                    (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                  }}
                >
                  {formState === "loading" ? (
                    <>
                      <span
                        style={{
                          display: "inline-block",
                          width: "16px",
                          height: "16px",
                          border: "2px solid rgba(255,255,255,0.4)",
                          borderTopColor: "#ffffff",
                          borderRadius: "50%",
                          animation: "spin 0.7s linear infinite",
                        }}
                      />
                      Subscribing&hellip;
                    </>
                  ) : (
                    "Subscribe Now"
                  )}
                </button>
              </form>

              <p
                style={{
                  margin: "20px 0 0",
                  fontSize: "12px",
                  color: "#9ca3af",
                  textAlign: "center",
                  lineHeight: "1.5",
                }}
              >
                No spam, ever. Unsubscribe at any time.
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <p
          style={{
            textAlign: "center",
            marginTop: "24px",
            fontSize: "12px",
            color: "#d1d5db",
          }}
        >
          Powered by{" "}
          <span style={{ color: "#f97316", fontWeight: "600" }}>Content Flywheel</span>
        </p>
      </div>

      {/* Inline keyframe for spinner */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </main>
  );
}
