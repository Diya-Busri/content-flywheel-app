export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

/**
 * Domains this proxy is allowed to fetch from.
 * Used by html2canvas to load images that have restrictive CORS headers.
 * Keep this list tight — every entry is a potential SSRF surface.
 */
const ALLOWED_ORIGINS = [
  // Vercel Blob — all generated/uploaded assets
  "public.blob.vercel-storage.com",
  // Supabase Storage — product thumbnails, cover images
  "supabase.co",
  "supabase.in",
  // fal.ai CDN — AI-generated images
  "fal.media",
  "v2.fal.media",
  // Cloudflare R2 — alternative asset host
  "r2.dev",
  "cloudflarestorage.com",
  // Unsplash / Pexels — stock photos used in designs
  "images.unsplash.com",
  "images.pexels.com",
  // Ideogram CDN
  "ideogram.ai",
  "cdn.ideogram.ai",
];

function isAllowedOrigin(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  // Only allow HTTPS
  if (parsed.protocol !== "https:") return false;
  // Block private IP ranges and localhost
  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.startsWith("192.168.") ||
    host.startsWith("10.") ||
    host.startsWith("172.") ||
    host.endsWith(".local") ||
    host === "metadata.google.internal" ||
    host === "169.254.169.254"
  ) {
    return false;
  }
  return ALLOWED_ORIGINS.some((origin) => host === origin || host.endsWith("." + origin));
}

async function proxyImage(url: string): Promise<NextResponse> {
  if (!url) {
    return new NextResponse("Missing url", { status: 400 });
  }

  if (!isAllowedOrigin(url)) {
    console.warn("[image-proxy] Blocked disallowed origin", { url: url.slice(0, 200) });
    return new NextResponse("URL origin not allowed", { status: 403 });
  }

  try {
    // cache: "no-store" forces a fresh fetch even if the browser previously cached
    // the image without CORS headers — this is the whole point of the proxy.
    const upstream = await fetch(url, {
      headers: { "User-Agent": "ContentFlywheel/1.0 (image proxy)" },
      cache: "no-store",
    });
    if (!upstream.ok) {
      return new NextResponse(`Upstream error ${upstream.status}`, { status: 502 });
    }
    const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
    // Only return image types — never forward HTML, JSON, etc.
    if (!contentType.startsWith("image/")) {
      return new NextResponse("Not an image", { status: 415 });
    }
    const arrayBuffer = await upstream.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const dataUrl = `data:${contentType};base64,${base64}`;
    return new NextResponse(dataUrl, {
      headers: {
        "Content-Type": "text/plain",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error("[image-proxy]", err);
    return new NextResponse("Proxy error", { status: 500 });
  }
}

/**
 * GET /api/image-proxy?url=encodedUrl
 * html2canvas 1.x sends GET requests to the proxy URL.
 * Format: /api/image-proxy?url={encodedUrl}&responseType=text
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url") ?? "";
  return proxyImage(url);
}

/**
 * POST /api/image-proxy (legacy — older html2canvas versions POST the URL in the body)
 */
export async function POST(req: NextRequest) {
  const body = await req.text();
  const url = body.startsWith("url=")
    ? decodeURIComponent(body.slice(4))
    : body.trim();
  return proxyImage(url);
}
