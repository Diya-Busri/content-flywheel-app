"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Icon } from "@iconify/react";
import { cleanMarkdownToHtml } from "@/lib/clean-markdown";
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  TEMPLATE_PRESETS,
  DEFAULT_IMAGE_SETTINGS,
  DEFAULT_OVERLAY,
  type TemplateId,
} from "@/lib/product-print-constants";
import { Star, Heart, Zap, Target, MessageCircle, Bookmark, Check, BookOpen } from "lucide-react";

const GRAPHICS_ICONS: { name: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> }[] = [
  { name: "Star", icon: Star },
  { name: "Heart", icon: Heart },
  { name: "Zap", icon: Zap },
  { name: "Target", icon: Target },
  { name: "MessageCircle", icon: MessageCircle },
  { name: "Bookmark", icon: Bookmark },
  { name: "Check", icon: Check },
  { name: "BookOpen", icon: BookOpen },
];

type Section = { id: string; title: string; content: string; contentHtml?: string };
type PageBackground = {
  backgroundImage?: string | null;
  backgroundSettings?: { opacity?: number; blur?: number; brightness?: number; contrast?: number; saturation?: number; fit?: string; position?: string };
  overlaySettings?: { color?: string; opacity?: number };
};
type PlacedElement = {
  id: string;
  type: "icon" | "image";
  content: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
  imageSettings?: { opacity?: number };
};

type ProductPrintPayload = {
  title: string;
  format?: string;
  sections: Section[];
  pageBackgrounds?: PageBackground[];
  placedElementsByPage?: PlacedElement[][];
  layoutSettings?: { margins?: number; paragraphSpacing?: number; sectionSpacing?: number; lineHeight?: number; alignment?: string; maxWidth?: string };
  template?: string;
  graphicsAccentColor?: string;
  designSettings?: {
    textStyles?: Record<string, Record<"title" | "body", { color?: string }>>;
  };
};

const STORAGE_KEY = "productPrintPayload";

function getMaxWidth(maxWidth?: string) {
  if (maxWidth === "narrow") return 600;
  if (maxWidth === "wide") return 1000;
  return 800;
}

function parsePlacedElements(arr: unknown[]): PlacedElement[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((item) => {
    const o = item as Record<string, unknown>;
    return {
      id: String(o.id ?? crypto.randomUUID()),
      type: (o.type === "image" ? "image" : "icon") as "icon" | "image",
      content: String(o.content ?? ""),
      position: (o.position as { x: number; y: number }) ?? { x: 0, y: 0 },
      size: (o.size as { width: number; height: number }) ?? { width: 60, height: 60 },
      zIndex: Number(o.zIndex ?? 1),
      imageSettings: (o.imageSettings as { opacity?: number }) ?? undefined,
    };
  });
}

function parseContentSections(content: unknown): Section[] {
  if (!content) return [];
  const parsed =
    typeof content === "string"
      ? (() => {
          try {
            return JSON.parse(content) as { sections?: Section[] };
          } catch {
            return {};
          }
        })()
      : (content as { sections?: Section[] });
  const sections = parsed?.sections;
  if (!Array.isArray(sections)) return [];
  return sections.map((s) => ({
    id: String(s.id ?? ""),
    title: String(s.title ?? ""),
    content: String(s.content ?? ""),
    contentHtml: s.contentHtml != null ? String(s.contentHtml) : undefined,
  }));
}

function productToPayload(product: Record<string, unknown>): ProductPrintPayload {
  const sections = parseContentSections(product.content);
  const ds = (product.designSettings ?? product.design_settings) as Record<string, unknown> | undefined;
  const template = (ds?.template as string) ?? "modern";
  const layout = (ds?.layout as Record<string, unknown>) ?? {};
  const colors = (ds?.colors as Record<string, string>) ?? {};
  const preset = TEMPLATE_PRESETS[(template as TemplateId) || "modern"] ?? TEMPLATE_PRESETS.modern;
  const graphicsAccentColor = colors?.graphics ?? preset?.titleColor ?? "#333333";

  const sectionsCount = Math.max(sections.length || 1, 1);
  const pages = ds?.pages as Array<Record<string, unknown>> | undefined;
  let pageBackgrounds: PageBackground[] = [];
  if (Array.isArray(pages) && pages.length >= sectionsCount) {
    pageBackgrounds = pages.slice(0, sectionsCount).map((p) => ({
      backgroundImage: (p?.backgroundImage ?? p?.background_image ?? null) as string | null,
      backgroundSettings: p?.backgroundSettings as PageBackground["backgroundSettings"],
      overlaySettings: p?.overlaySettings as PageBackground["overlaySettings"],
    }));
  } else {
    const legacyBg = (ds?.backgroundImage ?? ds?.background_image) as string | null;
    pageBackgrounds = Array.from({ length: sectionsCount }, (_, i) =>
      i === 0 && legacyBg
        ? {
            backgroundImage: legacyBg,
            backgroundSettings: ds?.backgroundSettings as PageBackground["backgroundSettings"],
            overlaySettings: ds?.overlaySettings as PageBackground["overlaySettings"],
          }
        : {}
    );
  }

  let placedElementsByPage: PlacedElement[][] = [];
  const byPage = ds?.placedElementsByPage as unknown[] | undefined;
  if (Array.isArray(byPage) && byPage.length > 0) {
    placedElementsByPage = byPage.map((pageArr) => (Array.isArray(pageArr) ? parsePlacedElements(pageArr) : []));
  } else {
    const legacy = parsePlacedElements((product.placedElements ?? product.placed_elements ?? []) as unknown[]);
    placedElementsByPage = legacy.length ? [legacy] : [[]];
  }

  return {
    title: (product.title as string) ?? "Product",
    format: (product.format as string) ?? "ebook",
    sections: sections.map((s) => ({ id: s.id, title: s.title, content: s.content ?? "", contentHtml: s.contentHtml })),
    pageBackgrounds: pageBackgrounds.length > 0 ? pageBackgrounds : undefined,
    placedElementsByPage: placedElementsByPage.some((arr) => arr.length > 0) ? placedElementsByPage : undefined,
    layoutSettings: {
      margins: layout.margins,
      paragraphSpacing: layout.paragraphSpacing,
      sectionSpacing: layout.sectionSpacing,
      lineHeight: layout.lineHeight,
      alignment: layout.alignment,
      maxWidth: layout.maxWidth,
    },
    template,
    graphicsAccentColor,
    designSettings: ds as ProductPrintPayload["designSettings"],
  };
}

