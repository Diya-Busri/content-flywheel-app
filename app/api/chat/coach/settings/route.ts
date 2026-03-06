import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { coachSettingsTable } from "@/db/schema/coach-settings-schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [row] = await db
      .select()
      .from(coachSettingsTable)
      .where(eq(coachSettingsTable.userId, userId))
      .limit(1);

    return NextResponse.json({
      memoryEnabled: row?.memoryEnabled ?? false,
      coachName: row?.coachName ?? "Coach",
      userName: row?.userName ?? "",
    });
  } catch (err) {
    console.error("[chat/coach/settings] GET", err);
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { memoryEnabled, coachName, userName } = body as {
      memoryEnabled?: boolean;
      coachName?: string;
      userName?: string;
    };

    const [existing] = await db
      .select()
      .from(coachSettingsTable)
      .where(eq(coachSettingsTable.userId, userId))
      .limit(1);

    const nextMemory = typeof memoryEnabled === "boolean" ? memoryEnabled : existing?.memoryEnabled ?? false;
    const nextCoachName = typeof coachName === "string" && coachName.trim() ? coachName.trim() : (existing?.coachName ?? "Coach");
    const nextUserName = typeof userName === "string" ? userName.trim() : (existing?.userName ?? "");

    if (existing) {
      await db
        .update(coachSettingsTable)
        .set({ memoryEnabled: nextMemory, coachName: nextCoachName, userName: nextUserName })
        .where(eq(coachSettingsTable.userId, userId));
    } else {
      await db.insert(coachSettingsTable).values({
        userId,
        memoryEnabled: nextMemory,
        coachName: nextCoachName,
        userName: nextUserName,
      });
    }

    return NextResponse.json({
      memoryEnabled: nextMemory,
      coachName: nextCoachName,
      userName: nextUserName,
    });
  } catch (err) {
    console.error("[chat/coach/settings] PUT", err);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
