import { currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/db";
import { adminFinanceNotesTable } from "@/db/schema/admin-finances-schema";
import { desc } from "drizzle-orm";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL?.trim().toLowerCase() ?? "";

async function requireAdmin() {
  const user = await currentUser();
  if (!user) return null;
  const email = user.emailAddresses?.[0]?.emailAddress?.trim().toLowerCase() ?? "";
  return ADMIN_EMAIL && email === ADMIN_EMAIL ? user.id : null;
}

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const notes = await db.select().from(adminFinanceNotesTable).orderBy(desc(adminFinanceNotesTable.createdAt));
  return NextResponse.json(notes);
}

export async function POST(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { content } = await req.json();
  if (!content?.trim()) return NextResponse.json({ error: "Missing content" }, { status: 400 });
  const [created] = await db.insert(adminFinanceNotesTable).values({ content: content.trim() }).returning();
  return NextResponse.json(created, { status: 201 });
}
