import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/is-admin";
import { getConversationById } from "@/db/queries/messaging-queries";
import { db } from "@/db/db";
import { messagesTable } from "@/db/schema/messaging-schema";
import { asc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// Admin-only read of a support conversation's messages (used for polling).
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const conversation = await getConversationById(params.id);
  if (!conversation || conversation.conversationType !== "support") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const messages = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, params.id))
    .orderBy(asc(messagesTable.createdAt));

  return NextResponse.json({ conversation, messages });
}
