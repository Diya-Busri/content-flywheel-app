"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Pencil,
  Download,
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
} from "lucide-react";
import { Icon } from "@iconify/react";
import { HexColorPicker } from "react-colorful";
import { RichTextEditor } from "@/components/RichTextEditor";
import { cleanMarkdownToHtml } from "@/lib/clean-markdown";
import { useToast } from "@/components/ui/use-toast";

type Section = { id: string; title: string; content: string; contentHtml?: string; order: number };

export type TextStyles = Record<string, string>;

type SelectedTextMeta = {
  sectionId: string;
  type: "title" | "body";
  content: string;
  styles: TextStyles;
};

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
    textStyles?: Record<string, Record<"title" | "body", TextStyles>>;
  } | null;
  placedElements?: unknown[] | null;
};

export type PlacedElement = {
  id: string;
  type: "icon" | "image";
  content: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  rotation: number;
  zIndex: number;
  imageSettings?: ImageSettings;
};

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
      const raw = item as PlacedElement & { imageSettings?: unknown };
      const imgSettings = raw.imageSettings && typeof raw.imageSettings === "object" ? raw.imageSettings as ImageSettings : undefined;
      return {
        id: raw.id,
        type: raw.type === "image" ? "image" : "icon",
        content: raw.content,
        position: { x: Number(raw.position?.x) || 0, y: Number(raw.position?.y) || 0 },
        size: {
          width: Number(raw.size?.width) || 80,
          height: Number(raw.size?.height) || 80,
        },
        rotation: Number(raw.rotation) || 0,
        zIndex: Number(raw.zIndex) ?? 0,
        ...(imgSettings ? { imageSettings: { ...DEFAULT_IMAGE_SETTINGS, ...imgSettings } } : {}),
      };
    });
}

const TEMPLATES = [
  { id: "modern", label: "Modern", desc: "Clean and bold" },
  { id: "classic", label: "Classic", desc: "Traditional layout" },
  { id: "minimal", label: "Minimal", desc: "Lots of whitespace" },
  { id: "bold", label: "Bold", desc: "Colorful, geometric" },
  { id: "elegant", label: "Elegant", desc: "Refined typography" },
  { id: "creative", label: "Creative", desc: "Playful and fun" },
];

