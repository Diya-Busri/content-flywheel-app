import { auth } from "@clerk/nextjs/server";
import { getPresignedUploadUrl } from "@/lib/storage";
import { NextResponse } from "next/server";

const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/zip": "zip",
  "application/x-zip-compressed": "zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/epub+zip": "epub",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/**
 * POST /api/upload/product-file-presign
 * Returns a presigned PUT URL so the browser uploads directly to R2,
 * bypassing Vercel's 4.5MB serverless body limit.
 * Body: { filename: string, contentType: string }
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { filename, contentType } = await request.json();

    if (!ALLOWED_TYPES[contentType]) {
      return NextResponse.json(
        { error: "File type not supported. Please upload PDF, ZIP, DOCX, PPTX, XLSX, EPUB, PNG, or JPG." },
        { status: 400 }
      );
    }

    const safeName = (filename as string)
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 80);

    const key = `products/${userId}/files/${Date.now()}-${safeName}`;
    const { uploadUrl, publicUrl } = await getPresignedUploadUrl(key, contentType, 600);

    return NextResponse.json({ uploadUrl, publicUrl });
  } catch (err) {
    console.error("[upload/product-file-presign] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate upload URL" },
      { status: 500 }
    );
  }
}
