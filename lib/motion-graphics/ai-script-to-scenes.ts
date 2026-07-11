/**
 * Motion Graphics Studio — AI Script → Scenes
 *
 * Paste a script → this module asks OpenAI (gpt-4o, `response_format:
 * json_object`) to split it into scenes, choose suitable animations/
 * transitions from the Animation Library, position the on-screen text, and
 * draft captions — then validates the model's output against the real
 * Animation Library registry ids and assembles a complete, renderable
 * TemplateDraft (a "complete Remotion composition" per the product spec).
 *
 * Uses OpenAI's `response_format: { type: "json_object" }` mode rather than
 * the Claude regex-JSON-extraction pattern seen in lib/analytics-ai.ts —
 * this mirrors the already-proven structured-JSON approach in the existing
 * Video Agent (app/api/admin/video-agent/generate/route.ts), which is more
 * reliable for the nested scene/element schema this feature needs.
 */

import { randomUUID } from "crypto";
import OpenAI from "openai";
import { ANIMATION_ID_LIST } from "@/lib/motion-graphics/types";
import type {
  AnimationId,
  AspectRatio,
  CameraMovement,
  Scene,
  ScriptToVideoRequest,
  TemplateDraft,
} from "@/lib/motion-graphics/types";

const TAG = "[ai-script-to-scenes]";
const FPS = 30;

// Only these ids make sense as whole-scene transitions (they accept `children`
// and animate an entrance/exit) — restricts the model's choice so a
// "textContent"/"composite"/"particle" id can never end up as a scene
// transition (which would silently no-op at render time, since SceneView
// falls back to fadeIn/fadeOut for anything that isn't a wrapper).
const TRANSITION_IDS: AnimationId[] = [
  "fadeIn",
  "slideLeft",
  "slideRight",
  "slideUp",
  "slideDown",
  "scaleIn",
  "blurReveal",
  "spotlightReveal",
];
const TEXT_ANIMATION_IDS: AnimationId[] = [
  "typewriterText",
  "wordByWordReveal",
  "characterReveal",
  "fadeIn",
  "slideUp",
];
const CAMERA_MOVEMENTS: CameraMovement[] = ["none", "zoomIn", "zoomOut", "panLeft", "panRight"];
const BACKGROUND_GRADIENTS = [
  "linear-gradient(160deg, #0f0c29 0%, #302b63 55%, #24243e 100%)",
  "linear-gradient(160deg, #1a1a2e 0%, #16213e 55%, #0f3460 100%)",
  "linear-gradient(160deg, #c05621 0%, #F89520 50%, #f6ad55 100%)",
  "linear-gradient(160deg, #0d1117 0%, #161b22 55%, #1c2128 100%)",
];

interface RawAiScene {
  sceneText: string;
  onScreenHeadline: string;
  durationSeconds: number;
  transitionIn?: string;
  transitionOut?: string;
  textAnimation?: string;
  cameraMovement?: string;
  captionsStyle?: "wordByWord" | "block" | "karaoke";
}

interface RawAiResponse {
  suggestedTitle?: string;
  scenes: RawAiScene[];
}

function pick<T>(value: string | undefined, allowed: T[], fallback: T): T {
  return (allowed as unknown as string[]).includes(value ?? "") ? ((value as unknown) as T) : fallback;
}

function buildPrompt(req: ScriptToVideoRequest): string {
  return `You are a motion graphics director. Split the following script into 3-8 short video scenes for a ${req.category.replace(
    /_/g,
    " "
  )} style video (aspect ratio ${req.aspectRatio}).${req.tone ? ` Tone: ${req.tone}.` : ""}

For EACH scene, output:
- "sceneText": the portion of the script spoken/voiced-over in this scene (used for voiceover + captions).
- "onScreenHeadline": a short (max 8 words) on-screen text overlay that reinforces the sceneText.
- "durationSeconds": a realistic duration (2-8) based on how long sceneText takes to read aloud.
- "transitionIn": one of ${TRANSITION_IDS.join(", ")}
- "transitionOut": one of ${TRANSITION_IDS.join(", ")}
- "textAnimation": one of ${TEXT_ANIMATION_IDS.join(", ")} (how onScreenHeadline animates in)
- "cameraMovement": one of ${CAMERA_MOVEMENTS.join(", ")}
- "captionsStyle": one of "wordByWord", "block", "karaoke"

Vary the transitions/animations across scenes — do not repeat the same one every time.

Respond with strict JSON only, matching exactly:
{
  "suggestedTitle": "string",
  "scenes": [
    {
      "sceneText": "string",
      "onScreenHeadline": "string",
      "durationSeconds": number,
      "transitionIn": "string",
      "transitionOut": "string",
      "textAnimation": "string",
      "cameraMovement": "string",
      "captionsStyle": "string"
    }
  ]
}

Script:
"""
${req.script.trim()}
"""`;
}

