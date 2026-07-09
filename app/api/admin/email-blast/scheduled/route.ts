import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/is-admin";
import { db } from "@/db/db";
import { scheduledBlastsTable } from "@/db/schema/scheduled-blasts-schema";
import { eq, desc } from "drizzle-orm";

// GET — list all scheduled blasts
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const blasts = await db
    .select()
    .from(scheduledBlastsTable)
    .orderBy(desc(scheduledBlastsTable.scheduledFor));

  return NextResponse.json({ blasts });
}

// POST — create a new scheduled blast
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    subject?: string;
    htmlBody?: string;
    audience?: string;
    targetEmail?: string;
    scheduledFor?: string;
  };

  const { subject, htmlBody, audience = "all", targetEmail, scheduledFor } = body;

  if (!subject || !htmlBody) return NextResponse.json({ error: "subject and htmlBody required" }, { status: 400 });
  if (!scheduledFor) return NextResponse.json({ error: "scheduledFor required" }, { status: 400 });
  if (audience === "specific" && !targetEmail) return NextResponse.json({ error: "targetEmail required for specific audience" }, { status: 400 });

  const scheduledDate = new Date(scheduledFor);
  if (isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
    return NextResponse.json({ error: "scheduledFor must be a future date" }, { status: 400 });
  }

  const [blast] = await db.insert(scheduledBlastsTable).values({
    subject,
    htmlBody,
    audience,
    targetEmail: audience === "specific" ? targetEmail : null,
    scheduledFor: scheduledDate,
    status: "pending",
  }).returning();

  return NextResponse.json({ blast });
}
