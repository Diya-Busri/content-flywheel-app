import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { checkVideoCredits, deductVideoCredit } from "@/actions/video-credits-actions";
import { checkApiRateLimit } from "@/lib/rate-limit-api";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min — large scene counts need parallel batch expansion

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Two-pass generation for large scene counts (100–400+):
 *
 * Pass 1 — Outline (1 API call, ~10s):
 *   Generate a compact outline: sceneNumber + title + 1-sentence brief for ALL scenes.
 *   ~25 tokens/scene → 400 scenes = 10,000 tokens → fits in one 16k-token call.
 *
 * Pass 2 — Expand (N parallel API calls, ~30s each):
 *   Split outline into BATCH_SIZE chunks, expand each in parallel with full
 *   dialogue + imagePrompt + motionPrompt. Each batch: 40 scenes × ~280 tokens = 11,200 tokens.
 *
 * Result: 400 scenes in ~40s total regardless of count.
 */
const BATCH_SIZE = 40;

type FinanceDocScene = {
  sceneNumber: number;
  dialogue: string;
  imagePrompt: string;
  motionPrompt: string;
};

type OutlineScene = {
  sceneNumber: number;
  title: string;
  brief: string;
};

type SocialMediaPack = {
  youtubeTitle: string;
  youtubeDescription: string;
  youtubeTags: string[];
  tiktokCaption: string;
  hook: string;
};

