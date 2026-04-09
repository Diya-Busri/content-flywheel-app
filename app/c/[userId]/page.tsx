import { db } from "@/db/db";
import { brandVoiceTable } from "@/db/schema/brand-voice-schema";
import { productsTable } from "@/db/schema/products-schema";
import { storeSettingsTable } from "@/db/schema/store-settings-schema";
import { eq, and, isNull } from "drizzle-orm";
import Link from "next/link";
import type { MarketingAssets } from "@/db/schema/products-schema";

export const dynamic = "force-dynamic";

// Theme map: key → background colour & text colour
const THEME_MAP: Record<string, { bg: string; text: string; cardBg: string; subText: string }> = {
  warm:    { bg: "linear-gradient(135deg, #fff7ed 0%, #ffedd5 40%, #fed7aa 100%)", text: "#111827", cardBg: "#ffffff", subText: "#6b7280" },
  dark:    { bg: "#0B0B0F", text: "#ffffff", cardBg: "#1c1c24", subText: "rgba(255,255,255,0.55)" },
  light:   { bg: "#ffffff", text: "#111827", cardBg: "#f8fafc", subText: "#6b7280" },
  minimal: { bg: "#f9fafb", text: "#111827", cardBg: "#ffffff", subText: "#6b7280" },
  bold:    { bg: "#1a1a2e", text: "#ffffff", cardBg: "#16213e", subText: "rgba(255,255,255,0.55)" },
};

