export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { isAdmin } from "@/lib/is-admin";
import { db } from "@/db/db";
import {
  challengeSubmissionsTable,
  type ChallengeEmailLogEntry,
  type ChallengeSubmissionStatus,
} from "@/db/schema/challenge-submissions-schema";
import { eq } from "drizzle-orm";
import {
  buildChallengePublicEligibleEmail,
  buildChallengeAnonymousEligibleEmail,
  buildChallengeMoreInfoRequiredEmail,
  buildChallengeIneligibleEmail,
} from "@/lib/challenge-emails";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = "Content Flywheel <hello@contentflywheel.co.uk>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://contentflywheel.co.uk";

// ── Store link domain validation ─────────────────────────────────────────
// The public challenge CTA must always point at a Content Flywheel product
// page — never an external storefront. Known external platforms are listed
// explicitly so the error is specific; anything else is checked against the
// app's own hostname.
const EXTERNAL_STOREFRONT_HOSTS = [
  "gumroad.com", "etsy.com", "stan.store", "beacons.ai", "shopify.com",
  "myshopify.com", "payhip.com", "amazon.com", "amazon.co.uk", "sellfy.com",
  "podia.com", "ko-fi.com", "linktr.ee",
];
const STORE_LINK_ERROR = "Please enter the Content Flywheel product-page link for the submitted product.";

function isContentFlywheelUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;

  const host = u.hostname.toLowerCase();
  if (EXTERNAL_STOREFRONT_HOSTS.some((bad) => host === bad || host.endsWith(`.${bad}`))) return false;

  let appHost: string;
  try {
    appHost = new URL(APP_URL).hostname.toLowerCase();
  } catch {
    appHost = "contentflywheel.co.uk";
  }
  return host === appHost || host.endsWith(`.${appHost}`);
}

const VALID_STATUSES = new Set<ChallengeSubmissionStatus>([
  "new", "under_review", "more_info_required", "ineligible",
  "eligible_awaiting_store_link", "eligible_anonymous", "store_link_received",
  "store_link_verified", "ready_for_production", "part1_in_production",
  "part1_published", "part2_in_production", "part2_published", "completed",
]);

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  const [row] = await db.select().from(challengeSubmissionsTable).where(eq(challengeSubmissionsTable.id, id)).limit(1);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

type Action =
  | { type: "set-status"; status: ChallengeSubmissionStatus }
  | { type: "reject"; reason: string }
  | { type: "mark-eligible" }
  | { type: "request-more-info"; message: string }
  | { type: "add-note"; note: string }
  | { type: "record-store-link"; storeUrl: string }
  | { type: "verify-store-link"; verified: boolean }
  | { type: "update-checklist"; checklist: "readiness" | "anonymity"; itemId: string; checked: boolean }
  | { type: "record-episode"; episodeNumber: number | null }
  | { type: "record-parts"; part1Url: string | null; part2Url: string | null }
  | { type: "mark-ready-for-production" }
  | { type: "mark-published"; part: 1 | 2 }
  | { type: "log-email"; entry: ChallengeEmailLogEntry };

const PUBLIC_READINESS_ITEMS = [
  "eligibility_approved", "ownership_permission_confirmed", "public_publishing_permission_confirmed",
  "store_link_received", "store_link_verified", "product_page_publicly_accessible", "product_name_confirmed",
  "product_cover_confirmed", "creator_display_name_confirmed", "social_username_confirmed_or_omitted",
  "cta_confirmed", "uploaded_product_reviewed", "restricted_information_reviewed",
];
const ANONYMOUS_READINESS_ITEMS = [
  "eligibility_approved", "ownership_permission_confirmed", "anonymous_consent_confirmed",
  "restricted_information_reviewed", "creator_identity_marked_for_removal", "product_identity_marked_for_removal",
  "product_cover_reviewed", "screenshots_reviewed", "names_and_usernames_identified", "logos_identified",
  "urls_identified", "qr_codes_identified", "personal_details_identified", "customer_information_identified",
  "public_safe_assets_prepared",
];
const FINAL_ANONYMITY_ITEMS = [
  "creator_identity_removed", "business_identity_removed", "product_name_removed_where_required",
  "social_usernames_removed", "store_links_removed", "external_links_removed", "logos_removed_or_blurred",
  "screenshots_checked", "qr_codes_removed", "personal_information_removed", "final_asset_reviewed",
];

