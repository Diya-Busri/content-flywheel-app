import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/is-admin";
import { db } from "@/db/db";
import { featureFlagsTable } from "@/db/schema/feature-flags-schema";
import { eq, and, isNull } from "drizzle-orm";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const flags = await db.select().from(featureFlagsTable).orderBy(featureFlagsTable.key);
  return NextResponse.json({ flags });
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    key?: string; label?: string; description?: string; enabled?: boolean; userId?: string | null; rolloutPercentage?: number | null;
  };
  if (!body.key || !body.label) {
    return NextResponse.json({ error: "key and label required" }, { status: 400 });
  }
  // Rollout percentage only makes sense on a global flag — ignore it if a userId was given.
  const rolloutPercentage =
    !body.userId && typeof body.rolloutPercentage === "number"
      ? Math.max(0, Math.min(100, Math.round(body.rolloutPercentage)))
      : null;
  const [flag] = await db.insert(featureFlagsTable).values({
    key: body.key,
    label: body.label,
    description: body.description ?? null,
    enabled: body.enabled ?? false,
    userId: body.userId ?? null,
    rolloutPercentage,
  }).returning();
  return NextResponse.json({ flag });
}
