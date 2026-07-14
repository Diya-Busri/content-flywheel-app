export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Stripe from "stripe";
import { db } from "@/db/db";
import { productOrdersTable } from "@/db/schema/product-orders-schema";
import { productsTable } from "@/db/schema/products-schema";
import { eq } from "drizzle-orm";
import { isAdmin } from "@/lib/is-admin";
import { Resend } from "resend";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * POST /api/orders/[id]/refund
 * Lets the creator who owns an order (or a platform admin) refund a genuine
 * case and immediately revoke future download access. This is the "sellers/
 * admins controls to refund genuine cases and revoke future download access
 * after a refund" requirement from the new digital-product refund policy —
 * it does NOT change the buyer-facing "no refunds for change of mind" stance,
 * it's the tool used for the exceptions (faulty / inaccessible / not as
 * described) that the policy explicitly carves out.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: orderId } = await params;

  const [order] = await db
    .select()
    .from(productOrdersTable)
    .where(eq(productOrdersTable.id, orderId))
    .limit(1);

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const callerIsAdmin = await isAdmin();
  if (order.creatorUserId !== userId && !callerIsAdmin) {
    return NextResponse.json({ error: "Not authorized to refund this order" }, { status: 403 });
  }

  if (order.status === "refunded") {
    return NextResponse.json({ error: "This order has already been refunded" }, { status: 400 });
  }

  let reason: string | null = null;
  try {
    const body = await request.json().catch(() => ({}));
    reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 500) : null;
  } catch { /* ok */ }

  // Only call Stripe for orders that actually moved money — £0 lead-magnet /
  // pay-what-you-want orders just need access revoked, nothing to refund.
  if (order.amountCents > 0) {
    if (!order.stripePaymentIntentId) {
      return NextResponse.json(
        { error: "No payment record found for this order — cannot process a Stripe refund. Contact support." },
        { status: 400 }
      );
    }
    try {
      await stripe.refunds.create({ payment_intent: order.stripePaymentIntentId });
    } catch (err) {
      console.error("[orders/refund] Stripe refund failed:", err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Stripe refund failed" },
        { status: 502 }
      );
    }
  }

  const now = new Date();
  await db
    .update(productOrdersTable)
    .set({
      status: "refunded",
      refundedAt: now,
      refundedBy: userId,
      refundReason: reason,
      accessRevokedAt: now,
    })
    .where(eq(productOrdersTable.id, orderId));

  // Best-effort buyer notification — never blocks the refund itself.
  try {
    const [product] = await db
      .select({ title: productsTable.title })
      .from(productsTable)
      .where(eq(productsTable.id, order.productId))
      .limit(1);
    const productTitle = product?.title ?? "your digital product";

    await resend.emails.send({
      from: "hello@contentflywheel.co.uk",
      to: order.buyerEmail,
      subject: `Your refund has been processed`,
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
          <h2 style="margin:0 0 16px;font-size:20px;">Your refund has been processed</h2>
          <p style="margin:0 0 16px;">Hi${order.buyerName ? ` ${order.buyerName}` : ""}, your order for <strong>${productTitle}</strong> has been refunded${order.amountCents > 0 ? ` (£${(order.amountCents / 100).toFixed(2)})` : ""}.</p>
          <p style="margin:0 0 16px;">Download access for this order has now been switched off.</p>
          <p style="margin:24px 0 0;font-size:13px;color:#888;">Reply to this email if you have any questions.</p>
        </td></tr>
        <tr><td style="background:#F5C97A;padding:20px 40px;text-align:center;">
          <p style="margin:0;font-size:13px;color:#0B0B0F;font-weight:600;">Content Flywheel</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
    });
  } catch (err) {
    console.error("[orders/refund] Failed to send buyer refund email:", err);
  }

  return NextResponse.json({ success: true });
}
