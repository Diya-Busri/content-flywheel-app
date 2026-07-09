import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { creatorEmailSettingsTable } from "@/db/schema/creator-email-settings-schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [settings] = await db
    .select()
    .from(creatorEmailSettingsTable)
    .where(eq(creatorEmailSettingsTable.userId, userId))
    .limit(1);

  return NextResponse.json(settings ?? null);
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { leadMagnetProductId, leadMagnetEnabled, subscribePageTitle, subscribePageDescription } = body;

  const [existing] = await db
    .select({ id: creatorEmailSettingsTable.id })
    .from(creatorEmailSettingsTable)
    .where(eq(creatorEmailSettingsTable.userId, userId))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(creatorEmailSettingsTable)
      .set({ leadMagnetProductId: leadMagnetProductId ?? null, leadMagnetEnabled: !!leadMagnetEnabled, subscribePageTitle: subscribePageTitle ?? null, subscribePageDescription: subscribePageDescription ?? null, updatedAt: new Date() })
      .where(eq(creatorEmailSettingsTable.id, existing.id))
      .returning();
    return NextResponse.json(updated);
  }

  const [created] = await db
    .insert(creatorEmailSettingsTable)
    .values({ userId, leadMagnetProductId: leadMagnetProductId ?? null, leadMagnetEnabled: !!leadMagnetEnabled, subscribePageTitle: subscribePageTitle ?? null, subscribePageDescription: subscribePageDescription ?? null })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
