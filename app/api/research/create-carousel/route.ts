import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { contentBundlesTable } from "@/db/schema/bundles-schema";
import { designsTable } from "@/db/schema/designs-schema";
import { buildSlideDesign, TemplateStyle } from "@/app/dashboard/design-studio/bulk/layoutEngine";

export const dynamic = "force-dynamic";

// ── Constants ──────────────────────────────────────────────────────────────────

const CTA_POOL = [
  "Swipe to see more →",
  "Save this one ↓",
  "Keep reading →",
  "This matters. Swipe →",
  "Don't scroll past this →",
  "Tap to save ↓",
];

const BG_THEMES = ["dark", "gradient-warm", "gradient-cool", "light", "cream", "sage", "navy"];

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeHook(text: string): string {
  const first = text.split(/[.!?]/)[0]?.trim() ?? text;
  return first.split(/\s+/).slice(0, 10).join(" ").toUpperCase();
}

function makeMainText(text: string): string {
  return text.length > 130 ? text.slice(0, 130).trimEnd() + "…" : text;
}

type SlideContent = { hook: string; mainText: string; cta: string; bgTheme: string };

// ── POST ───────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({})) as {
      insights?: string[];
      query?: string;
      style?: string;
    };

    const insights: string[] = Array.isArray(body.insights) ? body.insights.filter(Boolean) : [];
    const query = typeof body.query === "string" ? body.query.trim() : "Research";
    const style = (typeof body.style === "string" ? body.style : "modern-business") as TemplateStyle;

    if (insights.length === 0) {
      return NextResponse.json({ error: "No insights provided" }, { status: 400 });
    }

    // ── Step 1: Generate slide content via AI ──────────────────────────────
    let slides: SlideContent[] = [];

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (apiKey) {
      try {
        const prompt = `You are a viral carousel content strategist. Convert these research insights about "${query}" into compelling carousel slides for social media.

Insights:
${insights.slice(0, 8).map((ins, i) => `${i + 1}. ${ins}`).join("\n")}

Return a JSON object with a "slides" array (one element per insight). Each element must have:
- hook: UPPERCASE scroll-stopping headline (5-10 words, specific stat or surprising truth, NO generic phrases)
- mainText: The insight rewritten as value for a creator audience (25-50 words, 2-3 short sentences, conversational)
- cta: Slide nudge (3-7 words, e.g. "Swipe to see →" or "Save this one ↓")
- bgTheme: One of: "dark", "light", "cream", "sage", "navy", "gradient-warm", "gradient-cool"

Rules:
- Every hook must feel like a revelation or surprising number/fact
- mainText must be clear, actionable, creator-friendly prose
- Vary bgTheme for visual interest across slides
- Keep narrative flow: hook → problem → insight → solution`;

        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
            temperature: 0.7,
            max_tokens: 1500,
          }),
        });

        if (res.ok) {
          const json = await res.json() as { choices?: { message?: { content?: string } }[] };
          const raw = json.choices?.[0]?.message?.content ?? "{}";
          const parsed = JSON.parse(raw) as { slides?: SlideContent[] };
          if (Array.isArray(parsed.slides) && parsed.slides.length > 0) {
            slides = parsed.slides;
          }
        }
      } catch (aiErr) {
        console.warn("[create-carousel] AI generation failed, using direct conversion:", aiErr);
      }
    }

    // Fallback: convert insights directly without AI
    if (slides.length === 0) {
      slides = insights.map((insight, i) => ({
        hook: makeHook(insight),
        mainText: makeMainText(insight),
        cta: CTA_POOL[i % CTA_POOL.length],
        bgTheme: BG_THEMES[i % BG_THEMES.length],
      }));
    }

    // Append a CTA slide
    slides.push({
      hook: "READY TO BUILD YOUR BUSINESS?",
      mainText: `These insights on ${query} are just the beginning. Your content flywheel is waiting — turn research into revenue.`,
      cta: "Start creating today →",
      bgTheme: "gradient-warm",
    });

    // ── Step 2: Build DesignData via layout engine ─────────────────────────
    const usedLayoutIds: string[] = [];
    const slideInputs = slides.map((slide, i) => {
      const contentRow = {
        id: `slide-${i}`,
        hook: slide.hook,
        mainText: slide.mainText,
        cta: slide.cta,
        bgTheme: slide.bgTheme,
      };
      const { data, layoutId } = buildSlideDesign(
        contentRow,
        style,
        i,
        slides.length,
        usedLayoutIds,
        1350,
      );
      usedLayoutIds.push(layoutId);
      return {
        title: i === slides.length - 1
          ? "CTA Slide"
          : `Slide ${i + 1}: ${slide.hook.slice(0, 32)}`,
        data,
      };
    });

    // ── Step 3: Persist bundle + slides ───────────────────────────────────
    const [bundle] = await db
      .insert(contentBundlesTable)
      .values({
        userId,
        title: `${query} — Research Carousel`,
        style,
        slideCount: slideInputs.length,
      })
      .returning();

    await db.insert(designsTable).values(
      slideInputs.map((slide, i) => ({
        userId,
        title: slide.title,
        data: slide.data,
        bundleId: bundle.id,
        slideIndex: i,
      }))
    );

    return NextResponse.json({ bundleId: bundle.id, slideCount: slideInputs.length }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/research/create-carousel]", err);
    const msg = err instanceof Error ? err.message : "Failed to create carousel";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
