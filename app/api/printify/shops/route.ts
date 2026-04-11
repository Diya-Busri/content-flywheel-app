import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { userSettingsTable } from "@/db/schema/user-settings-schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { printifyFetch } from "@/lib/printify";

/** GET — verify connection and return shops */
export async function GET() {
  const { userId } = auth();
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
    return NextResponse.json({ connected: false, error: "Invalid API key or connection failed" });
  }
}

/** POST — save API key and selected shop */
export async function POST(req: Request) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { apiKey, shopId } = await req.json();
    if (!apiKey?.trim()) return NextResponse.json({ error: "API key required" }, { status: 400 });

    // Verify key works before saving
    const shops = await printifyFetch("/shops.json", apiKey.trim());

    await db
      .insert(userSettingsTable)
      .values({ userId, printifyApiKey: apiKey.trim(), printifyShopId: shopId ? String(shopId) : null })
      .onConflictDoUpdate({
        target: userSettingsTable.userId,
        set: { printifyApiKey: apiKey.trim(), printifyShopId: shopId ? String(shopId) : null },
      });

    return NextResponse.json({ connected: true, shops });
  } catch (err) {
    console.error("[printify/shops] POST:", err);
    return NextResponse.json({ error: "Invalid API key or connection failed" }, { status: 400 });
  }
}
