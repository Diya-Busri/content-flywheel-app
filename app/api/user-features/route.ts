import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { profilesTable } from "@/db/schema/profiles-schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [row] = await db
      .select({ enabledFeatures: profilesTable.enabledFeatures })
      .from(profilesTable)
      .where(eq(profilesTable.userId, userId))
      .limit(1);

    const enabledFeatures: string[] | null = row?.enabledFeatures
      ? JSON.parse(row.enabledFeatures)
      : null;

    return NextResponse.json({ enabledFeatures });
  } catch {
    return NextResponse.json({ enabledFeatures: null });
  }
}

export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { enabledFeatures } = await req.json();

    await db
      .update(profilesTable)
      .set({ enabledFeatures: JSON.stringify(enabledFeatures) })
      .where(eq(profilesTable.userId, userId));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[user-features] PATCH:", err);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
