import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { generateProductContent } from "@/lib/generate-product-content";
import { cleanProductTitle } from "@/lib/product-title";

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const apiRl = await checkApiRateLimit(userId);
    if (apiRl) return apiRl;

    const body = await request.json().catch(() => ({}));
    const rawName = typeof body.productName === "string" ? body.productName.trim() : "";
    const productName = cleanProductTitle(rawName) || rawName;
    const productDescription = typeof body.productDescription === "string" ? body.productDescription : "";
    const productIncluded = typeof body.productIncluded === "string" ? body.productIncluded : "";
    const productWhy = typeof body.productWhy === "string" ? body.productWhy : "";
    const niche = typeof body.niche === "string" ? body.niche : "";
    const format = typeof body.format === "string" ? body.format : "ebook";
    const creatorExpertise = typeof body.creatorExpertise === "string" ? body.creatorExpertise : "";
    const hooks = Array.isArray(body.hooks) ? body.hooks : [];
    const ctas = Array.isArray(body.ctas) ? body.ctas : [];
    const hookTexts = hooks.map((h: string | { text?: string }) => (typeof h === "string" ? h : h?.text ?? ""));
    const ctaTexts = ctas.map((c: string | { text?: string }) => (typeof c === "string" ? c : c?.text ?? ""));

    if (!productName) {
      return NextResponse.json({ error: "productName is required" }, { status: 400 });
    }

    const sections = await generateProductContent({
      productName,
      productDescription,
      productIncluded,
      productWhy,
      niche,
      format,
      hookTexts: hookTexts.filter(Boolean),
      ctaTexts: ctaTexts.filter(Boolean),
      creatorExpertise: creatorExpertise || undefined,
    });

    return NextResponse.json({
      sections: sections.map((s) => ({ id: s.id, title: s.title, body: s.body })),
    });
  } catch (err) {
    console.error("Generate content failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate product content" },
      { status: 500 }
    );
  }
}
