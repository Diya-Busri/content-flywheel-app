/**
 * REMOVED — the user feature selector has been removed from Settings.
 * This route is no longer called by any client code.
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ error: "Gone" }, { status: 410 });
}

export async function PATCH() {
  return NextResponse.json({ error: "Gone" }, { status: 410 });
}
