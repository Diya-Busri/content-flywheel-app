import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { fetchOpenAIWithRetry } from "@/lib/openai-with-retry";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export type MainSection = {
  title: string;
  content: string;
  word_count?: number;
};

export type BlueprintScript = {
  hook?: string;
  intro?: string;
  main_sections?: MainSection[];
  recap?: string;
  cta?: string;
  total_word_count?: number;
  estimated_duration_minutes?: number;
  /** Legacy outline format */
  main_points?: string[];
  transitions?: string[];
  duration?: string | number;
};

export type BlueprintScenePrompt = {
  timestamp?: string;
  visual_description?: string;
  text_overlay?: string;
  music_mood?: string;
  /** AI-generated: avatar appearance for HeyGen/D-ID style. */
  avatar_prompt?: string;
  /** AI-generated: exact script for AI voice to read (legacy). */
  voiceover_text?: string;
  /** AI-generated: full voiceover script for this scene (2-4 sentences, 15-30 sec). */
  voiceover_full_text?: string;
  /** AI-generated: background scene for AI visual generation. */
  background_prompt?: string;
  /** AI-generated: detailed prompt for Runway/Pika/Luma. */
  ai_video_prompt?: string;
  /** AI-generated: scene number (1-based). */
  scene_number?: number;
  /** AI-generated: duration in seconds. */
  duration_seconds?: number;
  /** AI-generated: when overlay appears/fades (e.g. "appears at 0:02, fades at 0:04"). */
  text_overlay_timing?: string;
  /** AI-generated: list of visual elements in the shot. */
  visual_elements?: string[];
  /** AI-generated: camera movement instructions. */
  camera_instructions?: string;
  /** AI-generated: lighting notes. */
  lighting_notes?: string;
  /** AI-generated: color grading description. */
  color_grading?: string;
  /** AI-generated: recommended tools for this scene. */
  recommended_tools?: string[];
};

export type BlueprintResponse = {
  script: BlueprintScript;
  scene_prompts: BlueprintScenePrompt[];
};

type TopicInput = {
  title?: string;
  hook_angle?: string;
  [key: string]: unknown;
};

function ensureArray<T>(x: unknown): T[] {
  if (Array.isArray(x)) return x as T[];
  if (x != null && typeof x === "object") return [x] as T[];
  return [];
}

function normalizeMainSection(x: unknown): MainSection {
  if (x != null && typeof x === "object") {
    const o = x as Record<string, unknown>;
    return {
      title: typeof o.title === "string" ? o.title.trim() : "",
      content: typeof o.content === "string" ? o.content.trim() : "",
      word_count: typeof o.word_count === "number" ? o.word_count : undefined,
    };
  }
  return { title: "", content: "" };
}

function normalizeScript(raw: Record<string, unknown>): BlueprintScript {
  const mainSections = ensureArray(raw.main_sections).map(normalizeMainSection).filter((s) => s.title || s.content);
  return {
    hook: typeof raw.hook === "string" ? raw.hook.trim() : "",
    intro: typeof raw.intro === "string" ? raw.intro.trim() : "",
    main_sections: mainSections.length > 0 ? mainSections : undefined,
    recap: typeof raw.recap === "string" ? raw.recap.trim() : "",
    cta: typeof raw.cta === "string" ? raw.cta.trim() : "",
    total_word_count: typeof raw.total_word_count === "number" ? raw.total_word_count : undefined,
    estimated_duration_minutes:
      typeof raw.estimated_duration_minutes === "number" ? raw.estimated_duration_minutes : undefined,
    main_points: ensureArray(raw.main_points).map((p) => (typeof p === "string" ? p : String(p))),
    transitions: ensureArray(raw.transitions).map((t) => (typeof t === "string" ? t : String(t))),
    duration: typeof raw.duration === "number" ? raw.duration : typeof raw.duration === "string" ? raw.duration : "",
  };
}

