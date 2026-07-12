import { z } from "zod";
import { db } from "@/db/db";
import { brandProfilesTable } from "@/db/schema/brand-profiles-schema";
import { brandVoiceTable } from "@/db/schema/brand-voice-schema";
import { eq } from "drizzle-orm";
import type { JarvisTool, ToolContext } from "../types";
import { ok, fail } from "../types";
import { businessProfileSummarySchema, type BusinessProfileSummary } from "./schemas";

const inputSchema = z.object({}).strict();
type Input = z.infer<typeof inputSchema>;

/**
 * Reads the authenticated user's brand profile + brand voice settings.
 * Ownership is enforced by querying strictly with ctx.userId — there is no
 * user-suppliable id in the input, so there is nothing to cross-user leak.
 */
async function execute(ctx: ToolContext, _input: Input) {
  try {
    const [brandProfile] = await db
      .select()
      .from(brandProfilesTable)
      .where(eq(brandProfilesTable.userId, ctx.userId))
      .limit(1);

    const [brandVoice] = await db
      .select()
      .from(brandVoiceTable)
      .where(eq(brandVoiceTable.userId, ctx.userId))
      .limit(1);

    const hasProfile = Boolean(brandProfile || brandVoice);

    const platformFocus = brandVoice?.platformFocus
      ? brandVoice.platformFocus.split(",").map((p) => p.trim()).filter(Boolean)
      : [];

    const summary: BusinessProfileSummary = {
      hasProfile,
      brandName: brandProfile?.brandName ?? brandVoice?.brandName ?? null,
      niche: brandProfile?.nicheIndustry ?? null,
      brandVoiceTone: brandVoice?.tone ?? brandProfile?.brandVoice ?? null,
      targetAudience: brandVoice?.targetAudience ?? null,
      writingStyle: brandVoice?.writingStyle ?? null,
      platformFocus,
    };

    const parsed = businessProfileSummarySchema.safeParse(summary);
    if (!parsed.success) {
      return fail(`get_business_profile produced an invalid summary: ${parsed.error.message}`);
    }

    return ok(parsed.data);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Failed to read business profile");
  }
}

export const getBusinessProfileTool: JarvisTool<Input, BusinessProfileSummary> = {
  name: "get_business_profile",
  description: "Reads the user's brand profile and brand voice settings.",
  inputSchema,
  execute,
};
