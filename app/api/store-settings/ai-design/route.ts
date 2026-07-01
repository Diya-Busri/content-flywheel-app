import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { db } from "@/db/db";
import { brandVoiceTable } from "@/db/schema/brand-voice-schema";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and, isNull, count } from "drizzle-orm";
import { checkApiRateLimit } from "@/lib/rate-limit-api";

export const dynamic = "force-dynamic";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const VALID_THEMES = ["warm", "dark", "light", "minimal", "bold"] as const;
const VALID_FONTS = ["inter", "poppins", "playfair", "montserrat", "dm-sans"] as const;
const VALID_GRADIENTS = [
  "135deg, #f97316 0%, #ea580c 100%",
  "135deg, #7c3aed 0%, #4f46e5 100%",
  "135deg, #0d9488 0%, #0891b2 100%",
  "135deg, #db2777 0%, #9333ea 100%",
  "135deg, #0B0B0F 0%, #1f2937 100%",
  "135deg, #f59e0b 0%, #ef4444 100%",
];

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkApiRateLimit(userId);
    if (rl) return rl;

    const body = await req.json().catch(() => ({}));
    const customPrompt = (body.prompt as string | undefined)?.slice(0, 300) ?? "";

    // Load brand context
    const [[brandVoice], [productCountRow]] = await Promise.all([
      db.select({ brandName: brandVoiceTable.brandName, targetAudience: brandVoiceTable.targetAudience, tone: brandVoiceTable.tone, writingStyle: brandVoiceTable.writingStyle })
        .from(brandVoiceTable).where(eq(brandVoiceTable.userId, userId)).limit(1),
      db.select({ count: count() }).from(productsTable)
        .where(and(eq(productsTable.userId, userId), isNull(productsTable.deletedAt))),
    ]);

    const productCount = Number(productCountRow?.count ?? 0);
    const brandName = brandVoice?.brandName ?? "My Store";
    const niche = brandVoice?.targetAudience ?? brandVoice?.writingStyle ?? "";
    const tone = brandVoice?.tone ?? "";

    const context = customPrompt
      ? `The creator has given this prompt: "${customPrompt}"`
      : `Brand name: "${brandName}". Niche: "${niche}". Tone: "${tone}". Product count: ${productCount}.`;

    const systemPrompt = `You are a store design expert. Given creator context, return a JSON object with exactly these fields (no extra text, just raw JSON):
{
  "theme": one of ${JSON.stringify(VALID_THEMES)},
  "accentColor": a hex color (e.g. "#f97316"),
  "tagline": short punchy tagline under 60 chars,
  "bio": 1-2 sentence about section under 150 chars,
  "announcementText": optional promotional announcement under 80 chars (or null),
  "buttonText": subscribe CTA under 30 chars,
  "fontFamily": one of ${JSON.stringify(VALID_FONTS)},
  "bannerGradient": one of ${JSON.stringify(VALID_GRADIENTS)},
  "reasoning": 1 sentence explaining your choices
}

Design rules:
- wellness/health/fitness → warm or minimal theme, greens/oranges, playfair or poppins
- tech/coding/SaaS → dark or bold theme, blue/purple accent, inter or dm-sans
- fashion/lifestyle/beauty → bold or light theme, pink/purple accent, montserrat or poppins
- finance/business/marketing → minimal or light theme, dark accent, inter or dm-sans
- art/creative/photography → warm or bold theme, vibrant accent, playfair or poppins
- food/cooking → warm theme, orange/red accent, poppins
- education/courses → light or minimal, blue/teal, inter
- Unknown/general → warm theme, orange, inter`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: context },
      ],
      temperature: 0.7,
      max_tokens: 400,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let design: Record<string, unknown>;
    try { design = JSON.parse(raw); } catch { design = {}; }

    // Sanitise
    const theme = VALID_THEMES.includes(design.theme as typeof VALID_THEMES[number])
      ? design.theme as string : "warm";
    const fontFamily = VALID_FONTS.includes(design.fontFamily as typeof VALID_FONTS[number])
      ? design.fontFamily as string : "inter";
    const bannerGradient = VALID_GRADIENTS.includes(design.bannerGradient as string)
      ? design.bannerGradient as string : VALID_GRADIENTS[0];
    const accentColor = typeof design.accentColor === "string" && /^#[0-9a-fA-F]{6}$/.test(design.accentColor)
      ? design.accentColor : "#f97316";

    return NextResponse.json({
      theme,
      accentColor,
      tagline: typeof design.tagline === "string" ? design.tagline.slice(0, 60) : null,
      bio: typeof design.bio === "string" ? design.bio.slice(0, 150) : null,
      announcementText: typeof design.announcementText === "string" && design.announcementText
        ? design.announcementText.slice(0, 80) : null,
      buttonText: typeof design.buttonText === "string" ? design.buttonText.slice(0, 30) : "Subscribe for updates",
      fontFamily,
      bannerGradient,
      reasoning: typeof design.reasoning === "string" ? design.reasoning : null,
    });
  } catch (err) {
    console.error("[ai-design]", err);
    return NextResponse.json({ error: "Failed to generate design" }, { status: 500 });
  }
}
