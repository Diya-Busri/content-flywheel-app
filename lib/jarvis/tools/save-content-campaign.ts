import { z } from "zod";
import { db } from "@/db/db";
import { scriptsTable } from "@/db/schema/library-schema";
import { emailCampaignsTable } from "@/db/schema/email-marketing-schema";
import type { JarvisTool, ToolContext } from "../types";
import { ok, fail } from "../types";
import { assetForSaveSchema } from "./schemas";

const inputSchema = z
  .object({
    assets: z.array(assetForSaveSchema).min(1).max(20),
  })
  .strict();
type Input = z.infer<typeof inputSchema>;

export type SaveResultItem =
  | { assetId: string; success: true; table: "scripts" | "email_campaigns"; savedId: string }
  | { assetId: string; success: false; error: string };

type Output = { results: SaveResultItem[] };

/**
 * Persists approved assets into the user's existing library:
 *   - video_script / carousel -> scriptsTable (drives /dashboard/library,
 *     the same table every other Content Flywheel feature saves scripts to)
 *   - email -> emailCampaignsTable, status "draft" (drives
 *     /dashboard/email-marketing) — never sent, sending is a separate,
 *     unbuilt feature entirely
 *
 * Every insert happens inside one DB transaction: either all approved
 * assets in this call are saved, or none are. This is deliberate — a
 * partial save would leave the run's bookkeeping (which assets are
 * "saved") inconsistent with what's actually in the library, and Jarvis
 * must never claim something was saved unless it truly was. On failure the
 * whole call is rolled back and the orchestrator marks the run "failed" so
 * the user gets an honest error and a retry option, not a half-completed
 * campaign.
 *
 * Ownership: every row is inserted with userId = ctx.userId (the
 * server-side authenticated user) — there is no user-suppliable target
 * user in the input, so there is nothing to cross-user write.
 */
async function execute(ctx: ToolContext, input: Input) {
  const results: SaveResultItem[] = [];

  try {
    await db.transaction(async (tx) => {
      for (const asset of input.assets) {
        if (asset.type === "video_script") {
          const content = `${asset.hook}\n\n${asset.script}\n\nCTA: ${asset.cta}`;
          const [row] = await tx
            .insert(scriptsTable)
            .values({
              userId: ctx.userId,
              title: asset.title,
              content,
              platform: asset.platform,
              status: "draft",
              metadata: {
                source: "jarvis",
                runId: ctx.runId,
                assetId: asset.id,
                assetType: "video_script",
                hook: asset.hook,
                cta: asset.cta,
              },
            })
            .returning({ id: scriptsTable.id });
          if (!row) throw new Error(`Failed to save video script "${asset.title}"`);
          results.push({ assetId: asset.id, success: true, table: "scripts", savedId: row.id });
        } else if (asset.type === "carousel") {
          const content = [
            ...asset.slides.map((s, i) => `Slide ${i + 1}: ${s}`),
            "",
            `Caption: ${asset.caption}`,
            asset.hashtags.length > 0 ? `Hashtags: ${asset.hashtags.map((h) => `#${h}`).join(" ")}` : "",
          ]
            .filter(Boolean)
            .join("\n");
          const [row] = await tx
            .insert(scriptsTable)
            .values({
              userId: ctx.userId,
              title: asset.title,
              content,
              platform: `${asset.platform}_carousel`,
              status: "draft",
              metadata: {
                source: "jarvis",
                runId: ctx.runId,
                assetId: asset.id,
                assetType: "carousel",
                slides: asset.slides,
                caption: asset.caption,
                hashtags: asset.hashtags,
              },
            })
            .returning({ id: scriptsTable.id });
          if (!row) throw new Error(`Failed to save carousel "${asset.title}"`);
          results.push({ assetId: asset.id, success: true, table: "scripts", savedId: row.id });
        } else {
          const [row] = await tx
            .insert(emailCampaignsTable)
            .values({
              userId: ctx.userId,
              subject: asset.subject,
              previewText: asset.previewText,
              bodyHtml: asset.bodyHtml,
              status: "draft",
            })
            .returning({ id: emailCampaignsTable.id });
          if (!row) throw new Error(`Failed to save email "${asset.name}"`);
          results.push({ assetId: asset.id, success: true, table: "email_campaigns", savedId: row.id });
        }
      }
    });

    return ok<Output>({ results });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "save_content_campaign: failed to save assets");
  }
}

export const saveContentCampaignTool: JarvisTool<Input, Output> = {
  name: "save_content_campaign",
  description: "Persists approved assets into the user's library (scripts) and email marketing (drafts).",
  inputSchema,
  execute,
};
