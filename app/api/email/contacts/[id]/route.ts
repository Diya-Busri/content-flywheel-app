import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { emailContactsTable } from "@/db/schema/email-marketing-schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = params;

    const deleted = await db
      .delete(emailContactsTable)
      .where(and(eq(emailContactsTable.id, id), eq(emailContactsTable.userId, userId)))
      .returning({ id: emailContactsTable.id });

    if (deleted.length === 0) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Email contact DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete contact" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = params;
    const body = await request.json();
    const { name, tags } = body;

    const updateData: Partial<{ name: string | null; tags: string[] }> = {};
    if (name !== undefined) updateData.name = name ? String(name).trim() : null;
    if (tags !== undefined) {
      updateData.tags = Array.isArray(tags)
        ? tags.map((t: string) => String(t).trim()).filter(Boolean)
        : [];
    }

    const [updated] = await db
      .update(emailContactsTable)
      .set(updateData)
      .where(and(eq(emailContactsTable.id, id), eq(emailContactsTable.userId, userId)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Email contact PATCH error:", err);
    return NextResponse.json({ error: "Failed to update contact" }, { status: 500 });
  }
}
