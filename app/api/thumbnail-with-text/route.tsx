/**
 * POST /api/thumbnail-with-text
 * Body: { imageUrl: string; title: string }
 *
 * Fetches the thumbnail image server-side, composites bold title text using
 * Next.js ImageResponse (satori + resvg-wasm), uploads to Vercel Blob,
 * returns { url }.
 */
import { NextRequest, NextResponse } from "next/server";
import { ImageResponse } from "next/og";
import { auth } from "@clerk/nextjs/server";
import { put } from "@vercel/blob";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

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

    // ── Fetch source image → base64 data URL ─────────────────────────────────
    const imgRes = await fetch(body.imageUrl, {
      headers: { "User-Agent": "ContentFlywheel/1.0" },
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

    // font size based on hook word length
    const fontSize = hook.length <= 8 ? 140 : hook.length <= 14 ? 110 : 80;

    const W = 1280;
    const H = 720;

    // ── Use backgroundImage on the root div — simplest satori layout ─────────
    // satori supports backgroundImage with data URLs natively.
    const imageResponse = new ImageResponse(
      (
        <div
          style={{
            width: W,
            height: H,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            // Background image fills entire canvas
            backgroundImage: `url(${dataUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {/* Dark gradient + text at the bottom */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "flex-end",
              paddingBottom: 54,
              paddingLeft: 40,
              paddingRight: 40,
              paddingTop: 160,
              background:
                "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.92) 100%)",
            }}
          >
            <span
              style={{
                fontSize,
                fontWeight: 900,
                color: "#FFFFFF",
                textAlign: "center",
                letterSpacing: "-2px",
                lineHeight: 1.1,
              }}
            >
              {hook}
            </span>
          </div>
        </div>
      ),
      { width: W, height: H }
    );

    // ── Upload to Vercel Blob ─────────────────────────────────────────────────
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
