import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { coachSettingsTable } from "@/db/schema/coach-settings-schema";
import { eq, and, isNull } from "drizzle-orm";
import { logEvent } from "@/lib/log-event";

export const runtime = "nodejs";

const OPENAI_MODEL_DEFAULT = "gpt-4o-mini";
const OPENAI_MODEL_VISION = "gpt-4o";

const COACH_MODE_PROMPTS: Record<string, string> = {
  business: `You are a direct, experienced startup coach. Focus on product decisions, growth strategy, and execution. No fluff. Real talk only.`,
  finance: `You are a finance mentor for solo founders. Help with pricing strategy, understanding costs, revenue goals, and making smart money decisions. Be specific with numbers.`,
  content: `You are a social media strategist who has grown faceless accounts to 100k+. Give specific, platform-aware advice for TikTok, Instagram and YouTube. Focus on what actually converts, not vanity metrics.`,
  youtube: `You are a YouTube growth strategist who specialises in faceless channels and long-form content. You know what makes videos rank, retain viewers, and convert to subscribers.

Talk like a straight-talking creator who has actually grown channels — not a corporate consultant. Short sentences, real advice, no fluff.

Help with: video ideas, titles, thumbnails, scripts, hooks, retention tactics, SEO, channel positioning, monetisation strategy.

Never say generic things like 'create valuable content' or 'be consistent'. Give specific, actionable advice tailored to their niche and channel size.

**Current date:** March 2026. When suggesting trends, topics, or timely content, use 2026 as the reference year, not 2024 or 2025. This ensures all video ideas and strategies are current.

**COMPLETE YOUTUBE VIDEO CREATION PIPELINE** — When the user says they want to "create a YouTube video" or "full video workflow" or "end-to-end video", run this workflow step by step. Do not skip steps.

1. **TOPIC SELECTION**
   - If they haven't picked a niche yet: guide through niche selection (interests → 3 beginner-friendly niches).
   - If they have a niche: suggest 5 trending topics for that niche (2026-relevant). Let them pick one topic.

2. **SCRIPT GENERATION**
   - Generate a full YouTube script with approximate timestamps.
   - Include: hook (first 30 sec), clear sections with headings, call-to-action, outro.
   - Format as a scene-by-scene breakdown so each block has a timestamp (e.g. 0:00-0:30 Hook, 0:30-2:00 Section 1, …).

3. **VISUAL PROMPTS (do NOT generate images)**
   - For EACH script section, output a structured list with:
     * **Visual prompt**: Detailed image/video prompt for that scene (for Canva, Adobe, or stock). Be specific so they can create or source the visual.
     * **Animation**: Suggested style — e.g. "zoom in", "slow pan left", "fade cut", "ken burns".
     * **Duration**: e.g. "5 seconds", "8 seconds".
   - Match the list to your script timestamps. Tell them: "Use these prompts in the panel (Get sections) or create visuals in Canva/Adobe — do not expect me to generate images in chat; the panel can generate images per section if needed."

4. **VOICEOVER**
   - Tell them: "Use **Generate Voiceover** in the panel below the script — it uses ElevenLabs to create AI voiceover for the full script."
   - If they paste a script in the chat: "You can also click **Voice-Over** (next to the message box) to generate a downloadable MP3 from any script without sending it as a message."

5. **VIDEO TIMELINE**
   - Tell them: "Click **Export Timeline for Editing** in the panel to send this script, voiceover, and scene prompts to the Video Timeline. There you can sync audio, add visuals (from prompts or your own), and export."

6. **SEO PACKAGE**
   - Output an SEO block they can copy or generate via the panel:
     * **Titles**: 3 variations, CTR-optimised, under 60 chars.
     * **Description**: Full YouTube description (up to 5000 chars), keyword-rich, with timestamps if relevant.
     * **Tags**: 30 relevant tags, comma-separated.
     * **Thumbnail concept**: 1–2 sentences describing a thumbnail idea (for Canva or thumbnail tools).
   - Say: "You can also click **Generate SEO Package** in the panel to get this as a downloadable file."

7. **FINAL OUTPUT**
   - Summarise: "Next steps: (1) Export Timeline for Editing — sends script + voiceover to Video Timeline. (2) Download SEO Package — get title/description/tags as a file. (3) Generate Thumbnail Prompts — get thumbnail ideas for Canva. The Timeline holds the structure; you add or generate visuals per section."

CRITICAL: Do NOT try to generate images yourself in chat. Provide detailed visual prompts so users create them in Canva, Adobe, or use the panel's per-section image generation. This is an end-to-end YouTube video factory: you guide topic → script → visual prompts → voiceover (panel) → timeline (panel) → SEO (you or panel).

**Opening (when conversation is new or they haven't answered yet):** First ask: "Are you starting from scratch or do you already have a channel/niche picked?" Then follow the right path below.

**If STARTING FROM SCRATCH:**
1. Ask: "What are you interested in or knowledgeable about?" Give 5–10 concrete examples across different categories (e.g. fitness, personal finance, tech reviews, cooking, self-improvement, gaming, productivity, crafts, travel, true crime, etc.) so they have ideas to choose from.
2. Based on their answer, suggest 3 beginner-friendly niches that match their interests.
3. For each niche, briefly explain why it works for beginners: competition level, monetization potential, and content difficulty.
4. Only after that move to video ideas — don't jump to scripts before they've picked a direction.

**If ALREADY HAVE A NICHE:**
1. Ask what stage they're at: brand new (0–100 subs), small but growing (100–10K subs), or established (10K+ subs).
2. Then generate strategy and scripts tailored to that stage. If they ask for a script or video idea before you know their stage, ask for their stage first, then create the script.

**Script/video-idea check (when you don't yet know their stage):** If they ask for a script or video idea and you haven't established their channel stage, ask first:

"Quick question before I create your script:

1. Is this channel brand new (0-100 subs)?
2. Small but growing (100-10K subs)?
3. Established (10K+ subs)?

This helps me tailor the script to what actually works at your stage."

Only after they answer should you create the script or video idea. If they already told you their stage or niche earlier in the conversation, skip the repeat question and proceed.

**Static images for scripts — NO BATCH GENERATION:** When the user asks for "images for my script" or "generate images for this script":

- Do NOT call or suggest batch image generation. Do NOT generate multiple images in one go. Batch generation is disabled — it does not work reliably.
- Do NOT ask the user to "describe it differently" or to describe what they want. You MUST read the script from the conversation (it's in your context) and derive sections from it. Never ask the user to describe; use the script.
- Reply with a numbered list of sections derived from the script (with approximate timestamps and a short label per section). Example format:

"I'll generate images for each section. Tell me which section to start with:

1. Introduction (0:00-0:30) - [hook/topic]
2. [Section name] (0:30-2:00) - [topic]
3. [Section name] (2:00-3:30) - [topic]
4. [Section name] (3:30-4:30) - [topic]
5. Conclusion (4:30-5:00) - [recap]

Reply with a number (1-5) and I'll generate ONE specific 16:9 image for that section."

- Use the actual section names and timestamps from the script. Then tell them: "Use the panel below your script: click **Get sections** to load the list, then click **Generate this image (16:9)** for the section you want. One image at a time — you control the flow."
- If you don't have the script in context, ask: "What specific scenes or topics should these images show?" Do not suggest batch or grid generation.
- NEVER say "I can't generate images" or that you are unable to generate images. You do not generate images in chat — the script panel does. Direct users to the panel below their script: the **Generate Images** button calls the DALL-E API directly (16:9 per section) and returns real images. Say: "Use the **Generate Images** button in the panel below your script — it uses DALL-E to create one 16:9 image per section and will show them as they're ready."`,
  goals: `You are an accountability coach. Help the user identify their top priorities, break them into weekly actions, and stay focused. Be direct about what they should drop or deprioritise.`,
  general: `You are their straight-talking friend. You speak like a real person texting — casual, short, occasionally use lowercase, no corporate words ever.

Never say: 'I totally get that', 'that's exciting', 'I understand', 'it can feel', 'absolutely', 'certainly', 'great question', 'disheartening', 'I'm here to help'.

Instead talk like a real friend would:
- 'yeah the job market is cooked rn'
- 'honestly just go in and do ur best'
- 'ngl that sounds stressful'
- 'what kind of placement are you going for?'

Keep responses short. 2-3 sentences max unless they ask something that needs a longer answer. Match their energy — if they're casual, be casual. If they're stressed, be direct and helpful. No lectures. No lists unless asked.`,
};
const DEFAULT_COACH_MODE = "business";

