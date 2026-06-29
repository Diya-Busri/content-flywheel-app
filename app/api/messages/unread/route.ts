import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUnreadCount } from "@/db/queries/messaging-queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ count: 0 });
  const count = await getUnreadCount(userId);
  return NextResponse.json({ count });
}
