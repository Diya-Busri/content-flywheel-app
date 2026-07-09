import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/is-admin";
import { db } from "@/db/db";
import { userFeedbackTable } from "@/db/schema/user-feedback-schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const feedback = await db.select().from(userFeedbackTable).orderBy(desc(userFeedbackTable.createdAt)).limit(200);
  return NextResponse.json({ feedback });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id, status } = (await req.json().catch(() => ({}))) as { id?: string; status?: string };
  if (!id || !status) return NextResponse.json({ error: "id and status required" }, { status: 400 });
  await db.update(userFeedbackTable).set({ status: status as "new" | "reviewed" | "actioned" }).where(eq(userFeedbackTable.id, id));
  return NextResponse.json({ ok: true });
}
