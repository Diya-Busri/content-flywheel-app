/**
 * Motion Graphics Studio — AI Reddit/Complaint → Storyboard
 *
 * Takes a Reddit post, creator complaint, or similar source material and
 * produces a fully structured ContentProject output:
 *   - analysis: core problem, emotional angle, audience, key insight
 *   - shortForm: 5-scene storyboard for a 30–60 sec vertical video
 *   - longForm: title options, chapters, narration outline (no renderer yet)
 *
 * Uses Claude (Anthropic) for structured JSON generation — same pattern as
 * lib/motion-graphics/ai-script-to-scenes.ts but with a richer schema.
 * Falls back to OpenAI if ANTHROPIC_API_KEY is not configured.
 *
 * No Remotion or React imports — server-only module.
 */

import { randomUUID } from "crypto";
import type {
  AnimationId,
  AspectRatio,
  CfMentionMode,
  ContentAnalysis,
  ContentMode,
  LongFormChapter,
  LongFormOutput,
  RedditGenerateRequest,
  ShortFormOutput,
  StoryboardScene,
  StoryboardVisualType,
} from "@/lib/motion-graphics/types";
import { ANIMATION_ID_LIST } from "@/lib/motion-graphics/types";

const TAG = "[ai-reddit-to-storyboard]";
const FPS = 30;

// Default brand preset for Content Flywheel
const CF_BRAND = {
  accent: "#F89520",
  bg: "#0d0d0d",
  text: "#ffffff",
};

// Valid visual type list for validation
const VALID_VISUAL_TYPES: StoryboardVisualType[] = [
  "reddit-card",
  "kinetic-text",
  "icon-scene",
  "diagram",
  "screen-recording",
  "app-demo",
  "b-roll-placeholder",
  "quote-card",
  "outro",
];

// Transition animation subset valid for storyboard scenes
const VALID_TRANSITIONS: AnimationId[] = [
  "fadeIn",
  "slideLeft",
  "slideRight",
  "slideUp",
  "slideDown",
  "scaleIn",
  "blurReveal",
  "punchIn",
];

function pickTransition(value: string | undefined): AnimationId {
  return (VALID_TRANSITIONS as string[]).includes(value ?? "") ? (value as AnimationId) : "fadeIn";
}

function pickVisualType(value: string | undefined): StoryboardVisualType {
  return (VALID_VISUAL_TYPES as string[]).includes(value ?? "")
    ? (value as StoryboardVisualType)
    : "kinetic-text";
}

// ─── Prompt ──────────────────────────────────────────────────────────────────

