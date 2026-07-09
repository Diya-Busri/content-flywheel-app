/**
 * POST /api/launch/[launchId]/save-to-library
 *
 * Saves key summaries from each completed pipeline stage as entries
 * in the founder_workspace_entries (Knowledge Base) table.
 *
 * Called automatically when the pipeline completes — idempotent:
 * calling twice just adds duplicate entries (fine for demo).
 */
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { launchProjectsTable } from "@/db/schema/launch-schema";
import { founderWorkspaceEntriesTable } from "@/db/schema/founder-workspace-schema";
import type { LaunchStageResults } from "@/db/schema/launch-schema";
import { eq, and } from "drizzle-orm";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ launchId: string }> },
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { launchId } = await params;

    /* Load project */
    const [project] = await db
      .select()
      .from(launchProjectsTable)
      .where(and(
        eq(launchProjectsTable.id, launchId),
        eq(launchProjectsTable.userId, userId),
      ))
      .limit(1);

    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const results = (project.stageResults ?? {}) as LaunchStageResults;
    const entries: typeof founderWorkspaceEntriesTable.$inferInsert[] = [];

    /* ── Research insights ── */
    if (results.research) {
      const r = results.research;
      const niches   = r.niches?.join(", ") ?? "";
      const insights = (r.insights ?? []).slice(0, 5).join("\n• ");
      const opps     = (r.productOpportunities ?? []).slice(0, 3).join("\n• ");

      entries.push({
        userId,
        category:  "research",
        type:      "market-research",
        title:     `Launch Research — ${project.goal}`,
        content:   [
          `Goal: ${project.goal}`,
          niches   ? `Niches: ${niches}` : "",
          insights ? `Key insights:\n• ${insights}` : "",
          opps     ? `Product opportunities:\n• ${opps}` : "",
        ].filter(Boolean).join("\n\n"),
        source:    "research",
        metadata:  { launchId, stage: "research", goal: project.goal },
      });
    }

    /* ── Product copy ── */
    if (results.product) {
      const p = results.product;
      entries.push({
        userId,
        category:  "marketing-psychology",
        type:      "product-copy",
        title:     p.productName ?? `Product — ${project.goal}`,
        content:   [
          p.productName ? `Product: ${p.productName}` : "",
          p.tagline     ? `Tagline: ${p.tagline}` : "",
          p.description ? `Description:\n${p.description}` : "",
          p.targetAudience ? `Target audience: ${p.targetAudience}` : "",
          (p.keyBenefits?.length)
            ? `Key benefits:\n• ${p.keyBenefits.slice(0, 5).join("\n• ")}`
            : "",
        ].filter(Boolean).join("\n\n"),
        source:    "research",
        metadata:  { launchId, stage: "product", productId: p.productId },
      });
    }

    /* ── Marketing campaign summary ── */
    if (results.marketing) {
      const m = results.marketing;
      const hooks  = (m.tiktokHooks ?? []).slice(0, 3).join("\n• ");
      const emails = (m.emails ?? []).map(e => e.subject).filter(Boolean).slice(0, 3).join(", ");

      entries.push({
        userId,
        category:  "copywriting",
        type:      "campaign-copy",
        title:     `Launch Campaign — ${project.goal}`,
        content:   [
          `Campaign for: ${project.goal}`,
          m.launchHeadline  ? `Headline: ${m.launchHeadline}` : "",
          m.valueProposition ? `Value prop: ${m.valueProposition}` : "",
          hooks  ? `Hooks:\n• ${hooks}` : "",
          emails ? `Email subjects: ${emails}` : "",
        ].filter(Boolean).join("\n\n"),
        source:    "research",
        metadata:  { launchId, stage: "marketing" },
      });
    }

    /* ── Store setup summary ── */
    if (results.store) {
      const s = results.store;
      entries.push({
        userId,
        category:  "analytics",
        type:      "store-summary",
        title:     `Store Readiness — ${project.goal}`,
        content:   [
          `Goal: ${project.goal}`,
          `Store Readiness Score: ${s.readinessScore ?? 0}%`,
          s.storeSummary ? `\n${s.storeSummary}` : "",
          s.storeUrl     ? `Store URL: ${s.storeUrl}` : "",
        ].filter(Boolean).join("\n"),
        source:    "research",
        metadata:  { launchId, stage: "store", readinessScore: s.readinessScore, storeUrl: s.storeUrl },
      });
    }

    if (entries.length === 0) {
      return NextResponse.json({ saved: 0, message: "No stage results to save yet" });
    }

    /* Insert all entries */
    await db.insert(founderWorkspaceEntriesTable).values(entries);

    return NextResponse.json({ saved: entries.length });
  } catch (err) {
    console.error("[save-to-library]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
