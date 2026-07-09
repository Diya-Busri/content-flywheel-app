import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/is-admin";
import { db } from "@/db/db";
import { promoCodesTable } from "@/db/schema/promo-codes-schema";
import { desc } from "drizzle-orm";
import { stripe } from "@/lib/stripe";
import Stripe from "stripe";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const codes = await db.select().from(promoCodesTable).orderBy(desc(promoCodesTable.createdAt));
  return NextResponse.json({ codes });
}

/**
 * Finds or creates a Stripe coupon + promotion code, handling the case
 * where the promotion code already exists (deactivated or active).
 */
async function syncWithStripe(
  codeStr: string,
  description: string | null,
  isPercent: boolean,
  discountPercent: number,
  discountAmount: number,
  maxUses: number | null,
  expiresAt: string | null
): Promise<{ stripeCouponId: string; stripePromotionCodeId: string } | null> {
  try {
    // Step 1: create coupon
    const coupon = await stripe.coupons.create({
      name: description || codeStr,
      ...(isPercent
        ? { percent_off: discountPercent }
        : { amount_off: discountAmount, currency: "gbp" }),
      duration: "once",
      ...(maxUses ? { max_redemptions: maxUses } : {}),
    });

    // Step 2: create promotion code — if it already exists, find and reactivate it
    let promoCode: Stripe.PromotionCode;
    try {
      promoCode = await stripe.promotionCodes.create({
        coupon: coupon.id,
        code: codeStr,
        ...(maxUses ? { max_redemptions: maxUses } : {}),
        ...(expiresAt ? { expires_at: Math.floor(new Date(expiresAt).getTime() / 1000) } : {}),
      });
    } catch (promoErr) {
      // Promotion code already exists — search for it and reactivate
      const existing = await stripe.promotionCodes.list({ code: codeStr, limit: 1 });
      if (existing.data.length > 0) {
        const found = existing.data[0];
        if (!found.active) {
          promoCode = await stripe.promotionCodes.update(found.id, { active: true });
        } else {
          promoCode = found;
        }
      } else {
        throw promoErr;
      }
    }

    return { stripeCouponId: coupon.id, stripePromotionCodeId: promoCode.id };
  } catch (err) {
    console.error("[promo-codes] Stripe sync failed:", err);
    return null; // Non-blocking — save to DB anyway
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { code, description, discountType, discountValue, maxUses, expiresAt, plan } = body as {
    code?: string;
    description?: string;
    discountType?: string;
    discountValue?: number;
    maxUses?: number;
    expiresAt?: string;
    plan?: string;
  };

  if (!code?.trim()) return NextResponse.json({ error: "Code is required" }, { status: 400 });
  if (!discountValue || discountValue <= 0) return NextResponse.json({ error: "Discount value must be greater than 0" }, { status: 400 });

  const codeStr = code.toUpperCase().trim();
  const isPercent = discountType !== "fixed";
  const discountPercent = isPercent ? Math.round(discountValue) : 0;
  const discountAmount = !isPercent ? Math.round(discountValue * 100) : 0; // cents

  // Sync with Stripe (non-blocking — save to DB even if Stripe fails)
  const stripeResult = await syncWithStripe(
    codeStr,
    description ?? null,
    isPercent,
    discountPercent,
    discountAmount,
    maxUses ?? null,
    expiresAt ?? null
  );

  try {
    const [promo] = await db.insert(promoCodesTable).values({
      code: codeStr,
      description: description?.trim() ?? null,
      discountPercent,
      discountAmount,
      maxUses: maxUses || null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      active: true,
      plan: (plan === "monthly" || plan === "yearly") ? plan : "both",
      stripeCouponId: stripeResult?.stripeCouponId ?? null,
      stripePromotionCodeId: stripeResult?.stripePromotionCodeId ?? null,
    }).returning();

    return NextResponse.json({ code: promo });
  } catch (err) {
    console.error("[promo-codes] DB insert failed:", err);
    const msg = err instanceof Error ? err.message : "Database error";
    // Surface a clear message — most likely the plan column doesn't exist yet
    if (msg.includes("plan") || msg.includes("column")) {
      return NextResponse.json(
        { error: "DB schema out of date — run: npx drizzle-kit push" },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
