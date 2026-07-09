export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { toggleLikeRow } from "@/db/queries/academy-queries";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const res = await toggleLikeRow(params.id, userId);
    return NextResponse.json(res);
  } catch (e) {
    return NextResponse.json({ error: "Failed to toggle like" }, { status: 500 });
  }
}
