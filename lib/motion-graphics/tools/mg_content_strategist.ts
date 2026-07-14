/**
 * mg_content_strategist — Step 2 of the MG Agent Workflow.
 *
 * Takes the source analysis and user preferences and produces a content
 * strategy: recommended angle, 3 hook options, main lesson, CTA, and
 * CF integration level. This becomes the MgPlan that the user approves
 * or edits before generation begins.
 *
 * Model: gpt-4o-mini
 * Cost: 1 credit
 */

import { z } from "zod";
import { checkSpendLimit } from "@/lib/spend-guard";
import { checkMgCredits, deductMgCredits } from "../mg-credits";
import { MG_TOOL_CREDIT_COSTS, totalMgRunCreditCost } from "../mg-credit-config";
import { mgOk, mgFail } from "../agent-types";
import type {
  MgTool,
  MgToolContext,
  MgSourceAnalysis,
  MgPlan,
  MgCfIntegrationLevel,
} from "../agent-types";

const TOOL_NAME = "mg_content_strategist" as const;
const MODEL     = "gpt-4o-mini";

// ─── Input / Output schemas ───────────────────────────────────────────────────

const InputSchema = z.object({
  analysis:       z.object({
    coreProblem:    z.string(),
    emotionalAngle: z.string(),
    audience:       z.string(),
    strongestQuote: z.string(),
    keyInsight:     z.string(),
    missingContext: z.string(),
  }),
  contentMode:    z.string(),
  cfMention:      z.enum(["off", "subtle", "direct"]),
  targetAudience: z.string().optional(),
  mainOpinion:    z.string().optional(),
  desiredCta:     z.string().optional(),
  tone:           z.string().optional(),
});

const StrategySchema = z.object({
  recommendedAngle: z.string().min(1),
  hookOptions:      z.array(z.string().min(1)).min(1).max(5),
  mainLesson:       z.string().min(1),
  suggestedCta:     z.string().min(1),
  cfIntegrationLevel: z.enum(["off", "subtle", "direct"]),
});

type Input = z.infer<typeof InputSchema>;

// ─── AI call ─────────────────────────────────────────────────────────────────

async function callOpenAI(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      response_format: { type: "json_object" },
      temperature: 0.6,
      messages: [
        {
          role: "system",
          content:
            "You are an expert short-form content strategist. Return ONLY valid JSON matching the exact schema requested. Be specific, opinionated, and contrarian where the analysis supports it.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  const data = await res.json() as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned an empty response");
  return content;
}

// ─── Tool ─────────────────────────────────────────────────────────────────────

export const mgContentStrategistTool: MgTool<Input, Omit<MgPlan, "analysis" | "deliverables" | "estimatedScenes" | "estimatedCreditCost" | "repurposingOptions">> = {
  name:        TOOL_NAME,
  description: "Creates content strategy: angle, hooks, lesson, CTA, CF level",
  inputSchema: InputSchema,

  async execute(ctx: MgToolContext, input: Input) {
    const cost = MG_TOOL_CREDIT_COSTS[TOOL_NAME];

    // Spend guard
    const guard = await checkSpendLimit("openai", ctx.userId);
    if (guard) return mgFail("Monthly spend limit reached. Try again next month.");

    // Credit check
    const { sufficient, balance } = await checkMgCredits(ctx.userId, cost);
    if (!sufficient) {
      return mgFail(
        `Insufficient video credits. You need ${cost} credit${cost !== 1 ? "s" : ""} but have ${balance}.`
      );
    }

    const cfGuide: Record<string, string> = {
      off:    "Do NOT mention Content Flywheel. cfIntegrationLevel must be 'off'.",
      subtle: "Content Flywheel may be mentioned once, naturally. cfIntegrationLevel should be 'subtle'.",
      direct: "Include a clear Content Flywheel CTA. cfIntegrationLevel must be 'direct'.",
    };

    const prompt = `You are a short-form content strategist. Given this analysis, create a content strategy.

ANALYSIS:
- Core problem: ${input.analysis.coreProblem}
- Emotional angle: ${input.analysis.emotionalAngle}
- Audience: ${input.analysis.audience}
- Strongest quote: "${input.analysis.strongestQuote}"
- Key insight: ${input.analysis.keyInsight}
- Missing context: ${input.analysis.missingContext || "none"}

PREFERENCES:
- Content mode: ${input.contentMode}
- CF mention: ${cfGuide[input.cfMention] ?? cfGuide.subtle}
${input.targetAudience ? `- Target audience: ${input.targetAudience}` : ""}
${input.mainOpinion   ? `- Creator's opinion/lesson: ${input.mainOpinion}` : ""}
${input.desiredCta    ? `- Desired CTA: ${input.desiredCta}` : ""}
${input.tone          ? `- Tone: ${input.tone}` : ""}

TASK: Create a content strategy that is specific, opinionated, and contrarian where the analysis supports it.
The recommendedAngle should challenge the obvious interpretation if the data supports a stronger reading.

Return ONLY this JSON:
{
  "recommendedAngle":   "The specific content angle — be opinionated, not generic",
  "hookOptions":        ["Hook 1 (strongest)", "Hook 2 (curiosity)", "Hook 3 (contrarian)"],
  "mainLesson":         "The main lesson the viewer takes away — specific and actionable",
  "suggestedCta":       "The call to action",
  "cfIntegrationLevel": "off" | "subtle" | "direct"
}`;

    let raw: string;
    try {
      raw = await callOpenAI(prompt);
    } catch (err) {
      return mgFail(err instanceof Error ? err.message : "AI call failed");
    }

    // Parse and validate (Correction 9)
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return mgFail("Content strategist returned invalid JSON");
    }

    const validation = StrategySchema.safeParse(parsed);
    if (!validation.success) {
      const issues = validation.error.issues.map((i) => i.message).join("; ");
      return mgFail(`Content strategist response missing required fields: ${issues}`);
    }

    // Deduct credits after successful AI response
    const deduction = await deductMgCredits({
      userId:   ctx.userId,
      runId:    ctx.runId,
      toolName: TOOL_NAME,
      amount:   cost,
    });
    if (!deduction.success && !deduction.alreadyDeducted) {
      return mgFail(deduction.error ?? "Credit deduction failed");
    }

    const { recommendedAngle, hookOptions, mainLesson, suggestedCta, cfIntegrationLevel } =
      validation.data;

    return mgOk({
      recommendedAngle,
      hookOptions,
      selectedHook:      hookOptions[0] ?? "",
      mainLesson,
      suggestedCta,
      cfIntegrationLevel: cfIntegrationLevel as MgCfIntegrationLevel,
    });
  },
};
