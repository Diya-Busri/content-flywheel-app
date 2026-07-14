/**
 * mg_source_analyst — Step 1 of the MG Agent Workflow.
 *
 * Analyses the source text and extracts structured information about
 * the problem, emotional angle, audience, key insight, and most
 * compelling quote. Never invents data that wasn't in the source.
 *
 * Model: gpt-4o-mini (fast, cheap — this is a read-only extraction step)
 * Cost: 1 credit (see mg-credit-config.ts)
 */

import { z } from "zod";
import { checkSpendLimit } from "@/lib/spend-guard";
import { checkMgCredits, deductMgCredits } from "../mg-credits";
import { MG_TOOL_CREDIT_COSTS } from "../mg-credit-config";
import { mgOk, mgFail } from "../agent-types";
import type { MgTool, MgToolContext, MgSourceAnalysis } from "../agent-types";

const TOOL_NAME = "mg_source_analyst" as const;
const MODEL     = "gpt-4o-mini";

// ─── Input / Output schemas ───────────────────────────────────────────────────

const InputSchema = z.object({
  /** First 3000 chars of source text — truncated to keep tokens low. */
  sourcePreview: z.string().min(10, "Source text is too short to analyse"),
  contentMode:   z.string(),
});

const AnalysisSchema = z.object({
  coreProblem:    z.string().min(1),
  emotionalAngle: z.string().min(1),
  audience:       z.string().min(1),
  strongestQuote: z.string().min(1),
  keyInsight:     z.string().min(1),
  missingContext: z.string(),
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
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "You are a precise content analyst. Return ONLY valid JSON matching the exact schema requested. Do not invent any information not present in the source text.",
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

export const mgSourceAnalystTool: MgTool<Input, MgSourceAnalysis> = {
  name:        TOOL_NAME,
  description: "Analyses source text and extracts structured content analysis",
  inputSchema: InputSchema,

  async execute(ctx: MgToolContext, input: Input) {
    const cost = MG_TOOL_CREDIT_COSTS[TOOL_NAME];

    // Spend guard (Correction 5: call before provider request)
    const guard = await checkSpendLimit("openai", ctx.userId);
    if (guard) return mgFail("Monthly spend limit reached. Try again next month.");

    // Credit check
    const { sufficient, balance } = await checkMgCredits(ctx.userId, cost);
    if (!sufficient) {
      return mgFail(
        `Insufficient video credits. You need ${cost} credit${cost !== 1 ? "s" : ""} but have ${balance}.`
      );
    }

    const prompt = `Analyse this source text and extract structured information about it.

SOURCE TEXT:
"""
${input.sourcePreview}
"""

CONTENT MODE: ${input.contentMode}

IMPORTANT RULES:
- strongestQuote must be a direct quote or close paraphrase from the source text — never invented
- Do not fabricate usernames, numbers, dates, or platform names not in the source
- missingContext: note what additional information would strengthen the content (can be empty string if none)

Return ONLY this JSON schema:
{
  "coreProblem":    "The core problem or challenge the source reveals",
  "emotionalAngle": "The emotional hook — frustration, hope, curiosity, etc.",
  "audience":       "Who this resonates with most (specific, e.g. 'new digital product creators with < 100 followers')",
  "strongestQuote": "The most compelling sentence or quote from the source text",
  "keyInsight":     "The counter-intuitive or surprising insight this reveals",
  "missingContext": "What's missing that would make the content stronger (empty string if nothing)"
}`;

    let raw: string;
    try {
      raw = await callOpenAI(prompt);
    } catch (err) {
      return mgFail(err instanceof Error ? err.message : "AI call failed");
    }

    // Parse and validate AI response (Correction 9)
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return mgFail("Source analyst returned invalid JSON");
    }

    const validation = AnalysisSchema.safeParse(parsed);
    if (!validation.success) {
      const issues = validation.error.issues.map((i) => i.message).join("; ");
      return mgFail(`Source analyst response missing required fields: ${issues}`);
    }

    // Deduct credits after successful AI response (Correction 4)
    const deduction = await deductMgCredits({
      userId:   ctx.userId,
      runId:    ctx.runId,
      toolName: TOOL_NAME,
      amount:   cost,
    });
    if (!deduction.success && !deduction.alreadyDeducted) {
      return mgFail(deduction.error ?? "Credit deduction failed");
    }

    return mgOk(validation.data);
  },
};
