import { db } from "@/db/db";
import { brandVoiceTable } from "@/db/schema/brand-voice-schema";
import { productsTable } from "@/db/schema/products-schema";
import { storeSettingsTable } from "@/db/schema/store-settings-schema";
import { productBundlesTable } from "@/db/schema/product-bundles-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { creatorFollowsTable } from "@/db/schema/creator-follows-schema";
import { creatorScoresTable } from "@/db/schema/creator-scores-schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import FollowButton from "@/components/FollowButton";
import type { MarketingAssets } from "@/db/schema/products-schema";
import { getCreatorLevel } from "@/lib/rewards-config";
import { TrustScoreCard } from "@/components/TrustScoreBadge";

export const dynamic = "force-dynamic";

const THEMES: Record<string, {
  page: string; card: string; cardBorder: string;
  text: string; subText: string; mutedText: string;
  isDark: boolean; inputBg: string;
}> = {
  warm:    { page: "#FDF6EE", card: "#FFFFFF", cardBorder: "#EDE8DF", text: "#111111", subText: "#555555", mutedText: "#AAAAAA", isDark: false, inputBg: "#F5F0E8" },
  dark:    { page: "#0A0A0C", card: "#141418", cardBorder: "#222228", text: "#F5F5F5", subText: "rgba(255,255,255,0.55)", mutedText: "rgba(255,255,255,0.25)", isDark: true, inputBg: "#1A1A1E" },
  light:   { page: "#F8F8FB", card: "#FFFFFF", cardBorder: "#E8E8EE", text: "#111111", subText: "#555555", mutedText: "#BBBBBB", isDark: false, inputBg: "#F0F0F5" },
  minimal: { page: "#F2F2F0", card: "#FFFFFF", cardBorder: "#E2E2DF", text: "#111111", subText: "#666666", mutedText: "#BBBBBB", isDark: false, inputBg: "#E8E8E5" },
  bold:    { page: "#0C0C1A", card: "#12122A", cardBorder: "#1E1E3A", text: "#FFFFFF", subText: "rgba(255,255,255,0.6)", mutedText: "rgba(255,255,255,0.25)", isDark: true, inputBg: "#181828" },
};

// Format price — shows pence as £X or £X.XX
function fmtPrice(pence: number): string {
  const pounds = pence / 100;
  return pounds % 1 === 0 ? `\xa3${pounds.toFixed(0)}` : `\xa3${pounds.toFixed(2)}`;
}

// Category emoji by format/type
function productEmoji(ma: MarketingAssets | null): string {
  const f = (ma as any)?.format ?? "";
  if (f === "ebook") return "📚";
  if (f === "course") return "🎓";
  if (f === "template") return "📋";
  if (f === "spreadsheet") return "📊";
  return "✦";
}

