/**
 * Debug endpoint: Test HeyGen API connectivity.
 * GET /api/test-heygen
 * Returns avatar list if HEYGEN_API_KEY is valid.
 */
import { NextResponse } from "next/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";

export async function GET() {
  const hasKey = Boolean(process.env.HEYGEN_API_KEY?.trim());
  if (!hasKey) {
    return NextResponse.json(
      {
        success: false,
        error: "HEYGEN_API_KEY is not set in .env.local",
        hint: "Add HEYGEN_API_KEY to .env.local and restart the dev server",
      },
      { status: 503 }
    );
  }

  try {
    const response = await fetch("https://api.heygen.com/v2/avatars", {
      headers: {
        "X-Api-Key": process.env.HEYGEN_API_KEY!,
      },
    });
    const data = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: `HeyGen API returned ${response.status}`,
          status: response.status,
          data,
        },
        { status: 500 }
      );
    }
    const avatars = (data.data as { avatars?: unknown[] })?.avatars ?? [];
    return NextResponse.json({
      success: true,
      avatarCount: avatars.length,
      data: { ...data, _truncated: avatars.length > 3 ? `(showing first 3 of ${avatars.length})` : undefined },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[test-heygen] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: msg,
      },
      { status: 500 }
    );
  }
}
