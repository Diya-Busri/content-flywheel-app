import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { templatePacksTable } from "@/db/schema/template-packs-schema";
import { eq, desc } from "drizzle-orm";

function isMissingTemplatePacksTable(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: unknown }).code;
  return code === "42P01";
}

/**
 * GET: List all template packs for the current user.
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await db
      .select({
        id: templatePacksTable.id,
        packName: templatePacksTable.packName,
        templateType: templatePacksTable.templateType,
        niche: templatePacksTable.niche,
        status: templatePacksTable.status,
        createdAt: templatePacksTable.createdAt,
        slidesJson: templatePacksTable.slidesJson,
      })
      .from(templatePacksTable)
      .where(eq(templatePacksTable.userId, userId))
      .orderBy(desc(templatePacksTable.createdAt));

    return NextResponse.json(
      rows.map((r) => ({
        id: r.id,
        packName: r.packName,
        templateType: r.templateType,
        niche: r.niche ?? undefined,
        status: r.status,
        slideCount: Array.isArray(r.slidesJson) ? r.slidesJson.length : 0,
        createdAt: r.createdAt?.toISOString(),
      }))
    );
  } catch (e) {
    if (isMissingTemplatePacksTable(e)) {
      // Graceful fallback for environments where this optional table/migration
      // has not been applied yet.
      return NextResponse.json([]);
    }
    console.error("[template-packs] GET error:", e);
    return NextResponse.json(
      { error: "Failed to load template packs" },
      { status: 500 }
    );
  }
}

/**
 * POST: Create a template pack. Body: packName, templateType, niche,
 * brandColourPrimary, brandColourSecondary, fontStyle, slidesJson, captionsJson, status.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const packName = (body.packName as string)?.trim();
    if (!packName) {
      return NextResponse.json(
        { error: "packName is required" },
        { status: 400 }
      );
    }

    const templateType = (body.templateType as string)?.trim() || "quotes";
    const niche = (body.niche as string)?.trim() || null;
    const brandColourPrimary = (body.brandColourPrimary as string)?.trim() || null;
    const brandColourSecondary = (body.brandColourSecondary as string)?.trim() || null;
    const fontStyle = (body.fontStyle as string)?.trim() || null;
    const slidesJson = Array.isArray(body.slidesJson) ? body.slidesJson : [];
    const captionsJson = Array.isArray(body.captionsJson) ? body.captionsJson : [];
    const status = body.status === "complete" ? "complete" : "draft";

    const [row] = await db
      .insert(templatePacksTable)
      .values({
        userId,
        packName,
        templateType,
        niche,
        brandColourPrimary,
        brandColourSecondary,
        fontStyle,
        slidesJson,
        captionsJson,
        status,
      })
      .returning();

    return NextResponse.json({
      id: row.id,
      packName: row.packName,
      templateType: row.templateType,
      slideCount: Array.isArray(row.slidesJson) ? row.slidesJson.length : 0,
      createdAt: row.createdAt?.toISOString(),
    });
  } catch (e) {
    if (isMissingTemplatePacksTable(e)) {
      return NextResponse.json(
        { error: "Template Packs table is not set up yet. Run DB migrations first." },
        { status: 503 }
      );
    }
    console.error("[template-packs] POST error:", e);
    return NextResponse.json(
      { error: "Failed to save template pack" },
      { status: 500 }
    );
  }
}