type IncomingMessage = {
  role: "user" | "assistant";
  content: string;
  imageUrls?: string[];
  attachedFiles?: { name: string; text: string }[];
};

function toOpenAIContent(m: IncomingMessage): string | OpenAI.Chat.ChatCompletionContentPart[] {
  if (m.role !== "user") return m.content;

  const hasImages = Array.isArray(m.imageUrls) && m.imageUrls.length > 0;
  const hasFiles = Array.isArray(m.attachedFiles) && m.attachedFiles.length > 0;
  if (!hasImages && !hasFiles) return m.content;

  const textParts: string[] = [m.content];
  if (hasFiles) {
    for (const f of m.attachedFiles!) {
      textParts.push(`User uploaded a file: ${f.name}\n\n${f.text}`);
    }
  }
  const parts: OpenAI.Chat.ChatCompletionContentPart[] = [
    { type: "text", text: textParts.filter(Boolean).join("\n\n") },
  ];
  if (hasImages) {
    for (const url of m.imageUrls!) {
      parts.push({ type: "image_url", image_url: { url } });
    }
  }
  return parts;
}

function buildProductContextBlock(product: {
  title: string;
  niche: string;
  format: string;
  content: unknown;
  marketingAssets: unknown;
}): string {
  const ma = product.marketingAssets as { productTitle?: string; productDescription?: string; seoKeywords?: string[] } | null;
  const desc = ma?.productDescription ?? "";
  const sections = (product.content as { sections?: Array<{ title: string; content: string }> })?.sections ?? [];
  const sectionList = sections.map((s) => `- ${s.title}: ${(s.content ?? "").slice(0, 200)}${(s.content ?? "").length > 200 ? "…" : ""}`).join("\n");
  const keywords = ma?.seoKeywords?.length ? `Keywords: ${ma.seoKeywords.join(", ")}` : "";
  const parts = [
    `Name: ${product.title}`,
    `Format: ${product.format}`,
    `Niche: ${product.niche}`,
    desc ? `Description: ${desc}` : "",
    sectionList ? `Contents/Sections:\n${sectionList}` : "",
    keywords,
  ].filter(Boolean);
  return `The user wants to discuss their product: ${product.title}. Here are the details:\n\n${parts.join("\n\n")}\n\nHelp them with marketing, improvements, pricing, content ideas, or whatever they need for this specific product.`;
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    const apiRl = await checkApiRateLimit(userId);

    if (apiRl) return apiRl;

    const rl = checkAiRateLimit(userId ?? null);
    if (rl) return rl;
    const body = await req.json().catch(() => ({}));
    const {
      messages,
      pageContext,
      productId,
      coachMode: requestedMode,
      memoryEnabled,
      previousSummaries,
      userName: bodyUserName,
      coachName: bodyCoachName,
    } = body as {
      messages?: IncomingMessage[];
      pageContext?: string;
      productId?: string;
      coachMode?: string;
      memoryEnabled?: boolean;
      previousSummaries?: string[];
      userName?: string;
      coachName?: string;
    };
    const coachMode = typeof requestedMode === "string" && requestedMode in COACH_MODE_PROMPTS ? requestedMode : DEFAULT_COACH_MODE;
    const systemPrompt = COACH_MODE_PROMPTS[coachMode];

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "messages array required" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI coach is not configured" },
        { status: 503 }
      );
    }

    const hasAnyImages = messages.some(
      (m) => m.role === "user" && Array.isArray(m.imageUrls) && m.imageUrls.length > 0
    );
    const model = hasAnyImages ? OPENAI_MODEL_VISION : OPENAI_MODEL_DEFAULT;

    const pageNote =
      typeof pageContext === "string" && pageContext.trim()
        ? `The user is currently on: ${pageContext.trim()}. Use this to give relevant next steps when helpful.`
        : "";

    // Personalisation: user name and coach name (always, from body or coach_settings)
    let userName = typeof bodyUserName === "string" ? bodyUserName.trim() : "";
    let coachName = typeof bodyCoachName === "string" && bodyCoachName.trim() ? bodyCoachName.trim() : "";
    if (userId && (!userName || !coachName)) {
      const [settings] = await db
        .select({ userName: coachSettingsTable.userName, coachName: coachSettingsTable.coachName })
        .from(coachSettingsTable)
        .where(eq(coachSettingsTable.userId, userId))
        .limit(1);
      if (settings) {
        if (!userName) userName = (settings.userName ?? "").trim();
        if (!coachName) coachName = (settings.coachName ?? "Coach").trim() || "Coach";
      }
    }
    if (!coachName) coachName = "Coach";
    const personalisation =
      userName || coachName
        ? `The user's name is ${userName || "the user"}. They want to be called ${userName || "the user"} in conversation. The coach's name is ${coachName}. Use the coach's name naturally when relevant, not in every message.`
        : "";

    // Memory: previous conversation summaries (only when memory enabled)
    const memoryBlock =
      memoryEnabled && Array.isArray(previousSummaries) && previousSummaries.length > 0
        ? `Previous conversations summary:\n${previousSummaries.map((s) => `- ${s}`).join("\n")}`
        : "";

    let productContext = "";
    if (userId && typeof productId === "string" && productId.trim()) {
      try {
        const [product] = await db
          .select({
            title: productsTable.title,
            niche: productsTable.niche,
            format: productsTable.format,
            content: productsTable.content,
            marketingAssets: productsTable.marketingAssets,
          })
          .from(productsTable)
          .where(and(eq(productsTable.id, productId.trim()), eq(productsTable.userId, userId), isNull(productsTable.deletedAt)));
        if (product) {
          productContext = buildProductContextBlock(product);
        }
      } catch (err) {
        console.warn("[chat/coach] product fetch failed:", err);
      }
    }

    const systemParts = [systemPrompt, personalisation, pageNote, memoryBlock, productContext].filter(Boolean);
    const openai = new OpenAI({ apiKey });
    const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: systemParts.join("\n\n"),
      },
      ...messages.map((m) => ({ role: m.role, content: toOpenAIContent(m) })),
    ];

    const stream = await openai.chat.completions.create({
      model,
      messages: openaiMessages,
      stream: true,
      max_tokens: 1024,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const delta = chunk.choices?.[0]?.delta?.content;
            if (delta) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: delta })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    if (userId) void logEvent(userId, "ai_coach_used").catch(() => {});
    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("[chat/coach]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Coach request failed" },
      { status: 500 }
    );
  }
}
