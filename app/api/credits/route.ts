import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getProfileByUserId } from "@/db/queries/profiles-queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const profile = await getProfileByUserId(userId);
  return NextResponse.json({ videoCredits: profile?.videoCredits ?? 0 });
}