function buildPrompt(req: RedditGenerateRequest): string {
  const modeLabel: Record<ContentMode, string> = {
    "reddit-reaction": "a Reddit Reaction video",
    "creator-complaint": "a Creator Complaint Breakdown video",
    "startup-breakdown": "a Startup Breakdown video",
    "digital-product-advice": "a Digital Product Advice video",
    "product-demo": "a Product Demo video",
    "tutorial": "a Tutorial video",
    "storytime": "a Storytime video",
    "short-form": "a Short-Form video",
    "long-form-youtube": "a Long-Form YouTube video",
    "custom": "a video",
  };
  const mode = modeLabel[req.contentMode] ?? "a video";

  const cfGuide: Record<CfMentionMode, string> = {
    off: "Do NOT mention Content Flywheel anywhere in the video.",
    subtle:
      "You may mention Content Flywheel once, naturally, only where it helps the viewer — never force it.",
    direct:
      "Include a clear Content Flywheel mention/CTA — the platform that helps creators build and sell digital products with AI.",
  };

  const audienceHint = req.targetAudience ? `\nTarget audience: ${req.targetAudience}` : "";
  const opinionHint = req.mainOpinion ? `\nMain opinion/lesson to convey: ${req.mainOpinion}` : "";
  const ctaHint = req.desiredCta ? `\nDesired call to action: ${req.desiredCta}` : "";
  const toneHint = req.tone ? `\nTone: ${req.tone}` : "";
  const durationHint = req.videoDuration ? `\nTarget video duration: ${req.videoDuration}` : "\nTarget duration: 30–60 seconds";

  return `You are an expert short-form faceless video creator. Your job is to transform source material into a complete, structured video production plan for ${mode}.

${cfGuide[req.cfMention]}${audienceHint}${opinionHint}${ctaHint}${toneHint}${durationHint}

ASPECT RATIO: ${req.aspectRatio}

SOURCE MATERIAL:
"""
${req.sourceText.trim()}
"""
${req.sourceUrl ? `\nSource URL: ${req.sourceUrl}` : ""}

Produce a COMPLETE JSON response matching this EXACT schema (no prose outside JSON):

{
  "analysis": {
    "coreProblem": "string — the core problem the source reveals",
    "emotionalAngle": "string — the emotional hook (frustration, hope, curiosity, etc.)",
    "audience": "string — who this resonates with most",
    "keyInsight": "string — the counter-intuitive or surprising insight",
    "contentOpportunity": "string — why this makes great content right now"
  },
  "shortForm": {
    "title": "string — catchy video title",
    "hook": "string — first 3-second hook sentence",
    "script": "string — complete narration script (spoken words only)",
    "durationSeconds": number,
    "callToAction": "string",
    "scenes": [
      {
        "narration": "string — words spoken over this scene",
        "onScreenText": "string — short text shown on screen (max 8 words)",
        "visualType": "one of: reddit-card | kinetic-text | icon-scene | diagram | app-demo | b-roll-placeholder | quote-card | outro",
        "animationPreset": "one of: fadeIn | slideLeft | slideRight | slideUp | slideDown | scaleIn | blurReveal | punchIn",
        "transitionPreset": "one of: fadeIn | slideLeft | slideRight | slideUp | slideDown | scaleIn | blurReveal | punchIn",
        "assetSuggestions": ["string — description of what visual/clip to use here"],
        "soundEffect": "string or null",
        "emphasisWords": ["word1", "word2"],
        "durationSeconds": number
      }
    ]
  },
  "longForm": {
    "titleOptions": ["string", "string", "string"],
    "thumbnailTextOptions": ["string", "string", "string"],
    "openingHook": "string",
    "estimatedDurationMinutes": number,
    "chapters": [
      {
        "title": "string",
        "purpose": "string",
        "narration": "string",
        "visualPlan": ["string"],
        "bRollSuggestions": ["string"],
        "appDemoSteps": ["string"] or null,
        "estimatedDurationSeconds": number
      }
    ],
    "conclusion": "string",
    "callToAction": "string"
  }
}

SHORT-FORM SCENE STRUCTURE (follow this order):
1. Scene 1 (0–3s): Show the Reddit post / strongest sentence. visualType = "reddit-card". Hook the viewer immediately.
2. Scene 2 (3–8s): Contrarian or curiosity-driven response. visualType = "kinetic-text". Short, punchy.
3. Scene 3 (8–25s): Explain the real issue simply. visualType = "kinetic-text" or "icon-scene".
4. Scene 4 (25–45s): Show the solution / framework / tool. visualType = "app-demo" or "icon-scene". Mark assetSuggestions with what screen recording is needed.
5. Scene 5 (45–60s): Natural CTA or question. visualType = "outro".

Generate EXACTLY 5 scenes for short-form.
Vary animations — do not use the same animationPreset every scene.
Keep narration natural and conversational, not corporate.
The total shortForm.durationSeconds should be the sum of scene durationSeconds.`;
}

// ─── Raw AI response types ────────────────────────────────────────────────────

interface RawScene {
  narration: string;
  onScreenText: string;
  visualType: string;
  animationPreset: string;
  transitionPreset: string;
  assetSuggestions: string[];
  soundEffect?: string | null;
  emphasisWords?: string[];
  durationSeconds: number;
}

interface RawShortForm {
  title: string;
  hook: string;
  script: string;
  durationSeconds: number;
  callToAction: string;
  scenes: RawScene[];
}

interface RawChapter {
  title: string;
  purpose: string;
  narration: string;
  visualPlan: string[];
  bRollSuggestions: string[];
  appDemoSteps?: string[] | null;
  estimatedDurationSeconds: number;
}

interface RawLongForm {
  titleOptions: string[];
  thumbnailTextOptions: string[];
  openingHook: string;
  estimatedDurationMinutes: number;
  chapters: RawChapter[];
  conclusion: string;
  callToAction: string;
}

interface RawAiResponse {
  analysis: ContentAnalysis;
  shortForm: RawShortForm;
  longForm: RawLongForm;
}

