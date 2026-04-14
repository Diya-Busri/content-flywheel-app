import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/is-admin";
import { db } from "@/db/db";
import { promoCodesTable } from "@/db/schema/promo-codes-schema";
import { desc } from "drizzle-orm";
import { stripe } from "@/lib/stripe";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const codes = await db.select().from(promoCodesTable).orderBy(desc(promoCodesTable.createdAt));
  return NextResponse.json({ codes });
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { code, description, discountType, discountValue, maxUses, expiresAt, plan } = body;
  if (!code) return NextResponse.json({ error: "code required" }, { status: 400 });
  if (!discountValue || discountValue <= 0) return NextResponse.json({ error: "discount value required" }, { status: 400 });

  const isPercent = discountType === "percent";
  const discountPercent = isPercent ? Math.round(discountValue) : 0;
  const discountAmount = !isPercent ? Math.round(discountValue * 100) : 0; // cents

  // Create coupon + promotion code in Stripe so it works at checkout
  let stripeCouponId: string | null = null;
  let stripePromotionCodeId: string | null = null;

  try {
    const coupon = await stripe.coupons.create({
      name: description || code.toUpperCase().trim(),
      ...(isPercent
        ? { percent_off: discountPercent }
        : { amount_off: discountAmount, currency: "gbp" }),
      duration: "once",
      ...(maxUses ? { max_redemptions: maxUses } : {}),
    });
    stripeCouponId = coupon.id;

    const promoCode = await stripe.promotionCodes.create({
      coupon: coupon.id,
      code: code.toUpperCase().trim(),
      ...(maxUses ? { max_redemptions: maxUses } : {}),
      ...(expiresAt ? { expires_at: Math.floor(new Date(expiresAt).getTime() / 1000) } : {}),
    });
    stripePromotionCodeId = promoCode.id;
  } catch (err) {
    console.error("Stripe coupon creation failed:", err);
    // Return error — promo code won't work at checkout without Stripe
    const msg = err instanceof Error ? err.message : "Stripe error";
    return NextResponse.json({ error: `Stripe sync failed: ${msg}` }, { status: 500 });
  }

  const [promo] = await db.insert(promoCodesTable).values({
    code: code.toUpperCase().trim(),
    description: description ?? null,
    discountPercent,
    discountAmount,
    maxUses: maxUses || null,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
    active: true,
    plan: (plan === "monthly" || plan === "yearly") ? plan : "both",
    stripeCouponId,
    stripePromotionCodeId,
  }).returning();

  return NextResponse.json({ code: promo });
}
