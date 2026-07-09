import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db/db";
import { productBundlesTable } from "@/db/schema/product-bundles-schema";
import { productsTable } from "@/db/schema/products-schema";
import { eq, isNull } from "drizzle-orm";
import { BundlesClient } from "./BundlesClient";

export const dynamic = "force-dynamic";

export default async function BundlesPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [bundles, publishedProducts] = await Promise.all([
    db
      .select()
      .from(productBundlesTable)
      .where(eq(productBundlesTable.creatorUserId, userId))
      .orderBy(productBundlesTable.createdAt),
    db
      .select({ id: productsTable.id, title: productsTable.title, marketingAssets: productsTable.marketingAssets })
      .from(productsTable)
      .where(eq(productsTable.userId, userId))
      .then((rows) =>
        rows.filter(
          (r) =>
            !r.marketingAssets ||
            (r.marketingAssets as { isNativePublished?: boolean }).isNativePublished === true
        )
      ),
  ]);

  return <BundlesClient bundles={bundles} publishedProducts={publishedProducts} />;
}
