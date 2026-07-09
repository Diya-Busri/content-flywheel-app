import type { ScriptScenes } from "./types";
import { PLATFORM_ASPECT_RATIOS } from "./types";

export type RenderScriptInput = {
  scriptScenes: ScriptScenes;
  productImageUrl: string;
  voiceoverUrl: string;
  platform: string;
  /** Optional: full script (voiceover). When set, on-screen text is derived from it so the video reflects the script. */
  fullScript?: string;
  /** Optional: full script length for duration estimate. */
  fullScriptLength?: number;
  /** Optional: target duration in seconds (15–60). Overrides estimate when set. */
  targetDurationSec?: number;
  /** Optional: URL for punch/slam sound at CTA scene start. */
  punchSoundUrl?: string;
  /** Optional: Pexels B-roll video URL (e.g. someone applying product) for Solution scene. */
  bRollVideoUrl?: string;
};

const WORDS_PER_SECOND = 2.5;

/**
 * Get the portion of the script spoken during a given second (for one-scene-per-second mode).
 */
function getTextForSecond(fullScript: string, secondIndex: number): string {
  const words = fullScript.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const start = Math.floor(secondIndex * WORDS_PER_SECOND);
  const end = Math.min(Math.ceil((secondIndex + 1) * WORDS_PER_SECOND), words.length);
  if (start >= end) return words[Math.min(start, words.length - 1)] ?? "";
  return words.slice(start, end).join(" ");
}

/**
 * Split full script into N scene chunks by sentence (used when not in per-second mode).
 */
function splitFullScriptIntoScenes(fullScript: string, numScenes: number): string[] {
  const trimmed = fullScript.trim();
  if (!trimmed || numScenes < 1) return [];
  const sentences = trimmed
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length === 0) return [trimmed];
  const chunks: string[] = [];
  const perScene = Math.max(1, Math.ceil(sentences.length / numScenes));
  for (let i = 0; i < numScenes; i++) {
    const start = i * perScene;
    const end = Math.min(start + perScene, sentences.length);
    if (start < end) {
      chunks.push(sentences.slice(start, end).join(" "));
    } else {
      chunks.push(chunks[chunks.length - 1] ?? trimmed);
    }
  }
  return chunks;
}

/** Scene duration fractions: Hook, Pain, Solution, [Proof], CTA. With proof = 5 scenes, without = 4. */
const SCENE_FRACTIONS_4 = [0.2, 0.25, 0.35, 0.2] as const;
const SCENE_FRACTIONS_5 = [0.18, 0.22, 0.22, 0.18, 0.2] as const;

/** Estimate total duration in seconds from script length (~12 chars per second spoken). */
function estimateTotalDuration(scriptLength: number): number {
  const sec = scriptLength / 12;
  return Math.max(15, Math.min(45, Math.round(sec)));
}

/**
 * Build Creatomate RenderScript JSON for product-driven video.
 * Each script section = separate scene with distinct animation:
 * - Hook: bold static text, no zoom.
 * - Pain: slow zoom.
 * - Solution: slight rotation/pan (no zoom).
 * - Proof: bullet list animation (staggered).
 * - CTA: fast zoom + optional punch sound.
 */
