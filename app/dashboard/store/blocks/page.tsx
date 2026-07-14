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

  try {
    const [sections, products] = await Promise.all([
      getOrSeedSections(userId),
      db
        .select({ id: productsTable.id, title: productsTable.title })
        .from(productsTable)
        .where(and(eq(productsTable.userId, userId), isNull(productsTable.deletedAt)))
        .limit(100),
    ]);

    return <CreatorHubBlocksClient userId={userId} initialSections={sections} products={products} />;
  } catch (err) {
    console.error("[creator-hub] Failed to load Page Builder:", err);
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 sm:px-6 text-center">
        <p className="text-2xl mb-3">🛠️</p>
        <h1 className="text-lg font-bold text-slate-900 mb-2">Page Builder is still being set up</h1>
        <p className="text-sm text-slate-500">
          This feature needs a one-time database update that hasn&apos;t run yet. If you&apos;re the site owner, run the pending migration and refresh this page.
        </p>
      </div>
    );
  }
}
