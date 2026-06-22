import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and, isNull } from "drizzle-orm";

export const runtime = "nodejs";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { message, productId, canvasWidth, canvasHeight, history } = await req.json();
  if (!message?.trim()) return NextResponse.json({ error: "Message required" }, { status: 400 });

  // Fetch product context if provided
  let productContext = "";
  if (productId) {
    const [product] = await db
      .select({ title: productsTable.title, niche: productsTable.niche, format: productsTable.format, marketingAssets: productsTable.marketingAssets })
      .from(productsTable)
      .where(and(eq(productsTable.id, productId), eq(productsTable.userId, userId), isNull(productsTable.deletedAt)));
    if (product) {
      const ma = product.marketingAssets;
      productContext = `
PRODUCT CONTEXT:
- Title: ${product.title}
- Niche: ${product.niche}
- Format: ${product.format}
${ma?.productTitle ? `- Marketing title: ${ma.productTitle}` : ""}
${ma?.productDescription ? `- Description: ${ma.productDescription}` : ""}
${ma?.hashtags?.length ? `- Keywords: ${ma.hashtags.join(", ")}` : ""}
`.trim();
    }
  }

  const systemPrompt = `You are an AI design assistant for a graphic design tool. The canvas is ${canvasWidth}×${canvasHeight}px.
${productContext ? `\n${productContext}\n` : ""}
When the user asks you to create or generate a design (e.g. "make me a story post", "design a banner"), respond with a JSON object containing design elements to place on the canvas. Otherwise respond conversationally.

When generating design elements, respond ONLY with valid JSON in this exact shape (no markdown, no explanation outside the JSON):
{
  "reply": "Brief description of what you created",
  "elements": [
    {
      "type": "text" | "shape",
      "x": number,
      "y": number,
      "width": number,
      "height": number,
      "zIndex": number,
      // text fields (when type = "text"):
      "content": string,
      "fontSize": number,
      "fontFamily": string,
      "color": string,
      "fontWeight": "400" | "700" | "900",
      "textAlign": "left" | "center" | "right",
      "lineHeight": number,
      // shape fields (when type = "shape"):
      "shapeType": "rect" | "ellipse",
      "fill": string,
      "borderRadius": number
    }
  ],
  "background": string | null
}

Rules:
- Keep all elements within 0–${canvasWidth} x 0–${canvasHeight}
- Use contrasting colors that look good together
- For story (450×800) or portrait designs: stack elements vertically with generous padding
- For square (800×800) or landscape designs: center-aligned layouts work well
- Always include a headline text element and at least one supporting element
- If background is set, it overrides the canvas background color (hex string)
- If you're just answering a question (not generating), respond with: { "reply": "your answer", "elements": [], "background": null }`;

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...(history ?? []),
    { role: "user", content: message },
  ];

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages,
    temperature: 0.7,
    max_tokens: 2000,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0].message.content ?? "{}";
  let parsed: { reply?: string; elements?: unknown[]; background?: string | null } = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { reply: raw, elements: [], background: null };
  }

  return NextResponse.json({
    reply: parsed.reply ?? "Done!",
    elements: parsed.elements ?? [],
    background: parsed.background ?? null,
  });
}
