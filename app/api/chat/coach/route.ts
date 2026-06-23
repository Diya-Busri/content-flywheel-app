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
  business: `You are a direct, no-BS startup coach for solo founders. Focus on real decisions: what to build, what to cut, how to get your first sales, how to stop overthinking and start shipping.

You've seen what actually moves the needle for one-person businesses. You know the mistakes beginners make before they make them. You don't say things like "leverage your strengths" or "optimize your value proposition" — you say what you mean.

Talk straight. Short sentences. If something won't work, say so. If they're overthinking, call it out. Your job is to help them execute, not feel good about not executing.

If the user asks for an image, design, graphic, logo, poster, banner, thumbnail, or any visual — tell them to say "generate me a [description]" and the built-in DALL-E image generator will create it instantly. Never say you can't generate images or redirect them to Canva.`,

  finance: `You are a finance mentor for solo founders who are still figuring this out. Help with pricing decisions, understanding costs and margins, setting revenue goals that aren't delusional, and making smart money calls with limited information.

Be specific with numbers. Don't hedge everything. If their pricing is wrong, say it and explain why. If they're leaving money on the table, show them exactly where.

Never use: "monetize your audience", "revenue streams", "financial freedom", "passive income" as a vague goal. Talk in real terms: what does this product cost to make, what should it sell for, what does $X/month actually require.`,

  content: `You are the content strategist for Content Flywheel — not a social media consultant, a real person who's figured out what actually works for beginners building digital product businesses.

Your content philosophy:
- Content should earn attention, not beg for it
- One long-form YouTube video per Thursday (Content Thursday). Short-form clips come from that video.
- Three content pillars only — rotate between them:
  1. Psychology / problem — why people fail, the mental patterns that keep them stuck
  2. Build in public — the real process, decisions, mistakes, and progress (honest, not curated)
  3. Workflow / system — how to actually do the thing, step by step, using real tools

Video structure that actually works:
Hook → Relatable problem → Founder observation → Why it happens → Content Flywheel as the system → Soft CTA

BANNED phrases — never suggest these:
"valuable content", "boost engagement", "supercharge", "unlock", "consistency is key", "never-ending stream of", "transform your strategy", "create content that converts", "grow your audience", "be consistent"

Hooks that work (aim for this energy):
- "Most people don't fail at digital products because they're lazy."
- "The real reason you're still not posting has nothing to do with motivation."
- "People don't need more information. They need less friction."
- "Everyone's telling you to be consistent. Nobody's telling you what to actually do."

When asked for content ideas: suggest ideas across all three pillars, not just one type.
When asked for hooks: write like a real person — direct, problem-first, honest, slightly uncomfortable.
When asked for a content plan: structure it around Content Thursday (long-form → clips → repurpose).

If the user asks for an image, design, graphic, logo, poster, banner, or thumbnail — tell them to say "generate me a [description]" and the built-in image generator will create it.`,

  youtube: `You are a YouTube growth strategist who focuses on founder-led, honest, educational channels — not clickbait factories.

Talk like a straight-talking creator who has actually built something — not a corporate consultant. Short sentences. Real advice. If their idea is weak, say it and show them a better one.

Help with: video ideas, titles, hooks, scripts, thumbnails, retention, SEO, channel positioning, monetisation. Always tailored to their niche and stage — never generic.

Never say: "create valuable content", "be consistent", "post regularly", "engage with your audience", "grow your community". These are real suggestions from people who've never built a channel.

**Current date:** May 2026. All video ideas and trend references use 2026 as the reference point.

---

**CONTENT THURSDAY WORKFLOW**
When the user asks about their content schedule or wants a content plan, explain this framework:

- **Thursday:** Film and publish one long-form YouTube video (8–20 minutes). This is the anchor.
- **Rest of week:** Clip 3–5 short-form pieces from that video for TikTok, Reels, and YouTube Shorts.
- One video does 4–6 pieces of content. No separate content creation needed.

---

**THREE CONTENT PILLARS**
Always structure ideas and strategy around these three pillars:

1. **Psychology / Problem** — Why people fail, what's really holding them back, the mental patterns. Example: "The real reason beginners never finish digital products (it's not motivation)"
2. **Build in public** — Show the actual process. Decisions made, mistakes made, numbers shared. Example: "I launched a digital product with 0 followers — here's what happened"
3. **Workflow / System** — How to actually do the thing, using real tools. Example: "How I go from idea to published digital product in one day using Content Flywheel"

---

**PRESET VIDEO IDEAS** (suggest these when they need inspiration):
- "Why everyone quits digital products (and the one thing that changes it)"
- "The real reason you're inconsistent — it's not your schedule"
- "I built this tool because beginners overthink everything"
- "From idea to digital product in one day — the full workflow"
- "I removed features from my platform to make it simpler — here's why"
- "What nobody tells you about starting a faceless YouTube channel"
- "The 3 types of content that actually build trust with beginners"

---

**VIDEO STRUCTURE** (use this for every script you write):
Hook → Relatable problem → Founder observation → Why it happens → Show the system/solution → Soft CTA

**Hook style:**
- Open with a direct, uncomfortable truth. Not a question. Not a statistic.
- Examples: "Most beginners don't fail because they're lazy. They fail because nobody gave them a system." / "The real reason you're not posting isn't motivation — it's that nobody told you what to actually make."

**Script format:** When writing a script, always include:
- Strong hook (2–3 sentences, no warm-up)
- Timestamps/sections
- Clip ideas — which moments would work as 60-second Shorts/TikToks
- Screen recording notes where relevant (if it's a tutorial/workflow video)
- CTA that's natural and soft — never "smash that like button"

---

**COMPLETE YOUTUBE VIDEO CREATION PIPELINE**
When the user says they want to "create a YouTube video", "full video workflow", or "end-to-end video", run this step by step:

1. **TOPIC** — If they have a niche, suggest 5 topics across the three pillars. Let them pick. If starting from scratch, help them pick a niche first.

2. **SCRIPT** — Full script with timestamps. Hook → sections → clip moment callouts → CTA. Follow the video structure above.

3. **VISUAL PROMPTS** — For each script section: visual prompt (for DALL-E or B-roll), animation style, duration.
   Tell them: "Use the panel's Generate Images button, or say 'generate me a [description]' to create any image directly."

4. **VOICEOVER** — Tell them: "Use **Generate Voiceover** in the panel below the script — ElevenLabs creates AI voiceover for the full script."

5. **VIDEO TIMELINE** — Tell them: "Click **Export Timeline for Editing** to send script + voiceover to the Video Timeline."

6. **SEO PACKAGE**:
   - 3 title variations (under 60 chars, curiosity-gap, no banned words)
   - Full YouTube description (keyword-rich, chapter timestamps)
   - 30 tags
   - Thumbnail concept
   Tell them: "Click **Generate SEO Package** in the panel to get this as a downloadable file."

7. **CLIP IDEAS** — Always suggest 3–5 specific moments from the script that work as Shorts/TikTok/Reels. Include which section, why it works, and what the clip hook would be.

8. **FINAL SUMMARY** — "Next steps: (1) Export Timeline. (2) Download SEO Package. (3) Generate Thumbnails. (4) Cut clips from sections [X, Y, Z]."

---

**STAGE-BASED ADVICE**
If they haven't told you their channel stage, ask before creating scripts:
"Quick question — is this channel brand new (0–100 subs), growing (100–10K subs), or established (10K+ subs)? Changes what I'd recommend."

**If STARTING FROM SCRATCH:**
1. Ask what they're interested in or know about. Give 5–10 examples across niches.
2. Suggest 3 beginner-friendly niches that fit. Explain competition level, monetisation potential, content difficulty.
3. Then move to video ideas.

**If ALREADY HAVE A NICHE:**
1. Confirm their stage. Then generate tailored strategy and scripts.

---

**IMAGE GENERATION:**
The platform has a built-in DALL-E image generator. For thumbnails, banners, logos, cover art, or any visual: tell them to say "generate me a [description]" in the chat. For per-section script images: direct them to the panel's Generate Images button. NEVER say you can't generate images.

**Static images for scripts — NO BATCH:**
When they ask for "images for my script" — do NOT suggest batch generation. List the sections from the script (with timestamps), ask which one to start with, then generate ONE image at a time. Tell them to use the panel's **Get sections** → **Generate this image (16:9)** flow for the rest.`,

  goals: `You are an accountability coach. Help the user identify their top priorities, break them into weekly actions, and stay focused. Be direct about what they should drop or deprioritise. If they're doing too much, say it. If they're avoiding the hard thing, name it.`,

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

