export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { markOnboardingStep } from "@/lib/onboarding-auto-complete";

/**
 * POST: Create a blank product in "draft" state with empty sections.
 * No content generation is triggered — user builds it manually with the AI assistant.
 * Body: { title: string, pageCount?: number }
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkApiRateLimit(userId);
    if (rl) return rl;

    const body = await request.json().catch(() => ({}));
    const title = (typeof body.title === "string" ? body.title.trim() : "") || "Untitled Product";
    const niche = typeof body.niche === "string" ? body.niche.trim() : "";
    const format = typeof body.format === "string" ? body.format.trim() : "ebook";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const pageCount = Math.min(Math.max(parseInt(body.pageCount ?? "5") || 5, 1), 50);

    const sections = Array.from({ length: pageCount }, (_, i) => ({
      id: `page-${i + 1}`,
      title: `Page ${i + 1}`,
      content: "",
      order: i + 1,
    }));

    const designSettings = {
      template: "modern",
      colors: { primary: "#FF6B35", secondary: "#004E89", accent: "#F7B32B" },
      typography: { heading: "Inter", body: "Open Sans", size: 16 },
    };

    const [inserted] = await db
      .insert(productsTable)
      .values({
        userId,
        title,
        niche,
        format,
        content: { sections },
        designSettings,
        placedElements: [],
        status: "draft",
      })
      .returning({ id: productsTable.id });

    if (!inserted?.id) {
      return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
    }

    markOnboardingStep(userId, "firstProduct").catch(() => {});
    return NextResponse.json({ productId: inserted.id, success: true });
  } catch (err) {
    console.error("[products/create-blank]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create product" },
      { status: 500 }
    );
  }
}
