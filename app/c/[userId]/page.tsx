import { db } from "@/db/db";
import { brandVoiceTable } from "@/db/schema/brand-voice-schema";
import { productsTable } from "@/db/schema/products-schema";
import { storeSettingsTable } from "@/db/schema/store-settings-schema";
import { productBundlesTable } from "@/db/schema/product-bundles-schema";
import { eq, and, isNull } from "drizzle-orm";
import Link from "next/link";
import type { MarketingAssets } from "@/db/schema/products-schema";

export const dynamic = "force-dynamic";

const THEMES: Record<string, {
  page: string;
  card: string;
  cardBorder: string;
  text: string;
  subText: string;
  mutedText: string;
  isDark: boolean;
}> = {
  warm: {
    page: "#FAFAF8",
    card: "#FFFFFF",
    cardBorder: "#F0EDE8",
    text: "#111111",
    subText: "#555555",
    mutedText: "#999999",
    isDark: false,
  },
  dark: {
    page: "#0A0A0A",
    card: "#141414",
    cardBorder: "#222222",
    text: "#F5F5F5",
    subText: "rgba(255,255,255,0.55)",
    mutedText: "rgba(255,255,255,0.25)",
    isDark: true,
  },
  light: {
    page: "#FFFFFF",
    card: "#F8F8F8",
    cardBorder: "#EFEFEF",
    text: "#111111",
    subText: "#555555",
    mutedText: "#AAAAAA",
    isDark: false,
  },
  minimal: {
    page: "#F5F5F5",
    card: "#FFFFFF",
    cardBorder: "#E8E8E8",
    text: "#111111",
    subText: "#666666",
    mutedText: "#AAAAAA",
    isDark: false,
  },
  bold: {
    page: "#0D0D1A",
    card: "#13131F",
    cardBorder: "#1F1F2E",
    text: "#FFFFFF",
    subText: "rgba(255,255,255,0.6)",
    mutedText: "rgba(255,255,255,0.25)",
    isDark: true,
  },
};

