import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { emailContactsTable } from "@/db/schema/email-marketing-schema";
import { eq, desc, and } from "drizzle-orm";
import { isAdmin } from "@/lib/is-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!await isAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const contacts = await db
      .select()
      .from(emailContactsTable)
      .where(eq(emailContactsTable.userId, userId))
      .orderBy(desc(emailContactsTable.subscribedAt));

    return NextResponse.json(contacts);
  } catch (err) {
    console.error("Email contacts GET error:", err);
    return NextResponse.json({ error: "Failed to fetch contacts" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!await isAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const { email, name, tags } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    const existing = await db
      .select({ id: emailContactsTable.id })
      .from(emailContactsTable)
      .where(and(eq(emailContactsTable.userId, userId), eq(emailContactsTable.email, email.toLowerCase())))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json({ error: "Contact with this email already exists" }, { status: 409 });
    }

    const [contact] = await db
      .insert(emailContactsTable)
      .values({
        userId,
        email: email.toLowerCase().trim(),
        name: name ? String(name).trim() : null,
        tags: Array.isArray(tags) ? tags.map((t: string) => String(t).trim()).filter(Boolean) : [],
      })
      .returning();

    return NextResponse.json(contact, { status: 201 });
  } catch (err) {
    console.error("Email contacts POST error:", err);
    return NextResponse.json({ error: "Failed to create contact" }, { status: 500 });
  }
}
