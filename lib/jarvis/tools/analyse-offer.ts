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
  offerAnalysisSchema,
} from "./schemas";
import type { OfferAnalysis } from "@/db/schema/jarvis-schema";

const inputSchema = z
  .object({
    goal: z.string().min(3).max(2000),
    businessProfile: businessProfileSummarySchema,
    products: z.array(productSummarySchema).max(50),
    memories: z.array(memorySummarySchema).max(20),
  })
  .strict();
type Input = z.infer<typeof inputSchema>;

/**
 * AI analysis of the user's current offer against their stated goal.
 * Pure transform — takes context already fetched by the get_* tools (all of
 * which enforced ownership themselves); does not touch the DB directly.
 */
async function execute(ctx: ToolContext, input: Input) {
  const guard = await checkSpendLimit("openai", ctx.userId);
  if (guard) {
    return fail("Monthly AI usage limit reached for this feature. Resets on the 1st of next month.");
  }

  const { goal, businessProfile, products, memories } = input;

  const prompt = `You are analysing a creator's business offer to help them decide what content to create.

GOAL: "${goal}"

BUSINESS PROFILE:
${businessProfile.hasProfile
    ? `Brand: ${businessProfile.brandName ?? "unnamed"}
Niche: ${businessProfile.niche ?? "not set"}
Voice/tone: ${businessProfile.brandVoiceTone ?? "not set"}
Target audience: ${businessProfile.targetAudience ?? "not set"}`
    : "No brand profile set up yet."}

PRODUCTS (${products.length}):
${products.length > 0
    ? products.map((p) => `- ${p.title} (${p.format}, ${p.niche}) — status: ${p.status}, price: ${p.priceLabel ?? "not set"}, published: ${p.isPublished}`).join("\n")
    : "No products found."}

RELEVANT BUSINESS MEMORY (${memories.length}):
${memories.length > 0 ? memories.map((m) => `- [${m.category}] ${m.title}: ${m.summary}`).join("\n") : "No relevant memory found."}

Analyse this offer specifically for the stated goal. Be concrete and grounded in what's actually here — never invent products, numbers, or facts that weren't given to you.

Respond with ONLY valid JSON matching this exact shape:
{
  "strengths": ["1-4 specific strengths of the current offer relevant to the goal"],
  "gaps": ["1-4 specific gaps or risks relevant to the goal"],
  "recommendedAngles": ["1-4 specific content angles that would help achieve the goal"],
  "urgencyIdeas": ["0-3 genuine urgency/timeliness ideas relevant to the goal — omit if none are honest"]
}`;

  try {
    const openai = getOpenAIClient();
    const completion = await withRetry429(() =>
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.4,
        max_tokens: 900,
      }),
    );

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return fail("analyse_offer: AI returned no content");

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      return fail("analyse_offer: AI response was not valid JSON");
    }

    const result = offerAnalysisSchema.safeParse(parsedJson);
    if (!result.success) {
      return fail(`analyse_offer: AI response did not match expected shape: ${result.error.message}`);
    }

    return ok<OfferAnalysis>(result.data);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "analyse_offer: AI call failed");
  }
}

export const analyseOfferTool: JarvisTool<Input, OfferAnalysis> = {
  name: "analyse_offer",
  description: "AI analysis of strengths, gaps, and recommended content angles for the user's offer.",
  inputSchema,
  execute,
};
