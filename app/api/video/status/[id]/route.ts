import { NextResponse } from "next/server";

/** Deprecated: Use Video Creation Guide flow. */
export async function GET() {
  return NextResponse.json(
    { status: "error", error: "Video rendering has been removed. Use the Video Creation Guide flow instead." },
    { status: 410 }
  );
}
