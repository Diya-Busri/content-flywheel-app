import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { brandVoiceTable } from "@/db/schema/brand-voice-schema";
import { isNull, inArray, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/marketplace?q=keyword&niche=design&format=PDF&sort=newest&page=1
 * Returns publicly published products across all creators.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim().toLowerCase() ?? "";
  const nicheFilter = searchParams.get("niche")?.trim().toLowerCase() ?? "";
  const formatFilter = searchParams.get("format")?.trim().toLowerCase() ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1") || 1);
  const PAGE_SIZE = 24;

  const rows = await db
    .select({
      id: productsTable.id,
      title: productsTable.title,
      niche: productsTable.niche,
      format: productsTable.format,
      marketingAssets: productsTable.marketingAssets,
      userId: productsTable.userId,
    })
    .from(productsTable)
    .where(isNull(productsTable.deletedAt))
    .orderBy(desc(productsTable.updatedAt));

  // Filter to natively published products only
  type MA = {
    isNativePublished?: boolean;
    nativePrice?: number;
    priceLabel?: string;
    thumbnailUrl?: string | null;
    coverThumbnailUrl?: string | null;
    productDescription?: string;
    comingSoon?: boolean;
  };

  const published = rows.filter((r) => {
    const ma = (r.marketingAssets ?? {}) as MA;
    return ma.isNativePublished === true && !ma.comingSoon;
  });

  // Text / niche / format filter
  const filtered = published.filter((r) => {
    const ma = (r.marketingAssets ?? {}) as MA;
    if (q) {
      const searchable = [r.title, r.niche, r.format, ma.productDescription ?? ""].join(" ").toLowerCase();
      if (!searchable.includes(q)) return false;
    }
    if (nicheFilter && r.niche.toLowerCase() !== nicheFilter) return false;
    if (formatFilter && r.format.toLowerCase() !== formatFilter) return false;
    return true;
  });

  // Build distinct niche/format lists from all published (for filters)
  const allNiches = Array.from(new Set(published.map((r) => r.niche))).sort();
  const allFormats = Array.from(new Set(published.map((r) => r.format))).sort();

  // Paginate
  const total = filtered.length;
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Fetch creator names for visible products
  const userIds = Array.from(new Set(paginated.map((r) => r.userId)));
  const [brandRows, emailRows] = await Promise.all([
    userIds.length > 0
      ? db.select({ userId: brandVoiceTable.userId, brandName: brandVoiceTable.brandName })
          .from(brandVoiceTable)
          .where(inArray(brandVoiceTable.userId, userIds))
      : [],
    userIds.length > 0
      ? db.select({ userId: profilesTable.userId, email: profilesTable.email })
          .from(profilesTable)
          .where(inArray(profilesTable.userId, userIds))
      : [],
  ]);

  const brandMap = Object.fromEntries(brandRows.map((r) => [r.userId, r.brandName]));
  const emailMap = Object.fromEntries(emailRows.map((r) => [r.userId, r.email]));
  const profileMap: Record<string, string> = {};
  for (const uid of userIds) {
    profileMap[uid] = brandMap[uid]?.trim() || emailMap[uid]?.split("@")[0] || "Creator";
  }

  const items = paginated.map((r) => {
    const ma = (r.marketingAssets ?? {}) as MA;
    return {
      id: r.id,
      title: r.title,
      niche: r.niche,
      format: r.format,
      priceLabel: ma.priceLabel ?? null,
      nativePrice: ma.nativePrice ?? null,
      thumbnailUrl: ma.coverThumbnailUrl ?? ma.thumbnailUrl ?? null,
      description: (ma.productDescription ?? "").slice(0, 160),
      creatorName: profileMap[r.userId] ?? "Creator",
      creatorUserId: r.userId,
    };
  });

  return NextResponse.json({ items, total, page, pageSize: PAGE_SIZE, niches: allNiches, formats: allFormats });
}
