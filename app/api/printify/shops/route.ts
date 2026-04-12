import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { userSettingsTable } from "@/db/schema/user-settings-schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { printifyFetch } from "@/lib/printify";
import { alertPrintifyError } from "@/lib/printify-alert";

/** GET — verify connection and return shops */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [settings] = await db
      .select({ printifyApiKey: userSettingsTable.printifyApiKey, printifyShopId: userSettingsTable.printifyShopId })
      .from(userSettingsTable)
      .where(eq(userSettingsTable.userId, userId))
      .limit(1);

    if (!settings?.printifyApiKey) {
      return NextResponse.json({ connected: false, shops: [] });
    }

    const shops = await printifyFetch("/shops.json", settings.printifyApiKey);
    return NextResponse.json({ connected: true, shops, selectedShopId: settings.printifyShopId });
  } catch (err) {
    console.error("[printify/shops] GET:", err);
    await alertPrintifyError({ route: "/api/printify/shops GET", message: err instanceof Error ? err.message : "Connection check failed", userId });
    return NextResponse.json({ connected: false, error: "Invalid API key or connection failed" });
  }
}

/** POST — save API key and selected shop */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { apiKey, shopId } = await req.json();
    if (!apiKey?.trim()) return NextResponse.json({ error: "API key required" }, { status: 400 });

    // Verify key works before saving
    const shops = await printifyFetch("/shops.json", apiKey.trim()) as Array<{ id: number | string; title?: string }>;

    // Auto-select first shop if none explicitly provided
    const resolvedShopId = shopId
      ? String(shopId)
      : (shops?.[0]?.id ? String(shops[0].id) : null);

    await db
      .insert(userSettingsTable)
      .values({ userId, printifyApiKey: apiKey.trim(), printifyShopId: resolvedShopId })
      .onConflictDoUpdate({
        target: userSettingsTable.userId,
        set: { printifyApiKey: apiKey.trim(), printifyShopId: resolvedShopId },
      });

    return NextResponse.json({ connected: true, shops });
  } catch (err) {
    console.error("[printify/shops] POST:", err);
    await alertPrintifyError({ route: "/api/printify/shops POST", message: err instanceof Error ? err.message : "Failed to connect Printify", userId });
    return NextResponse.json({ error: "Invalid API key or connection failed" }, { status: 400 });
  }
}
