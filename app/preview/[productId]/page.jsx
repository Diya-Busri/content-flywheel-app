"use client";

import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import {
  Star,
  Heart,
  Zap,
  Target,
  MessageCircle,
  Bookmark,
  Check,
  BookOpen,
} from "lucide-react";
import { cleanMarkdownToHtml } from "@/lib/clean-markdown";

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 1100;

const DEFAULT_IMAGE_SETTINGS = {
  opacity: 1,
  blur: 0,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  fit: "cover",
  position: "center center",
};
const DEFAULT_OVERLAY = { color: "rgba(255, 255, 255, 0.9)", opacity: 0.9 };

const TEMPLATE_PRESETS = {
  modern: {
    fontFamily: "Inter, system-ui, sans-serif",
    titleColor: "#FF6B35",
    headingColor: "#1a1a1a",
    bodyColor: "#4a4a4a",
    layout: { paragraphSpacing: 1, lineHeight: 1.6, alignment: "left", margins: 2, sectionSpacing: 2, maxWidth: 800 },
  },
  classic: {
    fontFamily: "Georgia, 'Times New Roman', serif",
    titleColor: "#2c3e50",
    headingColor: "#2c3e50",
    bodyColor: "#34495e",
    layout: { paragraphSpacing: 1.25, lineHeight: 1.75, alignment: "left", margins: 2.5, sectionSpacing: 2.5, maxWidth: 600 },
  },
  minimal: {
    fontFamily: "Inter, system-ui, sans-serif",
    titleColor: "#111827",
    headingColor: "#1f2937",
    bodyColor: "#6b7280",
    layout: { paragraphSpacing: 1.5, lineHeight: 1.8, alignment: "left", margins: 3, sectionSpacing: 3, maxWidth: 600 },
  },
  bold: {
    fontFamily: "'DM Sans', Inter, sans-serif",
    titleColor: "#7C3AED",
    headingColor: "#1a1a1a",
    bodyColor: "#374151",
    layout: { paragraphSpacing: 1.2, lineHeight: 1.6, alignment: "left", margins: 2, sectionSpacing: 2, maxWidth: 1000 },
  },
  elegant: {
    fontFamily: "'Playfair Display', Georgia, serif",
    titleColor: "#6B4E71",
    headingColor: "#2d2d2d",
    bodyColor: "#5a5a5a",
    layout: { paragraphSpacing: 1.4, lineHeight: 1.8, alignment: "left", margins: 2.5, sectionSpacing: 2.5, maxWidth: 800 },
  },
  creative: {
    fontFamily: "'Nunito', Inter, sans-serif",
    titleColor: "#EC4899",
    headingColor: "#1f2937",
    bodyColor: "#4b5563",
    layout: { paragraphSpacing: 1.1, lineHeight: 1.65, alignment: "left", margins: 2, sectionSpacing: 1.8, maxWidth: 1000 },
  },
};

const GRAPHICS_ICONS = [
  { name: "Star", icon: Star },
  { name: "Heart", icon: Heart },
  { name: "Zap", icon: Zap },
  { name: "Target", icon: Target },
  { name: "MessageCircle", icon: MessageCircle },
  { name: "Bookmark", icon: Bookmark },
  { name: "Check", icon: Check },
  { name: "BookOpen", icon: BookOpen },
];

function parsePlacedElements(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (item) =>
        item != null &&
        typeof item === "object" &&
        typeof item.id === "string" &&
        typeof item.type === "string" &&
        typeof item.content === "string" &&
        item.position != null &&
        item.size != null
    )
    .map((item) => ({
      id: item.id,
      type: item.type === "image" ? "image" : "icon",
      content: item.content,
      position: { x: Number(item.position?.x) || 0, y: Number(item.position?.y) || 0 },
      size: { width: Number(item.size?.width) || 80, height: Number(item.size?.height) || 80 },
      zIndex: Number(item.zIndex) ?? 0,
      imageSettings: item.imageSettings,
    }));
}

function parsePageBackgrounds(ds, sectionsCount) {
  const legacyBg = ds?.backgroundImage ?? ds?.background_image ?? null;
  const pages = ds?.pages;
  if (Array.isArray(pages) && pages.length >= sectionsCount) {
    return pages.slice(0, sectionsCount).map((p) => ({
      backgroundImage: p?.backgroundImage ?? null,
      backgroundSettings: p?.backgroundSettings ? { ...DEFAULT_IMAGE_SETTINGS, ...p.backgroundSettings } : undefined,
      overlaySettings: p?.overlaySettings ? { ...DEFAULT_OVERLAY, ...p.overlaySettings } : undefined,
    }));
  }
  return Array.from({ length: sectionsCount }, (_, i) =>
    i === 0 && legacyBg
      ? {
          backgroundImage: legacyBg,
          backgroundSettings: ds?.backgroundSettings ? { ...DEFAULT_IMAGE_SETTINGS, ...ds.backgroundSettings } : undefined,
          overlaySettings: ds?.overlaySettings ? { ...DEFAULT_OVERLAY, ...ds.overlaySettings } : undefined,
        }
      : {}
  );
}

