export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { emailContactsTable } from "@/db/schema/email-marketing-schema";
import { eq, and } from "drizzle-orm";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/email/contacts/import
 * Body: { contacts: Array<{ email: string; name?: string; tags?: string[] }> }
 * Inserts all valid contacts, skips duplicates. Returns { imported, skipped }.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const raw: { email?: string; name?: string; tags?: string[] }[] = Array.isArray(body.contacts)
      ? body.contacts
      : [];

    if (raw.length === 0) return NextResponse.json({ imported: 0, skipped: 0 });
    if (raw.length > 5000) return NextResponse.json({ error: "Max 5,000 contacts per import" }, { status: 400 });

    // Fetch existing emails for this user to skip duplicates efficiently
    const existing = await db
      .select({ email: emailContactsTable.email })
      .from(emailContactsTable)
      .where(eq(emailContactsTable.userId, userId));
    const existingEmails = new Set(existing.map((r) => r.email.toLowerCase()));

    let imported = 0;
    let skipped = 0;

    for (const row of raw) {
      const email = (row.email ?? "").toLowerCase().trim();
      if (!email || !EMAIL_RE.test(email) || existingEmails.has(email)) {
        skipped++;
        continue;
      }
      await db.insert(emailContactsTable).values({
        userId,
        email,
        name: row.name ? String(row.name).trim() || null : null,
        tags: Array.isArray(row.tags) ? row.tags.map(String).map((t) => t.trim()).filter(Boolean) : [],
      });
      existingEmails.add(email);
      imported++;
    }

    return NextResponse.json({ imported, skipped });
  } catch (err) {
    console.error("[contacts/import]", err);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
