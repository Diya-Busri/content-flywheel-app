import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { brandVoiceTable } from "@/db/schema/brand-voice-schema";
import { productReviewsTable } from "@/db/schema/product-reviews-schema";
import { eq, and, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BuyButton } from "./BuyButton";
import { WaitlistForm } from "./WaitlistForm";
import { ReviewForm } from "./ReviewForm";
import { ShareButtons } from "./ShareButtons";
import ViewTracker from "./ViewTracker";
import DiscountInput from "./DiscountInput";

type MarketingAssets = {
  productTitle?: string;
  productDescription?: string;
  hashtags?: string[];
  seoKeywords?: string[];
  thumbnailUrl?: string | null;
  coverThumbnailUrl?: string | null;
  bookMockupUrl?: string | null;
  checkoutUrl?: string | null;
  priceLabel?: string | null;
  isNativePublished?: boolean;
  nativePrice?: number;
  salePrice?: number;
  stripeProductId?: string;
  stripePriceId?: string;
  testimonials?: Array<{ name: string; text: string; rating?: number }>;
  comingSoon?: boolean;
};

type ProductContent = {
  sections?: Array<{ id: string; title: string; content: string; order: number }>;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const [product] = await db
    .select({ title: productsTable.title, marketingAssets: productsTable.marketingAssets })
    .from(productsTable)
    .where(and(eq(productsTable.id, id), isNull(productsTable.deletedAt)))
    .limit(1);

  if (!product) return { title: "Product not found" };
  const ma = (product.marketingAssets ?? {}) as MarketingAssets;
  const title = ma.productTitle || product.title;
  return {
    title: `${title} — Digital Product`,
    description: ma.productDescription ?? undefined,
    openGraph: {
      title: `${title} — Digital Product`,
      description: ma.productDescription ?? undefined,
      images: ma.bookMockupUrl ? [ma.bookMockupUrl] : ma.coverThumbnailUrl ? [ma.coverThumbnailUrl] : [],
    },
  };
}

