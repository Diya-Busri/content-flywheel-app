import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const ANGLES = [
  { id: "story", name: "Build in Public", description: "Show the real process — decisions made, mistakes made, what you'd do differently. Honest, specific, no polished narrative arc." },
  { id: "problem-solution", name: "Psychology / Problem", description: "Identify the real mental pattern holding people back — not the surface problem but the root cause — then show how to break it." },
  { id: "educational", name: "Workflow / System", description: "Step-by-step breakdown of how to actually do the thing. Tool-based, specific, beginner-friendly. No theory — just the real workflow." },
  { id: "results", name: "Case Study / Results", description: "Show real numbers, real outcomes, real timelines. What happened, what worked, what didn't. No hype — just honest reporting." },
] as const;

function getAnglesToGenerate(angleIds?: unknown): (typeof ANGLES)[number][] {
  if (!Array.isArray(angleIds) || angleIds.length === 0) return [...ANGLES];
  const set = new Set(angleIds.map((a) => String(a).toLowerCase()));
  return ANGLES.filter((a) => set.has(a.id));
}

const MODEL_ORDER = ["gpt-4o-mini"] as const;

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const apiRl = await checkApiRateLimit(userId);

    if (apiRl) return apiRl;

    const rl = checkAiRateLimit(userId);
    if (rl) return rl;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "JSON body required" }, { status: 400 });
    }

    const topicInput = body.topic;
    const topic =
      typeof topicInput === "string"
        ? topicInput.trim()
        : topicInput != null && typeof topicInput === "object" && typeof topicInput.title === "string"
          ? topicInput.title.trim()
          : "";
    const niche = typeof body.niche === "string" ? body.niche.trim() : "";
    const contentStyle = typeof body.contentStyle === "string" ? body.contentStyle.trim() : "";
    const videoDuration = body.videoDuration ?? "10";
    const angleIds = body.angles;

    if (!topic || !niche) {
      return NextResponse.json(
        { error: "Missing required fields: topic and niche" },
        { status: 400 }
      );
    }

    const minutes = Math.min(
      120,
      Math.max(5, parseInt(String(videoDuration).replace(/[^0-9]/g, ""), 10) || 10)
    );
    const wordCount = minutes * 150;

    if (!process.env.OPENAI_API_KEY?.trim()) {
      return NextResponse.json(
        { error: "OpenAI API key is not configured. Add OPENAI_API_KEY to .env.local" },
        { status: 503 }
      );
    }

    // Section word counts: 6+ calls per script to stay within GPT-4 limits (avoid truncated JSON)
    const hookIntroWords = 300;
    const mainContentTotal = Math.floor(wordCount * 0.75);
    const maxChunkWords = 1400; // keep under 8k token response
    const numMainChunks = Math.max(4, Math.ceil(mainContentTotal / maxChunkWords));
    const mainChunkWords = Math.floor(mainContentTotal / numMainChunks);
    const recapWords = Math.floor(wordCount * 0.08);
    const ctaWords = Math.floor(wordCount * 0.05);
    const recapCtaWords = recapWords + ctaWords;

    const anglesToGenerate = getAnglesToGenerate(angleIds);
    console.log(
      `Generating ${minutes}-min scripts (~${wordCount} words), ${anglesToGenerate.length} angle(s): hook+intro ${hookIntroWords}, ${numMainChunks}×main ~${mainChunkWords}, recap+cta ${recapCtaWords}`
    );

    const scripts: Record<string, unknown>[] = [];

    for (const angle of anglesToGenerate) {
      console.log(`Generating: ${angle.name}`);
      const script = await generateSingleScriptInSections({
        topic,
        niche,
        contentStyle,
        minutes,
        wordCount,
        angle,
        hookIntroWords,
        mainChunkWords,
        numMainChunks,
        recapCtaWords,
        recapWords,
        ctaWords,
      });
      scripts.push(script);
    }

    return NextResponse.json({ scripts });
  } catch (error) {
    console.error("=== ERROR IN YOUTUBE SCRIPTS API ===");
    console.error("Error:", error instanceof Error ? error.message : error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to generate scripts",
      },
      { status: 500 }
    );
  }
}

