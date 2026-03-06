import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and, isNull } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Product ID required" }, { status: 400 });
    }
    const [product] = await db
      .select()
      .from(productsTable)
      .where(and(eq(productsTable.id, id), eq(productsTable.userId, userId), isNull(productsTable.deletedAt)));
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    // Serialize explicitly so we always return JSON and never throw (e.g. BigInt/circular in content)
    let body: string;
    try {
      body = JSON.stringify(product);
    } catch (serialErr) {
      console.error("Product fetch: JSON serialize failed", serialErr);
      return NextResponse.json(
        { error: "Failed to serialize product" },
        { status: 500 }
      );
    }
    return new NextResponse(body, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Product fetch failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch product" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Product ID required" }, { status: 400 });
    }
    const body = await request.json().catch(() => ({}));
    const [updated] = await db
      .update(productsTable)
      .set({
        ...(body.content != null && { content: body.content }),
        ...(body.designSettings != null && { designSettings: body.designSettings }),
        ...(body.placedElements != null && { placedElements: body.placedElements }),
        ...(body.marketingAssets != null && { marketingAssets: body.marketingAssets }),
        updatedAt: new Date(),
      })
      .where(and(eq(productsTable.id, id), eq(productsTable.userId, userId), isNull(productsTable.deletedAt)))
      .returning();
    if (!updated) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (err) {
    console.error("Product update failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update product" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Product ID required" }, { status: 400 });
    }
    const permanent = new URL(request.url).searchParams.get("permanent") === "true";
    if (permanent) {
      await db
        .delete(productsTable)
        .where(and(eq(productsTable.id, id), eq(productsTable.userId, userId)));
    } else {
      const [updated] = await db
        .update(productsTable)
        .set({ deletedAt: new Date() })
        .where(and(eq(productsTable.id, id), eq(productsTable.userId, userId)))
        .returning();
      if (!updated) {
        return NextResponse.json({ error: "Product not found" }, { status: 404 });
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Product delete failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete product" },
      { status: 500 }
    );
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Product ID required" }, { status: 400 });
    }
    const [updated] = await db
      .update(productsTable)
      .set({ deletedAt: null })
      .where(and(eq(productsTable.id, id), eq(productsTable.userId, userId)))
      .returning();
    if (!updated) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (err) {
    console.error("Product restore failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to restore product" },
      { status: 500 }
    );
  }
}
