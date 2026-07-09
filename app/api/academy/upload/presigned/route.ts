export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ALLOWED_BUCKETS = new Set([
  "academy-videos",
  "academy-images",
  "academy-downloads",
  "academy-community",
]);

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-180);
}

/**
 * Returns a Supabase presigned upload URL so the browser can upload
 * directly to Supabase Storage — no file bytes pass through Vercel,
 * which sidesteps the 4.5 MB serverless request-body limit.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { bucket, folder = "", filename, contentType } = body as {
      bucket: string;
      folder?: string;
      filename: string;
      contentType?: string;
    };

    if (!ALLOWED_BUCKETS.has(bucket)) {
      return NextResponse.json({ error: "Invalid bucket" }, { status: 400 });
    }
    if (!filename) {
      return NextResponse.json({ error: "filename required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json(
        { error: "Storage is not configured" },
        { status: 500 }
      );
    }

    const cleanFolder = folder.replace(/^\/+|\/+$/g, "");
    const safeName = `${Date.now()}-${sanitizeName(filename)}`;
    const path = cleanFolder ? `${cleanFolder}/${safeName}` : safeName;

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(path);

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || "Failed to create upload URL" },
        { status: 500 }
      );
    }

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
      process.env.SUPABASE_URL?.trim() ||
      "";
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;

    return NextResponse.json({
      signedUrl: data.signedUrl,
      path,
      publicUrl,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create upload URL";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
