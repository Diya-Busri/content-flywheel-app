import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/is-admin";
import { db } from "@/db/db";
import { scheduledBlastsTable } from "@/db/schema/scheduled-blasts-schema";
import { eq } from "drizzle-orm";

// DELETE — cancel a scheduled blast
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [updated] = await db
    .update(scheduledBlastsTable)
    .set({ status: "cancelled" })
    .where(eq(scheduledBlastsTable.id, params.id))
    .returning();

  return NextResponse.json({ blast: updated });
}
