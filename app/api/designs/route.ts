import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { designsTable, DesignData } from "@/db/schema/designs-schema";
import { eq, and, isNull, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const designs = await db
    .select()
    .from(designsTable)
    .where(and(eq(designsTable.userId, userId), isNull(designsTable.deletedAt)))
    .orderBy(desc(designsTable.updatedAt));

  return NextResponse.json({ designs });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim() : "Untitled Design";
  const data: DesignData = body.data ?? { width: 800, height: 1100, background: "#ffffff", elements: [] };

  const [design] = await db
    .insert(designsTable)
    .values({ userId, title, data })
    .returning();

  return NextResponse.json({ design }, { status: 201 });
}
