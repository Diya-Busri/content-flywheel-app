import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { podProductsTable } from "@/db/schema/pod-products-schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { put } from "@vercel/blob";

const FAL_API_KEY = () => {
  const key = process.env.FAL_API_KEY?.trim();
  if (!key) throw new Error("FAL_API_KEY is not set");
  return key;
};

// Order matters — more specific terms must come before generic ones
// e.g. "hooded sweatshirt" must match "hooded" before it falls through to "sweatshirt"
const PRODUCT_PROMPTS: Array<{ key: string; prompt: string }> = [
  { key: "hooded sweatshirt", prompt: "person wearing a custom printed pullover hoodie with hood up" },
  { key: "hoodie",            prompt: "person wearing a custom printed pullover hoodie with hood up" },
  { key: "zip",               prompt: "person wearing a custom printed zip-up hoodie" },
  { key: "t-shirt",           prompt: "person wearing a custom printed t-shirt" },
  { key: "tee",               prompt: "person wearing a custom printed t-shirt" },
  { key: "sweatshirt",        prompt: "person wearing a custom printed crewneck sweatshirt" },
  { key: "mug",               prompt: "lifestyle photo of a custom printed ceramic mug on a wooden desk" },
  { key: "poster",            prompt: "framed poster print on a modern apartment wall" },
  { key: "tote",              prompt: "person carrying a custom printed canvas tote bag" },
  { key: "phone case",        prompt: "person holding a smartphone with a custom printed case" },
  { key: "hat",               prompt: "person wearing a custom printed baseball cap" },
  { key: "cap",               prompt: "person wearing a custom printed baseball cap" },
];

function getProductPrompt(blueprintTitle: string | null): string {
  if (!blueprintTitle) return "person wearing custom branded merchandise";
  const lower = blueprintTitle.toLowerCase();
  for (const { key, prompt } of PRODUCT_PROMPTS) {
    if (lower.includes(key)) return prompt;
  }
  return "person wearing custom branded merchandise";
}

const MODEL_DESCRIPTORS = [
  "a young Black woman",
  "a young white man",
  "a young South Asian woman",
  "a young Latino man",
  "a young East Asian woman",
  "a young mixed-race man",
  "a young white woman",
  "a young Black man",
  "a young Middle Eastern woman",
  "a young South Asian man",
];

function randomModel(): string {
  return MODEL_DESCRIPTORS[Math.floor(Math.random() * MODEL_DESCRIPTORS.length)];
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { productId, style = "lifestyle" } = await req.json() as { productId?: string; style?: string };
    if (!productId) return NextResponse.json({ error: "productId required" }, { status: 400 });

    const [product] = await db
      .select()
      .from(podProductsTable)
      .where(and(eq(podProductsTable.id, productId), eq(podProductsTable.userId, userId)))
      .limit(1);

    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const model = randomModel();
    const productContext = getProductPrompt(product.blueprintTitle).replace("person", model);
    const brandContext = product.title ? `, design themed around "${product.title}"` : "";

    const styleMap: Record<string, string> = {
      lifestyle: "natural daylight, urban street photography, candid lifestyle shot",
      studio: "clean white studio background, professional product photography",
      outdoor: "golden hour outdoor lighting, nature background, editorial fashion",
    };
    const lightingStyle = styleMap[style] ?? styleMap.lifestyle;

    const prompt = `High quality photo of a ${productContext}${brandContext}. ${lightingStyle}. The design is clearly visible. Photorealistic, 8K quality, commercial product photography.`;

    // Use raw fetch — same pattern as the working ai-design/generate route
    const falRes = await fetch("https://fal.run/fal-ai/flux/schnell", {
      method: "POST",
      headers: {
        Authorization: `Key ${FAL_API_KEY()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        image_size: "portrait_4_3",
        num_inference_steps: 4,
        num_images: 1,
        enable_safety_checker: true,
      }),
    });

    if (!falRes.ok) {
      const text = await falRes.text();
      throw new Error(`fal.ai error: ${text.slice(0, 200)}`);
    }

    const falData = await falRes.json() as { images?: Array<{ url: string }> };
    const imageUrl = falData.images?.[0]?.url;
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
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate mockup" },
      { status: 500 }
    );
  }
}