export default function ProductPrintPage() {
  const params = useParams();
  const productId = params?.id as string;
  const [payload, setPayload] = useState<ProductPrintPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProduct() {
      try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (raw) {
          const data = JSON.parse(raw) as ProductPrintPayload;
          sessionStorage.removeItem(STORAGE_KEY);
          setPayload(data);
          return;
        }
        if (!productId) {
          setError("Product ID required.");
          return;
        }
        const res = await fetch(`/api/products/${productId}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError((body?.error as string) ?? "Failed to load product.");
          return;
        }
        const product = (await res.json()) as Record<string, unknown>;
        setPayload(productToPayload(product));
      } catch {
        setError("Failed to load print data.");
      }
    }
    loadProduct();
  }, [productId]);

  useEffect(() => {
    if (!payload) return;
    const t = setTimeout(() => {
      window.print();
      setTimeout(() => window.close(), 100);
    }, 500);
    return () => clearTimeout(t);
  }, [payload]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <p className="text-red-600">{error}</p>
        <button onClick={() => window.close()} className="ml-4 px-4 py-2 border rounded">
          Close
        </button>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  const { title, sections, pageBackgrounds = [], placedElementsByPage = [], layoutSettings = {}, template = "modern", graphicsAccentColor = "#333333", format = "ebook", designSettings = {} } = payload;
  const preset = TEMPLATE_PRESETS[(template as TemplateId) || "modern"] ?? TEMPLATE_PRESETS.modern;
  const layout = layoutSettings;
  const margins = layout.margins ?? 2;
  const maxWidth = getMaxWidth(layout.maxWidth);

  const previewLayoutStyle: React.CSSProperties = {
    fontFamily: preset.fontFamily,
    maxWidth,
    margin: "0 auto",
    padding: `${margins}rem`,
  };

  // One print page per product section (same as Full Product Preview modal)
  const pages = sections.length > 0 ? sections : [{ id: "1", title: title, content: "" }];

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            /* Screen: scrollable list of pages (match modal) */
            .print-content { padding: 24px; min-height: 100%; }
            .product-editor-preview-layout p { margin-bottom: ${layout.paragraphSpacing ?? 1}rem; line-height: ${layout.lineHeight ?? 1.6}; text-align: ${layout.alignment ?? "left"}; }
            .product-editor-preview-layout h2, .product-editor-preview-layout h3 { margin-top: ${(layout.sectionSpacing ?? 2) * 0.75}rem; margin-bottom: ${layout.paragraphSpacing ?? 1}rem; }
            /* Print: no scroll – each page is one sheet */
            @media print {
              .print-view-root { overflow: visible !important; height: auto !important; }
              .sidebar, .toolbar, .no-print, nav, button, [data-no-print] { display: none !important; }
              body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; margin: 0 !important; padding: 0 !important; background: #fff !important; }
              * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
              .print-content { padding: 0 !important; margin: 0 !important; overflow: visible !important; gap: 0 !important; }
              .print-page {
                page-break-after: always;
                page-break-inside: avoid;
                width: 100% !important;
                height: 100vh !important;
                min-height: 100vh !important;
                position: relative !important;
                overflow: hidden !important;
                box-shadow: none !important;
                border: none !important;
              }
              .print-page:last-child { page-break-after: auto; }
            }
            @page { margin: 0; size: 8.5in 11in; }
          `,
        }}
      />
      <div className="print-content flex flex-col items-center gap-6 print:block">
        {pages.map((section, pageIdx) => {
          const pageBg = pageBackgrounds[pageIdx];
          const bgUrl = pageBg?.backgroundImage ?? null;
          const bgSettings = pageBg?.backgroundSettings ? { ...DEFAULT_IMAGE_SETTINGS, ...pageBg.backgroundSettings } : DEFAULT_IMAGE_SETTINGS;
          const overlay = pageBg?.overlaySettings ? { ...DEFAULT_OVERLAY, ...pageBg.overlaySettings } : DEFAULT_OVERLAY;
          const titleStyles = designSettings.textStyles?.[section.id]?.title;
          const bodyStyles = designSettings.textStyles?.[section.id]?.body;

          return (
            <div
              key={section.id}
              className="print-page product-page page-section relative shrink-0 rounded-lg overflow-hidden border border-gray-200 bg-white shadow-lg"
              style={{ width: CANVAS_WIDTH, minHeight: CANVAS_HEIGHT }}
            >
              {bgUrl ? (
                <>
                  <div className="absolute inset-0 z-0" aria-hidden>
                    <img
                      src={bgUrl}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                      style={{
                        opacity: bgSettings.opacity ?? 1,
                        objectFit: (bgSettings.fit ?? "cover") as React.CSSProperties["objectFit"],
                        objectPosition: bgSettings.position ?? "center center",
                        filter: (bgSettings.blur ?? 0) > 0
                          ? `blur(${bgSettings.blur}px) brightness(${bgSettings.brightness ?? 100}%) contrast(${bgSettings.contrast ?? 100}%) saturate(${bgSettings.saturation ?? 100}%)`
                          : `brightness(${bgSettings.brightness ?? 100}%) contrast(${bgSettings.contrast ?? 100}%) saturate(${bgSettings.saturation ?? 100}%)`,
                      }}
                    />
                  </div>
                  <div className="absolute inset-0 z-[1] pointer-events-none" style={{ backgroundColor: overlay.color, opacity: overlay.opacity }} aria-hidden />
                </>
              ) : null}
              <div
                className={`relative z-10 product-editor-preview-layout ${format === "workbook" ? "format-workbook" : ""}`}
                style={{ ...previewLayoutStyle, ...(bgUrl ? { backgroundColor: "transparent" } : {}), minHeight: CANVAS_HEIGHT }}
              >
                <h2 className="text-2xl font-bold border-b pb-2" style={{ color: preset.titleColor }}>
                  {title}
                </h2>
                <section>
                  <h3 className="text-lg font-semibold" style={{ ...titleStyles, color: titleStyles?.color ?? preset.headingColor }}>
                    {section.title}
                  </h3>
                  <div
                    className="mt-2 prose prose-sm max-w-none prose-p:mb-4 prose-p:leading-relaxed prose-headings:mb-4 prose-headings:mt-6 prose-ul:mb-4 prose-ol:mb-4 prose-li:mb-2"
                    style={{ ...bodyStyles, color: bodyStyles?.color ?? preset.bodyColor }}
                  >
                    {section.content || section.contentHtml ? (
                      <div className="preview-content" dangerouslySetInnerHTML={{ __html: section.contentHtml ?? cleanMarkdownToHtml(section.content ?? "") }} />
                    ) : (
                      <span className="text-[#999]">(Empty)</span>
                    )}
                  </div>
                </section>
              </div>
              <div className="absolute inset-0 pointer-events-none z-20">
                {[...(placedElementsByPage[pageIdx] ?? [])]
                  .sort((a, b) => a.zIndex - b.zIndex)
                  .map((element) => {
                    const isIconify = element.type === "icon" && element.content.includes(":");
                    const LucideIcon = !isIconify && element.type === "icon" ? GRAPHICS_ICONS.find((i) => i.name === element.content)?.icon : null;
                    return (
                      <div
                        key={element.id}
                        className="absolute flex items-center justify-center"
                        style={{ left: element.position.x, top: element.position.y, width: element.size.width, height: element.size.height, zIndex: Math.max(1, element.zIndex) }}
                      >
                        {element.type === "icon" && isIconify ? (
                          <Icon icon={element.content} className="w-full h-full" style={{ color: graphicsAccentColor }} />
                        ) : element.type === "icon" && LucideIcon ? (
                          <LucideIcon className="w-full h-full" style={{ color: graphicsAccentColor }} />
                        ) : element.type === "image" ? (
                          <img
                            src={element.content}
                            alt=""
                            className="w-full h-full object-cover"
                            style={{
                              opacity: element.imageSettings?.opacity ?? 1,
                              filter: `blur(${element.imageSettings?.blur ?? 0}px) brightness(${element.imageSettings?.brightness ?? 100}%) contrast(${element.imageSettings?.contrast ?? 100}%) saturate(${element.imageSettings?.saturation ?? 100}%)`,
                            }}
                          />
                        ) : (
                          <span className="text-[#999] text-xs">?</span>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
