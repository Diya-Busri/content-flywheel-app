import { NextResponse } from "next/server";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { brandVoiceTable } from "@/db/schema/brand-voice-schema";
import { storeSettingsTable } from "@/db/schema/store-settings-schema";
import { emailContactsTable } from "@/db/schema/email-marketing-schema";
import { productOrdersTable } from "@/db/schema/product-orders-schema";
import { isNull, desc, eq, inArray, sql, gte } from "drizzle-orm";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

const resend = new Resend(process.env.RESEND_API_KEY);
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://contentflywheel.co.uk";

type MA = {
  isNativePublished?: boolean;
  nativePrice?: number;
  priceLabel?: string;
  thumbnailUrl?: string | null;
  coverThumbnailUrl?: string | null;
  bookMockupUrl?: string | null;
  productDescription?: string;
  comingSoon?: boolean;
};

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Fetch new products (last 7 days) ──────────────────────────────────────
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      id: productsTable.id,
      title: productsTable.title,
      niche: productsTable.niche,
      format: productsTable.format,
      marketingAssets: productsTable.marketingAssets,
      userId: productsTable.userId,
      createdAt: productsTable.createdAt,
    })
    .from(productsTable)
    .where(isNull(productsTable.deletedAt))
    .orderBy(desc(productsTable.createdAt));

  const newProducts = rows
    .filter((r) => {
      const ma = (r.marketingAssets ?? {}) as MA;
      return (
        ma.isNativePublished === true &&
        !ma.comingSoon &&
        new Date(r.createdAt) >= sevenDaysAgo
      );
    })
    .slice(0, 8);

  if (newProducts.length === 0) {
    return NextResponse.json({ skipped: true, reason: "No new products this week" });
  }

  // ── Creator names ─────────────────────────────────────────────────────────
  const userIds = Array.from(new Set(newProducts.map((r) => r.userId)));
  const [brandRows, storeRows] = await Promise.all([
    userIds.length > 0
      ? db.select({ userId: brandVoiceTable.userId, brandName: brandVoiceTable.brandName })
          .from(brandVoiceTable).where(inArray(brandVoiceTable.userId, userIds))
      : [],
    userIds.length > 0
      ? db.select({ userId: storeSettingsTable.userId, storeName: storeSettingsTable.storeName })
          .from(storeSettingsTable).where(inArray(storeSettingsTable.userId, userIds))
      : [],
  ]);

  const nameMap: Record<string, string> = {};
  for (const r of brandRows) nameMap[r.userId] = r.brandName?.trim() || "";
  for (const r of storeRows) if (r.storeName?.trim()) nameMap[r.userId] = r.storeName.trim();

  // ── Sales counts for featured badge ──────────────────────────────────────
  const productIds = newProducts.map((r) => r.id);
  const salesRows = productIds.length > 0
    ? await db.select({ productId: productOrdersTable.productId, count: sql<number>`count(*)::int` })
        .from(productOrdersTable)
        .where(eq(productOrdersTable.status, "completed"))
        .groupBy(productOrdersTable.productId)
    : [];
  const salesMap: Record<string, number> = Object.fromEntries(salesRows.map((r) => [r.productId, r.count]));

  // ── Collect platform subscribers (deduped, non-unsubscribed) ──────────────
  const contactRows = await db
    .select({ email: emailContactsTable.email })
    .from(emailContactsTable)
    .where(isNull(emailContactsTable.unsubscribedAt));

  const uniqueEmails = Array.from(new Set(contactRows.map((r) => r.email.toLowerCase())));

  if (uniqueEmails.length === 0) {
    return NextResponse.json({ skipped: true, reason: "No subscribers" });
  }

  // ── Build product cards HTML ──────────────────────────────────────────────
  const productCards = newProducts.map((r) => {
    const ma = (r.marketingAssets ?? {}) as MA;
    const thumbnail = ma.coverThumbnailUrl ?? ma.bookMockupUrl ?? ma.thumbnailUrl ?? null;
    const price =
      ma.nativePrice === 0
        ? "Free"
        : ma.nativePrice != null
        ? `£${(ma.nativePrice / 100).toFixed(2)}`
        : ma.priceLabel ?? "";
    const creator = nameMap[r.userId] || "Creator";
    const hasSales = (salesMap[r.id] ?? 0) > 0;
    const desc = ((ma.productDescription ?? "").slice(0, 100) + (ma.productDescription && ma.productDescription.length > 100 ? "…" : ""));

    return `
      <tr>
        <td style="padding:0 40px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #f3f4f6;border-radius:12px;overflow:hidden;">
            <tr>
              ${thumbnail ? `
              <td width="120" style="vertical-align:top;">
                <img src="${thumbnail}" width="120" height="90" alt="${r.title}" style="display:block;object-fit:cover;border-radius:12px 0 0 12px;" />
              </td>` : ""}
              <td style="padding:14px 16px;vertical-align:top;">
                <p style="margin:0 0 2px;font-size:10px;font-weight:700;color:#f97316;text-transform:uppercase;letter-spacing:0.06em;">${r.niche} · ${r.format}${hasSales ? " · 🔥 Selling" : ""}</p>
                <p style="margin:0 0 6px;font-size:15px;font-weight:800;color:#111827;">${r.title}</p>
                ${desc ? `<p style="margin:0 0 10px;font-size:13px;color:#6b7280;line-height:1.5;">${desc}</p>` : ""}
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="padding-right:12px;font-size:16px;font-weight:800;color:${ma.nativePrice === 0 ? "#10b981" : "#111827"};">${price}</td>
                    <td style="font-size:12px;color:#9ca3af;">by ${creator}</td>
                  </tr>
                </table>
                <p style="margin:10px 0 0;">
                  <a href="${SITE_URL}/product/${r.id}" style="display:inline-block;padding:8px 16px;background:#f97316;color:#fff;font-size:13px;font-weight:700;text-decoration:none;border-radius:8px;">View Product →</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
  }).join("\n");

  const subject = `🆕 ${newProducts.length} new product${newProducts.length !== 1 ? "s" : ""} on the Content Flywheel Marketplace this week`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9fafb;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#0B0B0F;padding:32px 40px;text-align:center;">
            <img src="${SITE_URL}/logo.png" height="48" alt="Content Flywheel" style="display:block;margin:0 auto 20px;" />
            <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#fff;letter-spacing:-0.02em;">What's New This Week 🆕</h1>
            <p style="margin:0;font-size:15px;color:#9ca3af;">${newProducts.length} new product${newProducts.length !== 1 ? "s" : ""} just dropped on the marketplace</p>
          </td>
        </tr>

        <!-- Intro -->
        <tr>
          <td style="padding:32px 40px 20px;">
            <p style="margin:0;font-size:15px;color:#4b5563;line-height:1.6;">
              Here's what independent creators published this week on Content Flywheel. Find your next template, guide, or course below.
            </p>
          </td>
        </tr>

        <!-- Products -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          ${productCards}
        </table>

        <!-- CTA -->
        <tr>
          <td style="padding:8px 40px 40px;text-align:center;">
            <a href="${SITE_URL}/marketplace" style="display:inline-block;padding:14px 32px;background:#f97316;color:#fff;font-size:16px;font-weight:800;text-decoration:none;border-radius:12px;box-shadow:0 4px 14px rgba(249,115,22,0.35);">
              Browse the Full Marketplace →
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:24px 40px;border-top:1px solid #f3f4f6;text-align:center;">
            <p style="margin:0 0 8px;font-size:13px;color:#9ca3af;">
              You're receiving this because you subscribed to a Content Flywheel creator store.
            </p>
            <p style="margin:0;font-size:13px;color:#9ca3af;">
              <a href="${SITE_URL}/marketplace" style="color:#f97316;text-decoration:none;">Marketplace</a> ·
              <a href="${SITE_URL}" style="color:#9ca3af;text-decoration:none;">Content Flywheel</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  // ── Send in batches of 50 (Resend batch limit) ────────────────────────────
  const BATCH_SIZE = 50;
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < uniqueEmails.length; i += BATCH_SIZE) {
    const batch = uniqueEmails.slice(i, i + BATCH_SIZE);
    try {
      await resend.emails.send({
        from: `Content Flywheel <hello@contentflywheel.co.uk>`,
        to: batch,
        subject,
        html,
      });
      sent += batch.length;
    } catch (err) {
      console.error(`[marketplace-digest] batch ${i / BATCH_SIZE} failed:`, err);
      failed += batch.length;
    }
  }

  return NextResponse.json({
    ok: true,
    newProducts: newProducts.length,
    sent,
    failed,
    subscribers: uniqueEmails.length,
  });
}
