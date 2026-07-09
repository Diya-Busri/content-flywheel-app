export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { productOrdersTable } from "@/db/schema/product-orders-schema";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and, isNull } from "drizzle-orm";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://contentflywheel.co.uk";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: productId } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { subject, message } = body as { subject?: string; message?: string };
  if (!subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: "subject and message are required" }, { status: 400 });
  }

  // Verify product belongs to this creator
  const [product] = await db
    .select({ id: productsTable.id, title: productsTable.title })
    .from(productsTable)
    .where(and(eq(productsTable.id, productId), eq(productsTable.userId, userId), isNull(productsTable.deletedAt)))
    .limit(1);

  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  // Get all completed buyers
  const buyers = await db
    .select({ buyerEmail: productOrdersTable.buyerEmail, buyerName: productOrdersTable.buyerName })
    .from(productOrdersTable)
    .where(and(
      eq(productOrdersTable.productId, productId as unknown as string),
      eq(productOrdersTable.creatorUserId, userId),
      eq(productOrdersTable.status, "completed")
    ));

  if (buyers.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
        <tr>
          <td style="background:linear-gradient(135deg,#f97316 0%,#fb923c 100%);padding:32px 40px;">
            <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">${subject.trim()}</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Re: ${product.title}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;">
            <div style="color:#374151;font-size:15px;line-height:1.75;white-space:pre-wrap;">${message.trim().replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
            <hr style="border:none;border-top:1px solid #f3f4f6;margin:28px 0;"/>
            <a href="${APP_URL}/my-purchases" style="display:inline-block;padding:11px 24px;background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;font-weight:700;font-size:14px;border-radius:10px;text-decoration:none;">
              View my purchases →
            </a>
            <p style="margin:20px 0 0;color:#9ca3af;font-size:12px;">
              You received this because you purchased <strong>${product.title}</strong>.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const results = await Promise.allSettled(
    buyers.map(({ buyerEmail, buyerName }) =>
      resend.emails.send({
        from: "Content Flywheel <noreply@contentflywheel.co.uk>",
        to: buyerEmail,
        subject: subject.trim(),
        html,
      })
    )
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.length - sent;

  return NextResponse.json({ sent, failed, total: buyers.length });
}
