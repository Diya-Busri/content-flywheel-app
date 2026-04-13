/**
 * GET /api/proxy-thumbnail?url=<encoded-image-url>
 *
 * Server-side proxy for thumbnail images so the browser Canvas API can
 * composite them without hitting CORS restrictions.  Requires auth so it
 * can't be abused as an open proxy.  Allows any https URL because thumbnail
 * images are always from CDNs we control or trust (OpenAI DALL-E, Vercel Blob).
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

function sanitizeContentType(ct: string | null): string {
  if (!ct || !ct.startsWith("image/")) return "image/jpeg";
  const mime = ct.split(";")[0].trim().toLowerCase();
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  return allowed.includes(mime) ? mime : "image/jpeg";
}

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const urlParam = request.nextUrl.searchParams.get("url");
  if (!urlParam) {
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

  try {
    const response = await fetch(targetUrl.toString(), {
      headers: {
        "User-Agent": "ContentFlywheel/1.0 (thumbnail proxy)",
        Accept: "image/*",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch image", status: response.status },
        { status: 502 }
      );
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength === 0) {
      return NextResponse.json({ error: "Empty image response" }, { status: 502 });
    }

    const contentType = sanitizeContentType(response.headers.get("content-type"));

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        // Allow canvas to read the image pixels
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (err) {
    console.error("[proxy-thumbnail] Fetch error", err);
    return NextResponse.json(
      { error: "Proxy failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
