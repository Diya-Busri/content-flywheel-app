export const dynamic = "force-dynamic";
import { auth } from "@clerk/nextjs/server";
import { getPresignedUploadUrl } from "@/lib/storage";
import { NextResponse } from "next/server";

/**
 * POST /api/upload/store-image-presign
 * Returns a short-lived presigned PUT URL so the browser uploads
 * directly to R2, bypassing Vercel's 4.5MB body limit.
 * Body: { filename: string, contentType: string, uploadType: "banner" | "profile" }
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { filename, contentType, uploadType } = await request.json();

    if (!contentType?.startsWith("image/")) {
      return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 });
    }

    const ext = filename?.split(".").pop() ?? "jpg";
    const key = `store/${userId}/${uploadType ?? "banner"}-${Date.now()}.${ext}`;

    const { uploadUrl, publicUrl } = await getPresignedUploadUrl(key, contentType, 300);

    return NextResponse.json({ uploadUrl, publicUrl });
  } catch (err) {
    console.error("[upload/store-image-presign] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate upload URL" },
      { status: 500 }
    );
  }
}