export default function PreviewPage({ params }) {
  const productId = params?.productId ?? "";
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!productId) {
      setError("Missing product ID");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/products/${productId}`);
        if (cancelled) return;
        if (!res.ok) {
          setError(res.status === 404 ? "Product not found" : "Failed to load");
          setLoading(false);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setProduct(data);
      } catch {
        if (!cancelled) setError("Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [productId]);

  if (loading) {
    return (
      <div style={{ width: CANVAS_WIDTH, margin: "0 auto", padding: 48, textAlign: "center", color: "#666" }}>
        Loading…
      </div>
    );
  }
  if (error || !product) {
    return (
      <div style={{ width: CANVAS_WIDTH, margin: "0 auto", padding: 48, textAlign: "center", color: "#999" }}>
        {error || "Product not found"}
      </div>
    );
  }

  const sections = product.content?.sections ?? [];
  const pageCount = Math.max(1, sections.length);
  const ds = product.designSettings ?? {};
  const templateId = ds.template ?? "modern";
  const preset = TEMPLATE_PRESETS[templateId] ?? TEMPLATE_PRESETS.modern;
  const layout = { ...preset.layout, ...ds.layout };
  const graphicsAccentColor = ds.colors?.graphics ?? preset.titleColor;
  const pageBackgrounds = parsePageBackgrounds(ds, pageCount);
  let placedElementsByPage = Array.isArray(ds.placedElementsByPage)
    ? ds.placedElementsByPage.map((pageArr) => (Array.isArray(pageArr) ? parsePlacedElements(pageArr) : []))
    : [];
  if (placedElementsByPage.length !== pageCount) {
    const legacy = parsePlacedElements(product.placedElements ?? []);
    placedElementsByPage = legacy.length ? [legacy] : Array.from({ length: pageCount }, () => []);
    while (placedElementsByPage.length < pageCount) placedElementsByPage.push([]);
    placedElementsByPage = placedElementsByPage.slice(0, pageCount);
  }

  const layoutStyle = {
    fontFamily: preset.fontFamily,
    maxWidth: layout.maxWidth ?? 800,
    margin: "0 auto",
    padding: `${layout.margins ?? 2}rem`,
    ["--paragraph-spacing"]: `${layout.paragraphSpacing ?? 1}rem`,
    ["--line-height"]: String(layout.lineHeight ?? 1.6),
    ["--text-align"]: layout.alignment ?? "left",
    ["--section-spacing"]: `${layout.sectionSpacing ?? 2}rem`,
  };

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @page { size: ${CANVAS_WIDTH}px ${CANVAS_HEIGHT}px; margin: 0; }
            .preview-product-page { page-break-after: always; page-break-inside: avoid; }
            .preview-product-page:last-child { page-break-after: auto; }
            .preview-layout p { margin-bottom: var(--paragraph-spacing, 1rem); line-height: var(--line-height, 1.6); text-align: var(--text-align, left); }
            .preview-layout h2 { margin-top: calc(var(--section-spacing, 2rem) * 1.5); margin-bottom: calc(var(--paragraph-spacing, 1rem) * 1.5); text-align: var(--text-align, left); }
            .preview-layout h3 { margin-top: calc(var(--section-spacing, 2rem) * 0.75); margin-bottom: calc(var(--paragraph-spacing, 1rem) * 0.75); text-align: var(--text-align, left); }
            .preview-layout section { margin-bottom: var(--section-spacing, 2rem); }
            .preview-layout ul, .preview-layout ol { margin-bottom: var(--paragraph-spacing, 1rem); padding-left: 1.5rem; text-align: var(--text-align, left); }
            .preview-layout li { margin-bottom: 0.5rem; }
          `,
        }}
      />
      <div style={{ margin: 0, padding: 0, background: "#f3f4f6", minHeight: "100vh" }}>
        {Array.from({ length: pageCount }, (_, pageIdx) => {
          const section = sections[pageIdx] ?? { id: `page-${pageIdx}`, title: "", content: "", contentHtml: "" };
          const pageBg = pageBackgrounds[pageIdx];
          const bgUrl = pageBg?.backgroundImage ?? null;
          const bgSettings = pageBg?.backgroundSettings ? { ...DEFAULT_IMAGE_SETTINGS, ...pageBg.backgroundSettings } : DEFAULT_IMAGE_SETTINGS;
          const overlay = pageBg?.overlaySettings ? { ...DEFAULT_OVERLAY, ...pageBg.overlaySettings } : DEFAULT_OVERLAY;
          const titleStyles = ds.textStyles?.[section.id]?.title ?? {};
          const bodyStyles = ds.textStyles?.[section.id]?.body ?? {};
          const elements = [...(placedElementsByPage[pageIdx] ?? [])].sort((a, b) => a.zIndex - b.zIndex);

          return (
            <div
              key={section.id}
              className="preview-product-page"
              style={{
                position: "relative",
                width: CANVAS_WIDTH,
                minHeight: CANVAS_HEIGHT,
                overflow: "hidden",
                backgroundColor: "#fff",
              }}
            >
              {bgUrl && (
                <>
                  <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
                    <img
                      src={bgUrl}
                      alt=""
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: bgSettings.fit,
                        objectPosition: bgSettings.position,
                        opacity: bgSettings.opacity,
                        filter:
                          (bgSettings.blur || 0) > 0
                            ? `blur(${bgSettings.blur}px) brightness(${bgSettings.brightness}%) contrast(${bgSettings.contrast}%) saturate(${bgSettings.saturation}%)`
                            : `brightness(${bgSettings.brightness}%) contrast(${bgSettings.contrast}%) saturate(${bgSettings.saturation}%)`,
                      }}
                    />
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      zIndex: 1,
                      backgroundColor: overlay.color,
                      opacity: overlay.opacity,
                      pointerEvents: "none",
                    }}
                  />
                </>
              )}
              <div
                className={`preview-layout ${product.format === "workbook" ? "format-workbook" : ""}`}
                style={{
                  ...layoutStyle,
                  position: "relative",
                  zIndex: 10,
                  minHeight: CANVAS_HEIGHT,
                  ...(bgUrl ? { backgroundColor: "transparent" } : {}),
                }}
              >
                <h2
                  style={{
                    fontSize: "1.5rem",
                    fontWeight: "bold",
                    borderBottom: "1px solid #e5e7eb",
                    paddingBottom: "0.5rem",
                    margin: "0 0 0.5rem",
                    color: preset.titleColor,
                  }}
                >
                  {product.title}
                </h2>
                <section>
                  <h3
                    style={{
                      fontSize: "1.125rem",
                      fontWeight: 600,
                      margin: "1rem 0 0.5rem",
                      color: titleStyles.color ?? preset.headingColor,
                      ...titleStyles,
                    }}
                  >
                    {section.title}
                  </h3>
                  <div
                    className="preview-content prose prose-sm max-w-none"
                    style={{
                      marginTop: "0.5rem",
                      color: bodyStyles.color ?? preset.bodyColor,
                      ...bodyStyles,
                    }}
                    dangerouslySetInnerHTML={{
                      __html: (section.contentHtml ?? cleanMarkdownToHtml(section.content ?? "")) || "<p>(Empty)</p>",
                    }}
                  />
                </section>
              </div>
              <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 20 }}>
                {elements.map((el) => {
                  const isIconify = el.type === "icon" && el.content.includes(":");
                  const LucideIcon = !isIconify && el.type === "icon" ? GRAPHICS_ICONS.find((i) => i.name === el.content)?.icon : null;
                  return (
                    <div
                      key={el.id}
                      style={{
                        position: "absolute",
                        left: el.position.x,
                        top: el.position.y,
                        width: el.size.width,
                        height: el.size.height,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: Math.max(1, el.zIndex),
                      }}
                    >
                      {el.type === "icon" && isIconify && (
                        <Icon icon={el.content} style={{ width: "100%", height: "100%", color: graphicsAccentColor }} />
                      )}
                      {el.type === "icon" && LucideIcon && (
                        <LucideIcon style={{ width: "100%", height: "100%", color: graphicsAccentColor }} />
                      )}
                      {el.type === "image" && el.content && (
                        <img
                          src={el.content}
                          alt=""
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            opacity: el.imageSettings?.opacity ?? 1,
                            filter: `blur(${el.imageSettings?.blur ?? 0}px) brightness(${el.imageSettings?.brightness ?? 100}%) contrast(${el.imageSettings?.contrast ?? 100}%) saturate(${el.imageSettings?.saturation ?? 100}%)`,
                          }}
                        />
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
