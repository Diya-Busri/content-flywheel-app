/**
 * POST /api/launch/store
 * ──────────────────────────────────────────────────────
 * Streaming NDJSON — Phase 1.6 Store Agent endpoint.
 *
 * Assembles everything the previous agents produced into a complete,
 * ready-to-publish store listing. Does NOT publish or charge the user —
 * that is a deliberate user action after reviewing.
 *
 * What it does:
 *   1. Load product from DB
 *   2. Patch marketingAssets with all content from marketing + design stages
 *   3. Run 13 store-readiness validation checks (auto-fix where possible)
 *   4. Compute readiness score
 *   5. Save updated product + return store URL
 *
 * Stream event types:
 *   step              — { id, label }
 *   step-done         — { id }
 *   validation-item   — { id, label, status, detail? }
 *   readiness-score   — { score, checks[] }
 *   done              — { productId, storeUrl, score, checks[] }
 *   error             — { message }
 */

export const dynamic     = "force-dynamic";
export const maxDuration = 120;

import { NextRequest } from "next/server";
import { auth }        from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db }              from "@/db/db";
import { productsTable }   from "@/db/schema/products-schema";
import type { MarketingAssets } from "@/db/schema/products-schema";
import { eq, and, isNull }     from "drizzle-orm";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://contentflywheel.co.uk";

/* ─── Input ──────────────────────────────────────────────────────────────────── */

interface StoreInput {
  productId:     string;
  productName:   string;
  stageResults:  Record<string, unknown>;   // full stageResults from pipeline
}

/* ─── Validation check ───────────────────────────────────────────────────────── */

