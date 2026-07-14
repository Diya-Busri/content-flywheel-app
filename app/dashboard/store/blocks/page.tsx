import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and, isNull } from "drizzle-orm";
import { getOrSeedSections } from "@/lib/creator-hub";
import { CreatorHubBlocksClient } from "./CreatorHubBlocksClient";

export const dynamic = "force-dynamic";

export default async function CreatorHubBlocksPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [sections, products] = await Promise.all([
    getOrSeedSections(userId),
    db
      .select({ id: productsTable.id, title: productsTable.title })
      .from(productsTable)
      .where(and(eq(productsTable.userId, userId), isNull(productsTable.deletedAt)))
      .limit(100),
  ]);

  return <CreatorHubBlocksClient userId={userId} initialSections={sections} products={products} />;
}