function normalizeScenePrompt(raw: unknown): BlueprintScenePrompt {
  if (raw == null || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const visualElements = ensureArray(o.visual_elements)
    .filter((v): v is string => typeof v === "string")
    .map((s) => s.trim())
    .filter(Boolean);
  const recommendedTools = ensureArray(o.recommended_tools)
    .filter((v): v is string => typeof v === "string")
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    timestamp: typeof o.timestamp === "string" ? o.timestamp : "",
    visual_description: typeof o.visual_description === "string" ? o.visual_description : "",
    text_overlay: typeof o.text_overlay === "string" ? o.text_overlay : "",
    music_mood: typeof o.music_mood === "string" ? o.music_mood : "",
    avatar_prompt: typeof o.avatar_prompt === "string" ? o.avatar_prompt : "",
    voiceover_text: typeof o.voiceover_text === "string" ? o.voiceover_text : "",
    voiceover_full_text: typeof o.voiceover_full_text === "string" ? o.voiceover_full_text.trim() : "",
    background_prompt: typeof o.background_prompt === "string" ? o.background_prompt : "",
    ai_video_prompt: typeof o.ai_video_prompt === "string" ? o.ai_video_prompt.trim() : "",
    scene_number: typeof o.scene_number === "number" ? o.scene_number : undefined,
    duration_seconds: typeof o.duration_seconds === "number" ? o.duration_seconds : undefined,
    text_overlay_timing: typeof o.text_overlay_timing === "string" ? o.text_overlay_timing.trim() : "",
    visual_elements: visualElements.length > 0 ? visualElements : undefined,
    camera_instructions: typeof o.camera_instructions === "string" ? o.camera_instructions.trim() : "",
    lighting_notes: typeof o.lighting_notes === "string" ? o.lighting_notes.trim() : "",
    color_grading: typeof o.color_grading === "string" ? o.color_grading.trim() : "",
    recommended_tools: recommendedTools.length > 0 ? recommendedTools : undefined,
  };
}

