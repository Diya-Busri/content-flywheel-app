export const dynamic = "force-dynamic";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { userSettingsTable } from "@/db/schema/user-settings-schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { printifyFetch } from "@/lib/printify";

// Popular clothing blueprint IDs to show first
const FEATURED_BLUEPRINT_IDS = new Set([5, 6, 9, 12, 77, 145, 366, 384]);

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [settings] = await db
      .select({ printifyApiKey: userSettingsTable.printifyApiKey })
      .from(userSettingsTable)
      .where(eq(userSettingsTable.userId, userId))
      .limit(1);

    if (!settings?.printifyApiKey) {
      return NextResponse.json({ error: "Printify not connected" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const blueprintId = searchParams.get("blueprintId");

    if (blueprintId) {
      const providerId = searchParams.get("providerId");

      if (providerId) {
        // Get variants for a specific blueprint + provider
        const variants = await printifyFetch(
          `/catalog/blueprints/${blueprintId}/print_providers/${providerId}/variants.json`,
          settings.printifyApiKey
        );
        return NextResponse.json({ variants });
      }

      // Get print providers for a specific blueprint
      const providers = await printifyFetch(
        `/catalog/blueprints/${blueprintId}/print_providers.json`,
        settings.printifyApiKey
      );
      return NextResponse.json({ providers });
    }

    // Return full catalog, sorted with featured items first
    const blueprints: Array<{ id: number; title: string; brand: string; images: string[] }> =
      await printifyFetch("/catalog/blueprints.json", settings.printifyApiKey);

    const sorted = [
      ...blueprints.filter((b) => FEATURED_BLUEPRINT_IDS.has(b.id)),
      ...blueprints.filter((b) => !FEATURED_BLUEPRINT_IDS.has(b.id)),
    ];

    return NextResponse.json({ blueprints: sorted.slice(0, 60) });
  } catch (err) {
    console.error("[printify/catalog] GET:", err);
    return NextResponse.json({ error: "Failed to fetch catalog" }, { status: 500 });
  }
}
