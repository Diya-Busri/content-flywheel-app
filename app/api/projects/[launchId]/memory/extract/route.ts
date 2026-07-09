/**
 * POST /api/projects/[launchId]/memory/extract
 * ──────────────────────────────────────────────────────────────────────────────
 * Runs deterministic extraction from current stageResults and merges into memory.
 * Optionally runs an AI pass to surface additional suggestions (aiSuggest: true).
 *
 * Body: { aiSuggest?: boolean }
 *
 * Called:
 *  — On-demand from the Memory Viewer ("Extract from latest data" button)
 *  — Automatically from worker run route after each successful run
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { launchProjectsTable } from "@/db/schema/launch-schema";
import type {
  LaunchStageResults,
  BusinessMemory,
  MemorySuggestion,
  MemoryCategory,
} from "@/db/schema/launch-schema";
import { eq, and } from "drizzle-orm";
import { extractMemoryFacts, mergeMemoryFacts } from "@/lib/memory-context";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

const ai = new Anthropic();

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function parseJSON<T>(raw: string): T | null {
  try {
    const clean = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    return JSON.parse(clean) as T;
  } catch {
    return null;
  }
}

/* ─── AI suggestion extraction ───────────────────────────────────────────────── */

async function generateSuggestions(
  results: LaunchStageResults,
  goal: string,
  existingKeys: string[],
): Promise<MemorySuggestion[]> {
  const productName = results.product?.productName ?? goal;
  const brainSummary = results.brain?.reviewSummary ?? "";
  const growthSummary = results.growth?.report?.summary ?? "";
  const topKeywords = results.research?.keywords?.slice(0, 5).map(k => k.term).join(", ") ?? "";
  const recentActivities = Object.values(results.workforce?.workers ?? {})
    .flatMap(w => w?.history?.slice(0, 2) ?? [])
    .map(a => a.label)
    .join("; ");

  const raw = await ai.messages.create({
    model:      "claude-haiku-4-5-20251001",
    max_tokens: 800,
    messages: [{
      role: "user",
      content: `You are reviewing a digital business and identifying facts worth permanently remembering.

PRODUCT: "${productName}"
GOAL: "${goal}"
BRAIN SUMMARY: "${brainSummary}"
GROWTH SUMMARY: "${growthSummary}"
KEYWORDS: "${topKeywords}"
RECENT AI WORK: "${recentActivities}"

Already memorised keys (do not suggest these): ${existingKeys.slice(0, 20).join(", ")}

Suggest 2-4 new facts worth permanently storing about this business.
Focus on: tone of voice, writing style, audience pain points, what's working, what to avoid.

Return ONLY valid JSON:
{
  "suggestions": [
    {
      "category": "brand|audience|products|marketing|launches|analytics|ideas|lessons|knowledge",
      "key": "snake_case_key",
      "label": "Human Label",
      "value": "the fact value",
      "reason": "why this is worth remembering"
    }
  ]
}`,
    }],
  });

  const text = raw.content
    .filter(b => b.type === "text")
    .map(b => (b as { type: "text"; text: string }).text)
    .join("");

  const data = parseJSON<{
    suggestions: Array<{
      category: MemoryCategory;
      key: string;
      label: string;
      value: string;
      reason: string;
    }>;
  }>(text);

  if (!data) return [];

  const now = new Date().toISOString();
  return data.suggestions.map(s => ({
    id:          uid(),
    category:    s.category,
    key:         s.key,
    label:       s.label,
    value:       s.value,
    source:      "brain",
    reason:      s.reason,
    suggestedAt: now,
  }));
}

/* ─── Route handler ──────────────────────────────────────────────────────────── */

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ launchId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { launchId } = await params;
  const body = await req.json().catch(() => ({})) as { aiSuggest?: boolean };

  const [project] = await db
    .select()
    .from(launchProjectsTable)
    .where(and(eq(launchProjectsTable.id, launchId), eq(launchProjectsTable.userId, userId)))
    .limit(1);

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const results: LaunchStageResults = project.stageResults ?? {};
  const existingMemory: BusinessMemory = results.memory ?? { facts: [] };

  /* Deterministic extraction */
  const extracted = extractMemoryFacts(results, project.goal);
  const mergedFacts = mergeMemoryFacts(existingMemory.facts, extracted);

  /* Optional AI suggestions */
  let suggestions = existingMemory.suggestions ?? [];
  if (body.aiSuggest) {
    const existingKeys = mergedFacts.map(f => f.key);
    const newSuggestions = await generateSuggestions(results, project.goal, existingKeys);
    /* Merge: keep existing suggestions that aren't already suggested */
    const existingSugKeys = new Set(suggestions.map(s => s.key));
    const freshSuggestions = newSuggestions.filter(s => !existingSugKeys.has(s.key));
    suggestions = [...suggestions, ...freshSuggestions];
  }

  const updatedMemory: BusinessMemory = {
    facts:             mergedFacts,
    suggestions,
    lastExtractedAt:   new Date().toISOString(),
  };

  await db
    .update(launchProjectsTable)
    .set({
      stageResults: { ...results, memory: updatedMemory },
      updatedAt:    new Date(),
    })
    .where(eq(launchProjectsTable.id, launchId));

  return NextResponse.json({
    memory: updatedMemory,
    extracted: extracted.length,
    merged:    mergedFacts.length,
  });
}