/**
 * POST: Generate video script + scene prompts (blueprint).
 * Body: { topic: object, niche: string, content_style: string, video_type?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const apiRl = await checkApiRateLimit(userId);

    if (apiRl) return apiRl;

    const rl = checkAiRateLimit(userId);
    if (rl) return rl;

    const body = await request.json().catch(() => ({}));
    const topic = (body.topic ?? {}) as TopicInput;
    const niche = typeof body.niche === "string" ? body.niche.trim() : "";
    const contentStyle = typeof body.content_style === "string" ? body.content_style.trim() : "";
    const videoType = typeof body.video_type === "string" ? body.video_type.trim() : "";

    const topicTitle = typeof topic.title === "string" ? topic.title : "Video";
    const hookAngle = typeof topic.hook_angle === "string" ? topic.hook_angle : "";
    const isAiGenerated = contentStyle && contentStyle.toLowerCase() === "ai-generated";

    const prompt = isAiGenerated
      ? `Generate DETAILED scene-by-scene AI video prompts for: ${topicTitle}

Content Style: ai-generated
Duration: 8-15 minutes
Number of Scenes: Generate 1 scene per major script section (8-15 scenes total)

You must also provide a full script (hook, intro, main_sections, recap, cta) so the video has content. Then for EACH scene, provide DETAILED prompts as below.

For EACH scene, provide:

1. AI VIDEO PROMPT (for Runway ML / Pika Labs / Luma AI):
   - Shot type (close-up, medium shot, wide shot, aerial, POV)
   - Subject description (what's in frame)
   - Camera movement (static, pan, tilt, push-in, pull-out, dolly, crane)
   - Lighting (natural, studio, golden hour, moody, bright, soft)
   - Environment/setting (modern office, cozy kitchen, outdoor park, etc.)
   - Color grading (warm tones, cinematic, vibrant, muted, high contrast)
   - Special effects if needed (slow motion, time-lapse, particles)
   - Quality specs (4K, depth of field, professional)
   Make it copy-paste ready for AI video tools. Be SPECIFIC.

2. VOICEOVER FULL TEXT: The EXACT text spoken during this scene. 2-4 sentences per scene (15-30 seconds of narration). Conversational and engaging.

3. TEXT OVERLAY: Short punchy on-screen text (5-8 words max). Use text_overlay_timing to specify when it appears and fades (e.g. "appears at 0:02, fades at 0:04").

4. VISUAL ELEMENTS: Array of specific objects/elements that must be in the shot.

5. CAMERA & TECHNICAL: camera_instructions, lighting_notes, color_grading.

6. RECOMMENDED TOOLS: Array of tool names with optional note (e.g. "Runway ML (best for realistic hands/typing)").

Return JSON only, no markdown. Include both "script" (with hook, intro, main_sections, recap, cta, total_word_count, estimated_duration_minutes) and "scene_prompts" array. Each scene object must have: scene_number, timestamp, duration_seconds, ai_video_prompt, voiceover_full_text, text_overlay, text_overlay_timing, visual_elements (array), camera_instructions, lighting_notes, color_grading, recommended_tools (array).

Example scene object:
{
  "scene_number": 3,
  "timestamp": "1:30-2:00",
  "duration_seconds": 30,
  "ai_video_prompt": "Medium shot of hands typing on MacBook Pro keyboard in modern minimalist home office, camera slowly orbits around laptop from left to right, soft afternoon sunlight streaming through sheer curtains creating gentle shadows, shallow depth of field f/2.8 with background slightly blurred, warm color grading with slight golden tones, occasional screen reflections visible, professional corporate aesthetic, 4K quality",
  "voiceover_full_text": "Setting up your AI grocery assistant takes less than five minutes. First, open ChatGPT and create a custom GPT. I know that sounds technical, but trust me, it's literally just clicking create and following the prompts. You'll tell it you are my personal grocery assistant, and your job is to track what I eat and generate shopping lists automatically.",
  "text_overlay": "Setup Takes Under 5 Minutes",
  "text_overlay_timing": "appears at 1:32, fades at 1:36",
  "visual_elements": ["MacBook Pro", "ChatGPT interface", "Modern desk", "Coffee cup (optional)", "Notebook"],
  "camera_instructions": "Slow orbital movement, keep hands and keyboard in focus",
  "lighting_notes": "Natural window light, soft shadows, avoid harsh overhead lighting",
  "color_grading": "Warm golden tones, professional feel",
  "recommended_tools": ["Runway ML (best for realistic hands/typing)", "Luma AI (good motion)", "Pika Labs (creative effects)"]
}`
      : `Generate a COMPLETE, FULL-LENGTH YouTube video script.

Topic: ${topicTitle}
Niche: ${niche || "general"}
Content Style: ${contentStyle || "general"}
Hook Angle: ${hookAngle || "Engaging opener"}
Target Duration: 8-15 minutes (2000-3500 words)

CRITICAL: This must be a WORD-FOR-WORD script, not an outline. Write every single sentence the speaker will say.

Structure:

1. HOOK (80-120 words): Opening line to grab attention, problem statement (what viewer struggles with), promise/preview (what they'll learn). Write the complete hook script.

2. INTRO (100-150 words): Quick intro of who you are (if personal brand), why this topic matters NOW, what makes this video different. Write the complete intro script.

3. MAIN CONTENT (1500-3000 words total): Break into 3-5 MAJOR SECTIONS. For each section: a section headline, then 200-400 words of detailed explanation with examples, stories, or data points, and a transition to the next section.

4. RECAP (100-150 words): Summarize key takeaways, reinforce main benefit. Write the complete recap script.

5. CTA (80-120 words): Specific action to take, why they should subscribe, what's coming next. Write the complete CTA script.

Make the script conversational, engaging, and platform-appropriate for YouTube. Use short sentences. Vary sentence length. Sound human, not robotic.

After the script, also provide scene_prompts: one scene per major section (or 2-3 scenes per section for visual variety). Each scene needs: timestamp, visual_description (what appears on screen; for faceless: stock footage keywords, animation style; for personal-brand: camera angle, setting), text_overlay, music_mood.

Return as JSON only, no markdown:
{
  "script": {
    "hook": "full hook text here, 80-120 words...",
    "intro": "full intro text here, 100-150 words...",
    "main_sections": [
      { "title": "Section 1 Title", "content": "full section text here, 200-400 words...", "word_count": 250 },
      { "title": "Section 2 Title", "content": "full section text here...", "word_count": 300 }
    ],
    "recap": "full recap text here...",
    "cta": "full CTA text here...",
    "total_word_count": 2847,
    "estimated_duration_minutes": 11
  },
  "scene_prompts": [
    { "timestamp": "0:00-0:30", "visual_description": "...", "text_overlay": "...", "music_mood": "..." }
  ]
}`;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key is not configured" },
        { status: 503 }
      );
    }

    const response = await fetchOpenAIWithRetry(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are a video script and production expert. Return only valid JSON, no markdown.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 16000,
        }),
      },
      { onRetry: (attempt, delayMs) => console.log(`[generate-blueprint] Retry ${attempt} in ${delayMs}ms`) }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("[generate-blueprint] OpenAI error:", response.status, errText);
      return NextResponse.json(
        { error: "Failed to generate blueprint. Please try again." },
        { status: 502 }
      );
    }

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content ?? "";
    let jsonText = content.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    }
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    const script = normalizeScript((parsed.script ?? {}) as Record<string, unknown>);
    const scene_prompts = ensureArray(parsed.scene_prompts).map(normalizeScenePrompt);

    return NextResponse.json({ script, scene_prompts });
  } catch (err) {
    console.error("[generate-blueprint]", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to generate blueprint",
      },
      { status: 500 }
    );
  }
}
