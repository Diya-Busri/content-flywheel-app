/**
 * CF Video Engine – Critic Agent
 *
 * Responsibility: Review a VideoEngineProject for structural issues before
 * assets are sourced or rendering begins. Catches weak hooks, pacing problems,
 * missing CTAs, and content policy violations early — when they're still cheap to fix.
 *
 * V1 status: RULE-BASED — a set of deterministic heuristic checks.
 * No AI call is made in v1; all checks run synchronously in the browser.
 *
 * TODO (v2 — AI critique):
 *   Pass the full project to GPT-4o for a qualitative review:
 *     - Is the hook strong enough? (emotion, curiosity, specificity)
 *     - Does the pacing feel right for the platform?
 *     - Is the CTA clear and specific?
 *     - Does the script respect Content Flywheel's brand voice?
 *   Return structured feedback as additional CriticIssues with severity "warning".
 */

import { VideoEngineProject, VideoScene, CriticReport, CriticIssue } from "./schema";

// ─── Heuristic checks ─────────────────────────────────────────────────────────

/** Hook should be punchy — very short (<4 words) or very long (>20 words) is suspicious */
function checkHookLength(project: VideoEngineProject): CriticIssue[] {
  const firstScene = project.scenes[0];
  if (!firstScene) return [];

  const words = firstScene.voiceover.trim().split(/\s+/).length;
  if (words < 4) {
    return [{
      severity: "warning",
      sceneId: firstScene.id,
      field: "voiceover",
      message: `Opening voiceover is very short (${words} words). The hook may not be compelling enough.`,
      suggestion: "A strong hook is usually 8–15 words. Consider expanding it with a specific pain point or bold claim.",
    }];
  }
  if (words > 25) {
    return [{
      severity: "warning",
      sceneId: firstScene.id,
      field: "voiceover",
      message: `Opening voiceover is long (${words} words). Viewers may scroll past before you hook them.`,
      suggestion: "Trim the opening to the single most powerful sentence — save the explanation for scene 2.",
    }];
  }
  return [];
}

/** Every project should have at least one CTA scene */
function checkCtaPresent(project: VideoEngineProject): CriticIssue[] {
  const hasCtaScene = project.scenes.some((s) => s.sceneType === "cta");
  const hasCta = Boolean(project.cta?.trim());

  if (!hasCtaScene && !hasCta) {
    return [{
      severity: "error",
      message: "No CTA scene found and no CTA text set. Every video needs a clear call to action.",
      suggestion: "Add a final scene with sceneType 'cta' and set the cta field to a specific action.",
    }];
  }
  return [];
}

/** Pacing: all scenes the same length = robotic feel */
function checkMonotonePacing(project: VideoEngineProject): CriticIssue[] {
  if (project.scenes.length < 3) return [];

  const durations = project.scenes.map((s) => s.durationSeconds);
  const allSame = durations.every((d) => d === durations[0]);
  if (allSame) {
    return [{
      severity: "warning",
      message: `All ${project.scenes.length} scenes have the same duration (${durations[0]}s). This creates robotic pacing.`,
      suggestion: "Vary scene lengths: make the hook scene shorter (2–3s) and expand the value scenes (5–7s).",
    }];
  }
  return [];
}

/** Total runtime check: short-form should be 25–60 seconds */
function checkTotalDuration(project: VideoEngineProject): CriticIssue[] {
  const total = project.scenes.reduce((sum, s) => sum + s.durationSeconds, 0);
  const issues: CriticIssue[] = [];

  if (total < 15) {
    issues.push({
      severity: "warning",
      message: `Total video length is only ${total}s — likely too short to deliver value.`,
      suggestion: "Aim for 25–45 seconds for TikTok/Reels. Add more scenes or extend existing ones.",
    });
  }
  if (total > 90) {
    issues.push({
      severity: "warning",
      message: `Total video length is ${total}s — may be too long for short-form platforms.`,
      suggestion: "Keep TikTok/Reels videos under 60 seconds. Trim the middle scenes.",
    });
  }
  return issues;
}

/** Flag scenes with no voiceover — they'll be dead air */
function checkEmptyVoiceovers(project: VideoEngineProject): CriticIssue[] {
  return project.scenes
    .filter((s) => !s.voiceover?.trim())
    .map((s) => ({
      severity: "error" as const,
      sceneId: s.id,
      field: "voiceover" as const,
      message: `Scene ${s.sceneNumber} has no voiceover text.`,
      suggestion: "Every scene should have narration. Add voiceover text or merge this scene with an adjacent one.",
    }));
}

/** Flag scenes with no on-screen text — misses a reinforcement opportunity */
function checkEmptyOnScreenText(project: VideoEngineProject): CriticIssue[] {
  return project.scenes
    .filter((s) => s.sceneType !== "ai_visual" && !s.onScreenText?.trim())
    .map((s) => ({
      severity: "warning" as const,
      sceneId: s.id,
      field: "onScreenText" as const,
      message: `Scene ${s.sceneNumber} (${s.sceneType}) has no on-screen text.`,
      suggestion: "Add a short text overlay to reinforce the spoken message — viewers often watch without sound.",
    }));
}

/** Brand guardrail: flag income claims */
function checkBrandGuardrails(project: VideoEngineProject): CriticIssue[] {
  const incomeClaims = /\$[\d,]+\s*(a\s*day|per\s*day|a\s*month|per\s*month|a\s*week|in\s*\d+\s*days?)|make\s+\$|earn\s+\$|passive\s+income\s+of/i;

  const issues: CriticIssue[] = [];
  for (const scene of project.scenes) {
    const text = `${scene.voiceover} ${scene.onScreenText}`;
    if (incomeClaims.test(text)) {
      issues.push({
        severity: "error",
        sceneId: scene.id,
        message: `Scene ${scene.sceneNumber} may contain a specific income claim.`,
        suggestion: "Remove dollar amounts and specific earnings. Focus on the process and realistic outcomes.",
      });
    }
  }
  return issues;
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Run all heuristic checks against a VideoEngineProject.
 * Returns a CriticReport with any issues found.
 *
 * Call this after planProject() and before sourcing assets.
 * If report.passed === false, surface the issues to the admin before proceeding.
 */
export function critiqueProject(project: VideoEngineProject): CriticReport {
  const issues: CriticIssue[] = [
    ...checkHookLength(project),
    ...checkCtaPresent(project),
    ...checkMonotonePacing(project),
    ...checkTotalDuration(project),
    ...checkEmptyVoiceovers(project),
    ...checkEmptyOnScreenText(project),
    ...checkBrandGuardrails(project),
  ];

  const hasErrors = issues.some((i) => i.severity === "error");
  const warnCount = issues.filter((i) => i.severity === "warning").length;
  const errCount = issues.filter((i) => i.severity === "error").length;

  let summary: string;
  if (issues.length === 0) {
    summary = "✅ All checks passed. Project looks good to proceed.";
  } else if (hasErrors) {
    summary = `❌ ${errCount} error${errCount > 1 ? "s" : ""} found — fix before rendering.${warnCount > 0 ? ` Also ${warnCount} warning${warnCount > 1 ? "s" : ""}.` : ""}`;
  } else {
    summary = `⚠️ ${warnCount} warning${warnCount > 1 ? "s" : ""} — review before proceeding.`;
  }

  return {
    projectId: project.id,
    issues,
    passed: !hasErrors,
    summary,
  };
}
