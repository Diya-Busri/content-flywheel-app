import { z } from "zod";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import type { MarketingAssets } from "@/db/schema/products-schema";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { JarvisTool, ToolContext } from "../types";
import { ok, fail } from "../types";
import { productSummarySchema, type ProductSummary } from "./schemas";

const inputSchema = z
  .object({
    limit: z.number().int().min(1).max(50).optional(),
  })
  .strict();
type Input = z.infer<typeof inputSchema>;

type Output = { count: number; products: ProductSummary[] };

/**
 * Reads the authenticated user's non-deleted, non-archived products.
 * Ownership enforced via `eq(productsTable.userId, ctx.userId)` — the input
 * schema has no product id, so there is nothing a caller could use to
 * request another user's products.
 */
async function execute(ctx: ToolContext, input: Input) {
  try {
    const rows = await db
      .select()
      .from(productsTable)
      .where(
        and(
          eq(productsTable.userId, ctx.userId),
          isNull(productsTable.deletedAt),
          isNull(productsTable.archivedAt),
        ),
      )
      .orderBy(desc(productsTable.updatedAt))
      .limit(input.limit ?? 10);

    const products: ProductSummary[] = rows.map((p) => {
      const assets = (p.marketingAssets ?? {}) as MarketingAssets;
      const summary = {
        id: p.id,
        title: p.title,
        niche: p.niche,
        format: p.format,
        status: p.status,
        priceLabel: assets.priceLabel ?? null,
        isPublished: Boolean(assets.isNativePublished),
      };
      const parsed = productSummarySchema.safeParse(summary);
      // Should always succeed given the shape above; if not, fail loudly
      // rather than silently pass through malformed data.
      if (!parsed.success) throw new Error(`Invalid product summary for ${p.id}: ${parsed.error.message}`);
      return parsed.data;
    });

    return ok<Output>({ count: products.length, products });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Failed to read products");
  }
}

export const getProductDetailsTool: JarvisTool<Input, Output> = {
  name: "get_product_details",
  description: "Reads the user's active products (title, niche, format, price, publish status).",
  inputSchema,
  execute,
};
