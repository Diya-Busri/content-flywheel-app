import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { productHistoryTable } from "@/db/schema/product-history-schema";
import { bundleJobsTable } from "@/db/schema/bundle-jobs-schema";
import { notificationsTable } from "@/db/schema/notifications-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { eq, and } from "drizzle-orm";
import {
  generateProductOutline,
  generateSingleSectionBody,
  type GenerateProductContentParams,
} from "@/lib/generate-product-content";
import { generateProductImage } from "@/lib/generateProductImages";
import { Resend } from "resend";

export const maxDuration = 300; // 5 min (Vercel Pro); local dev no limit

const VALID_FORMATS = ["ebook", "guide", "workbook", "spreadsheet", "notion", "course", "checklist", "journal", "planner", "template"] as const;

/** Normalize and validate format from body or DB (handles "Course Outline", "course_outline", "Notion Template", "notion_template", etc.). */
function normalizeFormat(value: string | undefined | null, fallback: string): string {
  if (value == null || typeof value !== "string") return fallback;
  const lower = value.toLowerCase().trim();
  if (lower === "course outline" || lower === "course_outline") return "course";
  if (lower === "checklist pack") return "checklist";
  if (lower === "notion template" || lower === "notion_template") return "notion";
  return VALID_FORMATS.includes(lower as (typeof VALID_FORMATS)[number]) ? lower : fallback;
}

type SectionRow = { id: string; title: string; content: string; contentHtml?: string; order: number; imageUrl?: string };

const BATCH_SIZE = 10; // Generate up to 10 sections in parallel (e.g. planner has 7, all in one batch)

/**
 * POST: Internal. Generates product content: outline first, then sections in parallel batches.
 * Client sees progress as each batch completes.
 */
