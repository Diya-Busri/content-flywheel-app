import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getPresignedUploadUrl } from "@/lib/storage";
import { checkApiRateLimit, getClientIp } from "@/lib/rate-limit-api";

export const dynamic = "force-dynamic";

/**
 * POST /api/challenge/upload
 * Public (no auth) — used by the 100 Product Challenge submission form to
 * request a short-lived presigned PUT URL for one product file/preview
 * (cover, PDF, screenshots, etc.) ahead of final submission. The browser
 * then PUTs the file bytes directly to R2 using that URL — the file never
 * passes through this serverless function.
 *
 * This mirrors the existing app/api/upload/product-file-presign pattern:
 * proxying file bytes through a Vercel Function is capped at 4.5MB per
 * request, which silently breaks any product PDF/zip larger than a few MB.
 * Direct-to-R2 upload has no such limit (bounded only by MAX_FILE_BYTES
 * below, enforced client-side and via the presigned URL's expiry).
 *
 * Only an opaque private key is ever returned — never a public URL — and
 * that key gets attached to the submission on final /api/challenge/submit.
 * The final submit route re-validates the file count server-side, since
 * this route has no submission id yet to scope a per-submission limit to.
 */

const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50MB per file
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/zip",
  "application/x-zip-compressed",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // pptx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
  "application/epub+zip",
]);

function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(0, 80);
  return cleaned || "file";
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const limited = await checkApiRateLimit(ip);
    if (limited) return limited;

    const body = await request.json().catch(() => null);
    const filename = typeof body?.filename === "string" ? body.filename : "";
    const contentType = typeof body?.contentType === "string" ? body.contentType : "";
    const size = typeof body?.size === "number" ? body.size : 0;

    if (!filename) {
      return NextResponse.json({ error: "No filename provided" }, { status: 400 });
    }
    if (!size || size <= 0) {
      return NextResponse.json({ error: "File is empty" }, { status: 400 });
    }
    if (size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "File is too large (50MB max)" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(contentType)) {
      return NextResponse.json(
        { error: "Unsupported file type. Allowed: PDF, PNG, JPG, WEBP, GIF, ZIP, DOCX, PPTX, XLSX, EPUB." },
        { status: 400 }
      );
    }

    const safeName = sanitizeFilename(filename);
    const key = `private/challenge/${randomUUID()}-${safeName}`;

    // Only the upload URL and key are returned — getPresignedUploadUrl also
    // returns a publicUrl, which we deliberately drop here since these
    // objects must never be reachable by a plain public link.
    const { uploadUrl } = await getPresignedUploadUrl(key, contentType, 600);

    return NextResponse.json({
      uploadUrl,
      key,
      originalName: filename,
      size,
      type: contentType,
      uploadedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[challenge/upload] POST error:", err);
    return NextResponse.json({ error: "Failed to prepare upload" }, { status: 500 });
  }
}
