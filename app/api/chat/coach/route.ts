import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { coachSettingsTable } from "@/db/schema/coach-settings-schema";
import { eq, and, isNull } from "drizzle-orm";

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

Never say generic things like 'create valuable content' or 'be consistent'. Give specific, actionable advice tailored to their niche and channel size.`,
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
