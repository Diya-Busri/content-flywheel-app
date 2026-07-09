"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Package,
  BookOpen,
  ClipboardList,
  LayoutTemplate,
  Calendar,
  Loader2,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type Product = {
  id: string;
  title: string;
  format?: string;
};

const FORMAT_LABELS: Record<string, string> = {
  ebook: "Ebook",
  guide: "Guide",
  workbook: "Workbook",
  planner: "Planner",
  journal: "Journal",
  checklist: "Checklist Pack",
  course: "Course Outline",
  notion: "Notion Template",
  template: "Template",
  spreadsheet: "Spreadsheet Guide",
};

function FormatIcon({ format }: { format?: string }) {
  const f = (format ?? "").toLowerCase();
  const cls = "w-8 h-8 text-orange-400";
  if (f === "ebook" || f === "guide") return <BookOpen className={cls} />;
  if (f === "workbook" || f === "checklist") return <ClipboardList className={cls} />;
  if (f === "notion" || f === "template") return <LayoutTemplate className={cls} />;
  if (f === "planner" || f === "journal") return <Calendar className={cls} />;
  return <Package className={cls} />;
}

export default function SelectProductPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((data) => setProducts(Array.isArray(data.products) ? data.products : []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  const handleSelect = (productId: string) => {
    setSelecting(productId);
    router.push(`/dashboard/digital-products/scripts?productId=${productId}&from=video-flow`);
  };

  return (
    <main className="min-h-screen p-6 md:p-10 max-w-4xl mx-auto">

      {/* Back link */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-orange-500 dark:hover:text-orange-400 transition-colors mb-8"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to dashboard
      </Link>

      {/* Header */}
      <div className="mb-10">
        {/* Step pill */}
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-orange-500 bg-orange-500/10 rounded-full px-3 py-1 mb-4">
          <Video className="w-3.5 h-3.5" />
          Create Video
        </span>

        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Choose a product to create a video for
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          We&apos;ll generate scripts based on this product — pick the one you want to promote.
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-32 gap-3">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading your products…</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && products.length === 0 && (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="w-20 h-20 rounded-2xl bg-orange-500/10 flex items-center justify-center mb-5">
            <Package className="w-9 h-9 text-orange-400" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
            No products yet
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-7 max-w-xs">
            Create your first digital product and we&apos;ll generate video scripts for it automatically.
          </p>
          <Button
            asChild
            className="bg-orange-500 hover:bg-orange-600 text-white font-semibold h-11 px-6 gap-2"
          >
            <Link href="/dashboard/digital-products/create">
              Create Your First Product
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      )}

      {/* Product grid */}
      {!loading && products.length > 0 && (
        <>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-4 font-medium uppercase tracking-wide">
            {products.length} product{products.length !== 1 ? "s" : ""} available
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((product) => {
              const isSelecting = selecting === product.id;
              const formatLabel = product.format
                ? (FORMAT_LABELS[product.format] ?? product.format.charAt(0).toUpperCase() + product.format.slice(1))
                : null;

              return (
                <button
                  key={product.id}
                  type="button"
                  disabled={!!selecting}
                  onClick={() => handleSelect(product.id)}
                  className={[
                    "group relative flex flex-col text-left rounded-2xl border transition-all duration-200 overflow-hidden",
                    "bg-white dark:bg-[#1A1A1A]",
                    "border-[#E5E7EB] dark:border-[#2A2A2A]",
                    selecting
                      ? isSelecting
                        ? "border-orange-500 shadow-[0_0_0_2px_rgba(249,115,22,0.3)] scale-[1.01]"
                        : "opacity-50 cursor-not-allowed"
                      : "hover:border-orange-400 dark:hover:border-orange-500 hover:shadow-[0_4px_20px_rgba(249,115,22,0.15)] hover:scale-[1.02] cursor-pointer",
                  ].join(" ")}
                >
                  {/* Thumbnail area */}
                  <div className="w-full aspect-[4/3] bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/20 flex items-center justify-center relative">
                    <FormatIcon format={product.format} />

                    {/* Hover overlay arrow */}
                    {!selecting && (
                      <div className="absolute inset-0 flex items-center justify-center bg-orange-500/0 group-hover:bg-orange-500/8 transition-all duration-200">
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-orange-500 text-white rounded-full w-9 h-9 flex items-center justify-center shadow-lg">
                          <ArrowRight className="w-4 h-4" />
                        </span>
                      </div>
                    )}

                    {isSelecting && (
                      <div className="absolute inset-0 flex items-center justify-center bg-orange-500/10">
                        <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-4 flex flex-col gap-3 flex-1">
                    {/* Format badge */}
                    {formatLabel && (
                      <span className="inline-block self-start text-[10px] font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400 bg-orange-500/10 rounded-full px-2.5 py-0.5">
                        {formatLabel}
                      </span>
                    )}

                    {/* Title */}
                    <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug line-clamp-2 flex-1">
                      {product.title}
                    </p>

                    {/* CTA row */}
                    <div
                      className={[
                        "flex items-center justify-between mt-1 pt-3 border-t border-[#F3F4F6] dark:border-[#2A2A2A]",
                        "text-xs font-semibold",
                        selecting && !isSelecting
                          ? "text-gray-400"
                          : "text-orange-500 dark:text-orange-400 group-hover:text-orange-600",
                      ].join(" ")}
                    >
                      <span>{isSelecting ? "Opening…" : "Create Video →"}</span>
                      {isSelecting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all duration-150" />
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Bottom hint */}
          <p className="mt-8 text-center text-xs text-gray-400 dark:text-gray-600">
            Don&apos;t see the right product?{" "}
            <Link
              href="/dashboard/digital-products/create"
              className="text-orange-500 hover:text-orange-400 font-medium transition-colors"
            >
              Create a new one →
            </Link>
          </p>
        </>
      )}
    </main>
  );
}
