/**
 * lib/launch-validator.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Pure-function asset validators for each pipeline stage.
 *
 * Philosophy: Generate → Validate → Fix if needed → Complete ✅
 *
 * Each validator inspects the stage's persisted stageResults and returns a
 * StageValidation object with per-check pass/fail/warn + an overall status.
 *
 * Rules:
 *   • "required" checks must ALL pass for status = "validated"
 *   • If any required check fails → status = "needs_attention"
 *   • If the stage data object itself is null → status = "failed"
 *   • Warnings on non-required checks are surfaced but don't block completion
 *
 * These run client-side (in agent files, after saveProgress).
 * No server imports — pure TypeScript only.
 */

import type { AssetCheck, StageValidation, LaunchStageResults } from "@/db/schema/launch-schema";

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function buildValidation(checks: AssetCheck[]): StageValidation {
  const passedCount    = checks.filter(c => c.status === "pass").length;
  const totalCount     = checks.length;
  const required       = checks.filter(c => c.required);
  const requiredPass   = required.filter(c => c.status === "pass").length;
  const requiredTotal  = required.length;
  const allRequiredOk  = requiredPass === requiredTotal;

  return {
    status:        allRequiredOk ? "validated" : "needs_attention",
    passedCount,
    totalCount,
    requiredPass,
    requiredTotal,
    checks,
    validatedAt:   new Date().toISOString(),
  };
}

function check(
  id:       string,
  label:    string,
  required: boolean,
  passed:   boolean,
  reason?:  string,
): AssetCheck {
  return {
    id,
    label,
    required,
    status: passed ? "pass" : required ? "fail" : "warn",
    reason: passed ? undefined : reason,
  };
}

/* ─── Research validator ──────────────────────────────────────────────────── */

export function validateResearch(
  r: NonNullable<LaunchStageResults["research"]>,
): StageValidation {
  const checks: AssetCheck[] = [
    check(
      "insights",
      "Market insights generated",
      true,
      (r.insights?.length ?? 0) >= 3,
      `Only ${r.insights?.length ?? 0} insights found — need at least 3`,
    ),
    check(
      "full-report",
      "Full research report synthesised",
      true,
      !!r.fullReport && Object.keys(r.fullReport).length > 0,
      "fullReport is empty or missing — AI synthesis did not complete",
    ),
    check(
      "opportunities",
      "Product opportunities identified",
      true,
      (r.productOpportunities?.length ?? 0) >= 1,
      "No product opportunities found — research may have been too broad",
    ),
    check(
      "keywords",
      "SEO keywords identified",
      false,
      (r.keywords?.length ?? 0) >= 3,
      `Only ${r.keywords?.length ?? 0} keywords found`,
    ),
    check(
      "competitors",
      "Competitor landscape profiled",
      false,
      (r.competitorInsights?.length ?? 0) >= 1,
      "No competitors profiled",
    ),
    check(
      "action-plan",
      "Action plan generated",
      false,
      (r.actionPlan?.length ?? 0) >= 1,
      "No action plan steps generated",
    ),
  ];

  return buildValidation(checks);
}

/* ─── Product validator ──────────────────────────────────────────────────── */

export function validateProduct(
  p: NonNullable<LaunchStageResults["product"]>,
): StageValidation {
  const total      = p.totalSections     ?? 0;
  // Legacy compat: if sectionsGenerated not tracked, assume all succeeded
  const generated  = p.sectionsGenerated ?? (total > 0 ? total : 0);
  const empty      = p.emptySections     ?? 0;
  // Legacy compat: if savedToDb not tracked, assume true
  const saved      = p.savedToDb         ?? true;

  const allGenerated      = total === 0 || generated >= total;
  const noEmptySections   = empty === 0;
  const highCompletionRate = total === 0 || (generated / total) >= 0.8;
  const pct = total > 0 ? Math.round((generated / total) * 100) : 100;

  const checks: AssetCheck[] = [
    check(
      "product-id",
      "Product created in library",
      true,
      !!p.productId && p.productId.length > 0,
      "productId is missing — product was not saved to the database",
    ),
    check(
      "product-name",
      "Product name generated",
      true,
      !!p.productName && p.productName.length > 0,
      "productName is empty — AI did not return a product title",
    ),
    check(
      "sections-complete",
      `All sections generated (${generated}/${total > 0 ? total : "?"})`,
      true,
      allGenerated,
      `Only ${generated} of ${total} sections generated — ${total - generated} failed or timed out`,
    ),
    check(
      "no-empty-sections",
      "All sections have content",
      true,
      noEmptySections,
      `${empty} section${empty !== 1 ? "s" : ""} have empty body text — retry to fill missing content`,
    ),
    check(
      "saved-to-db",
      "Product saved to database",
      true,
      saved,
      "Database insert failed — the product may not have persisted correctly",
    ),
    check(
      "completion-rate",
      `Content completion ≥80% (currently ${pct}%)`,
      false,
      highCompletionRate,
      `Only ${pct}% of sections completed — some content may be missing`,
    ),
  ];

  return buildValidation(checks);
}

/* ─── Design validator ───────────────────────────────────────────────────── */

