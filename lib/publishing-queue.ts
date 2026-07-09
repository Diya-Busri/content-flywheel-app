/**
 * lib/publishing-queue.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * Publishing queue processing, approval logic, and platform dispatchers.
 *
 * Flow per queue item:
 *   queued → (approval) → rendering → uploading → published | failed
 *
 * Approval modes:
 *   manual   — wait for explicit user approval
 *   balanced — auto-approve if confidence >= 0.75, else wait for user
 *   autopilot — always auto-approve immediately
 */

import type {
  PublishQueueItem,
  PublishedItem,
  ApprovalMode,
  MarketingManagerId,
  MemoryFact,
} from "@/db/schema/launch-schema";
import type { SelectConnectedAccount } from "@/db/schema/connected-accounts-schema";

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

function uid() { return Math.random().toString(36).slice(2, 10); }
function now() { return new Date().toISOString(); }

/* ─── Content confidence scoring (for "balanced" mode) ──────────────────────── */

/**
 * Score content quality heuristically — no AI call needed.
 * Returns 0-1 (1 = high confidence, auto-approve).
 */
export function scoreContentConfidence(content: string, outputType: string): number {
  let score = 0.5;

  // Length checks
  if (content.length > 50)  score += 0.1;
  if (content.length > 150) score += 0.1;
  if (content.length < 15)  score -= 0.2;

  // Has a CTA-like phrase
  const ctaPhrases = ["link in bio", "click", "sign up", "get it", "check out", "dm me", "grab yours", "free", "now", "today"];
  if (ctaPhrases.some(p => content.toLowerCase().includes(p))) score += 0.1;

  // Not just questions (low confidence)
  const questionCount = (content.match(/\?/g) ?? []).length;
  if (questionCount > 3) score -= 0.1;

  // Has emojis (engaging for social)
  const emojiRe = /\p{Emoji}/u;
  if (emojiRe.test(content)) score += 0.05;

  // Type-specific bonuses
  if (outputType === "hook" && content.length < 80) score += 0.1;
  if (outputType === "caption" && content.length > 100) score += 0.1;
  if (outputType === "linkedin_post" && content.length > 300) score += 0.15;
  if (outputType === "email" || outputType === "email_subject") score += 0.05;

  return Math.max(0, Math.min(1, score));
}

/* ─── Should auto-approve? ───────────────────────────────────────────────────── */

export function shouldAutoApprove(
  content: string,
  outputType: string,
  approvalMode: ApprovalMode,
): boolean {
  if (approvalMode === "autopilot") return true;
  if (approvalMode === "manual")    return false;
  // balanced: auto-approve if confidence >= 0.75
  return scoreContentConfidence(content, outputType) >= 0.75;
}

/* ─── Platform publisher type ────────────────────────────────────────────────── */

export type PublishResult = {
  success:       boolean;
  publishedUrl?: string;
  errorMessage?: string;
  simulated?:    boolean; // true = no real API call was made
};

/* ─── Email publisher (Resend) ───────────────────────────────────────────────── */

async function publishViaEmail(
  content: string,
  connection: SelectConnectedAccount,
): Promise<PublishResult> {
  const apiKey   = connection.accessToken;
  const fromAddr = connection.platformUsername ?? "noreply@contentflywheel.com";
  const toAddr   = connection.scopes ?? ""; // stored in scopes field

  if (!apiKey || !toAddr) {
    return { success: false, errorMessage: "Email connection missing API key or recipient address" };
  }

  // Try to parse structured email JSON
  let subject = "New email from Content Flywheel";
  let body    = content;
  try {
    const parsed = JSON.parse(content) as { subject?: string; body?: string; preview?: string };
    if (parsed.subject) subject = parsed.subject;
    if (parsed.body)    body    = parsed.body;
  } catch { /* content is plain text */ }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method:  "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        from:    fromAddr,
        to:      [toAddr],
        subject,
        text:    body,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { success: false, errorMessage: `Resend API error: ${err}` };
    }

    const result = await res.json() as { id?: string };
    return { success: true, publishedUrl: `https://resend.com/emails/${result.id ?? ""}` };
  } catch (e) {
    return { success: false, errorMessage: String(e) };
  }
}

/* ─── Simulation publisher (other platforms without OAuth) ──────────────────── */

