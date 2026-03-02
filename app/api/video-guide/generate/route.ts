/**
 * POST /api/video-guide/generate
 * Generates a multi-platform Video Creation Guide with storytelling frameworks, platform-specific content,
 * content calendar, and repurposing guide.
 * Accepts: { hook, body, cta, productName?, productDescription?, productId?, stockImageUrls?, platforms? }
 * platforms: string[] e.g. ["tiktok", "instagram_reels", "youtube_shorts", ...]
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { scriptsTable } from "@/db/schema/library-schema";
import { eq, and, isNull } from "drizzle-orm";
import { cleanProductTitle } from "@/lib/product-title";
import { getVideoLengthOptionOrDefault } from "@/lib/video-length-options";

const EDITING_STEPS: Record<string, string[]> = {
  CapCut: [
    "Open CapCut and create a new project (9:16 vertical)",
    "Import your images/clips in scene order (tap + on timeline)",
    "Set clip durations per your storyboard timing",
    "Add text overlays: Hook — Bold Montserrat, large, center. Body — slide-up animation",
    "Add transitions per scene direction (quick cut, fade, etc.)",
    "Apply zoom/effects per creative brief (zoom on hook, Ken Burns on solution)",
    "Use Auto Captions for word-by-word highlight (Edit → Captions → Auto Captions)",
    "Sync music beat drops with scene transitions",
  ],
  InShot: [
    "Open InShot and start a new video (9:16)",
    "Import images in storyboard order",
    "Set each clip duration per scene timing",
    "Add text: Tap T, enter exact overlay text, font Montserrat Bold for hooks",
    "Add transitions between clips per brief (Dissolve, Fade, Cut)",
    "Add animations: Zoom for hook, slide up for body",
    "Add subtitles via Text layer, avoid top 15% and bottom 20%",
  ],
  Filmora: [
    "Import media to timeline in scene order",
    "Arrange clips with durations per storyboard",
    "Add Titles with exact overlay text, Montserrat Bold for hooks",
    "Add transitions per scene direction",
    "Apply Ken Burns/zoom effects where specified",
    "Sync music with scene cuts",
  ],
  Canva: [
    "Create a video project, size 1080×1920",
    "Upload images and add to timeline in order",
    "Set each page/clip timing per storyboard",
    "Add text: Hook, Body, CTA with bold font, center alignment",
    "Add transitions (Fade or Dissolve) per brief",
    "Export as MP4, 1080×1920, 30fps",
  ],
};

const STORYTELLING_FRAMEWORK_SYSTEM = `You are an expert multi-platform social media marketing creative director who understands viral sales psychology across TikTok, Instagram, YouTube, Facebook, Pinterest, LinkedIn, and X (Twitter). You create professional creative briefs that convert on every platform.

STORYTELLING FRAMEWORKS (choose the best fit for the product/script):

1. PAIN POINT ANGLE (best for problem-solution products):
   - Scene 1 (0-2s) PATTERN INTERRUPT: Visually jarring, emotionally triggering. Make them stop scrolling.
   - Scene 2 (2-5s) AGITATE THE PROBLEM: Dark/moody, make them FEEL the pain. Highlight what they're doing wrong.
   - Scene 3 (5-10s) THE SHIFT: Dark to bright. Introduce product as turning point.
   - Scene 4 (10-13s) PROOF/VALUE: Quick flashes of product contents. 3 benefits. Fast cuts.
   - Scene 5 (13-15s) CTA: Urgency + clear next step.

2. STORY ANGLE (best for transformation products):
   - Scene 1: "I was [struggle]..." — BEFORE
   - Scene 2: "I tried everything..." — failed attempts
   - Scene 3: "Then I discovered..." — moment of change
   - Scene 4: "Now I..." — AFTER, results
   - Scene 5: CTA with urgency

3. VALUE BOMB ANGLE (best for educational/template products):
   - Scene 1: "Here's a secret about [niche]..." — curiosity hook
   - Scene 2-4: Give 1 genuine tip from the product
   - Scene 5: "I have X more strategies..." + CTA

For EACH scene, specify:
- VISUAL / aiPrompt: MANDATORY LENGTH — each aiPrompt MUST be 50-80 words minimum (count the words). Write a single, dense paragraph paste-ready for DALL-E, Midjourney, or Grok. You MUST include every one of: (1) subject appearance and age range, (2) clothing and expression and pose/gesture, (3) environment with specific objects/furniture/props/background, (4) lighting type and direction, (5) camera angle and framing, (6) art style (e.g. photorealistic, cinematic), (7) color palette, (8) mood/atmosphere, (9) "vertical 9:16", (10) quality keywords like "8k, ultra detailed, sharp focus". Short prompts like "A woman looking stressed at a desk, vertical 9:16" are FORBIDDEN — they must be 50-80+ words. Also set cameraAngle, lightingMood, colorPalette, mediaType.
- TEXT OVERLAY: Exact text, font style, size, position, color, animation, timing
- TRANSITION: Type, effects, pacing
- AUDIO: Music volume, beat drops, SFX, mood

SALES CONVERSION — every scene must help sell the product:
- Scene 1 (Hook): Stop the scroll and make the viewer feel "that's me" — the pain or desire must be specific so they stay.
- Scene 2 (Agitate): Deepen the problem or desire so they think "I need a solution."
- Scene 3 (Introduce product): Show the product as the answer. Visual must show the product or the moment of change; text must name a clear benefit or "how it helps."
- Scene 4 (Proof / benefits): Show results, transformation, or a second benefit. Give a reason to believe (e.g. "organized," "focused," "done in half the time") so they want it.
- Scene 5 (CTA): One clear next step to buy (e.g. "link in bio," "get it now," "try free"). Create urgency or FOMO.
Every TEXT OVERLAY should either state a benefit, remove an objection, or tell them what to do next. Every VISUAL should support that — e.g. show the product in use, the before/after, or the outcome they get.

ENGAGEMENT RULES:
- First frame = thumbnail. Most important frame.
- Text readable in 0.5 seconds.
- Never put important text in top 15% or bottom 20% (UI overlaps).
- Use open loops — start thought in one scene, finish in next.
- CTA: FOMO/curiosity + clear action (link in bio, get it, try it).

Output MUST be valid JSON. Be specific. A finance workbook gets different visuals than a fitness planner. A journal gets softer visuals than a checklist pack.`;

function buildCreativeBriefPrompt(
  productName: string,
  productDesc: string,
  hook: string,
  body: string,
  cta: string,
  durationSeconds?: number
): string {
  const lengthOpt = durationSeconds != null ? getVideoLengthOptionOrDefault(durationSeconds) : null;
  const sceneInstruction = lengthOpt
    ? `Total video length: ${lengthOpt.durationSec} seconds. Include exactly ${lengthOpt.scenesMin}–${lengthOpt.scenesMax} scenes. Each scene's "timing" must use timestamps that span 0s to ${lengthOpt.durationSec}s (e.g. "0-3s", "3-8s", ...).`
    : "Include 5 scenes.";
  return `Product: "${productName}"
${productDesc ? `Description: ${productDesc}` : ""}
IMPORTANT: Use the exact product name "${productName}" everywhere in the brief (scene text, overlays, prompts). Never use a placeholder; always use the product name above.

Script:
- Hook: "${hook || ""}"
- Body: "${(body || "").slice(0, 400)}"
- CTA: "${cta || ""}"

Generate a TikTok creative brief designed to SELL this product. Choose the best storytelling framework (Pain Point, Story, or Value Bomb) for this product.

SALES INTENT — each scene must support the sale:
- TEXT OVERLAY (exactText): Every line must do one of: (1) state a specific benefit of the product, (2) answer "why should I get this?", (3) show the transformation or result, or (4) be a clear CTA (e.g. "Link in bio," "Get it now"). Avoid vague filler; use copy that would convince someone to buy.
- VISUAL (aiPrompt): Scenes 3–4 must show the product or the outcome (e.g. person using the product, before/after, organized result). The visual should make the viewer want the product or feel the benefit. Use the product name "${productName}" in the prompt where the product appears on screen.

CRITICAL — AI IMAGE PROMPTS (visualDirection.aiPrompt) — WORD COUNT ENFORCED:
Each scene's aiPrompt MUST be 50-80 words minimum. Count the words. Shorter prompts are invalid.
Write a single, dense paragraph that can be pasted directly into Midjourney, DALL-E, ChatGPT image, or Grok.
Every aiPrompt MUST explicitly include ALL of the following (use this checklist):
1. Subject: appearance, age range, clothing, expression, pose/gesture
2. Environment: specific objects, furniture, props, background elements
3. Lighting: type and direction (e.g. golden hour, soft studio lighting, warm lamplight, neon)
4. Camera: angle and framing (close-up, wide shot, over-the-shoulder, bird's eye, medium shot)
5. Art style: e.g. photorealistic, cinematic, editorial, lifestyle photography
6. Color palette: e.g. warm tones, cool blues, muted earth tones, vibrant accents
7. Mood/atmosphere: e.g. energetic, calm, dramatic, stressed, inspirational
8. Aspect ratio: always include "vertical 9:16"
9. Quality keywords: end with "8k, ultra detailed, sharp focus" or similar

Example of a VALID aiPrompt (50+ words): "Photorealistic close-up of a young woman in her mid-20s with natural makeup, wearing a cozy cream sweater, sitting at a messy wooden desk covered with crumpled bills and a laptop showing a bank account, soft warm lamplight casting shadows, stressed expression with her hand on her forehead, shallow depth of field, muted warm tones with pops of red from overdue notices, cinematic mood, vertical 9:16, ultra detailed, 8k"

FORBIDDEN — do NOT output short prompts like "A young woman looking stressed while staring at bills on a cluttered desk, vertical 9:16, financial struggle theme". That is under 25 words and will be rejected. Every aiPrompt must be 50-80+ words with full subject, environment, lighting, camera, style, color, mood, aspect ratio, and quality keywords.

Return ONLY this JSON object (no markdown, no code fences):
{
  "storytellingFramework": "Pain Point Angle" | "Story Angle" | "Value Bomb Angle",
  "frameworkRationale": "1-2 sentences on why this framework fits this product",
  "scenes": [
    {
      "scene": "Scene 1 - [Name]",
      "timing": "0-2s",
      "visualDirection": {
        "aiPrompt": "50-80 words minimum. Single dense paragraph with: subject (appearance, age, clothing, expression, pose), environment (specific objects/furniture/background), lighting, camera angle/framing, art style, color palette, mood, vertical 9:16, quality keywords (8k, ultra detailed, sharp focus). Paste-ready for DALL-E/Midjourney/Grok.",
        "cameraAngle": "close-up" | "wide" | "overhead" | "medium",
        "lightingMood": "dark/moody" | "bright/clean" | "soft/warm" | "high contrast",
        "colorPalette": "Describe colors matching product branding",
        "mediaType": "still image" | "AI video" | "screen recording"
      },
      "textOverlay": {
        "exactText": "Exact text to display on screen",
        "fontStyle": "Bold sans-serif" | "Clean serif" | "Impact",
        "size": "large" | "medium" | "small",
        "position": "center" | "bottom third" | "upper third",
        "color": "white with black shadow" | "high contrast",
        "animation": "word-by-word reveal" | "fade in" | "slide up" | "none",
        "timingNote": "When each word appears (e.g. 0.5s per word)"
      },
      "transition": {
        "toNextScene": "quick cut" | "fade" | "dissolve" | "wipe",
        "effects": "zoom in slowly" | "Ken Burns" | "shake/glitch" | "none",
        "pacing": "fast (0.5-1s)" | "medium (1-2s)" | "slow (2-3s)"
      },
      "audio": {
        "musicVolume": "loud" | "medium" | "quiet",
        "beatDrops": "align with scene change at Xs" | "none",
        "soundEffects": "whoosh on transition" | "ding on benefit" | "none",
        "mood": "tense" | "uplifting" | "curious" | "urgent"
      }
    }
  ],
  "engagementTriggers": [
    "First frame must work as thumbnail — [specific to this video]",
    "Text readable in 0.5 seconds",
    "Avoid top 15% and bottom 20% for important text",
    "Open loop: [specific example for this script]",
    "CTA creates FOMO: [specific suggestion]"
  ]
}

${sceneInstruction} Be specific to the product niche. Output ONLY the JSON object.`;
}

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: "TikTok",
  instagram_reels: "Instagram Reels",
  youtube_shorts: "YouTube Shorts",
  youtube_longform: "YouTube Long-form",
  facebook_reels: "Facebook Reels",
  pinterest_video: "Pinterest Video Pins",
  linkedin_video: "LinkedIn Video",
  x_video: "X (Twitter) Video",
};

function buildPlatformContentPrompt(
  productName: string,
  productDesc: string,
  hook: string,
  body: string,
  cta: string,
  platforms: string[],
  storytellingFramework: string
): string {
  const platformList = platforms.map((p) => PLATFORM_LABELS[p] || p).join(", ");
  return `Product: "${productName}"
${productDesc ? `Description: ${productDesc}` : ""}
IMPORTANT: Use the exact product name "${productName}" in all platform content. Never use a placeholder; use this name only.

Script:
- Hook: "${hook || ""}"
- Body: "${(body || "").slice(0, 300)}"
- CTA: "${cta || ""}"

Storytelling framework: ${storytellingFramework}

Target platforms: ${platformList}

Generate the RIGHT content type for each platform (not every platform is video-first):

X (Twitter) — PRIMARY: TEXT THREADS, not video.
- "tweetThread": array of 5-7 strings. Tweet 1: Hook (pattern interrupt). Tweets 2-5: Value/story (one key point each). Tweet 6: CTA ("DM me [word] for the link"). Tweet 7: Self-reply with link instruction.
- "tweetVariations": 2-3 standalone tweet texts for A/B testing.
- "firstTweetImagePrompt": One DALL-E prompt for an eye-catching image to attach to tweet 1.
- "quoteTweetGuide": When to quote-tweet, how to engage replies.

LinkedIn — PRIMARY: TEXT POSTS + IMAGE, not video.
- "linkedInPost": { "hook": "Opening line (shows before see more)", "body": "Story-based, professional tone", "takeaways": "Key points with line breaks", "cta": "Comment [word] and I'll send you the link" }
- "linkedInCarouselOption": Short guide for multi-image carousel version.
- "imageDirection": Product mockup or infographic-style image prompt.
- "algorithmGuide": Comment in first hour, engage with others first.

Pinterest — PRIMARY: STATIC PINS (images), not video.
- "pinDesignDirection": Long vertical 1000x1500px, product mockup with text overlay, clean aesthetic, title text readable at small size.
- "pinTitleVariations": array of 3-5 pin title strings.
- "pinDescription": Full description with keywords (Pinterest is search).
- "boardNameSuggestions": 2-3 board names.
- "pinterestSeoGuide": How pins go viral over months, SEO tips.
- "ideaPinsOption": Optional Idea Pins (multi-image story) as secondary.

Facebook — PRIMARY: REELS + GROUP POSTS.
- Keep "adaptedScript" for Reel (same as Instagram Reels).
- "facebookGroupPost": { "hookQuestion": "...", "body": "...", "cta": "Link in comments" } for Groups.
- "facebookGroupsGuide": Which Groups to post in for this niche.
- "marketplaceGuide": If selling digital products, short Marketplace tip.

Instagram — Reels + Carousels + Stories.
- Keep "adaptedScript", "captionTemplate" for Reels.
- "instagramCarouselGuide": 10 slides — Slide 1: Hook/title. Slides 2-8: Key points. Slide 9: Summary. Slide 10: CTA.
- "instagramStorySequence": Post story slides to drive to link.
- "captionTemplate": Include hashtags.

TikTok / YouTube Shorts — Keep video-first: adaptedScript, aiPromptHint, postingStrategy, captionTemplate, engagementStrategy, exportSettings.
YouTube Long-form — Keep: adaptedScript, full tutorial/review style, thumbnailGuide.

Return ONLY this JSON object (no markdown). Include ONLY platforms in the list. For each platform include the fields that apply (e.g. x_video gets tweetThread, tweetVariations, firstTweetImagePrompt, quoteTweetGuide; linkedin_video gets linkedInPost, linkedInCarouselOption, imageDirection, algorithmGuide; etc.):
{
  "platformGuides": {
    "tiktok": { "platformNotes": "...", "adaptedScript": { "hook": "...", "body": "...", "cta": "..." }, "aiPromptHint": "...", "postingStrategy": "...", "captionTemplate": "...", "engagementStrategy": "...", "exportSettings": "..." },
    "x_video": { "platformNotes": "Primary: text threads", "tweetThread": ["tweet1", "tweet2", ...], "tweetVariations": ["standalone1", "standalone2"], "firstTweetImagePrompt": "...", "quoteTweetGuide": "..." },
    "linkedin_video": { "platformNotes": "...", "linkedInPost": { "hook": "...", "body": "...", "takeaways": "...", "cta": "..." }, "linkedInCarouselOption": "...", "imageDirection": "...", "algorithmGuide": "..." },
    "pinterest_video": { "platformNotes": "...", "pinDesignDirection": "...", "pinTitleVariations": ["title1", ...], "pinDescription": "...", "boardNameSuggestions": ["...", "..."], "pinterestSeoGuide": "...", "ideaPinsOption": "..." },
    "facebook_reels": { "platformNotes": "...", "adaptedScript": {...}, "facebookGroupPost": { "hookQuestion": "...", "body": "...", "cta": "..." }, "facebookGroupsGuide": "...", "marketplaceGuide": "..." },
    "instagram_reels": { "platformNotes": "...", "adaptedScript": {...}, "instagramCarouselGuide": "...", "instagramStorySequence": "...", "captionTemplate": "...", "postingStrategy": "...", "exportSettings": "..." }
  },
  "contentCalendar": [ { "day": 1, "actions": "..." }, ... ],
  "repurposingGuide": [ "...", ... ],
  "thumbnailGuide": "Only if youtube_longform selected: ..."
}

Include platformGuides ONLY for these platform IDs: ${platforms.join(", ")}. contentCalendar and repurposingGuide tailored to selected platforms. Output ONLY the JSON object.`;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const {
      hook,
      body: bodyText,
      cta,
      productName,
      productDescription,
      productId,
      stockImageUrls,
      platforms: platformsReq,
      durationSeconds: durationSecondsReq,
      targetDurationSec: targetDurationSecReq,
      logoDataUrl,
      regenerateScenesOnly,
    } = body as {
      hook?: string;
      body?: string;
      cta?: string;
      productName?: string;
      productDescription?: string;
      productId?: string;
      stockImageUrls?: string[];
      platforms?: string[];
      durationSeconds?: number;
      targetDurationSec?: number;
      logoDataUrl?: string;
      regenerateScenesOnly?: boolean;
    };
    const durationSeconds =
      (typeof durationSecondsReq === "number" && [15, 30, 60, 90].includes(durationSecondsReq) ? durationSecondsReq : null) ??
      (typeof targetDurationSecReq === "number" && [15, 30, 60, 90].includes(targetDurationSecReq) ? targetDurationSecReq : null) ??
      undefined;

    const selectedPlatforms = Array.isArray(platformsReq) && platformsReq.length > 0 ? platformsReq : ["tiktok"];

    const rawProductName = typeof productName === "string" ? productName.trim() : "";
    let productNameRes = cleanProductTitle(rawProductName) || rawProductName || "the product";
    let productDesc = productDescription || "";
    let stockImages: string[] = Array.isArray(stockImageUrls) ? stockImageUrls : [];

    if (productId && userId) {
      const [product] = await db
        .select()
        .from(productsTable)
        .where(
          and(
            eq(productsTable.id, productId),
            eq(productsTable.userId, userId),
            isNull(productsTable.deletedAt)
          )
        );
      if (product) {
        const marketing = (product.marketingAssets ?? {}) as { productTitle?: string };
        const rawTitle = (marketing.productTitle ?? product.title ?? "").trim();
        productNameRes = cleanProductTitle(rawTitle) || rawTitle || productNameRes;
        const maDesc = (product.marketingAssets as { productDescription?: string } | null)?.productDescription;
        if (typeof maDesc === "string" && maDesc.trim()) productDesc = maDesc;
        const ma = product.marketingAssets as { thumbnailUrl?: string; galleryUrls?: string[] } | null;
        if (ma?.thumbnailUrl) stockImages = [ma.thumbnailUrl];
        if (Array.isArray(ma?.galleryUrls)) stockImages = [...stockImages, ...ma.galleryUrls];
      }
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    let creativeBrief: {
      storytellingFramework?: string;
      frameworkRationale?: string;
      scenes?: Array<{
        scene: string;
        timing: string;
        visualDirection?: {
          aiPrompt: string;
          cameraAngle?: string;
          lightingMood?: string;
          colorPalette?: string;
          mediaType?: string;
        };
        textOverlay?: {
          exactText: string;
          fontStyle?: string;
          size?: string;
          position?: string;
          color?: string;
          animation?: string;
          timingNote?: string;
        };
        transition?: { toNextScene?: string; effects?: string; pacing?: string };
        audio?: { musicVolume?: string; beatDrops?: string; soundEffects?: string; mood?: string };
      }>;
      engagementTriggers?: string[];
    } | null = null;

    if (apiKey) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: STORYTELLING_FRAMEWORK_SYSTEM },
            {
              role: "user",
              content: buildCreativeBriefPrompt(
                productNameRes,
                productDesc,
                hook || "",
                bodyText || "",
                cta || "",
                durationSeconds
              ),
            },
          ],
          temperature: 0.7,
          max_tokens: 4000,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const content = data.choices?.[0]?.message?.content?.trim() ?? "";
        let jsonStr = content.replace(/^```json?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed?.scenes && Array.isArray(parsed.scenes)) creativeBrief = parsed;
        } catch {
          // fallback below
        }
      }
    }

    // When only regenerating scenes, return new scenes/scenePrompts and skip platform content + library save
    if (regenerateScenesOnly) {
      if (!creativeBrief?.scenes?.length) {
        return NextResponse.json(
          { error: "Failed to generate scenes. Please try again." },
          { status: 422 }
        );
      }
      const scenePromptsOut: { scene: string; timing: string; prompt: string }[] = [];
      for (const s of creativeBrief.scenes) {
        const prompt =
          s.visualDirection?.aiPrompt ||
          `Generate a TikTok marketing scene, vertical 9:16, for ${productNameRes}`;
        scenePromptsOut.push({ scene: s.scene, timing: s.timing, prompt });
      }
      return NextResponse.json({
        scenes: creativeBrief.scenes,
        scenePrompts: scenePromptsOut,
        storytellingFramework: creativeBrief.storytellingFramework ?? undefined,
        frameworkRationale: creativeBrief.frameworkRationale ?? undefined,
        engagementTriggers: creativeBrief.engagementTriggers ?? undefined,
      });
    }

    // Second AI call: platform-specific content, content calendar, repurposing guide
    let platformGuides: Record<string, unknown> = {};
    let contentCalendar: Array<{ day: number; actions: string }> = [];
    let repurposingGuide: string[] = [];
    let thumbnailGuide: string | null = null;

    if (apiKey && selectedPlatforms.length > 0) {
      const platformPrompt = buildPlatformContentPrompt(
        productNameRes,
        productDesc,
        hook || "",
        bodyText || "",
        cta || "",
        selectedPlatforms,
        creativeBrief?.storytellingFramework ?? "Pain Point Angle"
      );
      const res2 = await fetch("https://api.openai.com/v1/chat/completions", {
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
              content: "You are a social media marketing strategist. Return ONLY valid JSON. No markdown, no code fences.",
            },
            { role: "user", content: platformPrompt },
          ],
          temperature: 0.7,
          max_tokens: 4000,
        }),
      });

      if (res2.ok) {
        const data2 = (await res2.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const content2 = data2.choices?.[0]?.message?.content?.trim() ?? "";
        const jsonStr2 = content2.replace(/^```json?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
        try {
          const parsed2 = JSON.parse(jsonStr2);
          if (parsed2?.platformGuides && typeof parsed2.platformGuides === "object") {
            platformGuides = parsed2.platformGuides;
          }
          if (Array.isArray(parsed2?.contentCalendar)) {
            contentCalendar = parsed2.contentCalendar;
          }
          if (Array.isArray(parsed2?.repurposingGuide)) {
            repurposingGuide = parsed2.repurposingGuide;
          }
          if (typeof parsed2?.thumbnailGuide === "string" && parsed2.thumbnailGuide) {
            thumbnailGuide = parsed2.thumbnailGuide;
          }
        } catch {
          // fallback below
        }
      }
    }

    // Fallback content calendar and repurposing guide when AI fails
    if (contentCalendar.length === 0) {
      contentCalendar = [
        { day: 1, actions: "Post pain point video on TikTok + Instagram" },
        { day: 2, actions: "Post story angle on YouTube Shorts" },
        { day: 3, actions: "Post value bomb on selected platforms" },
        { day: 4, actions: "Repost best performer with different hook" },
        { day: 5, actions: "Behind-the-scenes or making-of content" },
        { day: 6, actions: "Engage with comments, respond to top questions" },
        { day: 7, actions: "Community engagement, repost top comments" },
      ];
    }
    if (repurposingGuide.length === 0) {
      repurposingGuide = [
        "Export base video in 9:16 — use for TikTok, Reels, Shorts",
        "Crop 9:16 to 1:1 for Instagram feed or LinkedIn",
        "Extend a 15s Short into a 3min YouTube video with more detail",
        "Turn video script into an Instagram carousel (1 slide per scene)",
      ];
    }

    // Build scenePrompts from creative brief or fallback
    const scenePrompts: { scene: string; timing: string; prompt: string }[] = [];
    if (creativeBrief?.scenes?.length) {
      for (const s of creativeBrief.scenes) {
        const prompt =
          s.visualDirection?.aiPrompt ||
          `Generate a TikTok marketing scene, vertical 9:16, for ${productNameRes}`;
        scenePrompts.push({
          scene: s.scene,
          timing: s.timing,
          prompt,
        });
      }
    }

    if (scenePrompts.length === 0) {
      scenePrompts.push(
        {
          scene: "Pattern Interrupt (0-2s)",
          timing: "0-2s",
          prompt: `Dramatic close-up of someone stressed or frustrated, dark moody lighting, vertical 9:16 format`,
        },
        {
          scene: "Agitate Problem (2-5s)",
          timing: "2-5s",
          prompt: `Person scrolling phone late at night overwhelmed, soft blue light, vertical 9:16`,
        },
        {
          scene: "The Shift (5-10s)",
          timing: "5-10s",
          prompt: `Bright clean mockup of ${productNameRes} on tablet or laptop, professional lighting, minimal background, vertical 9:16`,
        },
        {
          scene: "Proof/Value (10-13s)",
          timing: "10-13s",
          prompt: `Quick flash of digital product pages/sections, text overlays showing benefits, vertical 9:16`,
        },
        {
          scene: "CTA (13-15s)",
          timing: "13-15s",
          prompt: `Bold text "${(cta || "Link in Bio").slice(0, 30)}" on gradient background, eye-catching, vertical 9:16`,
        }
      );
    }

    const stockSuggestions =
      stockImages.length > 0
        ? [
            { scene: "Scene 1 (Hook)", suggestion: stockImages[0], note: "Pattern interrupt / emotional hook" },
            { scene: "Scene 3 (Shift)", suggestion: stockImages[0], note: "Product thumbnail for solution" },
            ...(stockImages.length > 1
              ? [{ scene: "Scene 2 (Problem)", suggestion: stockImages[1], note: "Problem/body section" }]
              : []),
          ]
        : [];

    const subtitleRecs = {
      style: "Bold white with black outline (highest engagement)",
      font: "Montserrat Bold or Impact",
      position: "Center or bottom third — avoid top 15% and bottom 20%",
      animation: "Word-by-word highlight (CapCut Auto Captions)",
    };

    const musicRecs = {
      mood:
        creativeBrief?.scenes?.[0]?.audio?.mood === "tense"
          ? "Start tense/anxious, build to uplifting at solution scene"
          : "Trending motivational or uplifting (for digital products)",
      sources: ["CapCut library (free)", "Epidemic Sound", "YouTube Audio Library"],
      volume: "20% background, voice/text dominant. Sync beat drops with scene transitions.",
    };

    const exportSettings = {
      resolution: "1080×1920 (vertical)",
      fps: 30,
      format: "MP4",
      fileSize: "Under 50MB for TikTok",
    };

    const guide = {
      script: { hook: hook || "", body: bodyText || "", cta: cta || "" },
      scenePrompts,
      stockSuggestions,
      editingSteps: EDITING_STEPS,
      subtitleRecs,
      musicRecs,
      exportSettings,
      productName: productNameRes,
      storytellingFramework: creativeBrief?.storytellingFramework ?? "Pain Point Angle",
      frameworkRationale: creativeBrief?.frameworkRationale ?? "Problem-solution structure converts well for digital products.",
      scenes: creativeBrief?.scenes ?? null,
      engagementTriggers: creativeBrief?.engagementTriggers ?? [
        "First frame must work as thumbnail — most important frame",
        "Text readable in 0.5 seconds",
        "Never put important text in top 15% or bottom 20% (UI overlaps)",
        "Use open loops — start a thought in one scene, finish in the next",
        "CTA should create FOMO or curiosity, not just 'buy this'",
      ],
      // Multi-platform fields
      platforms: selectedPlatforms,
      platformGuides: Object.keys(platformGuides).length > 0 ? platformGuides : null,
      contentCalendar,
      repurposingGuide,
      thumbnailGuide,
      ...(typeof logoDataUrl === "string" && logoDataUrl.startsWith("data:") && { logoDataUrl }),
    };

    // Save video guide to library so it appears in My Library alongside products and scripts
    let savedScriptId: string | null = null;
    try {
      const [inserted] = await db
        .insert(scriptsTable)
        .values({
          userId,
          title: `Video Guide: ${productNameRes || "Untitled"}`.trim(),
          content: JSON.stringify(guide),
          platform: "video-guide",
          productId: productId || null,
        })
        .returning({ id: scriptsTable.id });
      if (inserted?.id) savedScriptId = inserted.id;
    } catch (saveErr) {
      console.warn("[video-guide] Failed to save guide to library:", saveErr);
      // Do not fail the request; guide is still returned and user can view it
    }

    return NextResponse.json({ ...guide, ...(savedScriptId && { libraryScriptId: savedScriptId }) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate guide";
    console.error("[video-guide]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
