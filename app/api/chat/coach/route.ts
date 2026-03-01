import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and, isNull } from "drizzle-orm";

export const runtime = "nodejs";

const OPENAI_MODEL_DEFAULT = "gpt-4o-mini";
const OPENAI_MODEL_VISION = "gpt-4o";

const SYSTEM_PROMPT = `You are the user's best friend and business coach. You talk like a real person — casual, warm, direct, sometimes funny. No bullet points, no formal structure, no 'Great question!' type responses. Just talk naturally like you're on a phone call. Keep responses conversational and fairly short unless they really need detail. Use phrases like 'honestly', 'look', 'here's the thing', 'real talk' — sound human. You know they're building Content Flywheel, a SaaS for digital creators. Hype them up when they need it, be real with them when they need that too.`;

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
    const body = await req.json().catch(() => ({}));
    const { messages, pageContext, productId } = body as {
      messages?: IncomingMessage[];
      pageContext?: string;
      productId?: string;
    };

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

    const systemParts = [SYSTEM_PROMPT, pageNote, productContext].filter(Boolean);
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