export default async function CreatorProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  const [brandVoice, storeSettings] = await Promise.all([
    db
      .select()
      .from(brandVoiceTable)
      .where(eq(brandVoiceTable.userId, userId))
      .limit(1)
      .then((r) => r[0])
      .catch(() => undefined),
    db
      .select()
      .from(storeSettingsTable)
      .where(eq(storeSettingsTable.userId, userId))
      .limit(1)
      .then((r) => r[0])
      .catch(() => undefined),
  ]);

  const products = await db
    .select({
      id: productsTable.id,
      title: productsTable.title,
      marketingAssets: productsTable.marketingAssets,
    })
    .from(productsTable)
    .where(and(eq(productsTable.userId, userId), isNull(productsTable.deletedAt)))
    .limit(20);

  const brandName = brandVoice?.brandName?.trim() || "Creator";
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

  // ─── Resolve settings ─────────────────────────────────────────────────────

  const theme = storeSettings?.theme ?? "warm";
  const accentColor = storeSettings?.accentColor ?? "#f97316";
  const layout = storeSettings?.layout ?? "grid";
  const bio = storeSettings?.bio ?? brandVoice?.targetAudience ?? null;
  const profileImageUrl = storeSettings?.profileImageUrl ?? null;
  const bannerImageUrl = storeSettings?.bannerImageUrl ?? null;
  const bannerGradient = storeSettings?.bannerGradient ?? null;

  const themeStyle = THEME_MAP[theme] ?? THEME_MAP.warm;
  const isDark = theme === "dark" || theme === "bold";

  const cardBorderColor = isDark ? "rgba(255,255,255,0.08)" : `${accentColor}18`;
  const cardShadow = isDark ? "0 2px 8px rgba(0,0,0,0.3)" : "0 2px 8px rgba(0,0,0,0.04)";

  // Banner style
  let bannerBg: string;
  if (bannerImageUrl) {
    bannerBg = `url(${bannerImageUrl}) center/cover no-repeat`;
  } else if (bannerGradient) {
    bannerBg = `linear-gradient(${bannerGradient})`;
  } else {
    bannerBg = `linear-gradient(135deg, ${accentColor}cc, ${accentColor}66)`;
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: themeStyle.bg,
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif",
      }}
    >
      {/* Banner */}
      <div
        style={{
          height: "160px",
          background: bannerBg,
          position: "relative",
        }}
      />

      {/* Content */}
      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "0 16px 64px" }}>
        {/* Profile card */}
        <div
          style={{
            backgroundColor: themeStyle.cardBg,
            borderRadius: "24px",
            padding: "0 36px 32px",
            boxShadow: isDark
              ? "0 4px 24px rgba(0,0,0,0.4)"
              : `0 4px 6px -1px rgba(0,0,0,0.07), 0 20px 60px -10px ${accentColor}26`,
            border: `1px solid ${cardBorderColor}`,
            textAlign: "center",
            marginBottom: "20px",
            marginTop: "-40px",
          }}
        >
          {/* Avatar — offset above card */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            {profileImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profileImageUrl}
                alt={brandName}
                style={{
                  width: "80px",
                  height: "80px",
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: `4px solid ${themeStyle.cardBg}`,
                  marginTop: "-40px",
                  marginBottom: "16px",
                  boxShadow: `0 8px 24px ${accentColor}44`,
                }}
              />
            ) : (
              <div
                style={{
                  width: "80px",
                  height: "80px",
                  borderRadius: "50%",
                  background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: "-40px",
                  marginBottom: "16px",
                  fontSize: "28px",
                  fontWeight: "800",
                  color: "#ffffff",
                  border: `4px solid ${themeStyle.cardBg}`,
                  boxShadow: `0 8px 24px ${accentColor}44`,
                }}
              >
                {initials}
              </div>
            )}
          </div>

          <h1
            style={{
              margin: "0 0 8px",
              fontSize: "28px",
              fontWeight: "800",
              color: themeStyle.text,
              letterSpacing: "-0.5px",
            }}
          >
            {brandName}
          </h1>

          {bio && (
            <p style={{ margin: "0 0 24px", fontSize: "15px", color: themeStyle.subText, lineHeight: "1.6" }}>
              {bio}
            </p>
          )}

          {/* Subscribe CTA */}
          <Link
            href={`/subscribe/${userId}`}
            style={{
              display: "inline-block",
              padding: "13px 32px",
              borderRadius: "12px",
              background: `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}dd 100%)`,
              color: "#ffffff",
              fontSize: "15px",
              fontWeight: "700",
              textDecoration: "none",
              boxShadow: `0 4px 14px ${accentColor}55`,
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
                color: isDark ? "rgba(255,255,255,0.4)" : "#9ca3af",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                margin: "0 0 12px 4px",
              }}
            >
              Products
            </h2>

            {/* Grid layout */}
            {layout === "grid" && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                }}
              >
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
                        flexDirection: "column",
                        backgroundColor: themeStyle.cardBg,
                        borderRadius: "16px",
                        padding: "18px 20px",
                        textDecoration: "none",
                        border: `1px solid ${cardBorderColor}`,
                        boxShadow: cardShadow,
                      }}
                    >
                      <p
                        style={{
                          margin: "0 0 6px",
                          fontSize: "14px",
                          fontWeight: "700",
                          color: themeStyle.text,
                        }}
                      >
                        {p.title}
                      </p>
                      {ma?.productDescription && (
                        <p
                          style={{
                            margin: "0 0 12px",
                            fontSize: "12px",
                            color: themeStyle.subText,
                            lineHeight: "1.5",
                            flex: 1,
                          }}
                        >
                          {ma.productDescription}
                        </p>
                      )}
                      {ma?.priceLabel && (
                        <span style={{ fontSize: "16px", fontWeight: "800", color: accentColor }}>
                          {ma.priceLabel}
                        </span>
                      )}
                    </a>
                  );
                })}
              </div>
            )}

            {/* List layout */}
            {layout === "list" && (
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
                        backgroundColor: themeStyle.cardBg,
                        borderRadius: "16px",
                        padding: "18px 24px",
                        textDecoration: "none",
                        border: `1px solid ${cardBorderColor}`,
                        boxShadow: cardShadow,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            margin: "0 0 4px",
                            fontSize: "15px",
                            fontWeight: "700",
                            color: themeStyle.text,
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
                              color: themeStyle.subText,
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
                          <span style={{ fontSize: "16px", fontWeight: "800", color: accentColor }}>
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
                            backgroundColor: `${accentColor}18`,
                            color: accentColor,
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
            )}

            {/* Featured layout */}
            {layout === "featured" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {/* First product — large featured card */}
                {publishedProducts[0] && (() => {
                  const p = publishedProducts[0];
                  const ma = p.marketingAssets as MarketingAssets | null;
                  const href = ma?.checkoutUrl || `/product/${p.id}`;
                  return (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "block",
                        backgroundColor: themeStyle.cardBg,
                        borderRadius: "20px",
                        padding: "28px 28px",
                        textDecoration: "none",
                        border: `2px solid ${accentColor}40`,
                        borderLeft: `4px solid ${accentColor}`,
                        boxShadow: `0 8px 32px ${accentColor}22`,
                      }}
                    >
                      <div
                        style={{
                          display: "inline-block",
                          padding: "3px 10px",
                          borderRadius: "20px",
                          background: `${accentColor}18`,
                          color: accentColor,
                          fontSize: "11px",
                          fontWeight: "700",
                          marginBottom: "12px",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        Featured
                      </div>
                      <h3
                        style={{
                          margin: "0 0 8px",
                          fontSize: "20px",
                          fontWeight: "800",
                          color: themeStyle.text,
                        }}
                      >
                        {p.title}
                      </h3>
                      {ma?.productDescription && (
                        <p style={{ margin: "0 0 16px", fontSize: "14px", color: themeStyle.subText, lineHeight: "1.6" }}>
                          {ma.productDescription}
                        </p>
                      )}
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        {ma?.priceLabel && (
                          <span style={{ fontSize: "22px", fontWeight: "800", color: accentColor }}>
                            {ma.priceLabel}
                          </span>
                        )}
                        <div
                          style={{
                            display: "inline-block",
                            padding: "10px 20px",
                            borderRadius: "10px",
                            background: accentColor,
                            color: "#fff",
                            fontSize: "14px",
                            fontWeight: "700",
                          }}
                        >
                          Get it now →
                        </div>
                      </div>
                    </a>
                  );
                })()}

                {/* Remaining products in 2-col grid */}
                {publishedProducts.length > 1 && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    {publishedProducts.slice(1).map((p) => {
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
                            flexDirection: "column",
                            backgroundColor: themeStyle.cardBg,
                            borderRadius: "16px",
                            padding: "18px 20px",
                            textDecoration: "none",
                            border: `1px solid ${cardBorderColor}`,
                            boxShadow: cardShadow,
                          }}
                        >
                          <p
                            style={{
                              margin: "0 0 6px",
                              fontSize: "14px",
                              fontWeight: "700",
                              color: themeStyle.text,
                            }}
                          >
                            {p.title}
                          </p>
                          {ma?.productDescription && (
                            <p
                              style={{
                                margin: "0 0 12px",
                                fontSize: "12px",
                                color: themeStyle.subText,
                                lineHeight: "1.5",
                                flex: 1,
                              }}
                            >
                              {ma.productDescription}
                            </p>
                          )}
                          {ma?.priceLabel && (
                            <span style={{ fontSize: "16px", fontWeight: "800", color: accentColor }}>
                              {ma.priceLabel}
                            </span>
                          )}
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <p
          style={{
            textAlign: "center",
            marginTop: "40px",
            fontSize: "12px",
            color: isDark ? "rgba(255,255,255,0.2)" : "#d1d5db",
          }}
        >
          Powered by{" "}
          <span style={{ color: accentColor, fontWeight: "600" }}>Content Flywheel</span>
        </p>
      </div>
    </main>
  );
}