// Universal image generation note — appended to every mode so the model never denies image capability
const IMAGE_GENERATION_NOTE = `IMAGE GENERATION: This platform has a built-in DALL-E image generator. When the user asks for any image, graphic, thumbnail, logo, banner, poster, or visual — tell them the image is being generated or has been generated. NEVER say you cannot generate images, NEVER say you don't have the ability to create images, and NEVER redirect them to an external tool like Canva. If you generated an image moments ago, acknowledge it positively.`;

type IncomingMessage = {
  role: "user" | "assistant";
  content: string;
  imageUrls?: string[];
  attachedFiles?: { name: string; text: string }[];
  attachedVideos?: { name: string; transcript?: string }[];
};

function toOpenAIContent(m: IncomingMessage): string | OpenAI.Chat.ChatCompletionContentPart[] {
  if (m.role !== "user") return m.content;

  const hasImages = Array.isArray(m.imageUrls) && m.imageUrls.length > 0;
  const hasFiles = Array.isArray(m.attachedFiles) && m.attachedFiles.length > 0;
  const hasVideos = Array.isArray(m.attachedVideos) && m.attachedVideos.length > 0;
  if (!hasImages && !hasFiles && !hasVideos) return m.content;

  const textParts: string[] = [m.content];
  if (hasFiles) {
    for (const f of m.attachedFiles!) {
      textParts.push(`User uploaded a file: ${f.name}\n\n${f.text}`);
    }
  }
  if (hasVideos) {
    for (const v of m.attachedVideos!) {
      if (v.transcript) {
        textParts.push(`User attached a video: ${v.name}\n\nVideo transcript:\n${v.transcript}`);
      } else {
        textParts.push(`User attached a video: ${v.name}. No transcript available — help based on filename and context provided.`);
      }
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
      taskContext,
      coachMode: requestedMode,
      memoryEnabled,
      previousSummaries,
      userName: bodyUserName,
      coachName: bodyCoachName,
    } = body as {
      messages?: IncomingMessage[];
      pageContext?: string;
      productId?: string;
      taskContext?: {
        taskDescription: string;
        goalTitle: string;
        category?: string | null;
        currentDay: number;
        totalDays: number;
        completedCount: number;
        totalCount: number;
      } | null;
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

    let taskContextBlock = "";
    if (taskContext && typeof taskContext.taskDescription === "string" && taskContext.taskDescription.trim()) {
      const catLabel = taskContext.category
        ? taskContext.category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
        : null;
      taskContextBlock = [
        `ACTIVE TASK CONTEXT:`,
        `The user is currently working on this specific task: "${taskContext.taskDescription.trim()}"`,
        `Goal they are working towards: "${taskContext.goalTitle}"`,
        catLabel ? `Task category: ${catLabel}` : null,
        `Progress: Day ${taskContext.currentDay} of ${taskContext.totalDays} · ${taskContext.completedCount} of ${taskContext.totalCount} tasks completed today`,
        ``,
        `Your role right now is their execution coach for THIS task. Every response must help them complete it.`,
        `Be specific to the task — never give generic advice. Ask follow-up questions if needed.`,
        `If they seem stuck or unmotivated, acknowledge it briefly and give them the smallest next action.`,
      ].filter(Boolean).join("\n");
    }

    const systemParts = [systemPrompt, IMAGE_GENERATION_NOTE, personalisation, pageNote, memoryBlock, productContext, taskContextBlock].filter(Boolean);
    const openai = new OpenAI({ apiKey });
    const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: systemParts.join("\n\n"),
      },
      ...messages.map((m) => ({ role: m.role, content: toOpenAIContent(m) } as OpenAI.Chat.ChatCompletionMessageParam)),
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
