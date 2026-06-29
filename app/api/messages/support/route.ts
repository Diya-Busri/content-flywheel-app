import { NextResponse } from "next/server";
import { startSupportConversationAction } from "@/actions/messaging-actions";

export const dynamic = "force-dynamic";

// POST and GET both get-or-create the current user's support conversation.
async function handle() {
  const res = await startSupportConversationAction();
  if (!res.isSuccess) return NextResponse.json({ error: res.message }, { status: 400 });
  return NextResponse.json({ conversation: res.data, conversationId: res.data?.id });
}

export async function POST() {
  return handle();
}

export async function GET() {
  return handle();
}
