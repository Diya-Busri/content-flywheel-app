/**
 * GET /api/proxy-image?url=<encoded-image-url>
 * Fetches the image and returns the image bytes with the correct Content-Type.
 * No base64 encoding. Only allows https URLs from Pexels/Unsplash.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";

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
    console.error("[proxy-image] Missing url parameter", { search: request.nextUrl.search });
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(urlParam);
  } catch (e) {
    console.error("[proxy-image] Invalid url", { urlParam: urlParam.slice(0, 200), error: e });
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  if (targetUrl.protocol !== "https:") {
    console.error("[proxy-image] Non-https URL rejected", { target: targetUrl.toString() });
    return NextResponse.json({ error: "Only https URLs are allowed" }, { status: 400 });
  }

  if (!isAllowedOrigin(targetUrl)) {
    console.error("[proxy-image] Origin not allowed", { host: targetUrl.hostname, target: targetUrl.toString() });
    return NextResponse.json({ error: "URL origin not allowed" }, { status: 403 });
  }

  try {
    const imageUrl = targetUrl.toString();
    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent": "ContentFlywheel/1.0 (image proxy)",
        Accept: "image/*",
      },
      next: { revalidate: 86400 },
    });

    if (!response.ok) {
      const bodyPreview = await response.text().then((t) => t.slice(0, 300)).catch(() => "");
      console.error("[proxy-image] Upstream error", {
        status: response.status,
        statusText: response.statusText,
        url: imageUrl,
        contentType: response.headers.get("content-type"),
        bodyPreview: bodyPreview.slice(0, 200),
      });
      return NextResponse.json({ error: "Failed to fetch image", status: response.status }, { status: 502 });
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength === 0) {
      console.error("[proxy-image] Empty response body", { url: imageUrl });
      return NextResponse.json({ error: "Empty image response" }, { status: 502 });
    }

    const contentType = sanitizeContentType(response.headers.get("content-type"));

    if (process.env.NODE_ENV !== "production") {
      console.log("[proxy-image] OK", { url: imageUrl.slice(0, 80), contentType, byteLength: buffer.byteLength });
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[proxy-image] Fetch error", {
      url: targetUrl.toString(),
      message,
      stack: stack?.slice(0, 500),
    });
    return NextResponse.json({ error: "Proxy failed", detail: message }, { status: 502 });
  }
}
