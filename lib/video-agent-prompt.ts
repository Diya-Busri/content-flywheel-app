/**
 * Video Agent – Prompt Template
 *
 * Edit this file to change how the AI generates video content for Content Flywheel.
 * The function is called by /api/admin/video-agent/generate and returns the full
 * system + user messages sent to OpenAI.
 */

export type VideoAgentInput = {
  goal: string;
  targetAudience: string;
  platform: "TikTok" | "Instagram Reels" | "YouTube Shorts";
  style: "educational" | "pain-point" | "demo" | "motivational" | "direct sales";
  cta: string;
};

export type VideoScene = {
  scene: number;
  duration: string;
  visual: string;
  voiceover: string;
  onScreenText: string;
};

export type VideoAgentOutput = {
  hooks: string[];
  bestHook: string;
  script: string;
  scenes: VideoScene[];
  caption: string;
  hashtags: string[];
  cta: string;
};

// ─── Brand Context ────────────────────────────────────────────────────────────
// Edit this section to update the brand voice, topics, or guardrails.

const BRAND_CONTEXT = `
Content Flywheel is an all-in-one platform that helps beginners start and grow a faceless content business online.

Core topics the platform covers:
- Digital products (eBooks, templates, swipe files, courses)
- TikTok Shop (affiliate and own products)
- Print-on-demand (Printify, Printful)
- Email marketing and list building
- Content creation: scripts, hooks, captions, video timelines

Target audience:
- Beginners who have never made money online before
- People who want a faceless business (no showing their face on camera)
- Side-hustlers and aspiring digital entrepreneurs
- People who feel overwhelmed, stuck, or unsure where to start

Brand voice:
- Clear, simple, and beginner-friendly — no jargon
- Encouraging and realistic — no hype, no fake income screenshots
- Focused on removing overwhelm and giving people a clear next step
- Honest about what it takes (effort, consistency) without being discouraging

Hard rules (never violate):
- No fake income claims or earnings screenshots
- No exaggerated promises ("make $10k overnight")
- No pressure-based fear tactics
- Keep it realistic, grounded, and action-oriented
`.trim();

// ─── System Prompt ────────────────────────────────────────────────────────────

export function buildSystemPrompt(): string {
  return `You are a short-form video strategist and copywriter for Content Flywheel.

${BRAND_CONTEXT}

Your job is to generate complete short-form video content packages — hooks, scripts, scene breakdowns, captions, and hashtags — that are ready to record and post.

Always return your response as valid JSON matching exactly this structure:
{
  "hooks": [string, string, string, string, string],
  "bestHook": string,
  "script": string,
  "scenes": [
    {
      "scene": number,
      "duration": string,
      "visual": string,
      "voiceover": string,
      "onScreenText": string
    }
  ],
  "caption": string,
  "hashtags": [string],
  "cta": string
}

Rules:
- hooks: exactly 5 strong opening hooks for the video (1–2 sentences each)
- bestHook: pick the single strongest hook from the 5 above
- script: the full 30–45 second voiceover script written out as natural speech (no stage directions)
- scenes: break the script into 4–7 scenes with specific visual/recording instructions
- caption: platform-ready caption (2–4 short paragraphs + line breaks, no hashtags in this field)
- hashtags: 8–12 relevant hashtags as strings (include the # symbol)
- cta: the spoken call-to-action line at the end of the video (1 sentence)

Do not include any text outside the JSON object.`;
}

// ─── User Prompt ─────────────────────────────────────────────────────────────

export function buildUserPrompt(input: VideoAgentInput): string {
  const platformNotes: Record<VideoAgentInput["platform"], string> = {
    "TikTok": "Optimise for TikTok: fast pacing, strong first 2 seconds, trending-friendly caption style.",
    "Instagram Reels": "Optimise for Instagram Reels: slightly polished aesthetic, strong hook, save-worthy value.",
    "YouTube Shorts": "Optimise for YouTube Shorts: clear title-style hook, complete thought, subscribe-friendly ending.",
  };

  const styleNotes: Record<VideoAgentInput["style"], string> = {
    "educational": "Style: educational — teach one clear thing, use a simple tip or framework the viewer can apply immediately.",
    "pain-point": "Style: pain-point — open with a relatable struggle or frustration, then show how Content Flywheel solves it.",
    "demo": "Style: demo — walk through a specific feature or workflow inside Content Flywheel, showing it in action.",
    "motivational": "Style: motivational — inspire action without hype, acknowledge where the viewer is and give them one clear next step.",
    "direct sales": "Style: direct sales — clear, confident, benefit-led. Explain what it is, who it's for, and what they should do next.",
  };

  return `Generate a complete short-form video content package for Content Flywheel.

Video goal: ${input.goal}
Target audience: ${input.targetAudience}
Platform: ${input.platform}
CTA: ${input.cta}

${platformNotes[input.platform]}
${styleNotes[input.style]}

Return only valid JSON.`;
}
