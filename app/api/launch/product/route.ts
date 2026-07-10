/**
 * POST /api/launch/product
 * ─────────────────────────
 * Streaming product generation for the AI Execution pipeline.
 *
 * Unlike /api/products/create-from-research (which returns one JSON blob),
 * this route streams NDJSON events so the execution dashboard shows what
 * is being written in real time — one section at a time.
 *
 * Stream event sequence:
 *   step         — a named step is starting
 *   thinking     — a sub-observation ("Comparing N concepts...")
 *   decision     — product name + format chosen
 *   outline-ready — section list is known
 *   writing-section — a section is being generated
 *   section-done  — a section completed
 *   done          — productId, totals
 *   error         — fatal error
 *
 * Re-uses:
 *   • generateProductOutline       (lib/generate-product-content)
 *   • generateSingleSectionBody    (lib/generate-product-content)
 *   • productsTable                (db/schema/products-schema)
 */
export const dynamic    = "force-dynamic";
export const maxDuration = 300; // Vercel Pro — product gen can take 2-4 min

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { brandVoiceTable } from "@/db/schema/brand-voice-schema";
import { markOnboardingStep } from "@/lib/onboarding-auto-complete";
import {
  generateProductOutline,
  generateSingleSectionBody,
  type GenerateProductContentParams,
  type OutlineSection,
} from "@/lib/generate-product-content";

/* ─── Research input shape (from LaunchStageResults.research) ──────────────── */

interface ResearchInput {
  query?:                string;
  insights?:             string[];
  reportSummary?:        string;
  productOpportunities?: Array<{ title: string; description: string; type: string; priceRange: string }>;
  keywords?:             Array<{ term: string; intent: string; opportunity: string; note: string }>;
  actionPlan?:           Array<{ step: number; action: string; detail: string; cta?: string }>;
  competitorInsights?:   Array<{ name: string; strength: string; gap: string }>;
  fullReport?:           Record<string, unknown>;
}

/* ─── Product format inference from research type ───────────────────────────── */

const FORMAT_MAP: Record<string, string> = {
  "digital download":  "ebook",
  "template pack":     "checklist",
  "online course":     "course",
  "course":            "course",
  "prompt pack":       "checklist",
  "toolkit":           "guide",
  "workbook":          "workbook",
  "bundle":            "ebook",
  "membership":        "ebook",
  "coaching programme":"guide",
  "guide":             "guide",
  "checklist":         "checklist",
  "notion template":   "notion",
  "spreadsheet":       "spreadsheet",
  "journal":           "journal",
  "planner":           "planner",
};

function inferFormat(type: string): string {
  const lower = type.toLowerCase();
  for (const [key, fmt] of Object.entries(FORMAT_MAP)) {
    if (lower.includes(key)) return fmt;
  }
  return "ebook"; // safe default
}

/* ─── Smart price derivation ─────────────────────────────────────────────────
   Parses price ranges like "£27", "£27-£47", "$47", "$37-$97" from research
   product opportunity data and returns a market-anchored suggested price.
   Strategy: take the median midpoint of all parsed ranges, then round to
   the nearest common psychological price (£7/£17/£27/£37/£47/£57/£67/£97).
──────────────────────────────────────────────────────────────────────────── */

function deriveSmartPrice(
  opps: Array<{ priceRange?: string }>,
  format?: string,
): string {
  const PRICE_ANCHORS = [7, 17, 27, 37, 47, 57, 67, 97, 127, 197];
  const currencyRe = /[£$€](\d+)/g;

  const midpoints: number[] = [];
  for (const opp of opps) {
    if (!opp.priceRange) continue;
    const matches = [...opp.priceRange.matchAll(currencyRe)].map(m => Number(m[1]));
    if (matches.length === 1) midpoints.push(matches[0]!);
    else if (matches.length >= 2) midpoints.push((matches[0]! + matches[1]!) / 2);
  }

  if (midpoints.length === 0) {
    // Format-based sensible defaults when no data
    const fmt = (format ?? "").toLowerCase();
    if (fmt === "course")     return "£97";
    if (fmt === "workbook")   return "£27";
    if (fmt === "checklist")  return "£17";
    if (fmt === "planner")    return "£17";
    return "£37";
  }

  // Median midpoint
  const sorted = [...midpoints].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)]!;

  // Snap to nearest psychological anchor
  const nearest = PRICE_ANCHORS.reduce((best, a) =>
    Math.abs(a - median) < Math.abs(best - median) ? a : best,
    PRICE_ANCHORS[0]!,
  );

  // Detect currency symbol from first opp that has a price
  const firstCurrency = opps.find(o => o.priceRange && /[£$€]/.test(o.priceRange))?.priceRange?.match(/[£$€]/)?.[0] ?? "£";
  return `${firstCurrency}${nearest}`;
}

