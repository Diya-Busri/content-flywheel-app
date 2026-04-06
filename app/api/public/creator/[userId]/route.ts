import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/db";
import { brandVoiceTable } from "@/db/schema/brand-voice-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and, isNull, count } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * Public endpoint: returns minimal creator info for the subscribe page.
 * No authentication required — only exposes non-sensitive display fields.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  try {
    // Verify the creator exists
    const [profile] = await db
      .select({ userId: profilesTable.userId })
      .from(profilesTable)
      .where(eq(profilesTable.userId, userId))
      .limit(1);

    if (!profile) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    // Fetch brand voice (optional — may not exist)
    const [brandVoice] = await db
      .select({
        brandName: brandVoiceTable.brandName,
        targetAudience: brandVoiceTable.targetAudience,
        tone: brandVoiceTable.tone,
      })
      .from(brandVoiceTable)
      .where(eq(brandVoiceTable.userId, userId))
      .limit(1);

    // Fetch active product count for social proof
    const [productCountRow] = await db
      .select({ count: count() })
      .from(productsTable)
      .where(
        and(
          eq(productsTable.userId, userId),
          isNull(productsTable.deletedAt)
        )
      );

    const productCount = Number(productCountRow?.count ?? 0);

    return NextResponse.json({
      brandName: brandVoice?.brandName ?? null,
      targetAudience: brandVoice?.targetAudience ?? null,
      tone: brandVoice?.tone ?? null,
      productCount,
    });
  } catch (e) {
    console.error("[public/creator] GET error:", e);
    return NextResponse.json({ error: "Failed to load creator" }, { status: 500 });
  }
}
