/**
 * CF Video Engine – Scene Planner
 *
 * Responsibility: Convert raw Video Agent output into a validated VideoEngineProject.
 *
 * This is the entry point for the entire engine pipeline.
 * Nothing downstream should ever read Video Agent JSON directly — it must go
 * through this module first so the rest of the pipeline operates on a stable schema.
 *
 * Usage:
 *   import { planProject } from "@/lib/video-engine/scene-planner";
 *   const project = planProject(agentOutput, { goal, platform });
 */

import {
  VideoScene,
  VideoEngineProject,
  SceneType,
  parseDurationSeconds,
} from "./schema";

// ─── Input shape (mirrors VideoAgentOutput from video-agent-prompt.ts) ────────
// Defined locally so scene-planner doesn't tightly couple to the prompt module.

type AgentScene = {
  scene: number;
  duration: string;
  visual: string;
  voiceover: string;
  onScreenText: string;
};

export type AgentOutput = {
  hooks: string[];
  bestHook: string;
  script: string;
  scenes: AgentScene[];
  caption: string;
  hashtags: string[];
  cta: string;
};

export type PlanOptions = {
  /** The original Video Agent goal field — used as the project title */
  goal: string;
  platform: "TikTok" | "Instagram Reels" | "YouTube Shorts";
};

// ─── Scene type inference ─────────────────────────────────────────────────────

/**
 * Decide how the visual layer for this scene should be produced.
 * Pure keyword heuristics — no AI call needed.
 *
 * Priority order (first match wins):
 *  1. CTA   — last scene + CTA-flavoured text
 *  2. App screenshot — mentions dashboard, feature, screen, click, etc.
 *  3. Product mockup — mentions ebook, template, print, mockup, product
 *  4. Text slide — minimal visual description (≤ 6 words) or no visual at all
 *  5. AI visual — default; Higgsfield will generate from the prompt
 */
function inferSceneType(
  scene: AgentScene,
  isLastScene: boolean
): SceneType {
  const haystack = [scene.visual, scene.voiceover, scene.onScreenText]
    .join(" ")
    .toLowerCase();

  const visualWords = scene.visual.trim().split(/\s+/).length;

  // 1. CTA
  if (
    isLastScene &&
    /\b(cta|call.?to.?action|sign.?up|free.?trial|try|start|join|link.?in.?bio|click|visit|subscribe)\b/.test(
      haystack
    )
  ) {
    return "cta";
  }

  // 2. App screenshot
  if (
    /\b(app|dashboard|screen(shot)?|interface|feature|platform|tool|click|tap|scroll|ui|menu|button|page|modal|sidebar|panel)\b/.test(
      haystack
    )
  ) {
    return "app_screenshot";
  }

  // 3. Product mockup
  if (
    /\b(ebook|e-book|template|canva|printify|printful|mockup|product|digital product|print.?on.?demand|pod|shirt|mug|tote|hoodie|swipe.?file|course|notion|worksheet)\b/.test(
      haystack
    )
  ) {
    return "product_mockup";
  }

  // 4. Text slide — very short visual description = no real visual content described
  if (visualWords <= 5 || scene.visual.trim() === "") {
    return "text_slide";
  }

  // 5. Default
  return "ai_visual";
}

/**
 * Choose a scene transition.
 * CTAs get a dramatic zoom; the opening scene cuts hard; everything else fades.
 */
function inferTransition(
  scene: AgentScene,
  sceneType: SceneType,
  isFirstScene: boolean
): VideoScene["transition"] {
  if (isFirstScene) return "cut";
  if (sceneType === "cta") return "zoom";
  if (sceneType === "text_slide") return "slideUp";
  return "fade";
}

// ─── Core planner ─────────────────────────────────────────────────────────────

/**
 * Normalise a single agent scene into an engine VideoScene.
 */
function planScene(
  agentScene: AgentScene,
  totalScenes: number
): VideoScene {
  const isFirstScene = agentScene.scene === 1;
  const isLastScene = agentScene.scene === totalScenes;

  const sceneType = inferSceneType(agentScene, isLastScene);
  const transition = inferTransition(agentScene, sceneType, isFirstScene);
  const durationSeconds = parseDurationSeconds(agentScene.duration);

  return {
    id: `scene_${agentScene.scene}`,
    sceneNumber: agentScene.scene,
    durationSeconds,
    sceneType,
    // visualPrompt is set for AI-generated visuals; left undefined for uploaded assets
    visualPrompt: sceneType === "ai_visual" ? agentScene.visual : undefined,
    // assetUrl is empty on first plan — filled in later when admin uploads assets
    assetUrl: undefined,
    voiceover: agentScene.voiceover,
    onScreenText: agentScene.onScreenText,
    transition,
  };
}

/**
 * Turn a full VideoAgentOutput into a VideoEngineProject.
 *
 * This is the main export — the single function every other module depends on.
 */
export function planProject(
  agentOutput: AgentOutput,
  opts: PlanOptions
): VideoEngineProject {
  if (!Array.isArray(agentOutput.scenes) || agentOutput.scenes.length === 0) {
    throw new Error("scene-planner: agentOutput.scenes must be a non-empty array");
  }

  const totalScenes = agentOutput.scenes.length;

  const scenes: VideoScene[] = agentOutput.scenes.map((s) =>
    planScene(s, totalScenes)
  );

  const aspectRatio =
    opts.platform === "YouTube Shorts" ? "16:9" : "9:16";

  return {
    id: generateProjectId(),
    createdAt: new Date().toISOString(),
    title: opts.goal.slice(0, 120),
    platform: opts.platform,
    aspectRatio,
    scenes,
    caption: agentOutput.caption,
    hashtags: agentOutput.hashtags,
    cta: agentOutput.cta,
    status: "draft",
  };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/** Simple ID — no crypto dependency so this runs in both Node and browser. */
function generateProjectId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 7);
  return `vep_${ts}_${rand}`;
}

/**
 * Return a plain summary of scene type distribution for quick review.
 * Useful for debugging or displaying in the admin UI.
 */
export function summariseSceneTypes(
  scenes: VideoScene[]
): Record<SceneType, number> {
  const counts: Record<SceneType, number> = {
    ai_visual: 0,
    app_screenshot: 0,
    product_mockup: 0,
    cta: 0,
    text_slide: 0,
  };
  for (const s of scenes) counts[s.sceneType]++;
  return counts;
}
