/**
 * GET /api/proxy-image?url=<encoded-image-url>[&format=raw]
 * Fetches the image server-side and returns:
 * - Default: body is a base64 data URL string (text/plain) for PDF export / html2canvas.
 * - format=raw: body is the image bytes (for <img src="..."> in the editor).
 * Only allows https URLs from Pexels/Unsplash.
 */
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_ORIGINS = [
  "images.pexels.com",
  "www.pexels.com",
  "pexels.com",
  "images.unsplash.com",
  "unsplash.com",
];

function isAllowedOrigin(parsed: URL): boolean {
  const host = parsed.hostname.toLowerCase();
  return ALLOWED_ORIGINS.some((origin) => host === origin || host.endsWith("." + origin));
}

function sanitizeContentType(ct: string | null): string {
  if (!ct || !ct.startsWith("image/")) return "image/jpeg";
  const mime = ct.split(";")[0].trim().toLowerCase();
  return mime === "image/jpeg" || mime === "image/png" || mime === "image/webp" ? mime : "image/jpeg";
}

export async function GET(request: NextRequest) {
  const urlParam = request.nextUrl.searchParams.get("url");
  if (!urlParam || typeof urlParam !== "string") {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(urlParam);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  if (targetUrl.protocol !== "https:") {
    return NextResponse.json({ error: "Only https URLs are allowed" }, { status: 400 });
  }

  if (!isAllowedOrigin(targetUrl)) {
    return NextResponse.json({ error: "URL origin not allowed" }, { status: 403 });
  }

  const formatRaw = request.nextUrl.searchParams.get("format") === "raw";

  try {
    const res = await fetch(targetUrl.toString(), {
      headers: {
        "User-Agent": "ContentFlywheel/1.0 (image proxy)",
        Accept: "image/*",
      },
      next: { revalidate: 86400 },
    });

    if (!res.ok) {
      console.warn("[proxy-image] Upstream error:", res.status, targetUrl.toString());
      return NextResponse.json({ error: "Failed to fetch image" }, { status: res.status });
    }

    const contentType = sanitizeContentType(res.headers.get("content-type"));
    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let base64 = "";
    if (typeof Buffer !== "undefined") {
      base64 = Buffer.from(bytes).toString("base64");
    } else {
      const bin = Array.from(bytes)
        .map((b) => String.fromCharCode(b))
        .join("");
      base64 = btoa(bin);
    }

    const dataUrl = `data:${contentType};base64,${base64}`;

    if (formatRaw) {
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=86400, s-maxage=86400",
        },
      });
    }

    return new NextResponse(dataUrl, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch (err) {
    console.error("[proxy-image] Fetch error:", err);
    return NextResponse.json({ error: "Proxy failed" }, { status: 502 });
  }
}
