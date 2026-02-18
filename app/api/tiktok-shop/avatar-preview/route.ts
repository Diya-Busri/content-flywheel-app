import { NextResponse } from "next/server";

const MESSAGE =
  "Preview rendering has been removed. Use Step 4: Video Creation Guides instead.";

/** Deprecated: Use Video Creation Guide flow. */
export async function POST() {
  return NextResponse.json({ error: MESSAGE }, { status: 410 });
}
