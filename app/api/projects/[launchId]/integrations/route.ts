/**
 * GET/PATCH /api/projects/[launchId]/integrations
 * ──────────────────────────────────────────────────────────────────────────────
 * Reads and updates IntegrationSettings stored in stageResults.integrations.
 * Stores: analytics (PostHog, Plausible, GA), email (Resend, Brevo, Mailchimp),
 * and store (Stripe, LemonSqueezy, Gumroad) API key references.
 *
 * Note: API keys are stored in stageResults JSONB — for production use
 * consider encrypting at rest or using environment variables instead.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { launchProjectsTable } from "@/db/schema/launch-schema";
import { eq, and, ne } from "drizzle-orm";
import type { IntegrationSettings } from "@/db/schema/launch-schema";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { launchId: string } },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [project] = await db
    .select()
    .from(launchProjectsTable)
    .where(and(
      eq(launchProjectsTable.id,     params.launchId),
      eq(launchProjectsTable.userId, userId),
      ne(launchProjectsTable.status, "queued"),
    ));

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const results = (project.stageResults ?? {}) as Record<string, unknown>;
  const integrations = (results.integrations ?? {}) as IntegrationSettings;

  // Mask keys — return only whether each key is set, not the value itself
  return NextResponse.json({ integrations: maskKeys(integrations) });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { launchId: string } },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as Partial<IntegrationSettings>;

  const [project] = await db
    .select()
    .from(launchProjectsTable)
    .where(and(
      eq(launchProjectsTable.id,     params.launchId),
      eq(launchProjectsTable.userId, userId),
      ne(launchProjectsTable.status, "queued"),
    ));

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const results     = (project.stageResults ?? {}) as Record<string, unknown>;
  const existing    = (results.integrations ?? {}) as IntegrationSettings;
  const merged: IntegrationSettings = deepMerge(existing, body) as IntegrationSettings;

  await db
    .update(launchProjectsTable)
    .set({ stageResults: { ...results, integrations: merged } as unknown as typeof launchProjectsTable.$inferInsert["stageResults"] })
    .where(and(
      eq(launchProjectsTable.id,     params.launchId),
      eq(launchProjectsTable.userId, userId),
    ));

  return NextResponse.json({ integrations: maskKeys(merged) });
}

/* ─── Helpers ─────────────────────────────────────────────────────────────────── */

/** Replace key values with boolean indicators (true = set, false = not set). */
function maskKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = maskKeys(v as Record<string, unknown>);
    } else {
      out[k] = Boolean(v);
    }
  }
  return out;
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const out = { ...target };
  for (const [k, v] of Object.entries(source)) {
    if (v && typeof v === "object" && !Array.isArray(v) && typeof target[k] === "object") {
      out[k] = deepMerge(target[k] as Record<string, unknown>, v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}
