"use client";
import { useState } from "react";

export function ShareButtons({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);

  const twitterUrl = `https://twitter.com/intent/tweet?text=Check+this+out:+${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(title + " " + url)}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const el = document.createElement("textarea");
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const btnStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "6px 14px",
    borderRadius: "999px",
    background: "#f3f4f6",
    color: "#374151",
    fontSize: "13px",
    fontWeight: 600,
    border: "1px solid #e5e7eb",
    cursor: "pointer",
    textDecoration: "none",
    transition: "background 0.15s",
    whiteSpace: "nowrap" as const,
  };

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center", marginTop: "16px" }}>
      <a
        href={twitterUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={btnStyle}
      >
        <span>🐦</span> Share on X
      </a>
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={btnStyle}
      >
        <span>💬</span> WhatsApp
      </a>
      <button
        onClick={handleCopy}
        style={{
          ...btnStyle,
          background: copied ? "#d1fae5" : "#f3f4f6",
          color: copied ? "#065f46" : "#374151",
          border: copied ? "1px solid #6ee7b7" : "1px solid #e5e7eb",
        }}
      >
        <span>🔗</span> {copied ? "Copied!" : "Copy Link"}
      </button>
    </div>
  );
}
