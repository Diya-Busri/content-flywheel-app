import { z } from "zod";
import { randomUUID } from "crypto";
import { checkSpendLimit } from "@/lib/spend-guard";
import { withRetry429 } from "@/lib/openai-with-retry";
import { getOpenAIClient } from "../openai-client";
import type { JarvisTool, ToolContext } from "../types";
import { ok, fail } from "../types";
import { businessProfileSummarySchema, productSummarySchema } from "./schemas";
import type { ProposedVideoScript } from "@/db/schema/jarvis-schema";

const inputSchema = z
  .object({
    goal: z.string().min(3).max(2000),
    angle: z.string().min(1).max(500),
    count: z.number().int().min(1).max(5),
    businessProfile: businessProfileSummarySchema,
    products: z.array(productSummarySchema).max(50),
  })
  .strict();
type Input = z.infer<typeof inputSchema>;

type Output = { scripts: ProposedVideoScript[] };

const aiItemSchema = z
  .object({
    platform: z.enum(["tiktok", "instagram", "youtube"]),
    title: z.string().min(1).max(200),
    hook: z.string().min(1).max(400),
    script: z.string().min(1).max(4000),
    cta: z.string().min(1).max(300),
  })
  .strict();
const aiResponseSchema = z.object({ scripts: z.array(aiItemSchema).min(1).max(5) }).strict();

/**
 * Generates short-form video scripts. Returns them as PROPOSED assets only —
 * nothing is written to the user's library here. save_content_campaign is
 * the only tool that persists anything, and only for assets the user
 * explicitly approves.
 */
async function execute(ctx: ToolContext, input: Input) {
  const guard = await checkSpendLimit("openai", ctx.userId);
  if (guard) {
    return fail("Monthly AI usage limit reached for this feature. Resets on the 1st of next month.");
  }

  const { goal, angle, count, businessProfile, products } = input;

  const prompt = `Write ${count} short-form video script(s) (TikTok/Instagram Reels/YouTube Shorts style) for this goal.

GOAL: "${goal}"
ANGLE FOR THIS BATCH: "${angle}"
BRAND: ${businessProfile.hasProfile ? `${businessProfile.brandName ?? "unnamed"}, tone: ${businessProfile.brandVoiceTone ?? "not set"}` : "No brand profile set — keep it generic and professional."}
PRODUCTS TO REFERENCE (only mention ones that are actually relevant, don't force it): ${products.length > 0 ? products.map((p) => `${p.title} (${p.priceLabel ?? "price not set"})`).join(", ") : "none — keep the script general to the niche"}

Each script needs a strong hook (first line, said in the first 2 seconds), a body that delivers real value/entertainment, and a clear CTA. Do not invent product names, prices, or claims that weren't given to you above.

Respond with ONLY valid JSON:
{
  "scripts": [
    { "platform": "tiktok" | "instagram" | "youtube", "title": "short internal title", "hook": "the opening line", "script": "full script body", "cta": "the call to action line" }
  ]
}
Return exactly ${count} script(s).`;

  try {
    const openai = getOpenAIClient();
    const completion = await withRetry429(() =>
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 2200,
      }),
    );

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return fail("generate_video_scripts: AI returned no content");

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      return fail("generate_video_scripts: AI response was not valid JSON");
    }

    const result = aiResponseSchema.safeParse(parsedJson);
    if (!result.success) {
      return fail(`generate_video_scripts: AI response did not match expected shape: ${result.error.message}`);
    }

    const scripts: ProposedVideoScript[] = result.data.scripts.map((s) => ({
      id: randomUUID(),
      type: "video_script",
      status: "proposed",
      edited: false,
      platform: s.platform,
      title: s.title,
      hook: s.hook,
      script: s.script,
      cta: s.cta,
    }));

    return ok<Output>({ scripts });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "generate_video_scripts: AI call failed");
  }
}

export const generateVideoScriptsTool: JarvisTool<Input, Output> = {
  name: "generate_video_scripts",
  description: "Generates proposed short-form video scripts (not saved until approved).",
  inputSchema,
  execute,
};
