import { ImageResponse } from "next/og";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { brandVoiceTable } from "@/db/schema/brand-voice-schema";
import { storeSettingsTable } from "@/db/schema/store-settings-schema";
import { productReviewsTable } from "@/db/schema/product-reviews-schema";
import { eq, and, isNull } from "drizzle-orm";

export const dynamic = "force-dynamic";

type MA = {
  productTitle?: string;
  nativePrice?: number;
  coverThumbnailUrl?: string | null;
  bookMockupUrl?: string | null;
  thumbnailUrl?: string | null;
  priceLabel?: string | null;
};

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://contentflywheel.co.uk";

  try {
    const [product] = await db
      .select({
        title: productsTable.title,
        niche: productsTable.niche,
        format: productsTable.format,
        marketingAssets: productsTable.marketingAssets,
        userId: productsTable.userId,
      })
      .from(productsTable)
      .where(and(eq(productsTable.id, id), isNull(productsTable.deletedAt)))
      .limit(1);

    if (!product) {
      return fallback(APP_URL);
    }

    const [[brand], [store], reviews] = await Promise.all([
      db.select({ brandName: brandVoiceTable.brandName })
        .from(brandVoiceTable).where(eq(brandVoiceTable.userId, product.userId)).limit(1),
      db.select({ storeName: storeSettingsTable.storeName })
        .from(storeSettingsTable).where(eq(storeSettingsTable.userId, product.userId)).limit(1),
      db.select({ rating: productReviewsTable.rating })
        .from(productReviewsTable)
        .where(and(eq(productReviewsTable.productId, id), eq(productReviewsTable.approved, true))),
    ]);

    const ma = (product.marketingAssets ?? {}) as MA;
    const displayTitle = ma.productTitle || product.title;
    const creatorName = store?.storeName?.trim() || brand?.brandName?.trim() || "Creator";
    const thumbnail = ma.coverThumbnailUrl ?? ma.bookMockupUrl ?? ma.thumbnailUrl ?? null;

    const price =
      ma.nativePrice === 0 ? "Free"
      : ma.nativePrice ? `£${(ma.nativePrice / 100).toFixed(2)}`
      : ma.priceLabel ?? null;

    const avgRating =
      reviews.length > 0
        ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
        : null;
    const starsFull = avgRating ? Math.round(parseFloat(avgRating)) : 0;

    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            width: "1200px",
            height: "630px",
            background: "#0B0B0F",
            fontFamily: "Arial, sans-serif",
          }}
        >
          {/* Thumbnail panel */}
          {thumbnail && (
            <div style={{ display: "flex", width: "420px", flexShrink: 0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thumbnail}
                alt=""
                style={{ width: "420px", height: "630px", objectFit: "cover" }}
              />
            </div>
          )}

          {/* Content panel */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              flex: 1,
              padding: "52px 52px 44px",
            }}
          >
            {/* Logo */}
            <div style={{ display: "flex" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${APP_URL}/logo.png`}
                alt="Content Flywheel"
                style={{ height: "32px", objectFit: "contain" }}
              />
            </div>

            {/* Middle section */}
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {/* Badges */}
              <div style={{ display: "flex", gap: "8px" }}>
                {product.niche && (
                  <div
                    style={{
                      background: "#f97316",
                      color: "#fff",
                      fontSize: "12px",
                      fontWeight: 700,
                      padding: "4px 12px",
                      borderRadius: "999px",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {product.niche}
                  </div>
                )}
                {product.format && (
                  <div
                    style={{
                      background: "rgba(255,255,255,0.1)",
                      color: "#d1d5db",
                      fontSize: "12px",
                      fontWeight: 700,
                      padding: "4px 12px",
                      borderRadius: "999px",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {product.format}
                  </div>
                )}
              </div>

              {/* Title */}
              <div
                style={{
                  fontSize: displayTitle.length > 50 ? "30px" : "38px",
                  fontWeight: 800,
                  color: "#ffffff",
                  lineHeight: 1.2,
                  letterSpacing: "-0.03em",
                }}
              >
                {displayTitle.slice(0, 80)}{displayTitle.length > 80 ? "…" : ""}
              </div>

              {/* Stars */}
              {avgRating && reviews.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ color: "#f59e0b", fontSize: "20px" }}>
                    {"★".repeat(starsFull)}{"☆".repeat(5 - starsFull)}
                  </span>
                  <span style={{ color: "#9ca3af", fontSize: "16px" }}>
                    {avgRating} · {reviews.length} review{reviews.length !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </div>

            {/* Bottom */}
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                {price && (
                  <div
                    style={{
                      fontSize: "44px",
                      fontWeight: 800,
                      color: ma.nativePrice === 0 ? "#10b981" : "#ffffff",
                      letterSpacing: "-0.04em",
                    }}
                  >
                    {price}
                  </div>
                )}
                <div style={{ fontSize: "15px", color: "#6b7280" }}>by {creatorName}</div>
              </div>
              <div style={{ fontSize: "13px", color: "#4b5563" }}>contentflywheel.co.uk</div>
            </div>
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  } catch (err) {
    console.error("[og/product]", err);
    return fallback(APP_URL);
  }
}

function fallback(appUrl: string) {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "1200px",
          height: "630px",
          background: "#0B0B0F",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${appUrl}/logo.png`} alt="Content Flywheel" style={{ height: "56px" }} />
        <div style={{ color: "#9ca3af", fontSize: "24px" }}>Digital Product Marketplace</div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
