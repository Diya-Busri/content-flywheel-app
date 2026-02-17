import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

/**
 * POST: Deprecated. Product-in-hand mode removed in favor of Shotstack (text + product image).
 * Returns 410 Gone.
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json(
    {
      error: "Product-in-hand preview is no longer available. Use Shotstack video mode instead (text + product image).",
    },
    { status: 410 }
  );
}
