/**
 * GET /api/setup/timeline-bucket
 * Creates the Supabase storage bucket "timeline-media" if it does not exist.
 * Requires auth. Call once so video export (Phase 4) works.
 */
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const BUCKET = "timeline-media";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." },
        { status: 503 }
      );
    }

    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets?.some((b) => b.name === BUCKET);
    if (exists) {
      return NextResponse.json({ ok: true, message: `Bucket "${BUCKET}" already exists.` });
    }

    const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
    if (error) {
      console.error("[setup/timeline-bucket]", error);
      return NextResponse.json(
        { error: `Failed to create bucket: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, message: `Bucket "${BUCKET}" created.` });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[setup/timeline-bucket]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
