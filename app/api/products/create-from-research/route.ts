export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { markOnboardingStep } from "@/lib/onboarding-auto-complete";
import {
  generateProductOutline,
  generateSingleSectionBody,
  type GenerateProductContentParams,
} from "@/lib/generate-product-content";

// ── Payload types (mirrors ResearchTab interfaces) ────────────────────────────

interface ProductOpp {
  title: string;
  description: string;
  type: string;
  priceRange: string;
}

interface Competitor {
  name: string;
  strength: string;
  gap: string;
}

interface Keyword {
  term: string;
  intent: string;
  opportunity: string;
  note: string;
}

interface ActionStep {
  step: number;
  action: string;
  detail: string;
  cta?: string;
}

/**
 * POST /api/products/create-from-research
 *
 * Accepts the full research context, derives audience, builds a rich
 * creatorExpertise string, generates an outline via GPT-4o-mini, then
 * generates every section body via GPT-4o (batches of 3), and inserts
 * a fully populated product into the DB.
 *
 * Returns: { productId, sectionsGenerated, totalSections, audience }
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkApiRateLimit(userId);
    if (rl) return rl;

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;

    // ── Extract fields ──────────────────────────────────────────────────────
    const title       = (typeof body.title       === "string" ? body.title.trim()       : "") || "Untitled Product";
    const niche       = typeof body.niche       === "string" ? body.niche.trim()       : "";
    const format      = typeof body.format      === "string" ? body.format.trim()      : "ebook";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    let   audience    = typeof body.audience    === "string" ? body.audience.trim()    : "";

    const reportSummary:      string       = typeof body.reportSummary === "string" ? body.reportSummary : "";
    const insights:           string[]     = Array.isArray(body.insights)           ? (body.insights as string[])           : [];
    const productOpportunities: ProductOpp[] = Array.isArray(body.productOpportunities) ? (body.productOpportunities as ProductOpp[]) : [];
    const keywords:           Keyword[]    = Array.isArray(body.keywords)           ? (body.keywords as Keyword[])          : [];
    const actionPlan:         ActionStep[] = Array.isArray(body.actionPlan)         ? (body.actionPlan as ActionStep[])     : [];
    const competitorInsights: Competitor[] = Array.isArray(body.competitorInsights) ? (body.competitorInsights as Competitor[]) : [];

    // ── Derive audience if empty ────────────────────────────────────────────
    if (!audience && productOpportunities.length > 0) {
      audience = productOpportunities[0]!.description;
    }
    if (!audience) {
      audience = `People interested in ${niche || title}`;
    }

    // ── Build creatorExpertise from all research data ───────────────────────
    const expertiseParts: string[] = [];

    if (reportSummary) {
      expertiseParts.push(`RESEARCH SUMMARY: ${reportSummary}`);
    }
    if (insights.length > 0) {
      expertiseParts.push(
        `KEY MARKET INSIGHTS:\n${insights.slice(0, 5).map((ins, n) => `${n + 1}. ${ins}`).join("\n")}`
      );
    }
    if (productOpportunities.length > 0) {
      const top = productOpportunities[0]!;
      expertiseParts.push(
        `TOP PRODUCT OPPORTUNITY: ${top.title} — ${top.description} (Price range: ${top.priceRange})`
      );
      if (productOpportunities.length > 1) {
        expertiseParts.push(
          `OTHER OPPORTUNITIES:\n${productOpportunities
            .slice(1, 4)
            .map((o) => `- ${o.title}: ${o.description}`)
            .join("\n")}`
        );
      }
    }
    if (keywords.length > 0) {
      const highOpp = keywords.filter((k) => k.opportunity === "High").slice(0, 6);
      if (highOpp.length > 0) {
        expertiseParts.push(`HIGH-OPPORTUNITY KEYWORDS: ${highOpp.map((k) => k.term).join(", ")}`);
      }
    }
    if (competitorInsights.length > 0) {
      const gaps = competitorInsights
        .slice(0, 3)
        .map((c) => `${c.name}: gap = ${c.gap}`)
        .filter(Boolean);
      if (gaps.length > 0) {
        expertiseParts.push(`COMPETITOR GAPS TO EXPLOIT:\n${gaps.join("\n")}`);
      }
    }
    if (actionPlan.length > 0) {
      expertiseParts.push(
        `RECOMMENDED FIRST ACTION: ${actionPlan[0]!.action} — ${actionPlan[0]!.detail}`
      );
    }

    const creatorExpertise = expertiseParts.join("\n\n") || undefined;

    // ── Build generation params ─────────────────────────────────────────────
    const genParams: GenerateProductContentParams = {
      productName:       title,
      productDescription: description || undefined,
      productWhy:        audience,
      productIncluded:   productOpportunities.length > 0
        ? productOpportunities.slice(0, 3).map((o) => `${o.title}: ${o.description}`).join("; ")
        : undefined,
      niche,
      format,
      hookTexts: insights.slice(0, 3),
      ctaTexts:  actionPlan.slice(0, 2).map((s) => s.action),
      creatorExpertise,
      customizationOptions: {
        numChapters:   4,
        contentLength: "medium",
        contentStyle:  "text_with_placeholders",
      },
    };

    // ── Step 1: Generate outline (TOC) ──────────────────────────────────────
    console.log("[create-from-research] Generating outline for:", title, format);
    const outline = await generateProductOutline(genParams);
    const totalSections = outline.length;
    console.log("[create-from-research] Outline ready —", totalSections, "sections:", outline.map((s) => s.id).join(", "));

    // ── Step 2: Generate section bodies in batches of 3 ────────────────────
    const batchSize = 3;
    const populatedSections: Array<{
      id: string;
      title: string;
      content: string;
      order: number;
      imageUrl?: string;
    }> = [];

    for (let i = 0; i < outline.length; i += batchSize) {
      const batch = outline.slice(i, i + batchSize);
      console.log(`[create-from-research] Generating batch ${Math.floor(i / batchSize) + 1}: ${batch.map((s) => s.id).join(", ")}`);

      const results = await Promise.allSettled(
        batch.map((section, batchIdx) =>
          generateSingleSectionBody(genParams, section, i + batchIdx, totalSections)
        )
      );

      results.forEach((result, batchIdx) => {
        const section = batch[batchIdx]!;
        const order   = i + batchIdx + 1;

        if (result.status === "fulfilled") {
          populatedSections.push({
            id:      section.id,
            title:   section.title,
            content: result.value.body, // body → content (DB schema field)
            order,
          });
        } else {
          // Graceful fallback — blank section so the product still opens
          console.error(`[create-from-research] Section "${section.id}" failed:`, result.reason);
          populatedSections.push({
            id:      section.id,
            title:   section.title,
            content: "",
            order,
          });
        }
      });
    }

    // Sort by order to guarantee correct sequence
    populatedSections.sort((a, b) => a.order - b.order);

    const sectionsGenerated = populatedSections.filter((s) => s.content.length > 0).length;
    console.log(`[create-from-research] Generated ${sectionsGenerated}/${totalSections} sections with content.`);

    // ── Step 3: Insert fully-populated product into DB ──────────────────────
    const designSettings = {
      template: "modern",
      colors:     { primary: "#FF6B35", secondary: "#004E89", accent: "#F7B32B" },
      typography: { heading: "Inter", body: "Open Sans", size: 16 },
    };

    const [inserted] = await db
      .insert(productsTable)
      .values({
        userId,
        title,
        niche,
        format,
        content:         { sections: populatedSections },
        designSettings,
        placedElements:  [],
        status:          "draft",
      })
      .returning({ id: productsTable.id });

    if (!inserted?.id) {
      return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
    }

    markOnboardingStep(userId, "firstProduct").catch(() => {});

    return NextResponse.json({
      productId:        inserted.id,
      sectionsGenerated,
      totalSections,
      audience,
      success:          true,
    });
  } catch (err) {
    console.error("[products/create-from-research]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate product" },
      { status: 500 }
    );
  }
}
