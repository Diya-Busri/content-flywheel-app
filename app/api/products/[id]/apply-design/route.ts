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
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { brandProfilesTable } from "@/db/schema/brand-profiles-schema";
import { eq, and, isNull } from "drizzle-orm";
import { getAutoDesignSuggestion } from "@/lib/auto-design-suggestion";

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 1100;
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

/** Format-specific safe Pexels keywords (no architecture, buildings, or stripes). */
const FORMAT_PEXELS_SAFE: Record<string, string> = {
  ebook: "morning light bokeh",
  workbook: "soft gradient pastel",
  planner: "clean desk minimal",
  journal: "open notebook flat lay",
  checklist: "soft pastel paper",
  course: "soft abstract blur",
  notion: "minimal workspace soft",
  spreadsheet: "soft blue gradient",
};

/** Sanitize Pexels keyword: only clean soft/minimal terms; never architecture, buildings, or patterns. */
function sanitizePexelsKeyword(keyword: string, format?: string): string {
  const k = keyword.trim().toLowerCase();
  const safeDefault =
    format && FORMAT_PEXELS_SAFE[format.toLowerCase()]
      ? FORMAT_PEXELS_SAFE[format.toLowerCase()]
      : "soft abstract minimal";
  if (!k) return safeDefault;
  const bad =
    /\b(stripe|striped|pattern|texture|geometric|busy|wood|fabric|noise|grid|lines|architecture|building|buildings|office|brick|concrete)\b/i.test(
      k
    );
  if (bad) return safeDefault;
  if (
    /\b(soft|minimal|blur|abstract|blurred|gradient|pastel|neutral|bokeh|notebook|desk|flat lay)\b/i.test(
      k
    )
  )
    return k;
  return `${k} soft minimal`;
}

async function fetchOnePexelsPhoto(
  keyword: string,
  format?: string
): Promise<string | null> {
  const apiKey =
    process.env.PEXELS_API_KEY || process.env.NEXT_PUBLIC_PEXELS_API_KEY;
  if (!apiKey) return null;
  const query = sanitizePexelsKeyword(keyword, format);
  const url = new URL("https://api.pexels.com/v1/search");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", "1");
  url.searchParams.set("page", "1");
  url.searchParams.set("orientation", "square");
  const res = await fetch(url.toString(), { headers: { Authorization: apiKey } });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    photos?: Array<{
      src?: { original?: string; large2x?: string; large?: string; medium?: string };
    }>;
  };
  const first = data.photos?.[0];
  return (
    first?.src?.original ??
    first?.src?.large2x ??
    first?.src?.large ??
    first?.src?.medium ??
    null
  );
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

    const productFormat = (product.format ?? "ebook").toLowerCase().trim();
    const design = await getAutoDesignSuggestion({
      title,
      niche,
      format: productFormat,
      ...(brandPrimary && brandSecondary ? { brandPrimary, brandSecondary } : {}),
    });

    const bgImageUrl = await fetchOnePexelsPhoto(
      design.pexelsKeyword,
      productFormat
    );
    const primary = design.primary.startsWith("#") ? design.primary : `#${design.primary}`;
    const secondary = design.secondary.startsWith("#") ? design.secondary : `#${design.secondary}`;
    const accent = design.accent.startsWith("#") ? design.accent : `#${design.accent}`;
    const headingFont = `${design.headingFont}, serif`;
    const bodyFont = `${design.bodyFont}, system-ui, sans-serif`;
    const overlayColor = design.overlayColor?.startsWith("#") ? design.overlayColor : `#${design.overlayColor ?? "000000"}`;
    const overlayOpacityRaw = typeof design.overlayOpacity === "number" ? Math.max(0, Math.min(1, design.overlayOpacity)) : 0.5;
    const overlayOpacity = Math.min(0.6, overlayOpacityRaw);
    const contentPageBg = design.contentPageBackgroundColor?.startsWith("#") ? design.contentPageBackgroundColor : `#${design.contentPageBackgroundColor ?? "ffffff"}`;

    const overlayIsDark = isColorDark(overlayColor);
    const coverTitleColor = overlayIsDark ? "#ffffff" : primary;
    const coverBodyColor = overlayIsDark ? "#f1f5f9" : secondary;
    const coverAccentColor = overlayIsDark ? "#fcd34d" : accent;

    const totalPages = Math.max(2, sections.length + 2);
    const overlayForCoverBack = { color: overlayColor, opacity: overlayOpacity };
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
    const designSettings = {
      ...existingDesign,
      colors: { ...existingColors, graphics: accent },
      textStyles: nextTextStyles,
      pages,
      placedElementsByPage,
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
    console.error("[products/apply-design] Error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to apply design",
      },
      { status: 500 }
    );
  }
}
