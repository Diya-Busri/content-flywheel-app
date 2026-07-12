import { z } from "zod";
import { db } from "@/db/db";
import { scriptsTable } from "@/db/schema/library-schema";
import { emailCampaignsTable } from "@/db/schema/email-marketing-schema";
import { and, desc, eq, gte, isNull } from "drizzle-orm";
import type { JarvisTool, ToolContext } from "../types";
import { ok, fail } from "../types";
import { existingContentSummarySchema, type ExistingContentSummary } from "./schemas";

const inputSchema = z
  .object({
    days: z.number().int().min(1).max(90).optional(),
  })
  .strict();
type Input = z.infer<typeof inputSchema>;

/**
 * Reads the authenticated user's recently-created scripts and email
 * campaigns, so Jarvis can avoid duplicating content that already exists.
 * Ownership enforced via `eq(..., ctx.userId)` on both tables.
 */
async function execute(ctx: ToolContext, input: Input) {
  try {
    const since = new Date(Date.now() - (input.days ?? 14) * 24 * 60 * 60 * 1000);

    const scripts = await db
      .select()
      .from(scriptsTable)
      .where(
        and(
          eq(scriptsTable.userId, ctx.userId),
          isNull(scriptsTable.deletedAt),
          gte(scriptsTable.createdAt, since),
        ),
      )
      .orderBy(desc(scriptsTable.createdAt))
      .limit(20);

    const emails = await db
      .select()
      .from(emailCampaignsTable)
      .where(and(eq(emailCampaignsTable.userId, ctx.userId), gte(emailCampaignsTable.createdAt, since)))
      .orderBy(desc(emailCampaignsTable.createdAt))
      .limit(10);

    const summary: ExistingContentSummary = {
      recentScripts: scripts.map((s) => ({
        id: s.id,
        title: s.title,
        platform: s.platform,
        createdAt: s.createdAt.toISOString(),
      })),
      recentEmails: emails.map((e) => ({
        id: e.id,
        subject: e.subject,
        status: e.status,
        createdAt: e.createdAt.toISOString(),
      })),
    };

    const parsed = existingContentSummarySchema.safeParse(summary);
    if (!parsed.success) {
      return fail(`get_existing_content produced an invalid summary: ${parsed.error.message}`);
    }

    return ok(parsed.data);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Failed to read existing content");
  }
}

export const getExistingContentTool: JarvisTool<Input, ExistingContentSummary> = {
  name: "get_existing_content",
  description: "Reads the user's recently created scripts and email campaigns to avoid duplication.",
  inputSchema,
  execute,
};
