import { NextRequest, NextResponse } from "next/server";

/**
 * html2canvas cross-origin image proxy.
 * html2canvas POSTs the image URL as plain text in the request body.
 * We fetch it server-side (no CORS restrictions) and return a base64 data URL.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    // html2canvas sends "url=<encoded>" or just the raw URL
    const url = body.startsWith("url=")
      ? decodeURIComponent(body.slice(4))
      : body.trim();

    if (!url || !url.startsWith("http")) {
      return new NextResponse("Missing or invalid url", { status: 400 });
    }

    const upstream = await fetch(url, { headers: { "User-Agent": "ContentFlywheel/1.0" } });
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
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    console.error("[image-proxy]", err);
    return new NextResponse("Proxy error", { status: 500 });
  }
}