// ─── Mapping ──────────────────────────────────────────────────────────────────

function mapScene(raw: RawScene, index: number): StoryboardScene {
  const duration = Math.max(raw.durationSeconds || 5, 2);
  const startTime = 0; // re-calculated after all scenes are mapped
  return {
    id: randomUUID(),
    startTime,
    endTime: startTime + duration,
    narration: (raw.narration || "").trim(),
    onScreenText: (raw.onScreenText || "").trim(),
    visualType: pickVisualType(raw.visualType),
    animationPreset: pickTransition(raw.animationPreset),
    transitionPreset: pickTransition(raw.transitionPreset),
    assetSuggestions: Array.isArray(raw.assetSuggestions)
      ? raw.assetSuggestions.filter(Boolean)
      : [],
    soundEffect: raw.soundEffect ?? undefined,
    emphasisWords: Array.isArray(raw.emphasisWords) ? raw.emphasisWords : [],
    missingAsset:
      raw.visualType === "app-demo" ||
      raw.visualType === "screen-recording" ||
      raw.visualType === "b-roll-placeholder",
  };
}

function recalcTimes(scenes: StoryboardScene[], rawDurations: number[]): StoryboardScene[] {
  let cursor = 0;
  return scenes.map((s, i) => {
    const duration = rawDurations[i] ?? 5;
    const updated = { ...s, startTime: cursor, endTime: cursor + duration };
    cursor += duration;
    return updated;
  });
}

function mapShortForm(raw: RawShortForm): ShortFormOutput {
  const rawScenes = Array.isArray(raw.scenes) ? raw.scenes : [];
  const rawDurations = rawScenes.map((s) => Math.max(s.durationSeconds || 5, 2));
  const scenes = recalcTimes(rawScenes.map(mapScene), rawDurations);
  return {
    title: (raw.title || "Untitled").trim(),
    hook: (raw.hook || "").trim(),
    script: (raw.script || "").trim(),
    durationSeconds: rawDurations.reduce((a, b) => a + b, 0),
    callToAction: (raw.callToAction || "").trim(),
    scenes,
  };
}

function mapChapter(raw: RawChapter): LongFormChapter {
  return {
    title: (raw.title || "").trim(),
    purpose: (raw.purpose || "").trim(),
    narration: (raw.narration || "").trim(),
    visualPlan: Array.isArray(raw.visualPlan) ? raw.visualPlan : [],
    bRollSuggestions: Array.isArray(raw.bRollSuggestions) ? raw.bRollSuggestions : [],
    appDemoSteps: Array.isArray(raw.appDemoSteps) && raw.appDemoSteps.length ? raw.appDemoSteps : undefined,
    estimatedDurationSeconds: raw.estimatedDurationSeconds || 60,
  };
}

function mapLongForm(raw: RawLongForm): LongFormOutput {
  return {
    titleOptions: Array.isArray(raw.titleOptions) ? raw.titleOptions : [],
    thumbnailTextOptions: Array.isArray(raw.thumbnailTextOptions) ? raw.thumbnailTextOptions : [],
    openingHook: (raw.openingHook || "").trim(),
    estimatedDurationMinutes: raw.estimatedDurationMinutes || 7,
    chapters: Array.isArray(raw.chapters) ? raw.chapters.map(mapChapter) : [],
    conclusion: (raw.conclusion || "").trim(),
    callToAction: (raw.callToAction || "").trim(),
  };
}

// ─── AI call ─────────────────────────────────────────────────────────────────

