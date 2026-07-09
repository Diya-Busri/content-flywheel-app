import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { validateBody, safeString, LIMITS } from "@/lib/api-validate";
import { brandWorkspacesTable } from "@/db/schema/brand-workspaces-schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

const CreateWorkspaceBodySchema = z.object({
  brandName: safeString(LIMITS.stringShort),
  brandType: z.string().max(50).optional(),
  aestheticVibe: safeString(LIMITS.stringShort).optional().nullable(),
  niche: safeString(LIMITS.stringShort).optional().nullable(),
  targetAudience: safeString(LIMITS.stringShort).optional().nullable(),
  platform: safeString(100).optional().nullable(),
  colourPrimary: safeString(50).optional().nullable(),
  colourSecondary: safeString(50).optional().nullable(),
});

/**
 * GET: List brand workspaces for the current user.
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const rl = await checkApiRateLimit(userId);
    if (rl) return rl;

    const rows = await db
      .select()
      .from(brandWorkspacesTable)
      .where(eq(brandWorkspacesTable.userId, userId))
      .orderBy(desc(brandWorkspacesTable.createdAt));

    return NextResponse.json(
      rows.map((r) => ({
        id: r.id,
        brandName: r.brandName,
        brandType: r.brandType,
        aestheticVibe: r.aestheticVibe ?? undefined,
        niche: r.niche ?? undefined,
        targetAudience: r.targetAudience ?? undefined,
        platform: r.platform ?? undefined,
        colourPrimary: r.colourPrimary ?? undefined,
        colourSecondary: r.colourSecondary ?? undefined,
        createdAt: r.createdAt?.toISOString(),
      }))
    );
  } catch (e) {
    console.error("[campaign-mode/workspaces GET]", e);
    return NextResponse.json({ error: "Failed to load workspaces." }, { status: 500 });
  }
}

const BRAND_TYPES = ["clothing", "digital", "both"] as const;

function normalizeBrandType(v: unknown): (typeof BRAND_TYPES)[number] {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (s === "digital products" || s === "digital") return "digital";
  if (s === "clothing" || s === "both") return s as (typeof BRAND_TYPES)[number];
  return "clothing";
}

/**
 * POST: Create a brand workspace.
 * Body: brandName, brandType, aestheticVibe, niche, targetAudience, platform, colourPrimary, colourSecondary
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const rl = await checkApiRateLimit(userId);
    if (rl) return rl;

    const [body, bodyErr] = await validateBody(request, CreateWorkspaceBodySchema);
    if (bodyErr) return bodyErr;
    const brandName = (body.brandName ?? "").trim();
    if (!brandName) {
      return NextResponse.json({ error: "brandName is required" }, { status: 400 });
    }
    const brandType = normalizeBrandType(body.brandType);
    const aestheticVibe = body.aestheticVibe?.trim() || null;
    const niche = body.niche?.trim() || null;
    const targetAudience = body.targetAudience?.trim() || null;
    const platform = body.platform?.trim() || null;
    const colourPrimary = body.colourPrimary?.trim() || null;
    const colourSecondary = body.colourSecondary?.trim() || null;

    const [row] = await db
      .insert(brandWorkspacesTable)
      .values({
        userId,
        brandName,
        brandType,
        aestheticVibe,
        niche,
        targetAudience,
        platform,
        colourPrimary,
        colourSecondary,
      })
      .returning();

    return NextResponse.json({
      id: row.id,
      brandName: row.brandName,
      brandType: row.brandType,
      createdAt: row.createdAt?.toISOString(),
    });
  } catch (e) {
    console.error("[campaign-mode/workspaces POST]", e);
    const message = e instanceof Error ? e.message : "Failed to create workspace.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
