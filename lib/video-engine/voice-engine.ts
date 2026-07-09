/**
 * CF Video Engine – Voice Engine
 *
 * Responsibility: Generate a TTS voiceover audio file for each scene.
 *
 * V1 status: PLACEHOLDER — all functions return mock jobs with status "pending".
 *
 * TODO (v2 — ElevenLabs):
 *   The app already has ELEVENLABS_API_KEY in .env and uses ElevenLabs elsewhere.
 *   Wire generateVoiceover() to:
 *     POST https://api.elevenlabs.io/v1/text-to-speech/{voiceId}
 *     Headers: { xi-api-key: process.env.ELEVENLABS_API_KEY }
 *     Body: { text, model_id: "eleven_turbo_v2", voice_settings: { stability, similarity_boost } }
 *   Upload the returned audio buffer to Supabase storage (bucket: "timeline-media")
 *   and store the public URL in VoiceoverJob.audioUrl.
 *
 * TODO (v2 — per-scene stitching):
 *   Once all scenes have audioUrl set, call /api/video-timeline/concat-voiceover
 *   to merge into a single continuous track that matches video duration.
 *
 * Recommended ElevenLabs voice IDs for Content Flywheel:
 *   "21m00Tcm4TlvDq8ikWAM"   Rachel — warm, clear, natural (good default)
 *   "AZnzlk1XvdvUeBnXmlld"   Domi  — energetic, direct (good for hooks)
 *   "MF3mGyEYCl7XYWbV9V6O"   Elli  — friendly, conversational
 */

import { VideoScene, VoiceoverJob, VideoEngineProject } from "./schema";

// ─── Config ───────────────────────────────────────────────────────────────────

export const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // Rachel

export type VoiceEngineConfig = {
  voiceId?: string;
  stability?: number;        // 0–1; default 0.5
  similarityBoost?: number;  // 0–1; default 0.75
  modelId?: string;          // default "eleven_turbo_v2"
};

// ─── V1 placeholder ───────────────────────────────────────────────────────────

/**
 * Build a VoiceoverJob for a single scene.
 * V1: returns a pending job — no API call is made.
 * V2: call ElevenLabs and populate audioUrl.
 */
export function buildVoiceoverJob(
  scene: VideoScene,
  config: VoiceEngineConfig = {}
): VoiceoverJob {
  // TODO (v2): make the ElevenLabs API call here and set audioUrl + status "done"
  return {
    sceneId: scene.id,
    sceneNumber: scene.sceneNumber,
    voiceoverText: scene.voiceover,
    durationSeconds: scene.durationSeconds,
    voiceId: config.voiceId ?? DEFAULT_VOICE_ID,
    audioUrl: undefined,   // set after TTS generation
    status: "pending",
  };
}

/**
 * Build VoiceoverJobs for all scenes in a project.
 * V1: returns all jobs as "pending".
 */
export function planVoiceovers(
  project: VideoEngineProject,
  config: VoiceEngineConfig = {}
): VoiceoverJob[] {
  return project.scenes.map((scene) => buildVoiceoverJob(scene, config));
}

/**
 * Estimate the total voiceover duration in seconds.
 * Useful for checking whether the TTS audio will fit the intended video length.
 */
export function estimateTotalDuration(scenes: VideoScene[]): number {
  return scenes.reduce((sum, s) => sum + s.durationSeconds, 0);
}

/**
 * TODO (v2 — ElevenLabs integration):
 *
 * async function generateVoiceover(job: VoiceoverJob, config: VoiceEngineConfig): Promise<VoiceoverJob> {
 *   const resp = await fetch(
 *     `https://api.elevenlabs.io/v1/text-to-speech/${job.voiceId ?? DEFAULT_VOICE_ID}`,
 *     {
 *       method: "POST",
 *       headers: {
 *         "xi-api-key": process.env.ELEVENLABS_API_KEY!,
 *         "Content-Type": "application/json",
 *       },
 *       body: JSON.stringify({
 *         text: job.voiceoverText,
 *         model_id: config.modelId ?? "eleven_turbo_v2",
 *         voice_settings: {
 *           stability: config.stability ?? 0.5,
 *           similarity_boost: config.similarityBoost ?? 0.75,
 *         },
 *       }),
 *     }
 *   );
 *   if (!resp.ok) throw new Error(`ElevenLabs error: ${resp.status}`);
 *   const audioBuffer = await resp.arrayBuffer();
 *   const audioUrl = await uploadToSupabase(job.sceneId, audioBuffer); // TODO: implement
 *   return { ...job, audioUrl, status: "done" };
 * }
 */
