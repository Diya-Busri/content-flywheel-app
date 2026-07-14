/**
 * mg_storyboard_agent — Step 5 of the MG Agent Workflow.
 *
 * Takes the approved plan, source text, and generated script, and produces
 * exactly 5 StoryboardScenes in the canonical StoryboardScene format.
 * Output shape is identical to the Quick Generate path — both paths converge
 * to the same storyboard editor (Correction 12).
 *
 * Model: gpt-4o-mini
 * Cost: 2 credits
 */

import { z } from "zod";
import { randomUUID } from "crypto";
import { checkSpendLimit } from "@/lib/spend-guard";
import { checkMgCredits, deductMgCredits } from "../mg-credits";
import { MG_TOOL_CREDIT_COSTS } from "../mg-credit-config";
import { mgOk, mgFail } from "../agent-types";
import type { MgTool, MgToolContext, MgPlan } from "../agent-types";
import type { StoryboardScene, ShortFormOutput } from "../types";

const TOOL_NAME = "mg_storyboard_agent" as const;
const MODEL     = "gpt-4o-mini";

// Valid visual types and animations (mirrors ai-reddit-to-storyboard.ts)
const VALID_VISUAL_TYPES = [
  "reddit-card", "kinetic-text", "icon-scene", "diagram",
  "screen-recording", "app-demo", "b-roll-placeholder", "quote-card", "outro",
] as const;

const VALID_ANIMATIONS = [
  "fadeIn", "slideLeft", "slideRight", "slideUp", "slideDown",
  "scaleIn", "blurReveal", "punchIn",
] as const;

// ─── Input / Output schemas ───────────────────────────────────────────────────

const InputSchema = z.object({
  sourcePreview: z.string().min(10),
  script: z.object({
    title:           z.string(),
    hook:            z.string(),
    fullScript:      z.string(),
    callToAction:    z.string(),
    durationSeconds: z.number(),
  }),
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
    }),
  }),
  aspectRatio: z.enum(["9:16", "16:9", "1:1"]),
});

const RawSceneSchema = z.object({
  narration:        z.string().min(1),
  onScreenText:     z.string().max(60),
  visualType:       z.string(),
  animationPreset:  z.string(),
  transitionPreset: z.string(),
  assetSuggestions: z.array(z.string()).default([]),
  soundEffect:      z.string().nullable().optional(),
  emphasisWords:    z.array(z.string()).default([]),
  durationSeconds:  z.number().min(2).max(60),
});

