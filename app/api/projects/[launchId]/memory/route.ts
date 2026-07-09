/**
 * GET  /api/projects/[launchId]/memory  — return full BusinessMemory
 * PATCH /api/projects/[launchId]/memory  — add / update / delete individual facts
 *
 * PATCH body variants:
 *   { action: "upsert", category, key, label, value, confidence? }  — add or overwrite
 *   { action: "delete", factId }                                     — remove a fact
 *   { action: "clear_auto", category }                               — wipe auto-extracted facts in a category
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { launchProjectsTable } from "@/db/schema/launch-schema";
import type {
  BusinessMemory,
  MemoryFact,
  MemoryCategory,
} from "@/db/schema/launch-schema";
import { eq, and } from "drizzle-orm";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

/* ─── GET ────────────────────────────────────────────────────────────────────── */

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ launchId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { launchId } = await params;

  const [project] = await db
    .select({ stageResults: launchProjectsTable.stageResults })
    .from(launchProjectsTable)
    .where(and(eq(launchProjectsTable.id, launchId), eq(launchProjectsTable.userId, userId)))
    .limit(1);

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const memory = project.stageResults?.memory ?? { facts: [] };
  return NextResponse.json({ memory });
}

/* ─── PATCH ──────────────────────────────────────────────────────────────────── */

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ launchId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { launchId } = await params;

  const body = await req.json() as
    | { action: "upsert"; category: MemoryCategory; key: string; label: string; value: string; confidence?: MemoryFact["confidence"] }
    | { action: "delete"; factId: string }
    | { action: "clear_auto"; category: MemoryCategory };

  const [project] = await db
    .select()
    .from(launchProjectsTable)
    .where(and(eq(launchProjectsTable.id, launchId), eq(launchProjectsTable.userId, userId)))
    .limit(1);

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const results = project.stageResults ?? {};
  const memory: BusinessMemory = results.memory ?? { facts: [] };
  const now = new Date().toISOString();

  let updatedFacts = [...memory.facts];

  if (body.action === "upsert") {
    const mapKey = `${body.category}::${body.key}`;
    const idx = updatedFacts.findIndex(f => `${f.category}::${f.key}` === mapKey);
    const fact: MemoryFact = {
      id:              idx >= 0 ? updatedFacts[idx].id : uid(),
      category:        body.category,
      key:             body.key,
      label:           body.label,
      value:           body.value,
      source:          "user",
      confidence:      body.confidence ?? "high",
      confirmedByUser: true,
      addedAt:         idx >= 0 ? updatedFacts[idx].addedAt : now,
      updatedAt:       now,
    };
    if (idx >= 0) {
      updatedFacts[idx] = fact;
    } else {
      updatedFacts.push(fact);
    }
  } else if (body.action === "delete") {
    updatedFacts = updatedFacts.filter(f => f.id !== body.factId);
  } else if (body.action === "clear_auto") {
    updatedFacts = updatedFacts.filter(
      f => f.category !== body.category || f.confirmedByUser || f.source === "user",
    );
  }

  const updatedMemory: BusinessMemory = {
    ...memory,
    facts: updatedFacts,
  };

  await db
    .update(launchProjectsTable)
    .set({ stageResults: { ...results, memory: updatedMemory }, updatedAt: new Date() })
    .where(eq(launchProjectsTable.id, launchId));

  return NextResponse.json({ memory: updatedMemory });
}