/* ─── AI call helper ─────────────────────────────────────────────────────────── */

async function aiSelectProduct(
  goal:       string,
  research:   ResearchInput,
  apiKey:     string,
): Promise<{
  productName:  string;
  format:       string;
  niche:        string;
  description:  string;
  pricePoint:   string;
  idealFor:     string;
  whyThisOne:   string;
}> {
  const opps    = research.productOpportunities ?? [];
  const insights = research.insights ?? [];
  const keywords = (research.keywords ?? []).filter(k => k.opportunity === "High").slice(0, 6).map(k => k.term);

  // Derive a data-driven price from actual market ranges in research
  const smartPrice = deriveSmartPrice(opps);

  // Fall back to the top opportunity without an AI call when no key
  const fallback = {
    productName:  opps[0]?.title  ?? goal,
    format:       inferFormat(opps[0]?.type ?? "ebook"),
    niche:        research.query  ?? goal,
    description:  opps[0]?.description ?? `A complete resource for ${goal}`,
    pricePoint:   smartPrice,
    idealFor:     `People interested in ${goal}`,
    whyThisOne:   "Highest-demand product from research",
  };

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body:    JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an expert digital product strategist. Select the single BEST product to create. Return ONLY valid JSON.",
          },
          {
            role: "user",
            content: `Goal: "${goal}"
Market summary: "${(research.reportSummary ?? "").slice(0, 400)}"
Product opportunities (${opps.length} found):
${opps.slice(0, 5).map((o, i) => `${i + 1}. ${o.title} (${o.type}) — ${o.description} — ${o.priceRange}`).join("\n")}
High-opportunity keywords: ${keywords.join(", ")}
Top insights: ${insights.slice(0, 4).join(" | ")}

MARKET-DERIVED PRICE ANCHOR: Based on the competitor price ranges above, the market median is ${smartPrice}. Use this as your price unless the chosen format (e.g. short checklist vs. full course) strongly warrants a different tier.

Pick the SINGLE best product to create right now. Choose a specific, marketable name — not generic.
Return ONLY this JSON:
{
  "productName": "Specific marketable title",
  "format": "ebook|guide|workbook|checklist|planner|spreadsheet|journal|course|notion",
  "niche": "Specific niche phrase",
  "description": "2-3 sentence product pitch",
  "pricePoint": "${smartPrice.replace("£", "£").replace("$", "$")}",
  "idealFor": "Target buyer in one sentence",
  "whyThisOne": "One sentence: why build this now"
}`,
          },
        ],
        temperature:     0.4,
        max_tokens:      400,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) return fallback;
    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw  = data.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as typeof fallback;

    const chosenFormat = typeof parsed.format === "string" ? parsed.format : fallback.format;
    // If GPT returned a price, use it; otherwise re-derive with the now-known format
    const chosenPrice = typeof parsed.pricePoint === "string" && /[£$€]\d+/.test(parsed.pricePoint)
      ? parsed.pricePoint
      : deriveSmartPrice(opps, chosenFormat);

    return {
      productName:  typeof parsed.productName  === "string" ? parsed.productName  : fallback.productName,
      format:       chosenFormat,
      niche:        typeof parsed.niche        === "string" ? parsed.niche        : fallback.niche,
      description:  typeof parsed.description  === "string" ? parsed.description  : fallback.description,
      pricePoint:   chosenPrice,
      idealFor:     typeof parsed.idealFor     === "string" ? parsed.idealFor     : fallback.idealFor,
      whyThisOne:   typeof parsed.whyThisOne   === "string" ? parsed.whyThisOne   : fallback.whyThisOne,
    };
  } catch {
    return fallback;
  }
}

/* ─── Main streaming function ───────────────────────────────────────────────── */

interface BrandVoice {
  brandName?: string | null;
  tone?: string | null;
  targetAudience?: string | null;
  writingStyle?: string | null;
  examplePhrases?: string | null;
}

