/**
 * POST /api/auto-design
 * Given product title and niche, use OpenAI to suggest:
 * - colour palette (primary, secondary, accent) as hex
 * - font pairing (headingFont, bodyFont)
 * - Pexels search keyword for background image
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { getAutoDesignSuggestion } from "@/lib/auto-design-suggestion";

export type AutoDesignResult = Awaited<ReturnType<typeof getAutoDesignSuggestion>>;

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const apiRl = await checkApiRateLimit(userId);
    if (apiRl) return apiRl;

    const body = await request.json().catch(() => ({}));
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const niche = typeof body.niche === "string" ? body.niche.trim() : "";
    const brandPrimary = typeof body.brandPrimary === "string" ? body.brandPrimary.trim() : "";
    const brandSecondary = typeof body.brandSecondary === "string" ? body.brandSecondary.trim() : "";
    const regenerate = Boolean(body.regenerate);

    const result = await getAutoDesignSuggestion({
      title,
      niche,
      ...(brandPrimary && brandSecondary ? { brandPrimary, brandSecondary } : {}),
      ...(regenerate ? { regenerate: true } : {}),
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
