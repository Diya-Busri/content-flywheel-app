import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/db";
import { brandVoiceTable } from "@/db/schema/brand-voice-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { productsTable } from "@/db/schema/products-schema";
import { storeSettingsTable } from "@/db/schema/store-settings-schema";
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
    // Verify the creator exists and has not been deleted
    const [profile] = await db
      .select({ userId: profilesTable.userId, deletedAt: profilesTable.deletedAt })
      .from(profilesTable)
      .where(eq(profilesTable.userId, userId))
      .limit(1);

    if (!profile || profile.deletedAt !== null) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    // Fetch brand voice + store settings in parallel
    const [[brandVoice], [storeSettings], [productCountRow]] = await Promise.all([
      db.select({ brandName: brandVoiceTable.brandName, targetAudience: brandVoiceTable.targetAudience, tone: brandVoiceTable.tone })
        .from(brandVoiceTable).where(eq(brandVoiceTable.userId, userId)).limit(1),
      db.select({ profileImageUrl: storeSettingsTable.profileImageUrl, accentColor: storeSettingsTable.accentColor, bio: storeSettingsTable.bio })
        .from(storeSettingsTable).where(eq(storeSettingsTable.userId, userId)).limit(1),
      db.select({ count: count() }).from(productsTable)
        .where(and(eq(productsTable.userId, userId), isNull(productsTable.deletedAt))),
    ]);

    const productCount = Number(productCountRow?.count ?? 0);

    return NextResponse.json({
      brandName: brandVoice?.brandName ?? null,
      targetAudience: brandVoice?.targetAudience ?? null,
      tone: brandVoice?.tone ?? null,
      productCount,
      profileImageUrl: storeSettings?.profileImageUrl ?? null,
      accentColor: storeSettings?.accentColor ?? "#f97316",
      bio: storeSettings?.bio ?? null,
    });
  } catch (e) {
    console.error("[public/creator] GET error:", e);
    return NextResponse.json({ error: "Failed to load creator" }, { status: 500 });
  }
}
