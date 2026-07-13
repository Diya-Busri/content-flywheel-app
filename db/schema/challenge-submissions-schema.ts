import { pgTable, text, timestamp, uuid, jsonb, boolean, integer } from "drizzle-orm/pg-core";

/**
 * 100 Product Challenge — public submission system.
 *
 * Not a competition: every eligible submission enters the production queue.
 * `status` is the single source of truth for where a submission sits in the
 * lifecycle (see STATUS values below) — intentionally one field rather than
 * splitting "eligibility status" / "production status", to match how the
 * admin dashboard presents it as one linear list of states.
 *
 * No userId is required to submit — this is a public, no-account-needed form.
 * `linkedUserId` / `linkedStoreProductId` let an admin (or a future automated
 * match) associate a submission with a real Content Flywheel account/product
 * later, without altering or duplicating the original submission record.
 */

export type ChallengeSubmissionStatus =
  | "new"
  | "under_review"
  | "more_info_required"
  | "ineligible"
  | "eligible_awaiting_store_link"
  | "eligible_anonymous"
  | "store_link_received"
  | "store_link_verified"
  | "ready_for_production"
  | "part1_in_production"
  | "part1_published"
  | "part2_in_production"
  | "part2_published"
  | "completed";

export type ChallengeFeatureType = "public" | "anonymous";

export type ChallengeUploadedFile = {
  key: string;
  originalName: string;
  size: number;
  type: string;
  uploadedAt: string;
};

export type ChallengeEmailLogEntry = {
  type: "confirmation" | "eligible_public" | "eligible_anonymous" | "more_info_required" | "ineligible" | "other";
  sentAt: string;
  resendMessageId?: string | null;
  status?: string;
};

export const challengeSubmissionsTable = pgTable("challenge_submissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** Human-facing unique reference, e.g. "CF-1042". */
  reference: text("reference").notNull(),

  // ── About you ────────────────────────────────────────────────────────────
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  creatorOrBusinessName: text("creator_or_business_name"),
  socialUsername: text("social_username"),
  /** "tiktok" | "instagram" | "youtube" | "x" | "linkedin" | "other" | "none" */
  primarySocialPlatform: text("primary_social_platform"),

  // ── Product details ──────────────────────────────────────────────────────
  productName: text("product_name").notNull(),
  productType: text("product_type").notNull(),
  productDescription: text("product_description").notNull(),
  targetAudience: text("target_audience").notNull(),
  problemSolved: text("problem_solved").notNull(),
  productPrice: text("product_price").notNull(),
  /** "finished_not_launched" | "launched_no_sales" | "some_sales" | "selling_consistently" */
  productStatus: text("product_status").notNull(),
  existingProductUrl: text("existing_product_url"),
  whatMakesUseful: text("what_makes_useful").notNull(),
  whatToImprove: text("what_to_improve").notNull(),

  // ── Marketing questions ──────────────────────────────────────────────────
  marketingStruggles: jsonb("marketing_struggles").$type<string[]>().notNull().default([]),
  marketingTried: text("marketing_tried"),
  whatStoppingSales: text("what_stopping_sales"),
  focusRequest: text("focus_request"),
  doNotSayOrShow: text("do_not_say_or_show"),

  // ── Public / anonymous choice ────────────────────────────────────────────
  featureType: text("feature_type").$type<ChallengeFeatureType>().notNull(),
  anonymousConsent: boolean("anonymous_consent").notNull().default(false),

  // ── Permissions & consent (section 8) ────────────────────────────────────
  ownershipConfirmed: boolean("ownership_confirmed").notNull().default(false),
  reviewPermissionConfirmed: boolean("review_permission_confirmed").notNull().default(false),
  queueUnderstandingConfirmed: boolean("queue_understanding_confirmed").notNull().default(false),
  publicationOrderConfirmed: boolean("publication_order_confirmed").notNull().default(false),
  rejectionRiskAcknowledged: boolean("rejection_risk_acknowledged").notNull().default(false),
  termsAgreed: boolean("terms_agreed").notNull().default(false),
  /** Public-only: permission to publicly display product/creator/store listing. */
  publicDisplayConsent: boolean("public_display_consent"),
  /** Public-only: acknowledges a Store link is required before production. */
  storeLinkObligationAck: boolean("store_link_obligation_ack"),
  /** Anonymous-only: understands no public purchase/discovery link will exist. */
  anonymousNoLinkAck: boolean("anonymous_no_link_ack"),
  /** Anonymous-only: understands identifying info will be removed/blurred. */
  anonymousBlurAck: boolean("anonymous_blur_ack"),
  marketingOptIn: boolean("marketing_opt_in").notNull().default(false),

  // ── Uploads ──────────────────────────────────────────────────────────────
  /** Private R2 object keys only — never public URLs. See lib/storage.ts uploadPrivate(). */
  uploadedFiles: jsonb("uploaded_files").$type<ChallengeUploadedFile[]>().notNull().default([]),

  // ── Admin workflow ───────────────────────────────────────────────────────
  status: text("status").$type<ChallengeSubmissionStatus>().notNull().default("new"),
  ineligibilityReason: text("ineligibility_reason"),
  adminNotes: text("admin_notes"),

  // ── Store link (public submissions) ─────────────────────────────────────
  storeUrl: text("store_url"),
  storeLinkVerified: boolean("store_link_verified").notNull().default(false),
  storeLinkReceivedAt: timestamp("store_link_received_at"),

  // ── Readiness checklists — keyed by checklist item id → boolean ─────────
  /** Public or anonymous "ready for production" checklist (sections 14/15). */
  readinessChecklist: jsonb("readiness_checklist").$type<Record<string, boolean>>().notNull().default({}),
  /** Anonymous-only final pre-publish anonymity checklist (section 15, second list). */
  anonymityChecklist: jsonb("anonymity_checklist").$type<Record<string, boolean>>().notNull().default({}),

  // ── Email tracking ───────────────────────────────────────────────────────
  emailHistory: jsonb("email_history").$type<ChallengeEmailLogEntry[]>().notNull().default([]),
  /** Reply-association token — included in outbound subjects; preserved if inbound email threading is added later. */
  emailThreadId: text("email_thread_id"),

  // ── Production ────────────────────────────────────────────────────────────
  episodeNumber: integer("episode_number"),
  part1Url: text("part1_url"),
  part2Url: text("part2_url"),

  // ── Later account association (does not duplicate the submission) ───────
  linkedUserId: text("linked_user_id"),
  linkedStoreProductId: uuid("linked_store_product_id"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
