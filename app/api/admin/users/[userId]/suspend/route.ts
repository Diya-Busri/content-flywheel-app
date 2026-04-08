import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/is-admin";
import { db } from "@/db/db";
import { profilesTable } from "@/db/schema/profiles-schema";
import { eq } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = params;
  const body = (await req.json().catch(() => ({}))) as {
    suspend?: boolean;
    reason?: string;
  };
  const { suspend = true, reason } = body;

  const profile = await db.query.profilesTable.findFirst({
    where: eq(profilesTable.userId, userId),
  });
  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Use the existing `status` field: "suspended" | "active"
  await db
    .update(profilesTable)
    .set({ status: suspend ? "suspended" : "active" })
    .where(eq(profilesTable.userId, userId));

  return NextResponse.json({ success: true, suspended: suspend, reason: reason ?? null });
}