function toScene(raw: RawAiScene, index: number, aspectRatio: AspectRatio): Scene {
  const durationInFrames = Math.max(Math.round((raw.durationSeconds || 4) * FPS), FPS);
  const transitionIn = pick(raw.transitionIn, TRANSITION_IDS, "fadeIn");
  const transitionOut = pick(raw.transitionOut, TRANSITION_IDS, "fadeIn");
  const textAnimation = pick(raw.textAnimation, TEXT_ANIMATION_IDS, "fadeIn");
  const cameraMovement = pick(raw.cameraMovement, CAMERA_MOVEMENTS, "none" as CameraMovement);
  const captionsStyle = pick(raw.captionsStyle, ["wordByWord", "block", "karaoke"] as const, "wordByWord");

  const headline = (raw.onScreenHeadline || "").trim() || raw.sceneText.slice(0, 40);

  return {
    id: randomUUID(),
    order: index,
    name: `Scene ${index + 1}`,
    durationInFrames,
    background: { type: "gradient", value: BACKGROUND_GRADIENTS[index % BACKGROUND_GRADIENTS.length] },
    cameraMovement,
    transitionIn,
    transitionInDuration: Math.round(FPS * 0.5),
    transitionOut,
    transitionOutDuration: Math.round(FPS * 0.4),
    captions: { enabled: true, style: captionsStyle },
    voiceover: { text: raw.sceneText.trim() },
    elements: [
      {
        id: randomUUID(),
        type: "text",
        content: headline,
        x: aspectRatio === "16:9" ? 12 : 8,
        y: 38,
        width: aspectRatio === "16:9" ? 76 : 84,
        height: 24,
        fontSize: aspectRatio === "9:16" ? 64 : 56,
        fontWeight: 900,
        color: "#ffffff",
        textAlign: "center",
        zIndex: 5,
        animationIn: {
          animationId: textAnimation,
          durationInFrames: Math.round(FPS * 0.8),
          delayFrames: Math.round(FPS * 0.15),
        },
      },
    ],
  };
}

/**
 * Calls OpenAI to split `request.script` into scenes and returns a fully
 * assembled, renderable TemplateDraft — ready to POST to
 * /api/admin/motion-graphics/templates or render immediately.
 */
export async function generateTemplateFromScript(request: ScriptToVideoRequest): Promise<TemplateDraft> {
  if (!request.script?.trim()) {
    throw new Error("script is required");
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const prompt = buildPrompt(request);

  console.log(TAG, `requesting scene split — script length=${request.script.length}`);
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    temperature: 0.6,
    messages: [
      { role: "system", content: "You are a precise JSON API. Only ever respond with valid JSON, no prose." },
      { role: "user", content: prompt },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("OpenAI returned an empty response");

  let parsed: RawAiResponse;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error(TAG, "failed to parse OpenAI JSON:", raw.slice(0, 500));
    throw new Error(`AI response was not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!Array.isArray(parsed.scenes) || parsed.scenes.length === 0) {
    throw new Error("AI response did not include any scenes");
  }

  // Validate every referenced animation id against the real registry list —
  // toScene() already falls back safely via pick(), this is just a hard
  // guard against ids that aren't even valid AnimationIds at all.
  for (const s of parsed.scenes) {
    for (const idField of [s.transitionIn, s.transitionOut, s.textAnimation]) {
      if (idField && !ANIMATION_ID_LIST.includes(idField as AnimationId)) {
        console.warn(TAG, `AI suggested unknown animation id "${idField}" — will fall back to a safe default`);
      }
    }
  }

  const scenes = parsed.scenes.map((s, i) => toScene(s, i, request.aspectRatio));

  return {
    name: parsed.suggestedTitle?.trim() || "AI Generated Template",
    category: request.category,
    aspectRatio: request.aspectRatio,
    fps: FPS,
    scenes,
    status: "draft",
    sourceScript: request.script,
  };
}
