"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
  Printer,
  Sparkles,
  Type,
  Megaphone,
  Download,
  Video,
} from "lucide-react";
import { Icon } from "@iconify/react";
import { HexColorPicker } from "react-colorful";
import { RichTextEditor } from "@/components/RichTextEditor";
import { ThumbnailMockup, THUMBNAIL_TEMPLATES, type ThumbnailTemplateId } from "@/components/product-editor/ThumbnailMockup";
import { cleanMarkdownToHtml } from "@/lib/clean-markdown";
import html2canvas from "html2canvas";
import { captureCanvasPagesToPdf } from "@/lib/pdf-client-export";
import { useToast } from "@/components/ui/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { useDashboardTheme } from "@/components/dashboard-theme-provider";

type Section = { id: string; title: string; content: string; contentHtml?: string; order: number; imageUrl?: string };

export type TextStyles = Record<string, string>;

export type TextElementType = "title" | "heading" | "subheading" | "body";

type SelectedTextMeta = {
  sectionId: string;
  type: TextElementType;
  blockIndex?: number;
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
  color: "rgb(255, 255, 255)",
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
    textStyles?: Record<string, { title?: TextStyles; body?: TextStyles; blocks?: TextStyles[] }>;
  } | null;
  placedElements?: unknown[] | null;
  marketingAssets?: {
    productTitle?: string;
    productDescription?: string;
    hashtags?: string[];
    seoKeywords?: string[];
    thumbnailUrl?: string | null;
    updatedAt?: string;
  } | null;
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

const SELECTION_BLOCK_SELECTOR = "h1, h2, h3, h4, p, li";
const SELECTION_OUTLINE_STYLE = "2px dashed #f97316";
const SELECTION_OUTLINE_OFFSET = "2px";

