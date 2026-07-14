/**
 * mg_script_agent — Step 4 of the MG Agent Workflow (after plan approval).
 *
 * Takes the approved plan (with user edits) and the source text, and
 * produces a complete short-form video script: title, hook, full narration,
 * duration, and CTA. The storyboard agent then turns this into 5 scenes.
 *
 * Model: gpt-4o (higher quality — this is the creative core)
 * Cost: 3 credits
 */

import { z } from "zod";
import { checkSpendLimit } from "@/lib/spend-guard";
import { checkMgCredits, deductMgCredits } from "../mg-credits";
import { MG_TOOL_CREDIT_COSTS } from "../mg-credit-config";
import { mgOk, mgFail } from "../agent-types";
import type { MgTool, MgToolContext, MgPlan } from "../agent-types";

const TOOL_NAME = "mg_script_agent" as const;
const MODEL     = "gpt-4o";

// ─── Input / Output schemas ───────────────────────────────────────────────────

const InputSchema = z.object({
  /** First 3000 chars of source text — truncated. Do NOT store on steps. */
  sourcePreview:   z.string().min(10),
  plan: z.object({
    recommendedAngle:   z.string(),
    selectedHook:       z.string(),
    mainLesson:         z.string(),
    suggestedCta:       z.string(),
    cfIntegrationLevel: z.enum(["off", "subtle", "direct"]),
    analysis: z.object({
      coreProblem:    z.string(),
      emotionalAngle: z.string(),
      audience:       z.string(),
      strongestQuote: z.string(),
      keyInsight:     z.string(),
    }),
  }),
  aspectRatio:     z.enum(["9:16", "16:9", "1:1"]),
  videoDuration:   z.string().optional(),
  tone:            z.string().optional(),
});

const ScriptOutputSchema = z.object({
  title:           z.string().min(1),
  hook:            z.string().min(1),
  fullScript:      z.string().min(50),
  callToAction:    z.string().min(1),
  durationSeconds: z.number().min(15).max(180),
});

export type ScriptOutput = z.infer<typeof ScriptOutputSchema>;
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
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content:
            "You are an expert short-form video scriptwriter. Return ONLY valid JSON. Write natural, conversational scripts that sound like a real person talking — not corporate or generic.",
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

export const mgScriptAgentTool: MgTool<Input, ScriptOutput> = {
  name:        TOOL_NAME,
  description: "Writes a complete short-form video script from the approved plan",
  inputSchema: InputSchema,

  async execute(ctx: MgToolContext, input: Input) {
    const cost = MG_TOOL_CREDIT_COSTS[TOOL_NAME];

    // Spend guard (Correction 5: immediately before provider request)
    const guard = await checkSpendLimit("openai", ctx.userId);
    if (guard) return mgFail("Monthly spend limit reached. Try again next month.");

    // Credit check
    const { sufficient, balance } = await checkMgCredits(ctx.userId, cost);
    if (!sufficient) {
      return mgFail(
        `Insufficient video credits. You need ${cost} credits but have ${balance}.`
      );
    }

    const cfGuide: Record<string, string> = {
      off:    "Do NOT mention Content Flywheel anywhere.",
      subtle: "You may mention Content Flywheel once, naturally, only where it helps the viewer.",
      direct: "Include a clear Content Flywheel mention/CTA — the platform that helps creators build and sell digital products with AI.",
    };

    const durationHint = input.videoDuration
      ? `Target duration: ${input.videoDuration}`
      : "Target duration: 30–60 seconds";

    const prompt = `You are writing a short-form faceless video script.

APPROVED ANGLE: ${input.plan.recommendedAngle}
HOOK TO USE: "${input.plan.selectedHook}"
MAIN LESSON: ${input.plan.mainLesson}
CALL TO ACTION: ${input.plan.suggestedCta}
CF MENTION: ${cfGuide[input.plan.cfIntegrationLevel] ?? cfGuide.subtle}
AUDIENCE: ${input.plan.analysis.audience}
TONE: ${input.tone || "direct, honest, conversational"}
${durationHint}

SOURCE MATERIAL (for context only — use what's relevant):
"""
${input.sourcePreview}
"""

RULES:
- Open with the exact hook: "${input.plan.selectedHook}"
- fullScript is the complete spoken narration (not bullet points — write how it will be spoken)
- Do NOT invent usernames, subreddit names, upvotes, follower counts, or dates not in the source
- Natural, conversational language — not corporate
- The script should flow so a viewer can follow it without any visuals

Return ONLY this JSON:
{
  "title":           "Catchy video title for the project",
  "hook":            "First 3 seconds of the video (the hook)",
  "fullScript":      "Complete spoken narration from start to finish",
  "callToAction":    "The final CTA line",
  "durationSeconds": 45
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
      return mgFail("Script agent returned invalid JSON");
    }

    const validation = ScriptOutputSchema.safeParse(parsed);
    if (!validation.success) {
      const issues = validation.error.issues.map((i) => i.message).join("; ");
      return mgFail(`Script agent response missing required fields: ${issues}`);
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
