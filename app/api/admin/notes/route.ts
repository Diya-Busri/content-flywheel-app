export const dynamic = "force-dynamic";
import { currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/db";
import { adminNotesTable } from "@/db/schema/admin-finances-schema";
import { desc, eq } from "drizzle-orm";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";

async function requireAdmin() {
  const user = await currentUser();
  if (!user) return null;
  const email = user.emailAddresses?.[0]?.emailAddress?.trim().toLowerCase() ?? "";
  return ADMIN_EMAIL && email === ADMIN_EMAIL ? user.id : null;
}

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const notes = await db.select().from(adminNotesTable).orderBy(desc(adminNotesTable.createdAt));
  return NextResponse.json(notes);
}

export async function POST(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { content, tag } = await req.json();
  if (!content?.trim()) return NextResponse.json({ error: "Missing content" }, { status: 400 });
  const [created] = await db
    .insert(adminNotesTable)
    .values({ content: content.trim(), tag: tag ?? "general" })
    .returning();
  return NextResponse.json(created, { status: 201 });
}
