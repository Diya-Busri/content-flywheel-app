import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { brandVoiceTable } from "@/db/schema/brand-voice-schema";
import { productOrdersTable } from "@/db/schema/product-orders-schema";
import { creatorPromoCodesTable } from "@/db/schema/creator-promo-codes-schema";
import { emailSequencesTable } from "@/db/schema/email-sequences-schema";
import { eq, and, isNull, count } from "drizzle-orm";

export const dynamic = "force-dynamic";

export type OnboardingStatus = {
  hasProduct: boolean;
  hasPublishedProduct: boolean;
  hasStripeConnect: boolean;
  hasBrandVoice: boolean;
  hasPromoCode: boolean;
  hasEmailSequence: boolean;
  hasSale: boolean;
  complete: boolean;
  percentComplete: number;
};

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [products, profile, brandVoice, orders, promoCodes, sequences] = await Promise.all([
    db.select({ id: productsTable.id, marketingAssets: productsTable.marketingAssets })
      .from(productsTable)
      .where(and(eq(productsTable.userId, userId), isNull(productsTable.deletedAt))),
    db.select({ stripeConnectChargesEnabled: profilesTable.stripeConnectChargesEnabled })
      .from(profilesTable)
      .where(eq(profilesTable.userId, userId))
      .limit(1),
    db.select({ brandName: brandVoiceTable.brandName })
      .from(brandVoiceTable)
      .where(eq(brandVoiceTable.userId, userId))
      .limit(1),
    db.select({ count: count() })
      .from(productOrdersTable)
      .where(and(eq(productOrdersTable.creatorUserId, userId), eq(productOrdersTable.status, "completed"))),
    db.select({ count: count() })
      .from(creatorPromoCodesTable)
      .where(and(eq(creatorPromoCodesTable.creatorUserId, userId), eq(creatorPromoCodesTable.active, true))),
    db.select({ count: count() })
      .from(emailSequencesTable)
      .where(eq(emailSequencesTable.userId, userId)),
  ]);

  const hasProduct = products.length > 0;
  const hasPublishedProduct = products.some((p) => {
    const ma = (p.marketingAssets ?? {}) as { isNativePublished?: boolean };
    return ma.isNativePublished === true;
  });
  const hasStripeConnect = !!(profile[0]?.stripeConnectChargesEnabled);
  const hasBrandVoice = !!(brandVoice[0]?.brandName?.trim());
  const hasPromoCode = Number(promoCodes[0]?.count ?? 0) > 0;
  const hasEmailSequence = Number(sequences[0]?.count ?? 0) > 0;
  const hasSale = Number(orders[0]?.count ?? 0) > 0;

  const steps = [hasProduct, hasPublishedProduct, hasStripeConnect, hasBrandVoice, hasPromoCode, hasEmailSequence, hasSale];
  const done = steps.filter(Boolean).length;
  const complete = done === steps.length;
  const percentComplete = Math.round((done / steps.length) * 100);

  return NextResponse.json({
    hasProduct,
    hasPublishedProduct,
    hasStripeConnect,
    hasBrandVoice,
    hasPromoCode,
    hasEmailSequence,
    hasSale,
    complete,
    percentComplete,
  } satisfies OnboardingStatus);
}