/** Single OpenAI call with model fallback. */
async function callOpenAI(
  systemContent: string,
  userContent: string,
  options?: { maxTokens?: number }
): Promise<string> {
  const maxTokens = options?.maxTokens ?? 8192;
  let lastError: unknown = null;
  for (const model of MODEL_ORDER) {
    try {
      const completion = await openai.chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemContent },
          { role: "user", content: userContent },
        ],
        temperature: 0.85,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
      });
      const text = completion.choices[0]?.message?.content ?? null;
      if (text) return text;
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isCapacity =
        msg.includes("503") ||
        msg.includes("capacity") ||
        msg.includes("overloaded") ||
        msg.includes("rate limit");
      if (isCapacity && model !== MODEL_ORDER[MODEL_ORDER.length - 1]) {
        console.warn(`  Model ${model} unavailable, trying next...`);
        continue;
      }
      throw err;
    }
  }
  if (lastError) throw lastError;
  throw new Error("Empty response from OpenAI");
}

/**
 * Parse JSON from a section response. If truncated (unterminated string), try to close the string and object.
 */
function parseSectionJson<T>(raw: string, sectionName: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("Unterminated string") && !msg.includes("Unexpected end of JSON")) {
      console.error(`[${sectionName}] JSON parse error:`, msg);
      throw err;
    }
    const trimmed = raw.trim();
    const repaired = trimmed.endsWith('"') ? trimmed + "}" : trimmed + '"}';
    try {
      return JSON.parse(repaired) as T;
    } catch (e2) {
      console.error(`[${sectionName}] Truncated response (repair failed). Length: ${raw.length}`);
      throw err;
    }
  }
}

function getStyleBlock(contentStyle: string): string {
  return contentStyle === "faceless"
    ? "FACELESS: Voiceover narration. No \"I\"/\"me\" unless in a story. Include B-roll scene descriptions."
    : contentStyle === "ai-generated"
      ? "AI-GENERATED: For AI avatar/voiceover. Clear pacing. Write only spoken script—no 'Visual Prompt:', no '[Visual prompt: ...]' bracketed notes, no production/direction notes."
      : "PERSONAL BRAND: On-camera. Natural, conversational. Include gestures and expressions.";
}

/** 1. Hook + Intro (~300 words) */
async function generateHookIntro(params: {
  topic: string;
  niche: string;
  contentStyle: string;
  minutes: number;
  angle: (typeof ANGLES)[number];
  hookIntroWords: number;
}): Promise<{ hook: string; intro: string }> {
  const { topic, niche, contentStyle, minutes, angle, hookIntroWords } = params;
  const styleBlock = getStyleBlock(contentStyle);

  const prompt = `Write ONLY the opening of a ${minutes}-minute YouTube script.

**Topic:** ${topic}
**Niche:** ${niche}
**Angle:** ${angle.name} - ${angle.description}
**Content Style:** ${contentStyle}
${styleBlock}

**VIDEO STRUCTURE TO FOLLOW:**
Hook → Relatable problem → Founder observation → Why it happens → The system/solution → Soft CTA (comes at the end, not here)

**HOOK requirements (80–120 words):**
- Open with a direct, uncomfortable truth or a bold observation — NOT a question, NOT a statistic, NOT "In this video I'll show you..."
- Make the viewer feel like you're talking about something they've privately thought but never heard said out loud
- Do NOT use: "unlock", "supercharge", "boost", "transform", "be consistent", "valuable content", "game-changing"
- Aim for this energy: "Most people don't fail at [topic] because they're lazy. They fail because nobody gave them a system." or "The real reason you haven't started isn't motivation. It's that you don't know exactly what to do next."

**INTRO requirements (remaining words to total ${hookIntroWords} words):**
- Move from the hook into the relatable problem: zoom in on *why* this happens, not just *that* it happens
- Brief founder observation: one line that shows you've seen this pattern, not just read about it
- What they'll get from this video — stated directly, no hype
- Write only spoken words. No production notes, no bracketed annotations, no "Visual Prompt:" labels.

Write every word the speaker will say. No summaries or placeholders.

Return ONLY valid JSON:
{ "hook": "full hook text...", "intro": "full intro text..." }`;

  const system =
    "You are a YouTube scriptwriter with a direct, founder-led voice. You write scripts that feel honest and specific — not like a marketing agency wrote them. Your hooks open with uncomfortable truths or bold observations, never questions or statistics. You never use phrases like 'valuable content', 'be consistent', 'unlock', 'supercharge', or 'boost'. Write COMPLETE script text at the requested length. Never abbreviate. Never include production notes or bracketed annotations — only the spoken words.";
  const raw = await callOpenAI(system, prompt);
  const data = parseSectionJson<{ hook?: string; intro?: string }>(raw, "Hook+Intro");
  return {
    hook: typeof data.hook === "string" ? data.hook.trim() : "",
    intro: typeof data.intro === "string" ? data.intro.trim() : "",
  };
}

