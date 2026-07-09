export type ProductType =
  | "ebook"
  | "workbook"
  | "spreadsheet"
  | "notion"
  | "course"
  | "checklist";

export interface PageBackground {
  backgroundImage?: string | null;
  backgroundSettings?: { fit?: string; position?: string; opacity?: number; blur?: number };
  overlaySettings?: { color?: string; opacity?: number };
}

export interface ExportLayoutSettings {
  margins?: number;
  paragraphSpacing?: number;
  sectionSpacing?: number;
  maxWidth?: "narrow" | "normal" | "wide";
}

export interface ExportDesignSettings {
  template?: string;
  layout?: ExportLayoutSettings;
  colors?: { graphics?: string; title?: string; heading?: string; body?: string };
}

export interface PlacedElementExport {
  id: string;
  type: "icon" | "image";
  content: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  rotation?: number;
  zIndex?: number;
}

export interface ProductDetails {
  title: string;
  description?: string;
  niche?: string;
  sections?: Array<{ title: string; body: string }>;
  pageBackgrounds?: PageBackground[];
  designSettings?: ExportDesignSettings;
  placedElementsByPage?: PlacedElementExport[][];
}
