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

const STYLE_MAP: Record<string, string> = {
  lifestyle: "natural daylight, urban street photography, candid lifestyle shot",
  studio:    "clean white studio background, professional product photography",
  outdoor:   "golden hour outdoor lighting, nature background, editorial fashion",
};

/**
 * Image-to-image mockup — uses the actual design as the reference image.
 * FLUX dev img2img carries the design colours/shapes into the lifestyle photo.
 */
async function generateImg2ImgMockup(
  designUrl: string,
  prompt: string,
  style: string
): Promise<string> {
  const lightingStyle = STYLE_MAP[style] ?? STYLE_MAP.lifestyle;
  const fullPrompt = `${prompt}. The design printed on the garment matches this graphic exactly — same colours, same artwork. ${lightingStyle}. Design is clearly visible on the front. Photorealistic, 8K, commercial product photography.`;

  const res = await fetch("https://fal.run/fal-ai/flux/dev/image-to-image", {
    method: "POST",
    headers: {
      Authorization: `Key ${FAL_API_KEY()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: fullPrompt,
      image_url: designUrl,
      strength: 0.85,           // high strength so the lifestyle context dominates but design colours/shapes carry through
      image_size: "portrait_4_3",
      num_inference_steps: 28,
      guidance_scale: 3.5,
      num_images: 1,
      enable_safety_checker: true,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`fal.ai img2img error: ${text.slice(0, 300)}`);
  }

  const data = await res.json() as { images?: Array<{ url: string }> };
  const url = data.images?.[0]?.url;
  if (!url) throw new Error("No image returned from img2img");
  return url;
}

/**
 * Text-only fallback — used when no design file is available yet.
 */
async function generateTextMockup(prompt: string, style: string): Promise<string> {
  const lightingStyle = STYLE_MAP[style] ?? STYLE_MAP.lifestyle;
  const fullPrompt = `High quality photo of ${prompt}. ${lightingStyle}. The design is clearly visible. Photorealistic, 8K quality, commercial product photography.`;

  const res = await fetch("https://fal.run/fal-ai/flux/schnell", {
    method: "POST",
    headers: {
      Authorization: `Key ${FAL_API_KEY()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: fullPrompt,
      image_size: "portrait_4_3",
      num_inference_steps: 4,
      num_images: 1,
      enable_safety_checker: true,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`fal.ai text mockup error: ${text.slice(0, 300)}`);
  }

  const data = await res.json() as { images?: Array<{ url: string }> };
  const url = data.images?.[0]?.url;
  if (!url) throw new Error("No image returned from text mockup");
  return url;
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
    const basePrompt = `${productContext}${brandContext}`;

    // Use img2img when we have the actual design file — this makes mockups show the real design
    let imageUrl: string;
    if (product.designFileUrl) {
      imageUrl = await generateImg2ImgMockup(product.designFileUrl, basePrompt, style);
    } else {
      imageUrl = await generateTextMockup(basePrompt, style);
    }

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
      .set({ mockupUrls: [...currentMockups, blob.url], aiMockupPrompt: basePrompt })
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
