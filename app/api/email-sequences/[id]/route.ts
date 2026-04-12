import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { emailSequencesTable, emailSequenceStepsTable } from "@/db/schema/email-sequences-schema";
import { and, eq, asc } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [seq] = await db
    .select()
    .from(emailSequencesTable)
    .where(and(eq(emailSequencesTable.id, id), eq(emailSequencesTable.userId, userId)))
    .limit(1);

  if (!seq) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const steps = await db
    .select()
    .from(emailSequenceStepsTable)
    .where(eq(emailSequenceStepsTable.sequenceId, id))
    .orderBy(asc(emailSequenceStepsTable.stepNumber));

  return NextResponse.json({ ...seq, steps });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const updates: Record<string, unknown> = {};
  if (typeof body.name === "string") updates.name = body.name;
  if (typeof body.active === "boolean") updates.active = body.active;

  const [updated] = await db
    .update(emailSequencesTable)
    .set(updates)
    .where(and(eq(emailSequencesTable.id, id), eq(emailSequencesTable.userId, userId)))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Delete steps first
  await db.delete(emailSequenceStepsTable).where(eq(emailSequenceStepsTable.sequenceId, id));
  await db
    .delete(emailSequencesTable)
    .where(and(eq(emailSequencesTable.id, id), eq(emailSequencesTable.userId, userId)));

  return NextResponse.json({ ok: true });
}