/** Chunk an array into sub-arrays of size n */
function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/**
 * POST /api/generate/finance-documentary
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const apiRl = await checkApiRateLimit(userId);
    if (apiRl) return apiRl;

    const { hasCredits, balance } = await checkVideoCredits("brandStoryVideo");
    if (!hasCredits) {
      return NextResponse.json(
        { error: "You need 1 video credit to generate a documentary script.", code: "NO_VIDEO_CREDITS", balance, redirectTo: "/dashboard/video-credits" },
        { status: 402 }
      );
    }

    const body = await request.json().catch(() => ({})) as {
      topic?: string;
      niche?: string;
      style?: string;
      tone?: string;
      length?: "mini" | "short" | "medium" | "long" | "epic";
      voiceId?: string;
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

    // Scene count per length option
    const sceneCount =
      length === "mini"  ? 30
      : length === "short" ? 75
      : length === "long"  ? 250
      : length === "epic"  ? 400
      : 150; // medium default

    const currentYear = 2026;

    const visualStyle = {
      "Dark Luxury": "cinematic dark luxury aesthetic, deep black backgrounds, gold accents, dramatic rim lighting, ultra-high definition, 8K quality",
      "Clean Minimal": "ultra-clean minimal aesthetic, crisp white backgrounds, sharp composition, professional corporate look, magazine quality",
      "Cinematic Dramatic": "cinematic dramatic lighting, high contrast shadows, moody atmosphere, film noir inspired, anamorphic lens flare, Hollywood documentary style",
      "Bold Modern": "bold vibrant colors, dynamic composition, energetic modern design, striking contrasts, Gen Z aesthetic, digital-native feel",
    }[style] ?? "cinematic dark luxury aesthetic, premium quality, dramatic lighting";

    const affiliateName = affiliatePlatform || "the platform in the description";
    const affiliateOfferText = affiliateOffer || "a bonus when you sign up using the link below";

    const ctaInstruction = {
      subscribe: "End with a compelling reason to subscribe for more wealth-building content",
      affiliate: `Naturally weave in the referral: tell viewers you personally use ${affiliateName} and they can get ${affiliateOfferText} — link in the description. Make it feel authentic.`,
      sell_product: productName
        ? `End with a natural mention that ${productName} teaches this in detail — available in the link below`
        : "End by directing viewers to the free resource in the description",
      email_list: "End by offering a free resource (checklist/guide) to viewers who join the email list",
      comment: "End with a thought-provoking question that makes viewers want to comment their answer",
    }[ctaGoal] ?? "End with a strong call to action";

    const hookInstruction = {
      shocking_stat: "Open with a shocking, little-known statistic that immediately grabs attention",
      contrarian: "Open with a bold contrarian statement that challenges what viewers believe",
      story: "Open with a brief compelling story or scenario that hooks emotionally",
      question: "Open with a direct, provocative question that makes viewers want to keep watching",
      reveal: "Open with a promise to reveal a hidden truth most people don't know",
    }[hookStyle] ?? "Open with a powerful hook";

    // ─────────────────────────────────────────────
    // PASS 1: Generate compact outline for ALL scenes
    // ─────────────────────────────────────────────
    const outlineSystemPrompt = `You are an elite YouTube documentary scriptwriter for ${niche} content. Generate a complete scene-by-scene outline.`;

    const midStart = Math.floor(sceneCount * 0.15) + 1;
    const midEnd = sceneCount - 4;
    const affiliateMidNote = ctaGoal === "affiliate"
      ? `- Somewhere in scenes ${midStart}-${midEnd}: briefly mention using ${affiliateName} for investing — 1 scene only, keep it natural`
      : "";

    const outlineUserPrompt = `Create a ${sceneCount}-scene outline for a ${tone} ${niche} documentary.

TOPIC: "${topic}"
CHANNEL: "${channelName || "a premium finance channel"}"
CURRENT YEAR: ${currentYear} — all content must feel current. No stats before 2023.

STRUCTURE (follow exactly):
- Scene 1: Branded intro — establish "${channelName || "the channel"}" brand & credibility. No topic content yet.
- Scene 2: ${hookInstruction}
- Scenes 3-${Math.floor(sceneCount * 0.15)}: Set up the problem / tension — why this matters, real stats, relatable examples
- Scenes ${midStart}-${midEnd}: Deep dive — specific facts, named examples, insights. Build progressively. Vary pace.
${affiliateMidNote}
- Scene ${sceneCount - 3}: Turning point / key revelation that reframes everything
- Scene ${sceneCount - 2}: Actionable takeaway — the #1 thing to do this week
- Scene ${sceneCount - 1}: ${ctaInstruction}
- Scene ${sceneCount}: Branded outro — "New video every week. Subscribe. See you in the next one."

Return ONLY valid JSON:
{
  "scenes": [
    {"sceneNumber": 1, "title": "Short descriptive title", "brief": "One sentence — exactly what this scene covers and why it matters."}
  ],
  "socialMediaPack": {
    "youtubeTitle": "Click-worthy title under 70 chars",
    "youtubeDescription": "SEO-optimised 150-word description with timestamps placeholder and keywords",
    "youtubeTags": ["tag1","tag2","tag3","tag4","tag5","tag6","tag7","tag8","tag9","tag10"],
    "tiktokCaption": "Punchy TikTok/Reels caption with 3-5 hashtags",
    "hook": "Exact first sentence of the video"
  }
}`;

    const outlineRes = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: outlineSystemPrompt },
        { role: "user", content: outlineUserPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
      max_tokens: 16000,
    });

    const outlineRaw = outlineRes.choices[0]?.message?.content ?? "{}";
    let outlineParsed: { scenes?: OutlineScene[]; socialMediaPack?: SocialMediaPack };
    try {
      outlineParsed = JSON.parse(outlineRaw);
    } catch {
      return NextResponse.json({ error: "Failed to generate outline. Please try again." }, { status: 500 });
    }

    const outline: OutlineScene[] = (outlineParsed.scenes ?? []).map((s, i) => ({
      sceneNumber: s.sceneNumber ?? i + 1,
      title: s.title ?? `Scene ${i + 1}`,
      brief: s.brief ?? "",
    }));

    if (outline.length === 0) {
      return NextResponse.json({ error: "No scenes in outline. Please try again." }, { status: 500 });
    }

    // ─────────────────────────────────────────────
    // PASS 2: Expand all batches in PARALLEL
    // ─────────────────────────────────────────────
    const outlineText = outline.map((s) => `Scene ${s.sceneNumber}: ${s.title} — ${s.brief}`).join("\n");
    const batches = chunk(outline, BATCH_SIZE);

    const expandSystemPrompt = `You are expanding scene outlines into full ${tone} documentary narration and cinematic image prompts. Be substantive and engaging.`;

    async function expandBatch(batchScenes: OutlineScene[]): Promise<FinanceDocScene[]> {
      const scenesText = batchScenes.map((s) => `Scene ${s.sceneNumber}: ${s.title} — ${s.brief}`).join("\n");

      const expandPrompt = `TOPIC: "${topic}" | CHANNEL: "${channelName || "Finance Channel"}" | YEAR: ${currentYear}
VISUAL STYLE: ${visualStyle}
FULL OUTLINE CONTEXT (for continuity):
${outlineText}

NOW EXPAND ONLY THESE ${batchScenes.length} SCENES into full narration + image prompts:
${scenesText}

DIALOGUE RULES:
- 3-4 punchy sentences per scene (~10-12 seconds when read aloud at a steady pace)
- Sounds natural when spoken. Specific facts, real examples from 2024-2026.
- Never use "in conclusion", "let's dive in", or generic filler phrases.

IMAGE PROMPT RULES:
- Cinematic, premium visuals: ${visualStyle}
- Include: camera angle (aerial drone, extreme close-up, wide establishing, etc.), explicit lighting description, and key visual elements
- Use: city skylines at night, gold/money close-ups, luxury items as wealth metaphors, abstract data visualisations, dramatic dark environments
- NEVER use: empty wallets, poverty imagery, distress, homelessness — show contrast through luxury vs simplicity instead
- No text, letters, watermarks in the image

Return ONLY valid JSON:
{
  "scenes": [
    {
      "sceneNumber": 1,
      "dialogue": "3-4 punchy sentences. Natural spoken narration. 10-12 seconds.",
      "imagePrompt": "Detailed cinematic description with style, lighting, and composition.",
      "motionPrompt": "Subtle camera motion (slow dolly forward / gentle parallax / slow zoom in / static lockdown)"
    }
  ]
}`;

      const res = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: expandSystemPrompt },
          { role: "user", content: expandPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.85,
        max_tokens: 16000,
      });

      const raw = res.choices[0]?.message?.content ?? "{}";
      try {
        const parsed = JSON.parse(raw) as { scenes?: FinanceDocScene[] };
        return (parsed.scenes ?? []).map((s, i) => ({
          sceneNumber: s.sceneNumber ?? batchScenes[i]?.sceneNumber ?? i + 1,
          dialogue: s.dialogue ?? "",
          imagePrompt: s.imagePrompt ?? "",
          motionPrompt: s.motionPrompt ?? "slow zoom in",
        }));
      } catch {
        // Return empty scenes for this batch on parse failure — partial results better than full failure
        return batchScenes.map((s) => ({
          sceneNumber: s.sceneNumber,
          dialogue: s.brief,
          imagePrompt: `${visualStyle}. Wide establishing cinematic shot.`,
          motionPrompt: "slow zoom in",
        }));
      }
    }

    // Fire all batch expansions in parallel
    const batchResults = await Promise.all(batches.map((batch) => expandBatch(batch)));

    // Merge, sort by scene number, deduplicate
    const allScenes = batchResults
      .flat()
      .sort((a, b) => a.sceneNumber - b.sceneNumber)
      .filter((s, i, arr) => arr.findIndex((x) => x.sceneNumber === s.sceneNumber) === i);

    if (allScenes.length === 0) {
      return NextResponse.json({ error: "No scenes generated. Please try again." }, { status: 500 });
    }

    await deductVideoCredit("brandStoryVideo").catch((e) => console.error("[finance-documentary] credit deduction failed:", e));
    return NextResponse.json({
      scenes: allScenes,
      socialMediaPack: outlineParsed.socialMediaPack ?? null,
      character_seed: null,
    });
  } catch (err) {
    console.error("[finance-documentary]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 }
    );
  }
}
