import { db } from "@/db/db";
import { productBundlesTable } from "@/db/schema/product-bundles-schema";
import { productsTable } from "@/db/schema/products-schema";
import { brandVoiceTable } from "@/db/schema/brand-voice-schema";
import { eq, and, inArray, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BundleBuyButton } from "./BundleBuyButton";

export const dynamic = "force-dynamic";

type MarketingAssets = {
  thumbnailUrl?: string | null;
  coverThumbnailUrl?: string | null;
  bookMockupUrl?: string | null;
  productDescription?: string;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const [bundle] = await db
    .select({ title: productBundlesTable.title, description: productBundlesTable.description })
    .from(productBundlesTable)
    .where(and(eq(productBundlesTable.id, id), eq(productBundlesTable.active, true)))
    .limit(1);

  if (!bundle) return { title: "Bundle not found" };
  return {
    title: `${bundle.title} — Bundle`,
    description: bundle.description ?? undefined,
  };
}

export default async function BundlePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ purchased?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const purchased = sp.purchased === "true";

  const [bundle] = await db
    .select()
    .from(productBundlesTable)
    .where(and(eq(productBundlesTable.id, id), eq(productBundlesTable.active, true)))
    .limit(1);

  if (!bundle) notFound();

  const products =
    bundle.productIds.length > 0
      ? await db
          .select({
            id: productsTable.id,
            title: productsTable.title,
            marketingAssets: productsTable.marketingAssets,
          })
          .from(productsTable)
          .where(and(inArray(productsTable.id, bundle.productIds), isNull(productsTable.deletedAt)))
      : [];

  const brandVoice = await db
    .select({ brandName: brandVoiceTable.brandName })
    .from(brandVoiceTable)
    .where(eq(brandVoiceTable.userId, bundle.creatorUserId))
    .limit(1)
    .then((r) => r[0])
    .catch(() => undefined);

  const creatorName = brandVoice?.brandName?.trim() || "Creator";
  const priceLabel = `£${(bundle.bundlePrice / 100).toFixed(2)}`;

  return (
    <div className="min-h-screen bg-[#0B0B0F] text-white">
      <div className="max-w-2xl mx-auto px-4 py-16">
        {/* Creator */}
        <p className="text-xs uppercase tracking-widest text-gray-500 mb-6 text-center">
          by {creatorName}
        </p>

        {/* Bundle header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-orange-500/15 border border-orange-500/30 rounded-full px-4 py-1.5 text-xs font-semibold text-orange-400 mb-4">
            Bundle — {products.length} products
          </div>
          <h1 className="text-4xl font-bold text-white mb-4 leading-tight">{bundle.title}</h1>
          {bundle.description && (
            <p className="text-base text-gray-400 leading-relaxed max-w-lg mx-auto">
              {bundle.description}
            </p>
          )}
        </div>

        {/* Purchase success */}
        {purchased && (
          <div className="mb-8 rounded-2xl bg-green-500/10 border border-green-500/20 p-5 text-center">
            <p className="text-green-400 font-semibold text-sm">
              🎉 Purchase complete! Check your email for download links.
            </p>
          </div>
        )}

        {/* Price + CTA */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-8 text-center mb-8">
          <p className="text-5xl font-bold text-orange-400 mb-2">{priceLabel}</p>
          <p className="text-sm text-gray-500 mb-6">One-time purchase — instant access to all {products.length} products</p>
          <BundleBuyButton bundleId={bundle.id} />
        </div>

        {/* Products included */}
        <div>
          <h2 className="text-xs uppercase tracking-widest text-gray-500 mb-4 font-semibold">
            What&apos;s included
          </h2>
          <div className="space-y-3">
            {products.map((product) => {
              const ma = (product.marketingAssets ?? {}) as MarketingAssets;
              const thumb = ma.bookMockupUrl ?? ma.coverThumbnailUrl ?? ma.thumbnailUrl;
              return (
                <div
                  key={product.id}
                  className="flex items-center gap-4 rounded-xl bg-white/5 border border-white/8 p-4"
                >
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumb}
                      alt={product.title}
                      className="w-12 h-12 rounded-lg object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
                      <span className="text-orange-400 text-lg">📦</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{product.title}</p>
                    {ma.productDescription && (
                      <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">
                        {ma.productDescription}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-green-400 font-medium shrink-0">Included ✓</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
