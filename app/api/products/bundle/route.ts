import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { bundleJobsTable } from "@/db/schema/bundle-jobs-schema";

/**
 * Sub-topic map per bundle: each of the 8 products gets a distinct angle of the niche
 * so no two products cover the same content. The assigned sub-topic is passed into each
 * product's generation prompt. Example (Mental Wellness): Ebook = mindset theory,
 * Workbook = emotional processing, Spreadsheet = mood/habit tracking, etc.
 */
const BUNDLE_FORMATS: { format: string; label: string; subFocus: string }[] = [
  { format: "ebook", label: "Ebook", subFocus: "mindset and resilience theory" },
  { format: "workbook", label: "Workbook", subFocus: "emotional processing" },
  { format: "spreadsheet", label: "Spreadsheet Tutorial", subFocus: "mood and habit tracking" },
  { format: "guide", label: "Guide", subFocus: "building a daily routine" },
  { format: "notion", label: "Notion Template", subFocus: "system organisation and templates" },
  { format: "checklist", label: "Checklist Pack", subFocus: "daily and weekly routines" },
  { format: "journal", label: "Journal", subFocus: "daily self-reflection practice" },
  { format: "planner", label: "Planner", subFocus: "goal setting and scheduling" },
];

const designSettings = {
  template: "modern",
  colors: { primary: "#FF6B35", secondary: "#004E89", accent: "#F7B32B" },
  typography: { heading: "Inter", body: "Open Sans", size: 16 },
};

function getInternalSecret(): string | null {
  return (
    process.env.INTERNAL_API_SECRET?.trim() ||
    (process.env.DATABASE_URL
      ? Buffer.from(process.env.DATABASE_URL).toString("base64").slice(0, 40)
      : null)
  );
}

/**
 * POST: Create 8 products (one per format) for the given niche/topic.
 * Fires background processing via internal secret — returns immediately so
 * the client can close the modal and track progress via the bundle job record.
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
    const niche = (body.niche ?? body.topic ?? "").trim();
    if (!niche) {
      return NextResponse.json({ error: "niche or topic is required" }, { status: 400 });
    }

    const base =
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      (typeof request.url === "string" ? new URL(request.url).origin : null) ||
      "http://localhost:3000";

    const bundleId = crypto.randomUUID();

    // Insert all 8 products in parallel
    const insertResults = await Promise.all(
      BUNDLE_FORMATS.map(async ({ format, label, subFocus }) => {
        const title = `${niche} - ${label}`;
        const [inserted] = await db
          .insert(productsTable)
          .values({
            userId,
            title,
            niche,
            format,
            content: { sections: [] },
            designSettings,
            placedElements: [],
            customizationOptions: null,
            status: "generating",
            bundleId,
          })
          .returning({ id: productsTable.id });
        return inserted?.id ? { productId: inserted.id, format, label, subFocus, title } : null;
      })
    );

    const items = insertResults.filter(Boolean) as { productId: string; format: string; label: string; subFocus: string; title: string }[];

    // Create a bundle job record so progress persists across page loads
    await db.insert(bundleJobsTable).values({
      id: bundleId,
      userId,
      niche,
      status: "generating",
      totalCount: items.length,
      completedCount: 0,
      failedCount: 0,
      emailSent: false,
    });

    // Derive internal secret for server-to-server process calls (no browser session needed)
    const internalSecret = getInternalSecret();

    // Stagger process calls by 500ms each to avoid hammering OpenAI rate limits simultaneously.
    // Passing userId + internalSecret so the process route can run without a Clerk session.
    items.forEach(({ productId, format, label, subFocus, title }, i) => {
      setTimeout(() => {
        fetch(`${base}/api/products/${productId}/process`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(internalSecret ? { "x-internal-secret": internalSecret } : {}),
          },
          body: JSON.stringify({
            userId,
            bundleId,
            niche,
            product: { name: title, included: "", why: "" },
            productName: title,
            format,
            subFocus,
            bundleMode: true,
            hooks: [],
            ctas: [],
          }),
        }).catch((e) => {
          console.error("[products/bundle] Failed to trigger process for", productId, e);
        });
      }, i * 500);
    });

    return NextResponse.json({
      bundleId,
      productIds: items.map((i) => i.productId),
      items,
      success: true,
    });
  } catch (err) {
    console.error("[products/bundle] Failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create bundle" },
      { status: 500 }
    );
  }
}
