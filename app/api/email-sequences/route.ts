import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { emailSequencesTable, emailSequenceStepsTable } from "@/db/schema/email-sequences-schema";
import { eq, desc, sql } from "drizzle-orm";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sequences = await db
    .select()
    .from(emailSequencesTable)
    .where(eq(emailSequencesTable.userId, userId))
    .orderBy(desc(emailSequencesTable.createdAt));

  // Get step counts
  const withCounts = await Promise.all(
    sequences.map(async (seq) => {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(emailSequenceStepsTable)
        .where(eq(emailSequenceStepsTable.sequenceId, seq.id));
      return { ...seq, stepCount: count ?? 0 };
    })
  );

  return NextResponse.json(withCounts);
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name } = body;

  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const [created] = await db
    .insert(emailSequencesTable)
    .values({ userId, name })
    .returning();

  return NextResponse.json({ ...created, stepCount: 0 }, { status: 201 });
}
