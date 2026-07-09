/**
 * POST /api/launch/brain
 * ──────────────────────────────────────────────────────────────────────────────
 * Business Brain — founder-quality review of every AI-generated asset.
 *
 * Flow:
 *  1. Load project + stageResults from DB
 *  2. Build a structured critique prompt from all available data
 *  3. Call GPT-4o-mini to produce a BrainResult JSON
 *  4. Save result to stageResults.brain in DB
 *  5. Return { brain: BrainResult }
 *
 * Non-streaming: the whole review takes ~10-15s and produces one JSON object.
 * The client shows animated loading messages while it runs.
 *
 * Uses OpenAI (same key as all other launch agents) — NOT Anthropic — so no
 * additional environment variable is required.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { launchProjectsTable } from "@/db/schema/launch-schema";
import type { LaunchStageResults, BrainResult } from "@/db/schema/launch-schema";
import { eq, and } from "drizzle-orm";
import OpenAI from "openai";

// 60s is ample for a single GPT-4o-mini JSON call (~2000 output tokens ≈ 8-12s).
export const maxDuration = 60;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ─── Prompt builder ─────────────────────────────────────────────────────────── */

function buildBrainPrompt(results: LaunchStageResults, goal: string): string {
  // Serialise only the fields the brain needs — keep prompt tight
  const context = {
    goal,
    research: results.research
      ? {
          insights:             results.research.insights?.slice(0, 6),
          keywords:             results.research.keywords?.slice(0, 8),
          competitorInsights:   results.research.competitorInsights,
          productOpportunities: results.research.productOpportunities?.slice(0, 4),
          reportSummary:        results.research.reportSummary,
        }
      : null,
    product: results.product ?? null,
    design: results.design
      ? {
          assetsCount:      results.design.assetsCount,
          // Template covers have no URL but DO have a designId — both count as "has cover"
          hasCover:         !!results.design.coverUrl
                              || (Array.isArray(results.design.concepts) && results.design.concepts.some(c => !!(c as { designId?: string }).designId)),
          hasCoverDesign:   Array.isArray(results.design.concepts) && results.design.concepts.some(c => !!(c as { designId?: string }).designId),
          hasMockup:        !!results.design.mockupUrl,
          // Template thumbnails have designId but no URL — both count
          hasThumbnail:     !!results.design.thumbnailUrl || !!(results.design.thumbnailDesignId as string | undefined),
          hasSocial:        !!results.design.socialUrl,
        }
      : null,
    marketing: results.marketing
      ? {
          salesCopy:          results.marketing.salesCopy,
          headlines:          results.marketing.headlines?.slice(0, 5),
          launchAnnouncement: results.marketing.launchAnnouncement,
          tiktokHooks:        results.marketing.tiktokHooks?.slice(0, 5),
          carousels:          results.marketing.carousels?.length ?? 0,
          emailCount:         results.marketing.emails?.length ?? 0,
          emailSubjects:      results.marketing.emails?.map(e => e.subject),
          xPosts:             results.marketing.xPosts?.slice(0, 3),
          instagramCount:     results.marketing.instagramCaptions?.length ?? 0,
          seoTitle:           results.marketing.seoTitle,
          seoMetaDesc:        results.marketing.seoMetaDesc,
          tags:               results.marketing.tags,
          faqCount:           results.marketing.faq?.length ?? 0,
          ctaCount:           results.marketing.ctas?.length ?? 0,
        }
      : null,
    store: results.store
      ? {
          readinessScore:   results.store.readinessScore,
          validationChecks: results.store.validationChecks,
          hasStoreUrl:      !!results.store.storeUrl,
        }
      : null,
  };

  return `Review this creator's AI-generated launch and produce a founder-quality business critique that increases their chance of making sales.

GOAL: "${goal}"

PROJECT DATA:
${JSON.stringify(context, null, 2)}

CRITICAL RULES — follow these exactly:
1. Every recommendation MUST cite specific content from the data above (quote actual headlines, describe actual gaps you can see)
2. NEVER invent percentage impact numbers — describe impact qualitatively ("likely to improve conversion", "could reduce bounce rate")
3. Confidence scores (high/medium/low) must reflect how much evidence you have, not how certain the fix is
4. Maximum 5 recommendations, sorted strictly by priority (highest business impact first)
5. Scores (0-100) should be critical and realistic — 85+ means genuinely excellent, not just complete
6. If a data section is null or missing, give it a low score and explain exactly what's missing
7. businessScore = weighted average: market(15%) + product(25%) + design(15%) + store(20%) + marketing(15%) + launchReadiness(10%)
8. launchScore reflects readiness to go live RIGHT NOW, not potential after improvements
9. AUTOMATION RULES — classify every recommendation as automatable or not:
   - automatable: true → the AI can re-run this stage automatically to fix it (design, marketing, product, store improvements)
   - automatable: false → genuinely requires the user (e.g. pricing decisions, adding personal photos, setting checkout URL)
   - IMPORTANT: cover image issues, marketing gaps, product content gaps, SEO gaps are ALL automatable — never tell the user to manually fix something the AI can regenerate
   - If design.hasCover is true OR design.hasCoverDesign is true, do NOT recommend creating a cover — it already exists
   - "stage" field must be the pipeline stage to re-run: "design", "marketing", "product", or "store"
   - "fixInstruction" must be a clear, specific instruction to the regenerating agent (max 2 sentences)

Return ONLY valid JSON — no markdown fences, no explanation before or after:

{
  "businessScore": <integer 0-100>,
  "launchScore": <integer 0-100>,
  "reviewSummary": "<2-3 sentences: honest overall verdict, name specific strengths and the single biggest risk>",
  "sections": {
    "marketOpportunity": {
      "score": <integer>,
      "summary": "<specific analysis citing actual research data — keywords, competitors, demand>",
      "insights": ["<specific insight from research data>", "<second insight>", "<third insight>"]
    },
    "product": {
      "score": <integer>,
      "summary": "<specific analysis of product name, structure, perceived value>",
      "strengths": ["<actual strength visible in data>"],
      "issues": ["<specific gap or risk>"]
    },
    "design": {
      "score": <integer>,
      "summary": "<analysis of cover/mockup/thumbnail quality — note if assets are missing>",
      "issues": ["<specific design concern or missing asset>"]
    },
    "store": {
      "score": <integer>,
      "summary": "<analysis of headline, description, CTA, SEO, trust signals, readiness score>",
      "issues": ["<specific store listing weakness>"]
    },
    "marketing": {
      "score": <integer>,
      "summary": "<analysis of content variety, hook quality, email sequence, posting strategy>",
      "issues": ["<specific marketing gap>"]
    },
    "launchReadiness": {
      "score": <integer>,
      "explanation": "<what is preventing a 100% score — be specific about what's missing or weak>"
    }
  },
  "recommendations": [
    {
      "id": "<kebab-case-id>",
      "priority": "<high|medium|low>",
      "category": "<product|design|store|marketing|pricing>",
      "title": "<imperative, max 8 words>",
      "detail": "<exactly what the AI will improve — be specific, reference actual content from the project>",
      "reasoning": "<cite specific evidence from the project data>",
      "impact": "<qualitative: what improves and why, no made-up numbers>",
      "confidence": "<high|medium|low>",
      "actionType": "<edit_product|edit_store|regenerate_design|edit_marketing|manual>",
      "automatable": <true|false>,
      "stage": "<design|marketing|product|store|null>",
      "fixInstruction": "<specific instruction for the agent when it re-runs, e.g. 'Add a dedicated section on international student use cases and include marketing strategies targeting international students on TikTok and Instagram'>",
      "actionHref": "<relevant page path — use /dashboard/digital-products/[id]/edit for product/design edits, /dashboard/digital-products/[id]/edit#publish for store/publish, /dashboard/launch/[launchId]/workspace for marketing content>"
    }
  ]
}`;
}

