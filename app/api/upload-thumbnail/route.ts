import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { put } from "@vercel/blob";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

/**
 * POST: Upload a base64-encoded PNG thumbnail (with text overlay already composited client-side).
 * Body: { imageBase64: string }  (full data URL or raw base64)
 * Returns: { url: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({})) as { imageBase64?: string };
    if (!body.imageBase64) return NextResponse.json({ error: "imageBase64 required" }, { status: 400 });

    // Strip data URL prefix if present
    const base64 = body.imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64, "base64");

    const filename = `thumbnails/${userId}/${randomBytes(8).toString("hex")}.png`;
    const blob = await put(filename, buffer, { access: "public", contentType: "image/png" });

    return NextResponse.json({ url: blob.url });
  } catch (err) {
    console.error("[upload-thumbnail]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Upload failed" }, { status: 500 });
  }
}
