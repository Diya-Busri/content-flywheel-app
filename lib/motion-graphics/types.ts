/**
 * Motion Graphics Studio — Canonical Types
 *
 * Single source of truth for the whole feature. Every module (animation
 * registry, Remotion composition, render pipeline, AI script-to-scenes,
 * admin API routes, admin UI) imports its shapes from here.
 *
 * ADMIN ONLY: this entire feature is gated by lib/is-admin.ts at the page
 * layout (app/dashboard/admin/layout.tsx) and on every API route. Nothing
 * in this file is auth-related — see lib/motion-graphics/guard.ts for the
 * re-exported guard used by every motion-graphics route.
 */

// ─── Animation registry ────────────────────────────────────────────────────

/**
 * Every reusable animation component lives in
 * src/remotion/motion-graphics/animations/ and is keyed by one of these ids
 * in ANIMATION_REGISTRY (src/remotion/motion-graphics/animations/index.ts).
 * The AI script-to-scenes step and the admin Scene Editor both pick from
 * this exact union, so an id typo fails type-checking instead of failing
 * silently at render time.
 */
export type AnimationId =
  | "fadeIn"
  | "fadeOut"
  | "slideLeft"
  | "slideRight"
  | "slideUp"
  | "slideDown"
  | "scaleIn"
  | "scaleOut"
  | "rotate"
  | "blurReveal"
  | "glowPulse"
  | "floating"
  | "typewriterText"
  | "wordByWordReveal"
  | "characterReveal"
  | "numberCounter"
  | "progressBar"
  | "loadingAnimation"
  | "cameraZoom"
  | "pan"
  | "shake"
  | "bounce"
  | "particleBurst"
  | "confetti"
  | "spotlightReveal"
  | "cardStack"
  | "carousel"
  | "logoReveal"
  | "ctaEnding"
  | "timelineProgress"
  | "animatedBackground"
  | "punchIn";

/**
 * Plain-data mirror of the AnimationId union, kept in sync by hand (this file
 * has no React/Remotion dependency, so server-only modules like
 * lib/motion-graphics/ai-script-to-scenes.ts can import just this array
 * instead of pulling in src/remotion/motion-graphics/animations/index.tsx,
 * which imports React + Remotion + lucide-react components).
 * src/remotion/motion-graphics/animations/index.tsx derives its own
 * `ANIMATION_IDS` from `Object.keys(ANIMATION_REGISTRY)`, so if the two ever
 * drift, a type error in that file's `Record<AnimationId, ...>` will catch it.
 */
export const ANIMATION_ID_LIST: AnimationId[] = [
  "fadeIn",
  "fadeOut",
  "slideLeft",
  "slideRight",
  "slideUp",
  "slideDown",
  "scaleIn",
  "scaleOut",
  "rotate",
  "blurReveal",
  "glowPulse",
  "floating",
  "typewriterText",
  "wordByWordReveal",
  "characterReveal",
  "numberCounter",
  "progressBar",
  "loadingAnimation",
  "cameraZoom",
  "pan",
  "shake",
  "bounce",
  "particleBurst",
  "confetti",
  "spotlightReveal",
  "cardStack",
  "carousel",
  "logoReveal",
  "ctaEnding",
  "timelineProgress",
  "animatedBackground",
  "punchIn",
];

export type AnimationCategory =
  | "transition" // entrance/exit/ambient transforms applied to any element
  | "text" // text-reveal / kinetic-typography effects
  | "camera" // whole-frame camera-style motion
  | "particle" // particle / celebratory effects
  | "composite"; // higher-level, opinionated building blocks (logo reveal, CTA card, etc.)

/** Generic knobs shared by every animation component's props. */
export interface BaseAnimationProps {
  /** Frame (relative to the Sequence/scene) the animation begins on. */
  startFrame?: number;
  /** How many frames the animation's own motion takes (not the hold time). */
  durationInFrames?: number;
  className?: string;
  style?: React.CSSProperties;
}

// ─── Scene elements ─────────────────────────────────────────────────────────

export type SceneElementType = "text" | "image" | "video" | "icon";

export interface SceneElementAnimation {
  animationId: AnimationId;
  durationInFrames: number;
  /** Frame offset from the scene's start when this animation begins. */
  delayFrames: number;
  /** Optional per-animation config overrides (e.g. slide distance, counter target). */
  config?: Record<string, unknown>;
}

