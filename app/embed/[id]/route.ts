import { NextResponse } from "next/server";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and, isNull } from "drizzle-orm";
import type { MarketingAssets } from "@/db/schema/products-schema";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://contentflywheel.co.uk";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: productId } = await params;

  const [product] = await db
    .select({ id: productsTable.id, title: productsTable.title, marketingAssets: productsTable.marketingAssets })
    .from(productsTable)
    .where(and(eq(productsTable.id, productId), isNull(productsTable.deletedAt)))
    .limit(1);

  if (!product) {
    return new NextResponse("// Product not found", {
      status: 404,
      headers: { "Content-Type": "application/javascript" },
    });
  }

  const ma = (product.marketingAssets ?? {}) as MarketingAssets & {
    isNativePublished?: boolean;
    nativePrice?: number;
    salePrice?: number;
    priceLabel?: string;
  };

  const label = ma.priceLabel
    ? `Buy Now – ${ma.priceLabel}`
    : "Buy Now";

  const productUrl = `${APP_URL}/product/${productId}`;

  // Generate a self-contained JS snippet
  const js = `
(function () {
  var s = document.currentScript;
  if (!s) return;

  var color = s.getAttribute('data-color') || '#f97316';
  var label = s.getAttribute('data-label') || ${JSON.stringify(label)};
  var url   = s.getAttribute('data-url')   || ${JSON.stringify(productUrl)};

  var a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.textContent = label;
  a.style.cssText = [
    'display:inline-block',
    'padding:14px 28px',
    'background:' + color,
    'color:#fff',
    'font-weight:700',
    'font-size:16px',
    'border-radius:12px',
    'text-decoration:none',
    'letter-spacing:-0.2px',
    'box-shadow:0 4px 20px ' + color + '55',
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
    'transition:opacity 0.15s',
    'cursor:pointer',
  ].join(';');
  a.addEventListener('mouseenter', function () { this.style.opacity = '0.88'; });
  a.addEventListener('mouseleave', function () { this.style.opacity = '1'; });

  s.parentNode.insertBefore(a, s.nextSibling);
})();
`.trim();

  return new NextResponse(js, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
