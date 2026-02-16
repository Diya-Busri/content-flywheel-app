"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Rnd } from "react-rnd";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Pencil,
  Loader2,
  Check,
  X,
  Plus,
  RefreshCw,
  BookOpen,
  Palette,
  FileOutput,
  Star,
  Heart,
  Zap,
  Target,
  MessageCircle,
  Bookmark,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  ImageIcon,
  Eye,
  LayoutGrid,
  Undo2,
  Redo2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Printer,
  Sparkles,
  Type,
} from "lucide-react";
import { Icon } from "@iconify/react";
import { HexColorPicker } from "react-colorful";
import { RichTextEditor } from "@/components/RichTextEditor";
import { cleanMarkdownToHtml } from "@/lib/clean-markdown";
import { useToast } from "@/components/ui/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";

type Section = { id: string; title: string; content: string; contentHtml?: string; order: number };

export type TextStyles = Record<string, string>;

type SelectedTextMeta = {
  sectionId: string;
  type: "title" | "body";
  content: string;
  styles: TextStyles;
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatLastSaved(date: Date): string {
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function rgbToHex(rgb: string): string {
  const m = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
  if (!m) return rgb.startsWith("#") ? rgb : "#333333";
  const hex = (x: number) => ("0" + Math.min(255, Math.max(0, x)).toString(16)).slice(-2);
  return "#" + hex(parseInt(m[1], 10)) + hex(parseInt(m[2], 10)) + hex(parseInt(m[3], 10));
}

const DEFAULT_TEXT_STYLES: TextStyles = {
  color: "#333333",
  fontSize: "16px",
  fontFamily: "Inter, sans-serif",
  fontWeight: "400",
  textAlign: "left",
  lineHeight: "1.6",
  textDecoration: "none",
  textTransform: "none",
  backgroundColor: "transparent",
};
export type ImageSettings = {
  opacity: number;
  blur: number;
  brightness: number;
  contrast: number;
  saturation: number;
  fit?: string;
  position?: string;
};

const DEFAULT_IMAGE_SETTINGS: ImageSettings = {
  opacity: 1,
  blur: 0,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  fit: "cover",
  position: "center center",
};

export type OverlaySettings = {
  color: string;
  opacity: number;
};

const DEFAULT_OVERLAY: OverlaySettings = {
  color: "rgba(255, 255, 255, 0.9)",
  opacity: 0.9,
};

const OVERLAY_PRESETS: Record<string, OverlaySettings> = {
  clean: { color: "rgba(255, 255, 255, 0.95)", opacity: 0.95 },
  dark: { color: "rgba(0, 0, 0, 0.75)", opacity: 0.75 },
  subtle: { color: "rgba(255, 255, 255, 0.5)", opacity: 0.5 },
  none: { color: "rgba(255, 255, 255, 0)", opacity: 0 },
};

export type PageBackground = {
  backgroundImage?: string | null;
  backgroundSettings?: ImageSettings;
  overlaySettings?: OverlaySettings;
};

type Product = {
  id: string;
  title: string;
  niche: string;
  format: string;
  content: { sections: Section[] };
  designSettings?: {
    template?: string;
    colors?: Record<string, string>;
    typography?: Record<string, unknown>;
    backgroundImage?: string;
    backgroundSettings?: ImageSettings;
    overlaySettings?: OverlaySettings;
    pages?: PageBackground[];
    textStyles?: Record<string, Record<"title" | "body", TextStyles>>;
  } | null;
  placedElements?: unknown[] | null;
};

export type TextBoxSettings = {
  fontSize: number;
  fontFamily: string;
  color: string;
  textAlign: "left" | "center" | "right";
};

const DEFAULT_TEXT_BOX: TextBoxSettings = {
  fontSize: 16,
  fontFamily: "Inter, system-ui, sans-serif",
  color: "#333333",
  textAlign: "left",
};

export type PlacedElement = {
  id: string;
  type: "icon" | "image" | "text";
  content: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  rotation: number;
  zIndex: number;
  imageSettings?: ImageSettings;
  textSettings?: TextBoxSettings;
};

type EditorSnapshot = {
  sections: Section[];
  placedElementsByPage: PlacedElement[][];
  pageBackgrounds: PageBackground[];
};

const HISTORY_LIMIT = 50;
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 1100;

// Legacy Lucide icons (by name) for backward compatibility with existing canvases
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

const ICON_CATEGORIES: Record<string, string[]> = {
  Business: [
    "mdi:briefcase",
    "mdi:chart-line",
    "mdi:handshake",
    "mdi:target",
    "mdi:lightbulb",
    "mdi:rocket",
    "mdi:trophy",
    "mdi:currency-usd",
    "mdi:office-building",
    "mdi:presentation",
    "mdi:calculator",
    "mdi:graph",
  ],
  "Love & Relationships": [
    "mdi:heart",
    "mdi:heart-pulse",
    "mdi:heart-multiple",
    "mdi:ring",
    "mdi:candle",
    "mdi:flower-tulip",
    "mdi:gift",
    "mdi:chat-heart",
    "mdi:calendar-heart",
    "mdi:hand-heart",
    "mdi:home-heart",
  ],
  Education: [
    "mdi:school",
    "mdi:book-open-page-variant",
    "mdi:pencil",
    "mdi:school-outline",
    "mdi:certificate",
    "mdi:library",
    "mdi:clipboard-text",
    "mdi:brain",
  ],
  "Health & Wellness": [
    "mdi:heart-pulse",
    "mdi:meditation",
    "mdi:yoga",
    "mdi:dumbbell",
    "mdi:hospital-building",
    "mdi:pill",
    "mdi:sleep",
    "mdi:water",
    "mdi:food-apple",
  ],
  Finance: [
    "mdi:cash",
    "mdi:piggy-bank",
    "mdi:bank",
    "mdi:credit-card",
    "mdi:chart-areaspline",
    "mdi:wallet",
    "mdi:receipt",
    "mdi:safe-square",
  ],
  Technology: [
    "mdi:laptop",
    "mdi:cellphone",
    "mdi:wifi",
    "mdi:cloud",
    "mdi:code-tags",
    "mdi:chip",
    "mdi:robot",
    "mdi:database",
  ],
  "Social Media": [
    "mdi:instagram",
    "mdi:facebook",
    "mdi:twitter",
    "mdi:youtube",
    "mdi:share-variant",
    "mdi:thumb-up",
    "mdi:comment",
    "mdi:video",
  ],
  "Arrows & Directions": [
    "mdi:arrow-right",
    "mdi:arrow-left",
    "mdi:arrow-up",
    "mdi:arrow-down",
    "mdi:chevron-right",
    "mdi:trending-up",
    "mdi:export",
    "mdi:swap-horizontal",
  ],
  Shapes: [
    "mdi:circle",
    "mdi:square",
    "mdi:triangle",
    "mdi:star",
    "mdi:hexagon",
    "mdi:rhombus",
    "mdi:decagram",
  ],
  "Checkmarks & Symbols": [
    "mdi:check",
    "mdi:check-circle",
    "mdi:close",
    "mdi:alert",
    "mdi:information",
    "mdi:help-circle",
    "mdi:plus",
    "mdi:minus",
  ],
};

const COLOR_PALETTES: Record<string, { name: string; colors: string[] }[]> = {
  Professional: [
    { name: "Corporate Blue", colors: ["#1E3A8A", "#3B82F6", "#93C5FD", "#DBEAFE"] },
    { name: "Business Gray", colors: ["#1F2937", "#4B5563", "#9CA3AF", "#E5E7EB"] },
    { name: "Executive Black", colors: ["#000000", "#374151", "#6B7280", "#D1D5DB"] },
  ],
  Vibrant: [
    { name: "Sunset", colors: ["#FF6B35", "#F7931E", "#FDC830", "#F37335"] },
    { name: "Ocean", colors: ["#667EEA", "#764BA2", "#F093FB", "#4FACFE"] },
    { name: "Forest", colors: ["#134E4A", "#059669", "#10B981", "#6EE7B7"] },
  ],
  Pastel: [
    { name: "Soft Pink", colors: ["#FEE2E2", "#FECACA", "#FCA5A5", "#F87171"] },
    { name: "Mint", colors: ["#D1FAE5", "#A7F3D0", "#6EE7B7", "#34D399"] },
    { name: "Lavender", colors: ["#E9D5FF", "#D8B4FE", "#C084FC", "#A855F7"] },
  ],
  Bold: [
    { name: "Fire", colors: ["#DC2626", "#EF4444", "#F87171", "#FCA5A5"] },
    { name: "Electric", colors: ["#7C3AED", "#8B5CF6", "#A78BFA", "#C4B5FD"] },
    { name: "Neon", colors: ["#EC4899", "#F472B6", "#FB7185", "#FBBF24"] },
  ],
};

const SHAPES: { name: string; svg: string }[] = [
  { name: "Circle", svg: '<circle cx="50" cy="50" r="40" />' },
  { name: "Square", svg: '<rect x="10" y="10" width="80" height="80" />' },
  { name: "Triangle", svg: '<polygon points="50,10 90,90 10,90" />' },
  { name: "Star", svg: '<polygon points="50,5 61,35 95,35 68,57 79,91 50,70 21,91 32,57 5,35 39,35" />' },
  { name: "Arrow Right", svg: '<path d="M10 50 L70 50 L60 40 M70 50 L60 60" stroke="currentColor" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' },
  { name: "Check", svg: '<path d="M20 50 L40 70 L80 20" stroke="currentColor" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' },
];

function parsePlacedElements(raw: unknown[] | null | undefined): PlacedElement[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (item): item is PlacedElement =>
        item != null &&
        typeof item === "object" &&
        typeof (item as PlacedElement).id === "string" &&
        typeof (item as PlacedElement).type === "string" &&
        typeof (item as PlacedElement).content === "string" &&
        (item as PlacedElement).position != null &&
        (item as PlacedElement).size != null
    )
    .map((item) => {
      const raw = item as PlacedElement & { imageSettings?: unknown; textSettings?: unknown };
      const imgSettings = raw.imageSettings && typeof raw.imageSettings === "object" ? raw.imageSettings as ImageSettings : undefined;
      const txtSettings = raw.textSettings && typeof raw.textSettings === "object" ? raw.textSettings as Partial<TextBoxSettings> : undefined;
      const type = raw.type === "text" ? "text" : raw.type === "image" ? "image" : "icon";
      const base = {
        id: raw.id,
        type,
        content: raw.content ?? "",
        position: { x: Number(raw.position?.x) || 0, y: Number(raw.position?.y) || 0 },
        size: {
          width: Number(raw.size?.width) || (type === "text" ? 200 : 80),
          height: Number(raw.size?.height) || (type === "text" ? 48 : 80),
        },
        rotation: Number(raw.rotation) || 0,
        zIndex: Number(raw.zIndex) ?? 0,
      };
      if (type === "text") {
        return { ...base, textSettings: { ...DEFAULT_TEXT_BOX, ...txtSettings } };
      }
      if (imgSettings) {
        return { ...base, imageSettings: { ...DEFAULT_IMAGE_SETTINGS, ...imgSettings } };
      }
      return base;
    });
}

const DEFAULT_LAYOUT = {
  paragraphSpacing: 1,
  lineHeight: 1.6,
  alignment: "left" as "left" | "center" | "justify",
  margins: 2,
  sectionSpacing: 2,
  maxWidth: "normal" as "narrow" | "normal" | "wide" | "full",
};

type LayoutOverrides = Partial<typeof DEFAULT_LAYOUT>;
type TemplateId = "modern" | "classic" | "minimal" | "bold" | "elegant" | "creative";

const TEMPLATE_PRESETS: Record<
  TemplateId,
  { layout: LayoutOverrides; accentColor: string; fontFamily: string; titleColor: string; headingColor: string; bodyColor: string }
> = {
  modern: {
    layout: { paragraphSpacing: 1, lineHeight: 1.6, alignment: "left", margins: 2, sectionSpacing: 2, maxWidth: "normal" },
    accentColor: "#FF6B35",
    fontFamily: "Inter, system-ui, sans-serif",
    titleColor: "#FF6B35",
    headingColor: "#1a1a1a",
    bodyColor: "#4a4a4a",
  },
  classic: {
    layout: { paragraphSpacing: 1.25, lineHeight: 1.75, alignment: "left", margins: 2.5, sectionSpacing: 2.5, maxWidth: "narrow" },
    accentColor: "#2c3e50",
    fontFamily: "Georgia, 'Times New Roman', serif",
    titleColor: "#2c3e50",
    headingColor: "#2c3e50",
    bodyColor: "#34495e",
  },
  minimal: {
    layout: { paragraphSpacing: 1.5, lineHeight: 1.8, alignment: "left", margins: 3, sectionSpacing: 3, maxWidth: "narrow" },
    accentColor: "#374151",
    fontFamily: "Inter, system-ui, sans-serif",
    titleColor: "#111827",
    headingColor: "#1f2937",
    bodyColor: "#6b7280",
  },
  bold: {
    layout: { paragraphSpacing: 1.2, lineHeight: 1.6, alignment: "left", margins: 2, sectionSpacing: 2, maxWidth: "wide" },
    accentColor: "#7C3AED",
    fontFamily: "'DM Sans', Inter, sans-serif",
    titleColor: "#7C3AED",
    headingColor: "#1a1a1a",
    bodyColor: "#374151",
  },
  elegant: {
    layout: { paragraphSpacing: 1.4, lineHeight: 1.8, alignment: "left", margins: 2.5, sectionSpacing: 2.5, maxWidth: "normal" },
    accentColor: "#6B4E71",
    fontFamily: "'Playfair Display', Georgia, serif",
    titleColor: "#6B4E71",
    headingColor: "#2d2d2d",
    bodyColor: "#5a5a5a",
  },
  creative: {
    layout: { paragraphSpacing: 1.1, lineHeight: 1.65, alignment: "left", margins: 2, sectionSpacing: 1.8, maxWidth: "wide" },
    accentColor: "#EC4899",
    fontFamily: "'Nunito', Inter, sans-serif",
    titleColor: "#EC4899",
    headingColor: "#1f2937",
    bodyColor: "#4b5563",
  },
};

const TEMPLATES = [
  { id: "modern" as TemplateId, label: "Modern", desc: "Clean and bold" },
  { id: "classic" as TemplateId, label: "Classic", desc: "Traditional layout" },
  { id: "minimal" as TemplateId, label: "Minimal", desc: "Lots of whitespace" },
  { id: "bold" as TemplateId, label: "Bold", desc: "Colorful, geometric" },
  { id: "elegant" as TemplateId, label: "Elegant", desc: "Refined typography" },
  { id: "creative" as TemplateId, label: "Creative", desc: "Playful and fun" },
];

export default function ProductEditor({ productId }: { productId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [template, setTemplate] = useState("modern");
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [, setSaveIndicatorTick] = useState(0);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [sectionToDeleteId, setSectionToDeleteId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showGenerateAIDialog, setShowGenerateAIDialog] = useState(false);
  const [generateAICustomType, setGenerateAICustomType] = useState("");
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [showFullPreview, setShowFullPreview] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [includeCover, setIncludeCover] = useState(true);
  const [includeBackPage, setIncludeBackPage] = useState(true);
  const [uiTheme, setUiTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("product-editor-theme") as "light" | "dark" | null;
      return stored === "dark" ? "dark" : "light";
    }
    return "light";
  });
  const [placedElementsByPage, setPlacedElementsByPage] = useState<PlacedElement[][]>([]);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [layoutSettings, setLayoutSettings] = useState(DEFAULT_LAYOUT);
  const [activeIconCategory, setActiveIconCategory] = useState<string>(Object.keys(ICON_CATEGORIES)[0] ?? "Business");
  const [iconSearch, setIconSearch] = useState("");
  const [activePaletteStyle, setActivePaletteStyle] = useState<string>(Object.keys(COLOR_PALETTES)[0] ?? "Professional");
  const [customColor, setCustomColor] = useState("#333333");
  const [graphicsAccentColor, setGraphicsAccentColor] = useState("#333333");
  const [photos, setPhotos] = useState<{ id: string; url?: string; fullUrl?: string; thumb?: string }[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [photoSearch, setPhotoSearch] = useState("");
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [backgroundSettings, setBackgroundSettings] = useState<ImageSettings>(DEFAULT_IMAGE_SETTINGS);
  const [overlaySettings, setOverlaySettings] = useState<OverlaySettings>(DEFAULT_OVERLAY);
  const [pageBackgrounds, setPageBackgrounds] = useState<PageBackground[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [imageSettings, setImageSettings] = useState<ImageSettings>(DEFAULT_IMAGE_SETTINGS);
  const selectedTextRef = useRef<HTMLElement | null>(null);
  const [selectedTextMeta, setSelectedTextMeta] = useState<SelectedTextMeta | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [undoStack, setUndoStack] = useState<EditorSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<EditorSnapshot[]>([]);
  const recordingRef = useRef(false);
  const recordUndoDebouncedRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentPageElements = useMemo(
    () => placedElementsByPage[currentPageIndex] ?? [],
    [placedElementsByPage, currentPageIndex]
  );

  const setCurrentPageElements = useCallback(
    (updater: (prev: PlacedElement[]) => PlacedElement[]) => {
      setPlacedElementsByPage((prev) => {
        const next = [...prev];
        while (next.length <= currentPageIndex) next.push([]);
        next[currentPageIndex] = updater(next[currentPageIndex] ?? []);
        return next;
      });
    },
    [currentPageIndex]
  );

  const updateLayout = useCallback(<K extends keyof typeof DEFAULT_LAYOUT>(key: K, value: (typeof DEFAULT_LAYOUT)[K]) => {
    setLayoutSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetLayout = useCallback(() => {
    setLayoutSettings({ ...DEFAULT_LAYOUT });
  }, []);

  const fetchProduct = useCallback(async () => {
    try {
      const res = await fetch(`/api/products/${productId}`);
      if (!res.ok) {
        if (res.status === 404) setError("Product not found");
        else setError("Failed to load product");
        setLoading(false);
        return;
      }
      const data = (await res.json()) as Product;
      setProduct(data);
      setSections(data.content?.sections ?? []);
      const savedTemplate = ((data.designSettings as { template?: string })?.template ?? "modern") as TemplateId;
      setTemplate(savedTemplate);
      const byPage = (data.designSettings as { placedElementsByPage?: unknown[] })?.placedElementsByPage;
      if (Array.isArray(byPage) && byPage.length > 0) {
        setPlacedElementsByPage(byPage.map((pageArr) => (Array.isArray(pageArr) ? parsePlacedElements(pageArr) : [])));
      } else {
        const legacy = parsePlacedElements(data.placedElements ?? []);
        setPlacedElementsByPage(legacy.length ? [legacy] : []);
      }
      const colors = (data.designSettings as { colors?: Record<string, string> })?.colors;
      const preset = TEMPLATE_PRESETS[savedTemplate] ?? TEMPLATE_PRESETS.modern;
      setGraphicsAccentColor(colors?.graphics ?? preset.accentColor);
      setCustomColor(colors?.graphics ?? preset.accentColor);
      setLayoutSettings((prev) => {
        const layoutFromDs = (data.designSettings as { layout?: LayoutOverrides })?.layout;
        if (layoutFromDs && typeof layoutFromDs === "object") {
          return { ...prev, ...layoutFromDs } as typeof prev;
        }
        return { ...prev, ...preset.layout } as typeof prev;
      });
      const rawDs = data.designSettings ?? (data as { design_settings?: unknown }).design_settings;
      const ds = rawDs as {
        backgroundImage?: string;
        background_image?: string;
        backgroundSettings?: ImageSettings;
        overlaySettings?: OverlaySettings;
        pages?: PageBackground[];
      } | undefined;
      const sectionsCount = (data.content?.sections ?? []).length || 1;
      const legacyBgUrl = ds?.backgroundImage ?? ds?.background_image ?? null;
      let pages: PageBackground[];
      if (Array.isArray(ds?.pages) && ds.pages.length >= sectionsCount) {
        pages = ds.pages.slice(0, sectionsCount).map((p) => ({
          backgroundImage: p?.backgroundImage ?? null,
          backgroundSettings: p?.backgroundSettings ? { ...DEFAULT_IMAGE_SETTINGS, ...p.backgroundSettings } : undefined,
          overlaySettings: p?.overlaySettings ? { ...DEFAULT_OVERLAY, ...p.overlaySettings } : undefined,
        }));
      } else {
        pages = Array.from({ length: sectionsCount }, (_, i) =>
          i === 0 && legacyBgUrl
            ? {
                backgroundImage: legacyBgUrl,
                backgroundSettings: ds?.backgroundSettings ? { ...DEFAULT_IMAGE_SETTINGS, ...ds.backgroundSettings } : undefined,
                overlaySettings: ds?.overlaySettings ? { ...DEFAULT_OVERLAY, ...ds.overlaySettings } : undefined,
              }
            : {}
        );
      }
      setPageBackgrounds(pages);
      setCurrentPageIndex(0);
      setUndoStack([]);
      setRedoStack([]);
      const first = pages[0];
      setBackgroundImage(first?.backgroundImage ?? null);
      setBackgroundSettings(first?.backgroundSettings ? { ...DEFAULT_IMAGE_SETTINGS, ...first.backgroundSettings } : DEFAULT_IMAGE_SETTINGS);
      setOverlaySettings(first?.overlaySettings ? { ...DEFAULT_OVERLAY, ...first.overlaySettings } : DEFAULT_OVERLAY);
    } catch {
      setError("Failed to load product");
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  useEffect(() => {
    setPageBackgrounds((prev) => {
      const need = sections.length || 1;
      if (prev.length === need) return prev;
      const next = [...prev];
      while (next.length < need) next.push({});
      return next.slice(0, need);
    });
  }, [sections.length]);

  useEffect(() => {
    setPlacedElementsByPage((prev) => {
      const need = sections.length || 1;
      if (prev.length === need) return prev;
      const next = [...prev];
      while (next.length < need) next.push([]);
      return next.slice(0, need);
    });
  }, [sections.length]);

  useEffect(() => {
    const safeIndex = Math.min(currentPageIndex, Math.max(0, pageBackgrounds.length - 1));
    if (safeIndex !== currentPageIndex) setCurrentPageIndex(safeIndex);
  }, [currentPageIndex, pageBackgrounds.length]);

  useEffect(() => {
    const page = pageBackgrounds[currentPageIndex];
    setBackgroundImage(page?.backgroundImage ?? null);
    setBackgroundSettings(page?.backgroundSettings ? { ...DEFAULT_IMAGE_SETTINGS, ...page.backgroundSettings } : DEFAULT_IMAGE_SETTINGS);
    setOverlaySettings(page?.overlaySettings ? { ...DEFAULT_OVERLAY, ...page.overlaySettings } : DEFAULT_OVERLAY);
  }, [currentPageIndex, pageBackgrounds]);

  const persistCurrentPageBackground = useCallback((updates: Partial<PageBackground>) => {
    setPageBackgrounds((prev) => {
      const next = [...prev];
      while (next.length <= currentPageIndex) next.push({});
      next[currentPageIndex] = { ...next[currentPageIndex], ...updates };
      return next;
    });
  }, [currentPageIndex]);

  const snapshot = useCallback(
    (): EditorSnapshot => ({
      sections: sections.map((s) => ({ ...s })),
      placedElementsByPage: placedElementsByPage.map((pageArr) => pageArr.map((e) => ({ ...e }))),
      pageBackgrounds: pageBackgrounds.map((p) => ({ ...p })),
    }),
    [sections, placedElementsByPage, pageBackgrounds]
  );

  const recordUndo = useCallback(
    (immediate = true) => {
      if (recordingRef.current) return;
      const snap = snapshot();
      setUndoStack((prev) => {
        const next = [...prev, snap].slice(-HISTORY_LIMIT);
        return next;
      });
      setRedoStack([]);
    },
    [snapshot]
  );

  const recordUndoDebounced = useCallback(() => {
    if (recordingRef.current) return;
    if (recordUndoDebouncedRef.current) clearTimeout(recordUndoDebouncedRef.current);
    const snap = snapshot();
    recordUndoDebouncedRef.current = setTimeout(() => {
      recordUndoDebouncedRef.current = null;
      if (recordingRef.current) return;
      setUndoStack((prev) => [...prev, snap].slice(-HISTORY_LIMIT));
      setRedoStack([]);
    }, 400);
  }, [snapshot]);

  const applySnapshot = useCallback(
    (snap: EditorSnapshot) => {
      setSections(snap.sections);
      setPlacedElementsByPage(snap.placedElementsByPage);
      setPageBackgrounds(snap.pageBackgrounds);
      const page = snap.pageBackgrounds[Math.min(currentPageIndex, snap.pageBackgrounds.length - 1)];
      setBackgroundImage(page?.backgroundImage ?? null);
      setBackgroundSettings(page?.backgroundSettings ? { ...DEFAULT_IMAGE_SETTINGS, ...page.backgroundSettings } : DEFAULT_IMAGE_SETTINGS);
      setOverlaySettings(page?.overlaySettings ? { ...DEFAULT_OVERLAY, ...page.overlaySettings } : DEFAULT_OVERLAY);
    },
    [currentPageIndex]
  );

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    recordingRef.current = true;
    const prevState = snapshot();
    const toRestore = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, prevState].slice(-HISTORY_LIMIT));
    applySnapshot(toRestore);
    recordingRef.current = false;
  }, [undoStack, snapshot, applySnapshot]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    recordingRef.current = true;
    const prevState = snapshot();
    const toRestore = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, prevState].slice(-HISTORY_LIMIT));
    applySnapshot(toRestore);
    recordingRef.current = false;
  }, [redoStack, snapshot, applySnapshot]);

  const saveToServer = useCallback(
    async (payload: {
      content?: { sections: Section[] };
      designSettings?: Record<string, unknown>;
      placedElements?: PlacedElement[];
      placedElementsByPage?: PlacedElement[][];
    }) => {
      if (!productId) return;
      setSaving(true);
      try {
        const res = await fetch(`/api/products/${productId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          setLastSaved(new Date());
        }
      } catch {
        // ignore
      } finally {
        setSaving(false);
      }
    },
    [productId]
  );

  const handleTemplateSelect = useCallback(
    (templateId: string) => {
      const preset = TEMPLATE_PRESETS[templateId as TemplateId];
      if (!preset) return;
      setTemplate(templateId);
      setLayoutSettings((prev) => ({ ...prev, ...preset.layout } as typeof prev));
      setGraphicsAccentColor(preset.accentColor);
      setCustomColor(preset.accentColor);
      saveToServer({
        content: { sections },
        designSettings: {
          ...product?.designSettings,
          template: templateId,
          colors: { ...product?.designSettings?.colors, graphics: preset.accentColor },
          typography: product?.designSettings?.typography,
          pages: pageBackgrounds.length ? pageBackgrounds : undefined,
          layout: { ...layoutSettings, ...preset.layout },
          placedElementsByPage,
        },
      });
    },
    [product?.designSettings, sections, pageBackgrounds, layoutSettings, placedElementsByPage, saveToServer]
  );

  useEffect(() => {
    if (!product || sections.length === 0) return;
    autoSaveTimerRef.current = setInterval(() => {
      saveToServer({
        content: { sections },
        designSettings: {
          ...product.designSettings,
          template,
          layout: layoutSettings,
          colors: { ...product.designSettings?.colors, graphics: graphicsAccentColor },
          typography: product.designSettings?.typography,
          pages: pageBackgrounds.length ? pageBackgrounds : undefined,
          placedElementsByPage: placedElementsByPage,
        },
      });
    }, 5000);
    return () => {
      if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
    };
  }, [sections, template, product, placedElementsByPage, graphicsAccentColor, layoutSettings, pageBackgrounds, saveToServer]);

  const openEdit = (section: Section) => {
    setEditingSectionId(section.id);
    setEditingContent(section.content);
  };

  const confirmDeleteSection = useCallback(() => {
    if (!sectionToDeleteId || sections.length <= 1) return;
    recordUndo();
    const idx = sections.findIndex((s) => s.id === sectionToDeleteId);
    const nextSections = sections.filter((s) => s.id !== sectionToDeleteId);
    const nextPageBackgrounds = pageBackgrounds.filter((_, i) => i !== idx);
    const nextPlacedByPage = placedElementsByPage.filter((_, i) => i !== idx);
    setSections(nextSections);
    setPageBackgrounds(nextPageBackgrounds.length ? nextPageBackgrounds : [{}]);
    setPlacedElementsByPage(nextPlacedByPage.length ? nextPlacedByPage : [[]]);
    setEditingSectionId((id) => (id === sectionToDeleteId ? null : id));
    setSectionToDeleteId(null);
    setCurrentPageIndex((i) => {
      if (idx < 0) return i;
      if (i >= nextSections.length) return Math.max(0, nextSections.length - 1);
      if (i > idx) return i - 1;
      return i;
    });
    saveToServer({
      content: { sections: nextSections },
      designSettings: {
        ...product?.designSettings,
        pages: nextPageBackgrounds.length ? nextPageBackgrounds : undefined,
        placedElementsByPage: nextPlacedByPage.length ? nextPlacedByPage : [[]],
      },
    });
    toast({ title: "Section deleted" });
  }, [sectionToDeleteId, sections, pageBackgrounds, placedElementsByPage, product?.designSettings, saveToServer, toast, recordUndo]);

  const saveEdit = () => {
    if (!editingSectionId) return;
    recordUndo();
    const nextSections = sections.map((s) => (s.id === editingSectionId ? { ...s, content: editingContent } : s));
    setSections(nextSections);
    setEditingSectionId(null);
    saveToServer({ content: { sections: nextSections } });
  };

  const updateSectionContent = useCallback((sectionId: string, newContent: string) => {
    recordUndoDebounced();
    setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, content: newContent } : s)));
    if (editingSectionId === sectionId) setEditingContent(newContent);
  }, [editingSectionId, recordUndoDebounced]);

  async function handleRegenerateSection(
    sectionId: string,
    action: "regenerate" | "expand" | "condense" | "restyle",
    instruction?: string
  ) {
    const section = sections.find((s) => s.id === sectionId);
    if (!section || !productId) return;
    setIsRegenerating(true);
    try {
      const res = await fetch("/api/products/regenerate-section", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          sectionId,
          sectionTitle: section.title,
          currentContent: section.content,
          action,
          instruction,
        }),
      });
      const data = (await res.json()) as { newContent?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      if (data.newContent) {
        recordUndo();
        setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, content: data.newContent! } : s)));
        if (editingSectionId === sectionId) setEditingContent(data.newContent);
        if (action === "regenerate") toast({ title: "Section regenerated!" });
        else if (action === "expand") toast({ title: "Section expanded!" });
        else if (action === "condense") toast({ title: "Section condensed!" });
        else toast({ title: "Style changed!" });
      }
    } catch (err) {
      toast({
        title: "Failed",
        description: err instanceof Error ? err.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsRegenerating(false);
    }
  }

  const GENERATE_AI_CONTENT_TYPES = [
    { id: "exercises", label: "Exercises" },
    { id: "worksheets", label: "Worksheets" },
    { id: "tips", label: "Tips & best practices" },
    { id: "case-studies", label: "Case studies" },
    { id: "examples", label: "Examples & scenarios" },
    { id: "key-takeaways", label: "Key takeaways" },
    { id: "checklists", label: "Checklists" },
    { id: "step-by-step", label: "Step-by-step instructions" },
    { id: "content", label: "Content (general informational content/explanations)" },
  ] as const;

  async function handleGenerateSectionWithAI(contentType: string, customType?: string) {
    const sectionId = editingSectionId;
    const section = sectionId ? sections.find((s) => s.id === sectionId) : null;
    if (!section || !product) return;
    setIsGeneratingAI(true);
    try {
      const existingSections = sections
        .filter((s) => s.id !== sectionId)
        .map((s) => ({
          title: s.title,
          contentPreview: (s.content || "").slice(0, 200),
        }));
      const res = await fetch("/api/products/generate-section-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productTitle: product.title,
          niche: product.niche || "",
          sectionTitle: section.title,
          contentType,
          customType: customType?.trim() || undefined,
          existingSections,
        }),
      });
      const data = (await res.json()) as { newContent?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      if (data.newContent) {
        recordUndo();
        setSections((prev) =>
          prev.map((s) => (s.id === sectionId ? { ...s, content: data.newContent! } : s))
        );
        setEditingContent(data.newContent);
        setShowGenerateAIDialog(false);
        setGenerateAICustomType("");
        toast({ title: "Content generated!", description: "Edit or save as needed." });
      }
    } catch (err) {
      toast({
        title: "Generation failed",
        description: err instanceof Error ? err.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingAI(false);
    }
  }

  const addSection = () => {
    recordUndo();
    const id = `section-${Date.now()}`;
    const newSection: Section = { id, title: "New Section", content: "", order: sections.length + 1 };
    setSections((prev) => [...prev, newSection]);
    setEditingSectionId(id);
    setEditingContent("");
  };

  const updateElementPosition = useCallback(
    (id: string, position: { x: number; y: number }) => {
      recordUndo();
      setCurrentPageElements((prev) => prev.map((el) => (el.id === id ? { ...el, position } : el)));
    },
    [recordUndo, setCurrentPageElements]
  );
  const updateElementSize = useCallback(
    (id: string, size: { width: number; height: number }, position: { x: number; y: number }) => {
      recordUndo();
      setCurrentPageElements((prev) => prev.map((el) => (el.id === id ? { ...el, size, position } : el)));
    },
    [recordUndo, setCurrentPageElements]
  );
  const deleteElement = useCallback(
    (id: string) => {
      recordUndo();
      setCurrentPageElements((prev) => prev.filter((el) => el.id !== id));
      setSelectedElement(null);
    },
    [recordUndo, setCurrentPageElements]
  );
  const duplicateElement = useCallback(
    (id: string) => {
      const element = currentPageElements.find((el) => el.id === id);
      if (!element) return;
      recordUndo();
      const newElement: PlacedElement = {
        ...element,
        id: `${element.type}-${Date.now()}`,
        position: { x: element.position.x + 20, y: element.position.y + 20 },
      };
      setCurrentPageElements((prev) => [...prev, newElement]);
      setSelectedElement(newElement.id);
    },
    [currentPageElements, recordUndo, setCurrentPageElements]
  );
  const bringToFront = useCallback(() => {
    if (!selectedElement) return;
    recordUndo();
    const maxZ = Math.max(0, ...currentPageElements.map((el) => el.zIndex));
    setCurrentPageElements((prev) =>
      prev.map((el) => (el.id === selectedElement ? { ...el, zIndex: maxZ + 1 } : el))
    );
  }, [currentPageElements, selectedElement, recordUndo, setCurrentPageElements]);
  const sendToBack = useCallback(() => {
    if (!selectedElement) return;
    recordUndo();
    const minZ = Math.min(0, ...currentPageElements.map((el) => el.zIndex));
    setCurrentPageElements((prev) =>
      prev.map((el) => (el.id === selectedElement ? { ...el, zIndex: minZ - 1 } : el))
    );
  }, [currentPageElements, selectedElement, recordUndo, setCurrentPageElements]);
  const moveElement = useCallback(
    (id: string, deltaX: number, deltaY: number) => {
      recordUndo();
      setCurrentPageElements((prev) =>
        prev.map((el) =>
          el.id === id ? { ...el, position: { x: el.position.x + deltaX, y: el.position.y + deltaY } } : el
        )
      );
    },
    [recordUndo, setCurrentPageElements]
  );
  const handleIconClick = useCallback(
    (iconName: string) => {
      recordUndo();
      const newElement: PlacedElement = {
        id: `icon-${Date.now()}`,
        type: "icon",
        content: iconName,
        position: { x: CANVAS_WIDTH / 2 - 50, y: 300 },
        size: { width: 80, height: 80 },
        rotation: 0,
        zIndex: currentPageElements.length,
      };
      setCurrentPageElements((prev) => [...prev, newElement]);
      setSelectedElement(newElement.id);
    },
    [currentPageElements.length, recordUndo, setCurrentPageElements]
  );

  const handleApplyColor = useCallback((color: string) => {
    setGraphicsAccentColor(color);
    setCustomColor(color);
    if (product) {
      setProduct((prev) =>
        prev
          ? {
              ...prev,
              designSettings: {
                ...prev.designSettings,
                colors: { ...prev.designSettings?.colors, graphics: color },
              },
            }
          : null
      );
    }
  }, [product]);

  const handleApplyPalette = useCallback((colors: string[]) => {
    if (colors[0]) handleApplyColor(colors[0]);
  }, [handleApplyColor]);

  const handleAddPhoto = useCallback(
    (url: string) => {
      recordUndo();
      const newElement: PlacedElement = {
        id: `image-${Date.now()}`,
        type: "image",
        content: url,
        position: { x: CANVAS_WIDTH / 2 - 100, y: 280 },
        size: { width: 200, height: 200 },
        rotation: 0,
        zIndex: currentPageElements.length,
      };
      setCurrentPageElements((prev) => [...prev, newElement]);
      setSelectedElement(newElement.id);
    },
    [currentPageElements.length, recordUndo, setCurrentPageElements]
  );

  const handleAddShape = useCallback(
    (svgFragment: string, fillColor: string) => {
      recordUndo();
      const filled = svgFragment.replace(/currentColor/g, fillColor).replace(/stroke="currentColor"/g, `stroke="${fillColor}"`);
      const fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g fill="${fillColor}" stroke="${fillColor}">${filled}</g></svg>`;
      const dataUrl = `data:image/svg+xml,${encodeURIComponent(fullSvg)}`;
      const newElement: PlacedElement = {
        id: `image-${Date.now()}`,
        type: "image",
        content: dataUrl,
        position: { x: CANVAS_WIDTH / 2 - 50, y: 300 },
        size: { width: 80, height: 80 },
        rotation: 0,
        zIndex: currentPageElements.length,
      };
      setCurrentPageElements((prev) => [...prev, newElement]);
      setSelectedElement(newElement.id);
    },
    [currentPageElements.length, recordUndo, setCurrentPageElements]
  );

  const handleAddTextBox = useCallback(() => {
    recordUndo();
    const newElement: PlacedElement = {
      id: `text-${Date.now()}`,
      type: "text",
      content: "Double-click to edit",
      position: { x: CANVAS_WIDTH / 2 - 100, y: 300 },
      size: { width: 200, height: 48 },
      rotation: 0,
      zIndex: currentPageElements.length,
      textSettings: { ...DEFAULT_TEXT_BOX },
    };
    setCurrentPageElements((prev) => [...prev, newElement]);
    setSelectedElement(newElement.id);
  }, [currentPageElements.length, recordUndo, setCurrentPageElements]);

  const searchPhotos = useCallback(async (query?: string) => {
    const q = (query ?? photoSearch).trim() || "nature";
    setIsLoadingPhotos(true);
    try {
      const res = await fetch(`/api/stock-photos?query=${encodeURIComponent(q)}&per_page=20`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = (await res.json()) as { photos?: { id: string; url?: string; fullUrl?: string; thumb?: string }[] };
      setPhotos(data.photos ?? []);
    } catch {
      setPhotos([]);
      toast({ title: "Could not load photos", variant: "destructive" });
    } finally {
      setIsLoadingPhotos(false);
    }
  }, [photoSearch, toast]);

  const selectedImageElement = selectedElement ? currentPageElements.find((el) => el.id === selectedElement && el.type === "image") : null;

  useEffect(() => {
    if (selectedImageElement) {
      setImageSettings({ ...DEFAULT_IMAGE_SETTINGS, ...selectedImageElement.imageSettings });
    }
  }, [selectedImageElement?.id]);

  const updateImageSetting = useCallback(
    (key: keyof ImageSettings, value: number | string) => {
      recordUndoDebounced();
      const next = { ...imageSettings, [key]: value };
      setImageSettings(next);
      if (!selectedElement) return;
      setCurrentPageElements((prev) =>
        prev.map((el) => (el.id === selectedElement ? { ...el, imageSettings: { ...el.imageSettings, ...next } } : el))
      );
    },
    [imageSettings, selectedElement, recordUndoDebounced, setCurrentPageElements]
  );

  const selectedTextElement = selectedElement ? currentPageElements.find((el) => el.id === selectedElement && el.type === "text") : null;

  const updateTextBoxContent = useCallback(
    (content: string) => {
      if (!selectedElement) return;
      recordUndoDebounced();
      setCurrentPageElements((prev) =>
        prev.map((el) => (el.id === selectedElement ? { ...el, content } : el))
      );
    },
    [selectedElement, recordUndoDebounced, setCurrentPageElements]
  );

  const updateTextBoxSetting = useCallback(
    (key: keyof TextBoxSettings, value: string | number) => {
      if (!selectedElement) return;
      recordUndoDebounced();
      setCurrentPageElements((prev) =>
        prev.map((el) => {
          if (el.id !== selectedElement || el.type !== "text") return el;
          const next = { ...el.textSettings, [key]: value } as TextBoxSettings;
          return { ...el, textSettings: { ...DEFAULT_TEXT_BOX, ...next } };
        })
      );
    },
    [selectedElement, recordUndoDebounced, setCurrentPageElements]
  );

  const setBackgroundFromUrl = useCallback(
    (imageUrl: string) => {
      recordUndo();
      const url = typeof imageUrl === "string" ? imageUrl.trim() : "";
      if (!url) {
        toast({ title: "No image URL to set as background", variant: "destructive" });
        return;
      }
      const newBgSettings = { ...DEFAULT_IMAGE_SETTINGS };
      const defaultOverlay = DEFAULT_OVERLAY;
      setBackgroundImage(url);
      setBackgroundSettings(newBgSettings);
      setOverlaySettings(defaultOverlay);
      persistCurrentPageBackground({ backgroundImage: url, backgroundSettings: newBgSettings, overlaySettings: defaultOverlay });
      saveToServer({
        designSettings: {
          ...product?.designSettings,
          pages: (() => {
            const next = [...pageBackgrounds];
            while (next.length <= currentPageIndex) next.push({});
            next[currentPageIndex] = { backgroundImage: url, backgroundSettings: newBgSettings, overlaySettings: defaultOverlay };
            return next;
          })(),
        },
      });
      toast({ title: "Background set for this page. Adjust opacity and overlay below." });
    },
    [toast, product?.designSettings, saveToServer, persistCurrentPageBackground, pageBackgrounds, currentPageIndex, recordUndo]
  );

  const setAsBackground = useCallback(() => {
    const el = selectedImageElement;
    if (!el) return;
    recordUndo();
    const imageUrl = typeof el.content === "string" ? el.content.trim() : "";
    if (!imageUrl) {
      toast({ title: "No image URL to set as background", variant: "destructive" });
      return;
    }
    const newBgSettings = { ...DEFAULT_IMAGE_SETTINGS, ...el.imageSettings };
    const defaultOverlay = DEFAULT_OVERLAY;
    setBackgroundImage(imageUrl);
    setBackgroundSettings(newBgSettings);
    setOverlaySettings(defaultOverlay);
    persistCurrentPageBackground({ backgroundImage: imageUrl, backgroundSettings: newBgSettings, overlaySettings: defaultOverlay });
    const nextPlacedByPage = placedElementsByPage.map((pageArr, i) =>
      i === currentPageIndex ? pageArr.filter((e) => e.id !== el.id) : pageArr
    );
    setPlacedElementsByPage(nextPlacedByPage);
    setSelectedElement(null);
    const nextPages = [...pageBackgrounds];
    while (nextPages.length <= currentPageIndex) nextPages.push({});
    nextPages[currentPageIndex] = { backgroundImage: imageUrl, backgroundSettings: newBgSettings, overlaySettings: defaultOverlay };
    saveToServer({
      designSettings: { ...product?.designSettings, pages: nextPages, placedElementsByPage: nextPlacedByPage },
    });
    toast({ title: "Background set for this page. Image removed from canvas." });
  }, [selectedImageElement, placedElementsByPage, product?.designSettings, saveToServer, toast, persistCurrentPageBackground, pageBackgrounds, currentPageIndex, recordUndo]);

  const FILTER_PRESETS: Record<string, Partial<ImageSettings>> = {
    none: { brightness: 100, contrast: 100, saturation: 100, blur: 0 },
    vintage: { brightness: 110, contrast: 90, saturation: 80, blur: 0 },
    grayscale: { brightness: 100, contrast: 100, saturation: 0, blur: 0 },
    warm: { brightness: 105, contrast: 105, saturation: 120, blur: 0 },
    cool: { brightness: 95, contrast: 105, saturation: 80, blur: 0 },
    fade: { brightness: 120, contrast: 80, saturation: 70, blur: 0 },
  };

  const applyFilter = useCallback(
    (name: keyof typeof FILTER_PRESETS) => {
      recordUndo();
      const filter = FILTER_PRESETS[name] ?? FILTER_PRESETS.none;
      const next = { ...imageSettings, ...filter };
      setImageSettings(next);
      if (!selectedElement) return;
      setCurrentPageElements((prev) =>
        prev.map((el) => (el.id === selectedElement ? { ...el, imageSettings: { ...el.imageSettings, ...next } } : el))
      );
    },
    [imageSettings, selectedElement, recordUndo, setCurrentPageElements]
  );

  const resetImageSettings = useCallback(() => {
    recordUndo();
    setImageSettings(DEFAULT_IMAGE_SETTINGS);
    if (!selectedElement) return;
    setCurrentPageElements((prev) =>
      prev.map((el) =>
        el.id === selectedElement ? { ...el, imageSettings: DEFAULT_IMAGE_SETTINGS } : el
      )
    );
  }, [selectedElement, recordUndo, setCurrentPageElements]);

  const removeBackground = useCallback(() => {
    recordUndo();
    setBackgroundImage(null);
    setBackgroundSettings(DEFAULT_IMAGE_SETTINGS);
    setOverlaySettings(DEFAULT_OVERLAY);
    persistCurrentPageBackground({ backgroundImage: null, backgroundSettings: undefined, overlaySettings: undefined });
    const nextPages = [...pageBackgrounds];
    while (nextPages.length <= currentPageIndex) nextPages.push({});
    nextPages[currentPageIndex] = {};
    saveToServer({ designSettings: { ...product?.designSettings, pages: nextPages } });
    toast({ title: "Background removed from this page" });
  }, [toast, persistCurrentPageBackground, pageBackgrounds, currentPageIndex, product?.designSettings, saveToServer, recordUndo]);

  const applyBackgroundToAllPages = useCallback(() => {
    recordUndo();
    const currentBg: PageBackground = {
      backgroundImage: backgroundImage ?? undefined,
      backgroundSettings: { ...backgroundSettings },
      overlaySettings: { ...overlaySettings },
    };
    const nextPages = Array.from({ length: sections.length }, () => ({ ...currentBg }));
    setPageBackgrounds(nextPages);
    saveToServer({ designSettings: { ...product?.designSettings, pages: nextPages } });
    toast({ title: "Background applied to all pages" });
  }, [sections.length, backgroundImage, backgroundSettings, overlaySettings, product?.designSettings, saveToServer, toast, recordUndo]);

  const applyGraphicsToAllPages = useCallback(() => {
    recordUndo();
    const currentGraphics = currentPageElements.map((e) => ({ ...e }));
    const nextByPage = Array.from({ length: sections.length }, () => currentGraphics.map((e) => ({ ...e, id: `${e.type}-${Date.now()}-${Math.random().toString(36).slice(2)}` })));
    setPlacedElementsByPage(nextByPage);
    saveToServer({ designSettings: { ...product?.designSettings, placedElementsByPage: nextByPage } });
    toast({ title: "Graphics applied to all pages" });
  }, [sections.length, currentPageElements, product?.designSettings, saveToServer, toast, recordUndo]);

  const selectedGraphicElement = selectedElement ? currentPageElements.find((el) => el.id === selectedElement) : null;

  const pagesWithSelectedIconCount = selectedGraphicElement
    ? placedElementsByPage.filter((pageArr) =>
        pageArr.some((el) => el.type === selectedGraphicElement.type && el.content === selectedGraphicElement.content)
      ).length
    : 0;

  const applySelectedIconToAllPages = useCallback(() => {
    if (!selectedGraphicElement || sections.length <= 1) return;
    recordUndo();
    const { type, content, position, size, rotation, zIndex, imageSettings } = selectedGraphicElement;
    const nextByPage = placedElementsByPage.map((pageArr, i) => {
      if (i === currentPageIndex) return pageArr;
      const copy: PlacedElement = {
        id: `${type}-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
        type,
        content,
        position: { ...position },
        size: { ...size },
        rotation,
        zIndex,
        ...(imageSettings ? { imageSettings: { ...imageSettings } } : {}),
      };
      return [...pageArr, copy];
    });
    setPlacedElementsByPage(nextByPage);
    saveToServer({ designSettings: { ...product?.designSettings, placedElementsByPage: nextByPage } });
    toast({ title: `Icon applied to all ${sections.length} pages` });
  }, [selectedGraphicElement, sections.length, currentPageIndex, placedElementsByPage, product?.designSettings, saveToServer, toast, recordUndo]);

  const removeSelectedIconFromAllPages = useCallback(() => {
    if (!selectedGraphicElement) return;
    recordUndo();
    const matchType = selectedGraphicElement.type;
    const matchContent = selectedGraphicElement.content;
    const nextByPage = placedElementsByPage.map((pageArr) =>
      pageArr.filter((el) => !(el.type === matchType && el.content === matchContent))
    );
    const pagesAffected = placedElementsByPage.filter((pageArr) =>
      pageArr.some((el) => el.type === matchType && el.content === matchContent)
    ).length;
    setPlacedElementsByPage(nextByPage);
    setSelectedElement(null);
    saveToServer({ designSettings: { ...product?.designSettings, placedElementsByPage: nextByPage } });
    toast({ title: `Icon removed from all ${pagesAffected} pages` });
  }, [selectedGraphicElement, placedElementsByPage, product?.designSettings, saveToServer, toast, recordUndo]);

  const updateOverlay = useCallback((key: keyof OverlaySettings, value: string | number) => {
    recordUndoDebounced();
    setOverlaySettings((prev) => {
      const next = { ...prev, [key]: value };
      persistCurrentPageBackground({ overlaySettings: next });
      return next;
    });
  }, [persistCurrentPageBackground, recordUndoDebounced]);

  const setOverlayPreset = useCallback((preset: keyof typeof OVERLAY_PRESETS) => {
    recordUndo();
    const next = OVERLAY_PRESETS[preset] ?? DEFAULT_OVERLAY;
    setOverlaySettings(next);
    persistCurrentPageBackground({ overlaySettings: next });
  }, [persistCurrentPageBackground, recordUndo]);

  const updateBackgroundSettings = useCallback(<K extends keyof ImageSettings>(key: K, value: ImageSettings[K]) => {
    recordUndoDebounced();
    setBackgroundSettings((prev) => {
      const next = { ...prev, [key]: value };
      persistCurrentPageBackground({ backgroundSettings: next });
      return next;
    });
  }, [persistCurrentPageBackground, recordUndoDebounced]);

  const handleTextClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      const typeEl = target.closest("[data-text-type]") as HTMLElement | null;
      if (!typeEl) return;
      const sectionEl = typeEl.closest("[data-section-id]");
      if (!sectionEl) return;
      const sectionId = sectionEl.getAttribute("data-section-id") ?? "";
      const type = (typeEl.getAttribute("data-text-type") as "title" | "body") ?? "body";
      e.stopPropagation();
      if (selectedTextRef.current) selectedTextRef.current.style.outline = "";
      selectedTextRef.current = typeEl;
      typeEl.style.outline = "2px solid #FF6B35";
      const comp = window.getComputedStyle(typeEl);
      const styles: TextStyles = {
        color: comp.color,
        fontSize: comp.fontSize,
        fontFamily: comp.fontFamily,
        fontWeight: comp.fontWeight,
        textAlign: comp.textAlign,
        lineHeight: comp.lineHeight,
        textDecoration: comp.textDecoration,
        textTransform: comp.textTransform,
        backgroundColor: comp.backgroundColor,
      };
      setSelectedTextMeta({
        sectionId,
        type,
        content: type === "title" ? typeEl.textContent ?? "" : typeEl.innerHTML,
        styles,
      });
    },
    []
  );

  const persistTextStyles = useCallback(
    (sectionId: string, type: "title" | "body", styles: TextStyles) => {
      setProduct((p) => {
        if (!p) return null;
        const prevSection = p.designSettings?.textStyles?.[sectionId] ?? { title: {} as TextStyles, body: {} as TextStyles };
        const nextSection = { ...prevSection, [type]: styles } as Record<"title" | "body", TextStyles>;
        return {
          ...p,
          designSettings: {
            ...p.designSettings,
            textStyles: {
              ...p.designSettings?.textStyles,
              [sectionId]: nextSection,
            },
          },
        } as Product;
      });
    },
    []
  );

  const updateTextStyle = useCallback(
    (property: string, value: string) => {
      if (!selectedTextRef.current || !selectedTextMeta) return;
      const el = selectedTextRef.current;
      (el.style as unknown as Record<string, string>)[property] = value;
      const nextStyles = { ...selectedTextMeta.styles, [property]: value };
      setSelectedTextMeta((prev) => (prev ? { ...prev, styles: nextStyles } : null));
      persistTextStyles(selectedTextMeta.sectionId, selectedTextMeta.type, nextStyles);
    },
    [selectedTextMeta, persistTextStyles]
  );

  const updateTextContent = useCallback(
    (newContent: string) => {
      if (!selectedTextRef.current || !selectedTextMeta) return;
      const { sectionId, type } = selectedTextMeta;
      const bodyHtml =
        type === "body" && newContent.trim()
          ? `<p>${newContent.trim().replace(/\n/g, "</p><p>")}</p>`
          : newContent;
      const nextSections =
        type === "title"
          ? sections.map((s) => (s.id === sectionId ? { ...s, title: newContent } : s))
          : sections.map((s) => (s.id === sectionId ? { ...s, contentHtml: bodyHtml } : s));
      setSections(nextSections);
      if (type === "title") {
        selectedTextRef.current.textContent = newContent;
      } else {
        const inner = selectedTextRef.current.querySelector(".preview-content");
        const toSet = type === "body" ? bodyHtml : newContent;
        if (inner) inner.innerHTML = toSet;
        else selectedTextRef.current.innerHTML = `<div class="preview-content">${toSet}</div>`;
      }
      setSelectedTextMeta((prev) => (prev ? { ...prev, content: newContent } : null));
      saveToServer({ content: { sections: nextSections } });
    },
    [selectedTextMeta, sections, saveToServer]
  );

  const resetTextStyles = useCallback(() => {
    if (!selectedTextMeta) return;
    Object.entries(DEFAULT_TEXT_STYLES).forEach(([key, value]) => {
      if (selectedTextRef.current) (selectedTextRef.current.style as unknown as Record<string, string>)[key] = value;
    });
    const nextStyles = { ...DEFAULT_TEXT_STYLES };
    setSelectedTextMeta((prev) => (prev ? { ...prev, styles: nextStyles } : null));
    persistTextStyles(selectedTextMeta.sectionId, selectedTextMeta.type, nextStyles);
  }, [selectedTextMeta, persistTextStyles]);

  const toggleTextDecoration = useCallback(
    (decoration: string) => {
      if (!selectedTextMeta) return;
      const current = selectedTextMeta.styles.textDecoration ?? "none";
      const next = current.includes(decoration) ? "none" : decoration;
      updateTextStyle("textDecoration", next);
    },
    [selectedTextMeta, updateTextStyle]
  );

  const deselectText = useCallback(() => {
    if (selectedTextRef.current) {
      selectedTextRef.current.style.outline = "";
      selectedTextRef.current = null;
    }
    setSelectedTextMeta(null);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!selectedElement) return;
      switch (e.key) {
        case "Delete":
        case "Backspace":
          e.preventDefault();
          deleteElement(selectedElement);
          break;
        case "c":
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            duplicateElement(selectedElement);
          }
          break;
        case "ArrowUp":
          e.preventDefault();
          moveElement(selectedElement, 0, -10);
          break;
        case "ArrowDown":
          e.preventDefault();
          moveElement(selectedElement, 0, 10);
          break;
        case "ArrowLeft":
          e.preventDefault();
          moveElement(selectedElement, -10, 0);
          break;
        case "ArrowRight":
          e.preventDefault();
          moveElement(selectedElement, 10, 0);
          break;
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedElement, deleteElement, duplicateElement, moveElement]);

  useEffect(() => {
    function handleUndoRedo(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === "z") {
        if (e.shiftKey) {
          e.preventDefault();
          redo();
        } else {
          e.preventDefault();
          undo();
        }
      } else if (e.key === "y") {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener("keydown", handleUndoRedo);
    return () => window.removeEventListener("keydown", handleUndoRedo);
  }, [undo, redo]);

  useEffect(() => {
    if (!lastSaved) return;
    const t = setInterval(() => setSaveIndicatorTick((n) => n + 1), 15000);
    return () => clearInterval(t);
  }, [lastSaved]);

  // Normalize product format for export routing (DB stores e.g. "spreadsheet", "notion")
  const formatNorm = (product?.format ?? "").toLowerCase().trim();
  const isSpreadsheet = formatNorm === "spreadsheet";
  const isNotionTemplate = formatNorm === "notion" || formatNorm === "notion template";
  // Single source of truth for export button labels (used in header and Export tab modal)
  const exportLabel = isSpreadsheet ? "Tutorial (PDF)" : isNotionTemplate ? "Notion Template" : "PDF";
  const exportGeneratingLabel = isSpreadsheet ? "Generating tutorial PDF..." : isNotionTemplate ? "Generating Notion template..." : "Generating PDF...";

  const handleDownloadPdf = async () => {
    setPdfExporting(true);
    try {
      const title = product?.title ?? "Product";
      const safeName = title.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "") || "product";
      // Re-read format at click time so we always route correctly
      const currentFormat = (product?.format ?? "").toLowerCase().trim();

      if (currentFormat === "spreadsheet") {
        // Spreadsheet products are tutorial guides → export as PDF
        const res = await fetch("/api/generate-pdf-puppeteer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId,
            includeCover,
            includeBackPage,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(typeof err?.error === "string" ? err.error : `Export failed (${res.status})`);
        }
        const blob = await res.blob();
        const fileName = `${safeName}-tutorial.pdf`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: "Tutorial PDF downloaded", description: `Saved as ${fileName}` });
        return;
      }

      if (currentFormat === "notion" || currentFormat === "notion template") {
        const res = await fetch("/api/generate-notion-template", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(typeof err?.error === "string" ? err.error : `Export failed (${res.status})`);
        }
        const text = await res.text();
        const fileName = `${safeName}.md`;
        const blob = new Blob([text], { type: "text/markdown; charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: "Notion template downloaded", description: `Saved as ${fileName}` });
        return;
      }

      // All other formats (workbook, ebook, guide, checklist, etc.) → PDF
      const res = await fetch("/api/generate-pdf-puppeteer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          includeCover,
          includeBackPage,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err?.error === "string" ? err.error : `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const fileName = `${safeName}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "PDF downloaded", description: `Saved as ${fileName}` });
    } catch (err) {
      toast({
        title: "Export failed",
        description: err instanceof Error ? err.message : "Export failed.",
        variant: "destructive",
      });
    } finally {
      setPdfExporting(false);
    }
  };

  const toggleUiTheme = useCallback(() => {
    setUiTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      if (typeof window !== "undefined") localStorage.setItem("product-editor-theme", next);
      return next;
    });
  }, []);

  const handleGenerateVideos = () => {
    try {
      sessionStorage.setItem(
        "digitalProductForm",
        JSON.stringify({
          productName: product?.title ?? "",
          productDescription: "",
          productType: "digital",
          productFileOrLinkMode: "file",
          hasFile: true,
          fileName: `${product?.title?.replace(/\s+/g, "-") ?? "product"}.pdf`,
        })
      );
    } catch {
      // ignore
    }
    router.push("/dashboard/digital-products/scripts");
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
      </main>
    );
  }
  if (error || !product) {
    return (
      <main className="min-h-screen bg-gray-100 text-gray-900 p-6">
        <p className="text-red-600">{error ?? "Product not found"}</p>
        <Link href="/dashboard/digital-products" className="text-orange-500 mt-4 inline-block hover:underline">
          ← Back to Digital Products
        </Link>
      </main>
    );
  }

  const dsBg = (product?.designSettings as { backgroundImage?: string } | undefined)?.backgroundImage;
  const canvasBgUrl = (typeof backgroundImage === "string" ? backgroundImage.trim() : "") || (typeof dsBg === "string" ? dsBg.trim() : "") || null;

  const templatePreset = TEMPLATE_PRESETS[(template as TemplateId) || "modern"] ?? TEMPLATE_PRESETS.modern;
  const previewLayoutStyle: React.CSSProperties & Record<`--${string}`, string> = {
    ["--paragraph-spacing" as const]: `${layoutSettings.paragraphSpacing}rem`,
    ["--line-height" as const]: String(layoutSettings.lineHeight),
    ["--text-align" as const]: layoutSettings.alignment,
    ["--margins" as const]: `${layoutSettings.margins}rem`,
    ["--section-spacing" as const]: `${layoutSettings.sectionSpacing}rem`,
    ["--template-font" as const]: templatePreset.fontFamily,
    ["--template-title-color" as const]: templatePreset.titleColor,
    ["--template-heading-color" as const]: templatePreset.headingColor,
    ["--template-body-color" as const]: templatePreset.bodyColor,
    fontFamily: templatePreset.fontFamily,
    maxWidth:
      layoutSettings.maxWidth === "narrow"
        ? 600
        : layoutSettings.maxWidth === "normal"
          ? 800
          : layoutSettings.maxWidth === "wide"
            ? 1000
            : "100%",
    margin: "0 auto",
    padding: `${layoutSettings.margins}rem`,
  };

  const isDark = uiTheme === "dark";
  return (
    <main className={`min-h-screen font-sans ${isDark ? "bg-[#0F0F0F] text-gray-100 editor-dark" : "bg-gray-100 text-gray-900"}`} data-theme={uiTheme}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            [data-canvas-background], [data-canvas-background-img] { display: block !important; visibility: visible !important; }
            .product-editor-preview-layout p { margin-bottom: var(--paragraph-spacing, 1rem); line-height: var(--line-height, 1.6); text-align: var(--text-align, left); }
            .product-editor-preview-layout h2 { margin-top: calc(var(--section-spacing, 2rem) * 1.5); margin-bottom: calc(var(--paragraph-spacing, 1rem) * 1.5); text-align: var(--text-align, left); }
            .product-editor-preview-layout h3 { margin-top: calc(var(--section-spacing, 2rem) * 0.75); margin-bottom: calc(var(--paragraph-spacing, 1rem) * 0.75); text-align: var(--text-align, left); }
            .product-editor-preview-layout section { margin-bottom: var(--section-spacing, 2rem); }
            .product-editor-preview-layout ul, .product-editor-preview-layout ol { margin-bottom: var(--paragraph-spacing, 1rem); padding-left: 1.5rem; text-align: var(--text-align, left); }
            .product-editor-preview-layout li { margin-bottom: 0.5rem; }
          `,
        }}
      />
      {/* Header - minimal Canva-style toolbar */}
      <header className={`sticky top-0 z-40 border-b backdrop-blur-sm shadow-sm ${isDark ? "border-[#2A2A2A] bg-[#0F0F0F]/95" : "border-gray-200 bg-white/95"}`}>
        <div className="max-w-[1800px] mx-auto flex items-center justify-between gap-6 px-4 md:px-6 h-14">
          <div className="flex items-center gap-6 min-w-0">
            <Link href="/dashboard/digital-products" className={`text-sm shrink-0 flex items-center gap-1 ${isDark ? "text-gray-400 hover:text-orange-500" : "text-gray-500 hover:text-orange-500"}`}>
              <ChevronLeft className="w-4 h-4" /> Back
            </Link>
            <div className={`h-5 w-px hidden sm:block ${isDark ? "bg-[#2A2A2A]" : "bg-gray-200"}`} />
            <h1 className={`text-base font-semibold truncate ${isDark ? "text-white" : "text-gray-900"}`}>{product.title}</h1>
            {saving ? (
              <span className={`flex items-center gap-1.5 text-xs shrink-0 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
              </span>
            ) : lastSaved ? (
              <span className="flex items-center gap-1.5 text-xs text-emerald-600 shrink-0" title={lastSaved.toLocaleString()}>
                <Check className="w-3.5 h-3.5" /> Saved ✓ · {formatLastSaved(lastSaved)}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={toggleUiTheme}
                    className={`p-2 rounded-lg transition-colors ${isDark ? "text-gray-400 hover:text-orange-500 hover:bg-[#2A2A2A]" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"}`}
                    aria-label={isDark ? "Switch to light background" : "Switch to dark background"}
                  >
                    {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{isDark ? "Light background" : "Dark background"}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="ghost" className={isDark ? "text-gray-400 hover:text-white hover:bg-[#2A2A2A]" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"} onClick={() => setShowFullPreview(true)}>
                    <Eye className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Preview</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white gap-2" onClick={() => setShowFullPreview(true)}>
              <Eye className="w-4 h-4" /> Export {exportLabel}
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden min-h-[calc(100vh-3.5rem)]">
        {/* Canvas area - left, larger */}
        <div className="flex-1 flex flex-col min-w-0 overflow-auto">
          <div className={`flex-1 flex items-start justify-center p-6 md:p-10 min-h-[calc(100vh-3.5rem)] ${isDark ? "bg-[#0F0F0F]" : "bg-gray-100"}`}>
            <div className="flex flex-col items-center gap-4 w-full max-w-4xl">
              {/* Toolbar above canvas */}
              <div className="flex items-center justify-between w-full max-w-[800px]">
                <div className="flex items-center gap-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={undo}
                          disabled={undoStack.length === 0}
                          className={`p-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent ${isDark ? "text-gray-400 hover:text-white hover:bg-[#2A2A2A]" : "text-gray-500 hover:text-gray-900 hover:bg-gray-200"}`}
                        >
                          <Undo2 className="w-4 h-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={redo}
                          disabled={redoStack.length === 0}
                          className={`p-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent ${isDark ? "text-gray-400 hover:text-white hover:bg-[#2A2A2A]" : "text-gray-500 hover:text-gray-900 hover:bg-gray-200"}`}
                        >
                          <Redo2 className="w-4 h-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Redo (Ctrl+Y)</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                {sections.length > 1 ? (
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border shadow-sm ${isDark ? "bg-[#1A1A1A] border-[#2A2A2A]" : "bg-white border-gray-200"}`}>
                    <button
                      type="button"
                      onClick={() => setCurrentPageIndex((i) => Math.max(0, i - 1))}
                      disabled={currentPageIndex <= 0}
                      className={`p-1 rounded disabled:opacity-40 disabled:cursor-not-allowed ${isDark ? "text-gray-400 hover:text-white hover:bg-[#2A2A2A]" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"}`}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className={`text-sm font-medium min-w-[80px] text-center ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                      {currentPageIndex + 1} / {sections.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCurrentPageIndex((i) => Math.min(sections.length - 1, i + 1))}
                      disabled={currentPageIndex >= sections.length - 1}
                      className={`p-1 rounded disabled:opacity-40 disabled:cursor-not-allowed ${isDark ? "text-gray-400 hover:text-white hover:bg-[#2A2A2A]" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"}`}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                ) : null}
              </div>
              {/* Canvas with drop shadow */}
              <div className="rounded-lg shadow-xl border border-gray-200 overflow-hidden" style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)" }}>
                <div
                  className="relative isolate text-[#1A1A1A]"
                  style={{
                    width: CANVAS_WIDTH,
                    minHeight: CANVAS_HEIGHT,
                    fontFamily: "var(--font-sans), sans-serif",
                    backgroundColor: canvasBgUrl ? "transparent" : "#ffffff",
                  }}
                  onClick={() => {
                    setSelectedElement(null);
                    deselectText();
                  }}
                  role="presentation"
                >
                  {canvasBgUrl ? (
                    <>
                      <div
                        data-canvas-background
                        style={{
                          position: "absolute",
                          left: 0,
                          top: 0,
                          right: 0,
                          bottom: 0,
                          width: "100%",
                          height: "100%",
                          zIndex: 0,
                          display: "block",
                          visibility: "visible",
                          opacity: 1,
                          pointerEvents: "none",
                          overflow: "hidden",
                        }}
                        aria-hidden
                      >
                        <img
                          data-canvas-background-img
                          src={canvasBgUrl}
                          alt=""
                          fetchPriority="high"
                          decoding="async"
                          style={{
                            position: "absolute",
                            left: 0,
                            top: 0,
                            minWidth: "100%",
                            minHeight: "100%",
                            width: "100%",
                            height: "100%",
                            display: "block",
                            visibility: "visible",
                            opacity: backgroundSettings.opacity ?? 1,
                            objectFit: (backgroundSettings.fit ?? "cover") as React.CSSProperties["objectFit"],
                            objectPosition: backgroundSettings.position ?? "center center",
                            imageRendering: "auto",
                            filter: (backgroundSettings.blur ?? 0) > 0
                              ? `blur(${backgroundSettings.blur}px) brightness(${backgroundSettings.brightness ?? 100}%) contrast(${backgroundSettings.contrast ?? 100}%) saturate(${backgroundSettings.saturation ?? 100}%)`
                              : `brightness(${backgroundSettings.brightness ?? 100}%) contrast(${backgroundSettings.contrast ?? 100}%) saturate(${backgroundSettings.saturation ?? 100}%)`,
                          }}
                          draggable={false}
                          aria-hidden
                        />
                      </div>
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          top: 0,
                          right: 0,
                          bottom: 0,
                          zIndex: 1,
                          pointerEvents: "none",
                          backgroundColor: overlaySettings.color,
                          opacity: overlaySettings.opacity,
                        }}
                        aria-hidden
                      />
                    </>
                  ) : null}
                  <div
                    className={`relative z-10 pointer-events-auto product-editor-preview-layout ${product.format === "workbook" ? "format-workbook" : ""}`}
                    style={{
                      ...previewLayoutStyle,
                      ...(canvasBgUrl ? { backgroundColor: "transparent" } : {}),
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h2 className="text-2xl font-bold border-b pb-2" style={{ color: templatePreset.titleColor }}>{product.title}</h2>
                    {(sections.length > 1
                      ? (sections[currentPageIndex] ? [sections[currentPageIndex]] : [])
                      : sections
                    ).map((section) => {
                      const titleStyles = product.designSettings?.textStyles?.[section.id]?.title;
                      const bodyStyles = product.designSettings?.textStyles?.[section.id]?.body;
                      return (
                        <section key={section.id} data-section-id={section.id}>
                          <h3
                            data-section-id={section.id}
                            data-text-type="title"
                            className="text-lg font-semibold cursor-text"
                            style={{ ...titleStyles, color: titleStyles?.color ?? templatePreset.headingColor }}
                            onClick={handleTextClick}
                          >
                            {section.title}
                          </h3>
                          <div
                            data-section-id={section.id}
                            data-text-type="body"
                            className="mt-2 prose prose-sm max-w-none prose-p:mb-4 prose-p:leading-relaxed prose-headings:mb-4 prose-headings:mt-6 prose-ul:mb-4 prose-ol:mb-4 prose-li:mb-2 cursor-text"
                            style={{ ...bodyStyles, color: bodyStyles?.color ?? templatePreset.bodyColor }}
                            onClick={handleTextClick}
                          >
                            {section.content || section.contentHtml ? (
                              <div
                                className="preview-content"
                                dangerouslySetInnerHTML={{
                                  __html: section.contentHtml ?? cleanMarkdownToHtml(section.content ?? ""),
                                }}
                              />
                            ) : (
                              <span className="text-[#999]">(Empty)</span>
                            )}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                  {/* Placed elements layer (Canva-style) - above content; current page only */}
                  <div className="absolute inset-0 pointer-events-none z-20" aria-hidden>
                    <div className="w-full h-full relative pointer-events-none">
                  {[...currentPageElements]
                    .sort((a, b) => a.zIndex - b.zIndex)
                    .map((element) => {
                      const isIconify = element.type === "icon" && element.content.includes(":");
                      const LucideIcon = !isIconify && element.type === "icon" ? GRAPHICS_ICONS.find((i) => i.name === element.content)?.icon : null;
                      const iconColor = graphicsAccentColor;
                      return (
                        <Rnd
                          key={element.id}
                          position={{ x: element.position.x, y: element.position.y }}
                          size={{ width: element.size.width, height: element.size.height }}
                          onDragStop={(_e, d) => updateElementPosition(element.id, { x: d.x, y: d.y })}
                          onResizeStop={(_e, _dir, ref, _delta, position) => {
                            updateElementSize(element.id, { width: ref.offsetWidth, height: ref.offsetHeight }, position);
                          }}
                          bounds="parent"
                          className={`pointer-events-auto cursor-move ${selectedElement === element.id ? "ring-2 ring-orange-500 ring-offset-1" : ""}`}
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            setSelectedElement(element.id);
                          }}
                          style={{ zIndex: Math.max(1, element.zIndex) }}
                        >
                          <div className="w-full h-full flex items-center justify-center bg-transparent">
                            {element.type === "icon" && isIconify ? (
                              <Icon icon={element.content} className="w-full h-full" style={{ color: iconColor }} />
                            ) : element.type === "icon" && LucideIcon ? (
                              <LucideIcon className="w-full h-full" style={{ color: iconColor }} />
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
                            ) : element.type === "text" ? (
                              <div
                                className="w-full h-full overflow-auto p-1 flex items-center"
                                style={{
                                  fontSize: element.textSettings?.fontSize ?? DEFAULT_TEXT_BOX.fontSize,
                                  fontFamily: element.textSettings?.fontFamily ?? DEFAULT_TEXT_BOX.fontFamily,
                                  color: element.textSettings?.color ?? DEFAULT_TEXT_BOX.color,
                                  textAlign: element.textSettings?.textAlign ?? DEFAULT_TEXT_BOX.textAlign,
                                  wordBreak: "break-word",
                                }}
                              >
                                {element.content || "Double-click to edit"}
                              </div>
                            ) : (
                              <span className="text-[#999] text-xs">?</span>
                            )}
                          </div>
                          {selectedElement === element.id && (
                            <div className="absolute -top-9 left-0 flex gap-1 bg-white text-gray-700 rounded-lg px-2 py-1.5 text-xs border border-gray-200 shadow-lg">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteElement(element.id);
                                }}
                                className="hover:bg-gray-100 rounded p-1"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  duplicateElement(element.id);
                                }}
                                className="hover:bg-gray-100 rounded p-1"
                                title="Duplicate"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  bringToFront();
                                }}
                                className="hover:bg-gray-100 rounded p-1"
                                title="Bring to front"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  sendToBack();
                                }}
                                className="hover:bg-gray-100 rounded p-1"
                                title="Send to back"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </Rnd>
                      );
                    })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right sidebar - Canva-style light panel */}
        <aside className={`w-[360px] shrink-0 border-l flex flex-col overflow-hidden ${isDark ? "border-[#2A2A2A] bg-[#1A1A1A]" : "border-gray-200 bg-white"}`}>
            {selectedTextMeta && (
              <div className="p-4 border-b border-gray-200 bg-gray-50 space-y-4 max-h-[50vh] overflow-y-auto">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-semibold text-gray-900">Edit text</h4>
                  <button
                    type="button"
                    onClick={deselectText}
                    className="text-xs text-gray-500 hover:text-gray-900"
                  >
                    Deselect
                  </button>
                </div>
                <div>
                  <label className="text-xs text-gray-600 font-medium block mb-1">Content</label>
                  <textarea
                    value={selectedTextMeta.type === "title" ? selectedTextMeta.content : selectedTextMeta.content.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ")}
                    onChange={(e) => updateTextContent(e.target.value)}
                    className="w-full p-2.5 bg-white rounded-lg text-sm text-gray-900 border border-gray-200 min-h-[60px] focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 font-medium block mb-1">Text color</label>
                  <div className="flex gap-1.5 flex-wrap mb-2">
                    {["#000000", "#374151", "#6B7280", "#FFFFFF", "#FF6B35", "#3B82F6", "#10B981", "#F59E0B", "#EF4444"].map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => updateTextStyle("color", color)}
                        className={`w-7 h-7 rounded border-2 shrink-0 ${rgbToHex(selectedTextMeta.styles.color ?? "") === color ? "border-orange-500" : "border-gray-200"}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <div className="[&_.react-colorful]:h-20 [&_.react-colorful]:w-full [&_.react-colorful]:rounded">
                    <HexColorPicker
                      color={rgbToHex(selectedTextMeta.styles.color ?? "#333")}
                      onChange={(c) => updateTextStyle("color", c)}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-600 font-medium block mb-1">Font size: {parseInt(selectedTextMeta.styles.fontSize ?? "16", 10)}px</label>
                  <input
                    type="range"
                    min="12"
                    max="72"
                    step="2"
                    value={parseInt(selectedTextMeta.styles.fontSize ?? "16", 10)}
                    onChange={(e) => updateTextStyle("fontSize", `${e.target.value}px`)}
                    className="w-full h-2 bg-gray-200 rounded-lg accent-orange-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 font-medium block mb-1">Font</label>
                  <select
                    value={(selectedTextMeta.styles.fontFamily ?? "Inter").split(",")[0].trim()}
                    onChange={(e) => updateTextStyle("fontFamily", e.target.value + ", sans-serif")}
                    className="w-full p-2.5 bg-white rounded-lg text-sm text-gray-900 border border-gray-200 focus:ring-2 focus:ring-orange-500/20"
                  >
                    {["Inter", "Arial", "Georgia", "Times New Roman", "Courier New", "Verdana", "Helvetica", "Playfair Display", "Roboto", "Open Sans", "Lato", "Montserrat"].map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-700 block mb-1">Weight</label>
                  <div className="grid grid-cols-4 gap-1">
                    {(["300", "400", "600", "700"] as const).map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => updateTextStyle("fontWeight", w)}
                        className={`px-2 py-1.5 rounded-lg text-xs font-medium ${(selectedTextMeta.styles.fontWeight ?? "400") === w ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                      >
                        {w === "300" ? "Light" : w === "400" ? "Normal" : w === "600" ? "Semi" : "Bold"}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-600 font-medium block mb-1">Alignment</label>
                  <div className="grid grid-cols-4 gap-1">
                    {(["left", "center", "right", "justify"] as const).map((align) => (
                      <button
                        key={align}
                        type="button"
                        onClick={() => updateTextStyle("textAlign", align)}
                        className={`p-2 rounded-lg text-xs font-medium ${(selectedTextMeta.styles.textAlign ?? "left") === align ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                      >
                        {align === "left" ? "Left" : align === "center" ? "Center" : align === "right" ? "Right" : "Justify"}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-600 font-medium block mb-1">Line height: {parseFloat(selectedTextMeta.styles.lineHeight ?? "1.6").toFixed(1)}</label>
                  <input
                    type="range"
                    min="1"
                    max="3"
                    step="0.1"
                    value={parseFloat(selectedTextMeta.styles.lineHeight ?? "1.6")}
                    onChange={(e) => updateTextStyle("lineHeight", e.target.value)}
                    className="w-full h-2 bg-gray-200 rounded-lg accent-orange-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 font-medium block mb-1">Effects</label>
                  <div className="grid grid-cols-2 gap-1">
                    <button type="button" onClick={() => toggleTextDecoration("underline")} className="px-2 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs text-gray-700">
                      <u>Underline</u>
                    </button>
                    <button type="button" onClick={() => toggleTextDecoration("line-through")} className="px-2 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs text-gray-700">
                      <s>Strikethrough</s>
                    </button>
                    <button type="button" onClick={() => updateTextStyle("textTransform", "uppercase")} className="px-2 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs text-gray-700">
                      UPPERCASE
                    </button>
                    <button type="button" onClick={() => updateTextStyle("textTransform", "none")} className="px-2 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs text-gray-700">
                      Normal
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-600 font-medium block mb-1">Highlight</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => updateTextStyle("backgroundColor", "transparent")} className="flex-1 py-1.5 bg-gray-100 rounded-lg text-xs text-gray-600 hover:bg-gray-200">None</button>
                    {["#FEF3C7", "#DBEAFE", "#FEE2E2"].map((bg) => (
                      <button key={bg} type="button" onClick={() => updateTextStyle("backgroundColor", bg)} className="w-8 h-8 rounded-lg border border-gray-200 hover:border-gray-300" style={{ backgroundColor: bg }} />
                    ))}
                  </div>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={resetTextStyles} className="w-full border-gray-200 text-gray-600 hover:bg-gray-50">
                  Reset to default
                </Button>
              </div>
            )}
            <Tabs defaultValue="content" className="w-full flex flex-col flex-1 min-h-0">
              <TabsList className="bg-gray-50 border-b border-gray-200 w-full grid grid-cols-5 rounded-none h-11 px-0">
                <TabsTrigger value="content" className="data-[state=active]:bg-white data-[state=active]:text-orange-600 data-[state=active]:border-b-2 data-[state=active]:border-orange-500 rounded-none text-xs gap-1.5 text-gray-600 border-b-2 border-transparent">
                  <BookOpen className="w-3.5 h-3.5" /> Content
                </TabsTrigger>
                <TabsTrigger value="design" className="data-[state=active]:bg-white data-[state=active]:text-orange-600 data-[state=active]:border-b-2 data-[state=active]:border-orange-500 rounded-none text-xs gap-1.5 text-gray-600 border-b-2 border-transparent">
                  <Palette className="w-3.5 h-3.5" /> Design
                </TabsTrigger>
                <TabsTrigger value="graphics" className="data-[state=active]:bg-white data-[state=active]:text-orange-600 data-[state=active]:border-b-2 data-[state=active]:border-orange-500 rounded-none text-xs gap-1.5 text-gray-600 border-b-2 border-transparent">
                  <ImageIcon className="w-3.5 h-3.5" /> Graphics
                </TabsTrigger>
                <TabsTrigger value="layout" className="data-[state=active]:bg-white data-[state=active]:text-orange-600 data-[state=active]:border-b-2 data-[state=active]:border-orange-500 rounded-none text-xs gap-1.5 text-gray-600 border-b-2 border-transparent">
                  <LayoutGrid className="w-3.5 h-3.5" /> Layout
                </TabsTrigger>
                <TabsTrigger value="export" className="data-[state=active]:bg-white data-[state=active]:text-orange-600 data-[state=active]:border-b-2 data-[state=active]:border-orange-500 rounded-none text-xs gap-1.5 text-gray-600 border-b-2 border-transparent">
                  <FileOutput className="w-3.5 h-3.5" /> Export
                </TabsTrigger>
              </TabsList>
              <div className="flex-1 overflow-y-auto">
              <TabsContent value="content" className="mt-0 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Table of Contents</h3>
                {sections.map((section, i) => (
                  <div key={section.id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white p-3 hover:border-gray-300">
                    <span className="text-sm text-gray-700 truncate min-w-0 flex-1">
                      {i + 1}. {section.title}
                    </span>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-500 hover:text-orange-500 hover:bg-orange-50" onClick={() => openEdit(section)} aria-label="Edit section">
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-gray-500 hover:text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => setSectionToDeleteId(section.id)}
                        disabled={sections.length <= 1}
                        aria-label="Delete section"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" className="w-full mt-2 border-gray-200 text-gray-600 hover:bg-gray-50 gap-1.5" onClick={addSection}>
                  <Plus className="w-3.5 h-3.5" /> Add New Section
                </Button>
              </TabsContent>
              <TabsContent value="design" className="mt-0 p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Template</h3>
                <div className="grid grid-cols-2 gap-2">
                  {TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleTemplateSelect(t.id)}
                      className={`rounded-xl border-2 p-4 text-left transition-all ${
                        template === t.id ? "border-orange-500 bg-orange-50" : "border-gray-200 hover:border-gray-300 bg-white"
                      }`}
                    >
                      <p className="text-sm font-medium text-gray-900">{t.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{t.desc}</p>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-3">Preview updates as you edit.</p>
              </TabsContent>
              <TabsContent value="graphics" className="mt-0 p-4 space-y-6 overflow-y-auto">
                <p className="text-xs text-gray-500 mb-3">Click to add to canvas. Drag to move and resize. Icons and graphics are on the current page only.</p>
                {sections.length > 1 && currentPageElements.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={applyGraphicsToAllPages}
                    className="w-full border-gray-200 text-gray-600 hover:bg-gray-100"
                  >
                    Apply graphics to all pages
                  </Button>
                )}

                {selectedGraphicElement && (
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
                    <p className="text-xs font-medium text-gray-900">Selected graphic</p>
                    <div className="flex flex-col gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={applySelectedIconToAllPages}
                        disabled={sections.length <= 1}
                        className="w-full border-gray-200 text-gray-600 hover:bg-gray-100 text-xs"
                      >
                        Apply to all pages
                      </Button>
                      {pagesWithSelectedIconCount >= 2 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={removeSelectedIconFromAllPages}
                          className="w-full border-red-200 text-red-600 hover:bg-red-50 text-xs"
                        >
                          Remove from all pages
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {selectedTextElement && (
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
                    <p className="text-xs font-medium text-gray-900">Text box</p>
                    <div>
                      <label className="text-xs text-gray-600 font-medium block mb-1">Text</label>
                      <textarea
                        value={selectedTextElement.content}
                        onChange={(e) => updateTextBoxContent(e.target.value)}
                        className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 min-h-[80px] resize-y"
                        placeholder="Enter text..."
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 font-medium block mb-1">Font size: {(selectedTextElement.textSettings?.fontSize ?? DEFAULT_TEXT_BOX.fontSize)}px</label>
                      <input
                        type="range"
                        min="10"
                        max="72"
                        step="2"
                        value={selectedTextElement.textSettings?.fontSize ?? DEFAULT_TEXT_BOX.fontSize}
                        onChange={(e) => updateTextBoxSetting("fontSize", parseInt(e.target.value, 10))}
                        className="w-full h-2 bg-gray-200 rounded-lg accent-orange-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 font-medium block mb-1">Font</label>
                      <select
                        value={(selectedTextElement.textSettings?.fontFamily ?? DEFAULT_TEXT_BOX.fontFamily).split(",")[0].trim()}
                        onChange={(e) => updateTextBoxSetting("fontFamily", e.target.value + ", system-ui, sans-serif")}
                        className="w-full p-2.5 bg-white rounded-lg text-sm text-gray-900 border border-gray-200"
                      >
                        {["Inter", "Arial", "Georgia", "Times New Roman", "Courier New", "Verdana", "Helvetica", "Playfair Display", "Roboto", "Open Sans", "Lato", "Montserrat"].map((f) => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 font-medium block mb-1">Color</label>
                      <div className="[&_.react-colorful]:h-20 [&_.react-colorful]:w-full [&_.react-colorful]:rounded">
                        <HexColorPicker
                          color={selectedTextElement.textSettings?.color ?? DEFAULT_TEXT_BOX.color}
                          onChange={(c) => updateTextBoxSetting("color", c)}
                        />
                      </div>
                      <input
                        type="text"
                        value={selectedTextElement.textSettings?.color ?? DEFAULT_TEXT_BOX.color}
                        onChange={(e) => updateTextBoxSetting("color", e.target.value)}
                        className="w-full mt-2 p-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 font-medium block mb-1">Alignment</label>
                      <div className="grid grid-cols-3 gap-1">
                        {(["left", "center", "right"] as const).map((align) => (
                          <button
                            key={align}
                            type="button"
                            onClick={() => updateTextBoxSetting("textAlign", align)}
                            className={`p-2 rounded-lg text-xs font-medium ${(selectedTextElement.textSettings?.textAlign ?? DEFAULT_TEXT_BOX.textAlign) === align ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                          >
                            {align === "left" ? "Left" : align === "center" ? "Center" : "Right"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {!backgroundImage && (
                  <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="text-sm font-medium text-gray-900 mb-1">Set page background</p>
                    <p className="text-xs text-gray-500">
                      Each page can have its own background. Use the page selector above the canvas to switch pages. Click <span className="text-orange-400 font-medium">&quot;Set as background&quot;</span> on any photo to set it for the current page.
                    </p>
                  </div>
                )}

                {backgroundImage && (
                  <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
                    <p className="text-xs font-medium text-gray-900">
                      Background image{sections.length > 1 ? ` (Page ${currentPageIndex + 1})` : ""}
                    </p>
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-3 items-start">
                        <div className="w-16 h-16 rounded-lg border border-gray-200 overflow-hidden bg-gray-100 shrink-0">
                          <img
                            src={backgroundImage}
                            alt="Background preview"
                            className="w-full h-full object-cover"
                            style={{ opacity: 1 }}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-gray-600 truncate" title={backgroundImage}>
                            {backgroundImage.startsWith("data:")
                              ? "Image"
                              : backgroundImage.split("/").filter(Boolean).pop()?.split("?")[0] || "Background image"}
                          </p>
                          <div className="flex gap-1.5 mt-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => {
                                removeBackground();
                                toast({ title: "Pick a new image from the photos below." });
                              }}
                              className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs text-gray-700"
                            >
                              Change background
                            </button>
                            <button
                              type="button"
                              onClick={removeBackground}
                              className="px-2 py-1 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-xs"
                            >
                              Remove background
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Opacity: {Math.round((backgroundSettings.opacity ?? 1) * 100)}%</label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={backgroundSettings.opacity ?? 1}
                        onChange={(e) => updateBackgroundSettings("opacity", parseFloat(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Blur: {backgroundSettings.blur ?? 0}px</label>
                      <input
                        type="range"
                        min="0"
                        max="20"
                        step="1"
                        value={backgroundSettings.blur ?? 0}
                        onChange={(e) => updateBackgroundSettings("blur", parseInt(e.target.value, 10))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Fit</label>
                      <select
                        value={backgroundSettings.fit ?? "cover"}
                        onChange={(e) => updateBackgroundSettings("fit", e.target.value)}
                        className="w-full p-2.5 bg-white rounded-lg text-sm text-gray-900 border border-gray-200"
                      >
                        <option value="cover">Cover (fill)</option>
                        <option value="contain">Contain (fit)</option>
                        <option value="fill">Stretch</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Position</label>
                      <div className="grid grid-cols-3 gap-1">
                        {(["top", "center", "bottom"] as const).flatMap((v) =>
                          (["left", "center", "right"] as const).map((h) => {
                            const pos = `${v} ${h}`;
                            const label = (v === "top" ? "T" : v === "bottom" ? "B" : "·") + (h === "left" ? "L" : h === "right" ? "R" : "·");
                            return (
                              <button
                                key={pos}
                                type="button"
                                onClick={() => updateBackgroundSettings("position", pos)}
                                className={`p-1.5 rounded text-xs ${backgroundSettings.position === pos ? "bg-orange-500 text-white" : "bg-gray-200 text-gray-500 hover:bg-gray-300"}`}
                                title={pos}
                              >
                                {label}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                    <div className="border-t border-gray-200 pt-3 mt-3">
                      <p className="text-xs font-medium text-gray-900 mb-2">Content overlay</p>
                      <p className="text-[11px] text-[#666] mb-3">Makes text readable over the background</p>
                      <div className="flex gap-2 mb-3">
                        {[
                          { color: "rgba(255, 255, 255, 0.9)", label: "White", bg: "white" },
                          { color: "rgba(0, 0, 0, 0.7)", label: "Black", bg: "black" },
                          { color: "rgba(31, 41, 55, 0.8)", label: "Dark gray", bg: "#1f2937" },
                          { color: "rgba(255, 107, 53, 0.3)", label: "Brand", bg: "#FF6B35" },
                        ].map(({ color, label, bg }) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => updateOverlay("color", color)}
                            className={`w-10 h-10 rounded border-2 shrink-0 ${
                              overlaySettings.color === color ? "border-orange-500" : "border-gray-200"
                            }`}
                            style={{ backgroundColor: bg }}
                            title={label}
                          />
                        ))}
                      </div>
                      <div className="mb-3">
                        <label className="text-xs text-gray-500 block mb-1">
                          Overlay strength: {Math.round((overlaySettings.opacity ?? 0.9) * 100)}%
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={overlaySettings.opacity ?? 0.9}
                          onChange={(e) => updateOverlay("opacity", parseFloat(e.target.value))}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                        />
                        <p className="text-[11px] text-[#666] mt-0.5">Lower this to see more of the background image.</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {(["clean", "dark", "subtle", "none"] as const).map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setOverlayPreset(preset)}
                            className="px-2 py-1.5 bg-gray-200 hover:bg-gray-300 rounded text-xs text-gray-700"
                          >
                            {preset === "clean" ? "Clean white" : preset === "dark" ? "Dark elegant" : preset === "subtle" ? "Subtle tint" : "No overlay"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={removeBackground}
                      className="w-full border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300 mt-3"
                    >
                      Remove background
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={applyBackgroundToAllPages}
                      className="w-full border-gray-200 text-gray-600 hover:bg-gray-100 mt-2"
                    >
                      Apply to all pages
                    </Button>
                  </div>
                )}

                {selectedImageElement && (
                  <div className="p-4 bg-gray-100 border border-gray-200 rounded-lg space-y-4">
                    <h4 className="text-sm font-semibold text-gray-900">Image settings</h4>
                    <Button
                      type="button"
                      onClick={setAsBackground}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white text-sm"
                    >
                      Set as background
                    </Button>
                    <div>
                      <label className="text-xs text-gray-700 block mb-1">Opacity: {Math.round((imageSettings.opacity ?? 1) * 100)}%</label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={imageSettings.opacity ?? 1}
                        onChange={(e) => updateImageSetting("opacity", parseFloat(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-700 block mb-1">Blur: {imageSettings.blur ?? 0}px</label>
                      <input
                        type="range"
                        min="0"
                        max="20"
                        step="1"
                        value={imageSettings.blur ?? 0}
                        onChange={(e) => updateImageSetting("blur", parseInt(e.target.value, 10))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-700 block mb-1">Brightness: {imageSettings.brightness ?? 100}%</label>
                      <input
                        type="range"
                        min="50"
                        max="150"
                        step="5"
                        value={imageSettings.brightness ?? 100}
                        onChange={(e) => updateImageSetting("brightness", parseInt(e.target.value, 10))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-700 block mb-1">Contrast: {imageSettings.contrast ?? 100}%</label>
                      <input
                        type="range"
                        min="50"
                        max="150"
                        step="5"
                        value={imageSettings.contrast ?? 100}
                        onChange={(e) => updateImageSetting("contrast", parseInt(e.target.value, 10))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-700 block mb-1">Saturation: {imageSettings.saturation ?? 100}%</label>
                      <input
                        type="range"
                        min="0"
                        max="200"
                        step="10"
                        value={imageSettings.saturation ?? 100}
                        onChange={(e) => updateImageSetting("saturation", parseInt(e.target.value, 10))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-700 block mb-2">Quick filters</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(["none", "vintage", "grayscale", "warm", "cool", "fade"] as const).map((name) => (
                          <button
                            key={name}
                            type="button"
                            onClick={() => applyFilter(name)}
                            className="px-2 py-1.5 bg-gray-200 hover:bg-gray-300 rounded text-xs text-gray-700"
                          >
                            {name === "none" ? "None" : name === "grayscale" ? "B&W" : name.charAt(0).toUpperCase() + name.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={resetImageSettings} className="w-full border-gray-200 text-gray-500">
                      Reset to original
                    </Button>
                  </div>
                )}

                {/* Icons */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Icons</h3>
                  <input
                    type="text"
                    placeholder="Search 1000+ icons..."
                    className="w-full p-2.5 mb-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400"
                    value={iconSearch}
                    onChange={(e) => setIconSearch(e.target.value)}
                  />
                  <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
                    {Object.keys(ICON_CATEGORIES).map((category) => (
                      <button
                        key={category}
                        type="button"
                        onClick={() => setActiveIconCategory(category)}
                        className={`px-3 py-1.5 rounded text-xs whitespace-nowrap transition-colors ${
                          activeIconCategory === category ? "bg-orange-500 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                        }`}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-6 gap-2 max-h-48 overflow-y-auto">
                    {(ICON_CATEGORIES[activeIconCategory] ?? [])
                      .filter((iconId) => !iconSearch.trim() || iconId.toLowerCase().includes(iconSearch.toLowerCase()))
                      .map((iconId) => (
                        <button
                          key={iconId}
                          type="button"
                          onClick={() => handleIconClick(iconId)}
                          className="p-2 bg-gray-100 hover:bg-gray-200 border border-gray-200 hover:border-orange-500/50 rounded flex items-center justify-center aspect-square transition-colors"
                          title={iconId}
                        >
                          <Icon icon={iconId} className="w-6 h-6 text-gray-700" />
                        </button>
                      ))}
                  </div>
                </div>

                {/* Color palettes */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Color palettes</h3>
                  <div className="flex gap-2 mb-3 flex-wrap">
                    {Object.keys(COLOR_PALETTES).map((style) => (
                      <button
                        key={style}
                        type="button"
                        onClick={() => setActivePaletteStyle(style)}
                        className={`px-3 py-1.5 rounded text-xs ${
                          activePaletteStyle === style ? "bg-orange-500 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                        }`}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {(COLOR_PALETTES[activePaletteStyle] ?? []).map((palette) => (
                      <div key={palette.name} className="bg-gray-100 border border-gray-200 p-2 rounded flex flex-wrap items-center gap-2">
                        <span className="text-xs text-gray-500 w-24 shrink-0">{palette.name}</span>
                        <div className="flex gap-1 flex-1">
                          {palette.colors.map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => handleApplyColor(color)}
                              className="w-8 h-8 rounded border-2 border-gray-200 hover:border-white shrink-0"
                              style={{ backgroundColor: color }}
                              title={color}
                            />
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleApplyPalette(palette.colors)}
                          className="px-2 py-1 bg-orange-500 hover:bg-orange-600 rounded text-xs text-white"
                        >
                          Apply
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Custom color */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Custom color</h3>
                  <div className="[&_.react-colorful]:h-24 [&_.react-colorful]:w-full [&_.react-colorful]:rounded">
                    <HexColorPicker color={customColor} onChange={setCustomColor} />
                  </div>
                  <div className="flex gap-2 mt-2">
                    <input
                      type="text"
                      value={customColor}
                      onChange={(e) => setCustomColor(e.target.value)}
                      className="flex-1 p-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 font-mono"
                    />
                    <Button type="button" size="sm" onClick={() => handleApplyColor(customColor)} className="bg-orange-500 hover:bg-orange-600 shrink-0">
                      Apply
                    </Button>
                  </div>
                </div>

                {/* Add Text */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Text box</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddTextBox}
                    className="w-full border-gray-200 text-gray-600 hover:bg-gray-50 gap-2"
                  >
                    <Type className="w-4 h-4" /> Add text box
                  </Button>
                </div>

                {/* Shapes */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Shapes</h3>
                  <div className="grid grid-cols-4 gap-2">
                    {SHAPES.map((shape) => (
                      <button
                        key={shape.name}
                        type="button"
                        onClick={() => handleAddShape(shape.svg, graphicsAccentColor)}
                        className="aspect-square p-2 bg-gray-100 hover:bg-gray-200 border border-gray-200 hover:border-orange-500/50 rounded flex flex-col items-center justify-center transition-colors"
                      >
                        <svg viewBox="0 0 100 100" className="w-full h-8 text-gray-700" fill="currentColor">
                          <g dangerouslySetInnerHTML={{ __html: shape.svg }} />
                        </svg>
                        <span className="text-[10px] text-gray-500 mt-1 truncate w-full text-center">{shape.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Stock photos */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Stock photos</h3>
                  <input
                    type="text"
                    placeholder="Search free photos..."
                    className="w-full p-2.5 mb-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400"
                    value={photoSearch}
                    onChange={(e) => setPhotoSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && searchPhotos()}
                  />
                  <div className="flex gap-2 mb-2 flex-wrap">
                    {["Business", "Love", "Nature", "Technology", "People", "Abstract"].map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          setPhotoSearch(cat);
                          searchPhotos(cat.toLowerCase());
                        }}
                        className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-xs text-gray-700"
                      >
                        {cat}
                      </button>
                    ))}
                    <button type="button" onClick={() => searchPhotos()} className="px-2 py-1 bg-orange-500 hover:bg-orange-600 rounded text-xs text-white">
                      Search
                    </button>
                  </div>
                  {isLoadingPhotos ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                    </div>
                  ) : photos.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto">
                      {photos.map((photo) => {
                        const photoUrl = photo.fullUrl ?? photo.url ?? "";
                        if (!photoUrl) return null;
                        return (
                          <div
                            key={photo.id}
                            className="relative aspect-square rounded overflow-hidden border border-gray-200 hover:border-orange-500/50 group"
                          >
                            <img
                              src={photo.thumb ?? photo.url}
                              alt=""
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-1.5 p-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddPhoto(photoUrl);
                                }}
                                className="w-full py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium rounded"
                              >
                                Add to canvas
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setBackgroundFromUrl(photoUrl);
                                }}
                                className="w-full py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded"
                              >
                                Set as background
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-[#666] py-4">Search or pick a category to load photos. Photos by Unsplash.</p>
                  )}
                  <p className="text-[10px] text-[#555] mt-1">Photos by Unsplash</p>
                </div>
              </TabsContent>
              <TabsContent value="layout" className="mt-0 p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Text Layout</h3>
                <div className="space-y-6">
                  <div>
                    <label className="block mb-2 text-xs text-gray-700">Paragraph Spacing</label>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.25"
                      value={layoutSettings.paragraphSpacing}
                      onChange={(e) => updateLayout("paragraphSpacing", parseFloat(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                    />
                    <div className="flex justify-between text-xs text-[#666] mt-1">
                      <span>Tight</span>
                      <span>Normal</span>
                      <span>Loose</span>
                    </div>
                  </div>
                  <div>
                    <label className="block mb-2 text-xs text-gray-700">Line Height</label>
                    <input
                      type="range"
                      min="1.2"
                      max="2"
                      step="0.1"
                      value={layoutSettings.lineHeight}
                      onChange={(e) => updateLayout("lineHeight", parseFloat(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                    />
                    <div className="flex justify-between text-xs text-[#666] mt-1">
                      <span>Compact</span>
                      <span>Comfortable</span>
                      <span>Airy</span>
                    </div>
                  </div>
                  <div>
                    <label className="block mb-2 text-xs text-gray-700">Text Alignment</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["left", "center", "justify"] as const).map((align) => (
                        <Button
                          key={align}
                          type="button"
                          variant="outline"
                          size="sm"
                          className={
                            layoutSettings.alignment === align
                              ? "border-orange-500 bg-orange-50 text-orange-600"
                              : "border-gray-200 text-gray-500 hover:bg-gray-200"
                          }
                          onClick={() => updateLayout("alignment", align)}
                        >
                          {align === "left" ? "⬅️ Left" : align === "center" ? "↔️ Center" : "⬌ Justify"}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block mb-2 text-xs text-gray-700">Page Margins</label>
                    <input
                      type="range"
                      min="1"
                      max="4"
                      step="0.5"
                      value={layoutSettings.margins}
                      onChange={(e) => updateLayout("margins", parseFloat(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                    />
                    <div className="flex justify-between text-xs text-[#666] mt-1">
                      <span>Narrow</span>
                      <span>Normal</span>
                      <span>Wide</span>
                    </div>
                  </div>
                  <div>
                    <label className="block mb-2 text-xs text-gray-700">Section Spacing</label>
                    <input
                      type="range"
                      min="1"
                      max="4"
                      step="0.5"
                      value={layoutSettings.sectionSpacing}
                      onChange={(e) => updateLayout("sectionSpacing", parseFloat(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                    />
                    <div className="flex justify-between text-xs text-[#666] mt-1">
                      <span>Compact</span>
                      <span>Comfortable</span>
                      <span>Spacious</span>
                    </div>
                  </div>
                  <div>
                    <label className="block mb-2 text-xs text-gray-700">Content Width</label>
                    <select
                      value={layoutSettings.maxWidth}
                      onChange={(e) =>
                        updateLayout("maxWidth", e.target.value as "narrow" | "normal" | "wide" | "full")
                      }
                      className="w-full p-2.5 rounded-lg bg-white border border-gray-200 text-gray-900 text-sm"
                    >
                      <option value="narrow">Narrow (600px)</option>
                      <option value="normal">Normal (800px)</option>
                      <option value="wide">Wide (1000px)</option>
                      <option value="full">Full Width</option>
                    </select>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-gray-200 text-gray-500 hover:bg-gray-200"
                    onClick={resetLayout}
                  >
                    Reset to Defaults
                  </Button>
                </div>
              </TabsContent>
              <TabsContent value="export" className="mt-0 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Export</h3>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="includeCover"
                      checked={includeCover}
                      onCheckedChange={(v) => setIncludeCover(v === true)}
                    />
                    <Label htmlFor="includeCover" className="text-sm font-normal cursor-pointer">
                      Include cover page
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="includeBackPage"
                      checked={includeBackPage}
                      onCheckedChange={(v) => setIncludeBackPage(v === true)}
                    />
                    <Label htmlFor="includeBackPage" className="text-sm font-normal cursor-pointer">
                      Include back page
                    </Label>
                  </div>
                  <Button size="sm" variant="outline" className="w-full border-gray-200 text-gray-500 gap-1" onClick={handleGenerateVideos}>
                    Generate Marketing Videos →
                  </Button>
                </div>
              </TabsContent>
              </div>
            </Tabs>
        </aside>
      </div>

      {/* Delete Section Confirmation */}
      <Dialog open={!!sectionToDeleteId} onOpenChange={(open) => !open && setSectionToDeleteId(null)}>
        <DialogContent className="max-w-sm bg-white border-gray-200 text-gray-900">
          <DialogHeader>
            <DialogTitle>Delete section?</DialogTitle>
            <DialogDescription>Delete this section? This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setSectionToDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteSection}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Section Modal */}
      <Dialog open={!!editingSectionId} onOpenChange={(open) => !open && setEditingSectionId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white border-gray-200 text-gray-900">
          <DialogHeader>
            <DialogTitle>Edit Section: {sections.find((s) => s.id === editingSectionId)?.title ?? ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <RichTextEditor value={editingContent} onChange={setEditingContent} minHeight="220px" />
          </div>
          {editingSectionId && (
            <div className="flex flex-wrap gap-2 mt-4 border-t border-gray-200 pt-4">
              <Button
                type="button"
                size="sm"
                className="bg-orange-500 hover:bg-orange-600 text-white border-0"
                onClick={() => setShowGenerateAIDialog(true)}
                disabled={isRegenerating || isGeneratingAI}
              >
                {isGeneratingAI ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                <span className="ml-1.5">Generate with AI</span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                onClick={() => handleRegenerateSection(editingSectionId, "regenerate")}
                disabled={isRegenerating}
              >
                {isRegenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                <span className="ml-1.5">Regenerate</span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
                onClick={() =>
                  handleRegenerateSection(
                    editingSectionId,
                    "expand",
                    "Make this section 2x longer with more details, examples, and actionable advice"
                  )
                }
                disabled={isRegenerating}
              >
                <span>➕ Make Longer</span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
                onClick={() =>
                  handleRegenerateSection(
                    editingSectionId,
                    "condense",
                    "Make this section 50% shorter while keeping the key points"
                  )
                }
                disabled={isRegenerating}
              >
                <span>➖ Make Shorter</span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-green-500/50 text-green-400 hover:bg-green-500/10"
                onClick={() =>
                  handleRegenerateSection(
                    editingSectionId,
                    "restyle",
                    "Rewrite this section in a casual, conversational tone"
                  )
                }
                disabled={isRegenerating}
              >
                <span>✨ Change Style</span>
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="border-gray-200 text-gray-500" onClick={() => setEditingSectionId(null)}>
              Cancel
            </Button>
            <Button className="bg-orange-500 hover:bg-orange-600" onClick={saveEdit}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate with AI – content type choice */}
      <Dialog open={showGenerateAIDialog} onOpenChange={(open) => !open && setShowGenerateAIDialog(false)}>
        <DialogContent className="max-w-md bg-white border-gray-200 text-gray-900">
          <DialogHeader>
            <DialogTitle>Generate with AI</DialogTitle>
            <DialogDescription>
              What type of content do you want for this section? The AI will use your product topic and existing sections for context.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 py-2">
            {GENERATE_AI_CONTENT_TYPES.map(({ id, label }) => (
              <Button
                key={id}
                type="button"
                variant="outline"
                size="sm"
                className="justify-start border-gray-200 text-gray-700 hover:bg-orange-50 hover:border-orange-200"
                disabled={isGeneratingAI}
                onClick={() => handleGenerateSectionWithAI(id)}
              >
                <Sparkles className="w-3.5 h-3.5 mr-2 text-orange-500 shrink-0" />
                {label}
              </Button>
            ))}
          </div>
          <div className="flex gap-2 pt-2 border-t border-gray-200">
            <Input
              placeholder="Or describe custom type (e.g. reflection questions)"
              value={generateAICustomType}
              onChange={(e) => setGenerateAICustomType(e.target.value)}
              className="flex-1 border-gray-200"
              disabled={isGeneratingAI}
            />
            <Button
              type="button"
              size="sm"
              className="bg-orange-500 hover:bg-orange-600 shrink-0"
              disabled={isGeneratingAI || !generateAICustomType.trim()}
              onClick={() => handleGenerateSectionWithAI("other", generateAICustomType)}
            >
              {isGeneratingAI ? <Loader2 className="w-4 h-4 animate-spin" /> : "Generate"}
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-gray-200" onClick={() => setShowGenerateAIDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full product preview modal – Save as PDF via browser print */}
      {showFullPreview && (
        <div className="pdf-print-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <style
            dangerouslySetInnerHTML={{
              __html: `
                @media print {
                  .sidebar, .no-print, .modal-header, nav, button { display: none !important; }
                  .pdf-print-overlay { background: transparent !important; padding: 0 !important; }
                  .pdf-print-overlay > div { max-height: none !important; box-shadow: none !important; }
                  .preview-pages-container { overflow: visible !important; padding: 0 !important; }
                  .preview-page, [data-page] {
                    page-break-after: always;
                    page-break-inside: avoid;
                    width: 100%;
                    min-height: 100vh;
                  }
                  .preview-page:first-child, [data-page]:first-of-type { page-break-before: avoid; }
                  .preview-page:last-child { page-break-after: auto; }
                  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                  @page { size: A4; margin: 0; }
                }
              `,
            }}
          />
          <div className="bg-gray-100 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-200 shadow-2xl">
            <div className="modal-header sticky top-0 z-10 border-b border-gray-200 bg-white p-4 no-print space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Full Product Preview</h2>
                <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-900" onClick={() => setShowFullPreview(false)}>
                  <X className="w-5 h-5" /> Close
                </Button>
              </div>
              <p className="text-sm text-gray-600">
                {isSpreadsheet || isNotionTemplate
                  ? `Click the button below to download your ${exportLabel}.`
                  : 'To save your product as PDF, click the button below and select "Save as PDF" in the print dialog.'}
              </p>
              <Button size="lg" className="w-full bg-orange-500 hover:bg-orange-600 text-white gap-2 text-base font-semibold py-6" onClick={handleDownloadPdf} disabled={pdfExporting}>
                {pdfExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Printer className="w-5 h-5" />} {pdfExporting ? exportGeneratingLabel : `Download ${exportLabel}`}
              </Button>
            </div>
            <div data-print-source className="editor-canvas preview-pages-container flex-1 overflow-y-auto p-6 flex flex-col items-center gap-6">
                {Array.from({ length: Math.max(sections.length, pageBackgrounds.length, placedElementsByPage.length, 1) }, (_, pageIdx) => {
                  const section = sections[pageIdx] ?? { id: `page-${pageIdx}`, title: "", content: "", contentHtml: "" };
                  const pageBg = pageBackgrounds[pageIdx];
                  const bgUrl = pageBg?.backgroundImage ?? null;
                  const bgSettings = pageBg?.backgroundSettings
                    ? { ...DEFAULT_IMAGE_SETTINGS, ...pageBg.backgroundSettings }
                    : DEFAULT_IMAGE_SETTINGS;
                  const overlay = pageBg?.overlaySettings ? { ...DEFAULT_OVERLAY, ...pageBg.overlaySettings } : DEFAULT_OVERLAY;
                  const titleStyles = product.designSettings?.textStyles?.[section.id]?.title;
                  const bodyStyles = product.designSettings?.textStyles?.[section.id]?.body;
                  return (
                    <div
                      key={section.id}
                      id={`preview-page-${pageIdx}`}
                      data-pdf-page
                      data-page
                      className="preview-page product-page relative shrink-0 rounded-lg overflow-hidden border border-gray-200 bg-white shadow-lg"
                      style={{
                        width: CANVAS_WIDTH,
                        minHeight: CANVAS_HEIGHT,
                        pageBreakAfter: "always",
                        pageBreakInside: "avoid",
                      }}
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
                        <div
                          className="absolute inset-0 z-[1] pointer-events-none"
                          style={{ backgroundColor: overlay.color, opacity: overlay.opacity }}
                          aria-hidden
                        />
                      </>
                    ) : null}
                    <div
                      className={`relative z-10 product-editor-preview-layout ${product.format === "workbook" ? "format-workbook" : ""}`}
                      style={{
                        ...previewLayoutStyle,
                        ...(bgUrl ? { backgroundColor: "transparent" } : {}),
                        minHeight: CANVAS_HEIGHT,
                      }}
                    >
                      <h2 className="text-2xl font-bold border-b pb-2" style={{ color: templatePreset.titleColor }}>{product.title}</h2>
                      <section>
                        <h3 className="text-lg font-semibold" style={{ ...titleStyles, color: titleStyles?.color ?? templatePreset.headingColor }}>
                          {section.title}
                        </h3>
                        <div
                          className="mt-2 prose prose-sm max-w-none prose-p:mb-4 prose-p:leading-relaxed prose-headings:mb-4 prose-headings:mt-6 prose-ul:mb-4 prose-ol:mb-4 prose-li:mb-2"
                          style={{ ...bodyStyles, color: bodyStyles?.color ?? templatePreset.bodyColor }}
                        >
                          {section.content || section.contentHtml ? (
                            <div
                              className="preview-content"
                              dangerouslySetInnerHTML={{
                                __html: section.contentHtml ?? cleanMarkdownToHtml(section.content ?? ""),
                              }}
                            />
                          ) : (
                            <span className="text-[#999]">(Empty)</span>
                          )}
                        </div>
                      </section>
                    </div>
                    {/* Placed elements - per-page graphics */}
                    <div className="absolute inset-0 pointer-events-none z-20">
                      {[...(placedElementsByPage[pageIdx] ?? [])]
                        .sort((a, b) => a.zIndex - b.zIndex)
                        .map((element) => {
                          const isIconify = element.type === "icon" && element.content.includes(":");
                          const LucideIcon = !isIconify && element.type === "icon" ? GRAPHICS_ICONS.find((i) => i.name === element.content)?.icon : null;
                          const iconColor = graphicsAccentColor;
                          return (
                            <div
                              key={element.id}
                              className="absolute flex items-center justify-center"
                              style={{
                                left: element.position.x,
                                top: element.position.y,
                                width: element.size.width,
                                height: element.size.height,
                                zIndex: Math.max(1, element.zIndex),
                              }}
                            >
                              {element.type === "icon" && isIconify ? (
                                <Icon icon={element.content} className="w-full h-full" style={{ color: iconColor }} />
                              ) : element.type === "icon" && LucideIcon ? (
                                <LucideIcon className="w-full h-full" style={{ color: iconColor }} />
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
                              ) : element.type === "text" ? (
                                <div
                                  className="w-full h-full overflow-auto p-1 flex items-center"
                                  style={{
                                    fontSize: element.textSettings?.fontSize ?? DEFAULT_TEXT_BOX.fontSize,
                                    fontFamily: element.textSettings?.fontFamily ?? DEFAULT_TEXT_BOX.fontFamily,
                                    color: element.textSettings?.color ?? DEFAULT_TEXT_BOX.color,
                                    textAlign: element.textSettings?.textAlign ?? DEFAULT_TEXT_BOX.textAlign,
                                    wordBreak: "break-word",
                                  }}
                                >
                                  {element.content || ""}
                                </div>
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
          </div>
        </div>
      )}

    </main>
  );
}
