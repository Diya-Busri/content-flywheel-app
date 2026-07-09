import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

/**
 * MVP: No database. Hardcoded mock data so Template Studio works without migrations.
 * No Supabase/DB imports or queries.
 */

const MOCK_SCENES = [
  { id: 1, sceneNumber: 1, dialogue: "", imagePrompt: "", imageUrl: null as string | null, motionPrompt: "" },
  { id: 2, sceneNumber: 2, dialogue: "", imagePrompt: "", imageUrl: null as string | null, motionPrompt: "" },
  { id: 3, sceneNumber: 3, dialogue: "", imagePrompt: "", imageUrl: null as string | null, motionPrompt: "" },
  { id: 4, sceneNumber: 4, dialogue: "", imagePrompt: "", imageUrl: null as string | null, motionPrompt: "" },
];

/**
 * GET: Return mock scene data (4 empty scenes) + default mode/inputs for client compatibility.
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({
      mode: "1",
      inputs: {},
      scenes: MOCK_SCENES,
    });
  } catch (e) {
    console.error("[template-studio/setup] GET auth error:", e);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

/**
 * POST: No-op for MVP; no DB. Returns success so client doesn't break.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await request.json().catch(() => ({}));
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[template-studio/setup] POST error:", e);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
