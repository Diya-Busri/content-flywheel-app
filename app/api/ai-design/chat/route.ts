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

  const { message, productId, canvasWidth, canvasHeight, currentElements, history } = await req.json();
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

  // Summarise current canvas elements so AI can modify them
  const canvasContext = Array.isArray(currentElements) && currentElements.length > 0
    ? `\nCURRENT CANVAS ELEMENTS (you can see and modify these):\n${JSON.stringify(currentElements, null, 2)}`
    : "\nCURRENT CANVAS: empty";

  const systemPrompt = `You are an AI design assistant for a graphic design tool. The canvas is ${canvasWidth}×${canvasHeight}px.
${productContext ? `\n${productContext}\n` : ""}${canvasContext}

You have two modes:

1. MODIFY mode — when the user asks to change, move, resize, recolour, or adjust existing elements.
   Return the FULL updated elements array (all elements, with changes applied).
   Set "mode": "replace" so the canvas replaces all elements with your updated list.
   Preserve the "id" of elements you're modifying so they can be matched.

2. CREATE mode — when the user asks to add new elements or generate a fresh design.
   Return only the new elements. Set "mode": "add".

Always respond with valid JSON only (no markdown, no text outside JSON):
{
  "reply": "Brief description of what you did",
  "mode": "replace" | "add",
  "elements": [
    {
      "id": string (preserve existing id when modifying, or omit for new elements),
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
- "Move to middle" or "centre" means x = (${canvasWidth} - width) / 2, y = (${canvasHeight} - height) / 2
- "Centre horizontally" means x = (${canvasWidth} - width) / 2, keep y the same
- "Centre vertically" means y = (${canvasHeight} - height) / 2, keep x the same
- If background is set, it overrides the canvas background color (hex string)
- For pure chat (no design change needed): { "reply": "...", "mode": "add", "elements": [], "background": null }`;

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...(history ?? []),
    { role: "user", content: message },
  ];

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages,
    temperature: 0.7,
    max_tokens: 3000,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0].message.content ?? "{}";
  let parsed: { reply?: string; mode?: string; elements?: unknown[]; background?: string | null } = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { reply: raw, mode: "add", elements: [], background: null };
  }

  return NextResponse.json({
    reply: parsed.reply ?? "Done!",
    mode: parsed.mode ?? "add",
    elements: parsed.elements ?? [],
    background: parsed.background ?? null,
  });
}
