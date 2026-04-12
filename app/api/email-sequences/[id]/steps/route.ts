import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { emailSequencesTable, emailSequenceStepsTable } from "@/db/schema/email-sequences-schema";
import { and, eq, asc, sql } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const steps = await db
    .select()
    .from(emailSequenceStepsTable)
    .where(eq(emailSequenceStepsTable.sequenceId, id))
    .orderBy(asc(emailSequenceStepsTable.stepNumber));

  return NextResponse.json(steps);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Verify sequence ownership
  const [seq] = await db
    .select({ id: emailSequencesTable.id })
    .from(emailSequencesTable)
    .where(and(eq(emailSequencesTable.id, id), eq(emailSequencesTable.userId, userId)))
    .limit(1);

  if (!seq) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { delayDays, subject, body: emailBody } = body;

  if (!subject || !emailBody) {
    return NextResponse.json({ error: "subject and body are required" }, { status: 400 });
  }

  // Get max step number
  const [{ max }] = await db
    .select({ max: sql<number>`COALESCE(MAX(step_number), 0)::int` })
    .from(emailSequenceStepsTable)
    .where(eq(emailSequenceStepsTable.sequenceId, id));

  const [created] = await db
    .insert(emailSequenceStepsTable)
    .values({
      sequenceId: id,
      stepNumber: (max ?? 0) + 1,
      delayDays: delayDays ?? 0,
      subject,
      body: emailBody,
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { stepId } = body;

  if (!stepId) return NextResponse.json({ error: "stepId required" }, { status: 400 });

  // Verify ownership via sequence
  const [seq] = await db
    .select({ id: emailSequencesTable.id })
    .from(emailSequencesTable)
    .where(and(eq(emailSequencesTable.id, id), eq(emailSequencesTable.userId, userId)))
    .limit(1);

  if (!seq) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db
    .delete(emailSequenceStepsTable)
    .where(and(eq(emailSequenceStepsTable.id, stepId), eq(emailSequenceStepsTable.sequenceId, id)));

  return NextResponse.json({ ok: true });
}