/** Main content chunk (e.g. sections 1-2, 3-4, ...) */
async function generateMainChunk(params: {
  topic: string;
  niche: string;
  contentStyle: string;
  minutes: number;
  angle: (typeof ANGLES)[number];
  chunkIndex: number;
  totalChunks: number;
  totalSections: number;
  chunkWords: number;
  previousSummary?: string;
}): Promise<string> {
  const {
    topic,
    niche,
    contentStyle,
    minutes,
    angle,
    chunkIndex,
    totalChunks,
    totalSections,
    chunkWords,
    previousSummary,
  } = params;
  const styleBlock = getStyleBlock(contentStyle);
  const sectionStart = chunkIndex * 2 + 1;
  const sectionEnd = Math.min(sectionStart + 1, totalSections);

  const prompt = `Write ONLY main-content sections ${sectionStart} and ${sectionEnd} of a ${minutes}-minute YouTube script (sections ${sectionStart}-${sectionEnd} of ${totalSections}).

**Topic:** ${topic}
**Niche:** ${niche}
**Angle:** ${angle.name} - ${angle.description}
**Content Style:** ${contentStyle}
${styleBlock}

**Requirements:**
- Write EXACTLY ${chunkWords} words of detailed content for sections ${sectionStart} and ${sectionEnd}.
- Full paragraphs, examples, actionable steps. No bullet summaries.
- Write only spoken words. Do NOT include "Visual Prompt:", "[Visual prompt: ...]", "vidual prompt", or any production/direction notes in the script. No bracketed annotations like [Visual prompt: ...].
- If this is not the first chunk, stay consistent with the script.${previousSummary ? `\n**What came before (for continuity):** ${previousSummary}` : ""}
- End with a smooth transition to the next section.

Return ONLY valid JSON:
{ "content": "full script text for these two sections..." }`;

  const system =
    "You are a YouTube scriptwriter with a direct, founder-led voice. You write scripts that feel honest and specific — not like content-marketing copy. Never use phrases like 'valuable content', 'unlock', 'supercharge', 'boost', 'be consistent', or 'game-changing'. Write COMPLETE script text at the EXACT word count requested. Never abbreviate. Never include production notes — only spoken words.";
  const raw = await callOpenAI(system, prompt, { maxTokens: 8192 });
  const data = parseSectionJson<{ content?: string }>(raw, `MainChunk ${params.chunkIndex + 1}`);
  return typeof data.content === "string" ? data.content.trim() : "";
}