/** A single positioned element inside a scene — text block, image, video, or icon. */
export interface SceneElement {
  id: string;
  type: SceneElementType;
  /** Text content (type "text"), asset URL (image/video), or iconify icon name (icon). */
  content: string;
  /** Layout, in percentage of the frame (0-100), so it's aspect-ratio independent. */
  x: number;
  y: number;
  width: number;
  height: number;
  rotationDeg?: number;
  opacity?: number;
  zIndex?: number;
  /** Text-only styling. */
  color?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  textAlign?: "left" | "center" | "right";
  /** Entrance / exit animation, picked from the Animation Library. */
  animationIn?: SceneElementAnimation;
  animationOut?: SceneElementAnimation;
}

// ─── Scene ──────────────────────────────────────────────────────────────────

export type SceneBackgroundType = "color" | "gradient" | "image" | "video" | "animated";

export interface SceneBackground {
  type: SceneBackgroundType;
  /** CSS color, CSS gradient string, asset URL, or an AnimatedBackground variant key. */
  value: string;
}

export type CameraMovement = "none" | "zoomIn" | "zoomOut" | "panLeft" | "panRight" | "panUp" | "panDown";

export interface SceneCaptions {
  enabled: boolean;
  style: "wordByWord" | "karaoke" | "block";
  fontFamily?: string;
  color?: string;
  highlightColor?: string;
}

export interface SceneSound {
  musicAssetUrl?: string;
  musicVolume?: number; // 0-1
  sfxAssetUrl?: string;
  sfxAtFrame?: number;
}

export interface SceneVoiceover {
  text: string;
  audioAssetUrl?: string;
}

/**
 * A single scene in a Template's timeline.
 * Covers every field requested for the Scene Editor: text, images, video,
 * icons, colours, fonts, timing, duration, transition, background, camera
 * movement, sound, voiceover, captions.
 */
export interface Scene {
  id: string;
  order: number;
  name: string;
  durationInFrames: number;
  background: SceneBackground;
  cameraMovement: CameraMovement;
  transitionIn: AnimationId;
  transitionInDuration: number;
  transitionOut: AnimationId;
  transitionOutDuration: number;
  sound?: SceneSound;
  voiceover?: SceneVoiceover;
  captions: SceneCaptions;
  elements: SceneElement[];
}

// ─── Template ───────────────────────────────────────────────────────────────

export type TemplateCategory =
  | "tiktok"
  | "instagram_reel"
  | "youtube_shorts"
  | "product_demo"
  | "feature_showcase"
  | "tutorial"
  | "promo_video"
  | "landing_page_video"
  | "custom";

export type AspectRatio = "9:16" | "16:9" | "1:1";

export const ASPECT_RATIO_DIMENSIONS: Record<AspectRatio, { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
  "1:1": { width: 1080, height: 1080 },
};

export type TemplateStatus = "draft" | "ready";

/** A full, reusable, reorderable-scene video template. Persisted as motion_graphics_templates. */
export interface Template {
  id: string;
  userId: string;
  name: string;
  category: TemplateCategory;
  aspectRatio: AspectRatio;
  fps: number;
  scenes: Scene[];
  status: TemplateStatus;
  /** The pasted script this template was generated from, if any (AI Integration tab). */
  sourceScript?: string;
  createdAt: string;
  updatedAt: string;
}

/** Shape accepted by POST /api/admin/motion-graphics/templates (id/timestamps server-assigned). */
export type TemplateDraft = Omit<Template, "id" | "userId" | "createdAt" | "updatedAt">;

// ─── Assets ─────────────────────────────────────────────────────────────────

export type AssetKind = "image" | "video" | "logo" | "audio" | "music" | "sfx";

export interface MotionGraphicsAsset {
  id: string;
  userId: string;
  kind: AssetKind;
  name: string;
  url: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  sizeBytes: number;
  mimeType: string;
  createdAt: string;
}

// ─── Rendering / export ────────────────────────────────────────────────────

export type ExportFormat = "mp4" | "gif" | "webm";

export const EXPORT_FORMAT_CODEC: Record<ExportFormat, string> = {
  mp4: "h264",
  webm: "vp8",
  gif: "gif",
};

