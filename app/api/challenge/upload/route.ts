import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { uploadPrivate } from "@/lib/storage";
import { checkApiRateLimit, getClientIp } from "@/lib/rate-limit-api";

export const dynamic = "force-dynamic";

/**
 * POST /api/challenge/upload
 * Public (no auth) — used by the 100 Product Challenge submission form to
 * upload one product file/preview at a time (cover, PDF, screenshots, etc.)
 * ahead of final submission. Files are stored privately in R2 (see
 * lib/storage.ts uploadPrivate) — never a public URL, only an opaque key
 * that gets attached to the submission on final /api/challenge/submit.
 *
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

    const formData = await request.formData().catch(() => null);
    const file = formData?.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "File is empty" }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "File is too large (50MB max)" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Unsupported file type. Allowed: PDF, PNG, JPG, WEBP, GIF, ZIP, DOCX, PPTX, XLSX, EPUB." },
        { status: 400 }
      );
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(await file.arrayBuffer());
    } catch {
      return NextResponse.json({ error: "File appears to be corrupted" }, { status: 400 });
    }
    if (buffer.length === 0) {
      return NextResponse.json({ error: "File appears to be corrupted" }, { status: 400 });
    }

    const safeName = sanitizeFilename(file.name || "file");
    const key = `private/challenge/${randomUUID()}-${safeName}`;

    await uploadPrivate(key, buffer, file.type);

    return NextResponse.json({
      key,
      originalName: file.name || safeName,
      size: file.size,
      type: file.type,
      uploadedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[challenge/upload] POST error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