export default async function CreatorProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  // Guard: 404 for deleted or non-existent accounts
  const [profile] = await db
    .select({ deletedAt: profilesTable.deletedAt })
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId))
    .limit(1);
  if (!profile || profile.deletedAt !== null) notFound();

  const [brandVoice, storeSettings] = await Promise.all([
    db.select().from(brandVoiceTable).where(eq(brandVoiceTable.userId, userId)).limit(1)
      .then((r) => r[0]).catch(() => undefined),
    db.select().from(storeSettingsTable).where(eq(storeSettingsTable.userId, userId)).limit(1)
      .then((r) => r[0]).catch(() => undefined),
  ]);

  const [products, activeBundles, followerCountRow, creatorScore] = await Promise.all([
    db.select({ id: productsTable.id, title: productsTable.title, marketingAssets: productsTable.marketingAssets })
      .from(productsTable)
      .where(and(eq(productsTable.userId, userId), isNull(productsTable.deletedAt)))
      .limit(20),
    db.select({ id: productBundlesTable.id, title: productBundlesTable.title, description: productBundlesTable.description, bundlePrice: productBundlesTable.bundlePrice, productIds: productBundlesTable.productIds })
      .from(productBundlesTable)
      .where(and(eq(productBundlesTable.creatorUserId, userId), eq(productBundlesTable.active, true)))
      .limit(10)
      .catch(() => [] as { id: string; title: string; description: string | null; bundlePrice: number; productIds: string[] }[]),
    db.select({ count: sql<number>`count(*)::int` })
      .from(creatorFollowsTable)
      .where(eq(creatorFollowsTable.followedId, userId))
      .then((r) => r[0]).catch(() => ({ count: 0 })),
    db.select({ salesCount: creatorScoresTable.salesCount, level: creatorScoresTable.level })
      .from(creatorScoresTable)
      .where(eq(creatorScoresTable.userId, userId))
      .limit(1)
      .then((r) => r[0]).catch(() => undefined),
  ]);

  const followerCount = followerCountRow?.count ?? 0;
  const salesCount = creatorScore?.salesCount ?? 0;
  const creatorLevel = getCreatorLevel(salesCount);

  const brandName = (storeSettings?.storeName?.trim() || brandVoice?.brandName?.trim() || "Creator") as string;
  const initials = brandName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

  const rawProducts = products.filter((p) => {
    const ma = p.marketingAssets as MarketingAssets | null;
    return ma?.isNativePublished || ma?.checkoutUrl || ma?.priceLabel;
  });

  // Sort products
  const productSort = storeSettings?.productSort ?? "newest";
  const publishedProducts = [...rawProducts].sort((a, b) => {
    if (productSort === "oldest") return 0; // DB order (oldest first from limit)
    if (productSort === "price-asc") {
      const pa = ((a.marketingAssets as MarketingAssets | null)?.nativePrice ?? 0);
      const pb = ((b.marketingAssets as MarketingAssets | null)?.nativePrice ?? 0);
      return pa - pb;
    }
    if (productSort === "price-desc") {
      const pa = ((a.marketingAssets as MarketingAssets | null)?.nativePrice ?? 0);
      const pb = ((b.marketingAssets as MarketingAssets | null)?.nativePrice ?? 0);
      return pb - pa;
    }
    return 0; // newest = default DB order
  });

  const theme = storeSettings?.theme ?? "warm";
  const accent = storeSettings?.accentColor ?? "#f97316";
  const layout = storeSettings?.layout ?? "grid";
  const bio = storeSettings?.bio ?? brandVoice?.targetAudience ?? null;
  const tagline = (storeSettings as unknown as { tagline?: string | null })?.tagline ?? null;
  const announcementText = (storeSettings as unknown as { announcementText?: string | null })?.announcementText ?? null;
  const buttonText = (storeSettings as unknown as { buttonText?: string | null })?.buttonText ?? "Subscribe for updates";
  const fontFamily = (storeSettings as unknown as { fontFamily?: string | null })?.fontFamily ?? "inter";
  const showTrustBadges = (storeSettings as unknown as { showTrustBadges?: boolean | null })?.showTrustBadges ?? true;
  const profileImageUrl = storeSettings?.profileImageUrl ?? null;
  const bannerImageUrl = storeSettings?.bannerImageUrl ?? null;
  const bannerGradient = storeSettings?.bannerGradient ?? null;

  const FONT_CSS: Record<string, string> = {
    inter:       "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    poppins:     "'Poppins', sans-serif",
    playfair:    "'Playfair Display', Georgia, serif",
    montserrat:  "'Montserrat', sans-serif",
    "dm-sans":   "'DM Sans', sans-serif",
  };
  const pageFontFamily = FONT_CSS[fontFamily] ?? FONT_CSS.inter;

  const t = THEMES[theme] ?? THEMES.warm;

  // Social links
  let socialLinks: Record<string, string> = {};
  try { socialLinks = JSON.parse(storeSettings?.socialLinks ?? "{}") ?? {}; } catch {}
  const showSocial = storeSettings?.showSocialLinks && Object.keys(socialLinks).some((k) => socialLinks[k]);

  // Banner background
  let bannerBg: string;
  if (bannerImageUrl) {
    bannerBg = `url(${bannerImageUrl}) center top/cover no-repeat`;
  } else if (bannerGradient) {
    bannerBg = `linear-gradient(${bannerGradient})`;
  } else {
    bannerBg = t.isDark
      ? `radial-gradient(ellipse at 70% 0%, ${accent}60 0%, transparent 65%), radial-gradient(ellipse at 10% 110%, ${accent}30 0%, transparent 55%), ${t.page}`
      : `radial-gradient(ellipse at 70% 0%, ${accent}50 0%, transparent 65%), radial-gradient(ellipse at 10% 110%, ${accent}25 0%, transparent 55%), linear-gradient(180deg, ${accent}22 0%, ${t.page} 100%)`;
  }

  const socialIcons: Record<string, string> = {
    twitter: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.843L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
    instagram: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>`,
    youtube: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`,
    tiktok: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.78a8.18 8.18 0 004.78 1.52V6.82a4.85 4.85 0 01-1.01-.13z"/></svg>`,
    linkedin: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>`,
    website: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
  };

  return (
    <main style={{ minHeight: "100vh", background: t.isDark
        ? `radial-gradient(ellipse 160% 60% at 50% -5%, ${accent}70 0%, transparent 55%), radial-gradient(ellipse 100% 50% at 85% 100%, ${accent}50 0%, transparent 55%), ${t.page}`
        : `radial-gradient(ellipse 160% 55% at 50% -5%, ${accent}55 0%, transparent 52%), radial-gradient(ellipse 100% 45% at 85% 95%, ${accent}38 0%, transparent 55%), linear-gradient(180deg, ${t.page} 0%, #fff 100%)`,
      fontFamily: pageFontFamily }}>
      <style>{`
        .cf-grid-2 { display: grid; grid-template-columns: 1fr 1fr; }
        .cf-avatar-row { display: flex; align-items: flex-end; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-top: 12px; margin-bottom: 12px; }
        @media (max-width: 420px) {
          .cf-grid-2 { grid-template-columns: 1fr; }
          .cf-avatar-row { align-items: flex-start; }
        }
      `}</style>
      {/* Announcement bar */}
      {announcementText && (
        <div style={{ background: accent, padding: "9px 16px", textAlign: "center", fontSize: "13px", fontWeight: "700", color: "#fff", letterSpacing: "0.01em" }}>
          📢 {announcementText}
        </div>
      )}

      {/* ── Hero banner ── */}
      <div style={{ position: "relative", height: bannerImageUrl ? "220px" : "200px", overflow: "hidden" }}>

        {bannerImageUrl ? (
          /* Photo banner — full bleed image pinned to top */
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bannerImageUrl}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", display: "block" }}
          />
        ) : bannerGradient ? (
          /* Custom gradient set by creator */
          <div style={{ width: "100%", height: "100%", background: `linear-gradient(${bannerGradient})` }} />
        ) : (
          /* ── Designed default banner ── */
          <div style={{
            width: "100%", height: "100%", position: "relative", overflow: "hidden",
            background: t.isDark
              ? `linear-gradient(135deg, ${accent}ee 0%, ${accent}99 40%, #0a0a0c 100%)`
              : `linear-gradient(135deg, ${accent} 0%, ${accent}cc 50%, ${accent}88 100%)`,
          }}>
            {/* Decorative circles */}
            <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "200px", height: "200px", borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
            <div style={{ position: "absolute", bottom: "-60px", right: "15%", width: "160px", height: "160px", borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
            <div style={{ position: "absolute", top: "20px", left: "-30px", width: "120px", height: "120px", borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
            {/* Grid dots pattern */}
            <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px)", backgroundSize: "28px 28px", opacity: 0.6 }} />
            {/* Brand text */}
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column",
              alignItems: "flex-start", justifyContent: "flex-end",
              padding: "0 28px 32px",
            }}>
              <p style={{ margin: "0 0 6px", fontSize: "28px", fontWeight: "900", color: "#fff", letterSpacing: "-0.8px", lineHeight: 1.1, textShadow: "0 2px 12px rgba(0,0,0,0.2)" }}>
                {brandName}
              </p>
              {tagline && (
                <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "rgba(255,255,255,0.85)", letterSpacing: "-0.1px" }}>
                  {tagline}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Gradient fade into page */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "70px", background: `linear-gradient(to bottom, transparent 0%, ${t.page}cc 70%, ${t.page} 100%)` }} />
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth: "620px", margin: "0 auto", padding: "0 24px 56px" }}>

        {/* Avatar — sits below banner with a gap */}
        <div className="cf-avatar-row">
          {profileImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profileImageUrl} alt={brandName} style={{
              width: "108px", height: "108px", borderRadius: "50%", objectFit: "cover",
              border: `5px solid ${t.page}`,
              boxShadow: `0 0 0 1px ${t.cardBorder}, 0 8px 32px rgba(0,0,0,0.15)`,
              flexShrink: 0,
            }} />
          ) : (
            <div style={{
              width: "108px", height: "108px", borderRadius: "50%", flexShrink: 0,
              background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "38px", fontWeight: "800", color: "#fff", letterSpacing: "-1.5px",
              border: `5px solid ${t.page}`,
              boxShadow: `0 0 0 1px ${t.cardBorder}, 0 8px 32px ${accent}55`,
            }}>
              {initials}
            </div>
          )}
          {/* Follow + Subscribe buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
            <FollowButton creatorId={userId} initialFollowerCount={followerCount} accentColor={accent} />
            <Link href={`/subscribe/${userId}`} style={{
              display: "inline-flex", alignItems: "center", gap: "6px",
              padding: "10px 18px", borderRadius: "100px",
              background: "transparent",
              border: `2px solid ${accent}55`,
              color: t.text,
              fontSize: "13px", fontWeight: "700", textDecoration: "none",
              letterSpacing: "-0.2px",
              transition: "all 0.15s",
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              {buttonText}
            </Link>
          </div>
        </div>

        {/* Name + tagline + bio */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "4px" }}>
          <h1 style={{ margin: 0, fontSize: "28px", fontWeight: "800", color: t.text, letterSpacing: "-0.8px", lineHeight: 1.15 }}>
            {brandName}
          </h1>
          {/* Creator level badge */}
          <span style={{
            display: "inline-flex", alignItems: "center", gap: "4px",
            padding: "3px 10px", borderRadius: "999px",
            background: t.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
            border: `1px solid ${t.cardBorder}`,
            fontSize: "12px", fontWeight: "700", color: t.subText,
            letterSpacing: "0.01em", whiteSpace: "nowrap",
          }}>
            {creatorLevel.emoji} {creatorLevel.label}
          </span>
        </div>
        {tagline && (
          <p style={{ margin: "0 0 8px", fontSize: "14px", fontWeight: "600", color: accent }}>
            {tagline}
          </p>
        )}
        {bio && (
          <p style={{ margin: "0 0 16px", fontSize: "15px", color: t.subText, lineHeight: "1.65", maxWidth: "480px" }}>
            {bio}
          </p>
        )}

        {/* Stats row */}
        {(publishedProducts.length > 0 || activeBundles.length > 0) && (
          <div style={{ display: "flex", alignItems: "center", gap: "20px", marginBottom: "14px" }}>
            {publishedProducts.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <span style={{ fontSize: "15px", fontWeight: "800", color: t.text }}>{publishedProducts.length}</span>
                <span style={{ fontSize: "13px", color: t.subText }}>{publishedProducts.length === 1 ? "product" : "products"}</span>
              </div>
            )}
            {activeBundles.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <span style={{ fontSize: "15px", fontWeight: "800", color: t.text }}>{activeBundles.length}</span>
                <span style={{ fontSize: "13px", color: t.subText }}>{activeBundles.length === 1 ? "bundle" : "bundles"}</span>
              </div>
            )}
          </div>
        )}

        {/* Trust Score — only renders if creator has opted in publicly */}
        <div style={{ marginBottom: "16px" }}>
          <TrustScoreCard userId={userId} accentColor={accent} />
        </div>

        {/* Social links */}
        {showSocial && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
            {Object.entries(socialLinks).filter(([, v]) => v).map(([platform, url]) => (
              <a key={platform} href={url.startsWith("http") ? url : `https://${url}`} target="_blank" rel="noopener noreferrer"
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: "36px", height: "36px", borderRadius: "10px",
                  background: t.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                  color: t.subText, textDecoration: "none",
                  transition: "opacity 0.15s",
                }}
                title={platform}
                dangerouslySetInnerHTML={{ __html: socialIcons[platform] ?? socialIcons.website }}
              />
            ))}
          </div>
        )}

        {!showSocial && <div style={{ marginBottom: bio ? "20px" : "14px" }} />}

        {/* ── Products ── */}
        {publishedProducts.length > 0 && (
          <section style={{ marginBottom: "24px" }}>
            <p style={{ margin: "0 0 16px", fontSize: "11px", fontWeight: "700", color: t.mutedText, textTransform: "uppercase", letterSpacing: "0.12em" }}>
              Products
            </p>

            {layout === "list" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {publishedProducts.map((p) => {
                  const ma = p.marketingAssets as MarketingAssets | null;
                  const isNative = !!ma?.isNativePublished;
                  const href = isNative ? `/product/${p.id}` : (ma?.checkoutUrl || `/product/${p.id}`);
                  const coverImg = ma?.coverThumbnailUrl ?? ma?.bookMockupUrl ?? ma?.thumbnailUrl ?? null;
                  const price = ma?.nativePrice ? fmtPrice(ma.nativePrice) : ma?.priceLabel ?? null;
                  const emoji = productEmoji(ma);
                  return (
                    <a key={p.id} href={href} {...(!isNative && ma?.checkoutUrl ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                      style={{
                        display: "flex", alignItems: "center", gap: "14px",
                        background: t.card, borderRadius: "16px", overflow: "hidden",
                        textDecoration: "none", border: `1px solid ${t.cardBorder}`,
                        padding: "14px 16px 14px 14px",
                      }}>
                      {coverImg ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={coverImg} alt={p.title} style={{ width: "72px", height: "72px", borderRadius: "12px", objectFit: "cover", flexShrink: 0 }} />
                      ) : (
                        <div style={{
                          width: "72px", height: "72px", borderRadius: "12px",
                          background: `linear-gradient(135deg, ${accent}18, ${accent}42)`,
                          flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "26px", border: `1px solid ${accent}25`,
                        }}>{emoji}</div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: "700", color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.2px" }}>{p.title}</p>
                        {ma?.productDescription && <p style={{ margin: 0, fontSize: "13px", color: t.subText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: "1.4" }}>{ma.productDescription}</p>}
                      </div>
                      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: "12px" }}>
                        {price && <span style={{ fontSize: "18px", fontWeight: "800", color: accent, letterSpacing: "-0.5px" }}>{price}</span>}
                        <div style={{
                          padding: "8px 18px", borderRadius: "100px",
                          background: accent, color: "#fff",
                          fontSize: "13px", fontWeight: "700",
                          letterSpacing: "-0.1px",
                          boxShadow: `0 2px 8px ${accent}40`,
                        }}>Buy</div>
                      </div>
                    </a>
                  );
                })}
              </div>

            ) : layout === "featured" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {/* Featured first product */}
                {publishedProducts[0] && (() => {
                  const p = publishedProducts[0];
                  const ma = p.marketingAssets as MarketingAssets | null;
                  const isNative = !!ma?.isNativePublished;
                  const href = isNative ? `/product/${p.id}` : (ma?.checkoutUrl || `/product/${p.id}`);
                  const coverImg = ma?.coverThumbnailUrl ?? ma?.bookMockupUrl ?? ma?.thumbnailUrl ?? null;
                  const price = ma?.nativePrice ? fmtPrice(ma.nativePrice) : ma?.priceLabel ?? null;
                  const emoji = productEmoji(ma);
                  return (
                    <a href={href} {...(!isNative && ma?.checkoutUrl ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                      style={{ display: "block", background: t.card, borderRadius: "20px", overflow: "hidden", textDecoration: "none", border: `1px solid ${t.cardBorder}`, boxShadow: `0 8px 40px ${accent}15` }}>
                      {coverImg ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={coverImg} alt={p.title} style={{ width: "100%", height: "200px", objectFit: "cover", display: "block" }} />
                      ) : (
                        <div style={{
                          height: "200px",
                          background: `linear-gradient(135deg, ${accent}28, ${accent}60)`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "64px",
                          border: `1px solid ${accent}20`,
                        }}>{emoji}</div>
                      )}
                      <div style={{ padding: "24px 26px" }}>
                        <span style={{
                          display: "inline-block", fontSize: "10px", fontWeight: "700",
                          color: accent, background: `${accent}18`,
                          padding: "4px 12px", borderRadius: "100px",
                          marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.08em",
                        }}>Featured</span>
                        <h3 style={{ margin: "0 0 8px", fontSize: "22px", fontWeight: "800", color: t.text, letterSpacing: "-0.5px", lineHeight: 1.2 }}>{p.title}</h3>
                        {ma?.productDescription && <p style={{ margin: "0 0 20px", fontSize: "14px", color: t.subText, lineHeight: "1.65" }}>{ma.productDescription.slice(0, 140)}{ma.productDescription.length > 140 ? "…" : ""}</p>}
                        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                          {price && <span style={{ fontSize: "28px", fontWeight: "800", color: accent, letterSpacing: "-0.8px" }}>{price}</span>}
                          <div style={{
                            padding: "12px 24px", borderRadius: "100px",
                            background: accent, color: "#fff",
                            fontSize: "14px", fontWeight: "700",
                            boxShadow: `0 4px 16px ${accent}45`,
                            letterSpacing: "-0.2px",
                          }}>Get it now →</div>
                        </div>
                      </div>
                    </a>
                  );
                })()}
                {/* Rest in 2-col */}
                {publishedProducts.length > 1 && (
                  <div className="cf-grid-2" style={{ gap: "10px" }}>
                    {publishedProducts.slice(1).map((p) => {
                      const ma = p.marketingAssets as MarketingAssets | null;
                      const isNative = !!ma?.isNativePublished;
                      const href = isNative ? `/product/${p.id}` : (ma?.checkoutUrl || `/product/${p.id}`);
                      const coverImg = ma?.coverThumbnailUrl ?? ma?.bookMockupUrl ?? ma?.thumbnailUrl ?? null;
                      const price = ma?.nativePrice ? fmtPrice(ma.nativePrice) : ma?.priceLabel ?? null;
                      const emoji = productEmoji(ma);
                      return (
                        <a key={p.id} href={href} {...(!isNative && ma?.checkoutUrl ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                          style={{ display: "flex", flexDirection: "column", background: t.card, borderRadius: "16px", overflow: "hidden", textDecoration: "none", border: `1px solid ${t.cardBorder}` }}>
                          {coverImg ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={coverImg} alt={p.title} style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", display: "block" }} />
                          ) : (
                            <div style={{ width: "100%", aspectRatio: "4/3", background: `linear-gradient(135deg, ${accent}18, ${accent}42)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "32px" }}>{emoji}</div>
                          )}
                          <div style={{ padding: "14px 16px 16px" }}>
                            <p style={{ margin: "0 0 8px", fontSize: "13px", fontWeight: "700", color: t.text, lineHeight: "1.3", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.title}</p>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              {price && <span style={{ fontSize: "17px", fontWeight: "800", color: accent }}>{price}</span>}
                              <div style={{ fontSize: "12px", fontWeight: "700", color: "#fff", background: accent, padding: "5px 14px", borderRadius: "100px", boxShadow: `0 2px 6px ${accent}35` }}>Buy</div>
                            </div>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>

            ) : (
              /* Default: grid */
              <div className="cf-grid-2" style={{ gap: "12px" }}>
                {publishedProducts.map((p) => {
                  const ma = p.marketingAssets as MarketingAssets | null;
                  const isNative = !!ma?.isNativePublished;
                  const href = isNative ? `/product/${p.id}` : (ma?.checkoutUrl || `/product/${p.id}`);
                  const coverImg = ma?.coverThumbnailUrl ?? ma?.bookMockupUrl ?? ma?.thumbnailUrl ?? null;
                  const price = ma?.nativePrice ? fmtPrice(ma.nativePrice) : ma?.priceLabel ?? null;
                  const emoji = productEmoji(ma);
                  return (
                    <a key={p.id} href={href} {...(!isNative && ma?.checkoutUrl ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                      style={{ display: "flex", flexDirection: "column", background: t.card, borderRadius: "18px", overflow: "hidden", textDecoration: "none", border: `1px solid ${t.cardBorder}` }}>
                      {coverImg ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={coverImg} alt={p.title} style={{ width: "100%", aspectRatio: "1/1", objectFit: "cover", display: "block" }} />
                      ) : (
                        <div style={{
                          width: "100%", aspectRatio: "1/1",
                          background: `linear-gradient(135deg, ${accent}18, ${accent}44)`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "40px",
                        }}>{emoji}</div>
                      )}
                      <div style={{ padding: "12px 14px 14px", flex: 1, display: "flex", flexDirection: "column" }}>
                        <p style={{ margin: "0 0 8px", fontSize: "14px", fontWeight: "700", color: t.text, lineHeight: "1.35", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", letterSpacing: "-0.2px" }}>{p.title}</p>
                        <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                          {price
                            ? <span style={{ fontSize: "18px", fontWeight: "800", color: accent, letterSpacing: "-0.5px" }}>{price}</span>
                            : <span style={{ fontSize: "12px", color: t.subText, fontWeight: 600 }}>View →</span>
                          }
                          <div style={{
                            fontSize: "12px", fontWeight: "700", color: "#fff",
                            background: accent, padding: "6px 14px", borderRadius: "100px",
                            boxShadow: `0 2px 8px ${accent}40`, flexShrink: 0,
                          }}>{price ? "Buy" : "Get it"}</div>
                        </div>
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
          <section style={{ marginBottom: "24px" }}>
            <p style={{ margin: "0 0 16px", fontSize: "11px", fontWeight: "700", color: t.mutedText, textTransform: "uppercase", letterSpacing: "0.12em" }}>
              Bundles
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {activeBundles.map((b) => (
                <a key={b.id} href={`/bundle/${b.id}`}
                  style={{ display: "flex", alignItems: "center", gap: "16px", background: t.card, borderRadius: "16px", textDecoration: "none", border: `1px solid ${t.cardBorder}`, padding: "16px 20px" }}>
                  <div style={{
                    width: "54px", height: "54px", borderRadius: "14px",
                    background: `linear-gradient(135deg, ${accent}22, ${accent}50)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, fontSize: "24px",
                    border: `1px solid ${accent}25`,
                  }}>📦</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
                      <p style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.2px" }}>{b.title}</p>
                      <span style={{ fontSize: "10px", fontWeight: "700", color: accent, background: `${accent}18`, padding: "2px 9px", borderRadius: "100px", flexShrink: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>Bundle</span>
                    </div>
                    <p style={{ margin: 0, fontSize: "13px", color: t.subText }}>{b.productIds.length} products{b.description ? ` · ${b.description.slice(0, 60)}` : ""}</p>
                  </div>
                  <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ fontSize: "20px", fontWeight: "800", color: accent, letterSpacing: "-0.5px" }}>\xa3{(b.bundlePrice / 100).toFixed(0)}</span>
                    <div style={{
                      padding: "8px 18px", borderRadius: "100px",
                      background: accent, color: "#fff",
                      fontSize: "13px", fontWeight: "700",
                      boxShadow: `0 2px 8px ${accent}40`,
                    }}>Get</div>
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* ── Empty state ── */}
        {publishedProducts.length === 0 && activeBundles.length === 0 && (
          <div style={{ textAlign: "center", padding: "80px 20px" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>🛍️</div>
            <p style={{ fontSize: "17px", fontWeight: "700", color: t.text, margin: "0 0 8px", letterSpacing: "-0.3px" }}>No products yet</p>
            <p style={{ fontSize: "14px", color: t.subText, margin: 0 }}>Check back soon — new things are coming!</p>
          </div>
        )}

        {/* ── Trust badges ── */}
        {publishedProducts.length > 0 && showTrustBadges && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: "24px", flexWrap: "wrap",
            padding: "20px 24px",
            background: t.isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
            borderRadius: "16px", marginBottom: "24px",
            border: `1px solid ${t.cardBorder}`,
          }}>
            {[
              { icon: "🔒", label: "Secure checkout" },
              { icon: "⚡", label: "Instant download" },
              { icon: "📧", label: "Email delivery" },
              { icon: "💳", label: "Stripe payments" },
            ].map((item) => (
              <div key={item.label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "14px" }}>{item.icon}</span>
                <span style={{ fontSize: "12px", color: t.subText, fontWeight: "500" }}>{item.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Subscribe section ── */}
        <div style={{
          background: t.isDark ? `${accent}12` : `${accent}09`,
          border: `1px solid ${accent}28`,
          borderRadius: "20px",
          padding: "28px 28px",
          marginBottom: "24px",
          textAlign: "center",
        }}>
          <p style={{ margin: "0 0 6px", fontSize: "18px", fontWeight: "800", color: t.text, letterSpacing: "-0.4px" }}>Stay in the loop</p>
          <p style={{ margin: "0 0 20px", fontSize: "14px", color: t.subText, lineHeight: "1.6" }}>
            Get notified when {brandName} drops new products and offers.
          </p>
          <Link href={`/subscribe/${userId}`} style={{
            display: "inline-flex", alignItems: "center", gap: "8px",
            padding: "13px 28px", borderRadius: "100px",
            background: accent, color: "#fff",
            fontSize: "15px", fontWeight: "700", textDecoration: "none",
            boxShadow: `0 4px 20px ${accent}55`,
            letterSpacing: "-0.2px",
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            Subscribe for free
          </Link>
        </div>

        {/* ── Browse marketplace ── */}
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <a href="/marketplace" style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            fontSize: "13px", fontWeight: "600", color: t.subText,
            textDecoration: "none", padding: "8px 18px", borderRadius: "100px",
            border: `1px solid ${t.cardBorder}`,
            transition: "opacity 0.15s",
          }}>
            🛍️ Browse more creators on Content Flywheel →
          </a>
        </div>

        {/* ── Footer ── */}
        <p style={{ textAlign: "center", fontSize: "12px", color: t.mutedText, letterSpacing: "0.01em" }}>
          Powered by <span style={{ color: accent, fontWeight: "700" }}>Content Flywheel</span>
        </p>
      </div>
    </main>
  );
}
