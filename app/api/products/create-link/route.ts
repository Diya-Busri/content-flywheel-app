import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { markOnboardingStep } from "@/lib/onboarding-auto-complete";

export const dynamic = "force-dynamic";

/**
 * Creates a lightweight "link" product for the store — no upload, no AI
 * generation, just a title + external checkout URL (Gumroad, Etsy, Amazon,
 * Beacons, etc.) + a display price. Counts as "published" anywhere the app
 * checks `marketingAssets.checkoutUrl` (marketplace, creator page, trust
 * score, product page buy button), same as a manually-added checkout link.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const rawUrl = typeof body.url === "string" ? body.url.trim() : "";
    const free = body.free === true;
    const priceLabelInput = typeof body.priceLabel === "string" ? body.priceLabel.trim() : "";

    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
    if (!rawUrl) return NextResponse.json({ error: "Link URL is required" }, { status: 400 });

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      return NextResponse.json({ error: "Enter a valid URL, including https://" }, { status: 400 });
    }
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return NextResponse.json({ error: "Link must start with http:// or https://" }, { status: 400 });
    }

    const priceLabel = free ? "Free" : (priceLabelInput || null);

    const [product] = await db
      .insert(productsTable)
      .values({
        userId,
        title,
        niche: "External link",
        format: "link",
        content: { sections: [] },
        status: "complete",
        generationStatus: "complete",
        designSource: null,
        marketingAssets: {
          checkoutUrl: parsedUrl.toString(),
          priceLabel,
        },
      })
      .returning({ id: productsTable.id, title: productsTable.title });

    markOnboardingStep(userId, "firstProduct").catch(() => {});
    return NextResponse.json({ id: product.id, title: product.title }, { status: 201 });
  } catch (err) {
    console.error("[create-link] POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create product" },
      { status: 500 }
    );
  }
}
