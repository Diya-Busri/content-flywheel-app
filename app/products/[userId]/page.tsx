import { db } from "@/db/db";
import { brandVoiceTable } from "@/db/schema/brand-voice-schema";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { MarketingAssets } from "@/db/schema/products-schema";

export const dynamic = "force-dynamic";

export default async function ProductsListingPage({
  params,
}: {
  params: { userId: string };
}) {
  const { userId } = params;

  const [brandVoice] = await db
    .select()
    .from(brandVoiceTable)
    .where(eq(brandVoiceTable.userId, userId))
    .limit(1);

  if (!brandVoice) notFound();

  const products = await db
    .select({
      id: productsTable.id,
      title: productsTable.title,
      niche: productsTable.niche,
      format: productsTable.format,
      marketingAssets: productsTable.marketingAssets,
    })
    .from(productsTable)
    .where(and(eq(productsTable.userId, userId), isNull(productsTable.deletedAt)))
    .limit(50);

  const brandName = brandVoice.brandName?.trim() || "Creator";
  const initials = brandName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #fff7ed 0%, #ffedd5 40%, #fed7aa 100%)",
        padding: "48px 16px 80px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif",
      }}
    >
      <div style={{ maxWidth: "720px", margin: "0 auto" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "48px" }}>
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #f97316, #fb923c)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              fontSize: "24px",
              fontWeight: "800",
              color: "#ffffff",
              boxShadow: "0 8px 24px rgba(249,115,22,0.3)",
            }}
          >
            {initials}
          </div>
          <h1 style={{ margin: "0 0 8px", fontSize: "28px", fontWeight: "800", color: "#111827", letterSpacing: "-0.5px" }}>
            {brandName}
          </h1>
          <p style={{ margin: "0 0 20px", fontSize: "15px", color: "#6b7280" }}>
            {products.length} digital product{products.length !== 1 ? "s" : ""} available
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: "12px", flexWrap: "wrap" }}>
            <Link
              href={`/subscribe/${userId}`}
              style={{
                display: "inline-block",
                padding: "10px 24px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #f97316 0%, #ea6c0a 100%)",
                color: "#ffffff",
                fontSize: "14px",
                fontWeight: "700",
                textDecoration: "none",
                boxShadow: "0 4px 14px rgba(249,115,22,0.3)",
              }}
            >
              ✉️ Subscribe for updates
            </Link>
            <Link
              href={`/c/${userId}`}
              style={{
                display: "inline-block",
                padding: "10px 24px",
                borderRadius: "10px",
                border: "1.5px solid rgba(249,115,22,0.3)",
                background: "#ffffff",
                color: "#f97316",
                fontSize: "14px",
                fontWeight: "700",
                textDecoration: "none",
              }}
            >
              View profile
            </Link>
          </div>
        </div>

        {/* Products grid */}
        {products.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px", background: "#ffffff", borderRadius: "20px" }}>
            <p style={{ fontSize: "16px", color: "#6b7280" }}>No products available yet.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: "16px", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
            {products.map((p) => {
              const ma = p.marketingAssets as MarketingAssets | null;
              const href = ma?.checkoutUrl || `/product/${p.id}`;
              const thumbnailUrl = ma?.coverThumbnailUrl || ma?.thumbnailUrl || null;
              return (
                <a
                  key={p.id}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "block",
                    background: "#ffffff",
                    borderRadius: "20px",
                    overflow: "hidden",
                    textDecoration: "none",
                    border: "1px solid rgba(249,115,22,0.08)",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                    transition: "transform 0.15s, box-shadow 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-3px)";
                    (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 12px 32px rgba(249,115,22,0.18)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(0)";
                    (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 2px 12px rgba(0,0,0,0.06)";
                  }}
                >
                  {/* Thumbnail */}
                  {thumbnailUrl ? (
                    <img
                      src={thumbnailUrl}
                      alt={p.title}
                      style={{ width: "100%", height: "180px", objectFit: "cover", display: "block" }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        height: "140px",
                        background: "linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "40px",
                      }}
                    >
                      📦
                    </div>
                  )}

                  {/* Card body */}
                  <div style={{ padding: "20px" }}>
                    <p style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: "700", color: "#f97316", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {p.format}
                    </p>
                    <h2 style={{ margin: "0 0 8px", fontSize: "16px", fontWeight: "700", color: "#111827", lineHeight: "1.3" }}>
                      {p.title}
                    </h2>
                    {ma?.productDescription && (
                      <p style={{ margin: "0 0 12px", fontSize: "13px", color: "#6b7280", lineHeight: "1.5", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {ma.productDescription}
                      </p>
                    )}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      {ma?.priceLabel ? (
                        <span style={{ fontSize: "18px", fontWeight: "800", color: "#f97316" }}>{ma.priceLabel}</span>
                      ) : (
                        <span style={{ fontSize: "13px", color: "#9ca3af" }}>{p.niche}</span>
                      )}
                      <span style={{
                        fontSize: "13px",
                        fontWeight: "700",
                        color: "#f97316",
                        background: "#fff7ed",
                        padding: "6px 14px",
                        borderRadius: "8px",
                      }}>
                        Get it →
                      </span>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}

        <p style={{ textAlign: "center", marginTop: "48px", fontSize: "12px", color: "#d1d5db" }}>
          Powered by <span style={{ color: "#f97316", fontWeight: "600" }}>Content Flywheel</span>
        </p>
      </div>
    </main>
  );
}
