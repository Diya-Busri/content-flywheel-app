/**
 * POST /api/launch/[launchId]/behind-the-build
 * ─────────────────────────────────────────────────────────────
 * Generates an optional "Behind the Build" content pack after
 * the AI Execution pipeline completes.
 *
 * This is NOT advertising Content Flywheel. It helps creators tell
 * the authentic story of how they built their product. CF may be
 * mentioned naturally as the tool used, the same way a photographer
 * might mention Lightroom — because it was part of the process.
 *
 * Generates 5 pieces of creator content:
 *   📱 TikTok Script     — 45-60 second video script
 *   📸 Instagram Caption — 150-250 words with hashtags
 *   💼 LinkedIn Post     — professional/insight focused
 *   🐦 X Post            — punchy, under 280 chars
 *   📖 Behind-the-Scenes Story — blog/newsletter format
 *
 * Stream events (NDJSON):
 *   { type: "start" }
 *   { type: "item", id, label, emoji, content }   × 5
 *   { type: "done" }
 *   { type: "error", message }
 *
 * Content is saved to stageResults.behindTheBuild on the project.
 */

export const dynamic     = "force-dynamic";
export const maxDuration = 90;

import { NextRequest } from "next/server";
import { auth }        from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db }          from "@/db/db";
import { launchProjectsTable } from "@/db/schema/launch-schema";
import type { LaunchStageResults } from "@/db/schema/launch-schema";
import { eq, and }     from "drizzle-orm";
import OpenAI          from "openai";

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/* ─── Content piece definitions ──────────────────────────────────────────────── */

const PIECES = [
  { id: "tiktok",    label: "TikTok Script",           emoji: "🎬" },
  { id: "instagram", label: "Instagram Caption",        emoji: "📸" },
  { id: "linkedin",  label: "LinkedIn Post",            emoji: "💼" },
  { id: "x",         label: "X Post",                  emoji: "🐦" },
  { id: "story",     label: "Behind-the-Scenes Story",  emoji: "📖" },
] as const;

/* ─── Prompt builder ─────────────────────────────────────────────────────────── */

function buildPrompt(ctx: {
  goal:         string;
  productName:  string;
  insights:     string[];
  opportunities: Array<{ title: string; description: string }>;
  niche:        string;
}): string {
  const topInsights = ctx.insights.slice(0, 4).map(i => `• ${i}`).join("\n");
  const topOpps     = ctx.opportunities.slice(0, 2).map(o => `• ${o.title}: ${o.description}`).join("\n");

  return `You are writing authentic, first-person creator content for someone who just built and launched a digital product using an AI-powered platform called Content Flywheel.

THEIR PRODUCT: "${ctx.productName}"
THEIR GOAL: "${ctx.goal}"
NICHE / TOPIC: "${ctx.niche}"

WHAT RESEARCH UNCOVERED:
${topInsights || "• Market opportunity identified in this niche"}

PRODUCT OPPORTUNITIES FOUND:
${topOpps || "• Strong demand for structured educational content in this space"}

HOW THEY BUILT IT:
The creator used Content Flywheel — an AI platform — to go from idea to launch:
1. AI agents ran deep market research to validate the opportunity
2. The product content was fully generated and structured
3. Professional marketing visuals were created (cover, mockup, social graphics)
4. A complete launch campaign was built (social posts, email sequence, launch copy)
5. The store listing was assembled and validated for publishing

WRITING PRINCIPLES — READ CAREFULLY:
• Write from the CREATOR'S first-person perspective ("I", "my", "we")
• Be SPECIFIC — use the actual product name and topic throughout
• Make it feel AUTHENTIC, like something a real creator would genuinely post
• Content Flywheel can be mentioned naturally as the tool that helped — like a photographer mentioning Lightroom or a designer mentioning Figma — NOT as an advertisement
• The STORY is about the creator's journey, learnings, and the value of their product
• Never use marketing-speak, hype, or promotional language about CF
• Write as if you are the creator talking to their audience
• Use conversational, human tone — not corporate

TONE EXAMPLES (aim for this level of authenticity):
- "I built this budgeting planner using Content Flywheel. It handled the research and production while I focused on making sure the content was actually useful."
- "This started as an idea yesterday. Today it's live. Wild."
- "I learned more about [niche] from the research phase than I expected."

Generate exactly 5 pieces of content. Return ONLY a valid JSON object with these 5 keys:

{
  "tiktok": "A 45-60 second TikTok video script. Include these labelled sections:\\nHOOK: (first 3 seconds — must grab attention, specific to the product/niche)\\nSTORY: (the journey — what they built and how, mention CF naturally)\\nPAYOFF: (what they created and why it helps the audience)\\nCTA: (soft, non-pushy — check it out / link in bio)",

  "instagram": "An Instagram caption of 150-250 words. Use short paragraphs and line breaks for readability. Tell the story of building this product. Be personal. End with exactly 2-3 relevant hashtags on their own line.",

  "linkedin": "A LinkedIn post of 200-300 words. Professional but personal tone. Focus on what they discovered, what they learned, and a key insight their professional network would find genuinely valuable. This is not a product ad — it's a thought piece about their process.",

  "x": "A single X (Twitter) post of strictly under 280 characters. Punchy, interesting, specific. Something their followers would want to retweet. Could be a hot take, a surprising stat from their research, or a one-liner about the build.",

  "story": "A behind-the-scenes story of 250-350 words in blog post / newsletter format. This is the most personal and detailed piece. It should tell the full arc: the idea, the decision to build it, what the process looked like, what surprised them, and what they learned. This is the piece a journalist or a curious subscriber would want to read."
}

Return ONLY the JSON object. No preamble, no explanation, no markdown code fences.`;
}

