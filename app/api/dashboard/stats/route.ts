import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { videosTable } from "@/db/schema/library-schema";
import { productsTable } from "@/db/schema/products-schema";
import { eq, gte, isNull, and, count } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const videoWhere = and(eq(videosTable.userId, userId), isNull(videosTable.deletedAt));

    const [
      totalVideosRow,
      videosThisWeekRow,
      videosThisMonthRow,
      totalProductsRow,
      allVideosForTemplates,
    ] = await Promise.all([
      db.select({ count: count() }).from(videosTable).where(videoWhere),
      db
        .select({ count: count() })
        .from(videosTable)
        .where(and(videoWhere, gte(videosTable.createdAt, sevenDaysAgo))),
      db
        .select({ count: count() })
        .from(videosTable)
        .where(and(videoWhere, gte(videosTable.createdAt, thirtyDaysAgo))),
      db
        .select({ count: count() })
        .from(productsTable)
        .where(and(eq(productsTable.userId, userId), isNull(productsTable.deletedAt))),
      // Fetch platforms + metadata to derive template types
      db
        .select({ platforms: videosTable.platforms, metadata: videosTable.metadata })
        .from(videosTable)
        .where(videoWhere)
        .limit(200),
    ]);

    const totalVideos = Number(totalVideosRow[0]?.count ?? 0);
    const videosThisWeek = Number(videosThisWeekRow[0]?.count ?? 0);
    const videosThisMonth = Number(videosThisMonthRow[0]?.count ?? 0);
    const totalProducts = Number(totalProductsRow[0]?.count ?? 0);

    // Derive template types from platforms array (first platform) or metadata.templateType
    const templateCounts: Record<string, number> = {};
    for (const row of allVideosForTemplates) {
      const meta = row.metadata as Record<string, unknown> | null;
      const templateType: string =
        (meta?.templateType as string | undefined) ||
        (meta?.format as string | undefined) ||
        (Array.isArray(row.platforms) && row.platforms.length > 0
          ? (row.platforms[0] as string)
          : null) ||
        "Other";
      templateCounts[templateType] = (templateCounts[templateType] ?? 0) + 1;
    }

    // Sort by count descending, return top 5
    const topTemplates = Object.entries(templateCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([templateType, count]) => ({ templateType, count }));

    return NextResponse.json({
      videosThisWeek,
      videosThisMonth,
      totalVideos,
      totalProducts,
      topTemplates,
    });
  } catch (err) {
    console.error("[dashboard/stats] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load stats" },
      { status: 500 }
    );
  }
}
