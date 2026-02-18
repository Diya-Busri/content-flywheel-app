import { NextResponse } from "next/server";

/** Deprecated: Use Video Creation Guide. */
export async function POST() {
  return NextResponse.json(
    { error: "Video rendering has been removed. Use the Video Creation Guide flow instead." },
    { status: 410 }
  );
}
