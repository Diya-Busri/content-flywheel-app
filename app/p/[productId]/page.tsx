import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/db/db";
import { podProductsTable } from "@/db/schema/pod-products-schema";
import { eq } from "drizzle-orm";
import { ExternalLink, Share2 } from "lucide-react";
import ShareButton from "./ShareButton";

type Props = {
  params: { productId: string };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [product] = await db
    .select()
    .from(podProductsTable)
    .where(eq(podProductsTable.id, params.productId))
    .limit(1);

  if (!product) {
    return { title: "Product not found" };
  }

  const imageUrl =
    (product.mockupUrls as string[] | null)?.[0] ?? product.designFileUrl ?? undefined;

  return {
    title: product.title,
    description: product.blueprintTitle
      ? `${product.title} — ${product.blueprintTitle}`
      : product.title,
    openGraph: {
      title: product.title,
      description: product.blueprintTitle ?? product.title,
      images: imageUrl ? [{ url: imageUrl }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: product.title,
      images: imageUrl ? [imageUrl] : [],
    },
  };
}

export default async function ProductLandingPage({ params }: Props) {
  const [product] = await db
    .select()
    .from(podProductsTable)
    .where(eq(podProductsTable.id, params.productId))
    .limit(1);

  if (!product) {
    notFound();
  }

  const mockups = (product.mockupUrls as string[] | null) ?? [];
  const printifyUrl = product.printifyProductId
    ? `https://printify.com/app/store/products/${product.printifyProductId}`
    : "https://printify.com";

  return (
    <div className="min-h-screen bg-white dark:bg-[#0F0F0F] text-gray-900 dark:text-white">
      {/* Top bar */}
      <header className="border-b border-gray-100 dark:border-[#1E1E1E] px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="text-sm font-semibold text-orange-500 tracking-wide">Merch Drop</span>
          <a
            href={printifyUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            Buy now <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          {/* Left: images */}
          <div>
            {mockups.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {mockups.map((url, i) => (
                  <div
                    key={i}
                    className={`overflow-hidden rounded-2xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-100 dark:border-[#2A2A2A] ${
                      i === 0 && mockups.length > 1 ? "col-span-2 aspect-[4/3]" : "aspect-square"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`${product.title} mockup ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            ) : product.designFileUrl ? (
              <div className="aspect-square rounded-2xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-100 dark:border-[#2A2A2A] overflow-hidden flex items-center justify-center p-12">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product.designFileUrl}
                  alt={product.title}
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="aspect-square rounded-2xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-100 dark:border-[#2A2A2A] flex items-center justify-center">
                <span className="text-gray-300 dark:text-gray-600 text-sm">No image available</span>
              </div>
            )}
          </div>

          {/* Right: details */}
          <div className="space-y-6">
            <div>
              {product.blueprintTitle && (
                <p className="text-xs font-semibold uppercase tracking-widest text-orange-500 mb-2">
                  {product.blueprintTitle}
                </p>
              )}
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white leading-tight">
                {product.title}
              </h1>
              {product.printProviderTitle && (
                <p className="text-sm text-gray-400 mt-2">by {product.printProviderTitle}</p>
              )}
            </div>

            {/* Status badge */}
            {product.printifyStatus === "synced" || product.printifyProductId ? (
              <div className="inline-flex items-center gap-1.5 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 text-xs font-semibold px-3 py-1.5 rounded-full border border-green-200 dark:border-green-900/40">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                Available now
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 text-xs font-semibold px-3 py-1.5 rounded-full border border-amber-200 dark:border-amber-900/40">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                Coming soon
              </div>
            )}

            {/* CTA */}
            <a
              href={printifyUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-4 rounded-2xl text-base transition-colors"
            >
              Buy on Printify <ExternalLink className="w-4 h-4" />
            </a>

            {/* Share section */}
            <div className="rounded-2xl border border-gray-100 dark:border-[#2A2A2A] p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Share2 className="w-4 h-4 text-gray-400" />
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Share this drop</p>
              </div>
              <ShareButton title={product.title} />
            </div>

            {/* Mockup count */}
            {mockups.length > 0 && (
              <p className="text-xs text-gray-400 text-center">
                {mockups.length} lifestyle photo{mockups.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 dark:border-[#1E1E1E] px-6 py-6 mt-12">
        <div className="max-w-5xl mx-auto text-center text-xs text-gray-400">
          Powered by{" "}
          <a href="https://printify.com" target="_blank" rel="noreferrer" className="text-orange-500 hover:underline">
            Printify
          </a>
        </div>
      </footer>
    </div>
  );
}