export function validateDesign(
  d: NonNullable<LaunchStageResults["design"]>,
): StageValidation {
  const hasConcept  = (d.concepts?.length ?? 0) >= 1;
  const hasEditConcept = (d.concepts ?? []).some(c => !!c.designId);
  const hasThumbnail = !!d.thumbnailDesignId || !!d.thumbnailUrl;
  const hasMockup    = !!d.mockupUrl;
  const hasSocial    = !!d.socialUrl;
  // Template-based covers have no URL — they're design DB records with designId.
  // Accept any of: a cover URL, a selected concept URL, or at least one editable design record.
  const hasCover     = !!d.coverUrl || !!d.selectedConceptUrl || hasEditConcept;
  const assetCount   = d.assetsCount ?? 0;

  const checks: AssetCheck[] = [
    check(
      "cover-concept",
      "Product cover generated",
      true,
      hasConcept && hasCover,
      "No cover concepts were generated — retry the Design Agent",
    ),
    check(
      "editable-design",
      "Cover is editable in Design Studio",
      true,
      hasEditConcept,
      "Concepts were generated but no designId was saved — cover cannot be edited",
    ),
    check(
      "store-thumbnail",
      "Store thumbnail generated",
      true,
      hasThumbnail,
      "Store thumbnail is missing — this image appears on your store listing",
    ),
    check(
      "mockup",
      "3D mockup generated",
      false,
      hasMockup,
      "3D mockup failed to generate — DALL-E request may have timed out",
    ),
    check(
      "social-preview",
      "Social preview generated",
      false,
      hasSocial,
      "Social preview failed — DALL-E request may have timed out",
    ),
    check(
      "asset-count",
      `Sufficient assets (${assetCount} total)`,
      false,
      assetCount >= 3,
      `Only ${assetCount} asset${assetCount !== 1 ? "s" : ""} generated — expected at least 3`,
    ),
  ];

  return buildValidation(checks);
}

/* ─── Marketing validator ────────────────────────────────────────────────── */

export function validateMarketing(
  m: NonNullable<LaunchStageResults["marketing"]>,
): StageValidation {
  const hasSalesCopy     = !!m.salesCopy?.headline && !!m.salesCopy.body;
  const hasEmails        = (m.emails?.length ?? 0) >= 2;
  const hasSocialContent =
    (m.tiktokHooks?.length  ?? 0) > 0 ||
    (m.xPosts?.length       ?? 0) > 0 ||
    (m.instagramCaptions?.length ?? 0) > 0 ||
    (m.carousels?.length    ?? 0) > 0;
  const hasSeo           = !!m.seoTitle && !!m.seoMetaDesc;
  const hasLaunchCopy    = !!m.launchAnnouncement;
  const emailCount       = m.emails?.length ?? 0;

  const checks: AssetCheck[] = [
    check(
      "sales-copy",
      "Sales copy written (headline + body)",
      true,
      hasSalesCopy,
      "Sales copy is missing headline or body — this is shown on your product page",
    ),
    check(
      "email-sequence",
      `Email sequence (${emailCount} emails)`,
      true,
      hasEmails,
      `Only ${emailCount} email${emailCount !== 1 ? "s" : ""} generated — need at least 2`,
    ),
    check(
      "social-content",
      "Social media content created",
      true,
      hasSocialContent,
      "No social posts, TikTok hooks, or Instagram content generated",
    ),
    check(
      "seo-metadata",
      "SEO metadata written",
      false,
      hasSeo,
      "SEO title and/or meta description missing",
    ),
    check(
      "launch-copy",
      "Launch announcement written",
      false,
      hasLaunchCopy,
      "Launch announcement not generated",
    ),
    check(
      "faq",
      "FAQ generated",
      false,
      (m.faq?.length ?? 0) >= 3,
      `Only ${m.faq?.length ?? 0} FAQ items — aim for at least 3`,
    ),
  ];

  return buildValidation(checks);
}

/* ─── Store validator ────────────────────────────────────────────────────── */

export function validateStore(
  s: NonNullable<LaunchStageResults["store"]>,
): StageValidation {
  const checks = s.validationChecks ?? [];
  const passedChecks   = checks.filter(c => c.status === "ok" || c.status === "fixed").length;
  const readinessScore = s.readinessScore ?? 0;
  const hasProductId   = !!s.productId && s.productId.length > 0;

  const assetChecks: AssetCheck[] = [
    check(
      "product-id",
      "Product attached to store",
      true,
      hasProductId,
      "productId missing — store listing has no product attached",
    ),
    check(
      "readiness-score",
      `Store readiness score (${readinessScore}%)`,
      true,
      readinessScore >= 60,
      `Readiness score is ${readinessScore}% — need at least 60% to launch`,
    ),
    check(
      "validation-checks",
      `Store checks passed (${passedChecks}/${checks.length})`,
      true,
      checks.length === 0 || passedChecks >= Math.ceil(checks.length * 0.6),
      `Only ${passedChecks} of ${checks.length} checks passed`,
    ),
    check(
      "store-url",
      "Store URL assigned",
      false,
      !!s.storeUrl,
      "Store URL not yet set — product may not be visible on store",
    ),
  ];

  return buildValidation(assetChecks);
}

/* ─── Convenience: validate all stages + compute overall pipeline status ── */

export type PipelineValidationStatus = "all_clear" | "needs_attention" | "failed";

export function computePipelineValidationStatus(
  stageResults: LaunchStageResults,
): PipelineValidationStatus {
  const stages = [
    stageResults.research?.validation,
    stageResults.product?.validation,
    stageResults.design?.validation,
    stageResults.marketing?.validation,
    stageResults.store?.validation,
  ].filter(Boolean) as NonNullable<LaunchStageResults["research"]>["validation"][];

  if (stages.some(v => v?.status === "failed"))         return "failed";
  if (stages.some(v => v?.status === "needs_attention")) return "needs_attention";
  return "all_clear";
}

/** Returns a human-readable asset-count string e.g. "✅ 6/6" or "⚠️ 4/6 (2 need attention)" */
export function formatValidationBadge(v: StageValidation | undefined): string {
  if (!v) return "";
  if (v.status === "validated") return `✅ ${v.passedCount}/${v.totalCount}`;
  const failCount = v.totalCount - v.passedCount;
  return `⚠️ ${v.passedCount}/${v.totalCount} (${failCount} failed)`;
}
