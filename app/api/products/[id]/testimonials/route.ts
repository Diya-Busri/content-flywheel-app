import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

type Testimonial = { name: string; text: string; rating?: number };

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { testimonials } = await request.json() as { testimonials: Testimonial[] };

  if (!Array.isArray(testimonials)) {
    return NextResponse.json({ error: "testimonials must be an array" }, { status: 400 });
  }

  const [product] = await db
    .select({ id: productsTable.id, marketingAssets: productsTable.marketingAssets })
    .from(productsTable)
    .where(and(eq(productsTable.id, params.id), eq(productsTable.userId, userId)))
    .limit(1);

  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await db
    .update(productsTable)
    .set({ marketingAssets: { ...(product.marketingAssets as object ?? {}), testimonials } })
    .where(eq(productsTable.id, params.id))
    .returning({ id: productsTable.id });

  return NextResponse.json({ success: true, id: updated[0]?.id });
}