const StoryboardOutputSchema = z.object({
  title:  z.string().min(1),
  scenes: z.array(RawSceneSchema).min(5).max(5),
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
      temperature: 0.5,
      messages: [
        {
          role: "system",
          content:
            "You are a precise short-form video storyboard writer. Return ONLY valid JSON. Never invent metadata (usernames, subreddits, upvote counts, dates) not present in the source.",
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pickAnimation(value: string | undefined): typeof VALID_ANIMATIONS[number] {
  return VALID_ANIMATIONS.includes(value as typeof VALID_ANIMATIONS[number])
    ? (value as typeof VALID_ANIMATIONS[number])
    : "fadeIn";
}

function pickVisualType(value: string | undefined): typeof VALID_VISUAL_TYPES[number] {
  return VALID_VISUAL_TYPES.includes(value as typeof VALID_VISUAL_TYPES[number])
    ? (value as typeof VALID_VISUAL_TYPES[number])
    : "kinetic-text";
}

function buildScenes(
  rawScenes: z.infer<typeof RawSceneSchema>[]
): StoryboardScene[] {
  let cursor = 0;
  return rawScenes.map((raw) => {
    const duration = Math.max(raw.durationSeconds ?? 5, 2);
    const visualType = pickVisualType(raw.visualType);
    const scene: StoryboardScene = {
      id:              randomUUID(),
      startTime:       cursor,
      endTime:         cursor + duration,
      narration:       (raw.narration ?? "").trim(),
      onScreenText:    (raw.onScreenText ?? "").trim(),
      visualType,
      animationPreset: pickAnimation(raw.animationPreset),
      transitionPreset: pickAnimation(raw.transitionPreset),
      assetSuggestions: Array.isArray(raw.assetSuggestions)
        ? raw.assetSuggestions.filter(Boolean)
        : [],
      soundEffect:     raw.soundEffect ?? undefined,
      emphasisWords:   Array.isArray(raw.emphasisWords) ? raw.emphasisWords : [],
      missingAsset:
        visualType === "app-demo" ||
        visualType === "screen-recording" ||
        visualType === "b-roll-placeholder",
    };
    cursor += duration;
    return scene;
  });
}

// ─── Tool ─────────────────────────────────────────────────────────────────────

export const mgStoryboardAgentTool: MgTool<Input, ShortFormOutput> = {
  name:        TOOL_NAME,
  description: "Produces exactly 5 StoryboardScenes from the approved plan and script",
  inputSchema: InputSchema,

  async execute(ctx: MgToolContext, input: Input) {
    const cost = MG_TOOL_CREDIT_COSTS[TOOL_NAME];

    // Spend guard
    const guard = await checkSpendLimit("openai", ctx.userId);
    if (guard) return mgFail("Monthly spend limit reached. Try again next month.");

    // Credit check
    const { sufficient, balance } = await checkMgCredits(ctx.userId, cost);
    if (!sufficient) {
      return mgFail(`Insufficient video credits. You need ${cost} credits but have ${balance}.`);
    }

    const prompt = `You are a short-form video storyboard writer. Turn this script into exactly 5 scenes.

SCRIPT:
Title: ${input.script.title}
Hook: ${input.script.hook}
Full narration:
"""
${input.script.fullScript}
"""
CTA: ${input.script.callToAction}
Total duration: ~${input.script.durationSeconds}s

CONTENT STRATEGY:
- Angle: ${input.plan.recommendedAngle}
- Main lesson: ${input.plan.mainLesson}
- Audience: ${input.plan.analysis.audience}
- Core problem: ${input.plan.analysis.coreProblem}
- Strongest quote: "${input.plan.analysis.strongestQuote}"

SOURCE (for reference):
"""
${input.sourcePreview}
"""

SCENE STRUCTURE (follow exactly):
Scene 1 (0-3s): The hook. visualType="reddit-card" — show the core problem / strongest quote.
Scene 2 (3-8s): Contrarian response. visualType="kinetic-text" — short, punchy.
Scene 3 (8-25s): The real insight. visualType="kinetic-text" or "icon-scene".
Scene 4 (25-45s): The solution / framework. visualType="icon-scene" or "app-demo".
Scene 5 (45-60s): CTA. visualType="outro".

RULES:
- Do NOT invent usernames, subreddit names, upvotes, follower counts, or dates
- Vary animationPreset across scenes
- onScreenText max 8 words
- assetSuggestions for app-demo: describe specifically what screen recording is needed

Return ONLY this JSON:
{
  "title": "${input.script.title}",
  "scenes": [
    {
      "narration": "spoken words",
      "onScreenText": "max 8 words",
      "visualType": "one of: reddit-card|kinetic-text|icon-scene|diagram|app-demo|b-roll-placeholder|quote-card|outro",
      "animationPreset": "one of: fadeIn|slideLeft|slideRight|slideUp|slideDown|scaleIn|blurReveal|punchIn",
      "transitionPreset": "one of: fadeIn|slideLeft|slideRight|slideUp|slideDown|scaleIn|blurReveal|punchIn",
      "assetSuggestions": ["description of visual needed"],
      "soundEffect": null,
      "emphasisWords": ["word1"],
      "durationSeconds": 5
    }
  ]
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
      return mgFail("Storyboard agent returned invalid JSON");
    }

    const validation = StoryboardOutputSchema.safeParse(parsed);
    if (!validation.success) {
      const issues = validation.error.issues.map((i) => i.message).join("; ");
      return mgFail(`Storyboard agent response missing required fields: ${issues}`);
    }

    const scenes = buildScenes(validation.data.scenes);
    const totalDuration = scenes.reduce(
      (acc, s) => acc + (s.endTime - s.startTime),
      0
    );

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

    const shortForm: ShortFormOutput = {
      title:           validation.data.title || input.script.title,
      hook:            input.script.hook,
      script:          input.script.fullScript,
      durationSeconds: totalDuration,
      callToAction:    input.script.callToAction,
      scenes,
    };

    return mgOk(shortForm);
  },
};
