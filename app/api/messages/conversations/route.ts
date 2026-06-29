import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserConversations } from "@/db/queries/messaging-queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const conversations = await getUserConversations(userId);
  return NextResponse.json({ conversations });
}
