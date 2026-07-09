export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { scriptsTable } from "@/db/schema/library-schema";
import { eq, and, desc, isNull } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");
    const platform = searchParams.get("platform");

    const conditions = [
      eq(scriptsTable.userId, userId),
      isNull(scriptsTable.deletedAt),
      ...(productId ? [eq(scriptsTable.productId, productId)] : []),
      ...(platform ? [eq(scriptsTable.platform, platform)] : []),
    ];

    const rows = await db
      .select()
      .from(scriptsTable)
      .where(and(...conditions))
      .orderBy(desc(scriptsTable.createdAt));

    return NextResponse.json(rows);
  } catch (err) {
    console.error("Library scripts list error:", err);
    return NextResponse.json({ error: "Failed to fetch scripts" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const { title, content, platform = "all", videoId, productId } = body as {
      title?: string;
      content?: string;
      platform?: string;
      videoId?: string;
      productId?: string;
    };

    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "content is required" }, { status: 400 });
    }

    const displayTitle = (title && String(title).trim()) || "Untitled Script";
    const [inserted] = await db
      .insert(scriptsTable)
      .values({
        userId,
        title: displayTitle,
        content,
        platform: platform || "all",
        videoId: videoId || null,
        productId: productId || null,
      })
      .returning();

    if (!inserted?.id) return NextResponse.json({ error: "Failed to save script" }, { status: 500 });
    return NextResponse.json(inserted);
  } catch (err) {
    console.error("Library script save error:", err);
    return NextResponse.json({ error: "Failed to save script" }, { status: 500 });
  }
}