const DEFAULT_LAYOUT = {
  paragraphSpacing: 1,
  lineHeight: 1.6,
  alignment: "left" as const,
  margins: 2,
  sectionSpacing: 2,
  maxWidth: "normal" as const,
};

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
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showFullPreview, setShowFullPreview] = useState(false);
  const [placedElements, setPlacedElements] = useState<PlacedElement[]>([]);
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
  const [imageSettings, setImageSettings] = useState<ImageSettings>(DEFAULT_IMAGE_SETTINGS);
  const selectedTextRef = useRef<HTMLElement | null>(null);
  const [selectedTextMeta, setSelectedTextMeta] = useState<SelectedTextMeta | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      setTemplate((data.designSettings as { template?: string })?.template ?? "modern");
      setPlacedElements(parsePlacedElements(data.placedElements ?? []));
      const colors = (data.designSettings as { colors?: Record<string, string> })?.colors;
      setGraphicsAccentColor(colors?.graphics ?? "#333333");
      setCustomColor(colors?.graphics ?? "#333333");
      const ds = data.designSettings as {
        backgroundImage?: string;
        backgroundSettings?: ImageSettings;
        overlaySettings?: OverlaySettings;
      } | undefined;
      setBackgroundImage(ds?.backgroundImage ?? null);
      setBackgroundSettings(ds?.backgroundSettings ? { ...DEFAULT_IMAGE_SETTINGS, ...ds.backgroundSettings } : DEFAULT_IMAGE_SETTINGS);
      setOverlaySettings(ds?.overlaySettings ? { ...DEFAULT_OVERLAY, ...ds.overlaySettings } : DEFAULT_OVERLAY);
    } catch {
      setError("Failed to load product");
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  const saveToServer = useCallback(
    async (payload: {
      content?: { sections: Section[] };
      designSettings?: Record<string, unknown>;
      placedElements?: PlacedElement[];
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

  useEffect(() => {
    if (!product || sections.length === 0) return;
    autoSaveTimerRef.current = setInterval(() => {
      saveToServer({
        content: { sections },
        designSettings: {
          ...product.designSettings,
          template,
          colors: { ...product.designSettings?.colors, graphics: graphicsAccentColor },
          typography: product.designSettings?.typography,
          backgroundImage: backgroundImage ?? undefined,
          backgroundSettings: backgroundImage ? backgroundSettings : undefined,
          overlaySettings: backgroundImage ? overlaySettings : undefined,
        },
        placedElements,
      });
    }, 30000);
    return () => {
      if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
    };
  }, [sections, template, product, placedElements, graphicsAccentColor, backgroundImage, backgroundSettings, overlaySettings, saveToServer]);

  const openEdit = (section: Section) => {
    setEditingSectionId(section.id);
    setEditingContent(section.content);
  };

  const saveEdit = () => {
    if (!editingSectionId) return;
    const nextSections = sections.map((s) => (s.id === editingSectionId ? { ...s, content: editingContent } : s));
    setSections(nextSections);
    setEditingSectionId(null);
    saveToServer({ content: { sections: nextSections } });
  };

  const updateSectionContent = useCallback((sectionId: string, newContent: string) => {
    setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, content: newContent } : s)));
    if (editingSectionId === sectionId) setEditingContent(newContent);
  }, [editingSectionId]);

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
        updateSectionContent(sectionId, data.newContent);
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

  const addSection = () => {
    const id = `section-${Date.now()}`;
    const newSection: Section = { id, title: "New Section", content: "", order: sections.length + 1 };
    setSections((prev) => [...prev, newSection]);
    setEditingSectionId(id);
    setEditingContent("");
  };

  const updateElementPosition = useCallback((id: string, position: { x: number; y: number }) => {
    setPlacedElements((prev) => prev.map((el) => (el.id === id ? { ...el, position } : el)));
  }, []);
  const updateElementSize = useCallback(
    (id: string, size: { width: number; height: number }, position: { x: number; y: number }) => {
      setPlacedElements((prev) => prev.map((el) => (el.id === id ? { ...el, size, position } : el)));
    },
    []
  );
  const deleteElement = useCallback((id: string) => {
    setPlacedElements((prev) => prev.filter((el) => el.id !== id));
    setSelectedElement(null);
  }, []);
  const duplicateElement = useCallback((id: string) => {
    const element = placedElements.find((el) => el.id === id);
    if (!element) return;
    const newElement: PlacedElement = {
      ...element,
      id: `${element.type}-${Date.now()}`,
      position: { x: element.position.x + 20, y: element.position.y + 20 },
    };
    setPlacedElements((prev) => [...prev, newElement]);
    setSelectedElement(newElement.id);
  }, [placedElements]);
  const bringToFront = useCallback(() => {
    const maxZ = Math.max(0, ...placedElements.map((el) => el.zIndex));
    setPlacedElements((prev) =>
      prev.map((el) => (el.id === selectedElement ? { ...el, zIndex: maxZ + 1 } : el))
    );
  }, [placedElements, selectedElement]);
  const sendToBack = useCallback(() => {
    const minZ = Math.min(0, ...placedElements.map((el) => el.zIndex));
    setPlacedElements((prev) =>
      prev.map((el) => (el.id === selectedElement ? { ...el, zIndex: minZ - 1 } : el))
    );
  }, [placedElements, selectedElement]);
  const moveElement = useCallback((id: string, deltaX: number, deltaY: number) => {
    setPlacedElements((prev) =>
      prev.map((el) =>
        el.id === id ? { ...el, position: { x: el.position.x + deltaX, y: el.position.y + deltaY } } : el
      )
    );
  }, []);
  const handleIconClick = useCallback((iconName: string) => {
    const newElement: PlacedElement = {
      id: `icon-${Date.now()}`,
      type: "icon",
      content: iconName,
      position: { x: CANVAS_WIDTH / 2 - 50, y: 300 },
      size: { width: 80, height: 80 },
      rotation: 0,
      zIndex: placedElements.length,
    };
    setPlacedElements((prev) => [...prev, newElement]);
    setSelectedElement(newElement.id);
  }, [placedElements.length]);

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

  const handleAddPhoto = useCallback((url: string) => {
    const newElement: PlacedElement = {
      id: `image-${Date.now()}`,
      type: "image",
      content: url,
      position: { x: CANVAS_WIDTH / 2 - 100, y: 280 },
      size: { width: 200, height: 200 },
      rotation: 0,
      zIndex: placedElements.length,
    };
    setPlacedElements((prev) => [...prev, newElement]);
    setSelectedElement(newElement.id);
  }, [placedElements.length]);

  const handleAddShape = useCallback((svgFragment: string, fillColor: string) => {
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
      zIndex: placedElements.length,
    };
    setPlacedElements((prev) => [...prev, newElement]);
    setSelectedElement(newElement.id);
  }, [placedElements.length]);

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

  const selectedImageElement = selectedElement ? placedElements.find((el) => el.id === selectedElement && el.type === "image") : null;

  useEffect(() => {
    if (selectedImageElement) {
      setImageSettings({ ...DEFAULT_IMAGE_SETTINGS, ...selectedImageElement.imageSettings });
    }
  }, [selectedImageElement?.id]);

  const updateImageSetting = useCallback(
    (key: keyof ImageSettings, value: number | string) => {
      const next = { ...imageSettings, [key]: value };
      setImageSettings(next);
      if (!selectedElement) return;
      setPlacedElements((prev) =>
        prev.map((el) => (el.id === selectedElement ? { ...el, imageSettings: { ...el.imageSettings, ...next } } : el))
      );
    },
    [imageSettings, selectedElement]
  );

  const setAsBackground = useCallback(() => {
    const el = selectedImageElement;
    if (!el) return;
    setBackgroundImage(el.content);
    setBackgroundSettings({ ...DEFAULT_IMAGE_SETTINGS, ...el.imageSettings });
    const defaultOverlay = DEFAULT_OVERLAY;
    setOverlaySettings(defaultOverlay);
    setPlacedElements((prev) => prev.filter((e) => e.id !== el.id));
    setSelectedElement(null);
    setProduct((p) =>
      p
        ? {
            ...p,
            designSettings: {
              ...p.designSettings,
              backgroundImage: el.content,
              backgroundSettings: { ...DEFAULT_IMAGE_SETTINGS, ...el.imageSettings },
              overlaySettings: defaultOverlay,
            },
          }
        : null
    );
    toast({ title: "Background set. Adjust overlay if needed." });
  }, [selectedImageElement, toast]);

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
      const filter = FILTER_PRESETS[name] ?? FILTER_PRESETS.none;
      const next = { ...imageSettings, ...filter };
      setImageSettings(next);
      if (!selectedElement) return;
      setPlacedElements((prev) =>
        prev.map((el) => (el.id === selectedElement ? { ...el, imageSettings: { ...el.imageSettings, ...next } } : el))
      );
    },
    [imageSettings, selectedElement]
  );

  const resetImageSettings = useCallback(() => {
    setImageSettings(DEFAULT_IMAGE_SETTINGS);
    if (!selectedElement) return;
    setPlacedElements((prev) =>
      prev.map((el) =>
        el.id === selectedElement ? { ...el, imageSettings: DEFAULT_IMAGE_SETTINGS } : el
      )
    );
  }, [selectedElement]);

  const removeBackground = useCallback(() => {
    setBackgroundImage(null);
    setBackgroundSettings(DEFAULT_IMAGE_SETTINGS);
    setOverlaySettings(DEFAULT_OVERLAY);
    setProduct((p) =>
      p
        ? {
            ...p,
            designSettings: {
              ...p.designSettings,
              backgroundImage: undefined,
              backgroundSettings: undefined,
              overlaySettings: undefined,
            },
          }
        : null
    );
    toast({ title: "Background removed" });
  }, [toast]);

  const updateOverlay = useCallback((key: keyof OverlaySettings, value: string | number) => {
    setOverlaySettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setOverlayPreset = useCallback((preset: keyof typeof OVERLAY_PRESETS) => {
    setOverlaySettings(OVERLAY_PRESETS[preset] ?? DEFAULT_OVERLAY);
  }, []);

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
      setProduct((p) =>
        p
          ? {
              ...p,
              designSettings: {
                ...p.designSettings,
                textStyles: {
                  ...p.designSettings?.textStyles,
                  [sectionId]: {
                    ...p.designSettings?.textStyles?.[sectionId],
                    [type]: styles,
                  },
                },
              },
            }
          : null
      );
    },
    []
  );

  const updateTextStyle = useCallback(
    (property: string, value: string) => {
      if (!selectedTextRef.current || !selectedTextMeta) return;
      const el = selectedTextRef.current;
      (el.style as Record<string, string>)[property] = value;
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
      if (selectedTextRef.current) (selectedTextRef.current.style as Record<string, string>)[key] = value;
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

  const handleDownloadPdf = async () => {
    if (!product) return;
    const type = ["ebook", "workbook", "course", "checklist"].includes(product.format) ? product.format : "ebook";
    try {
      const res = await fetch("/api/products/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format: type,
          title: product.title,
          description: "",
          niche: product.niche,
          sections: sections.map((s) => ({ title: s.title, body: s.content })),
        }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${product.title.replace(/\s+/g, "-")}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      console.error("PDF export failed:", err);
    }
  };

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
      <main className="min-h-screen bg-[#0F0F0F] text-white flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
      </main>
    );
  }
  if (error || !product) {
    return (
      <main className="min-h-screen bg-[#0F0F0F] text-white p-6">
        <p className="text-red-400">{error ?? "Product not found"}</p>
        <Link href="/dashboard/digital-products" className="text-orange-500 mt-4 inline-block">
          ← Back to Digital Products
        </Link>
      </main>
    );
  }

  const cardClass = "border-[#2A2A2A] bg-[#1A1A1A]";

  const previewLayoutStyle: React.CSSProperties & Record<`--${string}`, string> = {
    ["--paragraph-spacing" as const]: `${layoutSettings.paragraphSpacing}rem`,
    ["--line-height" as const]: String(layoutSettings.lineHeight),
    ["--text-align" as const]: layoutSettings.alignment,
    ["--margins" as const]: `${layoutSettings.margins}rem`,
    ["--section-spacing" as const]: `${layoutSettings.sectionSpacing}rem`,
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

  return (
    <main className="min-h-screen bg-[#0F0F0F] text-white">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .product-editor-preview-layout p { margin-bottom: var(--paragraph-spacing, 1rem); line-height: var(--line-height, 1.6); text-align: var(--text-align, left); }
            .product-editor-preview-layout h2 { margin-top: calc(var(--section-spacing, 2rem) * 1.5); margin-bottom: calc(var(--paragraph-spacing, 1rem) * 1.5); text-align: var(--text-align, left); }
            .product-editor-preview-layout h3 { margin-top: calc(var(--section-spacing, 2rem) * 0.75); margin-bottom: calc(var(--paragraph-spacing, 1rem) * 0.75); text-align: var(--text-align, left); }
            .product-editor-preview-layout section { margin-bottom: var(--section-spacing, 2rem); }
            .product-editor-preview-layout ul, .product-editor-preview-layout ol { margin-bottom: var(--paragraph-spacing, 1rem); padding-left: 1.5rem; text-align: var(--text-align, left); }
            .product-editor-preview-layout li { margin-bottom: 0.5rem; }
          `,
        }}
      />
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[#2A2A2A] bg-[#0F0F0F]/95 backdrop-blur py-4 px-4 md:px-6">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/digital-products" className="text-[#A0A0A0] hover:text-orange-500 text-sm">
              ← Digital Products
            </Link>
            <h1 className="text-lg font-semibold text-white truncate max-w-[200px] md:max-w-none">{product.title}</h1>
            {saving ? (
              <span className="flex items-center gap-1.5 text-xs text-[#A0A0A0]">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
              </span>
            ) : lastSaved ? (
              <span className="flex items-center gap-1.5 text-xs text-green-500">
                <Check className="w-3.5 h-3.5" /> Saved
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-[#2A2A2A] text-[#E0E0E0] hover:bg-[#2A2A2A] gap-1"
              onClick={() => setShowFullPreview(true)}
            >
              <Eye className="w-4 h-4" /> View Full Product
            </Button>
            <Button size="sm" className="bg-orange-500 hover:bg-orange-600 gap-1" onClick={handleDownloadPdf}>
              <Download className="w-4 h-4" /> Export
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 md:p-6">
        <div className="grid md:grid-cols-[1fr_380px] gap-6">
          {/* Preview - Left ~60% */}
          <Card className={cardClass}>
            <CardHeader>
              <CardTitle className="text-base text-white">Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-auto max-h-[70vh] rounded-lg border border-[#2A2A2A]">
                <div
                  className="relative isolate bg-white text-[#1A1A1A]"
                  style={{
                    width: CANVAS_WIDTH,
                    minHeight: CANVAS_HEIGHT,
                    fontFamily: "var(--font-sans), sans-serif",
                  }}
                  onClick={() => {
                    setSelectedElement(null);
                    deselectText();
                  }}
                  role="presentation"
                >
                  {backgroundImage && (
                    <div
                      className="absolute inset-0 z-0"
                      style={{
                        backgroundImage: `url(${backgroundImage})`,
                        backgroundSize: backgroundSettings.fit ?? "cover",
                        backgroundPosition: backgroundSettings.position ?? "center center",
                        backgroundRepeat: "no-repeat",
                        opacity: backgroundSettings.opacity ?? 1,
                        filter: `blur(${backgroundSettings.blur ?? 0}px) brightness(${backgroundSettings.brightness ?? 100}%) contrast(${backgroundSettings.contrast ?? 100}%) saturate(${backgroundSettings.saturation ?? 100}%)`,
                      }}
                    />
                  )}
                  {backgroundImage && (
                    <div
                      className="absolute inset-0 z-[1]"
                      style={{
                        backgroundColor: overlaySettings.color,
                        opacity: overlaySettings.opacity,
                      }}
                      aria-hidden
                    />
                  )}
                  <div
                    className={`relative z-10 product-editor-preview-layout ${product.format === "workbook" ? "format-workbook" : ""}`}
                    style={previewLayoutStyle}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h2 className="text-2xl font-bold border-b pb-2 text-orange-600">{product.title}</h2>
                    {sections.map((section) => {
                      const titleStyles = product.designSettings?.textStyles?.[section.id]?.title;
                      const bodyStyles = product.designSettings?.textStyles?.[section.id]?.body;
                      return (
                        <section key={section.id} data-section-id={section.id}>
                          <h3
                            data-section-id={section.id}
                            data-text-type="title"
                            className="text-lg font-semibold text-[#333] cursor-text"
                            style={titleStyles}
                            onClick={handleTextClick}
                          >
                            {section.title}
                          </h3>
                          <div
                            data-section-id={section.id}
                            data-text-type="body"
                            className="mt-2 text-[#555] prose prose-sm max-w-none prose-p:mb-4 prose-p:leading-relaxed prose-headings:mb-4 prose-headings:mt-6 prose-ul:mb-4 prose-ol:mb-4 prose-li:mb-2 cursor-text"
                            style={bodyStyles}
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
                  {/* Placed elements layer (Canva-style) - above content */}
                  <div className="absolute inset-0 pointer-events-none z-20" aria-hidden>
                    <div className="w-full h-full relative">
                  {[...placedElements]
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
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedElement(element.id);
                          }}
                          style={{ zIndex: element.zIndex }}
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
                            ) : (
                              <span className="text-[#999] text-xs">?</span>
                            )}
                          </div>
                          {selectedElement === element.id && (
                            <div className="absolute -top-9 left-0 flex gap-1 bg-[#1A1A1A] text-white rounded px-2 py-1.5 text-xs border border-[#2A2A2A]">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteElement(element.id);
                                }}
                                className="hover:bg-[#2A2A2A] rounded p-1"
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
                                className="hover:bg-[#2A2A2A] rounded p-1"
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
                                className="hover:bg-[#2A2A2A] rounded p-1"
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
                                className="hover:bg-[#2A2A2A] rounded p-1"
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
            </CardContent>
          </Card>

          {/* Tabs - Right ~40% */}
          <Card className={cardClass}>
            {selectedTextMeta && (
              <div className="p-4 border-b border-[#2A2A2A] bg-[#1A1A1A] space-y-4 max-h-[50vh] overflow-y-auto">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-semibold text-white">Edit text</h4>
                  <button
                    type="button"
                    onClick={deselectText}
                    className="text-xs text-[#A0A0A0] hover:text-white"
                  >
                    Deselect
                  </button>
                </div>
                <div>
                  <label className="text-xs text-[#E0E0E0] block mb-1">Content</label>
                  <textarea
                    value={selectedTextMeta.type === "title" ? selectedTextMeta.content : selectedTextMeta.content.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ")}
                    onChange={(e) => updateTextContent(e.target.value)}
                    className="w-full p-2 bg-[#2A2A2A] rounded text-sm text-white border border-[#333] min-h-[60px]"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="text-xs text-[#E0E0E0] block mb-1">Text color</label>
                  <div className="flex gap-1.5 flex-wrap mb-2">
                    {["#000000", "#374151", "#6B7280", "#FFFFFF", "#FF6B35", "#3B82F6", "#10B981", "#F59E0B", "#EF4444"].map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => updateTextStyle("color", color)}
                        className={`w-7 h-7 rounded border-2 shrink-0 ${rgbToHex(selectedTextMeta.styles.color ?? "") === color ? "border-orange-500" : "border-[#2A2A2A]"}`}
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
                  <label className="text-xs text-[#E0E0E0] block mb-1">Font size: {parseInt(selectedTextMeta.styles.fontSize ?? "16", 10)}px</label>
                  <input
                    type="range"
                    min="12"
                    max="72"
                    step="2"
                    value={parseInt(selectedTextMeta.styles.fontSize ?? "16", 10)}
                    onChange={(e) => updateTextStyle("fontSize", `${e.target.value}px`)}
                    className="w-full h-2 bg-[#2A2A2A] rounded accent-orange-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#E0E0E0] block mb-1">Font</label>
                  <select
                    value={(selectedTextMeta.styles.fontFamily ?? "Inter").split(",")[0].trim()}
                    onChange={(e) => updateTextStyle("fontFamily", e.target.value + ", sans-serif")}
                    className="w-full p-2 bg-[#2A2A2A] rounded text-sm text-white border border-[#333]"
                  >
                    {["Inter", "Arial", "Georgia", "Times New Roman", "Courier New", "Verdana", "Helvetica", "Playfair Display", "Roboto", "Open Sans", "Lato", "Montserrat"].map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#E0E0E0] block mb-1">Weight</label>
                  <div className="grid grid-cols-4 gap-1">
                    {(["300", "400", "600", "700"] as const).map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => updateTextStyle("fontWeight", w)}
                        className={`px-2 py-1.5 rounded text-xs ${(selectedTextMeta.styles.fontWeight ?? "400") === w ? "bg-orange-500 text-white" : "bg-[#2A2A2A] text-[#A0A0A0] hover:bg-[#333]"}`}
                      >
                        {w === "300" ? "Light" : w === "400" ? "Normal" : w === "600" ? "Semi" : "Bold"}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[#E0E0E0] block mb-1">Alignment</label>
                  <div className="grid grid-cols-4 gap-1">
                    {(["left", "center", "right", "justify"] as const).map((align) => (
                      <button
                        key={align}
                        type="button"
                        onClick={() => updateTextStyle("textAlign", align)}
                        className={`p-2 rounded text-xs ${(selectedTextMeta.styles.textAlign ?? "left") === align ? "bg-orange-500 text-white" : "bg-[#2A2A2A] text-[#A0A0A0] hover:bg-[#333]"}`}
                      >
                        {align === "left" ? "Left" : align === "center" ? "Center" : align === "right" ? "Right" : "Justify"}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[#E0E0E0] block mb-1">Line height: {parseFloat(selectedTextMeta.styles.lineHeight ?? "1.6").toFixed(1)}</label>
                  <input
                    type="range"
                    min="1"
                    max="3"
                    step="0.1"
                    value={parseFloat(selectedTextMeta.styles.lineHeight ?? "1.6")}
                    onChange={(e) => updateTextStyle("lineHeight", e.target.value)}
                    className="w-full h-2 bg-[#2A2A2A] rounded accent-orange-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#E0E0E0] block mb-1">Effects</label>
                  <div className="grid grid-cols-2 gap-1">
                    <button type="button" onClick={() => toggleTextDecoration("underline")} className="px-2 py-1.5 bg-[#2A2A2A] hover:bg-[#333] rounded text-xs text-[#E0E0E0]">
                      <u>Underline</u>
                    </button>
                    <button type="button" onClick={() => toggleTextDecoration("line-through")} className="px-2 py-1.5 bg-[#2A2A2A] hover:bg-[#333] rounded text-xs text-[#E0E0E0]">
                      <s>Strikethrough</s>
                    </button>
                    <button type="button" onClick={() => updateTextStyle("textTransform", "uppercase")} className="px-2 py-1.5 bg-[#2A2A2A] hover:bg-[#333] rounded text-xs text-[#E0E0E0]">
                      UPPERCASE
                    </button>
                    <button type="button" onClick={() => updateTextStyle("textTransform", "none")} className="px-2 py-1.5 bg-[#2A2A2A] hover:bg-[#333] rounded text-xs text-[#E0E0E0]">
                      Normal
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[#E0E0E0] block mb-1">Highlight</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => updateTextStyle("backgroundColor", "transparent")} className="flex-1 py-1.5 bg-[#2A2A2A] rounded text-xs text-[#A0A0A0]">None</button>
                    {["#FEF3C7", "#DBEAFE", "#FEE2E2"].map((bg) => (
                      <button key={bg} type="button" onClick={() => updateTextStyle("backgroundColor", bg)} className="w-8 h-8 rounded border border-[#333]" style={{ backgroundColor: bg }} />
                    ))}
                  </div>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={resetTextStyles} className="w-full border-[#2A2A2A] text-[#A0A0A0]">
                  Reset to default
                </Button>
              </div>
            )}
            <Tabs defaultValue="content" className="w-full">
              <TabsList className="bg-[#0F0F0F] border-b border-[#2A2A2A] w-full grid grid-cols-5">
                <TabsTrigger value="content" className="data-[state=active]:bg-orange-500 text-xs gap-1">
                  <BookOpen className="w-3.5 h-3.5" /> Content
                </TabsTrigger>
                <TabsTrigger value="design" className="data-[state=active]:bg-orange-500 text-xs gap-1">
                  <Palette className="w-3.5 h-3.5" /> Design
                </TabsTrigger>
                <TabsTrigger value="graphics" className="data-[state=active]:bg-orange-500 text-xs gap-1">
                  <ImageIcon className="w-3.5 h-3.5" /> Graphics
                </TabsTrigger>
                <TabsTrigger value="layout" className="data-[state=active]:bg-orange-500 text-xs gap-1">
                  <LayoutGrid className="w-3.5 h-3.5" /> Layout
                </TabsTrigger>
                <TabsTrigger value="export" className="data-[state=active]:bg-orange-500 text-xs gap-1">
                  <FileOutput className="w-3.5 h-3.5" /> Export
                </TabsTrigger>
              </TabsList>
              <TabsContent value="content" className="mt-4 space-y-2 p-2">
                <p className="text-xs text-[#A0A0A0] mb-2">Table of Contents</p>
                {sections.map((section, i) => (
                  <div key={section.id} className="flex items-center justify-between gap-2 rounded-lg border border-[#2A2A2A] p-2">
                    <span className="text-sm text-[#E0E0E0] truncate">
                      {i + 1}. {section.title}
                    </span>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0 text-[#A0A0A0] hover:text-orange-500" onClick={() => openEdit(section)} aria-label="Edit section">
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" className="w-full mt-2 border-[#2A2A2A] text-[#A0A0A0] gap-1" onClick={addSection}>
                  <Plus className="w-3.5 h-3.5" /> Add New Section
                </Button>
              </TabsContent>
              <TabsContent value="design" className="mt-4 p-2">
                <p className="text-sm font-medium text-white mb-3">Template</p>
                <div className="grid grid-cols-2 gap-2">
                  {TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTemplate(t.id)}
                      className={`rounded-xl border-2 p-4 text-left transition-all ${
                        template === t.id ? "border-orange-500 bg-orange-500/10" : "border-[#2A2A2A] hover:border-[#3A3A3A]"
                      }`}
                    >
                      <p className="text-sm font-medium text-white">{t.label}</p>
                      <p className="text-xs text-[#A0A0A0] mt-0.5">{t.desc}</p>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-[#666] mt-3">Preview updates as you edit. More design options (Colors, Typography) coming soon.</p>
              </TabsContent>
              <TabsContent value="graphics" className="mt-4 p-2 space-y-6 max-h-[calc(100vh-12rem)] overflow-y-auto">
                <p className="text-xs text-[#A0A0A0] mb-2">Click to add to canvas. Drag on preview to move and resize. Delete/Backspace • Ctrl+C duplicate • Arrows nudge.</p>

                {backgroundImage && (
                  <div className="mb-4 p-3 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg space-y-3">
                    <p className="text-xs font-medium text-white">Background image</p>
                    <div>
                      <label className="text-xs text-[#A0A0A0] block mb-1">Opacity: {Math.round((backgroundSettings.opacity ?? 1) * 100)}%</label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={backgroundSettings.opacity ?? 1}
                        onChange={(e) => setBackgroundSettings((s) => ({ ...s, opacity: parseFloat(e.target.value) }))}
                        className="w-full h-2 bg-[#2A2A2A] rounded-lg appearance-none cursor-pointer accent-orange-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[#A0A0A0] block mb-1">Blur: {backgroundSettings.blur ?? 0}px</label>
                      <input
                        type="range"
                        min="0"
                        max="20"
                        step="1"
                        value={backgroundSettings.blur ?? 0}
                        onChange={(e) => setBackgroundSettings((s) => ({ ...s, blur: parseInt(e.target.value, 10) }))}
                        className="w-full h-2 bg-[#2A2A2A] rounded-lg appearance-none cursor-pointer accent-orange-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[#A0A0A0] block mb-1">Fit</label>
                      <select
                        value={backgroundSettings.fit ?? "cover"}
                        onChange={(e) => setBackgroundSettings((s) => ({ ...s, fit: e.target.value }))}
                        className="w-full p-2 bg-[#2A2A2A] rounded text-sm text-white border border-[#333]"
                      >
                        <option value="cover">Cover (fill)</option>
                        <option value="contain">Contain (fit)</option>
                        <option value="fill">Stretch</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-[#A0A0A0] block mb-1">Position</label>
                      <div className="grid grid-cols-3 gap-1">
                        {(["top", "center", "bottom"] as const).flatMap((v) =>
                          (["left", "center", "right"] as const).map((h) => {
                            const pos = `${v} ${h}`;
                            const label = (v === "top" ? "T" : v === "bottom" ? "B" : "·") + (h === "left" ? "L" : h === "right" ? "R" : "·");
                            return (
                              <button
                                key={pos}
                                type="button"
                                onClick={() => setBackgroundSettings((s) => ({ ...s, position: pos }))}
                                className={`p-1.5 rounded text-xs ${backgroundSettings.position === pos ? "bg-orange-500 text-white" : "bg-[#2A2A2A] text-[#A0A0A0] hover:bg-[#333]"}`}
                                title={pos}
                              >
                                {label}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                    <div className="border-t border-[#2A2A2A] pt-3 mt-3">
                      <p className="text-xs font-medium text-white mb-2">Content overlay</p>
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
                              overlaySettings.color === color ? "border-orange-500" : "border-[#2A2A2A]"
                            }`}
                            style={{ backgroundColor: bg }}
                            title={label}
                          />
                        ))}
                      </div>
                      <div className="mb-3">
                        <label className="text-xs text-[#A0A0A0] block mb-1">
                          Overlay strength: {Math.round((overlaySettings.opacity ?? 0.9) * 100)}%
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={overlaySettings.opacity ?? 0.9}
                          onChange={(e) => updateOverlay("opacity", parseFloat(e.target.value))}
                          className="w-full h-2 bg-[#2A2A2A] rounded-lg appearance-none cursor-pointer accent-orange-500"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {(["clean", "dark", "subtle", "none"] as const).map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setOverlayPreset(preset)}
                            className="px-2 py-1.5 bg-[#2A2A2A] hover:bg-[#333] rounded text-xs text-[#E0E0E0]"
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
                  </div>
                )}

                {selectedImageElement && (
                  <div className="p-4 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg space-y-4">
                    <h4 className="text-sm font-semibold text-white">Image settings</h4>
                    <Button
                      type="button"
                      onClick={setAsBackground}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white text-sm"
                    >
                      Set as background
                    </Button>
                    <div>
                      <label className="text-xs text-[#E0E0E0] block mb-1">Opacity: {Math.round((imageSettings.opacity ?? 1) * 100)}%</label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={imageSettings.opacity ?? 1}
                        onChange={(e) => updateImageSetting("opacity", parseFloat(e.target.value))}
                        className="w-full h-2 bg-[#2A2A2A] rounded-lg appearance-none cursor-pointer accent-orange-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[#E0E0E0] block mb-1">Blur: {imageSettings.blur ?? 0}px</label>
                      <input
                        type="range"
                        min="0"
                        max="20"
                        step="1"
                        value={imageSettings.blur ?? 0}
                        onChange={(e) => updateImageSetting("blur", parseInt(e.target.value, 10))}
                        className="w-full h-2 bg-[#2A2A2A] rounded-lg appearance-none cursor-pointer accent-orange-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[#E0E0E0] block mb-1">Brightness: {imageSettings.brightness ?? 100}%</label>
                      <input
                        type="range"
                        min="50"
                        max="150"
                        step="5"
                        value={imageSettings.brightness ?? 100}
                        onChange={(e) => updateImageSetting("brightness", parseInt(e.target.value, 10))}
                        className="w-full h-2 bg-[#2A2A2A] rounded-lg appearance-none cursor-pointer accent-orange-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[#E0E0E0] block mb-1">Contrast: {imageSettings.contrast ?? 100}%</label>
                      <input
                        type="range"
                        min="50"
                        max="150"
                        step="5"
                        value={imageSettings.contrast ?? 100}
                        onChange={(e) => updateImageSetting("contrast", parseInt(e.target.value, 10))}
                        className="w-full h-2 bg-[#2A2A2A] rounded-lg appearance-none cursor-pointer accent-orange-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[#E0E0E0] block mb-1">Saturation: {imageSettings.saturation ?? 100}%</label>
                      <input
                        type="range"
                        min="0"
                        max="200"
                        step="10"
                        value={imageSettings.saturation ?? 100}
                        onChange={(e) => updateImageSetting("saturation", parseInt(e.target.value, 10))}
                        className="w-full h-2 bg-[#2A2A2A] rounded-lg appearance-none cursor-pointer accent-orange-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[#E0E0E0] block mb-2">Quick filters</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(["none", "vintage", "grayscale", "warm", "cool", "fade"] as const).map((name) => (
                          <button
                            key={name}
                            type="button"
                            onClick={() => applyFilter(name)}
                            className="px-2 py-1.5 bg-[#2A2A2A] hover:bg-[#333] rounded text-xs text-[#E0E0E0]"
                          >
                            {name === "none" ? "None" : name === "grayscale" ? "B&W" : name.charAt(0).toUpperCase() + name.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={resetImageSettings} className="w-full border-[#2A2A2A] text-[#A0A0A0]">
                      Reset to original
                    </Button>
                  </div>
                )}

                {/* Icons */}
                <div>
                  <h3 className="text-sm font-medium text-white mb-2">Icons</h3>
                  <input
                    type="text"
                    placeholder="Search 1000+ icons..."
                    className="w-full p-2 mb-3 bg-[#1A1A1A] border border-[#2A2A2A] rounded text-sm text-white placeholder:text-[#666]"
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
                          activeIconCategory === category ? "bg-orange-500 text-white" : "bg-[#2A2A2A] text-[#E0E0E0] hover:bg-[#333]"
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
                          className="p-2 bg-[#1A1A1A] hover:bg-[#2A2A2A] border border-[#2A2A2A] hover:border-orange-500/50 rounded flex items-center justify-center aspect-square transition-colors"
                          title={iconId}
                        >
                          <Icon icon={iconId} className="w-6 h-6 text-[#E0E0E0]" />
                        </button>
                      ))}
                  </div>
                </div>

                {/* Color palettes */}
                <div>
                  <h3 className="text-sm font-medium text-white mb-2">Color palettes</h3>
                  <div className="flex gap-2 mb-3 flex-wrap">
                    {Object.keys(COLOR_PALETTES).map((style) => (
                      <button
                        key={style}
                        type="button"
                        onClick={() => setActivePaletteStyle(style)}
                        className={`px-3 py-1.5 rounded text-xs ${
                          activePaletteStyle === style ? "bg-orange-500 text-white" : "bg-[#2A2A2A] text-[#E0E0E0] hover:bg-[#333]"
                        }`}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {(COLOR_PALETTES[activePaletteStyle] ?? []).map((palette) => (
                      <div key={palette.name} className="bg-[#1A1A1A] border border-[#2A2A2A] p-2 rounded flex flex-wrap items-center gap-2">
                        <span className="text-xs text-[#A0A0A0] w-24 shrink-0">{palette.name}</span>
                        <div className="flex gap-1 flex-1">
                          {palette.colors.map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => handleApplyColor(color)}
                              className="w-8 h-8 rounded border-2 border-[#2A2A2A] hover:border-white shrink-0"
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
                  <h3 className="text-sm font-medium text-white mb-2">Custom color</h3>
                  <div className="[&_.react-colorful]:h-24 [&_.react-colorful]:w-full [&_.react-colorful]:rounded">
                    <HexColorPicker color={customColor} onChange={setCustomColor} />
                  </div>
                  <div className="flex gap-2 mt-2">
                    <input
                      type="text"
                      value={customColor}
                      onChange={(e) => setCustomColor(e.target.value)}
                      className="flex-1 p-2 bg-[#1A1A1A] border border-[#2A2A2A] rounded text-sm text-white font-mono"
                    />
                    <Button type="button" size="sm" onClick={() => handleApplyColor(customColor)} className="bg-orange-500 hover:bg-orange-600 shrink-0">
                      Apply
                    </Button>
                  </div>
                </div>

                {/* Shapes */}
                <div>
                  <h3 className="text-sm font-medium text-white mb-2">Shapes</h3>
                  <div className="grid grid-cols-4 gap-2">
                    {SHAPES.map((shape) => (
                      <button
                        key={shape.name}
                        type="button"
                        onClick={() => handleAddShape(shape.svg, graphicsAccentColor)}
                        className="aspect-square p-2 bg-[#1A1A1A] hover:bg-[#2A2A2A] border border-[#2A2A2A] hover:border-orange-500/50 rounded flex flex-col items-center justify-center transition-colors"
                      >
                        <svg viewBox="0 0 100 100" className="w-full h-8 text-[#E0E0E0]" fill="currentColor">
                          <g dangerouslySetInnerHTML={{ __html: shape.svg }} />
                        </svg>
                        <span className="text-[10px] text-[#A0A0A0] mt-1 truncate w-full text-center">{shape.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Stock photos */}
                <div>
                  <h3 className="text-sm font-medium text-white mb-2">Stock photos</h3>
                  <input
                    type="text"
                    placeholder="Search free photos..."
                    className="w-full p-2 mb-2 bg-[#1A1A1A] border border-[#2A2A2A] rounded text-sm text-white placeholder:text-[#666]"
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
                        className="px-2 py-1 bg-[#2A2A2A] hover:bg-[#333] rounded text-xs text-[#E0E0E0]"
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
                      {photos.map((photo) => (
                        <button
                          key={photo.id}
                          type="button"
                          onClick={() => handleAddPhoto(photo.fullUrl ?? photo.url ?? "")}
                          className="relative aspect-square rounded overflow-hidden border border-[#2A2A2A] hover:border-orange-500/50 group"
                        >
                          <img
                            src={photo.thumb ?? photo.url}
                            alt=""
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                            <span className="text-white text-xs">Add to canvas</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[#666] py-4">Search or pick a category to load photos. Photos by Unsplash.</p>
                  )}
                  <p className="text-[10px] text-[#555] mt-1">Photos by Unsplash</p>
                </div>
              </TabsContent>
              <TabsContent value="layout" className="mt-4 p-4">
                <h3 className="text-sm font-medium text-white mb-4">Text Layout</h3>
                <div className="space-y-6">
                  <div>
                    <label className="block mb-2 text-xs text-[#E0E0E0]">Paragraph Spacing</label>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.25"
                      value={layoutSettings.paragraphSpacing}
                      onChange={(e) => updateLayout("paragraphSpacing", parseFloat(e.target.value))}
                      className="w-full h-2 bg-[#2A2A2A] rounded-lg appearance-none cursor-pointer accent-orange-500"
                    />
                    <div className="flex justify-between text-xs text-[#666] mt-1">
                      <span>Tight</span>
                      <span>Normal</span>
                      <span>Loose</span>
                    </div>
                  </div>
                  <div>
                    <label className="block mb-2 text-xs text-[#E0E0E0]">Line Height</label>
                    <input
                      type="range"
                      min="1.2"
                      max="2"
                      step="0.1"
                      value={layoutSettings.lineHeight}
                      onChange={(e) => updateLayout("lineHeight", parseFloat(e.target.value))}
                      className="w-full h-2 bg-[#2A2A2A] rounded-lg appearance-none cursor-pointer accent-orange-500"
                    />
                    <div className="flex justify-between text-xs text-[#666] mt-1">
                      <span>Compact</span>
                      <span>Comfortable</span>
                      <span>Airy</span>
                    </div>
                  </div>
                  <div>
                    <label className="block mb-2 text-xs text-[#E0E0E0]">Text Alignment</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["left", "center", "justify"] as const).map((align) => (
                        <Button
                          key={align}
                          type="button"
                          variant="outline"
                          size="sm"
                          className={
                            layoutSettings.alignment === align
                              ? "border-orange-500 bg-orange-500/10 text-white"
                              : "border-[#2A2A2A] text-[#A0A0A0] hover:bg-[#2A2A2A]"
                          }
                          onClick={() => updateLayout("alignment", align)}
                        >
                          {align === "left" ? "⬅️ Left" : align === "center" ? "↔️ Center" : "⬌ Justify"}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block mb-2 text-xs text-[#E0E0E0]">Page Margins</label>
                    <input
                      type="range"
                      min="1"
                      max="4"
                      step="0.5"
                      value={layoutSettings.margins}
                      onChange={(e) => updateLayout("margins", parseFloat(e.target.value))}
                      className="w-full h-2 bg-[#2A2A2A] rounded-lg appearance-none cursor-pointer accent-orange-500"
                    />
                    <div className="flex justify-between text-xs text-[#666] mt-1">
                      <span>Narrow</span>
                      <span>Normal</span>
                      <span>Wide</span>
                    </div>
                  </div>
                  <div>
                    <label className="block mb-2 text-xs text-[#E0E0E0]">Section Spacing</label>
                    <input
                      type="range"
                      min="1"
                      max="4"
                      step="0.5"
                      value={layoutSettings.sectionSpacing}
                      onChange={(e) => updateLayout("sectionSpacing", parseFloat(e.target.value))}
                      className="w-full h-2 bg-[#2A2A2A] rounded-lg appearance-none cursor-pointer accent-orange-500"
                    />
                    <div className="flex justify-between text-xs text-[#666] mt-1">
                      <span>Compact</span>
                      <span>Comfortable</span>
                      <span>Spacious</span>
                    </div>
                  </div>
                  <div>
                    <label className="block mb-2 text-xs text-[#E0E0E0]">Content Width</label>
                    <select
                      value={layoutSettings.maxWidth}
                      onChange={(e) =>
                        updateLayout("maxWidth", e.target.value as "narrow" | "normal" | "wide" | "full")
                      }
                      className="w-full p-2 rounded-lg bg-[#2A2A2A] border border-[#3A3A3A] text-white text-sm"
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
                    className="w-full border-[#2A2A2A] text-[#A0A0A0] hover:bg-[#2A2A2A]"
                    onClick={resetLayout}
                  >
                    Reset to Defaults
                  </Button>
                </div>
              </TabsContent>
              <TabsContent value="export" className="mt-4 space-y-4 p-2">
                <p className="text-sm font-medium text-white">Download Your Product</p>
                <div className="space-y-2">
                  <Button size="sm" className="w-full bg-orange-500 hover:bg-orange-600 gap-1" onClick={handleDownloadPdf}>
                    <Download className="w-3.5 h-3.5" /> Download PDF
                  </Button>
                  <Button size="sm" variant="outline" className="w-full border-[#2A2A2A] text-[#A0A0A0] gap-1" onClick={handleGenerateVideos}>
                    Generate Marketing Videos →
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </div>

      {/* Edit Section Modal */}
      <Dialog open={!!editingSectionId} onOpenChange={(open) => !open && setEditingSectionId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-[#1A1A1A] border-[#2A2A2A] text-white">
          <DialogHeader>
            <DialogTitle>Edit Section: {sections.find((s) => s.id === editingSectionId)?.title ?? ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <RichTextEditor value={editingContent} onChange={setEditingContent} minHeight="220px" />
          </div>
          {editingSectionId && (
            <div className="flex flex-wrap gap-2 mt-4 border-t border-[#2A2A2A] pt-4">
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
            <Button variant="outline" className="border-[#2A2A2A] text-[#A0A0A0]" onClick={() => setEditingSectionId(null)}>
              Cancel
            </Button>
            <Button className="bg-orange-500 hover:bg-orange-600" onClick={saveEdit}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full product preview modal */}
      {showFullPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-[#1A1A1A] rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-[#2A2A2A]">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#2A2A2A] bg-[#1A1A1A] p-4">
              <h2 className="text-lg font-semibold text-white">Full Product Preview</h2>
              <Button variant="ghost" size="sm" className="text-[#A0A0A0] hover:text-white" onClick={() => setShowFullPreview(false)}>
                <X className="w-5 h-5" /> Close
              </Button>
            </div>
            <div
              className={`flex-1 overflow-y-auto p-8 bg-white text-[#1A1A1A] ${product.format === "workbook" ? "format-workbook product-editor-preview-layout" : ""}`}
            >
              <h1 className="text-3xl font-bold mb-6 text-[#333]">{product.title}</h1>
              <p className="text-sm text-[#666] mb-8">Format: {product.format}</p>
              {sections.map((section) => (
                <div key={section.id} className="mb-8">
                  <h2 className="text-2xl font-bold mb-4 text-[#333]">{section.title}</h2>
                  <div
                    className="prose prose-lg max-w-none text-[#555]"
                    dangerouslySetInnerHTML={{ __html: cleanMarkdownToHtml(section.content) }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
