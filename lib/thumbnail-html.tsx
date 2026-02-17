/**
 * Generate product thumbnails from HTML/style — no external image API.
 * Uses Next.js ImageResponse for a gradient background, product title, and type badge.
 */

import { ImageResponse } from "next/og";

export type ThumbnailStyleId =
  | "modern-gradient"
  | "clean-minimal"
  | "bold-dark"
  | "lifestyle";

const WIDTH = 1792;
const HEIGHT = 1024;

function getTypeLabel(format?: string): string {
  if (!format) return "Digital Product";
  const f = format.toLowerCase();
  if (f.includes("workbook")) return "Workbook";
  if (f.includes("planner")) return "Planner";
  if (f.includes("journal")) return "Journal";
  if (f.includes("spreadsheet")) return "Spreadsheet";
  if (f.includes("ebook")) return "eBook";
  return "Digital Product";
}

const STYLE_COLORS: Record<
  ThumbnailStyleId,
  { bg: string; title: string; badgeBg: string; badgeText: string }
> = {
  "modern-gradient": {
    bg: "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)",
    title: "#ffffff",
    badgeBg: "rgba(255,255,255,0.25)",
    badgeText: "#ffffff",
  },
  "clean-minimal": {
    bg: "linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)",
    title: "#0f172a",
    badgeBg: "#334155",
    badgeText: "#f8fafc",
  },
  "bold-dark": {
    bg: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)",
    title: "#f8fafc",
    badgeBg: "rgba(248,250,252,0.2)",
    badgeText: "#f8fafc",
  },
  "lifestyle": {
    bg: "linear-gradient(135deg, #fef3c7 0%, #fcd34d 30%, #f59e0b 100%)",
    title: "#1f2937",
    badgeBg: "rgba(31,41,55,0.85)",
    badgeText: "#fef3c7",
  },
};

export type GenerateHtmlThumbnailResult = { buffer: ArrayBuffer };

/**
 * Generate a thumbnail image (title + gradient + product type badge). No external API.
 */
export async function generateHtmlThumbnail(
  product: { title: string; niche: string; format?: string },
  style: ThumbnailStyleId
): Promise<GenerateHtmlThumbnailResult> {
  const title = product.title?.trim() || "Digital Product";
  const typeLabel = getTypeLabel(product.format);
  const colors = STYLE_COLORS[style];

  const response = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: colors.bg,
          padding: 80,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 32,
          }}
        >
          <div
            style={{
              background: colors.badgeBg,
              color: colors.badgeText,
              padding: "12px 24px",
              borderRadius: 999,
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: "0.05em",
            }}
          >
            {typeLabel}
          </div>
          <h1
            style={{
              color: colors.title,
              fontSize: 72,
              fontWeight: 700,
              textAlign: "center",
              maxWidth: "90%",
              lineHeight: 1.2,
              margin: 0,
            }}
          >
            {title}
          </h1>
        </div>
      </div>
    ),
    { width: WIDTH, height: HEIGHT }
  );

  const buffer = await response.arrayBuffer();
  return { buffer };
}
