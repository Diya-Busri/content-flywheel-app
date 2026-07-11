export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";

const VALID_FORMATS = [
  "ebook", "guide", "workbook", "spreadsheet", "notion",
  "course", "checklist", "journal", "planner", "template",
] as const;

function normalizeFormat(value: string): string {
  const lower = value.toLowerCase().trim();
  if (lower === "course outline" || lower === "course_outline") return "course";
  if (lower === "checklist pack") return "checklist";
  if (lower === "notion template" || lower === "notion_template") return "notion";
  return VALID_FORMATS.includes(lower as (typeof VALID_FORMATS)[number]) ? lower : "ebook";
}

/** Human-readable label for a format id. */
function formatLabel(id: string): string {
  const map: Record<string, string> = {
    ebook: "Ebook / Guide",
    guide: "Guide",
    workbook: "Workbook",
    spreadsheet: "Spreadsheet Template",
    notion: "Notion Template",
    course: "Course Outline",
    checklist: "Checklist Pack",
    journal: "Journal",
    planner: "Planner",
    template: "Template",
  };
  return map[id] ?? id.charAt(0).toUpperCase() + id.slice(1);
}

/**
 * POST /api/products/ecosystem
 *
 * Creates a core product + one or more add-on products all sharing the same bundleId.
 * Fires async generation for each, then returns immediately so the client can poll.
 *
 * Body:
 *   niche               — string | { name: string }
 *   productName         — string   (the product title from Step 3)
 *   productDescription  — string   (combined description)
 *   productIncluded     — string   (what's included)
 *   productWhy          — string   (why it sells)
 *   coreFormat          — string   (e.g. "spreadsheet")
 *   addonFormats        — string[] (e.g. ["checklist","ebook"])
 *   customizationOptions — object  (full CustomizationOptions from the discover flow)
 *   creatorExpertise    — string?
 *   hooks               — Array<{ text: string; whyItWorks: string }>
 *   ctas                — Array<{ text: string; whyItWorks: string }>
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiRl = await checkApiRateLimit(userId);
    if (apiRl) return apiRl;

    const body = await request.json().catch(() => ({}));

    const nicheRaw = body.niche ?? "";
    const nicheName: string =
      typeof nicheRaw === "string" ? nicheRaw : (nicheRaw as { name?: string }).name ?? "";

    const productName: string = (body.productName ?? "").trim();
    if (!productName) {
      return NextResponse.json({ error: "productName is required" }, { status: 400 });
    }

    const coreFormatRaw: string = body.coreFormat ?? "ebook";
    const coreFormat = normalizeFormat(coreFormatRaw);

    const addonFormatsRaw: string[] = Array.isArray(body.addonFormats) ? body.addonFormats : [];
    const addonFormats = addonFormatsRaw
      .map(normalizeFormat)
      .filter((f) => f !== coreFormat); // never duplicate the core

    const customizationOptions: Record<string, unknown> | undefined =
      body.customizationOptions != null && typeof body.customizationOptions === "object"
        ? (body.customizationOptions as Record<string, unknown>)
        : undefined;

    const creatorExpertise: string = (body.creatorExpertise ?? "").trim();
    const hooks: unknown[] = Array.isArray(body.hooks) ? body.hooks : [];
    const ctas: unknown[] = Array.isArray(body.ctas) ? body.ctas : [];
    const productDescription: string = (body.productDescription ?? "").trim();
    const productIncluded: string = (body.productIncluded ?? "").trim();
    const productWhy: string = (body.productWhy ?? "").trim();

    const designSettings = {
      template: "modern",
      colors: { primary: "#FF6B35", secondary: "#004E89", accent: "#F7B32B" },
      typography: { heading: "Inter", body: "Open Sans", size: 16 },
    };

    // All products in the ecosystem share the same bundleId
    const bundleId = crypto.randomUUID();

    // Build the ordered list: core first, then add-ons
    const allFormats = [
      { format: coreFormat, isCore: true },
      ...addonFormats.map((f) => ({ format: f, isCore: false })),
    ];

    // Insert all products in DB in parallel
    const insertResults = await Promise.all(
      allFormats.map(async ({ format, isCore }) => {
        const label = isCore ? productName : `${productName} — ${formatLabel(format)}`;
        const [inserted] = await db
          .insert(productsTable)
          .values({
            userId,
            title: label,
            niche: nicheName,
            format,
            content: { sections: [] },
            designSettings,
            placedElements: [],
            customizationOptions: customizationOptions ?? null,
            status: "generating",
            bundleId,
          })
          .returning({ id: productsTable.id });
        return inserted?.id
          ? { productId: inserted.id, format, label, isCore }
          : null;
      })
    );

    const items = insertResults.filter(
      (r): r is { productId: string; format: string; label: string; isCore: boolean } => r !== null
    );

    if (items.length === 0) {
      return NextResponse.json({ error: "Failed to insert products" }, { status: 500 });
    }

    // Derive base URL for internal process calls
    const base =
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      (typeof request.url === "string" ? new URL(request.url).origin : null) ||
      "http://localhost:3000";

    // Fire-and-forget: stagger by 500ms to avoid rate-limit spikes
    items.forEach(({ productId, format, label }, i) => {
      setTimeout(() => {
        fetch(`${base}/api/products/${productId}/process`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            niche: nicheName,
            product: {
              name: label,
              included: productIncluded,
              why: productWhy,
              type: format,
            },
            productName: label,
            productDescription,
            format,
            bundleId,
            customizationOptions: customizationOptions ?? undefined,
            creatorExpertise: creatorExpertise || undefined,
            hooks,
            ctas,
          }),
        }).catch((e) => {
          console.error("[products/ecosystem] Failed to trigger process for", productId, e);
        });
      }, i * 500);
    });

    return NextResponse.json({
      bundleId,
      items,
      success: true,
    });
  } catch (err) {
    console.error("[products/ecosystem] Failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create ecosystem" },
      { status: 500 }
    );
  }
}
