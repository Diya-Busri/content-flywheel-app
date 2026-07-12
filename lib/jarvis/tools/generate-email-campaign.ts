import { z } from "zod";
import { randomUUID } from "crypto";
import { checkSpendLimit } from "@/lib/spend-guard";
import { withRetry429 } from "@/lib/openai-with-retry";
import { getOpenAIClient } from "../openai-client";
import type { JarvisTool, ToolContext } from "../types";
import { ok, fail } from "../types";
import { businessProfileSummarySchema, productSummarySchema } from "./schemas";
import type { ProposedEmail } from "@/db/schema/jarvis-schema";

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

type Output = { emails: ProposedEmail[] };

const aiItemSchema = z
  .object({
    name: z.string().min(1).max(200),
    subject: z.string().min(1).max(200),
    previewText: z.string().min(1).max(200),
    bodyHtml: z.string().min(1).max(8000),
  })
  .strict();
const aiResponseSchema = z.object({ emails: z.array(aiItemSchema).min(1).max(5) }).strict();

/**
 * Generates email campaign copy. Returns proposed assets only — nothing is
 * sent and nothing is saved as a real campaign here. save_content_campaign
 * later persists approved emails as DRAFT rows only; sending is out of
 * scope for Phase 1 entirely (no send tool exists).
 */
async function execute(ctx: ToolContext, input: Input) {
  const guard = await checkSpendLimit("openai", ctx.userId);
  if (guard) {
    return fail("Monthly AI usage limit reached for this feature. Resets on the 1st of next month.");
  }

  const { goal, angle, count, businessProfile, products } = input;

  const prompt = `Write ${count} marketing email(s) for this goal.

GOAL: "${goal}"
ANGLE FOR THIS BATCH: "${angle}"
BRAND: ${businessProfile.hasProfile ? `${businessProfile.brandName ?? "unnamed"}, tone: ${businessProfile.brandVoiceTone ?? "not set"}` : "No brand profile set — keep it generic and professional."}
PRODUCTS TO REFERENCE (only if relevant): ${products.length > 0 ? products.map((p) => `${p.title} (${p.priceLabel ?? "price not set"})`).join(", ") : "none — keep it general to the niche"}

Each email needs a compelling subject line, preview text, and a full HTML body (use simple tags: <p>, <strong>, <a>, <br> — no external images/scripts). Do not invent product names, prices, discounts, or claims that weren't given to you above. Never include urgency claims that aren't grounded in something real (no fake countdowns).

Respond with ONLY valid JSON:
{
  "emails": [
    { "name": "internal name for this email e.g. 'This week's offer'", "subject": "subject line", "previewText": "preview text", "bodyHtml": "<p>full HTML email body</p>" }
  ]
}
Return exactly ${count} email(s).`;

  try {
    const openai = getOpenAIClient();
    const completion = await withRetry429(() =>
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.6,
        max_tokens: 2600,
      }),
    );

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return fail("generate_email_campaign: AI returned no content");

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      return fail("generate_email_campaign: AI response was not valid JSON");
    }

    const result = aiResponseSchema.safeParse(parsedJson);
    if (!result.success) {
      return fail(`generate_email_campaign: AI response did not match expected shape: ${result.error.message}`);
    }

    const emails: ProposedEmail[] = result.data.emails.map((e) => ({
      id: randomUUID(),
      type: "email",
      status: "proposed",
      edited: false,
      name: e.name,
      subject: e.subject,
      previewText: e.previewText,
      bodyHtml: e.bodyHtml,
    }));

    return ok<Output>({ emails });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "generate_email_campaign: AI call failed");
  }
}

export const generateEmailCampaignTool: JarvisTool<Input, Output> = {
  name: "generate_email_campaign",
  description: "Generates proposed email campaign copy (not saved until approved, never sent).",
  inputSchema,
  execute,
};
