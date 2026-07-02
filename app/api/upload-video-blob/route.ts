export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { getPresignedUploadUrl } from "@/lib/storage";

export const runtime = "nodejs";

const ALLOWED_CONTENT_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-msvideo",
  "video/mpeg",
  "video/x-matroska",
]);

const MAX_SIZE_BYTES = 200 * 1024 * 1024; // 200 MB

/**
 * POST { filename: string, contentType: string, size?: number }
 * → { uploadUrl: string, publicUrl: string }
 *
 * Client PUTs the file directly to uploadUrl, then uses publicUrl as the stored URL.
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const apiRl = await checkApiRateLimit(userId);
    if (apiRl) return apiRl;

    const body = await request.json() as { filename?: string; contentType?: string; size?: number };
    const { filename, contentType, size } = body;

    if (!filename || !contentType) {
      return NextResponse.json({ error: "filename and contentType required" }, { status: 400 });
    }
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      return NextResponse.json({ error: "Content type not allowed" }, { status: 400 });
    }
    if (size && size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: "File too large (max 200 MB)" }, { status: 400 });
    }

    const ext = filename.split(".").pop() ?? "mp4";
    const pathname = `uploads/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { uploadUrl, publicUrl } = await getPresignedUploadUrl(pathname, contentType, 300);
    return NextResponse.json({ uploadUrl, publicUrl });
  } catch (err) {
    console.error("[upload-video-blob]", err);
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
