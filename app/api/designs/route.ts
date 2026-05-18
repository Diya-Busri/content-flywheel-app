import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { designsTable, DesignData } from "@/db/schema/designs-schema";
import { eq, and, isNull, desc } from "drizzle-orm";
// Note: designs belonging to a bundle have bundleId set — exclude them from the standalone list

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const designs = await db
    .select()
    .from(designsTable)
    .where(and(eq(designsTable.userId, userId), isNull(designsTable.deletedAt), isNull(designsTable.bundleId)))
    .orderBy(desc(designsTable.updatedAt));

  return NextResponse.json({ designs });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim() : "Untitled Design";
  const data: DesignData = body.data ?? { width: 800, height: 1100, background: "#ffffff", elements: [] };
  const bundleId = typeof body.bundleId === "string" ? body.bundleId : undefined;
  const slideIndex = typeof body.slideIndex === "number" ? body.slideIndex : undefined;

  const [design] = await db
    .insert(designsTable)
    .values({ userId, title, data, bundleId, slideIndex })
    .returning();

  return NextResponse.json({ design }, { status: 201 });
}
