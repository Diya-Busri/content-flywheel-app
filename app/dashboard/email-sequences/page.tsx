import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db/db";
import { emailSequencesTable, emailSequenceStepsTable } from "@/db/schema/email-sequences-schema";
import { eq, desc, asc, sql } from "drizzle-orm";
import EmailSequencesClient from "./EmailSequencesClient";

export const metadata = { title: "Email Sequences | Content Flywheel" };

export default async function EmailSequencesPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const sequences = await db
    .select()
    .from(emailSequencesTable)
    .where(eq(emailSequencesTable.userId, userId))
    .orderBy(desc(emailSequencesTable.createdAt))
    .catch(() => []);

  const withSteps = await Promise.all(
    sequences.map(async (seq) => {
      const steps = await db
        .select()
        .from(emailSequenceStepsTable)
        .where(eq(emailSequenceStepsTable.sequenceId, seq.id))
        .orderBy(asc(emailSequenceStepsTable.stepNumber))
        .catch(() => []);
      return { ...seq, steps };
    })
  );

  return <EmailSequencesClient initialSequences={withSteps} />;
}