export default async function ProductSalesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ purchased?: string; session_id?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const purchased = sp?.purchased === "true";

  const [product] = await db
    .select({
      id: productsTable.id,
      title: productsTable.title,
      niche: productsTable.niche,
      format: productsTable.format,
      userId: productsTable.userId,
      marketingAssets: productsTable.marketingAssets,
      content: productsTable.content,
    })
    .from(productsTable)
    .where(and(eq(productsTable.id, id), isNull(productsTable.deletedAt)))
    .limit(1);

  if (!product) notFound();

  let bv: { brandName: string | null; targetAudience: string | null } | undefined;
  try {
    const rows = await db
      .select({ brandName: brandVoiceTable.brandName, targetAudience: brandVoiceTable.targetAudience })
      .from(brandVoiceTable)
      .where(eq(brandVoiceTable.userId, product.userId))
      .limit(1);
    bv = rows[0];
  } catch { bv = undefined; }

  let reviews: { id: string; buyerName: string | null; rating: number; reviewText: string | null; createdAt: Date }[] = [];
  try {
    reviews = await db
      .select({
        id: productReviewsTable.id,
        buyerName: productReviewsTable.buyerName,
        rating: productReviewsTable.rating,
        reviewText: productReviewsTable.reviewText,
        createdAt: productReviewsTable.createdAt,
      })
      .from(productReviewsTable)
      .where(and(eq(productReviewsTable.productId, id), eq(productReviewsTable.approved, true)))
      .orderBy(productReviewsTable.createdAt)
      .limit(20);
  } catch { reviews = []; }

  let upsellProducts: { id: string; title: string; marketingAssets: unknown }[] = [];
  try {
    const rows = await db
      .select({ id: productsTable.id, title: productsTable.title, marketingAssets: productsTable.marketingAssets })
      .from(productsTable)
      .where(and(eq(productsTable.userId, product.userId), isNull(productsTable.deletedAt)))
      .limit(6);
    upsellProducts = rows.filter((p) => p.id !== id && ((p.marketingAssets as MarketingAssets)?.isNativePublished || (p.marketingAssets as MarketingAssets)?.checkoutUrl)).slice(0, 3);
  } catch { upsellProducts = []; }

  const upsellBundles: { id: string; title: string; bundlePrice: number; productIds: string[] }[] = [];

  const ma = (product.marketingAssets ?? {}) as MarketingAssets;
  const content = (product.content ?? {}) as ProductContent;
  const sections = (content.sections ?? []).sort((a, b) => a.order - b.order);

  const displayTitle = ma.productTitle || product.title;
  const fullDescription = ma.productDescription ?? null;
  // First paragraph as tagline
  const tagline = fullDescription
    ? fullDescription.split(/\n\n+/)[0].replace(/\*\*/g, "").slice(0, 180)
    : null;
  const coverImage = ma.bookMockupUrl ?? ma.coverThumbnailUrl ?? ma.thumbnailUrl ?? null;
  const hashtags: string[] = (ma.hashtags ?? []).slice(0, 8);
  const creatorName = bv?.brandName ?? null;
  const checkoutUrl = ma.checkoutUrl?.trim() || null;
  const priceLabel = ma.priceLabel?.trim() || null;
  const formatLabel = product.format
    ? product.format.charAt(0).toUpperCase() + product.format.slice(1).replace(/_/g, " ")
    : "Digital Product";
  const isNativePublished = !!(ma.isNativePublished && ma.nativePrice);
  const nativePriceLabel = ma.nativePrice ? `£${(ma.nativePrice / 100).toFixed(2)}` : null;
  const hasSalePrice = typeof ma.salePrice === "number" && ma.nativePrice !== undefined && ma.salePrice < ma.nativePrice;
  const salePriceLabel = hasSalePrice ? `£${(ma.salePrice! / 100).toFixed(2)}` : null;
  const isComingSoon = !!(ma.comingSoon);
  const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : null;

  // Parse description into paragraphs
  const descParagraphs = fullDescription
    ? fullDescription.split(/\n\n+/).filter(Boolean)
    : [];

  const creatorInitials = creatorName
    ? creatorName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
    : "CF";
  const hasUpsell = (upsellProducts.length > 0 || upsellBundles.length > 0) && purchased;

  return (
    <main style={{ minHeight: "100vh", background: "#f5f4f0", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      <style>{`
        .product-grid { display: grid; grid-template-columns: 1fr; gap: 32px; max-width: 1100px; margin: 0 auto; padding: 32px 16px 80px; }
        @media (min-width: 768px) { .product-grid { grid-template-columns: 1fr 420px; padding: 48px 32px 80px; align-items: start; } }
        .purchase-card { background: #fff; border-radius: 20px; padding: 32px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); position: sticky; top: 24px; }
        .buy-btn { display: block; width: 100%; padding: 16px 24px; border-radius: 12px; background: linear-gradient(135deg,#f97316 0%,#ea580c 100%); color: #fff; font-size: 17px; font-weight: 700; text-align: center; text-decoration: none; border: none; cursor: pointer; box-shadow: 0 4px 20px rgba(249,115,22,0.4); letter-spacing: -0.2px; transition: opacity 0.15s; }
        .buy-btn:hover { opacity: 0.92; }
        .trust-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 20px; }
        .trust-item { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #6b7280; font-weight: 500; }
        .section-list { display: flex; flex-direction: column; gap: 10px; }
        .section-item { display: flex; align-items: flex-start; gap: 12px; padding: 12px 16px; background: #fff; border-radius: 12px; border: 1px solid #f3f4f6; }
        .desc-para { margin: 0 0 16px; font-size: 15px; color: #374151; line-height: 1.75; }
        .desc-para:last-child { margin-bottom: 0; }
        @media (max-width: 767px) { .purchase-card { position: static; } }
      `}</style>

      <ViewTracker productId={id} />

      {/* Top nav */}
      <nav style={{ background: "#fff", borderBottom: "1px solid #f3f4f6", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {creatorName ? (
          <a href={`/c/${product.userId}`} style={{ fontWeight: 700, fontSize: "15px", color: "#111827", textDecoration: "none" }}>
            {creatorName}
          </a>
        ) : (
          <span style={{ fontWeight: 700, fontSize: "15px", color: "#111827" }}>Digital Product</span>
        )}
        <span style={{ fontSize: "12px", color: "#9ca3af" }}>
          Powered by <span style={{ color: "#f97316", fontWeight: 600 }}>Content Flywheel</span>
        </span>
      </nav>

      {/* Purchase success banner */}
      {purchased && (
        <div style={{ background: "#f0fdf4", borderBottom: "1px solid #86efac", padding: "14px 24px", display: "flex", alignItems: "center", gap: "12px", justifyContent: "center" }}>
          <span style={{ fontSize: "18px" }}>✅</span>
          <div>
            <span style={{ fontWeight: 700, fontSize: "14px", color: "#166534" }}>Purchase complete! </span>
            <span style={{ fontSize: "14px", color: "#16a34a" }}>Check your email for your download link (valid 7 days).</span>
          </div>
        </div>
      )}

      <div className="product-grid">
        {/* LEFT COLUMN */}
        <div>
          {/* Cover image */}
          {coverImage && (
            <div style={{ borderRadius: "20px", overflow: "hidden", boxShadow: "0 8px 40px rgba(0,0,0,0.12)", marginBottom: "28px", lineHeight: 0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverImage} alt={displayTitle} style={{ width: "100%", display: "block" }} />
            </div>
          )}

          {/* What's inside */}
          {sections.length > 0 && (
            <div style={{ background: "#fff", borderRadius: "20px", padding: "28px", boxShadow: "0 2px 12px rgba(0,0,0,0.04)", marginBottom: "24px" }}>
              <h2 style={{ margin: "0 0 20px", fontSize: "16px", fontWeight: 700, color: "#111827" }}>
                What&apos;s inside
              </h2>
              <div className="section-list">
                {sections.map((s, i) => (
                  <div key={s.id ?? i} className="section-item">
                    <div style={{ width: "22px", height: "22px", borderRadius: "50%", background: "#fff7ed", border: "1.5px solid #fed7aa", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "11px", fontWeight: 700, color: "#f97316" }}>
                      {i + 1}
                    </div>
                    <span style={{ fontSize: "14px", fontWeight: 600, color: "#374151", lineHeight: 1.4 }}>{s.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Full description */}
          {descParagraphs.length > 0 && (
            <div style={{ background: "#fff", borderRadius: "20px", padding: "28px", boxShadow: "0 2px 12px rgba(0,0,0,0.04)", marginBottom: "24px" }}>
              <h2 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 700, color: "#111827" }}>About this product</h2>
              {descParagraphs.map((para, i) => (
                <p key={i} className="desc-para">{para.replace(/\*\*/g, "")}</p>
              ))}
            </div>
          )}

          {/* Testimonials */}
          {ma.testimonials && ma.testimonials.length > 0 && (
            <div style={{ background: "#fff", borderRadius: "20px", padding: "28px", boxShadow: "0 2px 12px rgba(0,0,0,0.04)", marginBottom: "24px" }}>
              <h2 style={{ margin: "0 0 20px", fontSize: "16px", fontWeight: 700, color: "#111827" }}>What customers say</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {ma.testimonials.map((t, i) => (
                  <div key={i} style={{ padding: "16px", background: "#fafafa", borderRadius: "12px", border: "1px solid #f3f4f6" }}>
                    {t.rating && (
                      <div style={{ marginBottom: "8px" }}>
                        {"★".repeat(t.rating)}{"☆".repeat(5 - t.rating)}
                      </div>
                    )}
                    <p style={{ margin: "0 0 10px", fontSize: "14px", color: "#374151", lineHeight: 1.6, fontStyle: "italic" }}>&ldquo;{t.text}&rdquo;</p>
                    <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "#111827" }}>— {t.name}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hashtags */}
          {hashtags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {hashtags.map((tag) => (
                <span key={tag} style={{ display: "inline-block", padding: "4px 12px", borderRadius: "999px", background: "#fff", border: "1px solid #e5e7eb", fontSize: "12px", color: "#6b7280" }}>
                  {tag.startsWith("#") ? tag : `#${tag}`}
                </span>
              ))}
            </div>
          )}

          {/* Share buttons */}
          <ShareButtons
            url={`https://contentflywheel.co.uk/product/${id}`}
            title={displayTitle}
          />

          {/* Verified Reviews */}
          {reviews.length > 0 && (
            <div style={{ background: "#fff", borderRadius: "20px", padding: "28px", boxShadow: "0 2px 12px rgba(0,0,0,0.04)", marginTop: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#111827" }}>Reviews</h2>
                {avgRating && (
                  <span style={{ fontSize: "14px", color: "#f97316", fontWeight: 700 }}>★ {avgRating}</span>
                )}
                <span style={{ fontSize: "13px", color: "#9ca3af" }}>({reviews.length})</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {reviews.map((r) => (
                  <div key={r.id} style={{ padding: "16px", background: "#fafafa", borderRadius: "12px", border: "1px solid #f3f4f6" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                      <span style={{ color: "#f59e0b", fontSize: "14px" }}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: "#111827" }}>{r.buyerName || "Verified buyer"}</span>
                    </div>
                    {r.reviewText && (
                      <p style={{ margin: 0, fontSize: "14px", color: "#374151", lineHeight: 1.6 }}>{r.reviewText}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Leave a review (after purchase) */}
          {purchased && (
            <div style={{ background: "#fff", borderRadius: "20px", padding: "28px", boxShadow: "0 2px 12px rgba(0,0,0,0.04)", marginTop: "24px" }}>
              <h2 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 700, color: "#111827" }}>Leave a review</h2>
              <ReviewForm productId={product.id} />
            </div>
          )}
        </div>

        {/* RIGHT COLUMN — Purchase card */}
        <div>
          <div className="purchase-card">
            {/* Format badge */}
            <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: "999px", background: "#fff7ed", border: "1px solid #fed7aa", fontSize: "11px", fontWeight: 700, color: "#c2410c", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "14px" }}>
              {formatLabel}
            </span>

            {/* Title */}
            <h1 style={{ margin: "0 0 10px", fontSize: "clamp(20px,4vw,26px)", fontWeight: 800, color: "#111827", lineHeight: 1.2, letterSpacing: "-0.5px" }}>
              {displayTitle}
            </h1>

            {/* Tagline */}
            {tagline && (
              <p style={{ margin: "0 0 24px", fontSize: "14px", color: "#6b7280", lineHeight: 1.6 }}>
                {tagline}{tagline.length >= 180 ? "…" : ""}
              </p>
            )}

            {/* Price + CTA */}
            {isComingSoon ? (
              <div>
                <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: "12px", padding: "16px 20px", marginBottom: "16px", textAlign: "center" }}>
                  <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: "15px", color: "#c2410c" }}>🚀 Coming Soon</p>
                  <p style={{ margin: 0, fontSize: "13px", color: "#9a3412" }}>Join the waitlist to be the first to know when this launches.</p>
                </div>
                <WaitlistForm productId={product.id} />
              </div>
            ) : isNativePublished ? (
              <>
                <div style={{ margin: "0 0 16px" }}>
                  {hasSalePrice ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "4px" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "3px 8px",
                          borderRadius: "6px",
                          background: "#fef2f2",
                          color: "#b91c1c",
                          fontSize: "11px",
                          fontWeight: 800,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                        }}
                      >
                        SALE
                      </span>
                      <span style={{ fontSize: "22px", fontWeight: 700, color: "#9ca3af", textDecoration: "line-through", letterSpacing: "-0.5px" }}>
                        {nativePriceLabel}
                      </span>
                    </div>
                  ) : null}
                  <span style={{ fontSize: "38px", fontWeight: 800, color: hasSalePrice ? "#f97316" : "#111827", letterSpacing: "-1.5px" }}>
                    {hasSalePrice ? salePriceLabel : nativePriceLabel}
                  </span>
                  <span style={{ fontSize: "14px", color: "#9ca3af", marginLeft: "6px" }}>one-time</span>
                </div>
                <BuyButton productId={product.id} priceLabel={hasSalePrice ? salePriceLabel! : nativePriceLabel!} creatorUserId={product.userId} />
                <DiscountInput productId={product.id} onApply={() => {}} />
              </>
            ) : (
              <>
                {priceLabel && (
                  <div style={{ margin: "0 0 16px" }}>
                    <span style={{ fontSize: "38px", fontWeight: 800, color: "#111827", letterSpacing: "-1.5px" }}>{priceLabel}</span>
                    <span style={{ fontSize: "14px", color: "#9ca3af", marginLeft: "6px" }}>one-time</span>
                  </div>
                )}
                <a
                  href={checkoutUrl ?? `mailto:?subject=Interested in ${encodeURIComponent(displayTitle)}`}
                  target={checkoutUrl ? "_blank" : undefined}
                  rel={checkoutUrl ? "noopener noreferrer" : undefined}
                  className="buy-btn"
                >
                  Get this product {priceLabel ? `— ${priceLabel}` : ""}
                </a>
              </>
            )}

            {/* Trust badges */}
            <div className="trust-grid">
              <div className="trust-item"><span>🔒</span> Secure checkout</div>
              <div className="trust-item"><span>📥</span> Instant download</div>
              <div className="trust-item"><span>✉️</span> Email delivery</div>
              <div className="trust-item"><span>💳</span> Stripe payments</div>
            </div>

            {/* Divider */}
            <div style={{ borderTop: "1px solid #f3f4f6", margin: "20px 0" }} />

            {/* Includes summary */}
            {sections.length > 0 && (
              <div>
                <p style={{ margin: "0 0 10px", fontSize: "12px", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>Includes</p>
                {sections.slice(0, 4).map((s, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "7px" }}>
                    <span style={{ color: "#f97316", fontSize: "14px" }}>✓</span>
                    <span style={{ fontSize: "13px", color: "#374151" }}>{s.title}</span>
                  </div>
                ))}
                {sections.length > 4 && (
                  <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#9ca3af" }}>+ {sections.length - 4} more sections</p>
                )}
              </div>
            )}
          </div>

          {/* Creator card */}
          {creatorName && (
            <div style={{ background: "#fff", borderRadius: "16px", padding: "20px 24px", marginTop: "16px", boxShadow: "0 2px 12px rgba(0,0,0,0.04)", display: "flex", alignItems: "center", gap: "14px" }}>
              <div style={{ width: "44px", height: "44px", borderRadius: "50%", background: "linear-gradient(135deg,#f97316,#fb923c)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: 800, color: "#fff", flexShrink: 0 }}>
                {creatorInitials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: "0 0 2px", fontWeight: 700, fontSize: "14px", color: "#111827" }}>{creatorName}</p>
                {bv?.targetAudience && (
                  <p style={{ margin: 0, fontSize: "12px", color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bv.targetAudience}</p>
                )}
              </div>
              <a href={`/c/${product.userId}`} style={{ fontSize: "12px", color: "#f97316", fontWeight: 600, textDecoration: "none", flexShrink: 0 }}>
                More →
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Post-purchase upsell */}
      {hasUpsell && (
        <div style={{ background: "#fff", borderTop: "1px solid #f3f4f6", padding: "48px 16px" }}>
          <div style={{ maxWidth: "900px", margin: "0 auto" }}>
            <h2 style={{ margin: "0 0 24px", fontSize: "18px", fontWeight: 800, color: "#111827", textAlign: "center" }}>
              You might also like
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: "16px" }}>
              {upsellProducts.map((p) => {
                const pma = (p.marketingAssets ?? {}) as MarketingAssets;
                const thumb = pma.bookMockupUrl ?? pma.coverThumbnailUrl ?? pma.thumbnailUrl;
                const href = pma.isNativePublished ? `/product/${p.id}` : (pma.checkoutUrl ?? `/product/${p.id}`);
                return (
                  <a key={p.id} href={href} style={{ display: "block", background: "#fafafa", border: "1px solid #f3f4f6", borderRadius: "16px", overflow: "hidden", textDecoration: "none" }}>
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb} alt={p.title} style={{ width: "100%", aspectRatio: "16/10", objectFit: "cover", display: "block" }} />
                    ) : (
                      <div style={{ width: "100%", aspectRatio: "16/10", background: "linear-gradient(135deg,#fff7ed,#fed7aa)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px" }}>📦</div>
                    )}
                    <div style={{ padding: "14px 16px" }}>
                      <p style={{ margin: "0 0 6px", fontWeight: 700, fontSize: "14px", color: "#111827", lineHeight: 1.3 }}>{p.title}</p>
                      {pma.nativePrice && (
                        <p style={{ margin: 0, fontWeight: 700, fontSize: "15px", color: "#f97316" }}>£{(pma.nativePrice / 100).toFixed(2)}</p>
                      )}
                    </div>
                  </a>
                );
              })}
              {upsellBundles.map((b) => (
                <a key={b.id} href={`/bundle/${b.id}`} style={{ display: "block", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: "16px", overflow: "hidden", textDecoration: "none" }}>
                  <div style={{ width: "100%", aspectRatio: "16/10", background: "linear-gradient(135deg,#fff7ed,#fed7aa)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "32px" }}>📦</div>
                  <div style={{ padding: "14px 16px" }}>
                    <span style={{ display: "inline-block", padding: "2px 8px", background: "#fed7aa", borderRadius: "999px", fontSize: "10px", fontWeight: 700, color: "#c2410c", marginBottom: "6px" }}>BUNDLE · {b.productIds.length} products</span>
                    <p style={{ margin: "0 0 6px", fontWeight: 700, fontSize: "14px", color: "#111827", lineHeight: 1.3 }}>{b.title}</p>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: "15px", color: "#f97316" }}>£{(b.bundlePrice / 100).toFixed(2)}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
