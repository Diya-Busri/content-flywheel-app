import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";

const BUNDLE_FORMATS: { format: string; label: string }[] = [
  { format: "ebook", label: "Ebook" },
  { format: "workbook", label: "Workbook" },
  { format: "planner", label: "Planner" },
  { format: "journal", label: "Journal" },
  { format: "checklist", label: "Checklist Pack" },
  { format: "course", label: "Course Outline" },
  { format: "notion", label: "Notion Template" },
  { format: "spreadsheet", label: "Spreadsheet Guide" },
];

const designSettings = {
  template: "modern",
  colors: { primary: "#FF6B35", secondary: "#004E89", accent: "#F7B32B" },
  typography: { heading: "Inter", body: "Open Sans", size: 16 },
};

/**
 * POST: Create 8 products (one per format) for the given niche/topic, trigger process for each, return IDs.
 * Client should poll each GET /api/products/[id] until status === "draft" and content is ready.
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const niche = (body.niche ?? body.topic ?? "").trim();
    if (!niche) {
      return NextResponse.json({ error: "niche or topic is required" }, { status: 400 });
    }

    const base =
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      (typeof request.url === "string" ? new URL(request.url).origin : null) ||
      "http://localhost:3000";

    const productIds: string[] = [];
    const items: { productId: string; format: string; label: string }[] = [];

    for (const { format, label } of BUNDLE_FORMATS) {
      const title = `${niche} - ${label}`;
      const [inserted] = await db
        .insert(productsTable)
        .values({
          userId,
          title,
          niche,
          format,
          content: { sections: [] },
          designSettings,
          placedElements: [],
          customizationOptions: null,
          status: "generating",
        })
        .returning({ id: productsTable.id });

      if (!inserted?.id) {
        console.error("[products/bundle] Failed to insert product for format:", format);
        continue;
      }

      productIds.push(inserted.id);
      items.push({ productId: inserted.id, format, label });

      const processBody = {
        niche,
        product: { name: title, included: "", why: "" },
        productName: title,
        format,
        hooks: [],
        ctas: [],
      };

      fetch(`${base}/api/products/${inserted.id}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(processBody),
      }).catch((e) => {
        console.error("[products/bundle] Failed to trigger process for", inserted.id, e);
      });
    }

    return NextResponse.json({ productIds, items, success: true });
  } catch (err) {
    console.error("[products/bundle] Failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create bundle" },
      { status: 500 }
    );
  }
}
