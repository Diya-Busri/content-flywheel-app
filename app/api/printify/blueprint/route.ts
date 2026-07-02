export const dynamic = "force-dynamic";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { userSettingsTable } from "@/db/schema/user-settings-schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { printifyFetch } from "@/lib/printify";

/** GET /api/printify/blueprint?blueprintId=X — fetch images for a single blueprint */
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const blueprintId = searchParams.get("blueprintId");
    if (!blueprintId) return NextResponse.json({ error: "blueprintId required" }, { status: 400 });

    const [settings] = await db
      .select({ printifyApiKey: userSettingsTable.printifyApiKey })
      .from(userSettingsTable)
      .where(eq(userSettingsTable.userId, userId))
      .limit(1);

    if (!settings?.printifyApiKey) {
      return NextResponse.json({ error: "Printify not connected" }, { status: 400 });
    }

    const blueprint = await printifyFetch(
      `/catalog/blueprints/${blueprintId}.json`,
      settings.printifyApiKey
    ) as { id: number; title: string; images: string[] };

    return NextResponse.json({ images: blueprint.images ?? [] });
  } catch (err) {
    console.error("[printify/blueprint] GET:", err);
    return NextResponse.json({ error: "Failed to fetch blueprint" }, { status: 500 });
  }
}
