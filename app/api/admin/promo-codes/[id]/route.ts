import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/is-admin";
import { db } from "@/db/db";
import { promoCodesTable } from "@/db/schema/promo-codes-schema";
import { eq } from "drizzle-orm";
import { stripe } from "@/lib/stripe";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();

  // Fetch current record so we can sync with Stripe
  const [existing] = await db.select().from(promoCodesTable).where(eq(promoCodesTable.id, params.id));

  // Sync active state with Stripe promotion code
  if (typeof body.active === "boolean" && existing?.stripePromotionCodeId) {
    try {
      await stripe.promotionCodes.update(existing.stripePromotionCodeId, { active: body.active });
    } catch (err) {
      console.error("Stripe promotion code update failed:", err);
    }
  }

  const [updated] = await db
    .update(promoCodesTable)
    .set(body)
    .where(eq(promoCodesTable.id, params.id))
    .returning();

  return NextResponse.json({ code: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Fetch first to get Stripe IDs
  const [existing] = await db.select().from(promoCodesTable).where(eq(promoCodesTable.id, params.id));

  // Deactivate promotion code in Stripe (can't delete if ever used)
  if (existing?.stripePromotionCodeId) {
    try {
      await stripe.promotionCodes.update(existing.stripePromotionCodeId, { active: false });
    } catch (err) {
      console.error("Stripe promotion code deactivation failed:", err);
    }
  }

  await db.delete(promoCodesTable).where(eq(promoCodesTable.id, params.id));
  return NextResponse.json({ success: true });
}