/* ─── Route handler ──────────────────────────────────────────────────────────── */

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  let launchId: string;
  try {
    const body = await req.json() as { launchId?: string };
    launchId = body.launchId ?? "";
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!launchId) {
    return NextResponse.json({ error: "Missing launchId" }, { status: 400 });
  }

  /* Load project */
  const [project] = await db
    .select()
    .from(launchProjectsTable)
    .where(and(eq(launchProjectsTable.id, launchId), eq(launchProjectsTable.userId, userId)))
    .limit(1);

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const results = project.stageResults ?? ({} as LaunchStageResults);

  /* Return cached result if already run */
  if (results.brain) {
    return NextResponse.json({ brain: results.brain });
  }

  /* Call OpenAI — same provider used by all other launch agents */
  let rawText = "";
  try {
    const completion = await openai.chat.completions.create({
      model:      "gpt-4o-mini",  // fast + cheap; Brain JSON fits in ~1400 tokens
      max_tokens: 2000,
      temperature: 0.3,           // deterministic enough for structured JSON
      response_format: { type: "json_object" },  // guarantees valid JSON output
      messages: [
        {
          role:    "system",
          content: "You are an experienced founder and digital product launch consultant. Always respond with valid JSON only.",
        },
        {
          role:    "user",
          content: buildBrainPrompt(results, project.goal),
        },
      ],
    });

    rawText = completion.choices[0]?.message?.content ?? "";
  } catch (err) {
    console.error("[brain] OpenAI error:", err);
    return NextResponse.json({ error: "AI analysis failed" }, { status: 500 });
  }

  /* Parse JSON — extract first {...} block to handle any preamble/fence text */
  let brain: BrainResult;
  try {
    // Find the outermost JSON object regardless of any leading/trailing text
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON object found in response");
    brain = JSON.parse(jsonMatch[0]) as BrainResult;
    brain.completedAt = new Date().toISOString();
  } catch (err) {
    console.error("[brain] Parse error:", err);
    console.error("[brain] Raw text:", rawText.substring(0, 500));
    return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
  }

  /* Save to DB */
  try {
    const updated: LaunchStageResults = { ...results, brain };
    await db
      .update(launchProjectsTable)
      .set({ stageResults: updated, updatedAt: new Date() })
      .where(eq(launchProjectsTable.id, launchId));
  } catch (err) {
    console.error("[brain] DB save error:", err);
    // Return the result even if save failed — better than blocking the user
  }

  return NextResponse.json({ brain });
}
