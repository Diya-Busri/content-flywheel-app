import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { db } from "@/db/db";
import { challengeSubmissionsTable, type ChallengeUploadedFile } from "@/db/schema/challenge-submissions-schema";
import { generateChallengeReference } from "@/lib/challenge-reference";
import { buildChallengeConfirmationEmail } from "@/lib/challenge-emails";
import { checkApiRateLimit, getClientIp } from "@/lib/rate-limit-api";
import { and, eq, gt } from "drizzle-orm";

export const dynamic = "force-dynamic";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = "Content Flywheel <hello@contentflywheel.co.uk>";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SOCIAL_PLATFORMS = new Set(["tiktok", "instagram", "youtube", "x", "linkedin", "other", "none"]);
const PRODUCT_TYPES = new Set([
  "ebook", "workbook", "template", "planner", "course", "membership", "digital_download", "software_app", "other",
]);
const PRODUCT_STATUSES = new Set([
  "finished_not_launched", "launched_no_sales", "some_sales", "selling_consistently",
]);
const MARKETING_STRUGGLES = new Set([
  "positioning", "understanding_audience", "content_ideas", "writing_hooks", "short_form_videos",
  "carousels", "launch_strategy", "getting_traffic", "turning_views_into_sales", "product_messaging",
  "product_page", "other",
]);

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}
function optStr(v: unknown, max: number): string | null {
  const s = str(v, max);
  return s.length > 0 ? s : null;
}
function isValidUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const limited = await checkApiRateLimit(ip);
    if (limited) return limited;

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    // ── Honeypot — bots fill hidden fields humans never see ────────────────
    // Quietly pretend success without persisting anything or sending email.
    if (typeof body.website === "string" && body.website.trim().length > 0) {
      return NextResponse.json({ reference: "CF-0000", id: "honeypot", spam: true });
    }

    // ── About you ────────────────────────────────────────────────────────
    const fullName = str(body.fullName, 200);
    const email = str(body.email, 320).toLowerCase();
    const creatorOrBusinessName = optStr(body.creatorOrBusinessName, 200);
    const socialUsername = optStr(body.socialUsername, 100);
    const primarySocialPlatformRaw = str(body.primarySocialPlatform, 20);
    const primarySocialPlatform = SOCIAL_PLATFORMS.has(primarySocialPlatformRaw) ? primarySocialPlatformRaw : null;

    // ── Product details ─────────────────────────────────────────────────
    const productName = str(body.productName, 200);
    const productType = str(body.productType, 30);
    const productDescription = str(body.productDescription, 4000);
    const targetAudience = str(body.targetAudience, 1000);
    const problemSolved = str(body.problemSolved, 1000);
    const productPrice = str(body.productPrice, 50);
    const productStatus = str(body.productStatus, 40);
    const existingProductUrl = optStr(body.existingProductUrl, 500);
    const whatMakesUseful = str(body.whatMakesUseful, 2000);
    const whatToImprove = str(body.whatToImprove, 2000);

    // ── Marketing questions ─────────────────────────────────────────────
    const marketingStrugglesRaw = Array.isArray(body.marketingStruggles) ? body.marketingStruggles : [];
    const marketingStruggles = marketingStrugglesRaw
      .filter((v): v is string => typeof v === "string" && MARKETING_STRUGGLES.has(v))
      .slice(0, 20);
    const marketingTried = optStr(body.marketingTried, 2000);
    const whatStoppingSales = optStr(body.whatStoppingSales, 2000);
    const focusRequest = optStr(body.focusRequest, 2000);
    const doNotSayOrShow = optStr(body.doNotSayOrShow, 2000);

    // ── Public / anonymous choice ───────────────────────────────────────
    const featureType = body.featureType === "anonymous" ? "anonymous" : body.featureType === "public" ? "public" : null;
    const anonymousConsent = body.anonymousConsent === true;

    // ── Permissions ──────────────────────────────────────────────────────
    const ownershipConfirmed = body.ownershipConfirmed === true;
    const reviewPermissionConfirmed = body.reviewPermissionConfirmed === true;
    const queueUnderstandingConfirmed = body.queueUnderstandingConfirmed === true;
    const publicationOrderConfirmed = body.publicationOrderConfirmed === true;
    const rejectionRiskAcknowledged = body.rejectionRiskAcknowledged === true;
    const termsAgreed = body.termsAgreed === true;
    const publicDisplayConsent = body.publicDisplayConsent === true;
    const storeLinkObligationAck = body.storeLinkObligationAck === true;
    const anonymousNoLinkAck = body.anonymousNoLinkAck === true;
    const anonymousBlurAck = body.anonymousBlurAck === true;
    const marketingOptIn = body.marketingOptIn === true;

    // ── Uploads ──────────────────────────────────────────────────────────
    const uploadedFilesRaw = Array.isArray(body.uploadedFiles) ? body.uploadedFiles : [];
    const uploadedFiles: ChallengeUploadedFile[] = uploadedFilesRaw
      .filter(
        (f): f is ChallengeUploadedFile =>
          !!f &&
          typeof f === "object" &&
          typeof (f as ChallengeUploadedFile).key === "string" &&
          (f as ChallengeUploadedFile).key.startsWith("private/challenge/") &&
          typeof (f as ChallengeUploadedFile).originalName === "string"
      )
      .slice(0, 6);

    // ── Server-side validation (source of truth — never trust the client) ─
    const errors: string[] = [];
    if (!fullName) errors.push("Full name is required.");
    if (!email || !EMAIL_RE.test(email)) errors.push("A valid email address is required.");
    if (!productName) errors.push("Product name is required.");
    if (!PRODUCT_TYPES.has(productType)) errors.push("A valid product type is required.");
    if (!productDescription) errors.push("Product description is required.");
    if (!targetAudience) errors.push("Target audience is required.");
    if (!problemSolved) errors.push("Please describe the problem the product solves.");
    if (!productPrice) errors.push("Product price is required.");
    if (!PRODUCT_STATUSES.has(productStatus)) errors.push("A valid product status is required.");
    if (existingProductUrl && !isValidUrl(existingProductUrl)) errors.push("The product/website link is not a valid URL.");
    if (!whatMakesUseful) errors.push("Please describe what makes the product useful or different.");
    if (!whatToImprove) errors.push("Please describe what you'd like improved.");
    if (marketingStruggles.length === 0) errors.push("Select at least one marketing challenge.");
    if (!featureType) errors.push("Choose a public or anonymous feature.");
    if (featureType === "anonymous" && !anonymousConsent) errors.push("Anonymous consent is required for anonymous submissions.");
    if (uploadedFiles.length === 0) errors.push("Please upload at least one file for review.");

    if (!ownershipConfirmed) errors.push("You must confirm you own this product or have permission to submit it.");
    if (!reviewPermissionConfirmed) errors.push("You must give permission to review and create marketing content.");
    if (!queueUnderstandingConfirmed) errors.push("You must acknowledge the production queue explanation.");
    if (!publicationOrderConfirmed) errors.push("You must acknowledge publication order may differ from submission order.");
    if (!rejectionRiskAcknowledged) errors.push("You must acknowledge the rejection criteria.");
    if (!termsAgreed) errors.push("You must agree to the Privacy Policy and Terms.");

    if (featureType === "public") {
      if (!publicDisplayConsent) errors.push("Public submissions require permission to display your product and creator details.");
      if (!storeLinkObligationAck) errors.push("Public submissions require acknowledging the Content Flywheel Store link requirement.");
    }
    if (featureType === "anonymous") {
      if (!anonymousNoLinkAck) errors.push("Anonymous submissions require acknowledging there will be no public purchase link.");
      if (!anonymousBlurAck) errors.push("Anonymous submissions require acknowledging identifying details will be removed or blurred.");
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: errors[0], errors }, { status: 400 });
    }

    // ── Duplicate submission protection — same email + product within 5 min ─
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const [dup] = await db
      .select({ id: challengeSubmissionsTable.id, reference: challengeSubmissionsTable.reference })
      .from(challengeSubmissionsTable)
      .where(
        and(
          eq(challengeSubmissionsTable.email, email),
          eq(challengeSubmissionsTable.productName, productName),
          gt(challengeSubmissionsTable.createdAt, fiveMinAgo)
        )
      )
      .limit(1);

    if (dup) {
      return NextResponse.json({ reference: dup.reference, id: dup.id, duplicate: true });
    }

    const reference = await generateChallengeReference();
    const firstName = fullName.split(/\s+/)[0] || fullName;
    // errors.length === 0 at this point guarantees featureType was set (validated above).
    const confirmedFeatureType = featureType as "public" | "anonymous";

    const [inserted] = await db
      .insert(challengeSubmissionsTable)
      .values({
        reference,
        fullName,
        email,
        creatorOrBusinessName,
        socialUsername,
        primarySocialPlatform,
        productName,
        productType,
        productDescription,
        targetAudience,
        problemSolved,
        productPrice,
        productStatus,
        existingProductUrl,
        whatMakesUseful,
        whatToImprove,
        marketingStruggles,
        marketingTried,
        whatStoppingSales,
        focusRequest,
        doNotSayOrShow,
        featureType: confirmedFeatureType,
        anonymousConsent,
        ownershipConfirmed,
        reviewPermissionConfirmed,
        queueUnderstandingConfirmed,
        publicationOrderConfirmed,
        rejectionRiskAcknowledged,
        termsAgreed,
        publicDisplayConsent: featureType === "public" ? publicDisplayConsent : null,
        storeLinkObligationAck: featureType === "public" ? storeLinkObligationAck : null,
        anonymousNoLinkAck: featureType === "anonymous" ? anonymousNoLinkAck : null,
        anonymousBlurAck: featureType === "anonymous" ? anonymousBlurAck : null,
        marketingOptIn,
        uploadedFiles,
        status: "new",
      })
      .returning({ id: challengeSubmissionsTable.id });

    // Send confirmation email — best-effort, don't fail the request if it errors.
    try {
      const { subject, html } = buildChallengeConfirmationEmail({ firstName, productName, reference, featureType: confirmedFeatureType });
      const sendResult = await resend.emails.send({ from: FROM, to: email, subject, html });
      await db
        .update(challengeSubmissionsTable)
        .set({
          emailHistory: [
            {
              type: "confirmation",
              sentAt: new Date().toISOString(),
              resendMessageId: sendResult.data?.id ?? null,
            },
          ],
          updatedAt: new Date(),
        })
        .where(eq(challengeSubmissionsTable.id, inserted.id));
    } catch (emailErr) {
      console.error("[challenge/submit] confirmation email failed:", emailErr);
    }

    return NextResponse.json({ reference, id: inserted.id });
  } catch (err) {
    console.error("[challenge/submit] POST error:", err);
    return NextResponse.json({ error: "Failed to submit. Please try again." }, { status: 500 });
  }
}
