import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { client } from "@/db/db";

/**
 * POST /api/reviews — save a user review.
 * Requires: reviews table (e.g. db/migrations/0001_reviews.sql run in production).
 * If using Supabase with RLS, the reviews table policy uses auth.uid(); a direct
 * postgres connection from Next.js may not set auth.uid(), causing insert to fail.
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

    const text = typeof reviewText === "string" ? reviewText.trim() : "";
    const allowPublic = rating === 5 && !!isPublic;

    await client`
      INSERT INTO reviews (user_id, rating, review_text, is_public, is_approved)
      VALUES (${userId}, ${rating}, ${text}, ${allowPublic}, false)
    `;

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = err && typeof err === "object" && "code" in err ? String((err as { code: unknown }).code) : undefined;
    const detail = err && typeof err === "object" && "detail" in err ? String((err as { detail: unknown }).detail) : undefined;
    console.error("[POST /api/reviews] Full error:", {
      message,
      code,
      detail,
      stack: err instanceof Error ? err.stack : undefined,
    });
    const errorPayload = {
      error: "Failed to save review",
      message,
      ...(code && { code }),
      ...(detail && { detail }),
    };
    return NextResponse.json(errorPayload, { status: 500 });
  }
}
