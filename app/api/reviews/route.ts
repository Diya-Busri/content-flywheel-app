import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { client } from "@/db/db";

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
    console.error("[POST /api/reviews]", err);
    return NextResponse.json(
      { error: "Failed to save review" },
      { status: 500 }
    );
  }
}
