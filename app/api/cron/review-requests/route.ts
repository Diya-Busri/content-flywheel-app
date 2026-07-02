import { NextResponse } from "next/server";
import { db } from "@/db/db";
import { productOrdersTable } from "@/db/schema/product-orders-schema";
import { productsTable } from "@/db/schema/products-schema";
import { brandVoiceTable } from "@/db/schema/brand-voice-schema";
import { productReviewsTable } from "@/db/schema/product-reviews-schema";
import { storeSettingsTable } from "@/db/schema/store-settings-schema";
import { eq, and, lte, isNull, sql } from "drizzle-orm";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://contentflywheel.co.uk";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  // Find completed orders 3+ days old where review request hasn't been sent
  const orders = await db
    .select()
    .from(productOrdersTable)
    .where(
      and(
        eq(productOrdersTable.status, "completed"),
        eq(productOrdersTable.reviewRequestSent, false),
        lte(productOrdersTable.createdAt, threeDaysAgo)
      )
    )
    .limit(100);

  if (orders.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  // Filter out buyers who already left a review
  const existingReviews = await db
    .select({ productId: productReviewsTable.productId, buyerEmail: productReviewsTable.buyerEmail })
    .from(productReviewsTable);

  const reviewedSet = new Set(existingReviews.map((r) => `${r.productId}:${r.buyerEmail.toLowerCase()}`));

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const order of orders) {
    const key = `${order.productId}:${order.buyerEmail.toLowerCase()}`;

    // Always mark as sent even if skipping (buyer already reviewed)
    if (reviewedSet.has(key)) {
      await db
        .update(productOrdersTable)
        .set({ reviewRequestSent: true })
        .where(eq(productOrdersTable.id, order.id));
      skipped++;
      continue;
    }

    try {
      // Fetch product + creator info
      const [[product], [brand], [store]] = await Promise.all([
        db.select({ title: productsTable.title, niche: productsTable.niche })
          .from(productsTable).where(eq(productsTable.id, order.productId)).limit(1),
        db.select({ brandName: brandVoiceTable.brandName })
          .from(brandVoiceTable).where(eq(brandVoiceTable.userId, order.creatorUserId)).limit(1),
        db.select({ storeName: storeSettingsTable.storeName })
          .from(storeSettingsTable).where(eq(storeSettingsTable.userId, order.creatorUserId)).limit(1),
      ]);

      const productTitle = product?.title ?? "your recent purchase";
      const creatorName = store?.storeName?.trim() || brand?.brandName?.trim() || "the creator";

      // Build review link — goes to the product page which has the review form
      const reviewUrl = `${APP_URL}/product/${order.productId}?review=1`;
      const buyerFirstName = order.buyerName?.split(" ")[0] ?? "there";

      const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr><td style="background:#0B0B0F;padding:24px 40px;text-align:center;">
          <img src="${APP_URL}/logo.png" height="40" alt="Content Flywheel" style="display:block;margin:0 auto;"/>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:40px 40px 32px;">
          <h2 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#111827;">How are you finding it, ${buyerFirstName}? ⭐</h2>
          <p style="margin:0 0 16px;font-size:15px;color:#4b5563;line-height:1.7;">
            You purchased <strong>${productTitle}</strong> from ${creatorName} a few days ago — we hope it's been useful!
          </p>
          <p style="margin:0 0 28px;font-size:15px;color:#4b5563;line-height:1.7;">
            Would you take 60 seconds to leave a quick review? It helps other buyers discover great products and supports ${creatorName}'s work.
          </p>

          <!-- Stars preview (decorative) -->
          <div style="text-align:center;margin-bottom:28px;">
            <span style="font-size:36px;letter-spacing:4px;">★★★★★</span>
          </div>

          <!-- CTA -->
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
            <tr><td style="background:#f97316;border-radius:12px;">
              <a href="${reviewUrl}" style="display:block;padding:14px 36px;font-size:16px;font-weight:800;color:#fff;text-decoration:none;">
                Leave a Review →
              </a>
            </td></tr>
          </table>
        </td></tr>

        <!-- Product reminder -->
        <tr><td style="padding:0 40px 32px;border-top:1px solid #f3f4f6;padding-top:24px;">
          <p style="margin:0;font-size:13px;color:#9ca3af;text-align:center;">
            Reviewing: <a href="${APP_URL}/product/${order.productId}" style="color:#f97316;font-weight:600;text-decoration:none;">${productTitle}</a>
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 40px;border-top:1px solid #f3f4f6;text-align:center;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">
            You received this because you purchased from a Content Flywheel creator. ·
            <a href="${APP_URL}" style="color:#9ca3af;text-decoration:none;">Content Flywheel</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

      await resend.emails.send({
        from: `Content Flywheel <hello@contentflywheel.co.uk>`,
        to: order.buyerEmail,
        subject: `How did you find "${productTitle}"? Leave a quick review ⭐`,
        html,
      });

      await db
        .update(productOrdersTable)
        .set({ reviewRequestSent: true })
        .where(eq(productOrdersTable.id, order.id));

      sent++;
    } catch (err) {
      console.error("[cron/review-requests] failed for order", order.id, err);
      failed++;
    }
  }

  return NextResponse.json({ sent, skipped, failed, total: orders.length });
}
