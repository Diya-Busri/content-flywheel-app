import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and, isNull } from "drizzle-orm";
import { getBrandVoice } from "@/lib/brand-voice";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Section = { id: string; title: string; content: string; order: number };

type AddSectionAction = { type: "add_section"; title: string; content: string };
type UpdateSectionAction = { type: "update_section"; sectionId: string; title?: string; content: string };
type ReplaceAllAction = { type: "replace_all"; sections: { title: string; content: string }[] };

type Action = AddSectionAction | UpdateSectionAction | ReplaceAllAction;

type AIWriteResponse = { actions: Action[]; message: string; generateImages?: boolean };

/**
 * POST /api/products/[id]/ai-write
 * Body: { instruction: string; currentSections: Section[] }
 * Returns: { actions: Action[]; message: string }
 *
 * The AI reads the instruction and current product structure, then returns
 * structured actions to add or update sections. The client applies these directly.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const apiRl = await checkApiRateLimit(userId);
    if (apiRl) return apiRl;
    const rl = checkAiRateLimit(userId);
    if (rl) return rl;

    const { id: productId } = await params;
    const [product] = await db
      .select()
      .from(productsTable)
      .where(and(eq(productsTable.id, productId), eq(productsTable.userId, userId), isNull(productsTable.deletedAt)));
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const instruction = typeof body.instruction === "string" ? body.instruction.trim() : "";
    const currentSections: Section[] = Array.isArray(body.currentSections) ? body.currentSections : [];

    if (!instruction) return NextResponse.json({ error: "instruction is required" }, { status: 400 });

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ error: "OpenAI not configured" }, { status: 503 });

    const brandVoice = await getBrandVoice(userId).catch(() => "");
    const title = (product.title ?? "Untitled").trim();
    const niche = (product.niche ?? "").trim();
    const format = (product.format ?? "ebook").trim();

    const sectionList = currentSections.length
      ? currentSections.map((s, i) => `  ${i + 1}. [id: ${s.id}] "${s.title}" — ${s.content ? `${s.content.replace(/<[^>]+>/g, "").slice(0, 100)}…` : "(empty)"}`).join("\n")
      : "  (no sections yet)";

    const isColoringBook = /colou?ring\s*book/i.test(instruction) || /colou?ring\s*book/i.test(title);

    const systemPrompt = [
      `You are an AI writing assistant for a digital product builder. You receive a user instruction and the current product structure, then return structured JSON describing what content to add or update.`,
      `PRODUCT: "${title}"${niche ? ` (niche: ${niche})` : ""} — format: ${format}`,
      brandVoice ? `BRAND VOICE: ${brandVoice}` : "",
      isColoringBook
        ? `RULES (COLOURING BOOK MODE):
- This is a COLOURING BOOK — pages have images to colour, NOT text paragraphs
- Each section should have a descriptive title only (e.g. "Happy Puppy", "Magic Unicorn", "Flower Garden")
- Set content to "" (empty string) — images will be generated automatically
- Create 5–10 pages unless the user specifies a number
- Never return explanations outside the JSON — only return valid JSON`
        : `RULES:
- Write content in rich HTML using <p>, <strong>, <em>, <ul>, <li>, <h3> tags only — no markdown asterisks or hashes
- Each section should be 100–300 words unless the user requests otherwise
- Be specific, practical, and actionable
- Never return explanations outside the JSON — only return valid JSON`,
    ].filter(Boolean).join("\n\n");

    const userPrompt = `CURRENT SECTIONS:\n${sectionList}\n\nUSER INSTRUCTION: ${instruction}\n\nReturn a JSON object with this exact shape:
{
  "actions": [
    { "type": "add_section", "title": "Section Title", "content": "${isColoringBook ? "" : "<p>HTML content here...</p>"}" },
    { "type": "update_section", "sectionId": "page-1", "title": "Optional new title", "content": "..." },
    { "type": "replace_all", "sections": [{ "title": "...", "content": "..." }] }
  ],
  "message": "A short friendly confirmation of what you did (1–2 sentences)",
  "generateImages": ${isColoringBook}
}

Use "replace_all" only when the user asks to restructure or plan the whole product. Use "add_section" for adding new pages. Use "update_section" to rewrite an existing page.`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.6,
        max_tokens: 4000,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[ai-write] OpenAI error:", res.status, errText);
      return NextResponse.json({ error: "AI request failed" }, { status: 502 });
    }

    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data.choices?.[0]?.message?.content ?? "{}";

    let parsed: AIWriteResponse;
    try {
      parsed = JSON.parse(raw) as AIWriteResponse;
    } catch {
      return NextResponse.json({ error: "AI returned invalid JSON" }, { status: 500 });
    }

    if (!Array.isArray(parsed.actions)) {
      return NextResponse.json({ error: "AI returned no actions" }, { status: 500 });
    }

    return NextResponse.json({
      actions: parsed.actions,
      message: parsed.message ?? "Done!",
      generateImages: parsed.generateImages ?? isColoringBook,
    });
  } catch (err) {
    console.error("[ai-write]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