type SubmissionRow = typeof challengeSubmissionsTable.$inferSelect;

/**
 * Shared guard for entering "ready_for_production" — used by both the
 * dedicated mark-ready-for-production action AND set-status, so an admin
 * can't bypass the checklist/store-link requirement by picking the status
 * directly from the dropdown instead of clicking the guarded button.
 */
function checkReadyForProduction(row: SubmissionRow): string | null {
  const requiredItems = row.featureType === "public" ? PUBLIC_READINESS_ITEMS : ANONYMOUS_READINESS_ITEMS;
  const checklist = (row.readinessChecklist ?? {}) as Record<string, boolean>;
  const missing = requiredItems.filter((item) => !checklist[item]);
  if (missing.length > 0) return `Readiness checklist incomplete: ${missing.join(", ")}`;
  if (row.featureType === "public" && !row.storeLinkVerified) {
    return "A public submission cannot become ready for production without a verified Content Flywheel Store link.";
  }
  return null;
}

/** Shared guard for marking Part 1/Part 2 published — same bypass concern as above. */
function checkPublishReady(row: SubmissionRow): string | null {
  if (row.featureType !== "anonymous") return null;
  const anonChecklist = (row.anonymityChecklist ?? {}) as Record<string, boolean>;
  const missing = FINAL_ANONYMITY_ITEMS.filter((item) => !anonChecklist[item]);
  if (missing.length > 0) return `Final anonymity checklist incomplete: ${missing.join(", ")}`;
  return null;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  const [row] = await db.select().from(challengeSubmissionsTable).where(eq(challengeSubmissionsTable.id, id)).limit(1);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const action = (await request.json().catch(() => null)) as Action | null;
  if (!action || typeof action.type !== "string") {
    return NextResponse.json({ error: "Missing action" }, { status: 400 });
  }

  const updates: Partial<typeof challengeSubmissionsTable.$inferInsert> = { updatedAt: new Date() };

  switch (action.type) {
    case "set-status": {
      if (!VALID_STATUSES.has(action.status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      // Guard the same transitions the dedicated actions guard, so picking a
      // status from the dropdown can't bypass the store-link / checklist rules.
      if (action.status === "ready_for_production") {
        const err = checkReadyForProduction(row);
        if (err) return NextResponse.json({ error: err }, { status: 400 });
      }
      if (action.status === "part1_published" || action.status === "part2_published") {
        const err = checkPublishReady(row);
        if (err) return NextResponse.json({ error: err }, { status: 400 });
      }
      if (action.status === "store_link_received" || action.status === "store_link_verified") {
        if (row.featureType !== "public") {
          return NextResponse.json({ error: "Anonymous submissions do not use a store link." }, { status: 400 });
        }
      }
      updates.status = action.status;
      break;
    }
    case "reject": {
      const reason = (action.reason ?? "").trim().slice(0, 1000) || "Did not meet challenge requirements.";
      updates.status = "ineligible";
      updates.ineligibilityReason = reason;

      try {
        const firstName = row.fullName.split(/\s+/)[0] || row.fullName;
        const { subject, html } = buildChallengeIneligibleEmail({ firstName, productName: row.productName, reference: row.reference, reason });
        const sendResult = await resend.emails.send({ from: FROM, to: row.email, subject, html });
        const entry: ChallengeEmailLogEntry = { type: "ineligible", sentAt: new Date().toISOString(), resendMessageId: sendResult.data?.id ?? null };
        updates.emailHistory = [...(row.emailHistory ?? []), entry];
      } catch (emailErr) {
        console.error("[admin/challenge-submissions] ineligible email failed:", emailErr);
      }
      break;
    }
    case "request-more-info": {
      const message = (action.message ?? "").trim().slice(0, 2000);
      if (!message) return NextResponse.json({ error: "A message is required." }, { status: 400 });
      updates.status = "more_info_required";

      try {
        const firstName = row.fullName.split(/\s+/)[0] || row.fullName;
        const { subject, html } = buildChallengeMoreInfoRequiredEmail({ firstName, productName: row.productName, reference: row.reference, message });
        const sendResult = await resend.emails.send({ from: FROM, to: row.email, subject, html });
        const entry: ChallengeEmailLogEntry = { type: "more_info_required", sentAt: new Date().toISOString(), resendMessageId: sendResult.data?.id ?? null };
        updates.emailHistory = [...(row.emailHistory ?? []), entry];
      } catch (emailErr) {
        console.error("[admin/challenge-submissions] more-info email failed:", emailErr);
      }
      break;
    }
    case "mark-eligible": {
      const isPublic = row.featureType === "public";
      updates.status = isPublic ? "eligible_awaiting_store_link" : "eligible_anonymous";

      try {
        const firstName = row.fullName.split(/\s+/)[0] || row.fullName;
        const { subject, html } = isPublic
          ? buildChallengePublicEligibleEmail({ firstName, productName: row.productName, reference: row.reference, storeUrl: `${APP_URL}/dashboard/store` })
          : buildChallengeAnonymousEligibleEmail({ firstName, productName: row.productName, reference: row.reference });
        const sendResult = await resend.emails.send({ from: FROM, to: row.email, subject, html });

        const entry: ChallengeEmailLogEntry = {
          type: isPublic ? "eligible_public" : "eligible_anonymous",
          sentAt: new Date().toISOString(),
          resendMessageId: sendResult.data?.id ?? null,
        };
        updates.emailHistory = [...(row.emailHistory ?? []), entry];
      } catch (emailErr) {
        console.error("[admin/challenge-submissions] eligible email failed:", emailErr);
      }
      break;
    }
    case "add-note": {
      updates.adminNotes = (action.note ?? "").slice(0, 5000);
      break;
    }
    case "record-store-link": {
      if (row.featureType !== "public") {
        return NextResponse.json({ error: "Anonymous submissions do not use a store link." }, { status: 400 });
      }
      const url = (action.storeUrl ?? "").trim();
      if (!isContentFlywheelUrl(url)) {
        return NextResponse.json({ error: STORE_LINK_ERROR }, { status: 400 });
      }
      updates.storeUrl = url;
      updates.storeLinkVerified = false;
      updates.storeLinkReceivedAt = new Date();
      updates.status = "store_link_received";
      break;
    }
    case "verify-store-link": {
      if (row.featureType !== "public") {
        return NextResponse.json({ error: "Anonymous submissions do not use a store link." }, { status: 400 });
      }
      if (action.verified && (!row.storeUrl || !isContentFlywheelUrl(row.storeUrl))) {
        return NextResponse.json({ error: STORE_LINK_ERROR }, { status: 400 });
      }
      updates.storeLinkVerified = action.verified === true;
      if (action.verified) updates.status = "store_link_verified";
      break;
    }
    case "update-checklist": {
      const field = action.checklist === "anonymity" ? "anonymityChecklist" : "readinessChecklist";
      const current = (row[field] ?? {}) as Record<string, boolean>;
      updates[field] = { ...current, [action.itemId]: action.checked };
      break;
    }
    case "record-episode": {
      updates.episodeNumber = action.episodeNumber;
      break;
    }
    case "record-parts": {
      if (action.part1Url !== undefined) updates.part1Url = action.part1Url;
      if (action.part2Url !== undefined) updates.part2Url = action.part2Url;
      break;
    }
    case "mark-ready-for-production": {
      const err = checkReadyForProduction(row);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
      updates.status = "ready_for_production";
      break;
    }
    case "mark-published": {
      const err = checkPublishReady(row);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
      updates.status = action.part === 1 ? "part1_published" : "part2_published";
      break;
    }
    case "log-email": {
      updates.emailHistory = [...(row.emailHistory ?? []), action.entry];
      break;
    }
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const [updated] = await db
    .update(challengeSubmissionsTable)
    .set(updates)
    .where(eq(challengeSubmissionsTable.id, id))
    .returning();

  return NextResponse.json(updated);
}