function streamProductGeneration(
  userId:      string,
  goal:        string,
  research:    ResearchInput,
  apiKey:      string,
  preferences?: { productLength?: string; includeImages?: boolean; carouselCount?: number },
  brandVoice?:  BrandVoice,
): Response {
  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  const send = async (data: Record<string, unknown>): Promise<void> => {
    try {
      await writer.write(encoder.encode(JSON.stringify(data) + "\n"));
    } catch { /* writer may be closed */ }
  };

  void (async () => {
    try {
      /* ── 0. Read research ── */
      await send({ type: "step", id: "read-research", label: "Reading market research..." });
      const opps = research.productOpportunities ?? [];
      await send({ type: "step-done", id: "read-research" });

      /* ── 1. Select product ── */
      await send({ type: "step", id: "select-product", label: "Selecting best product angle..." });
      await send({
        type:  "thinking",
        label: opps.length > 1
          ? `Comparing ${opps.length} product concepts...`
          : "Analysing product opportunity...",
      });

      const selection = await aiSelectProduct(goal, research, apiKey);
      await send({
        type:        "decision",
        productName: selection.productName,
        format:      selection.format,
        niche:       selection.niche,
        pricePoint:  selection.pricePoint,
        whyThisOne:  selection.whyThisOne,
      });
      await send({ type: "step-done", id: "select-product" });

      /* ── 2. Build generation params ── */
      const insights         = research.insights ?? [];
      const actionPlan       = research.actionPlan ?? [];
      const competitorInsights = research.competitorInsights ?? [];
      const keywords         = research.keywords ?? [];

      // Build the rich expertise block that makes the product unique
      const expertiseParts: string[] = [];
      if (research.reportSummary) {
        expertiseParts.push(`MARKET CONTEXT: ${research.reportSummary.slice(0, 600)}`);
      }
      if (insights.length > 0) {
        expertiseParts.push(`KEY INSIGHTS:\n${insights.slice(0, 5).map((s, i) => `${i + 1}. ${s}`).join("\n")}`);
      }
      if (opps.length > 0) {
        expertiseParts.push(`TOP OPPORTUNITY: ${opps[0]?.title} — ${opps[0]?.description}`);
      }
      if (competitorInsights.length > 0) {
        expertiseParts.push(
          `COMPETITOR GAPS:\n${competitorInsights.slice(0, 3).map(c => `${c.name}: ${c.gap}`).join("\n")}`
        );
      }
      if (actionPlan.length > 0) {
        expertiseParts.push(`RECOMMENDED FIRST ACTION: ${actionPlan[0]?.action} — ${actionPlan[0]?.detail}`);
      }

      // Inject brand voice so content sounds like the creator, not generic AI
      if (brandVoice?.brandName) {
        expertiseParts.push(`AUTHOR/BRAND: This product is written under the "${brandVoice.brandName}" brand name.`);
      }
      if (brandVoice?.targetAudience) {
        expertiseParts.push(`TARGET READER: ${brandVoice.targetAudience} — write directly to this person throughout.`);
      }
      if (brandVoice?.writingStyle) {
        expertiseParts.push(`WRITING STYLE: ${brandVoice.writingStyle}`);
      }
      if (brandVoice?.examplePhrases) {
        expertiseParts.push(`BRAND VOICE EXAMPLES (echo this style and vocabulary): ${brandVoice.examplePhrases}`);
      }

      const highOppKeywords = keywords.filter(k => k.opportunity === "High").slice(0, 5).map(k => k.term);

      // Map brand voice tone to the customizationOptions tone type
      const brandTone = brandVoice?.tone?.toLowerCase();
      const resolvedTone: "professional" | "casual" | "academic" | "friendly" | undefined =
        brandTone === "professional" ? "professional"
        : brandTone === "casual"    ? "casual"
        : brandTone === "academic"  ? "academic"
        : brandTone === "friendly"  ? "friendly"
        : undefined;

      const genParams: GenerateProductContentParams = {
        productName:         selection.productName,
        productDescription:  selection.description || undefined,
        productWhy:          selection.idealFor || `People interested in ${selection.niche}`,
        productIncluded:     opps.slice(0, 3).map(o => `${o.title}: ${o.description}`).join("; ") || undefined,
        niche:               selection.niche,
        format:              selection.format,
        hookTexts:           insights.slice(0, 3),
        ctaTexts:            actionPlan.slice(0, 2).map(s => s.action),
        creatorExpertise:    expertiseParts.join("\n\n") || undefined,
        customizationOptions: {
          numChapters:   preferences?.productLength === "short" ? 4
                       : preferences?.productLength === "long"  ? 9 : 5,
          contentLength: (preferences?.productLength === "short" ? "short"
                       : preferences?.productLength === "long"  ? "long" : "medium") as "short" | "medium" | "long",
          contentStyle:  preferences?.includeImages
                       ? "text_with_ai_images" : "text_with_placeholders",
          // Brand voice tone overrides the default if set
          ...(resolvedTone ? { tone: resolvedTone } : {}),
        },
      };

      /* ── 3. Generate outline ── */
      await send({ type: "step", id: "outline", label: "Generating outline..." });
      const outline: OutlineSection[] = await generateProductOutline(genParams);
      await send({ type: "step-done", id: "outline" });
      await send({ type: "outline-ready", sections: outline, total: outline.length });

      /* ── 4. Generate sections ── */
      // Announce all sections starting (parallel batches of 3)
      for (let i = 0; i < outline.length; i++) {
        await send({
          type:  "writing-section",
          index: i,
          title: outline[i]!.title,
          total: outline.length,
        });
      }

      const populated: Array<{ id: string; title: string; content: string; order: number }> = [];
      // Track which sections failed so we can report them
      const failedSectionIndices: number[] = [];

      // Run all sections in parallel — gpt-4o-mini is fast enough (3-8s each)
      // that firing all at once is well within the 300s Vercel limit and ~3× faster
      // than sequential batches of 3.
      const allResults = await Promise.allSettled(
        outline.map(async (section, idx) => {
          try {
            const result = await generateSingleSectionBody(genParams, section, idx, outline.length);
            const body = result.body?.trim() ?? "";
            if (!body || body.length < 50) {
              throw new Error(`Section "${section.title}" returned insufficient content (${body.length} chars)`);
            }
            await send({ type: "section-done", index: idx, title: section.title, total: outline.length });
            return { id: section.id, title: section.title, content: body, order: idx + 1 };
          } catch (secErr) {
            await send({
              type:   "section-failed",
              index:  idx,
              title:  section.title,
              total:  outline.length,
              reason: secErr instanceof Error ? secErr.message : "Generation timed out",
            });
            throw secErr;
          }
        })
      );

      for (let ri = 0; ri < allResults.length; ri++) {
        const r   = allResults[ri]!;
        const idx = ri;
        if (r.status === "fulfilled") {
          populated.push(r.value);
        } else {
          const sec = outline[idx];
          if (sec) {
            populated.push({
              id:      sec.id,
              title:   sec.title,
              content: `[Content generation failed for "${sec.title}" — use the editor to add content]`,
              order:   idx + 1,
            });
            failedSectionIndices.push(idx);
          }
        }
      }

      populated.sort((a, b) => a.order - b.order);
      const sectionsGenerated = populated.filter(s => !failedSectionIndices.includes(s.order - 1)).length;
      const emptySections     = failedSectionIndices.length;

      /* ── 5. Pricing step ── */
      await send({ type: "step", id: "pricing", label: "Setting pricing recommendation..." });
      await send({
        type:       "pricing-set",
        pricePoint: selection.pricePoint,
        niche:      selection.niche,
      });
      await send({ type: "step-done", id: "pricing" });

      /* ── 6. Save to DB ── */
      await send({ type: "step", id: "saving", label: "Saving to Digital Products..." });

      const designSettings = {
        template:   "modern",
        colors:     { primary: "#FF6B35", secondary: "#004E89", accent: "#F7B32B" },
        typography: { heading: "Inter", body: "Open Sans", size: 16 },
      };

      // Build SEO-ready marketing assets from research data — no extra AI call needed
      const seoKeywords: string[] = [
        ...highOppKeywords,
        ...keywords
          .filter(k => k.opportunity !== "High") // already have High above
          .slice(0, 5)
          .map(k => k.term),
      ].slice(0, 15); // cap at 15 keywords

      // Hashtags: niche-derived from keywords, stripped to alphanumeric, prefixed with #
      const hashtagSources = [selection.niche, ...highOppKeywords.slice(0, 5)];
      const hashtags: string[] = [...new Set(
        hashtagSources
          .flatMap(s => s.toLowerCase().split(/[\s,\-/]+/))
          .filter(w => w.length > 2)
          .map(w => `#${w.replace(/[^a-z0-9]/g, "")}`)
          .filter(h => h.length > 2),
      )].slice(0, 10);

      const initialMarketingAssets = {
        productDescription: selection.description || undefined,
        seoKeywords:        seoKeywords.length > 0 ? seoKeywords : undefined,
        hashtags:           hashtags.length > 0 ? hashtags : undefined,
        priceLabel:         selection.pricePoint || undefined,
      };

      const [inserted] = await db
        .insert(productsTable)
        .values({
          userId,
          title:           selection.productName,
          niche:           selection.niche,
          format:          selection.format,
          content:         { sections: populated },
          designSettings,
          placedElements:  [],
          status:          "draft",
          marketingAssets: initialMarketingAssets,
        })
        .returning({ id: productsTable.id });

      if (!inserted?.id) throw new Error("DB insert failed");

      markOnboardingStep(userId, "firstProduct").catch(() => {});

      await send({ type: "step-done", id: "saving" });

      /* ── 7. Validation phase ── */
      await send({ type: "validation-start" });

      // Check 1: product id
      await send({
        type:   "validation-check",
        id:     "product-id",
        label:  "Product created in library",
        passed: true,
      });

      // Check 2: sections complete
      const allSectionsOk = sectionsGenerated >= outline.length;
      await send({
        type:   "validation-check",
        id:     "sections-complete",
        label:  `Sections generated (${sectionsGenerated}/${outline.length})`,
        passed: allSectionsOk,
        reason: allSectionsOk ? undefined : `${emptySections} section${emptySections !== 1 ? "s" : ""} failed — will be flagged for retry`,
      });

      // Check 3: no empty sections
      await send({
        type:   "validation-check",
        id:     "no-empty-sections",
        label:  `Content quality — all sections have body text`,
        passed: emptySections === 0,
        reason: emptySections > 0 ? `${emptySections} section${emptySections !== 1 ? "s" : ""} have placeholder content` : undefined,
      });

      // Check 4: DB confirmed
      await send({
        type:   "validation-check",
        id:     "saved-to-db",
        label:  "Saved to Digital Products library",
        passed: true,
      });

      await send({ type: "validation-done", passed: allSectionsOk && emptySections === 0 });

      await send({
        type:              "done",
        productId:         inserted.id,
        productName:       selection.productName,
        format:            selection.format,
        niche:             selection.niche,
        pricePoint:        selection.pricePoint,
        sectionsGenerated,
        totalSections:     outline.length,
        emptySections,
        savedToDb:         true,
      });

    } catch (err) {
      await send({ type: "error", message: err instanceof Error ? err.message : String(err) }).catch(() => {});
    } finally {
      await writer.close().catch(() => {});
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type":   "application/x-ndjson; charset=utf-8",
      "Cache-Control":  "no-cache, no-store, must-revalidate",
      "X-Accel-Buffering": "no",
    },
  });
}