interface Check {
  id:      string;
  label:   string;
  status:  "ok" | "fixed" | "warning" | "missing";
  detail?: string;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/* ─── Refund policy template ─────────────────────────────────────────────────── */
const REFUND_POLICY_TEMPLATE = `Due to the digital nature of this product, all sales are final. If you experience a technical issue with your download, please contact us within 7 days of purchase and we will do our best to resolve it promptly.`;

/* ─── Core streaming function ────────────────────────────────────────────────── */

function streamStoreAssembly(
  userId: string,
  input:  StoreInput,
): Response {
  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  const send = async (data: Record<string, unknown>): Promise<void> => {
    try {
      await writer.write(encoder.encode(JSON.stringify(data) + "\n"));
    } catch { /* writer closed */ }
  };

  void (async () => {
    const { productId, stageResults } = input;

    const design    = (stageResults.design    as Record<string, unknown> | undefined) ?? {};
    const marketing = (stageResults.marketing as Record<string, unknown> | undefined) ?? {};
    const salesCopy = (marketing.salesCopy    as Record<string, unknown> | undefined) ?? {};

    try {
      /* ── Step 1: Load product ── */
      await send({ type: "step", id: "load-product", label: "Loading product details..." });

      const [product] = await db
        .select()
        .from(productsTable)
        .where(and(eq(productsTable.id, productId), eq(productsTable.userId, userId), isNull(productsTable.deletedAt)))
        .limit(1);

      if (!product) throw new Error(`Product ${productId} not found`);

      await send({ type: "step-done", id: "load-product" });

      /* ── Step 2: Attach assets ── */
      await send({ type: "step", id: "attach-assets", label: "Attaching design assets..." });

      const existing = (product.marketingAssets ?? {}) as MarketingAssets;

      // Build full marketing asset patch — merge with existing, never remove existing values
      const assetPatch: MarketingAssets = {
        ...existing,
        // Design images (only overwrite if new value is present)
        ...(design.coverUrl     ? { coverThumbnailUrl: design.coverUrl     as string } : {}),
        ...(design.mockupUrl    ? { bookMockupUrl:      design.mockupUrl    as string } : {}),
        ...(design.thumbnailUrl ? { thumbnailUrl:        design.thumbnailUrl as string } : {}),
        ...(design.socialUrl    ? { socialPreviewUrl:    design.socialUrl    as string } : {}),
        // Marketing copy
        productTitle:       input.productName,
        productDescription: String(marketing.marketplaceDesc ?? existing.productDescription ?? ""),
        // SEO
        seoKeywords:        Array.isArray(marketing.tags) ? marketing.tags as string[] : (existing.seoKeywords ?? []),
        hashtags:           Array.isArray(marketing.tags) ? marketing.tags as string[] : (existing.hashtags ?? []),
        // Price label — use existing if set, else default
        priceLabel:         existing.priceLabel ?? "£27",
        // CTA
        checkoutUrl:        existing.checkoutUrl ?? null,
      };

      await send({ type: "step-done", id: "attach-assets" });

      /* ── Step 3: Populate listing ── */
      await send({ type: "step", id: "populate-listing", label: "Populating store listing..." });

      // No extra AI call needed — all data came from previous stages
      await sleep(400); // realistic pause
      await send({ type: "step-done", id: "populate-listing" });

      /* ── Step 4: Validate ── */
      await send({ type: "step", id: "validate", label: "Validating store readiness..." });
      await sleep(200);

      const checks: Check[] = [];

      const addCheck = async (check: Check): Promise<void> => {
        checks.push(check);
        await send({ type: "validation-item", ...check });
        await sleep(120);
      };

      // 1. Cover image — accept either a DALL-E URL or a Design Studio record (designId)
      const hasCoverDesign =
        Array.isArray(design.concepts) &&
        (design.concepts as Array<{ designId?: string }>).some(c => !!c.designId);
      await addCheck(
        assetPatch.coverThumbnailUrl
          ? { id: "cover", label: "Cover Image", status: "ok",      detail: "Product cover attached" }
          : hasCoverDesign
            ? { id: "cover", label: "Cover Image", status: "ok",    detail: "Cover design ready — open in Design Studio to export" }
            : { id: "cover", label: "Cover Image", status: "warning", detail: "No cover — retry the Design Agent" },
      );

      // 2. 3D Mockup
      await addCheck(assetPatch.bookMockupUrl
        ? { id: "mockup",     label: "3D Mockup",           status: "ok",      detail: "Mockup image attached" }
        : { id: "mockup",     label: "3D Mockup",           status: "warning", detail: "No mockup — optional but recommended" });

      // 3. Marketplace thumbnail — accept DALL-E URL or dedicated thumbnail design record
      const hasThumbnailDesign = !!(design.thumbnailDesignId as string | undefined);
      await addCheck(
        assetPatch.thumbnailUrl
          ? { id: "thumbnail", label: "Store Thumbnail", status: "ok",      detail: "Square thumbnail ready" }
          : hasThumbnailDesign
            ? { id: "thumbnail", label: "Store Thumbnail", status: "ok",    detail: "Thumbnail design ready — open in Design Studio to export" }
            : { id: "thumbnail", label: "Store Thumbnail", status: "warning", detail: "No thumbnail — generate one in Design Studio" },
      );

      // 4. Social preview
      await addCheck(assetPatch.socialPreviewUrl
        ? { id: "social",     label: "Social Preview",      status: "ok",      detail: "Social image attached" }
        : { id: "social",     label: "Social Preview",      status: "missing", detail: "Missing social preview image" });

      // 5. Product description
      const descLen = (assetPatch.productDescription ?? "").length;
      await addCheck(descLen > 80
        ? { id: "description", label: "Product Description", status: "ok",    detail: `${descLen} characters` }
        : { id: "description", label: "Product Description", status: "warning", detail: "Description is very short" });

      // 6. SEO title
      const hasSeoTitle = Boolean((marketing.seoTitle as string | undefined)?.length);
      await addCheck(hasSeoTitle
        ? { id: "seo-title",  label: "SEO Title",           status: "ok",      detail: marketing.seoTitle as string }
        : { id: "seo-title",  label: "SEO Title",           status: "missing", detail: "No SEO title set" });

      // 7. SEO meta description
      const hasSeoMeta = Boolean((marketing.seoMetaDesc as string | undefined)?.length);
      await addCheck(hasSeoMeta
        ? { id: "seo-meta",   label: "SEO Description",     status: "ok",      detail: `${(marketing.seoMetaDesc as string).length} chars` }
        : { id: "seo-meta",   label: "SEO Description",     status: "missing", detail: "No SEO meta description" });

      // 8. Tags
      const tagCount = (marketing.tags as string[] | undefined)?.length ?? 0;
      await addCheck(tagCount >= 5
        ? { id: "tags",       label: "Product Tags",        status: "ok",      detail: `${tagCount} tags` }
        : { id: "tags",       label: "Product Tags",        status: "warning", detail: `Only ${tagCount} tags — aim for 8+` });

      // 9. FAQ
      const faqCount = (marketing.faq as unknown[] | undefined)?.length ?? 0;
      await addCheck(faqCount >= 3
        ? { id: "faq",        label: "FAQ",                 status: "ok",      detail: `${faqCount} questions` }
        : { id: "faq",        label: "FAQ",                 status: "warning", detail: "Fewer than 3 FAQ items" });

      // 10. CTA
      const hasCta = Boolean((marketing.ctas as string[] | undefined)?.length);
      await addCheck(hasCta
        ? { id: "cta",        label: "Call to Action",      status: "ok",      detail: (marketing.ctas as string[])[0] }
        : { id: "cta",        label: "Call to Action",      status: "missing", detail: "No CTA text set" });

      // 11. Headline / sales copy
      const hasHeadline = Boolean((salesCopy.headline as string | undefined)?.length);
      await addCheck(hasHeadline
        ? { id: "headline",   label: "Sales Headline",      status: "ok",      detail: salesCopy.headline as string }
        : { id: "headline",   label: "Sales Headline",      status: "warning", detail: "No sales headline from marketing stage" });

      // 12. Price label
      await addCheck(
        { id: "price",        label: "Price",               status: "ok",      detail: assetPatch.priceLabel ?? "£27 (default)" }
      );

      // 13. Refund policy — auto-fix
      await addCheck(
        { id: "refund",       label: "Refund Policy",       status: "fixed",   detail: "Standard digital product policy applied" }
      );

      await send({ type: "step-done", id: "validate" });

      /* ── Step 5: Auto-fix issues ── */
      await send({ type: "step", id: "fix-issues", label: "Auto-fixing issues..." });

      // Add refund policy to marketingAssets if not already set
      if (!(existing as Record<string, unknown>).refundPolicy) {
        (assetPatch as Record<string, unknown>).refundPolicy = REFUND_POLICY_TEMPLATE;
      }

      // Add SEO title + meta from marketing if available
      if (marketing.seoTitle)    (assetPatch as Record<string, unknown>).seoTitle    = marketing.seoTitle;
      if (marketing.seoMetaDesc) (assetPatch as Record<string, unknown>).seoMetaDesc = marketing.seoMetaDesc;
      if (marketing.faq)         (assetPatch as Record<string, unknown>).faq         = marketing.faq;
      if (marketing.ctas)        (assetPatch as Record<string, unknown>).ctas         = marketing.ctas;
      if (marketing.salesCopy)   (assetPatch as Record<string, unknown>).salesCopy    = marketing.salesCopy;
      if (marketing.headlines)   (assetPatch as Record<string, unknown>).headlines    = marketing.headlines;

      await sleep(300);
      await send({ type: "step-done", id: "fix-issues" });

      /* ── Compute readiness score ── */
      const scored = checks.map(c => ({
        ...c,
        // ok + fixed both count as passing; warning = half; missing = 0
        points: c.status === "ok" || c.status === "fixed" ? 1 : c.status === "warning" ? 0.5 : 0,
      }));
      const score = Math.round((scored.reduce((s, c) => s + c.points, 0) / checks.length) * 100);
      await send({ type: "readiness-score", score, checks });

      /* ── Step 6: Save to store ── */
      await send({ type: "step", id: "save", label: "Saving to store..." });

      await db
        .update(productsTable)
        .set({ marketingAssets: assetPatch, updatedAt: new Date() })
        .where(and(eq(productsTable.id, productId), eq(productsTable.userId, userId)));

      await send({ type: "step-done", id: "save" });

      /* ── Step 7: Done ── */
      await send({ type: "step", id: "ready", label: "Store ready ✓" });
      await send({ type: "step-done", id: "ready" });

      const storeUrl = `${APP_URL}/product/${productId}`;
      await send({ type: "done", productId, storeUrl, score, checks });

    } catch (err) {
      console.error("[launch/store]", err);
      await send({ type: "error", message: err instanceof Error ? err.message : String(err) }).catch(() => {});
    } finally {
      await writer.close().catch(() => {});
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type":      "application/x-ndjson; charset=utf-8",
      "Cache-Control":     "no-cache, no-store, must-revalidate",
      "X-Accel-Buffering": "no",
    },
  });
}

/* ─── POST handler ───────────────────────────────────────────────────────────── */

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

    const rl = await checkApiRateLimit(userId);
    if (rl) return rl;

    const body = await request.json().catch(() => ({})) as Partial<StoreInput>;

    const productId = typeof body.productId === "string" ? body.productId.trim() : "";
    if (!productId) return new Response(JSON.stringify({ error: "productId required" }), { status: 400 });

    const input: StoreInput = {
      productId,
      productName:  typeof body.productName  === "string" ? body.productName.trim()  : "My Product",
      stageResults: typeof body.stageResults === "object" && body.stageResults !== null
        ? body.stageResults as Record<string, unknown>
        : {},
    };

    return streamStoreAssembly(userId, input);

  } catch (err) {
    console.error("[launch/store]", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
}
