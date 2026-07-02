export const dynamic = "force-dynamic";
/**
 * POST: Upload a media file (music, voiceover, etc.) to Supabase Storage.
 * FormData: file (required).
 * Returns: { url: string } (public URL).
 * Bucket: timeline-media. Path: {userId}/{timestamp}_{filename}.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const BUCKET = "timeline-media";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await request.formData().catch(() => null);
    if (!formData) return NextResponse.json({ error: "FormData required" }, { status: 400 });

    const file = formData.get("file") as File | null;
    if (!file || typeof file.arrayBuffer !== "function") {
      return NextResponse.json({ error: "file required" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = `${userId}/${Date.now()}_${file.name}`;

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json(
        { error: "Storage not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." },
        { status: 503 }
      );
    }

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: true,
      });

    if (error) {
      console.error("[upload-asset] Storage error:", error);
      return NextResponse.json(
        { error: error.message ?? "Upload failed" },
        { status: 500 }
      );
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
    return NextResponse.json({ url: urlData.publicUrl });
  } catch (err) {
    console.error("[upload-asset]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
