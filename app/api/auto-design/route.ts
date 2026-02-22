/**
 * POST /api/auto-design
 * Given product title and niche, use OpenAI to suggest:
 * - colour palette (primary, secondary, accent) as hex
 * - font pairing (headingFont, bodyFont)
 * - Pexels search keyword for background image
 */
import { NextRequest, NextResponse } from "next/server";
import { getAutoDesignSuggestion } from "@/lib/auto-design-suggestion";

export type AutoDesignResult = Awaited<ReturnType<typeof getAutoDesignSuggestion>>;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const niche = typeof body.niche === "string" ? body.niche.trim() : "";
    const brandPrimary = typeof body.brandPrimary === "string" ? body.brandPrimary.trim() : "";
    const brandSecondary = typeof body.brandSecondary === "string" ? body.brandSecondary.trim() : "";

    const result = await getAutoDesignSuggestion({
      title,
      niche,
      ...(brandPrimary && brandSecondary ? { brandPrimary, brandSecondary } : {}),
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error("[auto-design] Error:", e);
    const message = e instanceof Error ? e.message : "Auto-design failed";
    const status = message.includes("not configured") ? 503 : 500;
    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}
