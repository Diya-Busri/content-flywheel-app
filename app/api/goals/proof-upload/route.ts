export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { getSupabaseAdmin } from "@/lib/supabase/server";

// Create a public "proof-images" bucket in Supabase Storage; if not configured, ProofModal falls back to base64
const BUCKET = "proof-images";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const { imageBase64 } = body as { imageBase64?: string };
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return NextResponse.json(
        { error: "imageBase64 required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json(
        { error: "Storage not configured", fallback: true },
        { status: 503 }
      );
    }

    let base64Data = imageBase64;
    let mediaType = "image/png";
    const dataUrlMatch = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
    if (dataUrlMatch) {
      mediaType = dataUrlMatch[1] || "image/png";
      base64Data = dataUrlMatch[2];
    }

    const ext = mediaType.includes("png") ? "png" : mediaType.includes("jpeg") || mediaType.includes("jpg") ? "jpg" : "png";
    const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const buffer = Buffer.from(base64Data, "base64");

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, buffer, {
        contentType: mediaType,
        upsert: false,
      });

    if (error) {
      console.error("Supabase storage upload error:", error);
      return NextResponse.json(
        { error: "Upload failed", fallback: true },
        { status: 500 }
      );
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
    return NextResponse.json({ url: urlData.publicUrl });
  } catch (err) {
    console.error("Proof upload error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed", fallback: true },
      { status: 500 }
    );
  }
}
