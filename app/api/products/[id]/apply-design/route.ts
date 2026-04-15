/**
 * POST /api/products/[id]/apply-design
 * Apply auto-design to a product (used after bundle generation).
 * Body: { useBrandColors?: boolean }. If true, uses current user's brand profile colours and socials.
 *
 * Applies: cover (Pexels bg + overlay, title bold/large/centred, subtitle smaller), back (same/complementary
 * bg + overlay, social icons from brand, CTA styled), content pages (consistent heading/body/background/accent),
 * all manually editable in the editor.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { brandProfilesTable } from "@/db/schema/brand-profiles-schema";
import { eq, and, isNull } from "drizzle-orm";
import { getAutoDesignSuggestion, getSafeCoverKeyword, getRandomCoverKeyword } from "@/lib/auto-design-suggestion";

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 1100;
const USED_IMAGES_CAP = 30;
const SOCIAL_PLATFORMS = ["tiktok", "instagram", "youtube", "facebook"] as const;
const SOCIAL_SIZE = 40;
const SOCIAL_GAP = 12;

const DEFAULT_IMAGE_SETTINGS = {
  fit: "cover" as const,
  position: { x: 0.5, y: 0.5 },
  scale: 1,
  opacity: 1,
};

type PlacedElement = {
  id: string;
  type: "text" | "social" | "icon" | "image";
  content: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  rotation: number;
  zIndex: number;
  textSettings?: {
    fontSize?: number;
    fontFamily?: string;
    color?: string;
    textAlign?: "left" | "center" | "right";
    fontWeight?: string;
  };
  linkUrl?: string;
};

/** Options for Pexels fetch when regenerating to get different results. */
type PexelsFetchOptions = {
  /** URLs already used for this product — exclude from results. */
  excludeUrls?: string[];
  /** Seed for page offset (e.g. Date.now() or random) so each call gets a different page. */
  pageSeed?: number;
  /** Override search query (e.g. from getRandomCoverKeyword when preference is "random"). */
  queryOverride?: string;
};

async function fetchOnePexelsPhoto(
  niche: string,
  format: string | undefined,
  options: PexelsFetchOptions = {}
): Promise<string | null> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return null;
  const { excludeUrls = [], pageSeed = Math.random(), queryOverride } = options;
  const query = queryOverride ?? getSafeCoverKeyword(niche, format);
  const excludeSet = new Set(excludeUrls.map((u) => u.trim()).filter(Boolean));
  const pick = (p: { src?: { original?: string; large2x?: string; large?: string; medium?: string } }) =>
    p?.src?.original ?? p?.src?.large2x ?? p?.src?.large ?? p?.src?.medium ?? null;

  for (let attempt = 0; attempt < 4; attempt++) {
    const page = 1 + (Math.floor((pageSeed + attempt * 0.33) * 1000) % 30);
    const url = new URL("https://api.pexels.com/v1/search");
    url.searchParams.set("query", query);
    url.searchParams.set("per_page", "15");
    url.searchParams.set("page", String(page));
    url.searchParams.set("orientation", "square");
    const res = await fetch(url.toString(), { headers: { Authorization: apiKey } });
    if (!res.ok) continue;
    const data = (await res.json()) as {
      photos?: Array<{ src?: { original?: string; large2x?: string; large?: string; medium?: string } }>;
    };
    const photos = data.photos ?? [];
    const candidates = photos.map(pick).filter((u): u is string => !!u && !excludeSet.has(u));
    if (candidates.length > 0) {
      return candidates[Math.floor(Math.random() * candidates.length)];
    }
  }
  return null;
}

