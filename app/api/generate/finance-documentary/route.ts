import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type FinanceDocScene = {
  sceneNumber: number;
  dialogue: string;
  imagePrompt: string;
  motionPrompt: string;
};

type SocialMediaPack = {
  youtubeTitle: string;
  youtubeDescription: string;
  youtubeTags: string[];
  tiktokCaption: string;
  hook: string;
};

/**
 * POST /api/generate/finance-documentary
 *
 * Generates a premium faceless finance/business documentary storyboard.
 * Returns cinematic scenes with documentary narration + high-quality image prompts.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({})) as {
      topic?: string;
      niche?: string;
      style?: string;
      tone?: string;
      length?: "short" | "medium" | "long";
      hookStyle?: string;
      ctaGoal?: string;
      channelName?: string;
      productName?: string;
      affiliatePlatform?: string;
      affiliateOffer?: string;
    };

    const {
      topic = "How to build wealth starting from zero",
      niche = "Personal Finance",
      style = "Dark Luxury",
      tone = "Documentary",
      length = "medium",
      hookStyle = "shocking_stat",
      ctaGoal = "subscribe",
      channelName = "",
      productName = "",
      affiliatePlatform = "",
      affiliateOffer = "",
    } = body;

    const sceneCount = length === "short" ? 15 : length === "long" ? 55 : 35;

    // Build visual style descriptor for image prompts
    const visualStyle = {
      "Dark Luxury": "cinematic dark luxury aesthetic, deep black backgrounds, gold accents, dramatic rim lighting, ultra-high definition, premium feel, 8K quality, like a luxury brand advertisement",
      "Clean Minimal": "ultra-clean minimal aesthetic, crisp white backgrounds, sharp typography, professional corporate look, soft shadows, magazine quality",
      "Cinematic Dramatic": "cinematic dramatic lighting, high contrast shadows, moody atmosphere, film noir inspired, anamorphic lens flare, Hollywood documentary style",
      "Bold Modern": "bold vibrant colors, dynamic composition, energetic modern design, striking contrasts, Gen Z aesthetic, digital-native feel",
    }[style] ?? "cinematic dark luxury aesthetic, premium quality, dramatic lighting";

    // Build CTA instruction
    const affiliateName = affiliatePlatform || "the platform in the description";
    const affiliateOfferText = affiliateOffer || "a bonus when you sign up using the link below";
    const ctaInstruction = {
      "subscribe": "End with a compelling reason to subscribe for more wealth-building content",
      "affiliate": `Naturally weave in the referral: tell viewers that if they want to start investing, you personally use ${affiliateName} and they can get ${affiliateOfferText} — link in the description. Make it feel authentic, not salesy.`,
      "sell_product": productName
        ? `End with a natural mention that ${productName} teaches this in detail — available in the link below`
        : "End by directing viewers to the free resource in the description",
      "email_list": "End by offering a free resource (checklist/guide) to viewers who join the email list",
      "comment": "End with a thought-provoking question that makes viewers want to comment their answer",
    }[ctaGoal] ?? "End with a strong call to action";

    // Hook style instruction
    const hookInstruction = {
      "shocking_stat": "Open with a shocking, little-known statistic that immediately grabs attention",
      "contrarian": "Open with a bold contrarian statement that challenges what viewers believe to be true",
      "story": "Open with a brief compelling story or scenario that hooks viewers emotionally",
      "question": "Open with a direct, provocative question that makes viewers want to keep watching",
      "reveal": "Open with a promise to reveal a hidden truth or secret that most people don't know",
    }[hookStyle] ?? "Open with a powerful hook";

    const currentYear = 2026;

    const systemPrompt = `You are an elite faceless YouTube documentary scriptwriter. You create premium, high-retention finance and business content for channels like Graham Stephan, Andrei Jikh, and The Plain Bagel.

IMPORTANT: The current year is ${currentYear}. All statistics, examples, and references MUST feel current and relevant to ${currentYear}. Do NOT use statistics from before 2023. If citing a year (e.g. "In 2020..."), only do so when referencing a specific historical event — otherwise always default to recent/current context. Phrases like "right now", "today", "as of ${currentYear}" are preferred over dated references.

Your videos are:
- Shot in a ${style} visual style
- Narrated in a ${tone} tone — authoritative, engaging, never boring
- Structured like premium documentaries, not cheap listicles
- Visually driven with cinematic, high-quality imagery (NO stock photo clichés, NO cartoons)
- Factually grounded with specific numbers, names, and recent examples

You always:
- Write narration that sounds natural when spoken aloud
- Create image prompts that look cinematic and premium (${visualStyle})
- Keep sentences punchy — 1-2 sentences max per scene
- Build tension and curiosity throughout the video
- Never use generic phrases like "in conclusion" or "let's dive in"
- Never cite statistics from before 2023 unless referencing a specific historical event`;

    const userPrompt = `Create a ${sceneCount}-scene finance documentary storyboard for this video:

TOPIC: ${topic}
NICHE: ${niche}
CHANNEL: ${channelName || "a premium finance channel"}
TONE: ${tone}
VISUAL STYLE: ${style}
CURRENT YEAR: ${currentYear} — all dialogue must feel current and up-to-date. Do not reference years before 2023 unless citing a specific historical event.

STRUCTURE RULES — follow this exactly:
- Scene 1 (BRANDED INTRO): A 2-sentence channel intro. "${channelName || "Welcome"} — where we break down the strategies the wealthy use, and how you can apply them starting today." Set the tone. No topic content yet — just establish the channel brand and credibility.
- Scene 2 (HOOK): ${hookInstruction}. This is where you grab attention with the core premise.
- Scenes 3-6: Set up the problem / tension. Why does this matter? Real stats, relatable examples from 2024-2026.
- Scenes 7-${sceneCount - 4}: Deep dive — valuable content, specific facts, named examples, insights. Build progressively. Each scene = one clear idea. Vary the pace — some scenes drop bombshell stats, others tell a quick story, others give a practical tip.
${ctaGoal === "affiliate" ? `- IMPORTANT: Somewhere in scenes 7-${sceneCount - 4}, where the topic naturally connects to investing/the platform, include a brief authentic mention: "I personally use ${affiliateName} for this — link in the description, you get ${affiliateOffer || "a bonus"} when you sign up." Keep it natural, 1 sentence only, then continue the content.` : ""}
- Scene ${sceneCount - 3} (TURNING POINT): The key insight or revelation that reframes everything the viewer just learned.
- Scene ${sceneCount - 2}: Actionable takeaway — the single most important thing the viewer should do this week.
- Scene ${sceneCount - 1} (CTA): ${ctaInstruction}
- Scene ${sceneCount} (OUTRO): "${channelName || "This channel"} — new video every week. Subscribe so you never miss the strategies that matter. See you in the next one."

IMAGE PROMPT RULES — this is critical:
- Every imagePrompt must describe a CINEMATIC, PREMIUM visual — no stick figures, no cartoons, no generic office stock photos
- Use: city skylines at night, close-up money/coins/charts, luxury lifestyle, abstract data visualisations, dark dramatic environments, hands on keyboards, luxury watches/cars as metaphors for wealth, neon-lit financial districts
- NEVER use: empty wallets, poverty imagery, people in distress, homelessness, or anything that could trigger content filters. Instead show CONTRAST through luxury vs minimalism, abundance vs simplicity.
- Every prompt must include: "${visualStyle}"
- Specify camera angle (wide establishing shot, extreme close-up, aerial drone shot, etc.)
- Describe lighting explicitly (golden hour, dramatic side lighting, neon city glow, etc.)

DIALOGUE LENGTH:
Each scene's dialogue must be 4-5 sentences (~15-20 seconds when read aloud at a steady documentary pace). This is a scene-by-scene visual documentary — each scene has its own image. Make each narration substantive and engaging, not rushed. The voiceover drives the pacing — viewers hear the full narration before the next scene. The total story is told across ${sceneCount} scenes, so each scene needs enough content to fill ~15-20 seconds of screen time.

Return ONLY valid JSON in this exact format:
{
  "scenes": [
    {
      "sceneNumber": 1,
      "dialogue": "4-5 sentences. Substantive, engaging narration for this specific scene. 15-20 seconds when read aloud at a steady documentary pace.",
      "imagePrompt": "Detailed cinematic image description including visual style, lighting, composition",
      "motionPrompt": "Subtle camera motion (slow dolly forward, gentle parallax, slow zoom in, static lockdown)"
    }
  ],
  "socialMediaPack": {
    "youtubeTitle": "Click-worthy YouTube title (under 70 chars)",
    "youtubeDescription": "SEO-optimised YouTube description (150 words, include timestamps placeholder, keywords)",
    "youtubeTags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8", "tag9", "tag10"],
    "tiktokCaption": "Punchy TikTok/Reels caption with 3-5 hashtags",
    "hook": "The exact first sentence of the video — the opening hook"
  }
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.85,
      max_tokens: 16000, // enough for 55 scenes
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    let parsed: { scenes?: FinanceDocScene[]; socialMediaPack?: SocialMediaPack };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Failed to parse AI response. Please try again." }, { status: 500 });
    }

    const scenes = (parsed.scenes ?? []).map((s, i) => ({
      sceneNumber: s.sceneNumber ?? i + 1,
      dialogue: s.dialogue ?? "",
      imagePrompt: s.imagePrompt ?? "",
      motionPrompt: s.motionPrompt ?? "slow zoom in",
    }));

    if (scenes.length === 0) {
      return NextResponse.json({ error: "No scenes generated. Please try again." }, { status: 500 });
    }

    return NextResponse.json({
      scenes,
      socialMediaPack: parsed.socialMediaPack ?? null,
      character_seed: null, // Not applicable for documentary style
    });
  } catch (err) {
    console.error("[finance-documentary]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 }
    );
  }
}
