/**
 * POST /api/thumbnail-with-text
 * Body: { imageUrl: string; title: string }
 *
 * Fetches the thumbnail image server-side, composites bold title text on top
 * using Next.js ImageResponse (satori + resvg-wasm — zero extra dependencies),
 * uploads the result to Vercel Blob, and returns { url }.
 *
 * Doing this server-side completely avoids browser Canvas CORS restrictions.
 */
import { NextRequest, NextResponse } from "next/server";
import { ImageResponse } from "next/og";
import { auth } from "@clerk/nextjs/server";
import { put } from "@vercel/blob";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

// ── same logic as lib/thumbnail-text-overlay.ts ──────────────────────────────
function makeThumbnailHook(title: string): string {
  const main = title.split(/[:\-–—]/)[0].trim();
  const words = main.split(" ").filter(Boolean);
  if (words.length <= 4) return main.toUpperCase();
  const stop = new Set([
    "the","a","an","to","of","in","on","at","for","and","or","but","is","are",
    "was","were","be","been","has","have","had","do","does","did","will","would",
    "could","should","may","might","like","with","from","that","this","it","its",
    "by","as","up","out","if","so","not","no","we","you","your","my","our",
    "their","them","they","he","she","what","how","why","when","where","who",
    "which","than","then","also","about",
  ]);
  const power = words.filter((w) => !stop.has(w.toLowerCase()));
  return power.slice(0, 4).join(" ").toUpperCase();
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({})) as {
      imageUrl?: string;
      title?: string;
    };
    if (!body.imageUrl) {
      return NextResponse.json({ error: "imageUrl required" }, { status: 400 });
    }

    const hook = makeThumbnailHook(body.title ?? "");

    // ── Fetch the source image and convert to base64 data URL ─────────────────
    const imgRes = await fetch(body.imageUrl, {
      headers: { "User-Agent": "ContentFlywheel/1.0 (thumbnail-composer)" },
    });
    if (!imgRes.ok) {
      return NextResponse.json(
        { error: `Could not fetch image (${imgRes.status})` },
        { status: 502 }
      );
    }
    const imgBuffer = await imgRes.arrayBuffer();
    const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
    const base64 = Buffer.from(imgBuffer).toString("base64");
    const dataUrl = `data:${contentType};base64,${base64}`;

    // ── Decide font size based on hook length ─────────────────────────────────
    const fontSize = hook.length <= 8 ? 130 : hook.length <= 14 ? 100 : 76;

    // ── Composite using ImageResponse (satori → resvg PNG) ────────────────────
    const W = 1280;
    const H = 720;

    const imageResponse = new ImageResponse(
      (
        <div
          style={{
            width: W,
            height: H,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Background image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={dataUrl}
            width={W}
            height={H}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: W,
              height: H,
              objectFit: "cover",
            }}
          />

          {/* Dark scrim over bottom half */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              width: W,
              height: H * 0.55,
              background: "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.92) 100%)",
            }}
          />

          {/* Title text */}
          <div
            style={{
              position: "relative",
              display: "flex",
              justifyContent: "center",
              paddingBottom: 52,
              paddingLeft: 40,
              paddingRight: 40,
              width: "100%",
            }}
          >
            {/* Shadow layer (offset duplicate for contrast) */}
            <span
              style={{
                position: "absolute",
                fontSize,
                fontWeight: 900,
                color: "rgba(0,0,0,0.85)",
                letterSpacing: "-1px",
                top: 4,
                left: 44,
                right: 44,
                bottom: 48,
                textAlign: "center",
                display: "flex",
                justifyContent: "center",
              }}
            >
              {hook}
            </span>
            {/* White fill */}
            <span
              style={{
                fontSize,
                fontWeight: 900,
                color: "#FFFFFF",
                letterSpacing: "-1px",
                textAlign: "center",
              }}
            >
              {hook}
            </span>
          </div>
        </div>
      ),
      { width: W, height: H }
    );

    // ── Upload PNG to Vercel Blob ──────────────────────────────────────────────
    const pngBuffer = Buffer.from(await imageResponse.arrayBuffer());
    const filename = `thumbnails/${userId}/${randomBytes(8).toString("hex")}.png`;
    const blob = await put(filename, pngBuffer, {
      access: "public",
      contentType: "image/png",
    });

    return NextResponse.json({ url: blob.url });
  } catch (err) {
    console.error("[thumbnail-with-text]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
