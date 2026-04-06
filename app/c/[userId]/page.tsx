import { db } from "@/db/db";
import { brandVoiceTable } from "@/db/schema/brand-voice-schema";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { MarketingAssets } from "@/db/schema/products-schema";

export const dynamic = "force-dynamic";

export default async function CreatorProfilePage({
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
      marketingAssets: productsTable.marketingAssets,
    })
    .from(productsTable)
    .where(and(eq(productsTable.userId, userId), isNull(productsTable.deletedAt)))
    .limit(20);

  const brandName = brandVoice.brandName?.trim() || "Creator";
  const initials = brandName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const publishedProducts = products.filter((p) => {
    const ma = p.marketingAssets as MarketingAssets | null;
    return ma?.checkoutUrl || ma?.priceLabel;
  });

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #fff7ed 0%, #ffedd5 40%, #fed7aa 100%)",
        padding: "48px 16px 64px",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif",
      }}
    >
      <div style={{ maxWidth: "560px", margin: "0 auto" }}>

        {/* Profile card */}
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "24px",
            padding: "40px 36px 32px",
            boxShadow: "0 4px 6px -1px rgba(0,0,0,0.07), 0 20px 60px -10px rgba(249,115,22,0.15)",
            border: "1px solid rgba(249,115,22,0.1)",
            textAlign: "center",
            marginBottom: "20px",
          }}
        >
          {/* Avatar */}
          <div
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #f97316, #fb923c)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
              fontSize: "28px",
              fontWeight: "800",
              color: "#ffffff",
              boxShadow: "0 8px 24px rgba(249,115,22,0.3)",
            }}
          >
            {initials}
          </div>

          <h1
            style={{
              margin: "0 0 8px",
              fontSize: "28px",
              fontWeight: "800",
              color: "#111827",
              letterSpacing: "-0.5px",
            }}
          >
            {brandName}
          </h1>

          {brandVoice.targetAudience && (
            <p style={{ margin: "0 0 24px", fontSize: "15px", color: "#6b7280", lineHeight: "1.6" }}>
              {brandVoice.targetAudience}
            </p>
          )}

          {/* Subscribe CTA */}
          <Link
            href={`/subscribe/${userId}`}
            style={{
              display: "inline-block",
              padding: "13px 32px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #f97316 0%, #ea6c0a 100%)",
              color: "#ffffff",
              fontSize: "15px",
              fontWeight: "700",
              textDecoration: "none",
              boxShadow: "0 4px 14px rgba(249,115,22,0.35)",
            }}
          >
            ✉️ Subscribe for updates
          </Link>
        </div>

        {/* Products */}
        {publishedProducts.length > 0 && (
          <>
            <h2
              style={{
                fontSize: "13px",
                fontWeight: "700",
                color: "#9ca3af",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                margin: "0 0 12px 4px",
              }}
            >
              Products
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {publishedProducts.map((p) => {
                const ma = p.marketingAssets as MarketingAssets | null;
                const href = ma?.checkoutUrl || `/product/${p.id}`;
                return (
                  <a
                    key={p.id}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      backgroundColor: "#ffffff",
                      borderRadius: "16px",
                      padding: "18px 24px",
                      textDecoration: "none",
                      border: "1px solid rgba(249,115,22,0.08)",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                      transition: "box-shadow 0.15s, transform 0.1s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLAnchorElement).style.boxShadow =
                        "0 8px 24px rgba(249,115,22,0.15)";
                      (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-1px)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLAnchorElement).style.boxShadow =
                        "0 2px 8px rgba(0,0,0,0.04)";
                      (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(0)";
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          margin: "0 0 4px",
                          fontSize: "15px",
                          fontWeight: "700",
                          color: "#111827",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {p.title}
                      </p>
                      {ma?.productDescription && (
                        <p
                          style={{
                            margin: 0,
                            fontSize: "13px",
                            color: "#6b7280",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {ma.productDescription}
                        </p>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0, marginLeft: "16px" }}>
                      {ma?.priceLabel && (
                        <span
                          style={{
                            fontSize: "16px",
                            fontWeight: "800",
                            color: "#f97316",
                          }}
                        >
                          {ma.priceLabel}
                        </span>
                      )}
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "32px",
                          height: "32px",
                          borderRadius: "50%",
                          backgroundColor: "#fff7ed",
                          color: "#f97316",
                          fontSize: "16px",
                        }}
                      >
                        →
                      </span>
                    </div>
                  </a>
                );
              })}
            </div>
          </>
        )}

        {/* Footer */}
        <p
          style={{
            textAlign: "center",
            marginTop: "40px",
            fontSize: "12px",
            color: "#d1d5db",
          }}
        >
          Powered by <span style={{ color: "#f97316", fontWeight: "600" }}>Content Flywheel</span>
        </p>
      </div>
    </main>
  );
}