async function callClaude(prompt: string): Promise<RawAiResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system:
        "You are a precise JSON API for video production planning. Only ever respond with valid JSON, no prose, no markdown fences.",
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text: string }>;
  };
  const raw = data.content?.find((b) => b.type === "text")?.text?.trim();
  if (!raw) throw new Error("Claude returned an empty response");

  // Strip markdown code fences if Claude adds them despite the instruction
  const cleaned = raw.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();

  let parsed: RawAiResponse;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.error(TAG, "JSON parse error. Raw:", cleaned.slice(0, 500));
    throw new Error(`AI response was not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  return parsed;
}

async function callOpenAI(prompt: string): Promise<RawAiResponse> {
  const { default: OpenAI } = await import("openai");
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    temperature: 0.65,
    messages: [
      {
        role: "system",
        content:
          "You are a precise JSON API for video production planning. Only ever respond with valid JSON, no prose.",
      },
      { role: "user", content: prompt },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("OpenAI returned an empty response");
  return JSON.parse(raw) as RawAiResponse;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface StoryboardGenerationResult {
  name: string;
  analysis: ContentAnalysis;
  shortForm: ShortFormOutput;
  longForm: LongFormOutput;
}

/**
 * Generates a full structured storyboard from a Reddit post/complaint.
 * Uses Claude (preferred) or OpenAI as fallback.
 */
export async function generateStoryboardFromReddit(
  req: RedditGenerateRequest
): Promise<StoryboardGenerationResult> {
  if (!req.sourceText?.trim()) throw new Error("sourceText is required");

  const prompt = buildPrompt(req);
  console.log(TAG, `generating storyboard — mode=${req.contentMode} length=${req.sourceText.length}`);

  let parsed: RawAiResponse;
  if (process.env.ANTHROPIC_API_KEY) {
    parsed = await callClaude(prompt);
  } else if (process.env.OPENAI_API_KEY) {
    parsed = await callOpenAI(prompt);
  } else {
    throw new Error("Neither ANTHROPIC_API_KEY nor OPENAI_API_KEY is configured");
  }

  if (!parsed.analysis || !parsed.shortForm || !parsed.longForm) {
    throw new Error("AI response was missing required fields (analysis, shortForm, or longForm)");
  }

  if (!Array.isArray(parsed.shortForm.scenes) || parsed.shortForm.scenes.length === 0) {
    throw new Error("AI response included no short-form scenes");
  }

  const shortForm = mapShortForm(parsed.shortForm);
  const longForm = mapLongForm(parsed.longForm);

  const name = shortForm.title || `${req.contentMode} — ${new Date().toLocaleDateString("en-GB")}`;

  console.log(
    TAG,
    `done — ${shortForm.scenes.length} scenes, ${shortForm.durationSeconds}s, ${longForm.chapters.length} chapters`
  );

  return {
    name,
    analysis: parsed.analysis,
    shortForm,
    longForm,
  };
}

/**
 * Converts a StoryboardScene[] into the existing Scene[] type for rendering
 * via the MotionGraphicsComposition (generic renderer).
 * Also used as a fallback if the RedditReaction composition is not available.
 */
export function storyboardToScenes(
  storyboardScenes: StoryboardScene[],
  aspectRatio: AspectRatio
): import("@/lib/motion-graphics/types").Scene[] {
  const DARK_BG = "linear-gradient(160deg, #0d0d0d 0%, #1a1a1a 100%)";
  const CF_ORANGE_BG = "linear-gradient(160deg, #c05621 0%, #F89520 50%, #f6ad55 100%)";

  return storyboardScenes.map((s, i) => {
    const durationInFrames = Math.max(Math.round((s.endTime - s.startTime) * FPS), FPS);
    const isOutro = s.visualType === "outro";

    return {
      id: s.id,
      order: i,
      name: `Scene ${i + 1} — ${s.visualType}`,
      durationInFrames,
      background: {
        type: "gradient" as const,
        value: isOutro ? CF_ORANGE_BG : DARK_BG,
      },
      cameraMovement: "none" as const,
      transitionIn: s.transitionPreset,
      transitionInDuration: Math.round(FPS * 0.45),
      transitionOut: "fadeIn" as const,
      transitionOutDuration: Math.round(FPS * 0.3),
      captions: { enabled: true, style: "wordByWord" as const },
      voiceover: { text: s.narration },
      elements: [
        {
          id: randomUUID(),
          type: "text" as const,
          content: s.onScreenText || s.narration.slice(0, 50),
          x: 5,
          y: 35,
          width: 90,
          height: 30,
          fontSize: aspectRatio === "9:16" ? 68 : 52,
          fontWeight: 900,
          color: isOutro ? "#0d0d0d" : CF_BRAND.text,
          textAlign: "center" as const,
          zIndex: 5,
          animationIn: {
            animationId: s.animationPreset,
            durationInFrames: Math.round(FPS * 0.75),
            delayFrames: Math.round(FPS * 0.12),
          },
        },
      ],
    };
  });
}
