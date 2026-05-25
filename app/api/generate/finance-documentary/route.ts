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

    // Niche-aware defaults so Tech/History docs don't bleed into finance territory
    const defaultChannelName =
      niche === "History" ? "a history documentary channel"
      : niche === "Technology & AI" ? "a tech documentary channel"
      : "a premium documentary channel";

    // Image prompt guidelines tailored to each niche
    const nicheImageGuidelines =
      niche === "History"
        ? `- Cinematic historical visuals: ${visualStyle}
- Include: camera angle (aerial drone over ancient ruins, extreme close-up of artefact, wide establishing shot of period location), dramatic lighting, authentic period-accurate details
- Use: ancient ruins, historical artefacts, dramatic battle reconstructions, aged maps and manuscripts, candlelit interiors, sweeping period landscapes, dramatic sky
- NEVER use: modern technology, contemporary cities, digital screens`
        : niche === "Technology & AI"
        ? `- Cinematic technology visuals: ${visualStyle}
- Include: camera angle (extreme close-up of circuit board, aerial drone of futuristic city, wide shot of server room), dramatic lighting with cool blues and electric highlights
- Use: glowing circuit boards, holographic interfaces, sleek devices, abstract data streams, futuristic cityscapes, robotic hands, AI visualisations, neon-lit labs
- NEVER use: old technology, analogue imagery, poverty, or finance/money metaphors`
        : `- Cinematic premium visuals: ${visualStyle}
- Include: camera angle (aerial drone, extreme close-up, wide establishing, etc.), explicit lighting description, and key visual elements
- Use: city skylines at night, gold/money close-ups, luxury items as wealth metaphors, abstract data visualisations, dramatic dark environments
- NEVER use: empty wallets, poverty imagery, distress, homelessness — show contrast through luxury vs simplicity instead`;

    const affiliateName = affiliatePlatform || "the platform in the description";
    const affiliateOfferText = affiliateOffer || "a bonus when you sign up using the link below";

    const ctaInstruction = {
      subscribe: `Tell viewers exactly what they'll get by subscribing — a specific upcoming topic or series. End with: "Hit subscribe and turn on notifications — you don't want to miss what's coming next."`,
      affiliate: `Naturally weave in the referral: tell viewers you personally use ${affiliateName} and they can get ${affiliateOfferText} — link in the description. Make it feel like a genuine recommendation, not an ad.`,
      sell_product: productName
        ? `End with a natural mention that ${productName} goes deeper on everything covered — available in the link below. Make it feel like the logical next step, not a sales pitch.`
        : "End by directing viewers to the free resource in the description",
      email_list: "End by offering a specific free resource (e.g. 'I made a free checklist of the 7 steps covered in this video') — available when they join the email list. Be specific about what they'll receive.",
      comment: "End with one specific, polarising question tied directly to the topic. Something people will have strong opinions on. E.g. 'Do you think the average person can still build real wealth in 2026? Drop your answer below.'",
    }[ctaGoal] ?? "End with a strong, specific call to action";

    const hookInstruction = {
      shocking_stat: "Scene 1 opens with ONE jaw-dropping specific statistic that reframes the topic immediately. No intro, no channel name — straight into the stat. E.g. '93% of people who try to build wealth this way fail within 3 years — and nobody tells you why.'",
      contrarian: "Scene 1 opens with a bold statement that directly contradicts what most people believe about this topic. Make it feel like you're about to expose something. E.g. 'Everything you've been told about [topic] is designed to keep you broke.'",
      story: "Scene 1 opens mid-scene in a specific story — a real person, a specific moment, a specific year. No setup. Drop viewers straight into the action. E.g. 'In 2019, a 26-year-old warehouse worker made one decision that completely changed his financial life. This is what he did.'",
      question: "Scene 1 opens with a single pointed question that makes viewers immediately question something they thought they knew. Pause for effect in the writing. E.g. 'What if the reason you're not building wealth has nothing to do with how hard you work?'",
      reveal: "Scene 1 opens by teasing a specific hidden truth — name what it is, say it's been hidden, and promise to reveal it. E.g. 'There's a wealth-building strategy that banks actively discourage — and today, we're exposing exactly how it works.'",
    }[hookStyle] ?? "Scene 1 opens with a powerful hook — no branded intro, straight into the content";

    // ─────────────────────────────────────────────
    // PASS 1: Generate compact outline for ALL scenes
    // ─────────────────────────────────────────────
    const outlineSystemPrompt = `You are an elite YouTube documentary scriptwriter specialising in ${niche} content. You write scripts that get millions of views — your titles, hooks, and structure are engineered for maximum click-through rate and audience retention.`;

    const midStart = Math.floor(sceneCount * 0.15) + 1;
    const midEnd = sceneCount - 4;
    const affiliateMidNote = ctaGoal === "affiliate"
      ? `- Somewhere in scenes ${midStart}-${midEnd}: briefly mention using ${affiliateName} — 1 scene only, keep it natural and authentic`
      : "";

    const outlineUserPrompt = `Create a ${sceneCount}-scene outline for a ${tone} ${niche} documentary.

TOPIC: "${topic}"
CHANNEL: "${channelName || defaultChannelName}"
CURRENT YEAR: ${currentYear} — all content must feel current and specific. No statistics before 2023.

STRUCTURE (follow exactly):
- Scene 1: ${hookInstruction}
- Scenes 2-${Math.floor(sceneCount * 0.12)}: Build tension — why this topic matters RIGHT NOW, specific recent statistics, relatable real examples. Maintain the energy from scene 1.
- Scenes ${Math.floor(sceneCount * 0.12) + 1}-${Math.floor(sceneCount * 0.15)}: Establish credibility — what most people get wrong, and why this video is different
- Scenes ${midStart}-${midEnd}: Deep dive — specific facts, named real-world examples, layered insights. Vary the pace: fast revelations followed by slower explanations. Never let momentum drop.
${affiliateMidNote}
- Scene ${sceneCount - 3}: The big turning point — a revelation that reframes everything the viewer just watched
- Scene ${sceneCount - 2}: Actionable takeaway — the single most important thing to do this week, specific and practical
- Scene ${sceneCount - 1}: ${ctaInstruction}
- Scene ${sceneCount}: Short branded outro — 2 sentences max. Warm, personal sign-off.

YOUTUBE TITLE — CRITICAL (this is what determines if the video gets clicked at all):
Use ONE of these proven high-CTR formulas:
• "The [Shocking Truth / Real Reason / Hidden Secret] About [Topic] Nobody Tells You"
• "Why [Common Belief About Topic] Is [Wrong / A Lie / Keeping You Broke]"
• "How [Specific Person or Group] [Achieved Outcome] Doing This One Thing"
• "[Number] [Things / Signs / Reasons] [Topic] [Strong Outcome] (Most People Don't Know This)"
• "What Happens When [Scenario] — The Truth About [Topic]"

TITLE RULES:
- Must create a CURIOSITY GAP — tease the answer without giving it away
- Must feel PERSONAL to the viewer — use "You" or make them the subject
- Be SPECIFIC — use numbers, years, real names where possible
- NEVER use: "Unlocking", "Exploring", "Deep Dive Into", "Introduction to", "Understanding" — zero clicks
- Under 70 characters. No ALL CAPS words.

Return ONLY valid JSON:
{
  "scenes": [
    {"sceneNumber": 1, "title": "Short descriptive title", "brief": "One sentence — exactly what this scene covers and why it matters."}
  ],
  "socialMediaPack": {
    "youtubeTitle": "High-CTR title using one of the proven formulas — specific, curiosity-gap, personal, under 70 chars",
    "youtubeDescription": "SEO-optimised description. First 2 lines (shown in search) must tease the biggest revelation — make people click. Then 3-4 bullet points of what viewers will learn. Keywords woven naturally. End with: [Timestamps]",
    "youtubeTags": ["tag1","tag2","tag3","tag4","tag5","tag6","tag7","tag8","tag9","tag10"],
    "tiktokCaption": "One punchy sentence that creates instant curiosity, then 3-5 hashtags. No filler.",
    "hook": "The exact first sentence of Scene 1 — the sharpest, most attention-grabbing sentence in the script"
  }
}`;

    const outlineRes = await openai.chat.completions.create({
      model: "gpt-4o-mini",
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

    const expandSystemPrompt = `You are expanding scene outlines into full ${tone} ${niche} documentary narration and cinematic image prompts. Stay strictly on the topic and niche provided — never drift into unrelated subject matter. Be substantive and engaging.`;

    const expandBatch = async (batchScenes: OutlineScene[]): Promise<FinanceDocScene[]> => {
      const scenesText = batchScenes.map((s) => `Scene ${s.sceneNumber}: ${s.title} — ${s.brief}`).join("\n");

      const expandPrompt = `TOPIC: "${topic}" | NICHE: "${niche}" | CHANNEL: "${channelName || defaultChannelName}" | YEAR: ${currentYear}
VISUAL STYLE: ${visualStyle}
FULL OUTLINE CONTEXT (for continuity):
${outlineText}

NOW EXPAND ONLY THESE ${batchScenes.length} SCENES into full narration + image prompts:
${scenesText}

DIALOGUE RULES:
- Stay 100% on the topic and niche: "${niche}" — every sentence must be relevant to "${topic}"
- 3-4 punchy sentences per scene (~10-12 seconds when read aloud at a steady pace)
- Natural spoken delivery — short sentences, rhythm that builds. No academic tone.
- Every sentence must either reveal something, build tension, or move the story forward. No padding.
- Use specific facts: real names, real years, real numbers. "A study found..." is weak. "In 2024, Stanford found that 78% of..." is strong.
- BANNED phrases: "in conclusion", "let's dive in", "it's important to note", "as we can see", "today we're going to", "welcome back", "don't forget to subscribe" mid-script, "that being said", "without further ado"

IMAGE PROMPT RULES:
${nicheImageGuidelines}
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
        model: "gpt-4o-mini",
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
    };

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
