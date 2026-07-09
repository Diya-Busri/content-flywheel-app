export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

async function proxyImage(url: string): Promise<NextResponse> {
  if (!url || !url.startsWith("http")) {
    return new NextResponse("Missing or invalid url", { status: 400 });
  }
  try {
    // cache: "no-store" forces a fresh fetch even if the browser previously cached
    // the image without CORS headers — this is the whole point of the proxy.
    const upstream = await fetch(url, {
      headers: { "User-Agent": "ContentFlywheel/1.0" },
      cache: "no-store",
    });
    if (!upstream.ok) {
      return new NextResponse(`Upstream error ${upstream.status}`, { status: 502 });
    }
    const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
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
