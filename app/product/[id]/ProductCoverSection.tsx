"use client";

import { useState, useEffect } from "react";

interface Props {
  coverImage: string | null;
  productTitle: string;
  format: string | null;
  uploadedFileUrl: string | null;
  productId: string;
  isOwner: boolean;
}

export function ProductCoverSection({
  coverImage,
  productTitle,
  format,
  uploadedFileUrl,
  productId,
  isOwner,
}: Props) {
  const [generating, setGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [pdfPages, setPdfPages] = useState<string[]>([]);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState(false);

  const displayImage = generatedUrl ?? coverImage;

  // Load PDF preview pages
  useEffect(() => {
    if (!uploadedFileUrl) return;
    const lower = uploadedFileUrl.toLowerCase();
    const isPdf = lower.includes(".pdf") || lower.includes("pdf");
    if (!isPdf) return;

    setPdfLoading(true);
    setPdfError(false);

    // Load pdf.js from CDN
    const scriptId = "pdfjs-script";
    const existing = document.getElementById(scriptId);

    const renderPdf = async () => {
      try {
        // @ts-ignore
        const pdfjsLib = window["pdfjs-dist/build/pdf"];
        if (!pdfjsLib) throw new Error("pdfjs not loaded");
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

        const pdf = await pdfjsLib.getDocument({ url: uploadedFileUrl, withCredentials: false }).promise;
        const pageUrls: string[] = [];
        const numPages = Math.min(2, pdf.numPages);

        for (let i = 1; i <= numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.8 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d")!;
          await page.render({ canvasContext: ctx, viewport }).promise;
          pageUrls.push(canvas.toDataURL("image/jpeg", 0.92));
        }

        setPdfPages(pageUrls);
      } catch {
        setPdfError(true);
      } finally {
        setPdfLoading(false);
      }
    };

    if (existing) {
      renderPdf();
    } else {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      script.onload = () => renderPdf();
      script.onerror = () => { setPdfLoading(false); setPdfError(true); };
      document.head.appendChild(script);
    }
  }, [uploadedFileUrl]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/products/${productId}/generate-thumbnail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ style: "modern-gradient" }),
      });
      if (res.ok) {
        const data = (await res.json()) as { url?: string };
        if (data.url) setGeneratedUrl(data.url);
      }
    } finally {
      setGenerating(false);
    }
  };

  const formatLabel = format
    ? format.charAt(0).toUpperCase() + format.slice(1).replace(/_/g, " ")
    : "Digital Product";

  return (
    <>
      {/* Cover image or placeholder */}
      {displayImage ? (
        <div
          style={{
            borderRadius: "20px",
            overflow: "hidden",
            boxShadow: "0 8px 40px rgba(0,0,0,0.12)",
            marginBottom: "28px",
            lineHeight: 0,
            background: "#f3f4f6",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displayImage}
            alt={productTitle}
            style={{ width: "100%", maxWidth: "600px", display: "block", objectFit: "contain" }}
          />
        </div>
      ) : (
        /* Styled placeholder cover */
        <div
          style={{
            borderRadius: "20px",
            overflow: "hidden",
            boxShadow: "0 8px 40px rgba(0,0,0,0.12)",
            marginBottom: "16px",
            background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
            padding: "60px 40px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "320px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "48px", marginBottom: "20px" }}>📖</div>
          <h3
            style={{
              margin: "0 0 10px",
              color: "#fff",
              fontSize: "24px",
              fontWeight: "800",
              lineHeight: 1.25,
              letterSpacing: "-0.5px",
            }}
          >
            {productTitle}
          </h3>
          {format && (
            <p
              style={{
                margin: 0,
                color: "rgba(255,255,255,0.5)",
                fontSize: "12px",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                fontWeight: "600",
              }}
            >
              {formatLabel}
            </p>
          )}
        </div>
      )}

      {/* Owner: generate cover button */}
      {isOwner && !displayImage && (
        <button
          onClick={handleGenerate}
          disabled={generating}
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: "12px",
            border: "2px dashed #e5e7eb",
            background: generating ? "#f9fafb" : "transparent",
            cursor: generating ? "not-allowed" : "pointer",
            marginBottom: "24px",
            color: "#6b7280",
            fontSize: "14px",
            fontWeight: "600",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            transition: "border-color 0.15s, color 0.15s",
          }}
          onMouseEnter={(e) => {
            if (!generating) {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#f97316";
              (e.currentTarget as HTMLButtonElement).style.color = "#f97316";
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "#e5e7eb";
            (e.currentTarget as HTMLButtonElement).style.color = "#6b7280";
          }}
        >
          {generating ? (
            <>
              <span
                style={{
                  width: "14px",
                  height: "14px",
                  border: "2px solid #d1d5db",
                  borderTopColor: "#f97316",
                  borderRadius: "50%",
                  display: "inline-block",
                  animation: "spin 0.7s linear infinite",
                }}
              />
              Generating cover…
            </>
          ) : (
            <>✨ Generate a cover for this product</>
          )}
        </button>
      )}

      {/* PDF preview pages */}
      {pdfLoading && (
        <div
          style={{
            padding: "24px",
            textAlign: "center",
            color: "#9ca3af",
            fontSize: "14px",
            marginBottom: "24px",
            background: "#fff",
            borderRadius: "16px",
            border: "1px solid #f3f4f6",
          }}
        >
          Loading preview pages…
        </div>
      )}

      {pdfPages.length > 0 && (
        <div style={{ marginBottom: "28px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "14px",
            }}
          >
            <span
              style={{
                fontSize: "12px",
                fontWeight: "700",
                color: "#374151",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Preview
            </span>
            <span
              style={{
                fontSize: "12px",
                color: "#9ca3af",
                fontWeight: "500",
              }}
            >
              First {pdfPages.length} page{pdfPages.length > 1 ? "s" : ""}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {pdfPages.map((url, i) => (
              <div
                key={i}
                style={{
                  borderRadius: "16px",
                  overflow: "hidden",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                  lineHeight: 0,
                  border: "1px solid #e5e7eb",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Preview page ${i + 1}`}
                  style={{ width: "100%", display: "block" }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