/** 6. Recap + CTA (~500 words) */
async function generateRecapCta(params: {
  topic: string;
  niche: string;
  contentStyle: string;
  minutes: number;
  angle: (typeof ANGLES)[number];
  recapCtaWords: number;
  recapWords: number;
  ctaWords: number;
  mainSummary: string;
}): Promise<{ recap: string; cta: string }> {
  const {
    topic,
    niche,
    contentStyle,
    minutes,
    angle,
    recapCtaWords,
    recapWords,
    ctaWords,
    mainSummary,
  } = params;
  const styleBlock = getStyleBlock(contentStyle);

  const prompt = `Write ONLY the closing of a ${minutes}-minute YouTube script: recap and CTA.

**Topic:** ${topic}
**Niche:** ${niche}
**Angle:** ${angle.name} - ${angle.description}
**Content Style:** ${contentStyle}
${styleBlock}

**What the main content covered (summarize in recap):**
${mainSummary}

**Requirements:**
- RECAP: ${recapWords} words. Pull out 3–5 key things they just learned. Callback to the hook — close the loop on what you opened with. Make them feel like they got something real.
- CTA: ${ctaWords} words. Natural, soft, specific. Follow the structure below.

**YOUTUBE CTA STRUCTURE:**
1. One-sentence callback to the core insight from the video
2. Subscribe ask — specific reason: "If you want more videos about [the actual thing this channel covers], hit subscribe" — never "for more content"
3. Engagement: ask a specific question related to the video. "Drop a comment — [specific question]." Not "what's your biggest takeaway" every time.
4. Tease next video with a curiosity gap: "Next video I'm looking at [specific topic that connects to this one]"
5. Sign-off that sounds human — not corporate. "Thanks for watching, I'll see you in the next one." is fine.

**CTA TONE:**
- Sound like a person who made the video because they wanted to, not because they're optimising for the algorithm
- NEVER say: "smash that like button", "if you found this valuable", "don't forget to", "hit that notification bell" (use it once max, not as a routine)
- NEVER say: "link in bio", "check my profile", "follow me" (those are Instagram/TikTok)
- ALWAYS say "subscribe" not "follow"
- Keep it warm and real — not performed

**Example CTA tone (adapt, don't copy):** "So that's the actual reason most people never finish their first digital product — and it's not laziness, it's that nobody showed them what done looks like. If this clicked for you, subscribe — I'm making more videos on the specific parts people get stuck on. Drop a comment: what's the one thing that's been stopping you? I read all of them. Next video I'm going deep on [specific topic]. See you there."

- Total recap + CTA: ~${recapCtaWords} words.
- Write only spoken words. No production notes, no bracketed annotations.

Write every word. No placeholders.

Return ONLY valid JSON:
{ "recap": "full recap text...", "cta": "full cta text..." }`;

  const system =
    "You are a YouTube scriptwriter with a direct, founder-led voice. You write CTAs that feel natural — not like an algorithm optimiser said them. Your CTAs are soft, specific, and human: you don't say 'smash that like button', you say 'if this helped, the like button matters more than you think'. You understand YouTube-specific platform conventions: subscribe (not follow), like button, comment section, next video tease. You NEVER use Instagram/TikTok language: 'link in bio', 'follow me', 'swipe up', 'check my profile'. Write COMPLETE script text at the requested length. Never abbreviate.";
  const raw = await callOpenAI(system, prompt);
  const data = parseSectionJson<{ recap?: string; cta?: string }>(raw, "Recap+CTA");
  return {
    recap: typeof data.recap === "string" ? data.recap.trim() : "",
    cta: typeof data.cta === "string" ? data.cta.trim() : "",
  };
}

/** Derive 3-5 short-form clip ideas from the long-form script. */
function deriveClipIdeas(params: {
  topic: string;
  angle: string;
  hook: string;
  body: string;
}): Array<{ title: string; platform: string; why: string }> {
  const { topic, angle, hook } = params;
  // Generate clip ideas based on angle and topic — static logic for now, can be AI-powered later
  const clips: Array<{ title: string; platform: string; why: string }> = [
    {
      title: `The hook moment — first 60 seconds of the video`,
      platform: "TikTok / Reels / Shorts",
      why: "The hook stands alone as a complete thought. Strong opener, no context needed.",
    },
    {
      title: `The core insight from this ${angle} video on ${topic}`,
      platform: "YouTube Shorts",
      why: "Mid-video moment where you state the main observation — works as a standalone insight clip.",
    },
    {
      title: `The 'why it happens' explanation — 45–90 seconds`,
      platform: "TikTok / Reels",
      why: "The root-cause explanation tends to be the most shareable part — it makes people feel understood.",
    },
    {
      title: `One specific tip or step from the workflow section`,
      platform: "YouTube Shorts / Reels",
      why: "Actionable, self-contained, easy to watch without context. Great for save-worthy content.",
    },
    {
      title: `The CTA moment — reframed as a standalone video`,
      platform: "TikTok",
      why: "The call-to-action section often contains a strong summary statement that works as a separate hook.",
    },
  ];

  // Trim hook to use as first clip hook reference
  const hookPreview = hook.split(/[.!?]/)[0]?.trim() ?? topic;
  clips[0].title = `"${hookPreview.slice(0, 60)}${hookPreview.length > 60 ? "..." : ""}" — the opening hook as a standalone clip`;

  return clips;
}

