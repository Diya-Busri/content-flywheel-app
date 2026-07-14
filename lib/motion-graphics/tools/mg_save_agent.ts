/**
 * mg_save_agent — Step 7 of the MG Agent Workflow.
 *
 * Saves or updates a motion_graphics_project from the approved storyboard.
 * DB-only — no AI calls, no credit charge.
 *
 * The exact storyboard submitted by the user at the storyboard gate is saved
 * without any regeneration (Correction 10 & 12).
 */

import { z } from "zod";
import { mgOk, mgFail } from "../agent-types";
import type { MgTool, MgToolContext } from "../agent-types";
import { createProject, updateProject } from "../projects-repo";
import type { ShortFormOutput, ContentMode, AspectRatio, CfMentionMode } from "../types";

const TOOL_NAME = "mg_save_agent" as const;

// ─── Input schema ─────────────────────────────────────────────────────────────

const InputSchema = z.object({
  /** If set, update an existing project instead of creating a new one. */
  existingProjectId: z.string().uuid().optional(),
  contentMode:   z.enum([
    "reddit-reaction", "creator-complaint", "startup-breakdown",
    "digital-product-advice", "product-demo", "tutorial",
    "storytime", "short-form", "long-form-youtube", "custom",
  ]),
  name:          z.string().min(1),
  aspectRatio:   z.enum(["9:16", "16:9", "1:1"]),
  cfMention:     z.enum(["off", "subtle", "direct"]),
  targetAudience: z.string().optional(),
  mainOpinion:   z.string().optional(),
  desiredCta:    z.string().optional(),
  videoDuration: z.string().optional(),
  tone:          z.string().optional(),
  sourceUrl:     z.string().optional(),
  /** The user-approved storyboard scenes. Saved as-is — never regenerated. */
  shortForm:     z.custom<ShortFormOutput>((v) => typeof v === "object" && v !== null),
});

type Input = z.infer<typeof InputSchema>;

// ─── Tool ─────────────────────────────────────────────────────────────────────

export const mgSaveAgentTool: MgTool<Input, { projectId: string }> = {
  name:        TOOL_NAME,
  description: "Saves the approved storyboard to a motion_graphics_project",
  inputSchema: InputSchema,

  async execute(ctx: MgToolContext, input: Input) {
    try {
      let projectId: string;

      if (input.existingProjectId) {
        // Update existing project
        const updated = await updateProject(input.existingProjectId, {
          name:           input.name,
          contentMode:    input.contentMode as ContentMode,
          aspectRatio:    input.aspectRatio as AspectRatio,
          cfMention:      input.cfMention as CfMentionMode,
          targetAudience: input.targetAudience,
          mainOpinion:    input.mainOpinion,
          desiredCta:     input.desiredCta,
          videoDuration:  input.videoDuration,
          tone:           input.tone,
          sourceUrl:      input.sourceUrl,
          shortForm:      input.shortForm as ShortFormOutput,
          status:         "draft",
        });
        if (!updated) {
          return mgFail(`Project ${input.existingProjectId} not found`);
        }
        projectId = updated.id;
      } else {
        // Create new project — source_text comes from the run, not this input
        // (Correction 3: don't store source_text in step inputs)
        const created = await createProject(ctx.userId, {
          name:           input.name,
          contentMode:    input.contentMode as ContentMode,
          aspectRatio:    input.aspectRatio as AspectRatio,
          cfMention:      input.cfMention as CfMentionMode,
          targetAudience: input.targetAudience,
          mainOpinion:    input.mainOpinion,
          desiredCta:     input.desiredCta,
          videoDuration:  input.videoDuration,
          tone:           input.tone,
          sourceUrl:      input.sourceUrl,
          shortForm:      input.shortForm as ShortFormOutput,
          status:         "draft",
        });
        projectId = created.id;
      }

      return mgOk({ projectId });
    } catch (err) {
      return mgFail(err instanceof Error ? err.message : "Failed to save project");
    }
  },
};
