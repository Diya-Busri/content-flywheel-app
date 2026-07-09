import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ userId });
  } catch (err) {
    console.error("my-id GET error:", err);
    return NextResponse.json({ error: "Failed to get user id" }, { status: 500 });
  }
}
