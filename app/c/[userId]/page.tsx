import { db } from "@/db/db";
import { brandVoiceTable } from "@/db/schema/brand-voice-schema";
import { productsTable } from "@/db/schema/products-schema";
import { storeSettingsTable } from "@/db/schema/store-settings-schema";
import { productBundlesTable } from "@/db/schema/product-bundles-schema";
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

  const [products, activeBundles] = await Promise.all([
    db
      .select({
        id: productsTable.id,
        title: productsTable.title,
        marketingAssets: productsTable.marketingAssets,
      })
      .from(productsTable)
      .where(and(eq(productsTable.userId, userId), isNull(productsTable.deletedAt)))
      .limit(20),
    db
      .select({
        id: productBundlesTable.id,
        title: productBundlesTable.title,
        description: productBundlesTable.description,
        bundlePrice: productBundlesTable.bundlePrice,
        productIds: productBundlesTable.productIds,
      })
      .from(productBundlesTable)
      .where(and(eq(productBundlesTable.creatorUserId, userId), eq(productBundlesTable.active, true)))
      .limit(10)
      .catch(() => [] as { id: string; title: string; description: string | null; bundlePrice: number; productIds: string[] }[]),
  ]);

  const brandName = brandVoice?.brandName?.trim() || "Creator";
  const initials = brandName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const publishedProducts = products.filter((p) => {
    const ma = p.marketingAssets as MarketingAssets | null;
    return ma?.isNativePublished || ma?.checkoutUrl || ma?.priceLabel;
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
                  const isNative = !!ma?.isNativePublished;
                  const href = isNative ? `/product/${p.id}` : (ma?.checkoutUrl || `/product/${p.id}`);
                  const coverImg = ma?.bookMockupUrl ?? ma?.coverThumbnailUrl ?? ma?.thumbnailUrl ?? null;
                  const priceDisplay = ma?.nativePrice
                    ? `£${(ma.nativePrice / 100).toFixed(2)}`
                    : ma?.priceLabel ?? null;
                  return (
                    <a
                      key={p.id}
                      href={href}
                      {...(!isNative && ma?.checkoutUrl ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        backgroundColor: themeStyle.cardBg,
                        borderRadius: "16px",
                        overflow: "hidden",
                        textDecoration: "none",
                        border: `1px solid ${cardBorderColor}`,
                        boxShadow: cardShadow,
                      }}
                    >
                      {/* Cover image or gradient placeholder */}
                      {coverImg ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={coverImg} alt={p.title} style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", display: "block" }} />
                      ) : (
                        <div style={{ width: "100%", aspectRatio: "4/3", background: `linear-gradient(135deg, ${accentColor}22, ${accentColor}44)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ fontSize: "28px", opacity: 0.5 }}>📄</span>
                        </div>
                      )}
                      <div style={{ padding: "14px 16px", flex: 1, display: "flex", flexDirection: "column" }}>
                        <p
                          style={{
                            margin: "0 0 4px",
                            fontSize: "13px",
                            fontWeight: "700",
                            color: themeStyle.text,
                            lineHeight: "1.3",
                          }}
                        >
                          {p.title}
                        </p>
                        {priceDisplay && (
                          <span style={{ fontSize: "15px", fontWeight: "800", color: accentColor, marginTop: "auto", paddingTop: "8px", display: "block" }}>
                            {priceDisplay}
                          </span>
                        )}
                      </div>
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
                  const isNative = !!ma?.isNativePublished;
                  const href = isNative ? `/product/${p.id}` : (ma?.checkoutUrl || `/product/${p.id}`);
                  const coverImg = ma?.bookMockupUrl ?? ma?.coverThumbnailUrl ?? ma?.thumbnailUrl ?? null;
                  const priceDisplay = ma?.nativePrice
                    ? `£${(ma.nativePrice / 100).toFixed(2)}`
                    : ma?.priceLabel ?? null;
                  return (
                    <a
                      key={p.id}
                      href={href}
                      {...(!isNative && ma?.checkoutUrl ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "16px",
                        backgroundColor: themeStyle.cardBg,
                        borderRadius: "16px",
                        overflow: "hidden",
                        textDecoration: "none",
                        border: `1px solid ${cardBorderColor}`,
                        boxShadow: cardShadow,
                      }}
                    >
                      {/* Thumbnail */}
                      {coverImg ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={coverImg} alt={p.title} style={{ width: "80px", height: "80px", objectFit: "cover", flexShrink: 0, display: "block" }} />
                      ) : (
                        <div style={{ width: "80px", height: "80px", flexShrink: 0, background: `linear-gradient(135deg, ${accentColor}22, ${accentColor}44)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ fontSize: "22px", opacity: 0.5 }}>📄</span>
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0, padding: "16px 0" }}>
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
                      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0, paddingRight: "20px" }}>
                        {priceDisplay && (
                          <span style={{ fontSize: "16px", fontWeight: "800", color: accentColor }}>
                            {priceDisplay}
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
                  const isNative = !!ma?.isNativePublished;
                  const href = isNative ? `/product/${p.id}` : (ma?.checkoutUrl || `/product/${p.id}`);
                  const coverImg = ma?.bookMockupUrl ?? ma?.coverThumbnailUrl ?? ma?.thumbnailUrl ?? null;
                  const priceDisplay = ma?.nativePrice
                    ? `£${(ma.nativePrice / 100).toFixed(2)}`
                    : ma?.priceLabel ?? null;
                  return (
                    <a
                      href={href}
                      {...(!isNative && ma?.checkoutUrl ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                      style={{
                        display: "block",
                        backgroundColor: themeStyle.cardBg,
                        borderRadius: "20px",
                        overflow: "hidden",
                        textDecoration: "none",
                        border: `2px solid ${accentColor}40`,
                        boxShadow: `0 8px 32px ${accentColor}22`,
                      }}
                    >
                      {/* Hero image */}
                      {coverImg ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={coverImg} alt={p.title} style={{ width: "100%", height: "200px", objectFit: "cover", display: "block" }} />
                      ) : (
                        <div style={{ width: "100%", height: "160px", background: `linear-gradient(135deg, ${accentColor}33, ${accentColor}66)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ fontSize: "40px", opacity: 0.6 }}>📄</span>
                        </div>
                      )}
                      <div style={{ padding: "24px 24px 24px" }}>
                        <div
                          style={{
                            display: "inline-block",
                            padding: "3px 10px",
                            borderRadius: "20px",
                            background: `${accentColor}18`,
                            color: accentColor,
                            fontSize: "11px",
                            fontWeight: "700",
                            marginBottom: "10px",
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
                            {ma.productDescription.slice(0, 120)}{ma.productDescription.length > 120 ? "…" : ""}
                          </p>
                        )}
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          {priceDisplay && (
                            <span style={{ fontSize: "22px", fontWeight: "800", color: accentColor }}>
                              {priceDisplay}
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
                      </div>
                    </a>
                  );
                })()}

                {/* Remaining products in 2-col grid with thumbnails */}
                {publishedProducts.length > 1 && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    {publishedProducts.slice(1).map((p) => {
                      const ma = p.marketingAssets as MarketingAssets | null;
                      const isNative = !!ma?.isNativePublished;
                      const href = isNative ? `/product/${p.id}` : (ma?.checkoutUrl || `/product/${p.id}`);
                      const coverImg = ma?.bookMockupUrl ?? ma?.coverThumbnailUrl ?? ma?.thumbnailUrl ?? null;
                      const priceDisplay = ma?.nativePrice
                        ? `£${(ma.nativePrice / 100).toFixed(2)}`
                        : ma?.priceLabel ?? null;
                      return (
                        <a
                          key={p.id}
                          href={href}
                          {...(!isNative && ma?.checkoutUrl ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            backgroundColor: themeStyle.cardBg,
                            borderRadius: "16px",
                            overflow: "hidden",
                            textDecoration: "none",
                            border: `1px solid ${cardBorderColor}`,
                            boxShadow: cardShadow,
                          }}
                        >
                          {coverImg ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={coverImg} alt={p.title} style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", display: "block" }} />
                          ) : (
                            <div style={{ width: "100%", aspectRatio: "4/3", background: `linear-gradient(135deg, ${accentColor}22, ${accentColor}44)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <span style={{ fontSize: "24px", opacity: 0.5 }}>📄</span>
                            </div>
                          )}
                          <div style={{ padding: "14px 16px" }}>
                            <p
                              style={{
                                margin: "0 0 4px",
                                fontSize: "13px",
                                fontWeight: "700",
                                color: themeStyle.text,
                                lineHeight: "1.3",
                              }}
                            >
                              {p.title}
                            </p>
                            {priceDisplay && (
                              <span style={{ fontSize: "15px", fontWeight: "800", color: accentColor }}>
                                {priceDisplay}
                              </span>
                            )}
                          </div>
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Bundles */}
        {activeBundles.length > 0 && (
          <>
            <h2
              style={{
                fontSize: "13px",
                fontWeight: "700",
                color: isDark ? "rgba(255,255,255,0.4)" : "#9ca3af",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                margin: "24px 0 12px 4px",
              }}
            >
              Bundles
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {activeBundles.map((b) => (
                <a
                  key={b.id}
                  href={`/bundle/${b.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                    backgroundColor: themeStyle.cardBg,
                    borderRadius: "16px",
                    overflow: "hidden",
                    textDecoration: "none",
                    border: `1px solid ${cardBorderColor}`,
                    boxShadow: cardShadow,
                    padding: "16px 20px",
                  }}
                >
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "12px",
                      background: `linear-gradient(135deg, ${accentColor}22, ${accentColor}44)`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      fontSize: "22px",
                    }}
                  >
                    📦
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "15px",
                          fontWeight: "700",
                          color: themeStyle.text,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {b.title}
                      </p>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: "600",
                          color: accentColor,
                          backgroundColor: `${accentColor}18`,
                          padding: "2px 8px",
                          borderRadius: "20px",
                          flexShrink: 0,
                        }}
                      >
                        Bundle
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: "13px", color: themeStyle.subText }}>
                      {b.productIds.length} products included
                      {b.description ? ` · ${b.description}` : ""}
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
                    <span style={{ fontSize: "17px", fontWeight: "800", color: accentColor }}>
                      £{(b.bundlePrice / 100).toFixed(2)}
                    </span>
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
              ))}
            </div>
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
