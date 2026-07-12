import { z } from "zod";
import { checkSpendLimit } from "@/lib/spend-guard";
import { withRetry429 } from "@/lib/openai-with-retry";
import { getOpenAIClient } from "../openai-client";
import type { JarvisTool, ToolContext } from "../types";
import { ok, fail } from "../types";
import {
  businessProfileSummarySchema,
  productSummarySchema,
  memorySummarySchema,
  existingContentSummarySchema,
  offerAnalysisSchema,
  strategyAiOutputSchema,
} from "./schemas";
import type { JarvisPlan, MissingInfoQuestion } from "@/db/schema/jarvis-schema";

const inputSchema = z
  .object({
    goal: z.string().min(3).max(2000),
    businessProfile: businessProfileSummarySchema,
    products: z.array(productSummarySchema).max(50),
    memories: z.array(memorySummarySchema).max(20),
    existingContent: existingContentSummarySchema,
    offerAnalysis: offerAnalysisSchema,
  })
  .strict();
type Input = z.infer<typeof inputSchema>;

/** Critical gaps that must always be asked about, regardless of what the AI notices. */
function deterministicMissingInfo(input: Input): MissingInfoQuestion[] {
  const questions: MissingInfoQuestion[] = [];
  if (input.products.length === 0) {
    questions.push({
      key: "primary_offer",
      question: "You don't have any products in Content Flywheel yet — what offer, product, or service should this content promote?",
      placeholder: "e.g. my $27 TikTok growth ebook",
    });
  }
  if (!input.businessProfile.hasProfile) {
    questions.push({
      key: "brand_basics",
      question: "You haven't set up a brand profile yet — what's your brand name and niche?",
      placeholder: "e.g. Content Flywheel, digital products for creators",
    });
  }
  return questions;
}

function mergeMissingInfo(
  deterministic: MissingInfoQuestion[],
  aiSuggested: MissingInfoQuestion[],
): MissingInfoQuestion[] {
  const byKey = new Map<string, MissingInfoQuestion>();
  for (const q of deterministic) byKey.set(q.key, q);
  for (const q of aiSuggested) if (!byKey.has(q.key)) byKey.set(q.key, q);
  return Array.from(byKey.values()).slice(0, 4);
}

/**
 * AI-generated content strategy — decides which asset types to generate
 * (video scripts / carousels / emails), how many, and what angle each
 * should take. Merges in deterministic missing-info questions so critical
 * gaps (no products, no brand profile) are never silently skipped even if
 * the AI doesn't flag them.
 */
async function execute(ctx: ToolContext, input: Input) {
  const guard = await checkSpendLimit("openai", ctx.userId);
  if (guard) {
    return fail("Monthly AI usage limit reached for this feature. Resets on the 1st of next month.");
  }

  const { goal, businessProfile, products, existingContent, offerAnalysis } = input;

  const prompt = `You are building a content execution plan for a digital creator's business, based on their stated goal.

GOAL: "${goal}"

OFFER ANALYSIS:
Strengths: ${offerAnalysis.strengths.join("; ") || "none identified"}
Gaps: ${offerAnalysis.gaps.join("; ") || "none identified"}
Recommended angles: ${offerAnalysis.recommendedAngles.join("; ") || "none identified"}
Urgency ideas: ${offerAnalysis.urgencyIdeas.join("; ") || "none identified"}

BUSINESS: ${businessProfile.hasProfile ? `${businessProfile.brandName ?? "unnamed"} (${businessProfile.niche ?? "niche not set"})` : "No brand profile set up."}
PRODUCTS: ${products.length > 0 ? products.map((p) => p.title).join(", ") : "none yet"}

CONTENT ALREADY CREATED RECENTLY (avoid duplicating these):
Scripts: ${existingContent.recentScripts.map((s) => s.title).join(", ") || "none"}
Emails: ${existingContent.recentEmails.map((e) => e.subject).join(", ") || "none"}

Decide a content plan for THIS WEEK. Choose only asset types that genuinely serve the goal — don't pad with types the goal doesn't call for. Available asset types: "video_script" (short-form hook/script/CTA), "carousel" (multi-slide Instagram/TikTok post), "email" (campaign email).

Respond with ONLY valid JSON matching this exact shape:
{
  "objectiveSummary": "1-2 sentence summary of what this content plan is trying to achieve and why",
  "assetPlan": [
    { "assetType": "video_script" | "carousel" | "email", "count": 1-5, "angle": "specific angle/approach for this batch", "notes": "optional extra guidance" }
  ],
  "missingInfo": [
    { "key": "short_machine_key", "question": "specific question to ask the user", "placeholder": "optional example answer" }
  ]
}
Only include missingInfo entries for information that is GENUINELY missing and would meaningfully change what gets generated — do not ask questions you can already answer from the context above.`;

  try {
    const openai = getOpenAIClient();
    const completion = await withRetry429(() =>
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.5,
        max_tokens: 1100,
      }),
    );

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return fail("create_content_strategy: AI returned no content");

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      return fail("create_content_strategy: AI response was not valid JSON");
    }

    const result = strategyAiOutputSchema.safeParse(parsedJson);
    if (!result.success) {
      return fail(`create_content_strategy: AI response did not match expected shape: ${result.error.message}`);
    }

    const missingInfo = mergeMissingInfo(deterministicMissingInfo(input), result.data.missingInfo);

    const plan: JarvisPlan = {
      objectiveSummary: result.data.objectiveSummary,
      offerAnalysis,
      assetPlan: result.data.assetPlan,
      missingInfo,
      generatedAt: new Date().toISOString(),
    };

    return ok<JarvisPlan>(plan);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "create_content_strategy: AI call failed");
  }
}

export const createContentStrategyTool: JarvisTool<Input, JarvisPlan> = {
  name: "create_content_strategy",
  description: "Builds a structured content execution plan (which assets to generate and why).",
  inputSchema,
  execute,
};
