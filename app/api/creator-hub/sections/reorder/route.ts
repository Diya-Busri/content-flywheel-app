import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { reorderSections } from "@/lib/creator-hub";

export async function PATCH(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const orderedIds: unknown = body.orderedIds;
  if (!Array.isArray(orderedIds) || !orderedIds.every((id) => typeof id === "string")) {
    return NextResponse.json({ error: "orderedIds must be a string array" }, { status: 400 });
  }

  await reorderSections(userId, orderedIds);
  return NextResponse.json({ ok: true });
}
