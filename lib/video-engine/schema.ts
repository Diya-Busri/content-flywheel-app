/**
 * CF Video Engine – Canonical Schema
 *
 * This is the single source of truth for the entire video generation pipeline.
 * Every module (scene-planner, asset-orchestrator, voice-engine, renderer, critic-agent)
 * reads from and writes to these types.
 *
 * Data flow:
 *   VideoAgent JSON → scene-planner → VideoScene[]
 *                                          │
 *                    ┌─────────────────────┴───────────────────────┐
 *                    ▼                                             ▼
 *          asset-orchestrator                              voice-engine
 *          (SceneAssetPlan[])                         (VoiceoverJob[])
 *                    │                                             │
 *                    └─────────────────────┬───────────────────────┘
 *                                          ▼
 *                                       renderer
 *                                    (RenderJob → MP4)
 */

// ─── Scene type ───────────────────────────────────────────────────────────────

/**
 * How the visual layer for this scene will be produced.
 *
 * ai_visual       → Generate with Higgsfield (TODO v2)
 * app_screenshot  → Use an uploaded screenshot of the CF dashboard/feature
 * product_mockup  → Use an uploaded product image (eBook, template, POD item)
 * cta             → Render as a full-screen text/CTA slide via Remotion (TODO v2)
 * text_slide      → Render as a text-only slide via Remotion (TODO v2)
 */
export type SceneType =
  | "ai_visual"
  | "app_screenshot"
  | "product_mockup"
  | "cta"
  | "text_slide";

// ─── Core scene ───────────────────────────────────────────────────────────────

/**
 * A single scene in the video pipeline.
 * Produced by scene-planner; consumed by every downstream module.
 */
export type VideoScene = {
  /** Stable identifier — scene_1, scene_2, … */
  id: string;

  /** 1-indexed position in the video */
  sceneNumber: number;

  /** Duration in seconds (parsed from agent string, e.g. "3–5 seconds" → 4) */
  durationSeconds: number;

  /**
   * How the visual will be sourced.
   * scene-planner infers this from keywords in the agent visual description.
   */
  sceneType: SceneType;

  /**
   * For ai_visual: descriptive prompt for Higgsfield or image-generation model.
   * Derived from the agent's `visual` field.
   * TODO (v2): pass this to Higgsfield API to generate a clip.
   */
  visualPrompt?: string;

  /**
   * For app_screenshot / product_mockup: a pre-uploaded asset URL.
   * Populated by the admin when they attach an asset to the scene.
   * TODO (v2): wire into a file-upload step in the engine UI.
   */
  assetUrl?: string;

  /** Full voiceover text for this scene. Passed to voice-engine for TTS. */
  voiceover: string;

  /** Text that appears on screen during this scene (caption, headline, etc.) */
  onScreenText: string;

  /**
   * Transition to apply between this scene and the next.
   * Defaults to "fade". Options: fade | cut | slideUp | slideLeft | zoom
   * TODO (v2): pass to renderer/Remotion composition.
   */
  transition?: "fade" | "cut" | "slideUp" | "slideLeft" | "zoom";
};

// ─── Engine project ───────────────────────────────────────────────────────────

/**
 * A complete video project ready to enter the pipeline.
 * Created by scene-planner from the Video Agent output.
 */
export type VideoEngineProject = {
  /** UUID generated at plan time */
  id: string;

  /** ISO timestamp */
  createdAt: string;

  /** Derived from Video Agent goal field */
  title: string;

  platform: "TikTok" | "Instagram Reels" | "YouTube Shorts";

  /** Vertical video for all short-form platforms */
  aspectRatio: "9:16" | "16:9";

  scenes: VideoScene[];

  /** Platform caption (passed through from Video Agent) */
  caption: string;

  /** Hashtag strings including # prefix */
  hashtags: string[];

  /** Spoken CTA line (last line of the script) */
  cta: string;

  /**
   * Pipeline status.
   * draft        → scenes planned, no assets yet
   * assets_ready → all scene assets resolved
   * rendering    → renderer is producing the MP4
   * complete     → MP4 ready
   */
  status: "draft" | "assets_ready" | "rendering" | "complete";
};

// ─── Asset plan ───────────────────────────────────────────────────────────────

/**
 * Per-scene asset resolution plan produced by asset-orchestrator.
 * Describes what is needed and how it will be sourced.
 */
export type SceneAssetPlan = {
  sceneId: string;
  sceneNumber: number;
  sceneType: SceneType;

  /** Human-readable description of how this scene's visual will be produced */
  strategy: string;

  /** Any extra instructions or notes for the admin */
  notes: string;

  /** Whether the asset is already available (assetUrl is set) */
  ready: boolean;

  /** Resolved asset URL, if available */
  assetUrl?: string;
};

// ─── Voice job ────────────────────────────────────────────────────────────────

/**
 * A TTS generation job for one scene.
 * Produced by voice-engine.
 * TODO (v2): pass voiceoverText to ElevenLabs; store result in audioUrl.
 */
export type VoiceoverJob = {
  sceneId: string;
  sceneNumber: number;
  voiceoverText: string;
  durationSeconds: number;

  /** ElevenLabs voice ID to use. TODO (v2): make configurable per project. */
  voiceId?: string;

  /** Set once TTS is complete */
  audioUrl?: string;

  status: "pending" | "generating" | "done" | "error";
};

// ─── Render job ───────────────────────────────────────────────────────────────

/**
 * A full-video render job produced by renderer.
 * TODO (v2): drive a Remotion Lambda or Creatomate composition.
 */
export type RenderJob = {
  projectId: string;
  scenes: VideoScene[];
  assetPlans: SceneAssetPlan[];
  voiceoverJobs: VoiceoverJob[];

  aspectRatio: "9:16" | "16:9";
  outputFormat: "mp4";

  /** Set once render is complete */
  outputUrl?: string;

  status: "pending" | "rendering" | "complete" | "error";
  createdAt: string;
};

// ─── Critic report ────────────────────────────────────────────────────────────

/**
 * Output of critic-agent. Flags structural issues before rendering begins.
 */
export type CriticIssue = {
  severity: "warning" | "error";
  sceneId?: string;
  field?: keyof VideoScene;
  message: string;
  suggestion?: string;
};

export type CriticReport = {
  projectId: string;
  issues: CriticIssue[];
  passed: boolean;
  summary: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Parse a duration string from the Video Agent into seconds.
 * Handles: "5 seconds", "3–5s", "0:05", "5", bare numbers.
 * Exported so page components can reuse this without duplicating the logic.
 */
export function parseDurationSeconds(raw: string): number {
  const s = raw.toLowerCase().trim();
  // Range: "3-5 seconds" or "3–5s" → average
  const range = s.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/);
  if (range) return Math.round((parseFloat(range[1]) + parseFloat(range[2])) / 2);
  // Colon: "0:05" or "1:30"
  const colon = s.match(/^(\d+):(\d{2})$/);
  if (colon) return parseInt(colon[1]) * 60 + parseInt(colon[2]);
  // Plain number, "5s", "5 seconds", "5 sec"
  const num = parseFloat(s);
  if (!isNaN(num) && num > 0) return Math.round(num);
  return 5;
}
