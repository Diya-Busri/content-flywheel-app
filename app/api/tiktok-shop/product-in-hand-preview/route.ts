import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateProductInHandImage } from "@/lib/tiktok-shop/generate-product-in-hand-image";

/** DALL-E 3 typically returns in ~30s. */
export const maxDuration = 90;

/**
 * POST: Generate a preview image for Product in hand mode.
 * Body: productName, productDescription (from breakdown)
 * Returns base64 data URL for display in modal.
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!process.env.OPENAI_API_KEY?.trim()) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not set. Product-in-hand preview requires DALL-E 3." },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { productName, productDescription, presenterStyle } = body as {
      productName?: string;
      productDescription?: string;
      presenterStyle?: string;
    };

    const name = typeof productName === "string" ? productName.trim() : "";
    if (!name) {
      return NextResponse.json(
        { error: "productName is required. Run product breakdown first." },
        { status: 400 }
      );
    }

    const validPresenterStyles = ["young-woman", "young-man", "middle-aged-woman", "middle-aged-man", "diverse"];
    const style = typeof presenterStyle === "string" && validPresenterStyles.includes(presenterStyle)
      ? presenterStyle as "young-woman" | "young-man" | "middle-aged-woman" | "middle-aged-man" | "diverse"
      : undefined;

    const imageBuffer = await generateProductInHandImage({
      productName: name,
      productDescription: typeof productDescription === "string" ? productDescription.trim() || undefined : undefined,
      presenterStyle: style,
    });

    const base64 = imageBuffer.toString("base64");
    const dataUrl = `data:image/png;base64,${base64}`;

    return NextResponse.json({ imageBase64: dataUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Preview image generation failed";
    console.error("[product-in-hand-preview] Error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