export default async function CreatorProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  const [brandVoice, storeSettings] = await Promise.all([
    db.select().from(brandVoiceTable).where(eq(brandVoiceTable.userId, userId)).limit(1)
      .then((r) => r[0]).catch(() => undefined),
    db.select().from(storeSettingsTable).where(eq(storeSettingsTable.userId, userId)).limit(1)
      .then((r) => r[0]).catch(() => undefined),
  ]);

  const [products, activeBundles] = await Promise.all([
    db.select({ id: productsTable.id, title: productsTable.title, marketingAssets: productsTable.marketingAssets })
      .from(productsTable)
      .where(and(eq(productsTable.userId, userId), isNull(productsTable.deletedAt)))
      .limit(20),
    db.select({ id: productBundlesTable.id, title: productBundlesTable.title, description: productBundlesTable.description, bundlePrice: productBundlesTable.bundlePrice, productIds: productBundlesTable.productIds })
      .from(productBundlesTable)
      .where(and(eq(productBundlesTable.creatorUserId, userId), eq(productBundlesTable.active, true)))
      .limit(10)
      .catch(() => [] as { id: string; title: string; description: string | null; bundlePrice: number; productIds: string[] }[]),
  ]);

  const brandName = brandVoice?.brandName?.trim() || "Creator";
  const initials = brandName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

  const publishedProducts = products.filter((p) => {
    const ma = p.marketingAssets as MarketingAssets | null;
    return ma?.isNativePublished || ma?.checkoutUrl || ma?.priceLabel;
  });

  const theme = storeSettings?.theme ?? "warm";
  const accent = storeSettings?.accentColor ?? "#f97316";
  const layout = storeSettings?.layout ?? "grid";
  const bio = storeSettings?.bio ?? brandVoice?.targetAudience ?? null;
  const profileImageUrl = storeSettings?.profileImageUrl ?? null;
  const bannerImageUrl = storeSettings?.bannerImageUrl ?? null;

  const t = THEMES[theme] ?? THEMES.warm;

  return (
    <main style={{ minHeight: "100vh", background: t.page, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

      {/* ── Hero banner ── */}
      <div style={{ position: "relative", height: "220px", overflow: "hidden" }}>
        {bannerImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bannerImageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          <div style={{
            width: "100%",
            height: "100%",
            background: t.isDark
              ? `radial-gradient(ellipse at 60% 0%, ${accent}55 0%, transparent 70%), radial-gradient(ellipse at 20% 100%, ${accent}33 0%, transparent 60%), ${t.page}`
              : `radial-gradient(ellipse at 60% 0%, ${accent}44 0%, transparent 65%), radial-gradient(ellipse at 10% 100%, ${accent}22 0%, transparent 55%), linear-gradient(180deg, ${accent}18 0%, transparent 100%)`,
          }} />
        )}
        {/* fade to page colour at bottom */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "80px", background: `linear-gradient(to bottom, transparent, ${t.page})` }} />
      </div>

      {/* ── Profile section ── */}
      <div style={{ maxWidth: "560px", margin: "0 auto", padding: "0 20px 80px" }}>

        {/* Avatar */}
        <div style={{ marginTop: "-52px", marginBottom: "20px" }}>
          {profileImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profileImageUrl} alt={brandName} style={{
              width: "96px", height: "96px", borderRadius: "50%", objectFit: "cover",
              border: `4px solid ${t.page}`,
              boxShadow: `0 0 0 1px ${t.cardBorder}, 0 8px 32px rgba(0,0,0,0.12)`,
            }} />
          ) : (
            <div style={{
              width: "96px", height: "96px", borderRadius: "50%",
              background: `linear-gradient(135deg, ${accent}, ${accent}bb)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "32px", fontWeight: "800", color: "#fff", letterSpacing: "-1px",
              border: `4px solid ${t.page}`,
              boxShadow: `0 0 0 1px ${t.cardBorder}, 0 8px 32px ${accent}44`,
            }}>
              {initials}
            </div>
          )}
        </div>

        {/* Name + bio */}
        <h1 style={{ margin: "0 0 6px", fontSize: "26px", fontWeight: "800", color: t.text, letterSpacing: "-0.5px", lineHeight: 1.2 }}>
          {brandName}
        </h1>
        {bio && (
          <p style={{ margin: "0 0 20px", fontSize: "15px", color: t.subText, lineHeight: "1.6", maxWidth: "400px" }}>
            {bio}
          </p>
        )}

        {/* Subscribe button */}
        <Link href={`/subscribe/${userId}`} style={{
          display: "inline-flex", alignItems: "center", gap: "8px",
          padding: "11px 22px", borderRadius: "10px",
          background: accent, color: "#fff",
          fontSize: "14px", fontWeight: "700", textDecoration: "none",
          boxShadow: `0 4px 16px ${accent}44`,
          marginBottom: "40px",
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          Subscribe for updates
        </Link>

        {/* ── Products ── */}
        {publishedProducts.length > 0 && (
          <section style={{ marginBottom: "32px" }}>
            <p style={{ margin: "0 0 16px", fontSize: "11px", fontWeight: "700", color: t.mutedText, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Products
            </p>

            {layout === "list" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {publishedProducts.map((p) => {
                  const ma = p.marketingAssets as MarketingAssets | null;
                  const isNative = !!ma?.isNativePublished;
                  const href = isNative ? `/product/${p.id}` : (ma?.checkoutUrl || `/product/${p.id}`);
                  const coverImg = ma?.bookMockupUrl ?? ma?.coverThumbnailUrl ?? ma?.thumbnailUrl ?? null;
                  const price = ma?.nativePrice ? `£${(ma.nativePrice / 100).toFixed(0)}` : ma?.priceLabel ?? null;
                  return (
                    <a key={p.id} href={href} {...(!isNative && ma?.checkoutUrl ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                      style={{
                        display: "flex", alignItems: "center", gap: "14px",
                        background: t.card, borderRadius: "14px", overflow: "hidden",
                        textDecoration: "none", border: `1px solid ${t.cardBorder}`,
                        padding: "14px 18px 14px 14px",
                        transition: "box-shadow 0.15s",
                      }}>
                      {coverImg ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={coverImg} alt={p.title} style={{ width: "64px", height: "64px", borderRadius: "10px", objectFit: "cover", flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: "64px", height: "64px", borderRadius: "10px", background: `linear-gradient(135deg, ${accent}20, ${accent}40)`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px" }}>📄</div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: "0 0 3px", fontSize: "15px", fontWeight: "700", color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</p>
                        {ma?.productDescription && <p style={{ margin: 0, fontSize: "13px", color: t.subText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ma.productDescription}</p>}
                      </div>
                      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: "12px" }}>
                        {price && <span style={{ fontSize: "17px", fontWeight: "800", color: accent }}>{price}</span>}
                        <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: `${accent}18`, display: "flex", alignItems: "center", justifyContent: "center", color: accent, fontSize: "15px", fontWeight: "700" }}>→</div>
                      </div>
                    </a>
                  );
                })}
              </div>
            ) : layout === "featured" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {/* Featured first product */}
                {publishedProducts[0] && (() => {
                  const p = publishedProducts[0];
                  const ma = p.marketingAssets as MarketingAssets | null;
                  const isNative = !!ma?.isNativePublished;
                  const href = isNative ? `/product/${p.id}` : (ma?.checkoutUrl || `/product/${p.id}`);
                  const coverImg = ma?.bookMockupUrl ?? ma?.coverThumbnailUrl ?? ma?.thumbnailUrl ?? null;
                  const price = ma?.nativePrice ? `£${(ma.nativePrice / 100).toFixed(0)}` : ma?.priceLabel ?? null;
                  return (
                    <a href={href} {...(!isNative && ma?.checkoutUrl ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                      style={{ display: "block", background: t.card, borderRadius: "18px", overflow: "hidden", textDecoration: "none", border: `1px solid ${t.cardBorder}`, boxShadow: `0 8px 40px ${accent}18` }}>
                      {coverImg ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={coverImg} alt={p.title} style={{ width: "100%", height: "200px", objectFit: "cover", display: "block" }} />
                      ) : (
                        <div style={{ height: "160px", background: `linear-gradient(135deg, ${accent}30, ${accent}60)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "48px" }}>📄</div>
                      )}
                      <div style={{ padding: "22px 24px" }}>
                        <span style={{ display: "inline-block", fontSize: "10px", fontWeight: "700", color: accent, background: `${accent}18`, padding: "3px 10px", borderRadius: "20px", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Featured</span>
                        <h3 style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: "800", color: t.text, letterSpacing: "-0.3px" }}>{p.title}</h3>
                        {ma?.productDescription && <p style={{ margin: "0 0 18px", fontSize: "14px", color: t.subText, lineHeight: "1.6" }}>{ma.productDescription.slice(0, 120)}{ma.productDescription.length > 120 ? "…" : ""}</p>}
                        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                          {price && <span style={{ fontSize: "24px", fontWeight: "800", color: accent }}>{price}</span>}
                          <div style={{ padding: "10px 20px", borderRadius: "10px", background: accent, color: "#fff", fontSize: "14px", fontWeight: "700" }}>Get it →</div>
                        </div>
                      </div>
                    </a>
                  );
                })()}
                {/* Rest in 2-col grid */}
                {publishedProducts.length > 1 && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    {publishedProducts.slice(1).map((p) => {
                      const ma = p.marketingAssets as MarketingAssets | null;
                      const isNative = !!ma?.isNativePublished;
                      const href = isNative ? `/product/${p.id}` : (ma?.checkoutUrl || `/product/${p.id}`);
                      const coverImg = ma?.bookMockupUrl ?? ma?.coverThumbnailUrl ?? ma?.thumbnailUrl ?? null;
                      const price = ma?.nativePrice ? `£${(ma.nativePrice / 100).toFixed(0)}` : ma?.priceLabel ?? null;
                      return (
                        <a key={p.id} href={href} {...(!isNative && ma?.checkoutUrl ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                          style={{ display: "flex", flexDirection: "column", background: t.card, borderRadius: "14px", overflow: "hidden", textDecoration: "none", border: `1px solid ${t.cardBorder}` }}>
                          {coverImg ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={coverImg} alt={p.title} style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", display: "block" }} />
                          ) : (
                            <div style={{ width: "100%", aspectRatio: "4/3", background: `linear-gradient(135deg, ${accent}20, ${accent}40)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px" }}>📄</div>
                          )}
                          <div style={{ padding: "12px 14px" }}>
                            <p style={{ margin: "0 0 4px", fontSize: "13px", fontWeight: "700", color: t.text, lineHeight: "1.3" }}>{p.title}</p>
                            {price && <span style={{ fontSize: "15px", fontWeight: "800", color: accent }}>{price}</span>}
                          </div>
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* Default: grid */
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                {publishedProducts.map((p) => {
                  const ma = p.marketingAssets as MarketingAssets | null;
                  const isNative = !!ma?.isNativePublished;
                  const href = isNative ? `/product/${p.id}` : (ma?.checkoutUrl || `/product/${p.id}`);
                  const coverImg = ma?.bookMockupUrl ?? ma?.coverThumbnailUrl ?? ma?.thumbnailUrl ?? null;
                  const price = ma?.nativePrice ? `£${(ma.nativePrice / 100).toFixed(0)}` : ma?.priceLabel ?? null;
                  return (
                    <a key={p.id} href={href} {...(!isNative && ma?.checkoutUrl ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                      style={{ display: "flex", flexDirection: "column", background: t.card, borderRadius: "16px", overflow: "hidden", textDecoration: "none", border: `1px solid ${t.cardBorder}` }}>
                      {/* Image */}
                      {coverImg ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={coverImg} alt={p.title} style={{ width: "100%", aspectRatio: "1/1", objectFit: "cover", display: "block" }} />
                      ) : (
                        <div style={{ width: "100%", aspectRatio: "1/1", background: `linear-gradient(135deg, ${accent}18, ${accent}38)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "32px" }}>📄</div>
                      )}
                      {/* Info */}
                      <div style={{ padding: "14px 16px 16px", flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                        <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: t.text, lineHeight: "1.35", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.title}</p>
                        {ma?.productDescription && (
                          <p style={{ margin: 0, fontSize: "12px", color: t.subText, lineHeight: "1.4", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{ma.productDescription}</p>
                        )}
                        {price && (
                          <div style={{ marginTop: "auto", paddingTop: "10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span style={{ fontSize: "17px", fontWeight: "800", color: accent }}>{price}</span>
                            <div style={{ fontSize: "12px", fontWeight: "700", color: "#fff", background: accent, padding: "5px 12px", borderRadius: "8px" }}>Buy</div>
                          </div>
                        )}
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ── Bundles ── */}
        {activeBundles.length > 0 && (
          <section>
            <p style={{ margin: "0 0 16px", fontSize: "11px", fontWeight: "700", color: t.mutedText, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Bundles
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {activeBundles.map((b) => (
                <a key={b.id} href={`/bundle/${b.id}`}
                  style={{ display: "flex", alignItems: "center", gap: "16px", background: t.card, borderRadius: "14px", textDecoration: "none", border: `1px solid ${t.cardBorder}`, padding: "16px 18px" }}>
                  <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: `linear-gradient(135deg, ${accent}22, ${accent}44)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "22px" }}>📦</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
                      <p style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.title}</p>
                      <span style={{ fontSize: "10px", fontWeight: "700", color: accent, background: `${accent}18`, padding: "2px 8px", borderRadius: "20px", flexShrink: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>Bundle</span>
                    </div>
                    <p style={{ margin: 0, fontSize: "13px", color: t.subText }}>{b.productIds.length} products{b.description ? ` · ${b.description}` : ""}</p>
                  </div>
                  <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "17px", fontWeight: "800", color: accent }}>£{(b.bundlePrice / 100).toFixed(0)}</span>
                    <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: `${accent}18`, display: "flex", alignItems: "center", justifyContent: "center", color: accent, fontSize: "14px" }}>→</div>
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* ── Empty state ── */}
        {publishedProducts.length === 0 && activeBundles.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <p style={{ fontSize: "40px", marginBottom: "12px" }}>🛍️</p>
            <p style={{ fontSize: "16px", fontWeight: "600", color: t.text, margin: "0 0 6px" }}>No products yet</p>
            <p style={{ fontSize: "14px", color: t.mutedText, margin: 0 }}>Check back soon!</p>
          </div>
        )}

        {/* ── Footer ── */}
        <p style={{ textAlign: "center", marginTop: "56px", fontSize: "11px", color: t.mutedText }}>
          Powered by <span style={{ color: accent, fontWeight: "700" }}>Content Flywheel</span>
        </p>
      </div>
    </main>
  );
}