function applySelectionOutline(el: HTMLElement) {
  el.style.setProperty("outline", SELECTION_OUTLINE_STYLE, "important");
  el.style.setProperty("outline-offset", SELECTION_OUTLINE_OFFSET, "important");
}
function clearSelectionOutline(el: HTMLElement) {
  el.style.removeProperty("outline");
  el.style.removeProperty("outline-offset");
}
function getBlockType(el: HTMLElement): "heading" | "subheading" | "body" {
  const tag = el.tagName.toUpperCase();
  if (tag === "H1" || tag === "H2") return "heading";
  if (tag === "H3" || tag === "H4") return "subheading";
  return "body";
}

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
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [product, setProduct] = useState<Product | null>(null);
  const [showCreatedBanner, setShowCreatedBanner] = useState(false);
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
  const [marketingGenerating, setMarketingGenerating] = useState(false);
  const [marketingRegenerating, setMarketingRegenerating] = useState(false);
  const [thumbnailTemplate, setThumbnailTemplate] = useState<ThumbnailTemplateId>("modern-gradient");
  const [thumbnailOrientation, setThumbnailOrientation] = useState<"horizontal" | "vertical">("horizontal");
  const [thumbnailGenerating, setThumbnailGenerating] = useState(false);
  const thumbnailCaptureRef = useRef<HTMLDivElement | null>(null);
  const [includeCover, setIncludeCover] = useState(true);
  const [includeBackPage, setIncludeBackPage] = useState(true);
  const previewPagesContainerRef = useRef<HTMLDivElement | null>(null);
  const { theme: dashboardTheme } = useDashboardTheme();
  const uiTheme = dashboardTheme;
  const [placedElementsByPage, setPlacedElementsByPage] = useState<PlacedElement[][]>([]);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [editingTextBoxId, setEditingTextBoxId] = useState<string | null>(null);
  const editingTextAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const editingTextBoxInitialContentRef = useRef<string>("");
  const [layoutSettings, setLayoutSettings] = useState(DEFAULT_LAYOUT);
  const [activeIconCategory, setActiveIconCategory] = useState<string>(Object.keys(ICON_CATEGORIES)[0] ?? "Business");
  const [iconSearch, setIconSearch] = useState("");
  const [activePaletteStyle, setActivePaletteStyle] = useState<string>(Object.keys(COLOR_PALETTES)[0] ?? "Professional");
  const [customColor, setCustomColor] = useState("#333333");
  const [graphicsAccentColor, setGraphicsAccentColor] = useState("#333333");
  const [photos, setPhotos] = useState<{ id: string; url?: string; fullUrl?: string; thumb?: string }[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [isLoadingMorePhotos, setIsLoadingMorePhotos] = useState(false);
  const [photoSearch, setPhotoSearch] = useState("");
  const [photoPage, setPhotoPage] = useState(1);
  const [photoTotalPages, setPhotoTotalPages] = useState(0);
  const [photoCurrentQuery, setPhotoCurrentQuery] = useState("");
  const [previewPhoto, setPreviewPhoto] = useState<{ id: string; url?: string; fullUrl?: string; thumb?: string } | null>(null);
  const [addImageModalOpen, setAddImageModalOpen] = useState(false);
  const [addImageTab, setAddImageTab] = useState<"stock" | "ai">("stock");
  const [unsplashQuery, setUnsplashQuery] = useState("");
  const [unsplashPhotos, setUnsplashPhotos] = useState<{ id: string; url?: string; fullUrl?: string; thumb?: string }[]>([]);
  const [unsplashLoading, setUnsplashLoading] = useState(false);
  const [unsplashPage, setUnsplashPage] = useState(1);
  const [unsplashTotalPages, setUnsplashTotalPages] = useState(0);
  const [aiImagePrompt, setAiImagePrompt] = useState("");
  const [aiImageUrl, setAiImageUrl] = useState<string | null>(null);
  const [aiImageLoading, setAiImageLoading] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [backgroundSettings, setBackgroundSettings] = useState<ImageSettings>(DEFAULT_IMAGE_SETTINGS);
  const [overlaySettings, setOverlaySettings] = useState<OverlaySettings>(DEFAULT_OVERLAY);
  const [pageBackgrounds, setPageBackgrounds] = useState<PageBackground[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [imageSettings, setImageSettings] = useState<ImageSettings>(DEFAULT_IMAGE_SETTINGS);
  const selectedTextRef = useRef<HTMLElement | null>(null);
  const contentAreaRef = useRef<HTMLDivElement | null>(null);
  const [selectedTextMeta, setSelectedTextMeta] = useState<SelectedTextMeta | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [undoStack, setUndoStack] = useState<EditorSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<EditorSnapshot[]>([]);
  const [coverBackHintDismissed, setCoverBackHintDismissed] = useState(false);
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
        let message: string | null = null;
        try {
          const body = await res.json();
          if (typeof (body as { error?: string }).error === "string") message = (body as { error: string }).error;
        } catch {
          // ignore
        }
        if (res.status === 404) setError(message ?? "Product not found");
        else if (res.status === 401) setError(message ?? "Please sign in again to view this product.");
        else setError(message ?? "Failed to load product");
        setLoading(false);
        return;
      }
      const data = (await res.json()) as Product;
      setProduct(data);
      setSections(data.content?.sections ?? []);
      const savedTemplate = ((data.designSettings as { template?: string })?.template ?? "modern") as TemplateId;
      setTemplate(savedTemplate);
      const byPage = (data.designSettings as { placedElementsByPage?: unknown[] })?.placedElementsByPage;
      const sectionsCountForPlaced = (data.content?.sections ?? []).length || 1;
      if (Array.isArray(byPage) && byPage.length > 0) {
        const parsed = byPage.map((pageArr) => (Array.isArray(pageArr) ? parsePlacedElements(pageArr) : []));
        if (parsed.length === sectionsCountForPlaced + 2) {
          setPlacedElementsByPage(parsed);
        } else {
          setPlacedElementsByPage([[], ...parsed, []]);
        }
      } else {
        const legacy = parsePlacedElements(data.placedElements ?? []);
        const contentOnly = legacy.length ? [legacy] : [[]];
        setPlacedElementsByPage([[], ...contentOnly, []]);
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
      let contentPages: PageBackground[];
      if (Array.isArray(ds?.pages) && ds.pages.length >= sectionsCount) {
        contentPages = ds.pages.slice(0, sectionsCount).map((p) => ({
          backgroundImage: p?.backgroundImage ?? null,
          backgroundSettings: p?.backgroundSettings ? { ...DEFAULT_IMAGE_SETTINGS, ...p.backgroundSettings } : undefined,
          overlaySettings: p?.overlaySettings ? { ...DEFAULT_OVERLAY, ...p.overlaySettings } : undefined,
        }));
      } else {
        contentPages = Array.from({ length: sectionsCount }, (_, i) =>
          i === 0 && legacyBgUrl
            ? {
                backgroundImage: legacyBgUrl,
                backgroundSettings: ds?.backgroundSettings ? { ...DEFAULT_IMAGE_SETTINGS, ...ds.backgroundSettings } : undefined,
                overlaySettings: ds?.overlaySettings ? { ...DEFAULT_OVERLAY, ...ds.overlaySettings } : undefined,
              }
            : {}
        );
      }
      const pages: PageBackground[] = [{}, ...contentPages, {}];
      setPageBackgrounds(pages);
      setCurrentPageIndex(0);
      setUndoStack([]);
      setRedoStack([]);
      const first = pages[0];
      setBackgroundImage(first?.backgroundImage ?? null);
      setBackgroundSettings(first?.backgroundSettings ? { ...DEFAULT_IMAGE_SETTINGS, ...first.backgroundSettings } : DEFAULT_IMAGE_SETTINGS);
      setOverlaySettings(first?.overlaySettings ? { ...DEFAULT_OVERLAY, ...first.overlaySettings } : DEFAULT_OVERLAY);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load product";
      setError(msg.startsWith("Failed") ? msg : `Failed to load product: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  useEffect(() => {
    if (searchParams.get("created") === "1") setShowCreatedBanner(true);
  }, [searchParams]);

  const totalPages = Math.max(2, sections.length + 2);

  useEffect(() => {
    setPageBackgrounds((prev) => {
      const need = totalPages;
      if (prev.length === need) return prev;
      const cover = prev[0] ?? {};
      const back = prev.length > 0 ? (prev[prev.length - 1] ?? {}) : {};
      const content = prev.length <= 2 ? Array.from({ length: sections.length }, () => ({})) : prev.slice(1, prev.length - 1);
      const next = [cover, ...content, back];
      while (next.length < need) next.splice(next.length - 1, 0, {});
      return next.slice(0, need);
    });
  }, [sections.length, totalPages]);

  useEffect(() => {
    const root = contentAreaRef.current;
    if (!root) return;
    const timer = setTimeout(() => {
      root.querySelectorAll("section[data-section-id]").forEach((sectionEl) => {
        const sectionId = sectionEl.getAttribute("data-section-id") ?? "";
        const preview = sectionEl.querySelector(".preview-content");
        if (!preview) return;
        const blocks = preview.querySelectorAll(SELECTION_BLOCK_SELECTOR);
        const blockStyles = product?.designSettings?.textStyles?.[sectionId]?.blocks ?? [];
        blocks.forEach((el, i) => {
          const textType = getBlockType(el as HTMLElement);
          (el as HTMLElement).setAttribute("data-section-id", sectionId);
          (el as HTMLElement).setAttribute("data-text-type", textType);
          (el as HTMLElement).setAttribute("data-block-index", String(i));
          (el as HTMLElement).style.cursor = "text";
          (el as HTMLElement).style.pointerEvents = "auto";
          const s = blockStyles[i];
          if (s && typeof s === "object") {
            if (s.color) (el as HTMLElement).style.color = s.color;
            if (s.fontSize) (el as HTMLElement).style.fontSize = s.fontSize;
            if (s.fontFamily) (el as HTMLElement).style.fontFamily = s.fontFamily;
            if (s.fontWeight) (el as HTMLElement).style.fontWeight = s.fontWeight;
            if (s.textAlign) (el as HTMLElement).style.textAlign = s.textAlign;
            if (s.lineHeight) (el as HTMLElement).style.lineHeight = s.lineHeight;
            if (s.textDecoration) (el as HTMLElement).style.textDecoration = s.textDecoration;
            if (s.textTransform) (el as HTMLElement).style.textTransform = s.textTransform;
            if (s.backgroundColor) (el as HTMLElement).style.backgroundColor = s.backgroundColor;
          }
        });
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [sections, product?.designSettings?.textStyles, currentPageIndex]);

  useEffect(() => {
    setPlacedElementsByPage((prev) => {
      const need = totalPages;
      if (prev.length === need) return prev;
      const cover = prev[0] ?? [];
      const back = prev.length > 0 ? (prev[prev.length - 1] ?? []) : [];
      const content = prev.length <= 2 ? Array.from({ length: sections.length }, () => [] as PlacedElement[]) : prev.slice(1, prev.length - 1);
      const next = [cover, ...content, back];
      while (next.length < need) next.splice(next.length - 1, 0, []);
      return next.slice(0, need);
    });
  }, [sections.length, totalPages]);

  useEffect(() => {
    const safeIndex = Math.min(currentPageIndex, Math.max(0, totalPages - 1));
    if (safeIndex !== currentPageIndex) setCurrentPageIndex(safeIndex);
  }, [currentPageIndex, totalPages]);

  const seededCoverBackRef = useRef<string | null>(null);
  useEffect(() => {
    if (!product?.id || placedElementsByPage.length < 2) return;
    if (seededCoverBackRef.current === product.id) return;
    const coverEmpty = (placedElementsByPage[0] ?? []).length === 0;
    const backEmpty = (placedElementsByPage[totalPages - 1] ?? []).length === 0;
    if (!coverEmpty && !backEmpty) return;
    seededCoverBackRef.current = product.id;
    const title = product.title ?? "Product";
    const subtitle = product.niche ? `A comprehensive guide to ${product.niche}` : "";
    setPlacedElementsByPage((prev) => {
      const next = prev.map((pageArr, idx) => {
        if (idx === 0 && pageArr.length === 0) {
          const coverEls: PlacedElement[] = [
            { id: "cover-title", type: "text", content: title, position: { x: CANVAS_WIDTH / 2 - 200, y: 380 }, size: { width: 400, height: 80 }, rotation: 0, zIndex: 1, textSettings: { ...DEFAULT_TEXT_BOX, fontSize: 32, textAlign: "center" } },
            { id: "cover-footer", type: "text", content: "Created with Content Flywheel", position: { x: CANVAS_WIDTH / 2 - 150, y: 1000 }, size: { width: 300, height: 24 }, rotation: 0, zIndex: 2, textSettings: { ...DEFAULT_TEXT_BOX, fontSize: 14, textAlign: "center" } },
          ];
          if (subtitle) coverEls.splice(1, 0, { id: "cover-subtitle", type: "text", content: subtitle, position: { x: CANVAS_WIDTH / 2 - 200, y: 480 }, size: { width: 400, height: 40 }, rotation: 0, zIndex: 1, textSettings: { ...DEFAULT_TEXT_BOX, fontSize: 18, textAlign: "center" } });
          return coverEls;
        }
        if (idx === totalPages - 1 && pageArr.length === 0) {
          return [
            { id: "back-thanks", type: "text", content: "Thank you", position: { x: CANVAS_WIDTH / 2 - 200, y: 350 }, size: { width: 400, height: 36 }, rotation: 0, zIndex: 1, textSettings: { ...DEFAULT_TEXT_BOX, fontSize: 22, textAlign: "center" } },
            { id: "back-msg", type: "text", content: "Thank you for using this resource!", position: { x: CANVAS_WIDTH / 2 - 200, y: 420 }, size: { width: 400, height: 28 }, rotation: 0, zIndex: 1, textSettings: { ...DEFAULT_TEXT_BOX, fontSize: 16, textAlign: "center" } },
            { id: "back-url", type: "text", content: "Visit contentflywheel.com", position: { x: CANVAS_WIDTH / 2 - 200, y: 500 }, size: { width: 400, height: 24 }, rotation: 0, zIndex: 1, textSettings: { ...DEFAULT_TEXT_BOX, fontSize: 14, textAlign: "center" } },
            { id: "back-brand", type: "text", content: "Created with Content Flywheel", position: { x: CANVAS_WIDTH / 2 - 150, y: 620 }, size: { width: 300, height: 20 }, rotation: 0, zIndex: 1, textSettings: { ...DEFAULT_TEXT_BOX, fontSize: 12, textAlign: "center" } },
          ];
        }
        return pageArr;
      });
      return next;
    });
  }, [product?.id, product?.title, product?.niche, placedElementsByPage.length, totalPages]);

  useEffect(() => {
    const page = pageBackgrounds[currentPageIndex];
    setBackgroundImage(page?.backgroundImage ?? null);
    setBackgroundSettings(page?.backgroundSettings ? { ...DEFAULT_IMAGE_SETTINGS, ...page.backgroundSettings } : DEFAULT_IMAGE_SETTINGS);
    setOverlaySettings(page?.overlaySettings ? { ...DEFAULT_OVERLAY, ...page.overlaySettings } : DEFAULT_OVERLAY);
  }, [currentPageIndex, pageBackgrounds]);

  useEffect(() => {
    setCoverBackHintDismissed(false);
  }, [currentPageIndex]);

  const isOnCoverPage = currentPageIndex === 0;
  const isOnBackPage = currentPageIndex === totalPages - 1;
  const showCoverBackHint = !coverBackHintDismissed && (isOnCoverPage || isOnBackPage);

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
      marketingAssets?: Record<string, unknown>;
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
    if (idx < 0) return;
    const nextSections = sections.filter((s) => s.id !== sectionToDeleteId);
    const contentPageIndex = idx + 1;
    const nextPageBackgrounds = [...pageBackgrounds.slice(0, contentPageIndex), ...pageBackgrounds.slice(contentPageIndex + 1)];
    const nextPlacedByPage = [...placedElementsByPage.slice(0, contentPageIndex), ...placedElementsByPage.slice(contentPageIndex + 1)];
    setSections(nextSections);
    setPageBackgrounds(nextPageBackgrounds.length ? nextPageBackgrounds : [{}, {}]);
    setPlacedElementsByPage(nextPlacedByPage.length ? nextPlacedByPage : [[], []]);
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

  const searchPhotos = useCallback(
    async (query?: string, page = 1, append = false) => {
      const q = (query ?? photoSearch).trim() || "nature";
      const isNewSearch = !append || page === 1;
      if (isNewSearch) setIsLoadingPhotos(true);
      else setIsLoadingMorePhotos(true);
      try {
        const res = await fetch(
          `/api/stock-photos?query=${encodeURIComponent(q)}&per_page=24&page=${page}`
        );
        if (!res.ok) throw new Error("Failed to fetch");
        const data = (await res.json()) as {
          photos?: { id: string; url?: string; fullUrl?: string; thumb?: string }[];
          total?: number;
          totalPages?: number;
        };
        const newPhotos = data.photos ?? [];
        setPhotoCurrentQuery(q);
        setPhotoPage(page);
        setPhotoTotalPages(data.totalPages ?? 0);
        setPhotos((prev) => (append && page > 1 ? [...prev, ...newPhotos] : newPhotos));
      } catch {
        if (isNewSearch) setPhotos([]);
        toast({ title: "Could not load photos", variant: "destructive" });
      } finally {
        setIsLoadingPhotos(false);
        setIsLoadingMorePhotos(false);
      }
    },
    [photoSearch, toast]
  );

  const loadMorePhotos = useCallback(() => {
    if (photoTotalPages <= photoPage || isLoadingMorePhotos) return;
    searchPhotos(photoCurrentQuery || undefined, photoPage + 1, true);
  }, [photoPage, photoTotalPages, photoCurrentQuery, isLoadingMorePhotos, searchPhotos]);

  const searchUnsplash = useCallback(
    async (query?: string, page = 1) => {
      const q = (query ?? unsplashQuery).trim() || "nature";
      setUnsplashLoading(true);
      try {
        let res = await fetch(
          `/api/unsplash-photos?query=${encodeURIComponent(q)}&per_page=24&page=${page}`
        );
        let data = (await res.json()) as {
          photos?: { id: string; url?: string; fullUrl?: string; thumb?: string }[];
          totalPages?: number;
        };
        if (!res.ok && res.status === 503) {
          res = await fetch(
            `/api/stock-photos?query=${encodeURIComponent(q)}&per_page=24&page=${page}`
          );
          data = (await res.json()) as typeof data;
        }
        if (!res.ok) throw new Error("Failed to fetch");
        setUnsplashPhotos(data.photos ?? []);
        setUnsplashPage(page);
        setUnsplashTotalPages(data.totalPages ?? 0);
      } catch {
        setUnsplashPhotos([]);
        toast({ title: "Could not load photos", description: "Configure UNSPLASH_ACCESS_KEY or PEXELS_API_KEY in env.", variant: "destructive" });
      } finally {
        setUnsplashLoading(false);
      }
    },
    [unsplashQuery, toast]
  );

  const generateAiImage = useCallback(async () => {
    const prompt = aiImagePrompt.trim();
    if (!prompt) {
      toast({ title: "Enter a prompt", variant: "destructive" });
      return;
    }
    setAiImageLoading(true);
    setAiImageUrl(null);
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      if (data.url) setAiImageUrl(data.url);
      else throw new Error("No image URL returned");
    } catch (err) {
      toast({ title: "AI image failed", description: err instanceof Error ? err.message : "Try again.", variant: "destructive" });
    } finally {
      setAiImageLoading(false);
    }
  }, [aiImagePrompt, toast]);

  const addImageToCanvasAndClose = useCallback(
    (url: string) => {
      handleAddPhoto(url);
      setAddImageModalOpen(false);
      setAiImageUrl(null);
      setAiImagePrompt("");
    },
    [handleAddPhoto]
  );

  useEffect(() => {
    if (addImageModalOpen && addImageTab === "stock" && unsplashPhotos.length === 0 && !unsplashLoading) {
      searchUnsplash("nature");
    }
  }, [addImageModalOpen, addImageTab]); // eslint-disable-line react-hooks/exhaustive-deps -- only run when modal/tab opens

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

  useEffect(() => {
    if (editingTextBoxId) {
      editingTextAreaRef.current?.focus();
      const len = editingTextAreaRef.current?.value?.length ?? 0;
      editingTextAreaRef.current?.setSelectionRange(len, len);
    }
  }, [editingTextBoxId]);

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

  const saveTextBoxContentById = useCallback(
    (elementId: string, content: string) => {
      recordUndoDebounced();
      setCurrentPageElements((prev) =>
        prev.map((el) => (el.id === elementId && el.type === "text" ? { ...el, content } : el))
      );
      setEditingTextBoxId(null);
    },
    [recordUndoDebounced, setCurrentPageElements]
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
    const nextPages = Array.from({ length: totalPages }, () => ({ ...currentBg }));
    setPageBackgrounds(nextPages);
    saveToServer({ designSettings: { ...product?.designSettings, pages: nextPages } });
    toast({ title: "Background applied to all pages" });
  }, [totalPages, backgroundImage, backgroundSettings, overlaySettings, product?.designSettings, saveToServer, toast, recordUndo]);

  const applyGraphicsToAllPages = useCallback(() => {
    recordUndo();
    const currentGraphics = currentPageElements.map((e) => ({ ...e }));
    const nextByPage = Array.from({ length: totalPages }, (_, i) =>
      currentGraphics.map((e) => ({ ...e, id: `${e.type}-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}` }))
    );
    setPlacedElementsByPage(nextByPage);
    saveToServer({ designSettings: { ...product?.designSettings, placedElementsByPage: nextByPage } });
    toast({ title: "Graphics applied to all pages" });
  }, [totalPages, currentPageElements, product?.designSettings, saveToServer, toast, recordUndo]);

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
    toast({ title: "Icon applied to all pages" });
  }, [selectedGraphicElement, currentPageIndex, placedElementsByPage, product?.designSettings, saveToServer, toast, recordUndo]);

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
      const blockEl = (e.target as HTMLElement).closest("h1, h2, h3, h4, p, li") as HTMLElement | null;
      if (!blockEl) return;
      e.stopPropagation();

      const root = contentAreaRef.current;
      if (root) {
        root.querySelectorAll("[data-selected]").forEach((el) => {
          (el as HTMLElement).style.outline = "";
          (el as HTMLElement).style.outlineOffset = "";
          (el as HTMLElement).removeAttribute("data-selected");
        });
      }
      if (selectedTextRef.current) clearSelectionOutline(selectedTextRef.current);

      blockEl.style.outline = "2px dashed #f97316";
      blockEl.style.outlineOffset = "2px";
      blockEl.setAttribute("data-selected", "true");
      selectedTextRef.current = blockEl;

      const sectionEl = blockEl.closest("section[data-section-id]");
      const sectionId =
        blockEl.getAttribute("data-section-id") ??
        sectionEl?.getAttribute("data-section-id") ??
        "";

      let type: TextElementType;
      let blockIndex: number | undefined;
      const dataTextType = blockEl.getAttribute("data-text-type");
      if (dataTextType) {
        type = dataTextType as TextElementType;
      } else if (blockEl.closest(".preview-content")) {
        type = getBlockType(blockEl);
        const preview = blockEl.closest(".preview-content");
        const blocks = preview ? preview.querySelectorAll("h1, h2, h3, h4, p, li") : [];
        blockIndex = Array.prototype.indexOf.call(blocks, blockEl);
      } else {
        type = getBlockType(blockEl);
      }

      const comp = window.getComputedStyle(blockEl);
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
        blockIndex,
        content: type === "title" || type === "heading" ? blockEl.textContent ?? "" : blockEl.innerHTML,
        styles,
      });
    },
    []
  );

  const persistTextStyles = useCallback(
    (sectionId: string, type: TextElementType, styles: TextStyles, blockIndex?: number) => {
      setProduct((p) => {
        if (!p) return null;
        const prevSection = p.designSettings?.textStyles?.[sectionId] ?? { title: {} as TextStyles, body: {} as TextStyles };
        const nextSection = { ...prevSection };
        if (blockIndex !== undefined && (type === "heading" || type === "subheading" || type === "body")) {
          const blocks = Array.isArray(prevSection.blocks) ? [...prevSection.blocks] : [];
          while (blocks.length <= blockIndex) blocks.push({} as TextStyles);
          blocks[blockIndex] = styles;
          nextSection.blocks = blocks;
        } else if (sectionId === "__product_title" && type === "heading") {
          nextSection.title = styles;
        } else {
          nextSection[type === "title" ? "title" : "body"] = styles;
        }
        const next = {
          ...p,
          designSettings: {
            ...p.designSettings,
            textStyles: {
              ...p.designSettings?.textStyles,
              [sectionId]: nextSection,
            },
          },
        } as Product;
        queueMicrotask(() => saveToServer({ designSettings: next.designSettings }));
        return next;
      });
    },
    [saveToServer]
  );

  const updateTextStyle = useCallback(
    (property: string, value: string) => {
      if (!selectedTextRef.current || !selectedTextMeta) return;
      const el = selectedTextRef.current;
      (el.style as unknown as Record<string, string>)[property] = value;
      setSelectedTextMeta((prev) => (prev ? { ...prev, styles: { ...prev.styles, [property]: value } } : null));
      persistTextStyles(selectedTextMeta.sectionId, selectedTextMeta.type, { ...selectedTextMeta.styles, [property]: value }, selectedTextMeta.blockIndex);
    },
    [selectedTextMeta, persistTextStyles]
  );

  const updateTextContent = useCallback(
    (newContent: string) => {
      if (!selectedTextRef.current || !selectedTextMeta) return;
      const { sectionId, type, blockIndex } = selectedTextMeta;
      if (sectionId === "__product_title" && type === "heading") {
        setProduct((p) => (p ? { ...p, title: newContent } : null));
        selectedTextRef.current.textContent = newContent;
        setSelectedTextMeta((prev) => (prev ? { ...prev, content: newContent } : null));
        saveToServer({ title: newContent });
        return;
      }
      if (type === "title") {
        const nextSections = sections.map((s) => (s.id === sectionId ? { ...s, title: newContent } : s));
        setSections(nextSections);
        selectedTextRef.current.textContent = newContent;
        setSelectedTextMeta((prev) => (prev ? { ...prev, content: newContent } : null));
        saveToServer({ content: { sections: nextSections } });
        return;
      }
      if (blockIndex !== undefined && (type === "heading" || type === "subheading" || type === "body")) {
        selectedTextRef.current.innerHTML = newContent;
        setSelectedTextMeta((prev) => (prev ? { ...prev, content: newContent } : null));
        const section = sections.find((s) => s.id === sectionId);
        if (section) {
          const container = selectedTextRef.current.closest(".preview-content") ?? selectedTextRef.current.parentElement;
          const fullHtml = container?.innerHTML ?? section.contentHtml ?? "";
          const nextSections = sections.map((s) => (s.id === sectionId ? { ...s, contentHtml: fullHtml } : s));
          setSections(nextSections);
          saveToServer({ content: { sections: nextSections } });
        }
        return;
      }
      const bodyHtml =
        type === "body" && newContent.trim()
          ? `<p>${newContent.trim().replace(/\n/g, "</p><p>")}</p>`
          : newContent;
      const nextSections = sections.map((s) => (s.id === sectionId ? { ...s, contentHtml: bodyHtml } : s));
      setSections(nextSections);
      const inner = selectedTextRef.current.querySelector(".preview-content");
      const toSet = bodyHtml;
      if (inner) inner.innerHTML = toSet;
      else selectedTextRef.current.innerHTML = `<div class="preview-content">${toSet}</div>`;
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
    persistTextStyles(selectedTextMeta.sectionId, selectedTextMeta.type, nextStyles, selectedTextMeta.blockIndex);
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
    contentAreaRef.current?.querySelectorAll("[data-selected]").forEach((el) => {
      (el as HTMLElement).style.outline = "";
      (el as HTMLElement).style.outlineOffset = "";
      (el as HTMLElement).removeAttribute("data-selected");
    });
    if (selectedTextRef.current) {
      clearSelectionOutline(selectedTextRef.current);
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
      const currentFormat = (product?.format ?? "").toLowerCase().trim();

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

      // PDF export: client-side html2canvas + jsPDF (capture editor canvas as-is, no server)
      const container = previewPagesContainerRef.current;
      if (!container) {
        throw new Error("Preview not ready. Try again in a moment.");
      }
      await new Promise((r) => setTimeout(r, 150));
      const blob = await captureCanvasPagesToPdf(container);
      const fileName = currentFormat === "spreadsheet" ? `${safeName}-tutorial.pdf` : `${safeName}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      toast({
        title: currentFormat === "spreadsheet" ? "Tutorial PDF downloaded" : "PDF downloaded",
        description: `Saved as ${fileName}`,
      });
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

  const handleGenerateVideos = useCallback(() => {
    const title = product?.title ?? "";
    const description = (product?.marketingAssets as { productDescription?: string } | undefined)?.productDescription ?? "";
    const niche = product?.niche ?? "";
    try {
      sessionStorage.setItem(
        "digitalProductForm",
        JSON.stringify({
          productName: title,
          productDescription: description,
          productType: "digital",
          productFileOrLinkMode: "file",
          hasFile: true,
          fileName: `${title.replace(/\s+/g, "-") || "product"}.pdf`,
        })
      );
      sessionStorage.setItem(
        "productContextForVideos",
        JSON.stringify({ productId, productName: title, productDescription: description, niche })
      );
    } catch {
      // ignore
    }
    router.push(`/dashboard/digital-products/scripts?productId=${encodeURIComponent(productId)}&intent=video-guide`);
  }, [productId, product?.title, product?.niche, product?.marketingAssets, router]);

  const marketingAssets = (product?.marketingAssets ?? {}) as {
    productTitle?: string;
    productDescription?: string;
    hashtags?: string[];
    seoKeywords?: string[];
    thumbnailUrl?: string | null;
    thumbnailStyle?: ThumbnailTemplateId;
  };

  const handleGenerateThumbnail = useCallback(async () => {
    if (!productId) return;
    setThumbnailGenerating(true);
    try {
      const title = product?.title ?? "";
      const subtitle = product?.niche ?? (marketingAssets as { productDescription?: string })?.productDescription?.slice(0, 120) ?? "";
      const productType = product?.format ?? "Digital Product";
      const res = await fetch("/api/generate-thumbnail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          subtitle,
          style: thumbnailTemplate,
          productType,
          orientation: thumbnailOrientation,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = typeof data?.error === "string" ? data.error : "Thumbnail generation failed. Please try again.";
        throw new Error(msg);
      }
      const url = data?.url;
      if (!url || typeof url !== "string") {
        throw new Error("No image URL returned. Please try again.");
      }
      const orientation = data.orientation === "vertical" ? "vertical" : "horizontal";
      setProduct((p) => (p ? { ...p, marketingAssets: { ...p.marketingAssets, thumbnailUrl: url, thumbnailStyle: data.style ?? thumbnailTemplate, thumbnailOrientation: orientation } } : null));
      saveToServer({ marketingAssets: { ...marketingAssets, thumbnailUrl: url, thumbnailStyle: data.style ?? thumbnailTemplate, thumbnailOrientation: orientation } });
      toast({
        title: "Thumbnail generated",
        description: "Download it soon—the image link may expire in about an hour.",
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Thumbnail generation failed. Please try again.";
      toast({ title: "Thumbnail failed", description: message, variant: "destructive" });
    } finally {
      setThumbnailGenerating(false);
    }
  }, [productId, product, thumbnailTemplate, thumbnailOrientation, marketingAssets, saveToServer, toast]);

  const handleGenerateMarketingAssets = useCallback(async () => {
    if (!productId) return;
    setMarketingGenerating(true);
    try {
      const res = await fetch(`/api/products/${productId}/marketing-assets`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "Failed to generate");
      setProduct((p) => (p ? { ...p, marketingAssets: data } : null));
      toast({ title: "Marketing assets generated", description: "Edit any field and save. Use Copy to paste into Etsy, Gumroad, etc." });
    } catch (e) {
      toast({ title: "Generation failed", description: e instanceof Error ? e.message : "Something went wrong", variant: "destructive" });
    } finally {
      setMarketingGenerating(false);
    }
  }, [productId, toast]);

  const handleRegenerateDescription = useCallback(async () => {
    if (!productId) return;
    setMarketingRegenerating(true);
    try {
      const res = await fetch(`/api/products/${productId}/marketing-assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerateDescription: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "Failed to regenerate");
      setProduct((p) => (p ? { ...p, marketingAssets: { ...p.marketingAssets, ...data } } : null));
      toast({ title: "Description regenerated" });
    } catch (e) {
      toast({ title: "Regenerate failed", description: e instanceof Error ? e.message : "Something went wrong", variant: "destructive" });
    } finally {
      setMarketingRegenerating(false);
    }
  }, [productId, toast]);

  const saveMarketingEdits = useCallback(
    (updates: Partial<typeof marketingAssets>) => {
      const next = { ...marketingAssets, ...updates };
      setProduct((p) => (p ? { ...p, marketingAssets: next } : null));
      saveToServer({ marketingAssets: next });
    },
    [marketingAssets, saveToServer]
  );

  const copyToClipboard = useCallback(
    (text: string, label: string) => {
      navigator.clipboard.writeText(text).then(
        () => toast({ title: "Copied", description: `${label} copied to clipboard` }),
        () => toast({ title: "Copy failed", variant: "destructive" })
      );
    },
    [toast]
  );

  const hasDalleThumbnail = !!marketingAssets.thumbnailUrl;
  const effectiveOrientation = (marketingAssets as { thumbnailOrientation?: "horizontal" | "vertical" }).thumbnailOrientation ?? thumbnailOrientation;
  const thumbCaptureWidth = effectiveOrientation === "vertical" ? 1024 : hasDalleThumbnail ? 1792 : 1600;
  const thumbCaptureHeight = effectiveOrientation === "vertical" ? 1792 : hasDalleThumbnail ? 1024 : 1200;

  const handleDownloadThumbnail = useCallback(async () => {
    const thumbUrl = marketingAssets.thumbnailUrl;
    const filename = `${(product?.title ?? "product").replace(/\s+/g, "-")}-thumbnail.png`;

    if (thumbUrl && (thumbUrl.startsWith("http://") || thumbUrl.startsWith("https://"))) {
      try {
        const res = await fetch(thumbUrl, { mode: "cors" });
        if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: "Thumbnail downloaded", description: "Image saved." });
      } catch (e) {
        toast({
          title: "Download failed",
          description: e instanceof Error ? e.message : "Could not download image. The link may have expired.",
          variant: "destructive",
        });
      }
      return;
    }

    const el = thumbnailCaptureRef.current;
    if (!el) {
      toast({ title: "Download failed", description: "Thumbnail not ready.", variant: "destructive" });
      return;
    }
    try {
      const canvas = await html2canvas(el, {
        scale: 1,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        width: thumbCaptureWidth,
        height: thumbCaptureHeight,
        windowWidth: thumbCaptureWidth,
        windowHeight: thumbCaptureHeight,
      });
      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          a.click();
          URL.revokeObjectURL(url);
          toast({ title: "Thumbnail downloaded", description: `${thumbCaptureWidth}×${thumbCaptureHeight} PNG saved.` });
        },
        "image/png",
        1
      );
    } catch (e) {
      toast({ title: "Download failed", description: e instanceof Error ? e.message : "Could not generate thumbnail", variant: "destructive" });
    }
  }, [product?.title, marketingAssets.thumbnailUrl, thumbCaptureWidth, thumbCaptureHeight, toast]);

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
        <p className="text-sm text-gray-600 mt-2">If the product was moved or deleted, use Back. Otherwise try again or sign in again.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button type="button" variant="outline" size="sm" onClick={() => { setError(null); setLoading(true); fetchProduct(); }}>
            Try again
          </Button>
          <Link href="/dashboard/digital-products" className="text-orange-500 inline-flex items-center hover:underline">
            ← Back to Digital Products
          </Link>
        </div>
      </main>
    );
  }

  const dsBg = (product?.designSettings as { backgroundImage?: string } | undefined)?.backgroundImage;
  const canvasBgUrl = (typeof backgroundImage === "string" ? backgroundImage.trim() : "") || (typeof dsBg === "string" ? dsBg.trim() : "") || null;

  const templatePreset = TEMPLATE_PRESETS[(template as TemplateId) || "modern"] ?? TEMPLATE_PRESETS.modern;
  const previewLayoutStyle: React.CSSProperties = {
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
    <div
      className={`flex flex-col h-full min-h-0 overflow-hidden font-sans ${isDark ? "bg-[#0F0F0F] text-gray-100 editor-dark" : "bg-gray-100 text-gray-900"}`}
      data-theme={uiTheme}
      role="main"
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
            [data-canvas-background] {
              position: absolute !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important;
              width: 100% !important; height: 100% !important; overflow: hidden !important; padding: 0 !important; margin: 0 !important;
              pointer-events: none !important;
            }
            [data-canvas-background-img] {
              display: block !important; visibility: visible !important;
              position: absolute !important; top: 0 !important; left: 0 !important;
              width: 100% !important; height: 100% !important; object-fit: cover !important;
              pointer-events: none !important;
            }
            .product-editor-preview-layout { color: #1a1a1a; }
            .product-editor-preview-layout p { margin-bottom: var(--paragraph-spacing, 1rem); line-height: var(--line-height, 1.6); text-align: var(--text-align, left); }
            .product-editor-preview-layout h2 { margin-top: calc(var(--section-spacing, 2rem) * 1.5); margin-bottom: calc(var(--paragraph-spacing, 1rem) * 1.5); text-align: var(--text-align, left); }
            .product-editor-preview-layout h3 { margin-top: calc(var(--section-spacing, 2rem) * 0.75); margin-bottom: calc(var(--paragraph-spacing, 1rem) * 0.75); text-align: var(--text-align, left); }
            .product-editor-preview-layout .preview-content h1,
            .product-editor-preview-layout .preview-content h2,
            .product-editor-preview-layout .preview-content h3,
            .product-editor-preview-layout .preview-content h4,
            .product-editor-preview-layout .preview-content p,
            .product-editor-preview-layout .preview-content li { cursor: pointer; pointer-events: auto; }
            .product-editor-preview-layout section { margin-bottom: var(--section-spacing, 2rem); }
            .product-editor-preview-layout ul, .product-editor-preview-layout ol { margin-bottom: var(--paragraph-spacing, 1rem); padding-left: 1.5rem; text-align: var(--text-align, left); }
            .product-editor-preview-layout li { margin-bottom: 0.5rem; }
          `,
        }}
      />
      {/* Header - minimal Canva-style toolbar */}
      <header className={`shrink-0 sticky top-0 z-40 border-b backdrop-blur-sm shadow-sm ${isDark ? "border-[#2A2A2A] bg-[#0F0F0F]/95" : "border-gray-200 bg-white/95"}`}>
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
                  <Button size="sm" variant="ghost" className="text-gray-400 hover:text-white hover:bg-[#2A2A2A]" onClick={() => setShowFullPreview(true)}>
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

      {showCreatedBanner && (
        <div className={`flex items-center justify-between gap-4 px-4 py-3 border-b ${isDark ? "bg-orange-500/10 border-orange-500/30" : "bg-orange-50 border-orange-200"}`}>
          <p className={`text-sm font-medium ${isDark ? "text-orange-200" : "text-orange-900"}`}>
            🎬 Your product is ready! Now get a Video Creation Guide to promote it
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white gap-1.5" onClick={handleGenerateVideos}>
              <Video className="w-3.5 h-3.5" /> Create Video Guide →
            </Button>
            <Button size="sm" variant="ghost" className={isDark ? "text-orange-200 hover:bg-orange-500/20" : "text-orange-800 hover:bg-orange-100"} onClick={() => setShowCreatedBanner(false)} aria-label="Dismiss">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Center content area - scrollable */}
        <div className={`flex-1 min-w-0 overflow-y-auto ${isDark ? "bg-[#0F0F0F]" : "bg-gray-100"}`}>
          <div className="flex flex-col items-center px-4 py-8">
              {/* Toolbar above canvas */}
              <div className="flex items-center justify-between w-full max-w-[816px] mb-4">
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
                {totalPages > 1 ? (
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border shadow-sm ${isDark ? "bg-[#1A1A1A] border-[#2A2A2A]" : "bg-white border-gray-200"}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTextBoxId(null);
                        setCurrentPageIndex((i) => Math.max(0, i - 1));
                      }}
                      disabled={currentPageIndex <= 0}
                      className={`p-1 rounded disabled:opacity-40 disabled:cursor-not-allowed ${isDark ? "text-gray-400 hover:text-white hover:bg-[#2A2A2A]" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"}`}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className={`text-sm font-medium min-w-[80px] text-center ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                      {currentPageIndex + 1} / {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTextBoxId(null);
                        setCurrentPageIndex((i) => Math.min(totalPages - 1, i + 1));
                      }}
                      disabled={currentPageIndex >= totalPages - 1}
                      className={`p-1 rounded disabled:opacity-40 disabled:cursor-not-allowed ${isDark ? "text-gray-400 hover:text-white hover:bg-[#2A2A2A]" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"}`}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                ) : null}
              </div>
              {/* Outer card (max 928px) — always document-like (white/light) regardless of app theme */}
              <div
                className="relative w-full max-w-[928px] mx-auto my-8 rounded-lg shadow-lg overflow-hidden bg-white border border-gray-200"
                style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)" }}
              >
                {showCoverBackHint ? (
                  <div
                    role="status"
                    className="absolute top-0 left-0 right-0 z-30 px-4 py-3 bg-amber-50 border-b border-amber-200 text-amber-900 text-sm text-center cursor-pointer hover:bg-amber-100/80 transition-colors"
                    onClick={() => setCoverBackHintDismissed(true)}
                  >
                    {isOnCoverPage
                      ? "This is your cover page — add a background image, title and your branding using the panels on the right."
                      : "This is your back cover — add your website, social links or a call to action."}
                  </div>
                ) : null}
                {canvasBgUrl ? (
                  <>
                    <div
                      data-canvas-background
                      className="absolute inset-0 overflow-hidden"
                      style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }}
                      aria-hidden
                    >
                      <img
                        data-canvas-background-img
                        src={canvasBgUrl}
                        alt=""
                        fetchPriority="high"
                        decoding="async"
                        className="block w-full h-full object-cover"
                        style={{
                          pointerEvents: "none",
                          objectPosition: backgroundSettings.position ?? "center center",
                          opacity: backgroundSettings.opacity ?? 1,
                          filter: (backgroundSettings.blur ?? 0) > 0
                            ? `blur(${backgroundSettings.blur}px) brightness(${backgroundSettings.brightness ?? 100}%) contrast(${backgroundSettings.contrast ?? 100}%) saturate(${backgroundSettings.saturation ?? 100}%)`
                            : `brightness(${backgroundSettings.brightness ?? 100}%) contrast(${backgroundSettings.contrast ?? 100}%) saturate(${backgroundSettings.saturation ?? 100}%)`,
                        }}
                        draggable={false}
                        aria-hidden
                      />
                    </div>
                    <div
                      className="absolute inset-0"
                      style={{
                        position: "absolute",
                        inset: 0,
                        zIndex: 1,
                        pointerEvents: "none",
                        backgroundColor: overlaySettings.color,
                        opacity: overlaySettings.opacity ?? 0.9,
                      }}
                      aria-hidden
                    />
                  </>
                ) : null}
                {/* Page container — overflow-visible so selection outline is not clipped */}
                <div
                  className="relative text-[#1A1A1A] overflow-visible"
                  style={{
                    position: "relative",
                    zIndex: 10,
                    width: "100%",
                    minHeight: CANVAS_HEIGHT,
                    padding: 0,
                    margin: 0,
                    boxSizing: "border-box",
                    fontFamily: "var(--font-sans), sans-serif",
                    backgroundColor: canvasBgUrl ? "transparent" : "#ffffff",
                  }}
                  onClick={() => {
                    setSelectedElement(null);
                    setEditingTextBoxId(null);
                    deselectText();
                    setCoverBackHintDismissed(true);
                  }}
                  role="presentation"
                >
                  <div
                    className="absolute left-0 right-0 bottom-0 py-2 text-center text-[11px] text-gray-500 pointer-events-none select-none"
                    style={{ opacity: 0.45, zIndex: 15 }}
                    aria-hidden
                  >
                    Created with Content Flywheel
                  </div>
                  <div
                    ref={contentAreaRef}
                    className={`relative z-10 product-editor-preview-layout ${product.format === "workbook" ? "format-workbook" : ""}`}
                    style={{
                      ...previewLayoutStyle,
                      position: "relative",
                      zIndex: 10,
                      pointerEvents: "auto",
                      ...(canvasBgUrl ? { backgroundColor: "transparent" } : {}),
                      minHeight: CANVAS_HEIGHT,
                    }}
                    onClick={(e) => {
                      handleTextClick(e);
                      e.stopPropagation();
                    }}
                  >
                    {currentPageIndex === 0 || currentPageIndex === totalPages - 1 ? (
                      <div className="min-h-[var(--canvas-height,1100px)] w-full" style={{ minHeight: CANVAS_HEIGHT }} aria-label={currentPageIndex === 0 ? "Cover page" : "Back cover"} />
                    ) : (
                      <>
                        <h2
                          data-section-id="__product_title"
                          data-text-type="heading"
                          className="text-2xl font-bold border-b pb-2 cursor-pointer select-text"
                          style={{
                            ...(product.designSettings?.textStyles?.["__product_title"]?.title ?? {}),
                            color: product.designSettings?.textStyles?.["__product_title"]?.title?.color ?? templatePreset.titleColor,
                          }}
                        >
                          {product.title}
                        </h2>
                        {(sections[currentPageIndex - 1] ? [sections[currentPageIndex - 1]] : []).map((section) => {
                          const titleStyles = product.designSettings?.textStyles?.[section.id]?.title;
                          const bodyStyles = product.designSettings?.textStyles?.[section.id]?.body;
                          return (
                            <section key={section.id} data-section-id={section.id}>
                              <h3
                                data-section-id={section.id}
                                data-text-type="title"
                                className="text-lg font-semibold cursor-pointer select-text"
                                style={{ ...titleStyles, color: titleStyles?.color ?? templatePreset.headingColor }}
                              >
                                {section.title}
                              </h3>
                              {section.imageUrl?.trim() ? (
                                <div className="my-4 flex justify-center">
                                  <img
                                    src={section.imageUrl}
                                    alt=""
                                    className="max-w-full max-h-80 object-contain rounded-lg shadow-md"
                                  />
                                </div>
                              ) : null}
                              <div
                                data-section-id={section.id}
                                data-text-type="body"
                                className="mt-2 prose prose-sm max-w-none prose-p:mb-4 prose-p:leading-relaxed prose-headings:mb-4 prose-headings:mt-6 prose-ul:mb-4 prose-ol:mb-4 prose-li:mb-2 cursor-text"
                                style={{ ...bodyStyles, color: bodyStyles?.color ?? templatePreset.bodyColor }}
                                onClick={(e) => {
                                  const target = (e.target as HTMLElement).closest("h1, h2, h3, h4, p, li");
                                  if (target) {
                                    (target as HTMLElement).style.outline = "2px dashed #f97316";
                                    (target as HTMLElement).style.outlineOffset = "2px";
                                  }
                                }}
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
                      </>
                    )}
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
                          disableDragging={element.type === "text" && editingTextBoxId === element.id}
                          className={`pointer-events-auto ${element.type === "text" && editingTextBoxId === element.id ? "cursor-text" : "cursor-move"} ${selectedElement === element.id ? "ring-2 ring-orange-500 ring-offset-1" : ""}`}
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
                              editingTextBoxId === element.id ? (
                                <textarea
                                  ref={(el) => {
                                    editingTextAreaRef.current = el;
                                  }}
                                  className="w-full h-full overflow-auto p-1 resize-none bg-white/95 border border-orange-400 rounded outline-none"
                                  style={{
                                    fontSize: element.textSettings?.fontSize ?? DEFAULT_TEXT_BOX.fontSize,
                                    fontFamily: element.textSettings?.fontFamily ?? DEFAULT_TEXT_BOX.fontFamily,
                                    color: element.textSettings?.color ?? DEFAULT_TEXT_BOX.color,
                                    textAlign: element.textSettings?.textAlign ?? DEFAULT_TEXT_BOX.textAlign,
                                    wordBreak: "break-word",
                                  }}
                                  value={element.content}
                                  onChange={(e) => {
                                    recordUndoDebounced();
                                    setCurrentPageElements((prev) =>
                                      prev.map((el) => (el.id === element.id && el.type === "text" ? { ...el, content: e.target.value } : el))
                                    );
                                  }}
                                  onBlur={(e) => saveTextBoxContentById(element.id, e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Escape") {
                                      e.preventDefault();
                                      setCurrentPageElements((prev) =>
                                        prev.map((el) => (el.id === element.id && el.type === "text" ? { ...el, content: editingTextBoxInitialContentRef.current } : el))
                                      );
                                      setEditingTextBoxId(null);
                                    }
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  placeholder="Enter text..."
                                />
                              ) : (
                              <div
                                className="w-full h-full overflow-auto p-1 flex items-center cursor-text select-text"
                                style={{
                                  fontSize: element.textSettings?.fontSize ?? DEFAULT_TEXT_BOX.fontSize,
                                  fontFamily: element.textSettings?.fontFamily ?? DEFAULT_TEXT_BOX.fontFamily,
                                  color: element.textSettings?.color ?? DEFAULT_TEXT_BOX.color,
                                  textAlign: element.textSettings?.textAlign ?? DEFAULT_TEXT_BOX.textAlign,
                                  wordBreak: "break-word",
                                }}
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  editingTextBoxInitialContentRef.current = element.content || "";
                                  setEditingTextBoxId(element.id);
                                  setSelectedElement(element.id);
                                }}
                              >
                                {element.content || "Double-click to edit"}
                              </div>
                              )
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

        {/* Right sidebar - fixed width, independently scrollable */}
        <aside className={`w-[380px] shrink-0 border-l flex flex-col overflow-y-auto ${isDark ? "border-[#2A2A2A] bg-[#1A1A1A]" : "border-gray-200 bg-white"}`}>
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
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Text type:</span>
                  <span className="text-xs font-medium text-gray-900 rounded bg-gray-200 px-2 py-0.5">
                    {selectedTextMeta.type === "title"
                      ? "Section title"
                      : selectedTextMeta.type === "heading"
                        ? "Heading"
                        : selectedTextMeta.type === "subheading"
                          ? "Subheading"
                          : "Body text"}
                  </span>
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
              <TabsList className="bg-gray-50 border-b border-gray-200 w-full grid grid-cols-7 rounded-none h-11 px-0">
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
                <TabsTrigger value="videos" className="data-[state=active]:bg-white data-[state=active]:text-orange-600 data-[state=active]:border-b-2 data-[state=active]:border-orange-500 rounded-none text-xs gap-1.5 text-gray-600 border-b-2 border-transparent">
                  <Video className="w-3.5 h-3.5" /> Videos
                </TabsTrigger>
                <TabsTrigger value="export" className="data-[state=active]:bg-white data-[state=active]:text-orange-600 data-[state=active]:border-b-2 data-[state=active]:border-orange-500 rounded-none text-xs gap-1.5 text-gray-600 border-b-2 border-transparent">
                  <FileOutput className="w-3.5 h-3.5" /> Export
                </TabsTrigger>
                <TabsTrigger value="marketing" className="data-[state=active]:bg-white data-[state=active]:text-orange-600 data-[state=active]:border-b-2 data-[state=active]:border-orange-500 rounded-none text-xs gap-1.5 text-gray-600 border-b-2 border-transparent">
                  <Megaphone className="w-3.5 h-3.5" /> Marketing
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
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setAddImageModalOpen(true)}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white gap-2"
                >
                  <ImageIcon className="w-4 h-4" />
                  Add Image
                </Button>
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
                    {["Business", "Love", "Nature", "Technology", "People", "Abstract", "Scenery"].map((cat) => (
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
                    <div className="flex justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                    </div>
                  ) : photos.length > 0 ? (
                    <>
                      <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto">
                        {photos.map((photo) => {
                          const photoUrl = photo.fullUrl ?? photo.url ?? "";
                          if (!photoUrl) return null;
                          return (
                            <div
                              key={photo.id}
                              role="button"
                              tabIndex={0}
                              className="relative aspect-square rounded overflow-hidden border border-gray-200 hover:border-orange-500/50 group cursor-pointer"
                              onClick={() => setPreviewPhoto(photo)}
                              onKeyDown={(e) => e.key === "Enter" && setPreviewPhoto(photo)}
                            >
                              <img
                                src={photo.thumb ?? photo.url}
                                alt=""
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-1.5 p-1">
                                <span className="text-white text-xs font-medium">Click to preview</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddPhoto(photoUrl);
                                    setPreviewPhoto(null);
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
                                    setPreviewPhoto(null);
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
                      {photoTotalPages > 1 && photoPage < photoTotalPages && (
                        <button
                          type="button"
                          onClick={loadMorePhotos}
                          disabled={isLoadingMorePhotos}
                          className="w-full mt-2 py-2.5 text-sm font-medium text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-lg border border-orange-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {isLoadingMorePhotos ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>Load more ({photoPage} of {photoTotalPages})</>
                          )}
                        </button>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-[#666] py-6">Search or pick a category to load photos. Photos by Pexels.</p>
                  )}
                  <p className="text-[10px] text-[#555] mt-1">Photos by Pexels (pexels.com)</p>
                </div>

                {/* Add Image modal: Stock (Unsplash) or AI-generated */}
                <Dialog open={addImageModalOpen} onOpenChange={setAddImageModalOpen}>
                  <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <ImageIcon className="w-5 h-5 text-orange-500" />
                        Add Image
                      </DialogTitle>
                      <DialogDescription>
                        Search free stock photos (Unsplash) or generate an image with AI. The image will be added to the current page and can be moved and resized on the canvas.
                      </DialogDescription>
                    </DialogHeader>
                    <Tabs value={addImageTab} onValueChange={(v) => setAddImageTab(v as "stock" | "ai")} className="flex-1 min-h-0 flex flex-col">
                      <TabsList className="grid w-full grid-cols-2 mb-4">
                        <TabsTrigger value="stock">Search stock (Unsplash)</TabsTrigger>
                        <TabsTrigger value="ai">Generate AI image</TabsTrigger>
                      </TabsList>
                      <TabsContent value="stock" className="mt-0 flex-1 min-h-0 flex flex-col overflow-hidden">
                        <div className="flex gap-2 mb-3">
                          <Input
                            placeholder="Search Unsplash..."
                            value={unsplashQuery}
                            onChange={(e) => setUnsplashQuery(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && searchUnsplash()}
                            className="flex-1"
                          />
                          <Button type="button" onClick={() => searchUnsplash()} disabled={unsplashLoading}>
                            {unsplashLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
                          </Button>
                        </div>
                        {unsplashLoading ? (
                          <div className="flex justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                          </div>
                        ) : unsplashPhotos.length > 0 ? (
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 overflow-y-auto max-h-[320px] pr-1">
                            {unsplashPhotos.map((photo) => {
                              const photoUrl = photo.fullUrl ?? photo.url ?? "";
                              if (!photoUrl) return null;
                              return (
                                <button
                                  key={photo.id}
                                  type="button"
                                  className="relative aspect-square rounded overflow-hidden border border-gray-200 hover:border-orange-500 focus:border-orange-500"
                                  onClick={() => addImageToCanvasAndClose(photoUrl)}
                                >
                                  <img src={photo.thumb ?? photo.url} alt="" className="w-full h-full object-cover" />
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 py-8 text-center">Enter a search term and click Search. Free stock photos (Unsplash or Pexels).</p>
                        )}
                        {unsplashTotalPages > 1 && unsplashPhotos.length > 0 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-2 w-full"
                            onClick={() => searchUnsplash(undefined, unsplashPage + 1)}
                            disabled={unsplashLoading || unsplashPage >= unsplashTotalPages}
                          >
                            Load more
                          </Button>
                        )}
                      </TabsContent>
                      <TabsContent value="ai" className="mt-0 flex-1 min-h-0 flex flex-col">
                        <div className="space-y-3">
                          <Label>Describe the image you want</Label>
                          <Textarea
                            placeholder="e.g. Professional illustration of a person planning budget on a laptop, clean modern style"
                            value={aiImagePrompt}
                            onChange={(e) => setAiImagePrompt(e.target.value)}
                            rows={3}
                            className="resize-none"
                          />
                          <Button
                            type="button"
                            onClick={generateAiImage}
                            disabled={aiImageLoading || !aiImagePrompt.trim()}
                            className="w-full bg-orange-500 hover:bg-orange-600 gap-2"
                          >
                            {aiImageLoading ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Generating…
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-4 h-4" />
                                Generate image
                              </>
                            )}
                          </Button>
                        </div>
                        {aiImageUrl && (
                          <div className="mt-4 space-y-2">
                            <img src={aiImageUrl} alt="Generated" className="w-full max-h-64 object-contain rounded-lg border border-gray-200" />
                            <Button
                              type="button"
                              onClick={() => addImageToCanvasAndClose(aiImageUrl!)}
                              className="w-full bg-orange-500 hover:bg-orange-600"
                            >
                              Add to canvas
                            </Button>
                          </div>
                        )}
                      </TabsContent>
                    </Tabs>
                  </DialogContent>
                </Dialog>

                {/* Photo preview dialog */}
                <Dialog open={!!previewPhoto} onOpenChange={(open) => !open && setPreviewPhoto(null)}>
                  <DialogContent className="max-w-2xl p-0 overflow-hidden">
                    {previewPhoto && (
                      <>
                        <div className="relative">
                          <img
                            src={previewPhoto.fullUrl ?? previewPhoto.url ?? previewPhoto.thumb}
                            alt=""
                            className="w-full max-h-[70vh] object-contain bg-gray-100"
                          />
                          <DialogHeader className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/60 to-transparent">
                            <DialogTitle className="text-white text-lg">Preview</DialogTitle>
                          </DialogHeader>
                        </div>
                        <DialogFooter className="flex gap-2 p-4 border-t">
                          <Button
                            variant="outline"
                            onClick={() => setPreviewPhoto(null)}
                          >
                            Close
                          </Button>
                          <Button
                            onClick={() => {
                              const url = previewPhoto.fullUrl ?? previewPhoto.url ?? "";
                              if (url) {
                                handleAddPhoto(url);
                                setPreviewPhoto(null);
                              }
                            }}
                            className="bg-orange-500 hover:bg-orange-600"
                          >
                            Add to canvas
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => {
                              const url = previewPhoto.fullUrl ?? previewPhoto.url ?? "";
                              if (url) {
                                setBackgroundFromUrl(url);
                                setPreviewPhoto(null);
                              }
                            }}
                            className="bg-purple-600 hover:bg-purple-700 text-white"
                          >
                            Set as background
                          </Button>
                        </DialogFooter>
                      </>
                    )}
                  </DialogContent>
                </Dialog>
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
              <TabsContent value="videos" className="mt-0 p-4 space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Video Creation Guide</h3>
                <p className="text-xs text-gray-600 mb-3">
                  Get a step-by-step guide to create TikTok-style videos for this product. Scripts are pre-filled from your product title and sales copy.
                </p>
                <Button size="sm" className="w-full bg-orange-500 hover:bg-orange-600 gap-2" onClick={handleGenerateVideos}>
                  <Video className="w-4 h-4" /> Create Video Guide
                </Button>
                <div className="pt-2 border-t border-gray-200">
                  <p className="text-xs font-medium text-gray-700 mb-2">Video guide for this product</p>
                  <p className="text-xs text-gray-500">Create a Video Creation Guide from the button above. The guide includes AI prompts, editing tips, and scene breakdowns.</p>
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
                    Create Video Guide →
                  </Button>
                </div>
              </TabsContent>
              <TabsContent value="marketing" className="mt-0 p-4 space-y-6 overflow-y-auto">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Marketplace listing assets</h3>
                {!marketingAssets.productTitle && !marketingAssets.productDescription ? (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600">Generate title, description, hashtags, and SEO keywords for Etsy, Gumroad, Stan Store, Payhip, etc.</p>
                    <Button size="sm" className="w-full bg-orange-500 hover:bg-orange-600 gap-2" onClick={handleGenerateMarketingAssets} disabled={marketingGenerating}>
                      {marketingGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      {marketingGenerating ? "Generating…" : "Generate marketing assets"}
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <Label className="text-xs font-medium text-gray-700">
                          Product thumbnail ({effectiveOrientation === "vertical" ? "1024×1792" : "1792×1024"})
                        </Label>
                        <div className="flex gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            className="bg-orange-500 hover:bg-orange-600 gap-1"
                            onClick={handleGenerateThumbnail}
                            disabled={thumbnailGenerating}
                          >
                            {thumbnailGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                            {hasDalleThumbnail ? "Regenerate Thumbnail" : "Generate Thumbnail"}
                          </Button>
                          {hasDalleThumbnail && (
                            <Button type="button" variant="outline" size="sm" className="gap-1 h-8" onClick={handleDownloadThumbnail}>
                              <Download className="w-3.5 h-3.5" /> Download
                            </Button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-gray-500">
                        {hasDalleThumbnail
                          ? "AI-generated image with your title and badges. Choose a style and click Regenerate for a new design."
                          : "Choose a style, then generate an AI thumbnail. No product background image is used—thumbnail is marketplace-only."}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-gray-700">Orientation</span>
                        <div className="flex rounded-md border border-gray-200 p-0.5 bg-gray-50">
                          <Button
                            type="button"
                            variant={thumbnailOrientation === "horizontal" ? "default" : "ghost"}
                            size="sm"
                            className={`h-8 px-3 text-xs rounded ${thumbnailOrientation === "horizontal" ? "bg-orange-500 hover:bg-orange-600 text-white" : "hover:bg-gray-100"}`}
                            onClick={() => setThumbnailOrientation("horizontal")}
                          >
                            Horizontal
                          </Button>
                          <Button
                            type="button"
                            variant={thumbnailOrientation === "vertical" ? "default" : "ghost"}
                            size="sm"
                            className={`h-8 px-3 text-xs rounded ${thumbnailOrientation === "vertical" ? "bg-orange-500 hover:bg-orange-600 text-white" : "hover:bg-gray-100"}`}
                            onClick={() => setThumbnailOrientation("vertical")}
                          >
                            Vertical
                          </Button>
                        </div>
                        <span className="text-xs text-gray-500">
                          {thumbnailOrientation === "horizontal" ? "1792×1024 — marketplace" : "1024×1792 — TikTok, IG, Pinterest"}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {THUMBNAIL_TEMPLATES.map((t) => (
                          <Button
                            key={t.id}
                            type="button"
                            variant={thumbnailTemplate === t.id ? "default" : "outline"}
                            size="sm"
                            className={thumbnailTemplate === t.id ? "bg-orange-500 hover:bg-orange-600" : ""}
                            onClick={() => setThumbnailTemplate(t.id)}
                          >
                            {t.label}
                          </Button>
                        ))}
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-gray-100 flex items-center justify-center p-2">
                        <ThumbnailMockup
                          productTitle={product?.title ?? "Product"}
                          format={product?.format ?? "PDF"}
                          sectionCount={sections.length}
                          accentColor={graphicsAccentColor}
                          template={thumbnailTemplate}
                          baseImageUrl={marketingAssets.thumbnailUrl ?? undefined}
                          orientation={effectiveOrientation}
                          preview
                        />
                      </div>
                      <div style={{ position: "fixed", left: -10000, top: 0, width: thumbCaptureWidth, height: thumbCaptureHeight, pointerEvents: "none", visibility: "hidden" }} aria-hidden="true">
                        <ThumbnailMockup
                          productTitle={product?.title ?? "Product"}
                          format={product?.format ?? "PDF"}
                          sectionCount={sections.length}
                          accentColor={graphicsAccentColor}
                          template={thumbnailTemplate}
                          baseImageUrl={marketingAssets.thumbnailUrl ?? undefined}
                          orientation={effectiveOrientation}
                          preview={false}
                          innerRef={thumbnailCaptureRef}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-xs font-medium text-gray-700">Product title</Label>
                        <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={() => copyToClipboard(marketingAssets.productTitle ?? "", "Title")}>
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <Input
                        value={marketingAssets.productTitle ?? ""}
                        onChange={(e) => setProduct((p) => (p ? { ...p, marketingAssets: { ...p.marketingAssets, productTitle: e.target.value } } : null))}
                        onBlur={(e) => saveMarketingEdits({ productTitle: e.currentTarget.value })}
                        placeholder="Marketplace-optimized title…"
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-xs font-medium text-gray-700">Product description</Label>
                        <div className="flex gap-1">
                          <Button type="button" variant="outline" size="sm" className="h-7 gap-1 shrink-0" onClick={handleRegenerateDescription} disabled={marketingRegenerating}>
                            {marketingRegenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Regenerate
                          </Button>
                          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={() => copyToClipboard(marketingAssets.productDescription ?? "", "Description")}>
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                      <Textarea
                        value={marketingAssets.productDescription ?? ""}
                        onChange={(e) => setProduct((p) => (p ? { ...p, marketingAssets: { ...p.marketingAssets, productDescription: e.target.value } } : null))}
                        onBlur={(e) => saveMarketingEdits({ productDescription: e.currentTarget.value })}
                        placeholder="Listing description…"
                        rows={8}
                        className="text-sm resize-y"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-xs font-medium text-gray-700">Hashtags / tags</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 shrink-0"
                          onClick={() => copyToClipboard((marketingAssets.hashtags ?? []).map((t) => (t.startsWith("#") ? t : `#${t}`)).join(" "), "Hashtags")}
                        >
                          <Copy className="w-3.5 h-3.5 mr-1" /> Copy
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(marketingAssets.hashtags ?? []).map((tag) => (
                          <span key={tag} className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                            {tag.startsWith("#") ? tag : `#${tag}`}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-xs font-medium text-gray-700">SEO keywords</Label>
                        <Button type="button" variant="ghost" size="sm" className="h-7 shrink-0" onClick={() => copyToClipboard((marketingAssets.seoKeywords ?? []).join(", "), "SEO keywords")}>
                          <Copy className="w-3.5 h-3.5 mr-1" /> Copy
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(marketingAssets.seoKeywords ?? []).map((kw) => (
                          <span key={kw} className="inline-flex items-center rounded-md border border-gray-200 bg-white px-2 py-0.5 text-xs text-gray-600">
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="w-full border-gray-200 gap-2" onClick={handleGenerateMarketingAssets} disabled={marketingGenerating}>
                      {marketingGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      {marketingGenerating ? "Regenerating…" : "Regenerate all"}
                    </Button>
                  </>
                )}
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

      {/* Full product preview modal – Save as PDF via canvas capture or browser print */}
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
            {/* When capturing for PDF, move pages off-screen so html2canvas can capture them without flashing */}
            <div
              className="editor-canvas flex-1 overflow-hidden flex flex-col"
              style={pdfExporting ? { position: "fixed", left: "-9999px", top: 0, zIndex: -1 } : undefined}
            >
            <div ref={previewPagesContainerRef} data-print-source className="preview-pages-container flex-1 overflow-y-auto p-6 flex flex-col items-center gap-6">
                {(() => {
                  const contentPageCount = sections.length || 1;
                  const pages: { type: "cover" | "content" | "back"; contentIndex?: number }[] = [];
                  if (includeCover) pages.push({ type: "cover" });
                  for (let i = 0; i < contentPageCount; i++) pages.push({ type: "content", contentIndex: i });
                  if (includeBackPage) pages.push({ type: "back" });

                  function renderPlacedElements(placed: PlacedElement[]) {
                    return [...(placed ?? [])].sort((a, b) => a.zIndex - b.zIndex).map((element) => {
                      const isIconify = element.type === "icon" && element.content.includes(":");
                      const LucideIcon = !isIconify && element.type === "icon" ? GRAPHICS_ICONS.find((i) => i.name === element.content)?.icon : null;
                      const iconColor = graphicsAccentColor;
                      return (
                        <div key={element.id} className="absolute flex items-center justify-center" style={{ left: element.position.x, top: element.position.y, width: element.size.width, height: element.size.height, zIndex: Math.max(1, element.zIndex) }}>
                          {element.type === "icon" && isIconify ? <Icon icon={element.content} className="w-full h-full" style={{ color: iconColor }} /> : element.type === "icon" && LucideIcon ? <LucideIcon className="w-full h-full" style={{ color: iconColor }} /> : element.type === "image" ? (
                            <img src={element.content} alt="" className="w-full h-full object-cover" style={{ opacity: element.imageSettings?.opacity ?? 1, filter: `blur(${element.imageSettings?.blur ?? 0}px) brightness(${element.imageSettings?.brightness ?? 100}%) contrast(${element.imageSettings?.contrast ?? 100}%) saturate(${element.imageSettings?.saturation ?? 100}%)` }} />
                          ) : element.type === "text" ? (
                            <div className="w-full h-full overflow-auto p-1 flex items-center" style={{ fontSize: element.textSettings?.fontSize ?? DEFAULT_TEXT_BOX.fontSize, fontFamily: element.textSettings?.fontFamily ?? DEFAULT_TEXT_BOX.fontFamily, color: element.textSettings?.color ?? DEFAULT_TEXT_BOX.color, textAlign: element.textSettings?.textAlign ?? DEFAULT_TEXT_BOX.textAlign, wordBreak: "break-word" }}>{element.content || ""}</div>
                          ) : <span className="text-[#999] text-xs">?</span>}
                        </div>
                      );
                    });
                  }

                  return pages.map((page, pageIdx) => {
                    if (page.type === "cover") {
                      const coverPageBg = pageBackgrounds[0];
                      const coverBgUrl = coverPageBg?.backgroundImage ?? null;
                      const coverBgSettings = coverPageBg?.backgroundSettings ? { ...DEFAULT_IMAGE_SETTINGS, ...coverPageBg.backgroundSettings } : DEFAULT_IMAGE_SETTINGS;
                      const coverOverlay = coverPageBg?.overlaySettings ? { ...DEFAULT_OVERLAY, ...coverPageBg.overlaySettings } : DEFAULT_OVERLAY;
                      return (
                        <div
                          key="cover"
                          id="preview-page-0"
                          data-pdf-page
                          data-page
                          data-page-type="cover"
                          className="preview-page product-page relative shrink-0 rounded-lg overflow-hidden border border-gray-200 bg-white shadow-lg"
                          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, minHeight: CANVAS_HEIGHT, pageBreakAfter: "always", pageBreakInside: "avoid" }}
                        >
                          {coverBgUrl ? (
                            <>
                              <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden>
                                <img src={coverBgUrl} alt="" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: (coverBgSettings.fit ?? "cover") as React.CSSProperties["objectFit"], objectPosition: coverBgSettings.position ?? "center center", opacity: coverBgSettings.opacity ?? 1, filter: (coverBgSettings.blur ?? 0) > 0 ? `blur(${coverBgSettings.blur}px) brightness(${coverBgSettings.brightness ?? 100}%) contrast(${coverBgSettings.contrast ?? 100}%) saturate(${coverBgSettings.saturation ?? 100}%)` : `brightness(${coverBgSettings.brightness ?? 100}%) contrast(${coverBgSettings.contrast ?? 100}%) saturate(${coverBgSettings.saturation ?? 100}%)` }} />
                              </div>
                              <div className="absolute inset-0 z-[1] pointer-events-none" style={{ backgroundColor: coverOverlay.color, opacity: coverOverlay.opacity ?? 0.9 }} aria-hidden />
                            </>
                          ) : (
                            <div className="absolute inset-0 z-0 bg-gradient-to-b from-white to-gray-100" aria-hidden />
                          )}
                          <div className="absolute inset-0 pointer-events-none z-20">{renderPlacedElements(placedElementsByPage[0] ?? [])}</div>
                          <div className="absolute left-0 right-0 bottom-0 py-2 text-center text-[11px] text-gray-500 pointer-events-none" style={{ opacity: 0.45, zIndex: 25 }} aria-hidden>Created with Content Flywheel</div>
                        </div>
                      );
                    }
                    if (page.type === "back") {
                      const backIdx = totalPages - 1;
                      const backPageBg = pageBackgrounds[backIdx];
                      const backBgUrl = backPageBg?.backgroundImage ?? null;
                      const backBgSettings = backPageBg?.backgroundSettings ? { ...DEFAULT_IMAGE_SETTINGS, ...backPageBg.backgroundSettings } : DEFAULT_IMAGE_SETTINGS;
                      const backOverlay = backPageBg?.overlaySettings ? { ...DEFAULT_OVERLAY, ...backPageBg.overlaySettings } : DEFAULT_OVERLAY;
                      return (
                        <div
                          key="back"
                          id={`preview-page-${pageIdx}`}
                          data-pdf-page
                          data-page
                          data-page-type="back"
                          className="preview-page product-page relative shrink-0 rounded-lg overflow-hidden border border-gray-200 bg-white shadow-lg"
                          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, minHeight: CANVAS_HEIGHT, pageBreakAfter: "avoid", pageBreakInside: "avoid" }}
                        >
                          {backBgUrl ? (
                            <>
                              <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden>
                                <img src={backBgUrl} alt="" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: (backBgSettings.fit ?? "cover") as React.CSSProperties["objectFit"], objectPosition: backBgSettings.position ?? "center center", opacity: backBgSettings.opacity ?? 1 }} />
                              </div>
                              <div className="absolute inset-0 z-[1] pointer-events-none" style={{ backgroundColor: backOverlay.color, opacity: backOverlay.opacity ?? 0.9 }} aria-hidden />
                            </>
                          ) : (
                            <div className="absolute inset-0 z-0 bg-gradient-to-b from-white to-gray-100" aria-hidden />
                          )}
                          <div className="absolute inset-0 pointer-events-none z-20">{renderPlacedElements(placedElementsByPage[backIdx] ?? [])}</div>
                          <div className="absolute left-0 right-0 bottom-0 py-2 text-center text-[11px] text-gray-500 pointer-events-none" style={{ opacity: 0.45, zIndex: 25 }} aria-hidden>Created with Content Flywheel</div>
                        </div>
                      );
                    }
                    const contentIdx = page.contentIndex!;
                    const section = sections[contentIdx] ?? { id: `page-${contentIdx}`, title: "", content: "", contentHtml: "" };
                    const pageBg = pageBackgrounds[contentIdx + 1];
                    const bgUrl = pageBg?.backgroundImage ?? null;
                    const bgSettings = pageBg?.backgroundSettings ? { ...DEFAULT_IMAGE_SETTINGS, ...pageBg.backgroundSettings } : DEFAULT_IMAGE_SETTINGS;
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
                        style={{ width: CANVAS_WIDTH, minHeight: CANVAS_HEIGHT, pageBreakAfter: "always", pageBreakInside: "avoid" }}
                      >
                        {bgUrl ? (
                          <>
                            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden>
                              <img
                                src={bgUrl}
                                alt=""
                                style={{
                                  position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
                                  objectFit: (bgSettings.fit ?? "cover") as React.CSSProperties["objectFit"],
                                  objectPosition: bgSettings.position ?? "center center",
                                  opacity: bgSettings.opacity ?? 1,
                                  filter: (bgSettings.blur ?? 0) > 0
                                    ? `blur(${bgSettings.blur}px) brightness(${bgSettings.brightness ?? 100}%) contrast(${bgSettings.contrast ?? 100}%) saturate(${bgSettings.saturation ?? 100}%)`
                                    : `brightness(${bgSettings.brightness ?? 100}%) contrast(${bgSettings.contrast ?? 100}%) saturate(${bgSettings.saturation ?? 100}%)`,
                                }}
                              />
                            </div>
                            <div className="absolute inset-0 z-[1] pointer-events-none" style={{ backgroundColor: overlay.color, opacity: overlay.opacity ?? 0.9 }} aria-hidden />
                          </>
                        ) : null}
                        <div
                          className={`relative z-10 product-editor-preview-layout ${product.format === "workbook" ? "format-workbook" : ""}`}
                          style={{ ...previewLayoutStyle, ...(bgUrl ? { backgroundColor: "transparent" } : {}), minHeight: "100%" }}
                        >
                          <h2 className="text-2xl font-bold border-b pb-2" style={{ color: templatePreset.titleColor }}>{product.title}</h2>
                          <section>
                            <h3 className="text-lg font-semibold" style={{ ...titleStyles, color: titleStyles?.color ?? templatePreset.headingColor }}>{section.title}</h3>
                            {section.imageUrl?.trim() ? (
                              <div className="my-4 flex justify-center">
                                <img src={section.imageUrl} alt="" className="max-w-full max-h-80 object-contain rounded-lg shadow-md" />
                              </div>
                            ) : null}
                            <div className="mt-2 prose prose-sm max-w-none prose-p:mb-4 prose-p:leading-relaxed prose-headings:mb-4 prose-headings:mt-6 prose-ul:mb-4 prose-ol:mb-4 prose-li:mb-2" style={{ ...bodyStyles, color: bodyStyles?.color ?? templatePreset.bodyColor }}>
                              {section.content || section.contentHtml ? (
                                <div className="preview-content" dangerouslySetInnerHTML={{ __html: section.contentHtml ?? cleanMarkdownToHtml(section.content ?? "") }} />
                              ) : (
                                <span className="text-[#999]">(Empty)</span>
                              )}
                            </div>
                          </section>
                        </div>
                        <div className="absolute inset-0 pointer-events-none z-20">
                          {renderPlacedElements(placedElementsByPage[contentIdx + 1] ?? [])}
                        </div>
                        <div className="absolute left-0 right-0 bottom-0 py-2 text-center text-[11px] text-gray-500 pointer-events-none" style={{ opacity: 0.45, zIndex: 25 }} aria-hidden>Created with Content Flywheel</div>
                      </div>
                    );
                  });
                })()}
            </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