export function buildProductRenderScript(input: RenderScriptInput): Record<string, unknown> {
  const { scriptScenes, productImageUrl, voiceoverUrl, platform, punchSoundUrl, bRollVideoUrl, fullScript } = input;
  const aspect = PLATFORM_ASPECT_RATIOS[platform] ?? PLATFORM_ASPECT_RATIOS.tiktok;
  const totalDuration =
    input.targetDurationSec != null && input.targetDurationSec >= 15 && input.targetDurationSec <= 60
      ? input.targetDurationSec
      : input.fullScriptLength != null
        ? estimateTotalDuration(input.fullScriptLength)
        : 20;

  const fullScriptTrimmed = fullScript?.trim();
  const usePerSecondScenes = Boolean(fullScriptTrimmed && totalDuration >= 5 && totalDuration <= 60);

  const elements: Record<string, unknown>[] = [
    {
      type: "audio",
      source: voiceoverUrl,
      track: 1,
      time: 0,
    },
  ];

  // One scene per second: every second shows the script portion for that second
  if (usePerSecondScenes && fullScriptTrimmed) {
    if (punchSoundUrl) {
      elements.push({
        type: "audio",
        source: punchSoundUrl,
        track: 2,
        time: Math.max(0, totalDuration - 1),
        duration: 0.5,
      });
    }
    for (let i = 0; i < totalDuration; i++) {
      const text = getTextForSecond(fullScriptTrimmed, i);
      const isLast = i === totalDuration - 1;
      const displayText = isLast
        ? (text ? `${text}\nBuy now on TikTok Shop` : "Buy now on TikTok Shop")
        : text || "";
      const animType = i % 3; // rotate: 0 static, 1 zoom, 2 pan
      const imageEl: Record<string, unknown> = {
        type: "image",
        source: productImageUrl,
        track: 1,
        time: 0,
        width: animType === 0 ? "110%" : "105%",
        height: animType === 0 ? "110%" : "105%",
        x_anchor: "50%",
        y_anchor: "50%",
        fit: "cover",
        animations:
          animType === 0
            ? [{ time: 0, duration: 0.3, easing: "quadratic-out", type: "fade" }]
            : animType === 1
              ? [
                  { time: 0, duration: 0.3, easing: "quadratic-out", type: "fade" },
                  { time: 0, duration: 1, easing: "linear", type: "scale", x_scale: "112%", y_scale: "112%" },
                ]
              : [
                  { time: 0, duration: 0.3, easing: "quadratic-out", type: "fade" },
                  { time: 0, duration: 1, easing: "linear", type: "pan" },
                ],
      };
      const textEl: Record<string, unknown> = {
        type: "text",
        text: displayText,
        track: 2,
        time: 0,
        x: "50%",
        y: isLast ? "50%" : "72%",
        width: "90%",
        fill_color: "#ffffff",
        font_family: "Inter",
        font_weight: isLast ? "800" : "600",
        font_size: isLast ? "5.5vmin" : "4.2vmin",
        line_height: "140%",
        x_anchor: "50%",
        y_anchor: isLast ? "50%" : "100%",
        x_alignment: 50,
        y_alignment: isLast ? 50 : 100,
        background_color: "rgba(0,0,0,0.6)",
        background_x_padding: "4%",
        background_y_padding: "3%",
        animations: [{ time: 0, duration: 0.25, easing: "quadratic-out", type: "fade" }],
      };
      elements.push({
        type: "composition",
        track: 3,
        time: i,
        duration: 1,
        elements: [imageEl, textEl],
      });
    }
    return {
      output_format: "mp4",
      width: aspect.width,
      height: aspect.height,
      elements,
    };
  }

  // —— Legacy: 4–5 scenes (hook, pain, solution, proof, CTA) ——
  const hasProof = (scriptScenes.proof_points?.length ?? 0) > 0;
  const numScenes = hasProof ? 5 : 4;
  const fractions = hasProof ? SCENE_FRACTIONS_5 : SCENE_FRACTIONS_4;
  const durations = fractions.map((f) => totalDuration * f);
  const sceneChunks = fullScriptTrimmed
    ? splitFullScriptIntoScenes(fullScriptTrimmed, numScenes)
    : [];
  const hookText = sceneChunks[0] ?? scriptScenes.hook;
  const painText = sceneChunks[1] ?? scriptScenes.pain;
  const solutionText = sceneChunks[2] ?? scriptScenes.solution;
  const ctaChunk = hasProof ? sceneChunks[4] : sceneChunks[3];
  const ctaText = [ctaChunk || scriptScenes.cta, "Buy now on TikTok Shop"].filter(Boolean).join("\n");
  const proofPoints = scriptScenes.proof_points ?? [];
  let time = 0;
  const sceneStarts: number[] = [];
  for (let i = 0; i < durations.length; i++) {
    sceneStarts.push(time);
    time += durations[i];
  }
  const ctaStart = sceneStarts[sceneStarts.length - 1];

  if (punchSoundUrl) {
    elements.push({
      type: "audio",
      source: punchSoundUrl,
      track: 2,
      time: ctaStart,
      duration: 0.5,
    });
  }

  // —— Scene 1: Hook — bold static text, NO zoom ——
  const d1 = durations[0];
  elements.push({
    type: "composition",
    track: 3,
    time: sceneStarts[0],
    duration: d1,
    elements: [
      {
        type: "image",
        source: productImageUrl,
        track: 1,
        time: 0,
        width: "110%",
        height: "110%",
        x_anchor: "50%",
        y_anchor: "50%",
        fit: "cover",
        animations: [{ time: 0, duration: 0.5, easing: "quadratic-out", type: "fade" }],
      },
      {
        type: "text",
        text: hookText,
        track: 2,
        time: 0,
        x: "50%",
        y: "50%",
        width: "90%",
        fill_color: "#ffffff",
        font_family: "Inter",
        font_weight: "700",
        font_size: "7vmin",
        x_anchor: "50%",
        y_anchor: "50%",
        x_alignment: 50,
        y_alignment: 50,
        shadow_color: "rgba(0,0,0,0.6)",
        shadow_blur: "1vmin",
        animations: [{ time: 0, duration: 0.4, easing: "quadratic-out", type: "fade" }],
      },
    ],
  });

  // —— Scene 2: Pain — slow zoom only ——
  const d2 = durations[1];
  elements.push({
    type: "composition",
    track: 3,
    time: sceneStarts[1],
    duration: d2,
    elements: [
      {
        type: "image",
        source: productImageUrl,
        track: 1,
        time: 0,
        width: "100%",
        height: "100%",
        x_anchor: "50%",
        y_anchor: "50%",
        fit: "cover",
        animations: [
          { time: 0, duration: 0.4, easing: "quadratic-out", type: "fade" },
          { time: 0, duration: d2, easing: "linear", type: "scale", x_scale: "115%", y_scale: "115%" },
        ],
      },
      {
        type: "text",
        text: painText,
        track: 2,
        time: 0,
        x: "50%",
        y: "75%",
        width: "88%",
        fill_color: "#ffffff",
        font_family: "Inter",
        font_weight: "600",
        font_size: "5vmin",
        x_anchor: "50%",
        y_anchor: "100%",
        x_alignment: 50,
        y_alignment: 100,
        background_color: "rgba(0,0,0,0.6)",
        background_x_padding: "4%",
        background_y_padding: "3%",
        animations: [{ time: 0, duration: 0.4, easing: "quadratic-out", type: "fade" }],
      },
    ],
  });

  // —— Scene 3: Solution — B-roll (someone applying) or product pan ——
  const d3 = durations[2];
  const solutionSceneElements: Record<string, unknown>[] = [];
  if (bRollVideoUrl) {
    // B-roll video as background (feels like someone using the product)
    solutionSceneElements.push({
      type: "video",
      source: bRollVideoUrl,
      track: 1,
      time: 0,
      duration: d3,
      width: "100%",
      height: "100%",
      fit: "cover",
      x_anchor: "50%",
      y_anchor: "50%",
      animations: [{ time: 0, duration: 0.5, easing: "quadratic-out", type: "fade" }],
    });
    // Product image overlay (bottom-right corner) so product is still visible
    solutionSceneElements.push({
      type: "image",
      source: productImageUrl,
      track: 2,
      time: 0,
      x: "82%",
      y: "82%",
      width: "28%",
      height: "28%",
      x_anchor: "50%",
      y_anchor: "50%",
      fit: "contain",
      border_radius: "1vmin",
      shadow_color: "rgba(0,0,0,0.5)",
      shadow_blur: "1vmin",
      animations: [{ time: 0, duration: 0.5, easing: "quadratic-out", type: "fade" }],
    });
  } else {
    solutionSceneElements.push(
      {
        type: "image",
        source: productImageUrl,
        track: 1,
        time: 0,
        width: "110%",
        height: "110%",
        x_anchor: "50%",
        y_anchor: "50%",
        fit: "cover",
        animations: [
          { time: 0, duration: 0.4, easing: "quadratic-out", type: "fade" },
          { time: 0, duration: d3, easing: "linear", type: "pan" },
        ],
      }
    );
  }
  solutionSceneElements.push({
    type: "text",
    text: solutionText,
    track: 3,
    time: 0,
    x: "50%",
    y: "70%",
    width: "90%",
    fill_color: "#ffffff",
    font_family: "Inter",
    font_weight: "600",
    font_size: "4.5vmin",
    line_height: "140%",
    x_anchor: "50%",
    y_anchor: "100%",
    x_alignment: 50,
    y_alignment: 100,
    background_color: "rgba(0,0,0,0.5)",
    background_x_padding: "4%",
    background_y_padding: "3%",
    animations: [{ time: 0, duration: 0.5, easing: "quadratic-out", type: "fade" }],
  });
  elements.push({
    type: "composition",
    track: 3,
    time: sceneStarts[2],
    duration: d3,
    elements: solutionSceneElements,
  });

  // —— Scene 4 (optional): Proof — bullet list; B-roll background when available for more dynamism ——
  if (hasProof && proofPoints.length > 0) {
    const d4 = durations[3];
    const bulletElements: Record<string, unknown>[] = [];
    if (bRollVideoUrl) {
      bulletElements.push({
        type: "video",
        source: bRollVideoUrl,
        track: 1,
        time: 0,
        duration: d4,
        width: "100%",
        height: "100%",
        fit: "cover",
        x_anchor: "50%",
        y_anchor: "50%",
        animations: [{ time: 0, duration: 0.5, easing: "quadratic-out", type: "fade" }],
      });
      bulletElements.push({
        type: "image",
        source: productImageUrl,
        track: 2,
        time: 0,
        x: "82%",
        y: "22%",
        width: "24%",
        height: "24%",
        x_anchor: "50%",
        y_anchor: "50%",
        fit: "contain",
        border_radius: "1vmin",
        shadow_color: "rgba(0,0,0,0.5)",
        shadow_blur: "1vmin",
        animations: [{ time: 0, duration: 0.5, easing: "quadratic-out", type: "fade" }],
      });
    } else {
      bulletElements.push({
        type: "image",
        source: productImageUrl,
        track: 1,
        time: 0,
        width: "108%",
        height: "108%",
        x_anchor: "50%",
        y_anchor: "50%",
        fit: "cover",
        opacity: "85%",
        animations: [{ time: 0, duration: 0.4, easing: "quadratic-out", type: "fade" }],
      });
    }
    const proofTextTrack = bRollVideoUrl ? 3 : 2;
    proofPoints.forEach((line, i) => {
      bulletElements.push({
        type: "text",
        text: `• ${line}`,
        track: proofTextTrack,
        time: i * 0.25,
        duration: d4 - i * 0.25,
        x: "50%",
        y: `${55 + i * 8}%`,
        width: "86%",
        fill_color: "#ffffff",
        font_family: "Inter",
        font_weight: "600",
        font_size: "4vmin",
        x_anchor: "50%",
        y_anchor: "0%",
        x_alignment: 50,
        y_alignment: 0,
        background_color: "rgba(0,0,0,0.5)",
        background_x_padding: "3%",
        background_y_padding: "2%",
        animations: [{ time: 0, duration: 0.35, easing: "quadratic-out", type: "fade" }],
      });
    });
    elements.push({
      type: "composition",
      track: 3,
      time: sceneStarts[3],
      duration: d4,
      elements: bulletElements,
    });
  }

  // —— Final scene: CTA — fast zoom + punch (audio added above) ——
  const ctaSceneIndex = hasProof ? 4 : 3;
  const dCta = durations[ctaSceneIndex];
  elements.push({
    type: "composition",
    track: 3,
    time: sceneStarts[ctaSceneIndex],
    duration: dCta,
    elements: [
      {
        type: "image",
        source: productImageUrl,
        track: 1,
        time: 0,
        width: "100%",
        height: "100%",
        x_anchor: "50%",
        y_anchor: "50%",
        fit: "cover",
        opacity: "75%",
        animations: [
          { time: 0, duration: 0.4, easing: "quadratic-out", type: "fade" },
          {
            time: 0,
            duration: 0.45,
            easing: "quadratic-in",
            type: "scale",
            x_scale: "118%",
            y_scale: "118%",
          },
        ],
      },
      {
        type: "text",
        text: ctaText,
        track: 2,
        time: 0,
        x: "50%",
        y: "50%",
        width: "92%",
        fill_color: "#ffffff",
        font_family: "Inter",
        font_weight: "800",
        font_size: "6.5vmin",
        line_height: "130%",
        x_anchor: "50%",
        y_anchor: "50%",
        x_alignment: 50,
        y_alignment: 50,
        background_color: "rgba(0,0,0,0.7)",
        background_x_padding: "5%",
        background_y_padding: "4%",
        animations: [{ time: 0, duration: 0.35, easing: "quadratic-out", type: "fade" }],
      },
    ],
  });

  return {
    output_format: "mp4",
    width: aspect.width,
    height: aspect.height,
    elements,
  };
}
