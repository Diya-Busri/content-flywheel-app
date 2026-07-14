import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getOrSeedSections, addCustomSection } from "@/lib/creator-hub";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sections = await getOrSeedSections(userId);
  return NextResponse.json({ sections });
}

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const section = await addCustomSection(userId);
  return NextResponse.json({ section });
}