/* ─── Streaming handler ──────────────────────────────────────────────────────── */

function streamBehindTheBuild(
  userId:  string,
  project: {
    id:           string;
    goal:         string;
    stageResults: LaunchStageResults | null;
  },
): Response {
  const encoder  = new TextEncoder();
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  const send = async (data: Record<string, unknown>): Promise<void> => {
    try {
      await writer.write(encoder.encode(JSON.stringify(data) + "\n"));
    } catch { /* writer closed */ }
  };

  void (async () => {
    const results    = project.stageResults ?? {};
    const product    = results.product;
    const research   = results.research;
    const productName = product?.productName ?? project.goal;
    const niche      = research?.query ?? project.goal;
    const insights   = research?.insights ?? [];
    const opps       = research?.productOpportunities ?? [];

    /* Declared here so the catch block can reference it for error reporting */
    const generatedItems: Array<{ id: string; label: string; emoji: string; content: string }> = [];

    try {
      console.log("[behind-the-build] Starting generation", {
        projectId:   project.id,
        goal:        project.goal.slice(0, 80),
        productName: productName.slice(0, 80),
        hasResearch: !!research,
        insightCount: insights.length,
      });

      await send({ type: "start" });

      /* ── Call GPT-4o-mini ── */
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const completion = await openai.chat.completions.create({
        model:       "gpt-4o-mini",
        max_tokens:  3000,
        temperature: 0.85,  // Higher temperature = more natural, varied output
        messages: [
          {
            role:    "system",
            content: "You are a skilled content strategist and copywriter who specialises in authentic creator storytelling. You write in natural, human voices — never promotional or corporate. You always return valid JSON only.",
          },
          {
            role:    "user",
            content: buildPrompt({ goal: project.goal, productName, insights, opportunities: opps, niche }),
          },
        ],
      });

      const raw = completion.choices[0]?.message?.content ?? "";

      /* ── Parse JSON ── */
      let parsed: Record<string, string>;
      try {
        // Strip any accidental markdown fences
        const cleaned = raw.replace(/^```[a-z]*\n?/gm, "").replace(/^```$/gm, "").trim();
        parsed = JSON.parse(cleaned) as Record<string, string>;
      } catch {
        throw new Error("Content generation returned invalid JSON — please try again");
      }

      /* ── Stream each piece with a staggered delay ── */

      for (const piece of PIECES) {
        const content = parsed[piece.id];
        if (!content || typeof content !== "string") continue;

        const item = {
          id:      piece.id,
          label:   piece.label,
          emoji:   piece.emoji,
          content: content.trim(),
        };

        generatedItems.push(item);
        await send({ type: "item", ...item });
        await sleep(350); // stagger for visual streaming effect
      }

      if (generatedItems.length === 0) {
        throw new Error("No content pieces were generated — please try again");
      }

      /* ── Save to DB ── */
      console.log("[behind-the-build] Saving to DB…", { projectId: project.id, itemCount: generatedItems.length });

      const existing = results as LaunchStageResults;
      const merged: LaunchStageResults = {
        ...existing,
        behindTheBuild: {
          items:       generatedItems,
          generatedAt: new Date().toISOString(),
        },
      };

      const saved = await db
        .update(launchProjectsTable)
        .set({ stageResults: merged, updatedAt: new Date() })
        .where(and(
          eq(launchProjectsTable.id, project.id),
          eq(launchProjectsTable.userId, userId),
        ))
        .returning({ id: launchProjectsTable.id });

      if (!saved.length) {
        throw new Error("Database save failed — project not found or permission denied");
      }

      console.log("[behind-the-build] Saved successfully", { projectId: saved[0]?.id });

      await send({ type: "done", count: generatedItems.length, projectId: project.id });

    } catch (err) {
      const message = err instanceof Error ? err.message : "Generation failed";
      console.error("[behind-the-build] ERROR:", { projectId: project.id, message });
      await send({
        type:    "error",
        message,
        reason:  message,
        // Tell the client whether content was generated (may be in memory even if save failed)
        contentGenerated: generatedItems.length > 0,
        itemCount:        generatedItems.length,
      }).catch(() => {});
    } finally {
      await writer.close().catch(() => {});
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type":      "application/x-ndjson; charset=utf-8",
      "Cache-Control":     "no-cache, no-store, must-revalidate",
      "X-Accel-Buffering": "no",
    },
  });
}

/* ─── POST handler ───────────────────────────────────────────────────────────── */

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ launchId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

    const rl = await checkApiRateLimit(userId);
    if (rl) return rl;

    const { launchId } = await params;

    const [project] = await db
      .select()
      .from(launchProjectsTable)
      .where(and(eq(launchProjectsTable.id, launchId), eq(launchProjectsTable.userId, userId)))
      .limit(1);

    if (!project) return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });

    return streamBehindTheBuild(userId, {
      id:           project.id,
      goal:         project.goal,
      stageResults: project.stageResults,
    });

  } catch (err) {
    console.error("[behind-the-build]", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
}
