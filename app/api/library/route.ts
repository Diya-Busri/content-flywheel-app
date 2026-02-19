import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { scriptsTable, videosTable } from "@/db/schema/library-schema";
import { eq, desc, and, isNull, isNotNull } from "drizzle-orm";

type LibraryItem = {
  id: string;
  type: "product" | "video" | "script";
  title: string;
  thumbnail?: string;
  status: string;
  createdAt: string;
  productId?: string;
  videoId?: string;
  scriptId?: string;
  format?: string;
  bundleId?: string | null;
  platform?: string;
  deletedAt?: string;
};

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const typeFilter = searchParams.get("type") || "all";
    const showDeleted = searchParams.get("deleted") === "true";

    let products: { id: string; title: string; status: string; format: string; bundleId: string | null; createdAt: Date | null; deletedAt: Date | null }[] = [];
    let scripts: { id: string; title: string; status: string; createdAt: Date | null; videoId: string | null; productId: string | null; platform: string; deletedAt: Date | null }[] = [];
    let videos: { id: string; title: string; thumbnailUrl: string | null; status: string; createdAt: Date | null; productId: string | null; scriptId: string | null; deletedAt: Date | null }[] = [];

    const productWhere = showDeleted
      ? and(eq(productsTable.userId, userId), isNotNull(productsTable.deletedAt))
      : and(eq(productsTable.userId, userId), isNull(productsTable.deletedAt));
    const scriptWhere = showDeleted
      ? and(eq(scriptsTable.userId, userId), isNotNull(scriptsTable.deletedAt))
      : and(eq(scriptsTable.userId, userId), isNull(scriptsTable.deletedAt));
    const videoWhere = showDeleted
      ? and(eq(videosTable.userId, userId), isNotNull(videosTable.deletedAt))
      : and(eq(videosTable.userId, userId), isNull(videosTable.deletedAt));

    try {
      products = await db
        .select({
          id: productsTable.id,
          title: productsTable.title,
          status: productsTable.status,
          format: productsTable.format,
          bundleId: productsTable.bundleId,
          createdAt: productsTable.createdAt,
          deletedAt: productsTable.deletedAt,
        })
        .from(productsTable)
        .where(productWhere)
        .orderBy(desc(productsTable.createdAt));
    } catch (err) {
      console.error("Library products fetch error:", err);
    }

    try {
      scripts = await db
        .select()
        .from(scriptsTable)
        .where(scriptWhere)
        .orderBy(desc(scriptsTable.createdAt));
    } catch (err) {
      console.error("Library scripts fetch error:", err);
    }

    try {
      videos = await db
        .select()
        .from(videosTable)
        .where(videoWhere)
        .orderBy(desc(videosTable.createdAt));
    } catch (err) {
      console.error("Library videos fetch error:", err);
    }

    const productItems: LibraryItem[] = products.map((p) => ({
      id: p.id,
      type: "product" as const,
      title: p.title,
      status: (p as { status?: string }).status ?? "draft",
      createdAt: (p.createdAt as Date)?.toISOString?.() ?? String(p.createdAt),
      format: p.format,
      bundleId: p.bundleId ?? undefined,
      ...(showDeleted && p.deletedAt && { deletedAt: (p.deletedAt as Date)?.toISOString?.() ?? String(p.deletedAt) }),
    }));

    const scriptItems: LibraryItem[] = scripts.map((s) => ({
      id: s.id,
      type: "script" as const,
      title: s.title,
      status: s.status ?? "draft",
      createdAt: (s.createdAt as Date)?.toISOString?.() ?? String(s.createdAt),
      videoId: s.videoId ?? undefined,
      productId: s.productId ?? undefined,
      platform: s.platform,
      ...(showDeleted && s.deletedAt && { deletedAt: (s.deletedAt as Date)?.toISOString?.() ?? String(s.deletedAt) }),
    }));

    const videoItems: LibraryItem[] = videos.map((v) => ({
      id: v.id,
      type: "video" as const,
      title: v.title,
      thumbnail: v.thumbnailUrl ?? undefined,
      status: v.status ?? "draft",
      createdAt: (v.createdAt as Date)?.toISOString?.() ?? String(v.createdAt),
      productId: v.productId ?? undefined,
      scriptId: v.scriptId ?? undefined,
      ...(showDeleted && v.deletedAt && { deletedAt: (v.deletedAt as Date)?.toISOString?.() ?? String(v.deletedAt) }),
    }));

    let items = [...productItems, ...scriptItems, ...videoItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    if (typeFilter === "bundles") {
      items = items.filter((i) => i.type === "product" && i.bundleId != null);
    } else if (typeFilter !== "all") {
      items = items.filter((i) => i.type === typeFilter || (typeFilter === "products" && i.type === "product"));
    }

    return NextResponse.json(items);
  } catch (err) {
    console.error("Library fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch library" }, { status: 500 });
  }
}
