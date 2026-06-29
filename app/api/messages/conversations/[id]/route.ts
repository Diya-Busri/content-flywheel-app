import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getConversationMessages, getConversationById, getConversationParticipants } from "@/db/queries/messaging-queries";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Privacy: getConversationMessages returns null if not a participant.
  const messages = await getConversationMessages(params.id, userId);
  if (messages === null) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const conversation = await getConversationById(params.id);
  const participants = await getConversationParticipants(params.id);
  const other = participants.find((p) => p.userId !== userId) ?? null;

  return NextResponse.json({
    conversation,
    messages,
    otherUserId: other?.userId ?? null,
    otherUserEmail: other?.userEmail ?? null,
  });
}
