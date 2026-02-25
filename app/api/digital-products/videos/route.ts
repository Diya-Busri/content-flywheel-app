/**
 * GET: Fetch generated videos for a product (from library, linked by productId).
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { videosTable } from "@/db/schema/library-schema";
import { eq, desc, and, isNull } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");
    if (!productId) {
      return NextResponse.json({ error: "productId required" }, { status: 400 });
    }

    const rows = await db
      .select()
      .from(videosTable)
      .where(
        and(
          eq(videosTable.userId, userId),
          eq(videosTable.productId, productId),
          isNull(videosTable.deletedAt)
        )
      )
      .orderBy(desc(videosTable.createdAt));

    const videos = rows.map((r) => {
      const meta = (r.metadata ?? {}) as { videoUrl?: string; duration?: number; scriptId?: string };
      return {
        id: r.id,
        title: r.title,
        url: meta.videoUrl ?? null,
        duration: meta.duration,
      };
    }).filter((v) => v.url);

    return NextResponse.json({ videos });
  } catch (err) {
    console.error("[digital-products/videos]", err);
    return NextResponse.json({ error: "Failed to fetch videos" }, { status: 500 });
  }
}
