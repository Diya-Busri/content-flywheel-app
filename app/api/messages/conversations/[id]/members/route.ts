import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isParticipant, getGroupMembers } from "@/db/queries/messaging-queries";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Privacy: only participants can list members.
  if (!(await isParticipant(params.id, userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const members = await getGroupMembers(params.id);
  return NextResponse.json({
    members: members.map((m) => ({ userId: m.userId, userEmail: m.userEmail })),
  });
}
