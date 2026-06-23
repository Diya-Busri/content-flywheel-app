import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Strip HTML tags and collapse whitespace to get readable text. */
function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract key meta info + body text from HTML. */
function extractPageInfo(html: string, url: string): { title: string; description: string; bodyText: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? stripHtml(titleMatch[1]) : "";

  const descMatch =
    html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i) ||
    html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
  const description = descMatch ? descMatch[1].trim() : "";

  // Grab visible body text (first ~2000 chars is enough context)
  const bodyMatch = html.match(/<body[\s\S]*?<\/body>/i);
  const bodyText = bodyMatch ? stripHtml(bodyMatch[0]).slice(0, 2000) : stripHtml(html).slice(0, 2000);

  return { title, description, bodyText };
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const apiRl = await checkApiRateLimit(userId);
    if (apiRl) return apiRl;
    const rl = checkAiRateLimit(userId ?? null);
    if (rl) return rl;

    const body = await req.json().catch(() => ({}));
    const { url } = body as { url?: string };
    if (!url?.trim()) return NextResponse.json({ error: "url is required" }, { status: 400 });

    // Normalise URL
    let normalised = url.trim();
    if (!/^https?:\/\//i.test(normalised)) normalised = `https://${normalised}`;

    // Fetch the page
    let html = "";
    try {
      const res = await fetch(normalised, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; ContentFlywheel/1.0)" },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      html = await res.text();
    } catch (e) {
      return NextResponse.json({ error: `Could not fetch that URL: ${e instanceof Error ? e.message : e}` }, { status: 422 });
    }

    const { title, description, bodyText } = extractPageInfo(html, normalised);

    const pageContext = [
      `URL: ${normalised}`,
      title ? `Page title: ${title}` : "",
      description ? `Meta description: ${description}` : "",
      bodyText ? `Page content (excerpt):\n${bodyText}` : "",
    ].filter(Boolean).join("\n\n");

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ error: "OpenAI not configured" }, { status: 503 });

    const openai = new OpenAI({ apiKey });

    const systemPrompt = `You are a viral content strategist who turns products and apps into high-performing social content.
You write content that sounds like a real human — direct, specific, no hype words like "game-changer", "revolutionary", "supercharge", "elevate", or "unlock".
You always write as if you personally use and love the product. Short punchy sentences. Honest tone.`;

    const userPrompt = `Based on this page, generate a content bundle to promote it. Be specific to what this product/app actually does — no generic filler.

${pageContext}

Return ONLY a valid JSON object with exactly this shape (no markdown, no code fences):
{
  "productName": "short name of the product",
  "oneLiner": "one sentence that nails what it does",
  "tiktok": {
    "hook": "first 3 seconds — one punchy line that stops the scroll",
    "script": "full 30-60 second TikTok/Reels script with natural pauses. Write it as spoken word, not bullet points. Include a soft CTA at the end."
  },
  "instagram": {
    "caption": "Instagram caption with line breaks for readability. Start with the hook. End with a CTA and 5 relevant hashtags."
  },
  "email": {
    "subject": "email subject line (under 50 chars, curiosity-driven)",
    "preview": "preview text (under 90 chars)",
    "body": "short email body — 3-4 paragraphs max. Conversational, not corporate. Clear CTA at the end."
  },
  "twitter": {
    "thread": ["tweet 1 (hook)", "tweet 2", "tweet 3 (CTA)"]
  }
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 1800,
      temperature: 0.8,
    });

    const raw = response.choices[0]?.message?.content ?? "";
    // Strip any accidental markdown fences
    const cleaned = raw.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: "AI returned invalid JSON. Try again." }, { status: 500 });
    }

    return NextResponse.json({ result: parsed });
  } catch (err) {
    console.error("[promote-url]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Something went wrong" }, { status: 500 });
  }
}
