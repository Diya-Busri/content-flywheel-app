import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { brandProfilesTable } from "@/db/schema/brand-profiles-schema";
import { eq } from "drizzle-orm";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const BUCKET = "product-images";
const LOGO_PREFIX = "brand-logos";

function normalizeHex(color: string): string {
  const s = String(color ?? "").trim();
  if (!s) return "#1a1a1a";
  if (/^#[0-9A-Fa-f]{6}$/.test(s)) return s.toLowerCase();
  if (/^#[0-9A-Fa-f]{3}$/.test(s)) {
    const r = s[1] + s[1], g = s[2] + s[2], b = s[3] + s[3];
    return `#${r}${g}${b}`.toLowerCase();
  }
  return s.startsWith("#") ? s : `#${s}`;
}

/**
 * GET: Return the current user's brand profile or 404.
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [row] = await db
      .select()
      .from(brandProfilesTable)
      .where(eq(brandProfilesTable.userId, userId));

    if (!row) {
      return NextResponse.json(null, { status: 404 });
    }

    return NextResponse.json({
      brandName: row.brandName ?? undefined,
      nicheIndustry: row.nicheIndustry ?? undefined,
      brandVoice: row.brandVoice ?? undefined,
      tiktokUrl: row.tiktokUrl ?? undefined,
      instagramUrl: row.instagramUrl ?? undefined,
      youtubeUrl: row.youtubeUrl ?? undefined,
      facebookUrl: row.facebookUrl ?? undefined,
      websiteUrl: row.websiteUrl ?? undefined,
      primaryColor: row.primaryColor ?? "#1a1a1a",
      secondaryColor: row.secondaryColor ?? "#475569",
      logoUrl: row.logoUrl ?? undefined,
      preferAiColors: row.preferAiColors ?? false,
      coverBackgroundPreference: row.coverBackgroundPreference ?? "match_product",
    });
  } catch (e) {
    console.error("[brand-profile] GET error:", e);
    return NextResponse.json({ error: "Failed to load brand profile" }, { status: 500 });
  }
}

/**
 * POST: Create or upsert brand profile. Body can include logoBase64 (data URL or raw base64).
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    let logoUrl: string | null = (body.logoUrl as string) ?? null;
    const logoBase64 = body.logoBase64 as string | undefined;

    if (logoBase64 && typeof logoBase64 === "string") {
      let base64 = logoBase64.trim();
      if (base64.startsWith("data:image")) {
        base64 = base64.replace(/^data:image\/\w+;base64,/, "");
      }
      if (base64) {
        const buffer = Buffer.from(base64, "base64");
        const path = `${LOGO_PREFIX}/${userId}/logo.png`;
        const supabase = getSupabaseAdmin();
        if (supabase) {
          let uploadResult = await supabase.storage
            .from(BUCKET)
            .upload(path, buffer, { contentType: "image/png", upsert: true });
          if (uploadResult.error) {
            const errMsg = String(uploadResult.error.message || uploadResult.error).toLowerCase();
            if (errMsg.includes("bucket") || errMsg.includes("not found")) {
              await supabase.storage.createBucket(BUCKET, { public: true });
              uploadResult = await supabase.storage
                .from(BUCKET)
                .upload(path, buffer, { contentType: "image/png", upsert: true });
            }
          }
          if (!uploadResult.error) {
            const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
            logoUrl = urlData.publicUrl;
          }
        }
      }
    }

    const primaryColor = normalizeHex(body.primaryColor as string);
    const secondaryColor = normalizeHex(body.secondaryColor as string);

    const brandName = (body.brandName as string)?.trim() || null;
    const nicheIndustry = (body.nicheIndustry as string)?.trim() || null;
    const brandVoice = (body.brandVoice as string)?.trim() || null;

    await db
      .insert(brandProfilesTable)
      .values({
        userId,
        brandName,
        nicheIndustry,
        brandVoice,
        tiktokUrl: (body.tiktokUrl as string)?.trim() || null,
        instagramUrl: (body.instagramUrl as string)?.trim() || null,
        youtubeUrl: (body.youtubeUrl as string)?.trim() || null,
        facebookUrl: (body.facebookUrl as string)?.trim() || null,
        websiteUrl: (body.websiteUrl as string)?.trim() || null,
        primaryColor,
        secondaryColor,
        logoUrl,
        preferAiColors: Boolean(body.preferAiColors),
        coverBackgroundPreference: body.coverBackgroundPreference === "random" ? "random" : "match_product",
      })
      .onConflictDoUpdate({
        target: brandProfilesTable.userId,
        set: {
          brandName,
          nicheIndustry,
          brandVoice,
          tiktokUrl: (body.tiktokUrl as string)?.trim() || null,
          instagramUrl: (body.instagramUrl as string)?.trim() || null,
          youtubeUrl: (body.youtubeUrl as string)?.trim() || null,
          facebookUrl: (body.facebookUrl as string)?.trim() || null,
          websiteUrl: (body.websiteUrl as string)?.trim() || null,
          primaryColor,
          secondaryColor,
          logoUrl: logoUrl ?? undefined,
          preferAiColors: body.preferAiColors !== undefined ? Boolean(body.preferAiColors) : undefined,
          coverBackgroundPreference: body.coverBackgroundPreference === "random" ? "random" : "match_product",
          updatedAt: new Date(),
        },
      });

    const [row] = await db
      .select()
      .from(brandProfilesTable)
      .where(eq(brandProfilesTable.userId, userId));

    return NextResponse.json({
      brandName: row?.brandName ?? undefined,
      nicheIndustry: row?.nicheIndustry ?? undefined,
      brandVoice: row?.brandVoice ?? undefined,
      tiktokUrl: row?.tiktokUrl ?? undefined,
      instagramUrl: row?.instagramUrl ?? undefined,
      youtubeUrl: row?.youtubeUrl ?? undefined,
      facebookUrl: row?.facebookUrl ?? undefined,
      websiteUrl: row?.websiteUrl ?? undefined,
      primaryColor: row?.primaryColor ?? primaryColor,
      secondaryColor: row?.secondaryColor ?? secondaryColor,
      logoUrl: row?.logoUrl ?? logoUrl ?? undefined,
      preferAiColors: row?.preferAiColors ?? false,
      coverBackgroundPreference: row?.coverBackgroundPreference ?? "match_product",
    });
  } catch (e) {
    console.error("[brand-profile] POST error:", e);
    return NextResponse.json({ error: "Failed to save brand profile" }, { status: 500 });
  }
}

/**
 * PATCH: Update preferAiColors (and optionally other fields).
 */
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.brandName !== undefined) updates.brandName = (body.brandName as string)?.trim() || null;
    if (body.nicheIndustry !== undefined) updates.nicheIndustry = (body.nicheIndustry as string)?.trim() || null;
    if (body.brandVoice !== undefined) updates.brandVoice = (body.brandVoice as string)?.trim() || null;
    if (body.preferAiColors !== undefined) updates.preferAiColors = Boolean(body.preferAiColors);
    if (body.primaryColor !== undefined) updates.primaryColor = normalizeHex(body.primaryColor as string);
    if (body.secondaryColor !== undefined) updates.secondaryColor = normalizeHex(body.secondaryColor as string);
    if (body.tiktokUrl !== undefined) updates.tiktokUrl = (body.tiktokUrl as string)?.trim() || null;
    if (body.instagramUrl !== undefined) updates.instagramUrl = (body.instagramUrl as string)?.trim() || null;
    if (body.youtubeUrl !== undefined) updates.youtubeUrl = (body.youtubeUrl as string)?.trim() || null;
    if (body.facebookUrl !== undefined) updates.facebookUrl = (body.facebookUrl as string)?.trim() || null;
    if (body.websiteUrl !== undefined) updates.websiteUrl = (body.websiteUrl as string)?.trim() || null;
    if (body.coverBackgroundPreference !== undefined)
      updates.coverBackgroundPreference = body.coverBackgroundPreference === "random" ? "random" : "match_product";

    await db
      .update(brandProfilesTable)
      .set(updates as Record<string, unknown>)
      .where(eq(brandProfilesTable.userId, userId));

    const [row] = await db
      .select()
      .from(brandProfilesTable)
      .where(eq(brandProfilesTable.userId, userId));

    if (!row) {
      return NextResponse.json(null, { status: 404 });
    }

    return NextResponse.json({
      brandName: row.brandName ?? undefined,
      nicheIndustry: row.nicheIndustry ?? undefined,
      brandVoice: row.brandVoice ?? undefined,
      tiktokUrl: row.tiktokUrl ?? undefined,
      instagramUrl: row.instagramUrl ?? undefined,
      youtubeUrl: row.youtubeUrl ?? undefined,
      facebookUrl: row.facebookUrl ?? undefined,
      websiteUrl: row.websiteUrl ?? undefined,
      primaryColor: row.primaryColor ?? "#1a1a1a",
      secondaryColor: row.secondaryColor ?? "#475569",
      logoUrl: row.logoUrl ?? undefined,
      preferAiColors: row.preferAiColors ?? false,
      coverBackgroundPreference: row.coverBackgroundPreference ?? "match_product",
    });
  } catch (e) {
    console.error("[brand-profile] PATCH error:", e);
    return NextResponse.json({ error: "Failed to update brand profile" }, { status: 500 });
  }
}
