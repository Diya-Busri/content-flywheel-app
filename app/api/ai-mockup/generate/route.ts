import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { podProductsTable } from "@/db/schema/pod-products-schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import * as fal from "@fal-ai/serverless-client";
import { put } from "@vercel/blob";

fal.config({ credentials: process.env.FAL_API_KEY });

const PRODUCT_PROMPTS: Record<string, string> = {
  "t-shirt": "person wearing a custom printed t-shirt",
  "hoodie": "person wearing a custom printed hoodie",
  "sweatshirt": "person wearing a custom printed sweatshirt",
  "mug": "lifestyle photo of a custom printed ceramic mug on a wooden desk",
  "poster": "framed poster print on a modern apartment wall",
  "tote bag": "person carrying a custom printed canvas tote bag",
  "phone case": "person holding a smartphone with a custom printed case",
  default: "person wearing custom branded merchandise",
};

function getProductPrompt(blueprintTitle: string | null): string {
  if (!blueprintTitle) return PRODUCT_PROMPTS.default;
  const lower = blueprintTitle.toLowerCase();
  for (const [key, prompt] of Object.entries(PRODUCT_PROMPTS)) {
    if (lower.includes(key)) return prompt;
  }
  return PRODUCT_PROMPTS.default;
}

export async function POST(req: Request) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { productId, style = "lifestyle" } = await req.json();
    if (!productId) return NextResponse.json({ error: "productId required" }, { status: 400 });

    const [product] = await db
      .select()
      .from(podProductsTable)
      .where(and(eq(podProductsTable.id, productId), eq(podProductsTable.userId, userId)))
      .limit(1);

    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const productContext = getProductPrompt(product.blueprintTitle);
    const brandContext = product.title ? `, design themed around "${product.title}"` : "";

    const styleMap: Record<string, string> = {
      lifestyle: "natural daylight, urban street photography, candid lifestyle shot",
      studio: "clean white studio background, professional product photography",
      outdoor: "golden hour outdoor lighting, nature background, editorial fashion",
    };
    const lightingStyle = styleMap[style] ?? styleMap.lifestyle;

    const prompt = `High quality photo of a ${productContext}${brandContext}. ${lightingStyle}. The design is clearly visible. Photorealistic, 8K quality, commercial product photography.`;

    const result = await fal.subscribe("fal-ai/flux/dev", {
      input: {
        prompt,
        image_size: "portrait_4_3",
        num_inference_steps: 28,
        guidance_scale: 3.5,
        num_images: 1,
        enable_safety_checker: true,
      },
    }) as { images: Array<{ url: string }> };

    const imageUrl = result?.images?.[0]?.url;
    if (!imageUrl) throw new Error("No image generated");

    // Persist to Vercel Blob
    const imageRes = await fetch(imageUrl);
    const buffer = Buffer.from(await imageRes.arrayBuffer());
    const blob = await put(
      `pod-mockups/${userId}/${productId}/${Date.now()}.jpg`,
      buffer,
      { access: "public", contentType: "image/jpeg" }
    );

    // Append to product's mockupUrls
    const currentMockups = (product.mockupUrls as string[] | null) ?? [];
    await db
      .update(podProductsTable)
      .set({ mockupUrls: [...currentMockups, blob.url], aiMockupPrompt: prompt })
      .where(eq(podProductsTable.id, productId));

    return NextResponse.json({ mockupUrl: blob.url });
  } catch (err) {
    console.error("[ai-mockup/generate]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to generate mockup" }, { status: 500 });
  }
}
