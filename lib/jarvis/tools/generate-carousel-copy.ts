import { z } from "zod";
import { randomUUID } from "crypto";
import { checkSpendLimit } from "@/lib/spend-guard";
import { withRetry429 } from "@/lib/openai-with-retry";
import { getOpenAIClient } from "../openai-client";
import type { JarvisTool, ToolContext } from "../types";
import { ok, fail } from "../types";
import { businessProfileSummarySchema, productSummarySchema } from "./schemas";
import type { ProposedCarousel } from "@/db/schema/jarvis-schema";

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

type Output = { carousels: ProposedCarousel[] };

const aiItemSchema = z
  .object({
    platform: z.enum(["instagram", "tiktok"]),
    title: z.string().min(1).max(200),
    slides: z.array(z.string().min(1).max(300)).min(3).max(10),
    caption: z.string().min(1).max(1000),
    hashtags: z.array(z.string().min(1).max(40)).max(15),
  })
  .strict();
const aiResponseSchema = z.object({ carousels: z.array(aiItemSchema).min(1).max(5) }).strict();

/**
 * Generates carousel post copy (slide text + caption + hashtags). Returns
 * proposed assets only — nothing is written to the library here.
 */
async function execute(ctx: ToolContext, input: Input) {
  const guard = await checkSpendLimit("openai", ctx.userId);
  if (guard) {
    return fail("Monthly AI usage limit reached for this feature. Resets on the 1st of next month.");
  }

  const { goal, angle, count, businessProfile, products } = input;

  const prompt = `Write ${count} multi-slide carousel post(s) (Instagram/TikTok carousel style) for this goal.

GOAL: "${goal}"
ANGLE FOR THIS BATCH: "${angle}"
BRAND: ${businessProfile.hasProfile ? `${businessProfile.brandName ?? "unnamed"}, tone: ${businessProfile.brandVoiceTone ?? "not set"}` : "No brand profile set — keep it generic and professional."}
PRODUCTS TO REFERENCE (only if relevant): ${products.length > 0 ? products.map((p) => `${p.title} (${p.priceLabel ?? "price not set"})`).join(", ") : "none — keep it general to the niche"}

Each carousel needs 4-8 slides (short punchy text per slide, slide 1 is the hook), a caption, and relevant hashtags. Do not invent product names, prices, or claims that weren't given to you above.

Respond with ONLY valid JSON:
{
  "carousels": [
    { "platform": "instagram" | "tiktok", "title": "short internal title", "slides": ["slide 1 text", "slide 2 text", "..."], "caption": "the post caption", "hashtags": ["hashtag1", "hashtag2"] }
  ]
}
Return exactly ${count} carousel(s). Hashtags should not include the # symbol.`;

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
    if (!raw) return fail("generate_carousel_copy: AI returned no content");

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      return fail("generate_carousel_copy: AI response was not valid JSON");
    }

    const result = aiResponseSchema.safeParse(parsedJson);
    if (!result.success) {
      return fail(`generate_carousel_copy: AI response did not match expected shape: ${result.error.message}`);
    }

    const carousels: ProposedCarousel[] = result.data.carousels.map((c) => ({
      id: randomUUID(),
      type: "carousel",
      status: "proposed",
      edited: false,
      platform: c.platform,
      title: c.title,
      slides: c.slides,
      caption: c.caption,
      hashtags: c.hashtags,
    }));

    return ok<Output>({ carousels });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "generate_carousel_copy: AI call failed");
  }
}

export const generateCarouselCopyTool: JarvisTool<Input, Output> = {
  name: "generate_carousel_copy",
  description: "Generates proposed carousel post copy (not saved until approved).",
  inputSchema,
  execute,
};
