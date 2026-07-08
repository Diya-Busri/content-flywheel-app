import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { brandVoiceTable } from "@/db/schema/brand-voice-schema";
import { productOrdersTable } from "@/db/schema/product-orders-schema";
import { creatorPromoCodesTable } from "@/db/schema/creator-promo-codes-schema";
import { emailCampaignsTable } from "@/db/schema/email-marketing-schema";
import { eq, and, isNull, count } from "drizzle-orm";

export const dynamic = "force-dynamic";

export type OnboardingStatus = {
  hasProduct: boolean;
  hasThumbnail: boolean;
  hasPublishedProduct: boolean;
  hasStripeConnect: boolean;
  hasMarketingContent: boolean;
  hasSale: boolean;
  // legacy fields kept for backwards compat
  hasBrandVoice: boolean;
  hasPromoCode: boolean;
  complete: boolean;
  percentComplete: number;
};

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [products, profile, brandVoice, orders, promoCodes, campaigns] = await Promise.all([
    db.select({ id: productsTable.id, marketingAssets: productsTable.marketingAssets })
      .from(productsTable)
      .where(and(eq(productsTable.userId, userId), isNull(productsTable.deletedAt))),
    db.select({
        stripeConnectAccountId:       profilesTable.stripeConnectAccountId,
        stripeConnectChargesEnabled:  profilesTable.stripeConnectChargesEnabled,
        stripeConnectPayoutsEnabled:  profilesTable.stripeConnectPayoutsEnabled,
      })
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
      .from(emailCampaignsTable)
      .where(and(eq(emailCampaignsTable.userId, userId), eq(emailCampaignsTable.status, "sent"))),
  ]);

  const hasProduct = products.length > 0;

  const hasThumbnail = products.some((p) => {
    const ma = (p.marketingAssets ?? {}) as Record<string, unknown>;
    return !!(ma.thumbnailUrl || ma.coverThumbnailUrl);
  });

  const hasPublishedProduct = products.some((p) => {
    const ma = (p.marketingAssets ?? {}) as { isNativePublished?: boolean };
    return ma.isNativePublished === true;
  });

  // chargesEnabled is the authoritative signal for the checklist.
  // payoutsEnabled can lag (defaults to false for users who connected before that column
  // was added). The Payments card in Settings shows the live nuanced status via Stripe API.
  const stripeCharges = profile[0]?.stripeConnectChargesEnabled ?? false;
  const stripePayouts = profile[0]?.stripeConnectPayoutsEnabled ?? false;
  const hasStripeConnect = !!stripeCharges;

  console.log("[onboarding-status] Stripe state:", {
    accountId:      !!(profile[0]?.stripeConnectAccountId),
    chargesEnabled: stripeCharges,
    payoutsEnabled: stripePayouts,
    hasStripeConnect,
  });
  const hasBrandVoice = !!(brandVoice[0]?.brandName?.trim());
  const hasPromoCode = Number(promoCodes[0]?.count ?? 0) > 0;
  const campaignsSent = Number(campaigns[0]?.count ?? 0) > 0;
  const hasMarketingContent = hasPromoCode || campaignsSent;
  const hasSale = Number(orders[0]?.count ?? 0) > 0;

  // 6 DB-tracked steps (research step is localStorage-only, handled client-side)
  const dbSteps = [hasProduct, hasThumbnail, hasPublishedProduct, hasStripeConnect, hasMarketingContent, hasSale];
  const dbDone = dbSteps.filter(Boolean).length;
  // complete = all 7 steps (including research which client tracks)
  const complete = dbDone === dbSteps.length;
  // percentComplete is over 6 DB steps; client will add the research step
  const percentComplete = Math.round((dbDone / dbSteps.length) * 100);

  return NextResponse.json({
    hasProduct,
    hasThumbnail,
    hasPublishedProduct,
    hasStripeConnect,
    hasMarketingContent,
    hasSale,
    hasBrandVoice,
    hasPromoCode,
    complete,
    percentComplete,
  } satisfies OnboardingStatus);
}
