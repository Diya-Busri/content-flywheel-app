import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/is-admin";
import { getAllSupportConversations } from "@/db/queries/messaging-queries";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const conversations = await getAllSupportConversations();
  return NextResponse.json({ conversations });
}