/* ─── POST handler ───────────────────────────────────────────────────────────── */

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const rl = await checkApiRateLimit(userId);
    if (rl) return rl;

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI not configured" }), { status: 503 });
    }

    const body = await request.json().catch(() => ({})) as {
      goal?:         string;
      research?:     ResearchInput;
      preferences?:  { productLength?: string; includeImages?: boolean; carouselCount?: number };
    };

    const goal        = typeof body.goal     === "string" ? body.goal.trim()     : "";
    const research    = typeof body.research === "object" && body.research !== null
      ? body.research : {};
    const preferences = body.preferences;

    if (!goal) {
      return new Response(JSON.stringify({ error: "goal is required" }), { status: 400 });
    }

    // Fetch brand voice (non-fatal — missing brand voice is fine)
    const [bv] = await db
      .select({
        brandName:      brandVoiceTable.brandName,
        tone:           brandVoiceTable.tone,
        targetAudience: brandVoiceTable.targetAudience,
        writingStyle:   brandVoiceTable.writingStyle,
        examplePhrases: brandVoiceTable.examplePhrases,
      })
      .from(brandVoiceTable)
      .where(eq(brandVoiceTable.userId, userId))
      .limit(1)
      .catch(() => []);

    return streamProductGeneration(userId, goal, research, apiKey, preferences, bv ?? undefined);

  } catch (err) {
    console.error("[launch/product]", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
}
