import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { storeSettingsTable } from "@/db/schema/store-settings-schema";
import { eq } from "drizzle-orm";

function getDefaults(userId: string) {
  return {
    id: null,
    userId,
    theme: "warm",
    accentColor: "#f97316",
    layout: "grid",
    bannerImageUrl: null,
    bannerGradient: null,
    profileImageUrl: null,
    bio: null,
    storeName: null,
    tagline: null,
    showSocialLinks: false,
    socialLinks: null,
    announcementText: null,
    announcementColor: "#f97316",
    buttonText: "Subscribe for updates",
    fontFamily: "inter",
    productSort: "newest",
    showTrustBadges: true,
    vatEnabled: false,
    vatRate: 20,
    vatNumber: null,
    businessName: null,
    businessAddress: null,
    createdAt: null,
    updatedAt: null,
  };
}

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [settings] = await db
      .select()
      .from(storeSettingsTable)
      .where(eq(storeSettingsTable.userId, userId))
      .limit(1);

    return NextResponse.json(settings ?? getDefaults(userId));
  } catch (err) {
    console.error("[store-settings GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    // Allowlist fields that can be updated
    const allowed = [
      "theme",
      "accentColor",
      "layout",
      "bannerImageUrl",
      "bannerGradient",
      "profileImageUrl",
      "bio",
      "storeName",
      "tagline",
      "showSocialLinks",
      "socialLinks",
      "announcementText",
      "announcementColor",
      "buttonText",
      "fontFamily",
      "productSort",
      "showTrustBadges",
      "vatEnabled",
      "vatRate",
      "vatNumber",
      "businessName",
      "businessAddress",
      "customDomain",
    ] as const;

    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) {
        updates[key] = body[key];
      }
    }

    await db
      .insert(storeSettingsTable)
      .values({ userId, ...updates, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: storeSettingsTable.userId,
        set: { ...updates, updatedAt: new Date() },
      });

    const [updated] = await db
      .select()
      .from(storeSettingsTable)
      .where(eq(storeSettingsTable.userId, userId))
      .limit(1);

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[store-settings PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
