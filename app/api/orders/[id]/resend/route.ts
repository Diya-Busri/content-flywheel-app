export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { productOrdersTable } from "@/db/schema/product-orders-schema";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and } from "drizzle-orm";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://contentflywheel.co.uk";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [order] = await db
    .select({
      id: productOrdersTable.id,
      productId: productOrdersTable.productId,
      buyerEmail: productOrdersTable.buyerEmail,
      buyerName: productOrdersTable.buyerName,
      downloadToken: productOrdersTable.downloadToken,
      downloadExpiresAt: productOrdersTable.downloadExpiresAt,
    })
    .from(productOrdersTable)
    .where(and(eq(productOrdersTable.id, id), eq(productOrdersTable.creatorUserId, userId)))
    .limit(1);

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (!order.downloadToken) return NextResponse.json({ error: "No download token for this order" }, { status: 400 });

  const [product] = await db
    .select({ title: productsTable.title })
    .from(productsTable)
    .where(eq(productsTable.id, order.productId))
    .limit(1);

  const productTitle = product?.title ?? "Digital Product";
  const downloadUrl = `${appUrl}/api/products/${order.productId}/download?token=${order.downloadToken}`;
  const expiresText = order.downloadExpiresAt
    ? `Link valid until ${new Date(order.downloadExpiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.`
    : "";

  await resend.emails.send({
    from: "hello@contentflywheel.co.uk",
    to: order.buyerEmail,
    subject: `Your download link: ${productTitle}`,
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
          <h2 style="margin:0 0 16px;font-size:20px;">Here's your download link 📦</h2>
          <p style="margin:0 0 24px;">Hi ${order.buyerName ?? "there"}, here is your download link for <strong>${productTitle}</strong>.</p>
          <a href="${downloadUrl}" style="display:inline-block;padding:14px 28px;background:#f97316;color:#fff;border-radius:10px;font-weight:700;text-decoration:none;font-size:15px;">Download ${productTitle}</a>
          <p style="margin:24px 0 0;font-size:13px;color:#888;">${expiresText} Reply to this email if you need help.</p>
        </td></tr>
        <tr><td style="background:#F5C97A;padding:20px 40px;text-align:center;">
          <p style="margin:0;font-size:13px;color:#0B0B0F;font-weight:600;">Content Flywheel</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
  });

  return NextResponse.json({ success: true });
}
