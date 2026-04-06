import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { brandVoiceTable } from "@/db/schema/brand-voice-schema";
import { eq, and, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

type MarketingAssets = {
  productTitle?: string;
  productDescription?: string;
  hashtags?: string[];
  seoKeywords?: string[];
  thumbnailUrl?: string | null;
  coverThumbnailUrl?: string | null;
  bookMockupUrl?: string | null;
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
  };
}

export default async function ProductSalesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [product] = await db
    .select({
      id: productsTable.id,
      title: productsTable.title,
      niche: productsTable.niche,
      format: productsTable.format,
      userId: productsTable.userId,
      marketingAssets: productsTable.marketingAssets,
    })
    .from(productsTable)
    .where(and(eq(productsTable.id, id), isNull(productsTable.deletedAt)))
    .limit(1);

  if (!product) notFound();

  const [bv] = await db
    .select({ brandName: brandVoiceTable.brandName })
    .from(brandVoiceTable)
    .where(eq(brandVoiceTable.userId, product.userId))
    .limit(1);

  const ma = (product.marketingAssets ?? {}) as MarketingAssets;
  const displayTitle = ma.productTitle || product.title;
  const description = ma.productDescription ?? null;
  const coverImage = ma.bookMockupUrl ?? ma.coverThumbnailUrl ?? ma.thumbnailUrl ?? null;
  const hashtags: string[] = ma.hashtags ?? [];
  const creatorName = bv?.brandName ?? null;
  const formatLabel = product.format
    ? product.format.charAt(0).toUpperCase() + product.format.slice(1).replace(/_/g, " ")
    : "Digital Product";

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(160deg, #fff7ed 0%, #fffbf7 50%, #fff 100%)",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        padding: "40px 16px 80px",
      }}
    >
      <div style={{ maxWidth: "700px", margin: "0 auto" }}>
        {/* Creator badge */}
        {creatorName && (
          <div style={{ marginBottom: "20px", textAlign: "center" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "13px",
                fontWeight: 600,
                color: "#6b7280",
                letterSpacing: "0.02em",
              }}
            >
              by {creatorName}
            </span>
          </div>
        )}

        {/* Cover image */}
        {coverImage && (
          <div
            style={{
              marginBottom: "36px",
              borderRadius: "20px",
              overflow: "hidden",
              boxShadow: "0 8px 40px rgba(0,0,0,0.10)",
              lineHeight: 0,
              maxWidth: "480px",
              margin: "0 auto 36px",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverImage}
              alt={displayTitle}
              style={{ width: "100%", display: "block" }}
            />
          </div>
        )}

        {/* Format badge */}
        <div style={{ textAlign: "center", marginBottom: "12px" }}>
          <span
            style={{
              display: "inline-block",
              padding: "4px 12px",
              borderRadius: "999px",
              background: "#fff7ed",
              border: "1px solid #fed7aa",
              fontSize: "12px",
              fontWeight: 700,
              color: "#c2410c",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            {formatLabel}
          </span>
        </div>

        {/* Title */}
        <h1
          style={{
            margin: "0 0 16px",
            fontSize: "clamp(26px, 5vw, 40px)",
            fontWeight: 800,
            color: "#111827",
            lineHeight: 1.15,
            letterSpacing: "-0.5px",
            textAlign: "center",
          }}
        >
          {displayTitle}
        </h1>

        {/* Description */}
        {description && (
          <p
            style={{
              margin: "0 0 36px",
              fontSize: "16px",
              color: "#4b5563",
              lineHeight: 1.75,
              textAlign: "center",
              maxWidth: "560px",
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            {description}
          </p>
        )}

        {/* CTA */}
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <a
            href={`mailto:?subject=Interested in ${encodeURIComponent(displayTitle)}`}
            style={{
              display: "inline-block",
              padding: "14px 36px",
              borderRadius: "12px",
              background: "linear-gradient(135deg,#f97316 0%,#ea6c0a 100%)",
              color: "#ffffff",
              fontSize: "16px",
              fontWeight: 700,
              textDecoration: "none",
              boxShadow: "0 4px 20px rgba(249,115,22,0.35)",
              letterSpacing: "-0.2px",
            }}
          >
            Get this product
          </a>
          <p style={{ margin: "12px 0 0", fontSize: "13px", color: "#9ca3af" }}>
            Instant digital download
          </p>
        </div>

        {/* What you get */}
        {product.niche && (
          <div
            style={{
              background: "#fff",
              border: "1px solid #f3f4f6",
              borderRadius: "16px",
              padding: "24px 28px",
              marginBottom: "28px",
              boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
            }}
          >
            <h2
              style={{
                margin: "0 0 12px",
                fontSize: "13px",
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "#9ca3af",
              }}
            >
              About this product
            </h2>
            <p style={{ margin: 0, fontSize: "15px", color: "#374151", lineHeight: 1.6 }}>
              A {formatLabel.toLowerCase()} for <strong>{product.niche}</strong> — everything you need to get started, in one place.
            </p>
          </div>
        )}

        {/* Hashtags */}
        {hashtags.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center", marginBottom: "40px" }}>
            {hashtags.map((tag) => (
              <span
                key={tag}
                style={{
                  display: "inline-block",
                  padding: "4px 12px",
                  borderRadius: "999px",
                  background: "#f9fafb",
                  border: "1px solid #e5e7eb",
                  fontSize: "13px",
                  color: "#6b7280",
                }}
              >
                {tag.startsWith("#") ? tag : `#${tag}`}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <p style={{ textAlign: "center", fontSize: "12px", color: "#d1d5db" }}>
          Made with{" "}
          <span style={{ color: "#f97316", fontWeight: 600 }}>Content Flywheel</span>
        </p>
      </div>
    </main>
  );
}