/** Return true if hex color is dark (needs light text). */
function isColorDark(hex: string): boolean {
  const h = hex.replace(/^#/, "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance < 0.5;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id: productId } = await params;
    if (!productId) {
      return NextResponse.json(
        { error: "Product ID required" },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const useBrandColors = Boolean(body.useBrandColors);
    const regenerate = Boolean(body.regenerate);
    if (regenerate) {
      console.log("[apply-design] regenerate: true", { productId, useBrandColors, hasPageSeed: typeof body.pageSeed === "number" });
    }

    const [product] = await db
      .select()
      .from(productsTable)
      .where(
        and(
          eq(productsTable.id, productId),
          eq(productsTable.userId, userId),
          isNull(productsTable.deletedAt)
        )
      );
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const title = product.title ?? "";
    const niche = product.niche ?? "";
    const content = product.content as { sections?: Array<{ id: string; title: string }> } | null;
    const sections = content?.sections ?? [];
    const existingDesign = (product.designSettings ?? {}) as Record<string, unknown>;

    let brandPrimary: string | undefined;
    let brandSecondary: string | undefined;
    let backCoverSocialLinks: Record<string, string> | undefined;

    const [brandProfile] = await db
      .select()
      .from(brandProfilesTable)
      .where(eq(brandProfilesTable.userId, userId));

    if (useBrandColors && brandProfile) {
      brandPrimary = brandProfile.primaryColor ?? "#1a1a1a";
      brandSecondary = brandProfile.secondaryColor ?? "#475569";
      backCoverSocialLinks = {};
      if (brandProfile.tiktokUrl) backCoverSocialLinks.tiktok = brandProfile.tiktokUrl;
      if (brandProfile.instagramUrl) backCoverSocialLinks.instagram = brandProfile.instagramUrl;
      if (brandProfile.youtubeUrl) backCoverSocialLinks.youtube = brandProfile.youtubeUrl;
      if (brandProfile.facebookUrl) backCoverSocialLinks.facebook = brandProfile.facebookUrl;
    }

    const backCoverWebsiteText =
      brandProfile?.websiteUrl?.trim() || "Add your website in brand profile";

    const coverBackgroundPreference =
      body.coverBackgroundPreference === "random"
        ? "random"
        : (brandProfile?.coverBackgroundPreference === "random" ? "random" : "match_product");

    const productFormat = (product.format ?? "ebook").toLowerCase().trim();
    const usedCoverImageUrls = (existingDesign.usedCoverImageUrls as string[] | undefined) ?? [];
    const usedDesignFingerprints = (existingDesign.usedDesignFingerprints as string[] | undefined) ?? [];

    const design = await getAutoDesignSuggestion({
      title,
      niche,
      format: productFormat,
      ...(brandPrimary && brandSecondary ? { brandPrimary, brandSecondary } : {}),
      ...(regenerate ? { regenerate: true } : {}),
      ...(regenerate && usedDesignFingerprints.length > 0 ? { previousDesignFingerprints: usedDesignFingerprints } : {}),
    });

    const pageSeed = typeof body.pageSeed === "number" ? body.pageSeed : Date.now();
    const pexelsQuery =
      coverBackgroundPreference === "random" ? getRandomCoverKeyword() : undefined;
    const rawBgImageUrl = await fetchOnePexelsPhoto(niche, productFormat, {
      excludeUrls: usedCoverImageUrls,
      pageSeed,
      queryOverride: pexelsQuery,
    });
    // Store proxy URL so editor and PDF export avoid CORS with html2canvas
    const bgImageUrl =
      rawBgImageUrl != null
        ? `/api/proxy-image?url=${encodeURIComponent(rawBgImageUrl)}`
        : undefined;
    const primary = design.primary.startsWith("#") ? design.primary : `#${design.primary}`;
    const secondary = design.secondary.startsWith("#") ? design.secondary : `#${design.secondary}`;
    const accent = design.accent.startsWith("#") ? design.accent : `#${design.accent}`;
    const headingFont = `${design.headingFont}, serif`;
    const bodyFont = `${design.bodyFont}, system-ui, sans-serif`;
    const overlayColor = design.overlayColor?.startsWith("#") ? design.overlayColor : `#${design.overlayColor ?? "000000"}`;
    const overlayOpacityRaw = typeof design.overlayOpacity === "number" ? Math.max(0, Math.min(1, design.overlayOpacity)) : 0.5;
    const overlayOpacity = Math.min(0.6, overlayOpacityRaw);
    const contentPageBg = design.contentPageBackgroundColor?.startsWith("#") ? design.contentPageBackgroundColor : `#${design.contentPageBackgroundColor ?? "ffffff"}`;

    // When no Pexels image was found, guarantee a bold solid background.
    // Use primary if it's dark enough; otherwise fall back to deep indigo so text is always readable.
    const FALLBACK_DARK = "#1a237e"; // deep indigo — always readable with white text
    const noImageBg = isColorDark(primary) ? primary : FALLBACK_DARK;
    const effectiveOverlayColor = bgImageUrl ? overlayColor : noImageBg;
    const effectiveOverlayOpacity = bgImageUrl ? overlayOpacity : 1;

    // Cover/back text must contrast with whatever background ends up showing
    const bgIsDark = bgImageUrl
      ? (isColorDark(overlayColor) && overlayOpacity > 0.4)
      : true; // no-image path always uses a dark bg (noImageBg is guaranteed dark)
    const coverTitleColor = bgIsDark ? "#ffffff" : primary;
    const coverBodyColor = bgIsDark ? "#e2e8f0" : secondary;
    const coverAccentColor = bgIsDark ? "#fcd34d" : accent;

    const totalPages = Math.max(2, sections.length + 2);
    const overlayForCoverBack = { color: effectiveOverlayColor, opacity: effectiveOverlayOpacity };
    const coverBackBg = {
      backgroundImage: bgImageUrl ?? undefined,
      backgroundSettings: DEFAULT_IMAGE_SETTINGS,
      overlaySettings: overlayForCoverBack,
    };
    const contentPageBgOnly = {
      overlaySettings: { color: contentPageBg, opacity: 1 },
    };
    const pages: unknown[] = Array.from({ length: totalPages }, (_, i) => {
      if (i === 0 || i === totalPages - 1) return { ...coverBackBg };
      return { ...contentPageBgOnly };
    });

    const subtitle = niche ? `A comprehensive guide to ${niche}` : "";
    const coverElements: PlacedElement[] = [
      {
        id: "cover-title",
        type: "text",
        content: title,
        position: { x: CANVAS_WIDTH / 2 - 200, y: 380 },
        size: { width: 400, height: 80 },
        rotation: 0,
        zIndex: 1,
        textSettings: { fontSize: 32, fontFamily: headingFont, color: coverTitleColor, textAlign: "center", fontWeight: "700" },
      },
      {
        id: "cover-footer",
        type: "text",
        content: "Created with Content Flywheel",
        position: { x: CANVAS_WIDTH / 2 - 150, y: 1000 },
        size: { width: 300, height: 24 },
        rotation: 0,
        zIndex: 2,
        textSettings: { fontSize: 14, fontFamily: bodyFont, color: coverBodyColor, textAlign: "center", fontWeight: "400" },
      },
    ];
    if (subtitle) {
      coverElements.splice(1, 0, {
        id: "cover-subtitle",
        type: "text",
        content: subtitle,
        position: { x: CANVAS_WIDTH / 2 - 200, y: 480 },
        size: { width: 400, height: 40 },
        rotation: 0,
        zIndex: 1,
        textSettings: { fontSize: 18, fontFamily: bodyFont, color: coverBodyColor, textAlign: "center", fontWeight: "400" },
      });
    }

    const socialStartX = CANVAS_WIDTH / 2 - (SOCIAL_PLATFORMS.length * (SOCIAL_SIZE + SOCIAL_GAP)) / 2;
    const backElements: PlacedElement[] = [
      { id: "back-thanks", type: "text", content: "Thank you", position: { x: CANVAS_WIDTH / 2 - 200, y: 350 }, size: { width: 400, height: 36 }, rotation: 0, zIndex: 1, textSettings: { fontSize: 22, fontFamily: headingFont, color: coverTitleColor, textAlign: "center", fontWeight: "700" } },
      { id: "back-msg", type: "text", content: "Thank you for using this resource!", position: { x: CANVAS_WIDTH / 2 - 200, y: 420 }, size: { width: 400, height: 28 }, rotation: 0, zIndex: 1, textSettings: { fontSize: 16, fontFamily: bodyFont, color: coverBodyColor, textAlign: "center", fontWeight: "400" } },
      { id: "back-url", type: "text", content: backCoverWebsiteText, position: { x: CANVAS_WIDTH / 2 - 200, y: 500 }, size: { width: 400, height: 24 }, rotation: 0, zIndex: 1, textSettings: { fontSize: 14, fontFamily: bodyFont, color: coverAccentColor, textAlign: "center", fontWeight: "400" } },
      { id: "back-brand", type: "text", content: "Created with Content Flywheel", position: { x: CANVAS_WIDTH / 2 - 150, y: 620 }, size: { width: 300, height: 20 }, rotation: 0, zIndex: 1, textSettings: { fontSize: 12, fontFamily: bodyFont, color: coverBodyColor, textAlign: "center", fontWeight: "400" } },
    ];
    if (backCoverSocialLinks && Object.keys(backCoverSocialLinks).length > 0) {
      SOCIAL_PLATFORMS.forEach((platform, idx) => {
        const url = backCoverSocialLinks[platform];
        if (url) {
          backElements.push({
            id: `social-${platform}-auto`,
            type: "social",
            content: platform,
            position: { x: socialStartX + idx * (SOCIAL_SIZE + SOCIAL_GAP), y: CANVAS_HEIGHT - 120 },
            size: { width: SOCIAL_SIZE, height: SOCIAL_SIZE },
            rotation: 0,
            zIndex: 10,
            linkUrl: url,
          });
        }
      });
    }

    const placedElementsByPage: PlacedElement[][] = Array.from({ length: totalPages }, (_, i) => {
      if (i === 0) return coverElements;
      if (i === totalPages - 1) return backElements;
      return [];
    });

    const existingStyles = (existingDesign.textStyles ?? {}) as Record<
      string,
      { title?: Record<string, unknown>; body?: Record<string, unknown>; blocks?: unknown[] }
    >;
    const nextTextStyles: Record<
      string,
      { title?: Record<string, unknown>; body?: Record<string, unknown>; blocks?: unknown[] }
    > = {};
    nextTextStyles["__product_title"] = {
      ...existingStyles["__product_title"],
      title: {
        color: primary,
        fontFamily: headingFont,
        fontSize: "24px",
        fontWeight: "700",
        textAlign: "left",
      },
    };
    for (const sec of sections) {
      nextTextStyles[sec.id] = {
        title: { color: accent, fontFamily: headingFont },
        body: { color: secondary, fontFamily: bodyFont },
        blocks: existingStyles[sec.id]?.blocks,
      };
    }

    const existingColors = (existingDesign.colors ?? {}) as Record<string, string>;
    const nextUsedCoverImageUrls =
      rawBgImageUrl && typeof rawBgImageUrl === "string"
        ? [...usedCoverImageUrls.filter((u) => u !== rawBgImageUrl), rawBgImageUrl].slice(-USED_IMAGES_CAP)
        : usedCoverImageUrls;
    const designFingerprint = `${primary}|${secondary}|${headingFont}|${bodyFont}`;
    const nextUsedDesignFingerprints =
      regenerate && designFingerprint
        ? [...usedDesignFingerprints.filter((f) => f !== designFingerprint), designFingerprint].slice(-15)
        : usedDesignFingerprints;
    const designSettings = {
      ...existingDesign,
      colors: { ...existingColors, graphics: accent },
      textStyles: nextTextStyles,
      pages,
      placedElementsByPage,
      usedCoverImageUrls: nextUsedCoverImageUrls,
      usedDesignFingerprints: nextUsedDesignFingerprints,
      ...(Object.keys(backCoverSocialLinks ?? {}).length > 0
        ? { backCoverSocialLinks }
        : {}),
    };

    await db
      .update(productsTable)
      .set({
        designSettings,
        designSource: useBrandColors ? ("brand" as const) : ("ai" as const),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(productsTable.id, productId),
          eq(productsTable.userId, userId),
          isNull(productsTable.deletedAt)
        )
      );

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to apply design";
    console.error("[products/apply-design] Error:", message, err);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
