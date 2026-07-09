/**
 * PATCH /api/projects/[launchId]/memory/suggestions
 *
 * Accept or reject a pending memory suggestion from the AI.
 *  — accept  → moves suggestion into facts (confirmed by user)
 *  — reject  → removes it from the suggestions list
 *
 * Body: { suggestionId: string, action: "accept" | "reject" }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { launchProjectsTable } from "@/db/schema/launch-schema";
import type { BusinessMemory, MemoryFact } from "@/db/schema/launch-schema";
import { eq, and } from "drizzle-orm";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ launchId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { launchId } = await params;
  const { suggestionId, action } = await req.json() as {
    suggestionId: string;
    action: "accept" | "reject";
  };

  const [project] = await db
    .select()
    .from(launchProjectsTable)
    .where(and(eq(launchProjectsTable.id, launchId), eq(launchProjectsTable.userId, userId)))
    .limit(1);

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const results = project.stageResults ?? {};
  const memory: BusinessMemory = results.memory ?? { facts: [] };
  const suggestions = memory.suggestions ?? [];

  const suggestion = suggestions.find(s => s.id === suggestionId);
  if (!suggestion) return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });

  const remainingSuggestions = suggestions.filter(s => s.id !== suggestionId);
  let updatedFacts = [...memory.facts];

  if (action === "accept") {
    const now = new Date().toISOString();
    const mapKey = `${suggestion.category}::${suggestion.key}`;
    const idx = updatedFacts.findIndex(f => `${f.category}::${f.key}` === mapKey);

    const fact: MemoryFact = {
      id:              idx >= 0 ? updatedFacts[idx].id : uid(),
      category:        suggestion.category,
      key:             suggestion.key,
      label:           suggestion.label,
      value:           suggestion.value,
      source:          suggestion.source,
      confidence:      "high",
      confirmedByUser: true,
      addedAt:         idx >= 0 ? updatedFacts[idx].addedAt : now,
      updatedAt:       now,
    };

    if (idx >= 0) {
      updatedFacts[idx] = fact;
    } else {
      updatedFacts.push(fact);
    }
  }

  const updatedMemory: BusinessMemory = {
    ...memory,
    facts:       updatedFacts,
    suggestions: remainingSuggestions,
  };

  await db
    .update(launchProjectsTable)
    .set({ stageResults: { ...results, memory: updatedMemory }, updatedAt: new Date() })
    .where(eq(launchProjectsTable.id, launchId));

  return NextResponse.json({ memory: updatedMemory });
}
