/**
 * CF Video Engine – Renderer
 *
 * Responsibility: Compose all scene assets + voiceovers into a final vertical MP4.
 *
 * V1 status: PLACEHOLDER — buildRenderJob() constructs the job object but does
 * not submit it to any rendering service. All jobs are returned with status "pending".
 *
 * TODO (v2 — Remotion Lambda):
 *   The app already has Creatomate and FAL configured (see .env).
 *   Choose one of:
 *
 *   Option A — Remotion Lambda (recommended for custom layouts):
 *     Install @remotion/lambda, deploy a Lambda function with the CF composition,
 *     then call renderMediaOnLambda() here:
 *       import { renderMediaOnLambda } from "@remotion/lambda";
 *       const { renderId } = await renderMediaOnLambda({ ... });
 *
 *   Option B — Creatomate (faster setup, template-based):
 *     POST https://api.creatomate.com/v1/renders
 *     Headers: { Authorization: `Bearer ${process.env.CREATOMATE_API_KEY}` }
 *     Body: { template_id, modifications: { scene data } }
 *     Already integrated in the app — check /app/api/ for existing Creatomate calls.
 *
 *   Option C — ffmpeg on a server/Edge function:
 *     Use fluent-ffmpeg to concat scene clips and overlay captions.
 *     Best for simple slideshow-style videos (no Remotion animations).
 *
 * Remotion composition spec (for when you build it):
 *   - Input: VideoScene[] + SceneAssetPlan[] + VoiceoverJob[]
 *   - Output: 1080×1920 (9:16) MP4, 30fps
 *   - Each scene: clip/image layer + text overlay + optional transition
 *   - Audio: per-scene voiceover stitched to total duration
 *   - Caption: word-level karaoke captions synced to voiceover timing
 */

import {
  VideoEngineProject,
  SceneAssetPlan,
  VoiceoverJob,
  RenderJob,
} from "./schema";

// ─── V1 placeholder ───────────────────────────────────────────────────────────

/**
 * Build a RenderJob from a fully-resolved project.
 * V1: returns a pending job. No render service is called.
 * V2: submit to Remotion Lambda / Creatomate and poll for completion.
 *
 * @param project  - The VideoEngineProject (all scenes, metadata)
 * @param assets   - Resolved asset plans (all must have ready = true before rendering)
 * @param voiceovers - Completed voiceover jobs (all must have audioUrl set)
 */
export function buildRenderJob(
  project: VideoEngineProject,
  assets: SceneAssetPlan[],
  voiceovers: VoiceoverJob[]
): RenderJob {
  // TODO (v2): validate that all assets are ready and all voiceovers have audioUrl
  // before submitting. For now we just build the job object.
  return {
    projectId: project.id,
    scenes: project.scenes,
    assetPlans: assets,
    voiceoverJobs: voiceovers,
    aspectRatio: project.aspectRatio,
    outputFormat: "mp4",
    outputUrl: undefined,  // set once render completes
    status: "pending",
    createdAt: new Date().toISOString(),
  };
}

/**
 * Check whether a project is ready to hand off to the renderer.
 * Both conditions must be true before submitRender() is called.
 */
export function isReadyToRender(
  assets: SceneAssetPlan[],
  voiceovers: VoiceoverJob[]
): boolean {
  const assetsOk = assets.every((a) => a.ready);
  const voiceoversOk = voiceovers.every((v) => v.status === "done" && Boolean(v.audioUrl));
  return assetsOk && voiceoversOk;
}

/**
 * TODO (v2 — Creatomate integration):
 *
 * async function submitRender(job: RenderJob): Promise<RenderJob> {
 *   const resp = await fetch("https://api.creatomate.com/v1/renders", {
 *     method: "POST",
 *     headers: {
 *       Authorization: `Bearer ${process.env.CREATOMATE_API_KEY}`,
 *       "Content-Type": "application/json",
 *     },
 *     body: JSON.stringify({
 *       template_id: process.env.CREATOMATE_CF_TEMPLATE_ID,
 *       modifications: buildCreatomateModifications(job),
 *     }),
 *   });
 *   const data = await resp.json();
 *   return { ...job, status: "rendering", outputUrl: undefined };
 * }
 *
 * function buildCreatomateModifications(job: RenderJob) {
 *   return job.scenes.map((scene, i) => ({
 *     [`scene_${i + 1}_asset`]: job.assetPlans[i]?.assetUrl ?? "",
 *     [`scene_${i + 1}_voiceover`]: job.voiceoverJobs[i]?.audioUrl ?? "",
 *     [`scene_${i + 1}_text`]: scene.onScreenText,
 *     [`scene_${i + 1}_duration`]: scene.durationSeconds,
 *   }));
 * }
 */
