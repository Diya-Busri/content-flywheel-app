import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

/**
 * POST /api/reviews — save a user review.
 * Uses Supabase service role client (bypasses RLS). Stores Clerk user ID in clerk_user_id.
 * Requires: reviews table with clerk_user_id column (db/migrations/0042_reviews_clerk_user_id.sql).
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (set in Vercel).
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { rating, reviewText, isPublic } = body as {
      rating?: number;
      reviewText?: string;
      isPublic?: boolean;
    };

    if (rating == null || typeof rating !== "number") {
      return NextResponse.json(
        { error: "rating is required and must be a number" },
        { status: 400 }
      );
    }
    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "rating must be between 1 and 5" },
        { status: 400 }
      );
    }

    const review_text = typeof reviewText === "string" ? reviewText.trim() : "";
    const is_public = rating === 5 && !!isPublic;

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      console.error("[POST /api/reviews] Supabase admin client missing. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.");
      return NextResponse.json(
        {
          error: "Server configuration error",
          details: { message: "Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel environment variables." },
        },
        { status: 503 }
      );
    }

    const { error } = await supabaseAdmin.from("reviews").insert({
      rating,
      review_text: review_text || null,
      clerk_user_id: userId,
      is_public: is_public,
      is_approved: false,
    });

    if (error) {
      console.error("[POST /api/reviews] Review insert error:", error);
      return NextResponse.json(
        { error: error.message, details: error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[POST /api/reviews] Review insert error:", err);
    const details =
      err && typeof err === "object"
        ? Object.fromEntries(
            Object.entries(err as Record<string, unknown>).filter(
              ([k, v]) => typeof v !== "function" && v !== undefined
            )
          )
        : { raw: String(err) };
    return NextResponse.json(
      { error: message, details },
      { status: 500 }
    );
  }
}
