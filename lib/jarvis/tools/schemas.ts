import { z } from "zod";
import type {
  OfferAnalysis,
  MissingInfoQuestion,
  ContentAssetType,
  ContentStrategyAssetPlan,
} from "@/db/schema/jarvis-schema";

/**
 * Shared zod schemas used across Jarvis tool boundaries. These both validate
 * runtime input/output (including AI-generated JSON, which must never be
 * trusted blindly) and serve as the single definition each tool's TypeScript
 * input/output types are inferred from. Where a schema represents a shape
 * that's also persisted (db/schema/jarvis-schema.ts), it's typed against
 * that canonical type so the two can't silently drift apart.
 */

export const businessProfileSummarySchema = z
  .object({
    hasProfile: z.boolean(),
    brandName: z.string().nullable(),
    niche: z.string().nullable(),
    brandVoiceTone: z.string().nullable(),
    targetAudience: z.string().nullable(),
    writingStyle: z.string().nullable(),
    platformFocus: z.array(z.string()),
  })
  .strict();
export type BusinessProfileSummary = z.infer<typeof businessProfileSummarySchema>;

export const productSummarySchema = z
  .object({
    id: z.string(),
    title: z.string(),
    niche: z.string(),
    format: z.string(),
    status: z.string(),
    priceLabel: z.string().nullable(),
    isPublished: z.boolean(),
  })
  .strict();
export type ProductSummary = z.infer<typeof productSummarySchema>;

export const memorySummarySchema = z
  .object({
    id: z.string(),
    category: z.string(),
    title: z.string(),
    summary: z.string(),
  })
  .strict();
export type MemorySummary = z.infer<typeof memorySummarySchema>;

export const existingContentSummarySchema = z
  .object({
    recentScripts: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        platform: z.string(),
        createdAt: z.string(),
      }).strict(),
    ),
    recentEmails: z.array(
      z.object({
        id: z.string(),
        subject: z.string(),
        status: z.string(),
        createdAt: z.string(),
      }).strict(),
    ),
  })
  .strict();
export type ExistingContentSummary = z.infer<typeof existingContentSummarySchema>;

export const offerAnalysisSchema: z.ZodType<OfferAnalysis> = z
  .object({
    strengths: z.array(z.string()).max(10),
    gaps: z.array(z.string()).max(10),
    recommendedAngles: z.array(z.string()).max(10),
    urgencyIdeas: z.array(z.string()).max(10),
  })
  .strict();

export const missingInfoQuestionSchema: z.ZodType<MissingInfoQuestion> = z
  .object({
    key: z.string(),
    question: z.string(),
    placeholder: z.string().optional(),
  })
  .strict();

export const contentAssetTypeSchema: z.ZodType<ContentAssetType> = z.enum([
  "video_script",
  "carousel",
  "email",
]);

export const contentStrategyAssetPlanSchema: z.ZodType<ContentStrategyAssetPlan> = z
  .object({
    assetType: contentAssetTypeSchema,
    count: z.number().int().min(1).max(5),
    angle: z.string(),
    notes: z.string().optional(),
  })
  .strict();

/** What the AI itself returns for create_content_strategy — the tool merges
 * this with the offerAnalysis it already has and a generatedAt timestamp to
 * build the full JarvisPlan stored on the run. */
export const strategyAiOutputSchema = z
  .object({
    objectiveSummary: z.string().min(1).max(600),
    assetPlan: z.array(contentStrategyAssetPlanSchema).min(1).max(3),
    missingInfo: z.array(missingInfoQuestionSchema).max(4),
  })
  .strict();
export type StrategyAiOutput = z.infer<typeof strategyAiOutputSchema>;

/* ─── save_content_campaign input — only the content fields needed to
   persist each approved asset type, not the full ProposedAsset shape
   (status/edited/savedRef are orchestrator/DB concerns, not tool input). ─── */

export const videoScriptForSaveSchema = z
  .object({
    id: z.string(),
    type: z.literal("video_script"),
    platform: z.string().min(1).max(40),
    title: z.string().min(1).max(200),
    hook: z.string().min(1).max(400),
    script: z.string().min(1).max(4000),
    cta: z.string().min(1).max(300),
  })
  .strict();

export const carouselForSaveSchema = z
  .object({
    id: z.string(),
    type: z.literal("carousel"),
    platform: z.string().min(1).max(40),
    title: z.string().min(1).max(200),
    slides: z.array(z.string().min(1).max(300)).min(1).max(10),
    caption: z.string().min(1).max(1000),
    hashtags: z.array(z.string().min(1).max(40)).max(15),
  })
  .strict();

export const emailForSaveSchema = z
  .object({
    id: z.string(),
    type: z.literal("email"),
    name: z.string().min(1).max(200),
    subject: z.string().min(1).max(200),
    previewText: z.string().min(1).max(200),
    bodyHtml: z.string().min(1).max(8000),
  })
  .strict();

export const assetForSaveSchema = z.discriminatedUnion("type", [
  videoScriptForSaveSchema,
  carouselForSaveSchema,
  emailForSaveSchema,
]);
export type AssetForSave = z.infer<typeof assetForSaveSchema>;
