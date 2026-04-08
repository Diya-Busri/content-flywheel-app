import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/is-admin";
import { db } from "@/db/db";
import { profilesTable } from "@/db/schema/profiles-schema";
import { eq, gte, lt, and, isNotNull } from "drizzle-orm";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

function getAudienceFilter(audience: string) {
  const now = new Date();
  const day7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const day30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  switch (audience) {
    case "active7":
      return and(
        eq(profilesTable.membership, "pro"),
        gte(profilesTable.lastActiveAt, day7)
      );
    case "active30":
      return and(
        eq(profilesTable.membership, "pro"),
        gte(profilesTable.lastActiveAt, day30)
      );
    case "inactive30":
      return and(
        eq(profilesTable.membership, "pro"),
        lt(profilesTable.lastActiveAt, day30),
        isNotNull(profilesTable.lastActiveAt)
      );
    default:
      return eq(profilesTable.membership, "pro"); // all
  }
}

// GET — preview recipient count for a given audience
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const audience = searchParams.get("audience") ?? "all";

  const users = await db
    .select({ email: profilesTable.email })
    .from(profilesTable)
    .where(getAudienceFilter(audience));

  const emails = users.map((u) => u.email).filter(Boolean);
  return NextResponse.json({ count: emails.length, audience });
}

// POST — send the blast
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    subject?: string;
    htmlBody?: string;
    audience?: string;
    targetEmail?: string;
  };
  const { subject, htmlBody, audience = "all", targetEmail } = body;

  if (!subject || !htmlBody) {
    return NextResponse.json(
      { error: "subject and htmlBody are required" },
      { status: 400 }
    );
  }

  let emails: string[] = [];

  if (audience === "specific") {
    if (!targetEmail) return NextResponse.json({ error: "targetEmail required for specific audience" }, { status: 400 });
    emails = [targetEmail];
  } else {
    const users = await db
      .select({ email: profilesTable.email })
      .from(profilesTable)
      .where(getAudienceFilter(audience));
    emails = users.map((u) => u.email).filter(Boolean) as string[];
  }
  if (emails.length === 0) {
    return NextResponse.json({ sent: 0, errors: [] });
  }

  let sent = 0;
  const errors: string[] = [];
  const batchSize = 50;

  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);
    try {
      await resend.emails.send({
        from:
          process.env.RESEND_FROM_EMAIL ??
          "Content Flywheel <hello@contentflywheel.co.uk>",
        to: batch,
        subject,
        html: htmlBody,
      });
      sent += batch.length;
    } catch (e: unknown) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  return NextResponse.json({
    sent,
    total: emails.length,
    ...(errors.length > 0 ? { errors } : {}),
  });
}
