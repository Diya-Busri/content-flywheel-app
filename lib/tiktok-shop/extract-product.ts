import type { ProductDetails } from "./types";

/**
 * Extract product name/description from a product URL (e.g. TikTok Shop, Amazon).
 * Falls back to provided description if fetch fails or no URL.
 */
export async function extractProductDetails(
  productLink: string,
  productImage?: string,
  productDescription?: string
): Promise<ProductDetails> {
  console.log("[extract-product] Input:", {
    productLink,
    hasImage: !!productImage,
    hasDescription: !!productDescription,
  });

  if (productDescription?.trim()) {
    let name = "Product";
    try {
      if (productLink) name = new URL(productLink).pathname.split("/").filter(Boolean).pop() ?? name;
    } catch {
      // ignore invalid URL
    }
    console.log("[extract-product] Using provided description, name:", name);
    return {
      name: name.replace(/-/g, " "),
      description: productDescription.trim(),
      imageUrl: productImage?.trim() || undefined,
    };
  }

  if (!productLink?.trim()) {
    console.log("[extract-product] No link or description, using defaults");
    return {
      name: "Product",
      description: "Check out this product.",
      imageUrl: productImage?.trim() || undefined,
    };
  }

  try {
    const res = await fetch(productLink, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ContentFlywheel/1.0)" },
      signal: AbortSignal.timeout(8000),
    });
    const html = await res.text();

    const name = extractMeta(html, "og:title") ?? extractMeta(html, "twitter:title") ?? extractTitle(html) ?? "Product";
    const description =
      extractMeta(html, "og:description") ?? extractMeta(html, "twitter:description") ?? extractMeta(html, "description") ?? "Great product worth sharing.";
    const imageUrl =
      productImage?.trim() ||
      extractMeta(html, "og:image") ||
      extractMeta(html, "twitter:image") ||
      undefined;

    console.log("[extract-product] Extracted:", { name: name.slice(0, 50), descriptionLength: description.length });
    return { name, description, imageUrl };
  } catch (err) {
    console.error("[extract-product] Fetch error:", err);
    let fallbackName = "Product";
    try {
      fallbackName = new URL(productLink).pathname.split("/").filter(Boolean).pop() ?? fallbackName;
    } catch {
      // ignore
    }
    return {
      name: fallbackName.replace(/-/g, " "),
      description: productDescription?.trim() || "Amazing product you need to see.",
      imageUrl: productImage?.trim() || undefined,
    };
  }
}

function extractMeta(html: string, property: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property.replace(":", "\\:")}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property.replace(":", "\\:")}["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${property.replace(":", "\\:")}["'][^>]+content=["']([^"']+)["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m?.[1]?.trim() ?? null;
}