/** Generate one full script in section-based API calls, then combine. */
async function generateSingleScriptInSections(params: {
  topic: string;
  niche: string;
  contentStyle: string;
  minutes: number;
  wordCount: number;
  angle: (typeof ANGLES)[number];
  hookIntroWords: number;
  mainChunkWords: number;
  numMainChunks: number;
  recapCtaWords: number;
  recapWords: number;
  ctaWords: number;
}): Promise<Record<string, unknown>> {
  const {
    topic,
    niche,
    contentStyle,
    minutes,
    wordCount,
    angle,
    hookIntroWords,
    mainChunkWords,
    numMainChunks,
    recapCtaWords,
    recapWords,
    ctaWords,
  } = params;

  // 1. Hook + Intro
  const totalSteps = 2 + numMainChunks;
  console.log(`  [1/${totalSteps}] Hook + Intro`);
  const { hook, intro } = await generateHookIntro({
    topic,
    niche,
    contentStyle,
    minutes,
    angle,
    hookIntroWords,
  });

  // Main chunks (sections 1-2, 3-4, ...)
  const mainParts: string[] = [];
  let previousSummary: string | undefined;
  for (let i = 0; i < numMainChunks; i++) {
    const sectionStart = i * 2 + 1;
    const sectionEnd = Math.min(sectionStart + 1, numMainChunks * 2);
    console.log(`  [${i + 2}/${totalSteps}] Main sections ${sectionStart}-${sectionEnd}`);
    const content = await generateMainChunk({
      topic,
      niche,
      contentStyle,
      minutes,
      angle,
      chunkIndex: i,
      totalChunks: numMainChunks,
      totalSections: numMainChunks * 2,
      chunkWords: mainChunkWords,
      previousSummary,
    });
    mainParts.push(content);
    // Short summary for next chunk continuity (keep under ~100 words)
    const words = content.split(/\s+/).filter(Boolean);
    previousSummary =
      words.length > 80 ? words.slice(0, 80).join(" ") + "…" : content;
  }
  const mainBody = mainParts.join("\n\n");

  // Brief summary of main for recap (first ~150 words of full main)
  const mainWords = mainBody.split(/\s+/).filter(Boolean);
  const mainSummary =
    mainWords.length > 150 ? mainWords.slice(0, 150).join(" ") + "…" : mainBody;

  // Recap + CTA
  console.log(`  [${totalSteps}/${totalSteps}] Recap + CTA`);
  const { recap, cta } = await generateRecapCta({
    topic,
    niche,
    contentStyle,
    minutes,
    angle,
    recapCtaWords,
    recapWords,
    ctaWords,
    mainSummary,
  });

  // Combine: body = intro + main + recap (CTA stays separate per existing API shape)
  const body = [intro, mainBody, recap].filter(Boolean).join("\n\n");

  const totalWords =
    hook.split(/\s+/).filter(Boolean).length +
    body.split(/\s+/).filter(Boolean).length +
    cta.split(/\s+/).filter(Boolean).length;

  console.log(`  ${angle.name} done: ${totalWords} words total`);

  // Derive 3-5 clip ideas from the hook and body
  const clipIdeas = deriveClipIdeas({ topic, angle: angle.name, hook, body });

  return {
    angle: angle.name,
    duration: `${minutes}min`,
    word_count: totalWords,
    estimated_watch_time: `${minutes}:00`,
    platforms: ["YouTube"],
    hook,
    body,
    cta,
    clip_ideas: clipIdeas,
    hook_strength: 5,
    engagement: "High",
    compliance: {
      tiktok: "N/A",
      instagram: "N/A",
      youtube: "Approved",
    },
  };
}