export type RenderStage = "queued" | "bundling" | "rendering" | "complete" | "error";

/** Persisted render job — motion_graphics_render_jobs table. Polled from the Export panel. */
export interface MotionGraphicsRenderJob {
  id: string;
  templateId: string;
  userId: string;
  format: ExportFormat;
  aspectRatio: AspectRatio;
  stage: RenderStage;
  progress: number; // 0-100
  message: string;
  outputUrl?: string;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

// ─── AI script-to-scenes ───────────────────────────────────────────────────

/** Request body for POST /api/admin/motion-graphics/ai/generate. */
export interface ScriptToVideoRequest {
  script: string;
  category: TemplateCategory;
  aspectRatio: AspectRatio;
  /** Optional style hint, e.g. "energetic", "calm product demo". */
  tone?: string;
  /**
   * ElevenLabs voice id to auto-generate voiceover audio with. If omitted,
   * scenes are still assigned voiceover text but no audio is generated —
   * the admin can generate it later per-scene in the Scene Editor.
   */
  voiceId?: string;
}

// ─── Future AI Automation architecture ─────────────────────────────────────
//
// The end-to-end goal (per product spec) is:
//   Research → Script → Images → Voice → Motion Graphics → Final Render
// without redesigning this system later. Each stage below is typed now so
// a future stage can be implemented as a pure function
// `(input: StageInput) => Promise<StageOutput>` and slotted into
// `runAutomationPipeline` without touching Template/Scene/Render types.
// Only the "Motion Graphics" and "Final Render" stages are implemented
// today (this feature); the rest are typed stubs.

export interface ResearchStageInput {
  topic: string;
  sourceUrls?: string[];
}
export interface ResearchStageOutput {
  summary: string;
  keyPoints: string[];
  citations: { url: string; note: string }[];
}

export interface ScriptStageInput {
  research: ResearchStageOutput;
  category: TemplateCategory;
  tone?: string;
}
export interface ScriptStageOutput {
  script: string;
}

export interface ImagesStageInput {
  script: ScriptStageOutput;
  aspectRatio: AspectRatio;
}
export interface ImagesStageOutput {
  /** Generated/selected image or video asset URLs, keyed by rough scene index. */
  assetsBySceneIndex: Record<number, string[]>;
}

export interface VoiceStageInput {
  script: ScriptStageOutput;
  voiceId?: string;
}
export interface VoiceStageOutput {
  /** Audio asset URL per scene index, aligned with ImagesStageOutput. */
  audioBySceneIndex: Record<number, string>;
}

export interface MotionGraphicsStageInput {
  script: ScriptStageOutput;
  images: ImagesStageOutput;
  voice: VoiceStageOutput;
  category: TemplateCategory;
  aspectRatio: AspectRatio;
}
export type MotionGraphicsStageOutput = TemplateDraft;

export interface FinalRenderStageInput {
  template: Template;
  format: ExportFormat;
}
export type FinalRenderStageOutput = MotionGraphicsRenderJob;

/**
 * Full pipeline input. Stages before "motionGraphics" are TODO (v2/v3) —
 * this type exists so the admin UI and API surface don't need to change
 * shape when they're implemented; only the stage functions get filled in.
 */
export interface AutomationPipelineInput {
  research?: ResearchStageInput;
  scriptOverride?: string; // skip research+script stages by pasting a script directly (implemented today)
  category: TemplateCategory;
  aspectRatio: AspectRatio;
  format: ExportFormat;
}

// ─── Content Production System — AI Content Flywheel ───────────────────────
// Phase 1–10 types for the repeatable AI content-production system.
// Content flows: Reddit post → structured analysis → storyboard → Remotion.

export type ContentMode =
  | "reddit-reaction"
  | "creator-complaint"
  | "startup-breakdown"
  | "digital-product-advice"
  | "product-demo"
  | "tutorial"
  | "storytime"
  | "short-form"
  | "long-form-youtube"
  | "custom";

export type CfMentionMode = "off" | "subtle" | "direct";

/** Visual types for each storyboard scene — drives the Reddit Reaction composition. */
export type StoryboardVisualType =
  | "reddit-card"
  | "kinetic-text"
  | "icon-scene"
  | "diagram"
  | "screen-recording"
  | "app-demo"
  | "b-roll-placeholder"
  | "quote-card"
  | "outro";

/** A single scene in the AI-generated storyboard, before compilation to Remotion Scene. */
export interface StoryboardScene {
  id: string;
  /** Seconds from video start. */
  startTime: number;
  /** Seconds — endTime - startTime = scene duration. */
  endTime: number;
  narration: string;
  onScreenText: string;
  visualType: StoryboardVisualType;
  animationPreset: AnimationId;
  transitionPreset: AnimationId;
  /** Human-readable suggestions for what asset to upload/select. */
  assetSuggestions: string[];
  soundEffect?: string;
  /** Words to highlight/emphasise in captions. */
  emphasisWords?: string[];
  /** Asset URL selected by the user from Asset Library or uploaded. */
  assetUrl?: string;
  /** True when the scene requires an asset but none has been assigned yet. */
  missingAsset?: boolean;
  /**
   * Reddit-card only: the real username to show.
   * Never auto-generated — only set if the user supplied it.
   */
  redditAuthor?: string;
  /**
   * Reddit-card only: when true, the author is shown as "u/[hidden]"
   * even if redditAuthor is set.
   */
  anonymiseAuthor?: boolean;
}

/** AI analysis of the source content (Reddit post, complaint, etc.). */
export interface ContentAnalysis {
  coreProblem: string;
  emotionalAngle: string;
  audience: string;
  keyInsight: string;
  contentOpportunity: string;
}

/** The 30–60 second short-form video plan. */
export interface ShortFormOutput {
  title: string;
  hook: string;
  /** Full narration script. */
  script: string;
  durationSeconds: number;
  callToAction: string;
  scenes: StoryboardScene[];
}

/** A single chapter in the long-form plan. */
export interface LongFormChapter {
  title: string;
  /** What this chapter needs to accomplish. */
  purpose: string;
  /** Full narration draft for this chapter. */
  narration: string;
  visualPlan: string[];
  bRollSuggestions: string[];
  appDemoSteps?: string[];
  estimatedDurationSeconds: number;
}

/** The 5–10 minute long-form video plan (no full renderer yet — planning only). */
export interface LongFormOutput {
  titleOptions: string[];
  thumbnailTextOptions: string[];
  openingHook: string;
  estimatedDurationMinutes: number;
  chapters: LongFormChapter[];
  conclusion: string;
  callToAction: string;
}

export type ContentProjectStatus =
  | "draft"
  | "needs_assets"
  | "ready_to_render"
  | "rendering"
  | "complete"
  | "failed";

/** A full AI content project — persisted as motion_graphics_projects. */
export interface ContentProject {
  id: string;
  userId: string;
  name: string;
  contentMode: ContentMode;
  sourceText: string;
  sourceUrl?: string;
  targetAudience?: string;
  mainOpinion?: string;
  desiredCta?: string;
  cfMention: CfMentionMode;
  videoDuration?: string;
  tone?: string;
  aspectRatio: AspectRatio;
  analysis?: ContentAnalysis;
  shortForm?: ShortFormOutput;
  longForm?: LongFormOutput;
  /** Linked template id (created when user triggers render). */
  templateId?: string;
  /** Linked render job id. */
  renderJobId?: string;
  /** Output URL once rendered. */
  outputUrl?: string;
  status: ContentProjectStatus;
  createdAt: string;
  updatedAt: string;
}

/** Request body for POST /api/admin/motion-graphics/ai/reddit-generate. */
export interface RedditGenerateRequest {
  contentMode: ContentMode;
  sourceText: string;
  sourceUrl?: string;
  targetAudience?: string;
  mainOpinion?: string;
  desiredCta?: string;
  cfMention: CfMentionMode;
  videoDuration?: string;
  tone?: string;
  aspectRatio: AspectRatio;
}

/** Props for the Reddit Reaction Remotion composition. */
export interface RedditReactionCompositionProps {
  projectName: string;
  aspectRatio: AspectRatio;
  scenes: StoryboardScene[];
  brandAccent: string;
  brandBg: string;
}

export const DEFAULT_REDDIT_REACTION_PROPS: RedditReactionCompositionProps = {
  projectName: "",
  aspectRatio: "9:16",
  scenes: [],
  brandAccent: "#F89520",
  brandBg: "#0d0d0d",
};
