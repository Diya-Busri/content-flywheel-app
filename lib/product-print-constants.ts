/** Shared constants for product preview/print rendering. */

export type TemplateId = "modern" | "classic" | "minimal" | "bold" | "elegant" | "creative";

export const DEFAULT_IMAGE_SETTINGS = {
  opacity: 1,
  blur: 0,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  fit: "cover",
  position: "center center",
};

export const DEFAULT_OVERLAY = {
  color: "rgba(255, 255, 255, 0.9)",
  opacity: 0.9,
};

export const TEMPLATE_PRESETS: Record<
  TemplateId,
  { fontFamily: string; titleColor: string; headingColor: string; bodyColor: string }
> = {
  modern: { fontFamily: "Inter, system-ui, sans-serif", titleColor: "#FF6B35", headingColor: "#1a1a1a", bodyColor: "#4a4a4a" },
  classic: { fontFamily: "Georgia, 'Times New Roman', serif", titleColor: "#2c3e50", headingColor: "#2c3e50", bodyColor: "#34495e" },
  minimal: { fontFamily: "Inter, system-ui, sans-serif", titleColor: "#111827", headingColor: "#1f2937", bodyColor: "#6b7280" },
  bold: { fontFamily: "'DM Sans', Inter, sans-serif", titleColor: "#7C3AED", headingColor: "#1a1a1a", bodyColor: "#374151" },
  elegant: { fontFamily: "'Playfair Display', Georgia, serif", titleColor: "#6B4E71", headingColor: "#2d2d2d", bodyColor: "#5a5a5a" },
  creative: { fontFamily: "'Nunito', Inter, sans-serif", titleColor: "#EC4899", headingColor: "#1f2937", bodyColor: "#4b5563" },
};

export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 1100;