function simulatePublish(managerId: MarketingManagerId): PublishResult {
  // Simulates a successful publish — records the content as published
  // without actually calling any platform API.
  const fakeUrls: Record<MarketingManagerId, string> = {
    tiktok:    "https://tiktok.com/@yourprofile/video/sim",
    instagram: "https://instagram.com/p/sim/",
    youtube:   "https://youtube.com/watch?v=sim",
    x:         "https://x.com/yourprofile/status/sim",
    linkedin:  "https://linkedin.com/posts/yourprofile-sim",
    email:     "https://resend.com/emails/sim",
    seo:       "https://yoursite.com/blog/sim",
  };
  return { success: true, publishedUrl: fakeUrls[managerId], simulated: true };
}

/* ─── Main publish dispatcher ────────────────────────────────────────────────── */

export async function executePublish(
  item:       PublishQueueItem,
  connection: SelectConnectedAccount | null,
): Promise<PublishResult> {
  // No real connection — simulate
  if (!connection || !connection.accessToken) {
    return simulatePublish(item.managerId);
  }

  if (item.managerId === "email") {
    return publishViaEmail(item.content, connection);
  }

  // For other platforms with OAuth tokens, we'd call the platform API here.
  // For Phase 4.2 with a valid connection, we still simulate (real API calls
  // require platform developer credentials that are set up per-environment).
  // The infrastructure is ready — swap simulatePublish() for real API calls.
  return simulatePublish(item.managerId);
}

/* ─── Queue item factory ─────────────────────────────────────────────────────── */

export function createQueueItem(params: {
  managerId:    MarketingManagerId;
  outputId:     string;
  outputType:   string;
  content:      string;
  approvalMode: ApprovalMode;
  scheduledAt?: string;
}): PublishQueueItem {
  const autoApprove = shouldAutoApprove(params.content, params.outputType, params.approvalMode);
  const status      = params.scheduledAt && autoApprove
    ? "scheduled"
    : autoApprove
      ? "queued"   // will be processed immediately
      : "queued";  // will wait for approval

  return {
    id:           uid(),
    managerId:    params.managerId,
    outputId:     params.outputId,
    outputType:   params.outputType,
    content:      params.content,
    status,
    approvalMode: params.approvalMode,
    approvedAt:   autoApprove ? now() : undefined,
    approvedBy:   autoApprove && params.approvalMode !== "manual" ? "ai" : undefined,
    scheduledAt:  params.scheduledAt,
    retryCount:   0,
    createdAt:    now(),
  };
}

/* ─── Published item factory ─────────────────────────────────────────────────── */

export function createPublishedItem(
  item:   PublishQueueItem,
  result: PublishResult,
): PublishedItem {
  return {
    id:           uid(),
    managerId:    item.managerId,
    outputId:     item.outputId,
    content:      item.content,
    publishedAt:  now(),
    publishedUrl: result.publishedUrl,
  };
}

/* ─── Memory facts after publish ─────────────────────────────────────────────── */

export function extractPublishMemoryFacts(
  managerId:    MarketingManagerId,
  outputType:   string,
  content:      string,
  publishedUrl?: string,
): MemoryFact[] {
  const n = now();
  const facts: MemoryFact[] = [];

  const factBase = {
    source: `manager:${managerId}`,
    confidence: "high" as const,
    confirmedByUser: false,
    addedAt: n,
    updatedAt: n,
  };

  // Track best performing content type per platform
  facts.push({
    id: Math.random().toString(36).slice(2, 10),
    category: "marketing",
    key: `${managerId}_last_published_type`,
    label: `${managerId.charAt(0).toUpperCase() + managerId.slice(1)} last published content type`,
    value: outputType,
    ...factBase,
  });

  // For hooks — remember the best hook
  if (outputType === "hook" && content.length < 100) {
    facts.push({
      id: Math.random().toString(36).slice(2, 10),
      category: "marketing",
      key: `${managerId}_published_hook`,
      label: `Published ${managerId} hook`,
      value: content,
      ...factBase,
      confidence: "medium",
    });
  }

  // Track posting history
  facts.push({
    id: Math.random().toString(36).slice(2, 10),
    category: "launches",
    key: `${managerId}_last_published_at`,
    label: `Last published on ${managerId}`,
    value: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
    ...factBase,
  });

  if (publishedUrl) {
    facts.push({
      id: Math.random().toString(36).slice(2, 10),
      category: "launches",
      key: `${managerId}_last_published_url`,
      label: `Last ${managerId} post URL`,
      value: publishedUrl,
      ...factBase,
    });
  }

  return facts;
}