function resolveInternalSecret(): string | null {
  return (
    process.env.INTERNAL_API_SECRET?.trim() ||
    (process.env.DATABASE_URL
      ? Buffer.from(process.env.DATABASE_URL).toString("base64").slice(0, 40)
      : null)
  );
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: productId } = await params;
  if (!productId) return NextResponse.json({ error: "Product ID required" }, { status: 400 });

  // Support two auth paths:
  //   1. Browser client — Clerk session cookie (standard)
  //   2. Server-to-server from bundle route — x-internal-secret header + userId in body
  const rawBody = await request.json().catch(() => ({}));
  const { userId: clerkUserId } = await auth();
  const internalSecret = request.headers.get("x-internal-secret");
  const validSecret = resolveInternalSecret();
  const isInternalCall = !!(internalSecret && validSecret && internalSecret === validSecret);
  const userId = clerkUserId ?? (isInternalCall && typeof rawBody.userId === "string" ? rawBody.userId : null);

  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isInternalCall) {
    const apiRl = await checkApiRateLimit(userId);
    if (apiRl) return apiRl;
  }

  let existing: { id: string; userId: string; status: string; format: string; title: string; niche: string; bundleId: string | null; customizationOptions: unknown } | undefined;
  try {
    const body = rawBody;

    const [existingRow] = await db
      .select({
        id: productsTable.id,
        userId: productsTable.userId,
        status: productsTable.status,
        format: productsTable.format,
        title: productsTable.title,
        niche: productsTable.niche,
        bundleId: productsTable.bundleId,
        customizationOptions: productsTable.customizationOptions,
      })
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .limit(1);
    existing = existingRow;

    // Verify ownership
    if (!existing) return NextResponse.json({ error: "Product not found" }, { status: 404 });
    if (existing.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Allow retry for failed OR stuck-generating products (Vercel killed the function)
    const isRetry = body.retry === true && (existing?.status === "failed" || existing?.status === "generating");
    if (isRetry) {
      await db
        .update(productsTable)
        .set({ status: "generating", generationError: null, updatedAt: new Date() })
        .where(and(eq(productsTable.id, productId), eq(productsTable.userId, userId)));
    }

    const niche = body.niche != null ? (typeof body.niche === "string" ? body.niche : (body.niche as { name?: string }).name ?? "") : "";
    const product = body.product as { name?: string; included?: string; why?: string } | undefined;
    const productName = (product?.name ?? body.productName ?? (isRetry ? existing?.title : "") ?? "").trim();
    const productIncluded = product?.included ?? body.productIncluded ?? "";
    const productWhy = product?.why ?? body.productWhy ?? "";
    let productDescription = (typeof body.productDescription === "string" ? body.productDescription : "") || (productName ? `${productIncluded}. ${productWhy}` : "");
    const formatFromBody = body.format != null ? String(body.format).trim() : "";
    const formatFromDb = existing?.format ?? "";
    const format = normalizeFormat(formatFromBody || formatFromDb, "ebook");
    const spreadsheetDisclaimer = "⚠️ This is a step-by-step tutorial guide (PDF). You will learn how to create this spreadsheet yourself in Excel or Google Sheets. This is NOT a pre-made spreadsheet file - it's an educational guide that teaches you valuable Excel skills.";
    if (format === "spreadsheet") {
      productDescription = productDescription ? `${productDescription} ${spreadsheetDisclaimer}` : spreadsheetDisclaimer;
    }
    const hooks = Array.isArray(body.hooks) ? body.hooks : [];
    const ctas = Array.isArray(body.ctas) ? body.ctas : [];
    const hookTexts = hooks.map((h: string | { text?: string }) => (typeof h === "string" ? h : h?.text ?? ""));
    const ctaTexts = ctas.map((c: string | { text?: string }) => (typeof c === "string" ? c : c?.text ?? ""));
    const nicheName = (typeof niche === "string" ? niche : (niche as { name?: string })?.name ?? "") || (isRetry ? existing?.niche ?? "" : "") || "";

    if (!existing) {
      console.error("[products/process] Product not found:", productId);
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    if (!isRetry && existing.status !== "generating") {
      return NextResponse.json({ message: "Already processed" });
    }

    const customizationOptions =
      body.customizationOptions != null && typeof body.customizationOptions === "object"
        ? (body.customizationOptions as GenerateProductContentParams["customizationOptions"])
        : existing?.customizationOptions != null && typeof existing.customizationOptions === "object"
          ? (existing.customizationOptions as GenerateProductContentParams["customizationOptions"])
          : undefined;

    const subFocus = typeof body.subFocus === "string" ? body.subFocus.trim() : undefined;
    const bundleMode = body.bundleMode === true;
    const creatorExpertise = typeof body.creatorExpertise === "string" ? body.creatorExpertise.trim() : undefined;
    const params: GenerateProductContentParams = {
      productName,
      productDescription,
      productIncluded,
      productWhy,
      niche: nicheName,
      format,
      subFocus: subFocus || undefined,
      hookTexts: hookTexts.filter(Boolean),
      ctaTexts: ctaTexts.filter(Boolean),
      customizationOptions,
      bundleMode,
      creatorExpertise: creatorExpertise || undefined,
    };

    // 1. Generate outline (retry once on failure so products are generated no matter what)
    let outline: { id: string; title: string }[];
    try {
      outline = await generateProductOutline(params);
    } catch (outlineErr) {
      console.warn("[products/process] Outline failed, retrying once:", outlineErr);
      outline = await generateProductOutline(params);
    }
    if (!outline?.length) {
      outline = [{ id: "intro", title: productName ? `${productName} – Getting started` : "Introduction" }];
    }
    const initialSections: SectionRow[] = outline.map((s, i) => ({
      id: s.id,
      title: s.title,
      content: "",
      order: i + 1,
    }));

    await db
      .update(productsTable)
      .set({
        content: { sections: initialSections },
        updatedAt: new Date(),
      })
      .where(eq(productsTable.id, productId));
    if (format !== "planner") {
      console.log("[DIAG] OUTLINE step 4 — saved to DB", { productId, format, sectionCount: initialSections.length });
    }

    const imageContext = { productName, niche: nicheName, format };
    const sectionsWithContent: SectionRow[] = [];

    for (let start = 0; start < outline.length; start += BATCH_SIZE) {
      const batch = outline.slice(start, start + BATCH_SIZE);
      const batchIndices = batch.map((_, j) => start + j);

      const results = await Promise.allSettled(
        batch.map((section, j) =>
          generateSingleSectionBody(params, section, batchIndices[j], outline.length)
        )
      );

      const bodiesAndPrompts: { bodyHtml: string; imagePrompt?: string }[] = [];
      for (let j = 0; j < batch.length; j++) {
        const section = batch[j];
        const i = batchIndices[j];
        let bodyHtml = "";
        let imagePrompt: string | undefined;
        const result = results[j];
        if (result.status === "fulfilled") {
          bodyHtml = result.value.body || "";
          imagePrompt = result.value.imagePrompt;
        } else {
          console.warn("[products/process] Section body failed, retrying once:", section.id, result.reason);
          try {
            const retry = await generateSingleSectionBody(params, section, i, outline.length);
            bodyHtml = retry.body || "";
            imagePrompt = retry.imagePrompt;
          } catch (retryErr) {
            console.error("[products/process] Section failed after retry:", section.id, retryErr);
            bodyHtml = "<p><em>Content generation failed for this section. You can edit it in the editor.</em></p>";
          }
        }
        bodiesAndPrompts.push({ bodyHtml, imagePrompt });
      }

      // Only generate images when the user explicitly chose "text_with_ai_images".
      // Default is "text_with_placeholders" — generating images for every section is the main cause of slow/failed generation.
      const wantImages =
        format !== "spreadsheet" &&
        customizationOptions?.contentStyle === "text_with_ai_images";

      const imageUrls = wantImages
        ? await Promise.all(
          batch.map((section) => {
            const prompt = `Professional illustration of ${section.title}, clean minimalist style, suitable for a digital product`;
            return generateProductImage(prompt, imageContext).catch((err) => {
              console.warn("[products/process] Image gen failed for", section.id, err);
              return undefined;
            });
          })
        )
        : batch.map(() => undefined);

      for (let j = 0; j < batch.length; j++) {
        const imageUrl = imageUrls[j] ?? undefined;
        const sectionTitle = batch[j].title;
        console.log("[content-pages]", {
          formatType: format,
          pageSectionTitle: sectionTitle,
          imageUrlExists: imageUrl != null,
        });
        sectionsWithContent.push({
          id: batch[j].id,
          title: batch[j].title,
          content: bodiesAndPrompts[j].bodyHtml,
          contentHtml: bodiesAndPrompts[j].bodyHtml,
          order: batchIndices[j] + 1,
          imageUrl,
        });
      }

      await db
        .update(productsTable)
        .set({
          content: { sections: [...sectionsWithContent] },
          updatedAt: new Date(),
        })
        .where(eq(productsTable.id, productId));
      if (format !== "planner") {
        console.log("[DIAG] BATCH saved to DB", { productId, format, sectionsCount: sectionsWithContent.length });
      }
    }

    if (format === "planner") {
      console.log("[products/process] Planner raw AI response (sections before final save):", JSON.stringify(sectionsWithContent.map((s) => ({ id: s.id, title: s.title, contentLength: (s.content ?? "").length, contentPreview: (s.content ?? "").slice(0, 200) })), null, 2));
    }

    const designSettings: Record<string, unknown> = {
      template: "modern",
      colors: { primary: "#FF6B35", secondary: "#004E89", accent: "#F7B32B", graphics: "#FF6B35" },
      typography: { heading: "Inter", body: "Open Sans", size: 16 },
      layout:
        format === "ebook"
          ? { maxWidth: "wide", margins: 2.5, paragraphSpacing: 1.25, sectionSpacing: 2, lineHeight: 1.7, alignment: "left" }
          : undefined,
    };
    if (format === "spreadsheet") {
      designSettings.subtitle = spreadsheetDisclaimer;
    }

    await db
      .update(productsTable)
      .set({
        content: { sections: sectionsWithContent },
        designSettings,
        status: "draft",
        updatedAt: new Date(),
      })
      .where(eq(productsTable.id, productId));
    if (format !== "planner") {
      console.log("[DIAG] Final save to DB — status=draft", { productId, format, totalSections: sectionsWithContent.length });
    }

    if (userId) {
      try {
        await db.insert(productHistoryTable).values({
          userId,
          productId,
          productTitle: productName || existing.title,
          formatType: format,
          contentJson: {
            sections: sectionsWithContent,
            designSettings,
          },
          status: "complete",
        });
      } catch (historyErr) {
        console.error("[products/process] product_history insert failed:", historyErr);
      }
    }

    // Check if this product is part of a bundle — if so, update bundle job progress
    const bundleId = existing.bundleId;
    if (bundleId) {
      await checkAndFinaliseBundleJob(bundleId, userId).catch((e) =>
        console.error("[products/process] bundle finalise check failed:", e)
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const timestamp = new Date().toISOString();
    const formatForLog = (existing as { format?: string } | undefined)?.format ?? "unknown";
    const nicheForLog = (existing as { niche?: string } | undefined)?.niche ?? "";
    console.error("[products/process] Generation error (saving fallback draft):", {
      format: formatForLog,
      niche: nicheForLog,
      productId,
      timestamp,
      error: errorMessage,
    });
    const fallbackSections: SectionRow[] = [
      {
        id: "intro",
        title: "Getting started",
        content: "<p>Content generation hit a temporary issue. You can edit this product and add your own content, or use <strong>Regenerate</strong> in the editor to try again.</p>",
        order: 1,
      },
    ];
    const fallbackDesignSettings: Record<string, unknown> = {
      template: "modern",
      colors: { primary: "#FF6B35", secondary: "#004E89", accent: "#F7B32B", graphics: "#FF6B35" },
      typography: { heading: "Inter", body: "Open Sans", size: 16 },
    };
    try {
      await db
        .update(productsTable)
        .set({
          content: { sections: fallbackSections },
          designSettings: fallbackDesignSettings,
          status: "draft",
          generationError: errorMessage.slice(0, 2000),
          updatedAt: new Date(),
        })
        .where(eq(productsTable.id, productId));
    } catch (dbErr) {
      console.error("[products/process] Could not save fallback draft:", dbErr);
      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      );
    }
    // Still check bundle completion even on fallback (product saved as draft with error)
    const bundleIdOnError = (existing as { bundleId?: string | null } | undefined)?.bundleId;
    if (bundleIdOnError && userId) {
      await checkAndFinaliseBundleJob(bundleIdOnError, userId).catch(() => {});
    }
    return NextResponse.json({ ok: true });
  }
}

// ── Bundle completion helper ────────────────────────────────────────────────

const FORMAT_LABEL_MAP: Record<string, string> = {
  ebook: "Ebook",
  workbook: "Workbook",
  spreadsheet: "Spreadsheet Tutorial",
  guide: "Guide",
  notion: "Notion Template",
  checklist: "Checklist Pack",
  journal: "Journal",
  planner: "Planner",
};

async function checkAndFinaliseBundleJob(bundleId: string, userId: string) {
  // Fetch current status of all products in this bundle
  const bundleProducts = await db
    .select({ id: productsTable.id, status: productsTable.status, format: productsTable.format, title: productsTable.title, niche: productsTable.niche })
    .from(productsTable)
    .where(eq(productsTable.bundleId, bundleId));

  if (bundleProducts.length === 0) return;

  // Only finalise when every product has settled (no longer "generating")
  const allSettled = bundleProducts.every((p) => p.status !== "generating");
  if (!allSettled) return;

  const completedCount = bundleProducts.filter((p) => p.status === "draft").length;
  const failedCount = bundleProducts.filter((p) => p.status === "failed").length;
  const finalStatus =
    completedCount === 0 ? "failed" : failedCount > 0 ? "partial" : "completed";

  // Mark bundle job done (idempotent — ignore if already finalised)
  const [job] = await db
    .update(bundleJobsTable)
    .set({ status: finalStatus, completedCount, failedCount, completedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(bundleJobsTable.id, bundleId), eq(bundleJobsTable.emailSent, false)))
    .returning({ id: bundleJobsTable.id, niche: bundleJobsTable.niche, emailSent: bundleJobsTable.emailSent });

  // If update matched nothing (already done + email sent) — skip
  if (!job) return;

  const niche = job.niche;

  // Create in-app notification
  try {
    const notifTitle = finalStatus === "completed"
      ? "Bundle ready ✨"
      : finalStatus === "partial"
        ? "Bundle partially ready"
        : "Bundle generation failed";
    const notifMsg = finalStatus === "completed"
      ? `Your ${niche} bundle (${completedCount} products) is ready in My Library.`
      : finalStatus === "partial"
        ? `Your ${niche} bundle is ready with ${completedCount}/${bundleProducts.length} products completed.`
        : `Generation failed for your ${niche} bundle.`;
    await db.insert(notificationsTable).values({
      userId,
      title: notifTitle,
      message: notifMsg,
      type: finalStatus === "failed" ? "error" : "success",
      linkUrl: "/dashboard/library",
    });
  } catch (e) {
    console.error("[bundle-finalise] notification insert failed:", e);
  }

  // Send Resend email if we have API key and at least one product completed
  if (completedCount > 0 && process.env.RESEND_API_KEY) {
    try {
      // Look up user email from profiles table
      const [profile] = await db
        .select({ email: profilesTable.email })
        .from(profilesTable)
        .where(eq(profilesTable.userId, userId))
        .limit(1);
      const userEmail = profile?.email;

      if (userEmail) {
        const completedProducts = bundleProducts.filter((p) => p.status === "draft");
        const productListHtml = completedProducts
          .map((p) => {
            const label = FORMAT_LABEL_MAP[p.format ?? ""] ?? p.format ?? "Product";
            return `<li style="padding:4px 0;color:#374151;">${label}</li>`;
          })
          .join("");
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://contentflywheel.co.uk";
        const subject =
          finalStatus === "completed"
            ? `Your Content Flywheel bundle is ready ✨`
            : `Your Content Flywheel bundle is partially ready`;

        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: "hello@contentflywheel.co.uk",
          to: userEmail,
          subject,
          html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr><td style="background:#0B0B0F;padding:16px 32px;text-align:center;">
          <img src="https://contentflywheel.co.uk/logo.png" alt="Content Flywheel" width="130" style="display:inline-block;height:auto;"/>
        </td></tr>
        <tr><td style="padding:36px 40px;color:#1a1a1a;font-size:16px;line-height:1.7;">
          <h2 style="margin:0 0 8px;font-size:22px;">Your bundle is ready 🎉</h2>
          <p style="margin:0 0 4px;color:#6b7280;font-size:14px;">Topic: <strong style="color:#1a1a1a;">${niche}</strong></p>
          <p style="margin:16px 0 8px;font-weight:600;">Generated assets:</p>
          <ul style="margin:0 0 24px;padding-left:20px;list-style:disc;">
            ${productListHtml}
          </ul>
          ${failedCount > 0 ? `<p style="margin:0 0 20px;font-size:13px;color:#9ca3af;">${failedCount} format(s) could not be generated — you can retry them in the app.</p>` : ""}
          <a href="${appUrl}/dashboard/library" style="display:inline-block;padding:14px 28px;background:#f97316;color:#fff;border-radius:10px;font-weight:700;text-decoration:none;font-size:15px;">Open My Library →</a>
        </td></tr>
        <tr><td style="background:#F5C97A;padding:20px 40px;text-align:center;">
          <p style="margin:0;font-size:13px;color:#0B0B0F;font-weight:600;">Content Flywheel</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
        });

        // Mark email sent
        await db
          .update(bundleJobsTable)
          .set({ emailSent: true, updatedAt: new Date() })
          .where(eq(bundleJobsTable.id, bundleId));
      }
    } catch (e) {
      console.error("[bundle-finalise] email send failed:", e);
    }
  }
}
