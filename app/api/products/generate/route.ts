import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { generateProduct, isValidProductType } from "@/lib/generators";
import type { ProductType, ProductDetails } from "@/lib/generators/types";

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const apiRl = await checkApiRateLimit(userId);
    if (apiRl) return apiRl;

    const body = await request.json();
    const { format, title, description, niche, sections } = body as {
      format?: string;
      title?: string;
      description?: string;
      niche?: string;
      sections?: Array<{ title: string; body: string }>;
    };

    if (!format || typeof format !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid format. Use: ebook, workbook, spreadsheet, notion, course, checklist." },
        { status: 400 }
      );
    }
    if (!isValidProductType(format)) {
      return NextResponse.json(
        { error: `Invalid format: "${format}". Must be one of: ebook, workbook, spreadsheet, notion, course, checklist.` },
        { status: 400 }
      );
    }

    const productDetails: ProductDetails = {
      title: title ?? "My Product",
      description,
      niche,
      sections,
    };

    const result = await generateProduct(format as ProductType, productDetails);

    if (format === "notion") {
      const notionResult = result as { markdown: string; csv: string; instructions: string };
      return NextResponse.json({
        success: true,
        format: "notion",
        type: "notion",
        markdown: notionResult.markdown,
        csv: notionResult.csv,
        instructions: notionResult.instructions,
      });
    }

    const buffer = result as ArrayBuffer;
    const base64 = Buffer.from(buffer).toString("base64");
    const mime =
      format === "spreadsheet"
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "application/pdf";

    return NextResponse.json({
      success: true,
      format,
      fileType: mime,
      content: base64,
    });
  } catch (err) {
    console.error("Product generation failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Product generation failed" },
      { status: 500 }
    );
  }
}
