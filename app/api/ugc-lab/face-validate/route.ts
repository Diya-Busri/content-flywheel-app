import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const MIN_DIMENSION = 256;

/**
 * POST: Validate face image before save.
 * Checks: format, size, dimensions.
 * Returns validation result. Face count validation can be added via client or future integration.
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ACCEPTED_TYPES.includes(file.type)) {
      return NextResponse.json({
        valid: false,
        error: "Invalid format. Use JPEG, PNG, or WebP.",
      });
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({
        valid: false,
        error: "Image too large. Max 5MB.",
      });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const dimensions = await getImageDimensions(buffer, file.type);
    if (!dimensions) {
      return NextResponse.json({
        valid: false,
        error: "Could not read image dimensions.",
      });
    }

    const { width, height } = dimensions;
    if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
      return NextResponse.json({
        valid: false,
        error: `Image too small. Minimum ${MIN_DIMENSION}x${MIN_DIMENSION}px.`,
      });
    }

    return NextResponse.json({
      valid: true,
      width,
      height,
      message: "Image valid. Ensure a single, clear front-facing face for best results.",
    });
  } catch (err) {
    console.error("[face-validate] Error:", err);
    return NextResponse.json(
      { valid: false, error: err instanceof Error ? err.message : "Validation failed" },
      { status: 500 }
    );
  }
}

async function getImageDimensions(
  buffer: Buffer,
  mime: string
): Promise<{ width: number; height: number } | null> {
  try {
    if (mime === "image/png") return parsePngDimensions(buffer);
    if (mime === "image/jpeg" || mime === "image/jpg") return parseJpegDimensions(buffer);
    if (mime === "image/webp") return parseWebpDimensions(buffer);
  } catch {
    // fall through
  }
  return null;
}

function parseJpegDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 2 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset < buffer.length - 1) {
    if (buffer[offset] !== 0xff) break;
    const marker = buffer[offset + 1];
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      const h = buffer.readUInt16BE(offset + 5);
      const w = buffer.readUInt16BE(offset + 7);
      return { width: w, height: h };
    }
    const len = buffer.readUInt16BE(offset + 2);
    offset += 2 + len;
  }
  return null;
}

function parsePngDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 24 || buffer.toString("ascii", 0, 8) !== "\x89PNG\r\n\x1a\n") return null;
  const w = buffer.readUInt32BE(16);
  const h = buffer.readUInt32BE(20);
  return { width: w, height: h };
}

function parseWebpDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 30 || buffer.toString("ascii", 0, 4) !== "RIFF") return null;
  const fmt = buffer.toString("ascii", 8, 12);
  if (fmt === "VP8 ") {
    const w = buffer.readUInt16LE(26) & 0x3fff;
    const h = buffer.readUInt16LE(28) & 0x3fff;
    return { width: w, height: h };
  }
  if (fmt === "VP8L" && buffer.length >= 25) {
    const b0 = buffer.readUInt32LE(21);
    const w = ((b0 & 0x3fff) + 1);
    const h = (((b0 >> 14) & 0x3fff) + 1);
    return { width: w, height: h };
  }
  if (fmt === "VP8X" && buffer.length >= 30) {
    const w = (buffer.readUIntLE(24, 3) + 1);
    const h = (buffer.readUIntLE(27, 3) + 1);
    return { width: w, height: h };
  }
  return null;
}
