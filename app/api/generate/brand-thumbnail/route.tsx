/**
 * POST /api/generate/brand-thumbnail
 *
 * Generates a YouTube thumbnail in the channel's brand style:
 * black background, gold bold text, channel name sub-label.
 * No AI image needed — pure CSS rendered server-side via Next.js ImageResponse.
 *
 * Body: {
 *   title: string       — Main hook text (3-5 words, shown large)
 *   subtitle?: string   — Optional sub-line (e.g. channel name, shown small)
 *   style?: "gold" | "red" | "blue"  — accent colour (default: gold)
 * }
 * Returns: { url: string } — public Vercel Blob URL for the PNG
 */
import { NextRequest, NextResponse } from "next/server";
import { ImageResponse } from "next/og";
import { auth } from "@clerk/nextjs/server";
import { put } from "@vercel/blob";
import { randomBytes } from "crypto";
import { makeThumbnailHook } from "@/lib/thumbnail-text-overlay";

export const dynamic = "force-dynamic";

const W = 1280;
const H = 720;

const ACCENT_COLOURS = {
  gold: "#FFD700",
  red:  "#FF3B30",
  blue: "#0A84FF",
} as const;

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({})) as {
      title?: string;
      subtitle?: string;
      style?: "gold" | "red" | "blue";
    };

    const rawTitle = typeof body.title === "string" ? body.title.trim() : "";
    if (!rawTitle) return NextResponse.json({ error: "title is required" }, { status: 400 });

    const hook = makeThumbnailHook(rawTitle);
    const subtitle = typeof body.subtitle === "string" ? body.subtitle.trim() : "";
    const accent = ACCENT_COLOURS[body.style ?? "gold"] ?? ACCENT_COLOURS.gold;

    // Font size: shrink for longer hooks
    const hookWords = hook.split(" ").length;
    const fontSize = hookWords <= 2 ? 180 : hookWords === 3 ? 155 : hookWords === 4 ? 130 : 108;

    const imageResponse = new ImageResponse(
      (
        <div
          style={{
            width: W,
            height: H,
            background: "#000000",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "60px 80px",
            position: "relative",
          }}
        >
          {/* Gold accent bar top */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 10,
              background: accent,
              display: "flex",
            }}
          />

          {/* Gold accent bar bottom */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 10,
              background: accent,
              display: "flex",
            }}
          />

          {/* Main hook text */}
          <div
            style={{
              fontSize,
              fontWeight: 900,
              color: accent,
              textAlign: "center",
              letterSpacing: "-3px",
              lineHeight: 1.05,
              textTransform: "uppercase",
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              maxWidth: "100%",
            }}
          >
            {hook}
          </div>

          {/* Divider line */}
          <div
            style={{
              width: 120,
              height: 4,
              background: accent,
              marginTop: 28,
              marginBottom: subtitle ? 20 : 0,
              borderRadius: 2,
              display: "flex",
            }}
          />

          {/* Subtitle / channel name */}
          {subtitle && (
            <div
              style={{
                fontSize: 38,
                fontWeight: 600,
                color: "#FFFFFF",
                opacity: 0.85,
                textAlign: "center",
                letterSpacing: "4px",
                textTransform: "uppercase",
                display: "flex",
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
      ),
      { width: W, height: H }
    );

    const pngBuffer = Buffer.from(await imageResponse.arrayBuffer());
    const filename = `thumbnails/${userId}/${randomBytes(8).toString("hex")}_brand.png`;
    const blob = await put(filename, pngBuffer, {
      access: "public",
      contentType: "image/png",
    });

    return NextResponse.json({ url: blob.url });
  } catch (err) {
    console.error("[brand-thumbnail]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate thumbnail" },
      { status: 500 }
    );
  }
}
