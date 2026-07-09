import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { creatorWebhooksTable } from "@/db/schema/creator-webhooks-schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const VALID_EVENTS = ["product_sold", "bundle_sold"] as const;

// GET — list webhooks for the logged-in creator
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hooks = await db
    .select()
    .from(creatorWebhooksTable)
    .where(and(eq(creatorWebhooksTable.userId, userId), eq(creatorWebhooksTable.active, true)));

  return NextResponse.json(hooks);
}

// POST — register a new webhook
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { url?: string; events?: string[] };

  const url = body.url?.trim();
  if (!url || !url.startsWith("https://")) {
    return NextResponse.json({ error: "A valid HTTPS URL is required" }, { status: 400 });
  }

  const events = (body.events ?? ["product_sold"])
    .filter((e) => VALID_EVENTS.includes(e as (typeof VALID_EVENTS)[number]))
    .join(",");

  if (!events) {
    return NextResponse.json({ error: "At least one valid event is required" }, { status: 400 });
  }

  // Max 5 webhooks per creator
  const existing = await db
    .select({ id: creatorWebhooksTable.id })
    .from(creatorWebhooksTable)
    .where(and(eq(creatorWebhooksTable.userId, userId), eq(creatorWebhooksTable.active, true)));

  if (existing.length >= 5) {
    return NextResponse.json({ error: "Maximum 5 webhooks per account" }, { status: 429 });
  }

  const secret = crypto.randomBytes(32).toString("hex");

  const [hook] = await db
    .insert(creatorWebhooksTable)
    .values({ userId, url, secret, events })
    .returning();

  return NextResponse.json(hook, { status: 201 });
}

// DELETE — deactivate a webhook
export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json().catch(() => ({})) as { id?: string };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await db
    .update(creatorWebhooksTable)
    .set({ active: false })
    .where(and(eq(creatorWebhooksTable.id, id), eq(creatorWebhooksTable.userId, userId)));

  return NextResponse.json({ success: true });
}
