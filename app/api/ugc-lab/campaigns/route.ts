import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { ugcCampaignsTable, ugcCampaignProductsTable } from "@/db/schema/ugc-campaigns-schema";
import { eq, desc } from "drizzle-orm";

/** GET: List campaigns for the current user. */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const campaigns = await db
      .select()
      .from(ugcCampaignsTable)
      .where(eq(ugcCampaignsTable.userId, userId))
      .orderBy(desc(ugcCampaignsTable.createdAt));

    return NextResponse.json({ campaigns });
  } catch (err) {
    console.error("[campaigns] GET Error:", err);
    return NextResponse.json({ error: "Failed to list campaigns" }, { status: 500 });
  }
}

/** POST: Create a new campaign. */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const projectType = (body.projectType as string) ?? "affiliate";
    const campaignName = (body.campaignName as string)?.trim();

    if (!campaignName) {
      return NextResponse.json({ error: "campaignName is required" }, { status: 400 });
    }
    if (projectType !== "affiliate" && projectType !== "brand") {
      return NextResponse.json({ error: "projectType must be affiliate or brand" }, { status: 400 });
    }

    const [campaign] = await db
      .insert(ugcCampaignsTable)
      .values({
        userId,
        projectType: projectType as "affiliate" | "brand",
        campaignName,
      })
      .returning();

    return NextResponse.json({ campaign });
  } catch (err) {
    console.error("[campaigns] POST Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create campaign" },
      { status: 500 }
    );
  }
}
