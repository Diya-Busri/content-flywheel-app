import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { validateSearchParams } from "@/lib/api-validate";
import { productsTable } from "@/db/schema/products-schema";
import { scriptsTable, videosTable } from "@/db/schema/library-schema";
import { productViewsTable } from "@/db/schema/product-views-schema";
import { productOrdersTable } from "@/db/schema/product-orders-schema";
import { eq, desc, and, isNull, isNotNull, inArray, count } from "drizzle-orm";

export const dynamic = "force-dynamic";

import { getLibraryCached, setLibraryCache } from "@/lib/library-cache";

const LibrarySearchSchema = z.object({
  type: z.enum(["all", "product", "products", "video", "script", "scripts", "timeline", "bundles"]).optional().default("all"),
  deleted: z.enum(["true", "false"]).optional(),
});

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
  /** When 'ai' or 'brand', product was auto-designed; show "AI Designed" badge. */
  designSource?: "ai" | "brand" | null;
  /** True when product has a completed avatar promo video. */
  hasPromoVideo?: boolean;
  /** True when product has a book mockup image. */
  hasBookMockup?: boolean;
  /** True when product has AI-generated marketplace listing copy. */
  hasMarketingAssets?: boolean;
  /** True when product has a cover thumbnail. */
  hasThumbnail?: boolean;
  /** 0–100 completion score: content + thumbnail + mockup + marketing + video = 20pts each. */
  completionScore?: number;
  /** True when product is published natively on Content Flywheel. */
  isNativePublished?: boolean;
  /** Native price in pence (GBP). */
  nativePrice?: number;
  /** Total page views for this product (native store only). */
  pageViews?: number;
  /** Total completed orders for this product (native store only). */
  orderCount?: number;
  /** Video: timeline project metadata (scenes, template, etc.). */
  metadata?: Record<string, unknown>;
  /** Video: platforms array, e.g. ['video-timeline']. */
  platforms?: string[];
};

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const rl = await checkApiRateLimit(userId);
    if (rl) return rl;

    const { searchParams } = new URL(request.url);
    const [params, paramsErr] = validateSearchParams(searchParams, LibrarySearchSchema);
    if (paramsErr) return paramsErr;
    const typeFilter = params.type ?? "all";
    const showDeleted = params.deleted === "true";

    // Return cached result immediately if still fresh
    const cacheKey = `${userId}:${typeFilter}:${showDeleted}`;
    const cached = getLibraryCached(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "X-Cache": "HIT" },
      });
    }

    let products: { id: string; title: string; status: string; format: string; bundleId: string | null; createdAt: Date | null; deletedAt: Date | null; marketingAssets: { coverThumbnailUrl?: string | null; thumbnailUrl?: string | null } | null }[] = [];
    let scripts: { id: string; title: string; status: string; createdAt: Date | null; videoId: string | null; productId: string | null; platform: string; deletedAt: Date | null }[] = [];
    let videos: { id: string; title: string; thumbnailUrl: string | null; status: string; createdAt: Date | null; productId: string | null; scriptId: string | null; deletedAt: Date | null; metadata: Record<string, unknown> | null; platforms: string[] }[] = [];

    const productWhere = showDeleted
      ? and(eq(productsTable.userId, userId), isNotNull(productsTable.deletedAt))
      : and(eq(productsTable.userId, userId), isNull(productsTable.deletedAt));
    const scriptWhere = showDeleted
      ? and(eq(scriptsTable.userId, userId), isNotNull(scriptsTable.deletedAt))
      : and(eq(scriptsTable.userId, userId), isNull(scriptsTable.deletedAt));
    const videoWhere = showDeleted
      ? and(eq(videosTable.userId, userId), isNotNull(videosTable.deletedAt))
      : and(eq(videosTable.userId, userId), isNull(videosTable.deletedAt));

    // Determine which tables are actually needed for the requested type filter.
    // This avoids querying all 3 tables when only one is needed (e.g. "products" tab).
    const needsProducts = typeFilter === "all" || typeFilter === "product" || typeFilter === "products" || typeFilter === "bundles";
    const needsScripts  = typeFilter === "all" || typeFilter === "script"  || typeFilter === "scripts";
    const needsVideos   = typeFilter === "all" || typeFilter === "video"   || typeFilter === "timeline";

    const productQuery = needsProducts
      ? db
          .select({
            id: productsTable.id,
            title: productsTable.title,
            status: productsTable.status,
            format: productsTable.format,
            bundleId: productsTable.bundleId,
            designSource: productsTable.designSource,
            createdAt: productsTable.createdAt,
            deletedAt: productsTable.deletedAt,
            marketingAssets: productsTable.marketingAssets,
          })
          .from(productsTable)
          .where(productWhere)
          .orderBy(desc(productsTable.createdAt))
          .catch((err) => { console.error("Library products fetch error:", err); return []; })
      : Promise.resolve([]);

    const scriptQuery = needsScripts
      ? db
          .select()
          .from(scriptsTable)
          .where(scriptWhere)
          .orderBy(desc(scriptsTable.createdAt))
          .catch((err) => { console.error("Library scripts fetch error:", err); return []; })
      : Promise.resolve([]);

    const videoQuery = needsVideos
      ? db
          .select()
          .from(videosTable)
          .where(videoWhere)
          .orderBy(desc(videosTable.createdAt))
          .catch((err) => { console.error("Library videos fetch error:", err); return []; })
      : Promise.resolve([]);

    // Run only the needed queries in parallel
    [products, scripts, videos] = await Promise.all([productQuery, scriptQuery, videoQuery]);

    // Fetch per-product analytics (views + completed orders) for native-published products
    const publishedIds = products
      .filter((p) => !!(p.marketingAssets as { isNativePublished?: boolean } | null)?.isNativePublished)
      .map((p) => p.id);

    const viewCountMap: Record<string, number> = {};
    const orderCountMap: Record<string, number> = {};

    if (publishedIds.length > 0) {
      const [viewCounts, orderCounts] = await Promise.all([
        db.select({ productId: productViewsTable.productId, cnt: count() })
          .from(productViewsTable)
          .where(inArray(productViewsTable.productId, publishedIds))
          .groupBy(productViewsTable.productId)
          .catch(() => []),
        db.select({ productId: productOrdersTable.productId, cnt: count() })
          .from(productOrdersTable)
          .where(and(inArray(productOrdersTable.productId, publishedIds), eq(productOrdersTable.status, "completed")))
          .groupBy(productOrdersTable.productId)
          .catch(() => []),
      ]);
      for (const row of viewCounts) viewCountMap[row.productId] = Number(row.cnt);
      for (const row of orderCounts) orderCountMap[row.productId] = Number(row.cnt);
    }

    const productItems: LibraryItem[] = products.map((p) => {
      const ma = p.marketingAssets as {
        coverThumbnailUrl?: string | null;
        thumbnailUrl?: string | null;
        promoVideoUrl?: string | null;
        promoVideoStatus?: string | null;
        bookMockupUrl?: string | null;
        productTitle?: string | null;
        productDescription?: string | null;
        isNativePublished?: boolean;
        nativePrice?: number;
      } | null;
      const thumbnail = ma?.coverThumbnailUrl ?? ma?.thumbnailUrl ?? undefined;
      const row = p as { designSource?: "ai" | "brand" | null; status?: string };
      const hasPromoVideo = !!(ma?.promoVideoUrl && ma?.promoVideoStatus === "completed");
      const hasBookMockup = !!(ma?.bookMockupUrl);
      const hasThumbnail = !!(thumbnail);
      const hasMarketingAssets = !!(ma?.productTitle?.trim() && ma?.productDescription?.trim());
      const hasContent = (row.status === "draft");
      const completionScore =
        (hasContent ? 20 : 0) +
        (hasThumbnail ? 20 : 0) +
        (hasBookMockup ? 20 : 0) +
        (hasMarketingAssets ? 20 : 0) +
        (hasPromoVideo ? 20 : 0);
      const isNativePublished = !!(ma?.isNativePublished);
      return {
        id: p.id,
        type: "product" as const,
        title: p.title,
        thumbnail,
        status: (p as { status?: string }).status ?? "draft",
        createdAt: (p.createdAt as Date)?.toISOString?.() ?? String(p.createdAt),
        format: p.format,
        bundleId: p.bundleId ?? undefined,
        designSource: row.designSource ?? undefined,
        hasPromoVideo,
        hasBookMockup,
        hasThumbnail,
        hasMarketingAssets,
        completionScore,
        isNativePublished,
        nativePrice: ma?.nativePrice ?? undefined,
        ...(isNativePublished && { pageViews: viewCountMap[p.id] ?? 0, orderCount: orderCountMap[p.id] ?? 0 }),
        ...(showDeleted && p.deletedAt && { deletedAt: (p.deletedAt as Date)?.toISOString?.() ?? String(p.deletedAt) }),
      };
    });

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
      metadata: v.metadata ?? undefined,
      platforms: Array.isArray(v.platforms) ? v.platforms : [],
      ...(showDeleted && v.deletedAt && { deletedAt: (v.deletedAt as Date)?.toISOString?.() ?? String(v.deletedAt) }),
    }));

    let items = [...productItems, ...scriptItems, ...videoItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    if (typeFilter === "bundles") {
      items = items.filter((i) => i.type === "product" && i.bundleId != null);
    } else if (typeFilter === "timeline") {
      // "My Videos" shows all compiled/exported videos: timeline series AND video-guide (Digital Products, TikTok Shop)
      items = items.filter((i) => i.type === "video");
    } else if (typeFilter !== "all") {
      // Tab "scripts" sends type=scripts; LibraryItem uses type "script". Tab "products" sends type=products; we use "product".
      const matchType =
        typeFilter === "products" ? "product" : typeFilter === "scripts" ? "script" : typeFilter;
      items = items.filter((i) => i.type === matchType);
    }

    // Store in cache (skip trash/deleted views — those should always be fresh)
    if (!showDeleted) setLibraryCache(cacheKey, items);

    return NextResponse.json(items);
  } catch (err) {
    console.error("Library fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch library" }, { status: 500 });
  }
}
