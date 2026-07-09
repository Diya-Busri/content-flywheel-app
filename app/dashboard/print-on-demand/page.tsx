import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { podProductsTable } from "@/db/schema/pod-products-schema";
import { userSettingsTable } from "@/db/schema/user-settings-schema";
import { eq, isNull, and, desc } from "drizzle-orm";
import { PrintOnDemandClient } from "./PrintOnDemandClient";

export const metadata: Metadata = {
  title: "Print on Demand | Content Flywheel",
  description: "Create and sell custom clothing and merch with Printify",
};

export default async function PrintOnDemandPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const [settingsRow, products] = await Promise.all([
    db
      .select({ printifyApiKey: userSettingsTable.printifyApiKey, printifyShopId: userSettingsTable.printifyShopId })
      .from(userSettingsTable)
      .where(eq(userSettingsTable.userId, userId))
      .limit(1)
      .then((r) => r[0] ?? null),
    db
      .select()
      .from(podProductsTable)
      .where(and(eq(podProductsTable.userId, userId), isNull(podProductsTable.deletedAt)))
      .orderBy(desc(podProductsTable.createdAt)),
  ]);

  const isPrintifyConnected = !!settingsRow?.printifyApiKey;

  return (
    <PrintOnDemandClient
      isPrintifyConnected={isPrintifyConnected}
      initialProducts={products}
    />
  );
}
