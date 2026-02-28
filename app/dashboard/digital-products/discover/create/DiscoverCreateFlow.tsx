"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { HexColorPicker } from "react-colorful";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Loader2,
  Check,
  BookOpen,
  ClipboardList,
  Sheet,
  FileStack,
  GraduationCap,
  ListChecks,
  NotebookPen,
  Calendar,
  Pencil,
  Download,
  Plane,
  Wallet,
  Users,
  ArrowRight,
  Circle,
  Square,
  Search,
  Upload,
  ImageIcon,
  RefreshCw,
  X,
  MapPin,
  Luggage,
  Camera,
  DollarSign,
  CreditCard,
  PiggyBank,
  TrendingUp,
  User,
  UserPlus,
  UserCheck,
  ArrowLeft as ArrowLeftIcon,
  ArrowUp,
  ArrowDown,
  ArrowUpRight,
  Triangle,
  Star,
  Heart,
  Plus,
  Minus,
  ChevronRight,
  BarChart3,
  TrendingDown,
  Globe,
  Compass,
  UserX,
  ChevronDown,
  Info,
  CircleAlert,
  type LucideIcon,
} from "lucide-react";
import { DraggableElement } from "./DraggableElement";
import type { DraggableElementData } from "./DraggableElement";
import { RichTextEditor, sectionBodyToHtml } from "@/components/RichTextEditor";

const PRODUCT_FORMATS = [
  { id: "ebook", label: "Ebook/Guide", icon: BookOpen, desc: "PDF with chapters, formatted text, and images", perfect: "Perfect for guides, tutorials, how-tos" },
  { id: "workbook", label: "Workbook", icon: ClipboardList, desc: "Interactive exercises with fill-in-blank sections", perfect: "Perfect for learning & transformation" },
  { id: "spreadsheet", label: "Spreadsheet", icon: Sheet, desc: "Budget trackers, calculators, Excel/Google Sheets", perfect: "Perfect for planners, financial tools" },
  { id: "notion", label: "Notion Template", icon: FileStack, desc: "Pre-built Notion database with templates", perfect: "Perfect for productivity tools" },
  { id: "course", label: "Course Outline", icon: GraduationCap, desc: "Module-by-module course structure with lessons", perfect: "Perfect for teaching & educational content" },
  { id: "checklist", label: "Checklist Pack", icon: ListChecks, desc: "Step-by-step action items, printable PDFs", perfect: "Perfect for simple quick-win products" },
  { id: "journal", label: "Journal", icon: NotebookPen, desc: "Guided prompts & writing space", perfect: "Perfect for reflection & daily writing" },
  { id: "planner", label: "Planner", icon: Calendar, desc: "Lined pages for planning & notes", perfect: "Perfect for goals, schedules & note-taking" },
];

const LENGTH_OPTIONS = [
  { value: "quick", label: "Quick Win (5-10 pages, simple & actionable)" },
  { value: "standard", label: "Standard (15-25 pages, comprehensive guide)" },
  { value: "deep", label: "Deep Dive (30-50 pages, ultimate resource)" },
];

const DESIGN_STYLES = [
  { value: "minimal", label: "Minimal & Clean", sub: "Lots of whitespace" },
  { value: "bold", label: "Bold & Modern", sub: "Colorful, geometric" },
  { value: "corporate", label: "Corporate", sub: "Formal, structured" },
  { value: "playful", label: "Creative & Playful", sub: "Illustrations, fun fonts" },
];

const ICON_MAP: Record<string, LucideIcon> = {
  Plane, MapPin, Luggage, Camera, Globe, Compass, DollarSign, CreditCard, Wallet, PiggyBank, TrendingUp, TrendingDown,
  User, Users, UserPlus, UserCheck, UserX, ArrowRight, ArrowLeft: ArrowLeftIcon, ArrowUp, ArrowDown, ArrowUpRight, ChevronRight, ChevronDown,
  Circle, Square, Triangle, Star, Heart, Check, X, Plus, Minus, Info, CircleAlert, BarChart3,
  BookOpen, ClipboardList, Sheet, FileStack, GraduationCap, ListChecks, Search, Upload, ImageIcon,
};

const ICON_CATEGORIES: Record<string, string[]> = {
  travel: ["Plane", "MapPin", "Luggage", "Camera", "Globe", "Compass"],
  money: ["DollarSign", "CreditCard", "Wallet", "PiggyBank", "TrendingUp", "TrendingDown"],
  people: ["User", "Users", "UserPlus", "UserCheck", "UserX"],
  arrows: ["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "ChevronRight", "ChevronDown"],
  shapes: ["Circle", "Square", "Triangle", "Star", "Heart"],
  ui: ["Check", "X", "Plus", "Minus", "Info", "CircleAlert"],
  content: ["BookOpen", "ClipboardList", "Sheet", "FileStack", "GraduationCap", "ListChecks", "Search", "Upload", "ImageIcon"],
};

const PLACEHOLDER_PHOTOS: Array<{ id: string; url?: string; thumb?: string; fullUrl?: string }> = [
  { id: "ph-1", thumb: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=400", fullUrl: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800" },
  { id: "ph-2", thumb: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400", fullUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800" },
  { id: "ph-3", thumb: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=400", fullUrl: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800" },
  { id: "ph-4", thumb: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=400", fullUrl: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800" },
  { id: "ph-5", thumb: "https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=400", fullUrl: "https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=800" },
  { id: "ph-6", thumb: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=400", fullUrl: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800" },
];

const LOADING_STEPS = [
  "Analyzing niche and audience",
  "Generating outline",
  "Writing content (Chapter 2 of 6)...",
  "Designing layout",
  "Adding branding",
  "Finalizing PDF",
];

const MOCK_TOC = [
  "Introduction to travel budgeting",
  "How to Use This Tracker",
  "7 Money-Saving Travel Tips",
  "Budget templates for different trip types",
  "Monthly expense tracker",
  "FAQ section",
];

/** Realistic mock content for "Travel Budget Tracker + Guide" HTML preview */
const MOCK_PRODUCT_CONTENT = [
  {
    id: "intro",
    title: "Introduction to Travel Budgeting",
    body: "Planning your dream vacation shouldn't mean coming home to financial stress. This comprehensive budget tracker helps you manage every aspect of your trip expenses, from flights and accommodation to daily activities and souvenirs. Whether you're heading abroad for two weeks or taking a weekend city break, having a clear budget in place lets you enjoy the experience without worrying about overspending.",
  },
  {
    id: "why",
    title: "Why Budget Your Trip?",
    body: "• Avoid coming home to credit card surprises\n• Enjoy your trip stress-free\n• Save money for future adventures\n• Make intentional spending choices\n• Share costs fairly when traveling with others",
  },
  {
    id: "ch1",
    title: "How to Use This Tracker",
    body: "Step 1: Set Your Total Budget\nBefore booking anything, decide how much you can comfortably spend. A good rule of thumb is to allocate 50% for transport and accommodation, 30% for activities and food, and 20% for extras and emergencies.\n\nStep 2: Break It Down by Category\nUse the monthly expense tracker sheets included in this guide to list every expected cost: flights, hotels, car hire, meals, attractions, and a buffer for the unexpected.\n\nStep 3: Track as You Go\nUpdate your tracker daily during the trip. This keeps you accountable and helps you adjust before it's too late.",
  },
  {
    id: "ch2",
    title: "7 Money-Saving Travel Tips",
    body: "1. Book Flights on Tuesdays\nAirlines often release sales on Monday evenings, making Tuesday the best day to find deals. Use price alerts and compare multiple search engines.\n\n2. Travel Off-Peak\nRates for accommodation and attractions drop outside school holidays and peak seasons. A week either side can save hundreds.\n\n3. Eat Like a Local\nSkip tourist traps and head to markets, bakeries, and local cafés. You'll get better food and lower bills.\n\n4. Use a Dedicated Travel Card\nPre-load a card with your budget and use it for all trip spending. It's easier to track and avoids overspending.\n\n5. Book Attractions in Advance\nMany museums and experiences offer online discounts. You also avoid long queues and sold-out days.\n\n6. Share Accommodation\nApartments and family rooms often work out cheaper per person than separate hotel rooms.\n\n7. Leave Room for Spontaneity\nSet aside 10–15% of your budget for unplanned experiences. Some of the best moments happen when you say yes to an extra excursion or dinner.",
  },
  {
    id: "templates",
    title: "Budget Templates for Different Trip Types",
    body: "We've included ready-to-use templates for: Beach holidays (flights, hotel, food, activities), City breaks (transport, attractions, dining), Road trips (fuel, accommodation, food, tolls), and Group trips (per-person split and shared costs). Each sheet has suggested categories—customise them to fit your trip.",
  },
  {
    id: "tracker",
    title: "Monthly Expense Tracker",
    body: "The tracker pages at the back of this guide let you log every expense by date and category. At the end of each day, note what you spent and the running total. If you're over budget in one area, you can reallocate from another before it's too late. Many of our users say this single habit has saved them £200–500 per trip.",
  },
  {
    id: "faq",
    title: "FAQ",
    body: "Q: What if my trip is in a different currency?\nA: Convert your total budget at the current rate and track in the local currency. Update the exchange rate once at the start to keep things simple.\n\nQ: Should I include travel insurance?\nA: Yes. Add it to your pre-trip costs so your on-the-ground budget is accurate.\n\nQ: How do I handle shared costs?\nA: Use the group trip template and note who paid. Settle up at the end using a single transfer to avoid multiple fees.",
  },
];

/** Alternate body text for "Regenerate Section" (different from initial so user sees change) */
const REGENERATED_BODIES: Record<string, string> = {
  intro: "Getting away from it all doesn't have to mean losing control of your finances. With the right system, you can plan every pound of your holiday budget—before you go—so you return relaxed, not broke. This guide gives you that system: simple trackers, clear categories, and a step-by-step process that works for any trip.",
  why: "• No more post-holiday debt hangover\n• Spend on what matters (experiences, not stress)\n• Build a repeatable habit for every trip\n• Easier to travel with friends or family when costs are clear\n• Hit your savings goal and still have fun",
  ch1: "Step 1: Set Your Total Budget\nDecide the maximum you can spend on this trip. Split it roughly: half for getting there and sleeping, 30% for food and activities, 20% for extras and emergencies.\n\nStep 2: Break It Down by Category\nUse the tracker sheets in this guide to list every cost: transport, accommodation, meals, attractions, shopping, and a buffer. Adjust as you book.\n\nStep 3: Track as You Go\nEach day, log what you spent. If one category runs over, pull back in another so your total stays on track.",
  ch2: "1. Book Flights on Tuesday—airlines often drop prices then.\n2. Travel just outside peak season for lower rates.\n3. Eat where locals eat; skip tourist menus.\n4. Use one travel card for all spending so you can track it.\n5. Book attractions online in advance for discounts.\n6. Consider apartments or family rooms to split costs.\n7. Keep 10–15% of your budget unallocated for spontaneous moments.",
  templates: "Templates included: Beach (flights, hotel, food, activities), City (transport, attractions, dining), Road trip (fuel, stays, food, tolls), Group (per-person split). Customise the categories to match your trip.",
  tracker: "The tracker pages help you log daily spending by category and see your running total. Update at the end of each day. If you're over in one area, reallocate from another. Users often save £200–500 per trip just by tracking.",
  faq: "Q: Different currency? A: Convert your total once at the start and track in local currency.\n\nQ: Travel insurance? A: Yes—include it in pre-trip costs so your trip budget is accurate.\n\nQ: Splitting costs? A: Use the group template, note who paid, and settle up once at the end.",
};

interface DiscoveryData {
  productName?: string;
  productDescription?: string;
  productIncluded?: string;
  productWhy?: string;
  productType?: string;
  productPrice?: string;
  niche?: string;
  productFormat?: string;
  courseOptions?: { includeAvatar?: boolean; voiceOver?: boolean; voiceType?: string };
  hooks?: Array<{ text: string; whyItWorks?: string }>;
  ctas?: Array<{ text: string; whyItWorks?: string }>;
}

type ProductSection = { id: string; title: string; body: string };

function ColorPickerSwatch({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="w-10 h-10 rounded border-2 border-[#2A2A2A] shrink-0 hover:ring-2 hover:ring-orange-500" style={{ backgroundColor: color }} />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3 bg-[#1A1A1A] border-[#2A2A2A]">
        <HexColorPicker color={color} onChange={onChange} />
        <Input
          value={color}
          onChange={(e) => { const v = e.target.value; onChange(v.startsWith("#") ? v : "#" + v); }}
          className="h-9 w-full mt-2 bg-[#0F0F0F] border-[#2A2A2A] text-white text-xs font-mono"
        />
      </PopoverContent>
    </Popover>
  );
}

const COLOR_PRESETS: { name: string; primary: string; secondary: string; background: string; text: string }[] = [
  { name: "Ocean", primary: "#0077B6", secondary: "#00B4D8", background: "#FFFFFF", text: "#1A1A1A" },
  { name: "Sunset", primary: "#FF6B35", secondary: "#F7931E", background: "#FFF8F0", text: "#2C1810" },
  { name: "Forest", primary: "#2D6A4F", secondary: "#40916C", background: "#F8FBF9", text: "#1B2830" },
  { name: "Modern", primary: "#2C3E50", secondary: "#3498DB", background: "#FFFFFF", text: "#1A1A1A" },
  { name: "Luxury", primary: "#1A1A2E", secondary: "#B8860B", background: "#F5F5DC", text: "#1A1A1A" },
  { name: "Playful", primary: "#E91E63", secondary: "#9C27B0", background: "#FFF5F8", text: "#2D2D2D" },
];

export default function DiscoverCreateFlow() {
  const router = useRouter();
  const [discoveryData, setDiscoveryData] = useState<DiscoveryData | null>(null);
  const [step, setStep] = useState<6 | 7 | 8>(6);
  const [format, setFormat] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const generationStartedRef = useRef(false);
  const [length, setLength] = useState<string>("standard");
  const [designStyle, setDesignStyle] = useState<string>("minimal");
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);
  // Design: colors (functional picker)
  const [primaryColor, setPrimaryColor] = useState("#FF6B35");
  const [secondaryColor, setSecondaryColor] = useState("#2C3E50");
  const [backgroundColor, setBackgroundColor] = useState("#FFFFFF");
  const [textColor, setTextColor] = useState("#1A1A1A");
  const [accentColor, setAccentColor] = useState("#F39C12");
  const [colorMode, setColorMode] = useState<"suggested" | "custom">("suggested");
  const [designSubTab, setDesignSubTab] = useState<"template" | "colors" | "typography" | "graphics" | "layout" | "reference">("colors");
  const [searchQuery, setSearchQuery] = useState("travel");
  const [photos, setPhotos] = useState<Array<{ id: string; url?: string; thumb?: string; fullUrl?: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [photosPage, setPhotosPage] = useState(1);
  const [photosTotalPages, setPhotosTotalPages] = useState(0);
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [referenceFiles, setReferenceFiles] = useState<File[]>([]);
  const [matchColors, setMatchColors] = useState(true);
  const [matchTypography, setMatchTypography] = useState(true);
  const [matchLayout, setMatchLayout] = useState(true);
  const [matchExact, setMatchExact] = useState(false);
  // Content editing (Step 8)
  const [productContent, setProductContent] = useState<ProductSection[]>(() => MOCK_PRODUCT_CONTENT.map((s) => ({ ...s })));
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [regeneratingSectionId, setRegeneratingSectionId] = useState<string | null>(null);
  // Typography
  const [headingFont, setHeadingFont] = useState("Inter");
  const [bodyFont, setBodyFont] = useState("Inter");
  const [h1Size, setH1Size] = useState(36);
  const [h2Size, setH2Size] = useState(28);
  const [h3Size, setH3Size] = useState(22);
  const [bodySize, setBodySize] = useState(16);
  const [lineHeight, setLineHeight] = useState(1.6);
  // Layout
  const [marginPreset, setMarginPreset] = useState<"narrow" | "normal" | "wide" | "custom">("normal");
  const [marginCustom, setMarginCustom] = useState({ top: 1, bottom: 1, left: 1, right: 1 });
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [includeWatermark, setIncludeWatermark] = useState(false);
  const [includeHeaderFooter, setIncludeHeaderFooter] = useState(true);
  const [sectionSpacing, setSectionSpacing] = useState(50);
  // Canvas elements (icons/images) - draggable, resizable, layered
  const [canvasElements, setCanvasElements] = useState<DraggableElementData[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [selectedIconForPlacement, setSelectedIconForPlacement] = useState<string | null>(null);
  const [previewPlacementMode, setPreviewPlacementMode] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  // Export
  const [pageSize, setPageSize] = useState<"a4" | "letter">("letter");
  const [includePageNumbers, setIncludePageNumbers] = useState(true);
  const [includeTOC, setIncludeTOC] = useState(true);
  const [includeCover, setIncludeCover] = useState(true);
  const [exportQuality, setExportQuality] = useState<"standard" | "high">("standard");

  const applyColors = () => {
    setColorMode("custom");
  };

  const applyPreset = (preset: (typeof COLOR_PRESETS)[0]) => {
    setPrimaryColor(preset.primary);
    setSecondaryColor(preset.secondary);
    setBackgroundColor(preset.background);
    setTextColor(preset.text);
    setColorMode("custom");
  };

  const getNextZIndex = useCallback(() => {
    if (canvasElements.length === 0) return 10;
    return Math.max(...canvasElements.map((e) => e.zIndex), 10) + 1;
  }, [canvasElements]);

  const handleAddIcon = useCallback(
    (iconName: string, atPosition?: { x: number; y: number }) => {
      const rect = previewRef.current?.getBoundingClientRect();
      const defaultSize = { width: 48, height: 48 };
      const position = atPosition
        ? { x: atPosition.x - defaultSize.width / 2, y: atPosition.y - defaultSize.height / 2 }
        : rect
          ? { x: rect.width / 2 - defaultSize.width / 2, y: Math.min(rect.height / 2 - defaultSize.height / 2, 200) }
          : { x: 200, y: 150 };
      const el: DraggableElementData = {
        id: `icon-${Date.now()}`,
        type: "icon",
        iconName,
        position,
        size: defaultSize,
        zIndex: getNextZIndex(),
      };
      setCanvasElements((prev) => [...prev, el]);
      setSelectedElementId(el.id);
      setSelectedIconForPlacement(null);
      setPreviewPlacementMode(false);
    },
    [getNextZIndex]
  );

  const handleAddImage = useCallback(
    (url: string) => {
      if (!url) return;
      const rect = previewRef.current?.getBoundingClientRect();
      const defaultSize = { width: 200, height: 150 };
      const position = rect
        ? { x: rect.width / 2 - defaultSize.width / 2, y: Math.min(rect.height / 2 - defaultSize.height / 2, 180) }
        : { x: 150, y: 120 };
      const el: DraggableElementData = {
        id: `image-${Date.now()}`,
        type: "image",
        url,
        position,
        size: defaultSize,
        zIndex: getNextZIndex(),
      };
      setCanvasElements((prev) => [...prev, el]);
      setSelectedElementId(el.id);
    },
    [getNextZIndex]
  );

  const handleUpdateElement = useCallback((id: string, position: { x: number; y: number }, size: { width: number; height: number }) => {
    setCanvasElements((prev) => prev.map((e) => (e.id === id ? { ...e, position, size } : e)));
  }, []);

  const handleDeleteElement = useCallback((id: string) => {
    setCanvasElements((prev) => prev.filter((e) => e.id !== id));
    setSelectedElementId((prev) => (prev === id ? null : prev));
  }, []);

  const handleBringToFront = useCallback((id: string) => {
    const nextZ = getNextZIndex();
    setCanvasElements((prev) => prev.map((e) => (e.id === id ? { ...e, zIndex: nextZ } : e)));
  }, [getNextZIndex]);

  const handleSendToBack = useCallback((id: string) => {
    const zValues = canvasElements.map((e) => e.zIndex);
    const minZ = zValues.length ? Math.min(10, ...zValues) : 10;
    setCanvasElements((prev) => prev.map((e) => (e.id === id ? { ...e, zIndex: minZ - 1 } : e)));
  }, [canvasElements]);

  const fetchStockPhotos = useCallback(async (query: string, page: number, append: boolean) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/stock-photos?query=${encodeURIComponent(query)}&page=${page}&per_page=12`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch");
      const list = (data.photos ?? []).map((p: { id: string; url?: string; thumb?: string; fullUrl?: string }) => ({ id: p.id, url: p.url, thumb: p.thumb, fullUrl: p.fullUrl }));
      setPhotos((prev) => (append ? [...prev, ...list] : list));
      setPhotosTotalPages(data.totalPages ?? 0);
    } catch (err) {
      console.error("Failed to fetch photos:", err);
      setPhotos((prev) => (append ? prev : PLACEHOLDER_PHOTOS));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const searchPhotos = useCallback(
    (query: string) => {
      setPhotosPage(1);
      fetchStockPhotos(query, 1, false);
    },
    [fetchStockPhotos]
  );

  const openEditSection = (section: ProductSection) => {
    setEditingSectionId(section.id);
    setEditingBody(section.body);
  };

  const saveEditSection = () => {
    if (!editingSectionId) return;
    setProductContent((prev) => prev.map((s) => (s.id === editingSectionId ? { ...s, body: editingBody } : s)));
    setEditingSectionId(null);
    setEditingBody("");
  };

  const handleAddNewSection = () => {
    const newId = `section-${Date.now()}`;
    setProductContent((prev) => [...prev, { id: newId, title: "New Section", body: "" }]);
    setEditingSectionId(newId);
    setEditingBody("");
  };

  const handleRegenerateSection = () => {
    const id = editingSectionId;
    if (!id) return;
    setRegeneratingSectionId(id);
    setEditingSectionId(null);
    setTimeout(() => {
      const newBody = REGENERATED_BODIES[id] ?? "";
      setProductContent((prev) => prev.map((s) => (s.id === id ? { ...s, body: newBody } : s)));
      setRegeneratingSectionId(null);
    }, 5000);
  };

  const getProductDetails = () => ({
    title: productTitle,
    description: discoveryData?.productDescription ?? "",
    niche: nicheName,
    sections: productContent.map((s) => ({ title: s.title, body: s.body })),
  });

  const exportPayload = () => ({
    format: format ?? "ebook",
    title: productTitle,
    description: discoveryData?.productDescription ?? "",
    niche: nicheName,
    sections: productContent.map((s) => ({ title: s.title, body: s.body })),
  });

  const handleDownloadPdf = async () => {
    const pdfFormats = ["ebook", "workbook", "course", "checklist"];
    const type = format && pdfFormats.includes(format) ? format : "ebook";
    try {
      const res = await fetch("/api/products/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...exportPayload(), format: type }) });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${productTitle.replace(/\s+/g, "-")}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      console.error("PDF export failed:", err);
      const blob = new Blob([productContent.map((s) => `${s.title}\n\n${s.body}`).join("\n\n---\n\n")], { type: "text/plain" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${productTitle.replace(/\s+/g, "-")}.txt`;
      a.click();
      URL.revokeObjectURL(a.href);
    }
  };

  const handleDownloadDocx = async () => {
    try {
      const res = await fetch("/api/products/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...exportPayload(), format: "docx" }) });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${productTitle.replace(/\s+/g, "-")}.docx`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      const blob = new Blob([productContent.map((s) => `${s.title}\n\n${s.body}`).join("\n\n---\n\n")], { type: "text/plain" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${productTitle.replace(/\s+/g, "-")}.txt`;
      a.click();
      URL.revokeObjectURL(a.href);
    }
  };

  const handleDownloadXlsx = async () => {
    try {
      const res = await fetch("/api/products/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...exportPayload(), format: "spreadsheet" }) });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${productTitle.replace(/\s+/g, "-")}.xlsx`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      console.error("XLSX export failed:", err);
    }
  };

  const handleDownloadNotion = async (fileType: "md" | "csv" | "txt") => {
    try {
      const res = await fetch("/api/products/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...exportPayload(), format: "notion" }) });
      if (!res.ok) throw new Error("Export failed");
      const data = await res.json();
      const content = fileType === "md" ? data.markdown : fileType === "csv" ? data.csv : data.instructions;
      const mime = fileType === "md" ? "text/markdown" : fileType === "csv" ? "text/csv" : "text/plain";
      const ext = fileType === "md" ? "md" : fileType === "csv" ? "csv" : "txt";
      const blob = new Blob([content ?? ""], { type: mime });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${productTitle.replace(/\s+/g, "-")}-${fileType === "md" ? "template" : fileType === "csv" ? "database" : "instructions"}.${ext}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      console.error("Notion export failed:", err);
    }
  };

  const handleDownloadPptx = async () => {
    try {
      const res = await fetch("/api/products/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...exportPayload(), format: "pptx" }) });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${productTitle.replace(/\s+/g, "-")}.pptx`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      console.error("PPTX export failed:", err);
    }
  };

  const handleDownloadJson = () => {
    const payload = {
      title: productTitle,
      description: discoveryData?.productDescription ?? "",
      niche: nicheName,
      format: format ?? "ebook",
      sections: productContent.map((s) => ({ id: s.id, title: s.title, body: s.body })),
      design: { primaryColor, secondaryColor, backgroundColor, textColor, headingFont, bodyFont },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${productTitle.replace(/\s+/g, "-")}-notion-template.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("discoveryData");
      if (raw) {
        const data = JSON.parse(raw) as DiscoveryData;
        setDiscoveryData(data);
        if (data.productFormat && ["ebook", "workbook", "spreadsheet", "notion", "course", "checklist"].includes(data.productFormat)) {
          setFormat(data.productFormat);
          // Coming from Discover flow (Step 6 done there): go straight to Step 7 and generate
          const fromDiscover = data.productName?.trim() && data.productName !== "Product";
          if (fromDiscover) setStep(7);
        }
      } else {
        setDiscoveryData({ productName: "Product", niche: "Your Niche" });
      }
    } catch {
      setDiscoveryData({ productName: "Product", niche: "Your Niche" });
    }
  }, []);

  useEffect(() => {
    if (designSubTab === "graphics" && photos.length === 0 && !isLoading) {
      searchPhotos(searchQuery);
    }
  }, [designSubTab, searchQuery, photos.length, isLoading, searchPhotos]);

  // Step 7: Real AI product content generation
  useEffect(() => {
    if (step !== 7 || !format || generationStartedRef.current) return;
    const data = discoveryData;
    const productName = data?.productName?.trim() || "Product";
    generationStartedRef.current = true;
    setGenerateError(null);
    setLoadingProgress(0);
    setLoadingStepIndex(0);

    const stepInterval = setInterval(() => {
      setLoadingStepIndex((i) => (i >= LOADING_STEPS.length - 1 ? i : i + 1));
    }, 2500);
    const progressInterval = setInterval(() => {
      setLoadingProgress((p) => Math.min(100, p + 2));
    }, 200);

    (async () => {
      try {
        const res = await fetch("/api/products/generate-content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productName,
            productDescription: data?.productDescription ?? "",
            productIncluded: data?.productIncluded ?? "",
            productWhy: data?.productWhy ?? "",
            niche: data?.niche ?? "",
            format,
            hooks: data?.hooks?.map((h) => h.text) ?? [],
            ctas: data?.ctas?.map((c) => c.text) ?? [],
          }),
        });
        const json = await res.json();
        clearInterval(stepInterval);
        clearInterval(progressInterval);
        setLoadingProgress(100);
        setLoadingStepIndex(LOADING_STEPS.length - 1);
        if (!res.ok) {
          setGenerateError(json.error || "Failed to generate product");
          generationStartedRef.current = false;
          return;
        }
        const sections = json.sections ?? [];
        if (sections.length > 0) {
          setProductContent(sections.map((s: { id: string; title: string; body: string }) => ({ id: s.id, title: s.title, body: s.body })));
          setTimeout(() => setStep(8), 400);
        } else {
          setGenerateError("No content was generated");
          generationStartedRef.current = false;
        }
      } catch (err) {
        clearInterval(stepInterval);
        clearInterval(progressInterval);
        setGenerateError(err instanceof Error ? err.message : "Network error");
        generationStartedRef.current = false;
      }
    })();
    return () => {
      clearInterval(stepInterval);
      clearInterval(progressInterval);
    };
  }, [step, format, discoveryData?.productName, discoveryData?.productDescription, discoveryData?.productIncluded, discoveryData?.productWhy, discoveryData?.niche, discoveryData?.hooks, discoveryData?.ctas]);

  const productTitle = discoveryData?.productName?.trim() || "Product";
  const nicheName = discoveryData?.niche ?? "Your Niche";

  const handleGenerateProduct = () => {
    generationStartedRef.current = false;
    setGenerateError(null);
    setStep(7);
    setLoadingProgress(0);
    setLoadingStepIndex(0);
  };

  const handleGenerateVideos = () => {
    try {
      sessionStorage.setItem(
        "digitalProductForm",
        JSON.stringify({
          productName: productTitle,
          productDescription: discoveryData?.productDescription ?? "",
          productType: "digital",
          productFileOrLinkMode: "file",
          hasFile: true,
          fileName: `${productTitle.replace(/\s+/g, "-")}.pdf`,
        })
      );
    } catch {
      // ignore
    }
    router.push("/dashboard/digital-products/scripts");
  };

  const cardClass = "border-[#2A2A2A] bg-[#1A1A1A]";

  // ─── STEP 6: Product Format Selection & Details ─────────────────────────
  if (step === 6) {
    return (
      <main className="min-h-screen bg-[#0F0F0F] text-white pb-32">
        <div className="max-w-4xl mx-auto p-6 md:p-10">
          <Link
            href="/dashboard/digital-products/discover"
            className="inline-flex items-center gap-2 text-sm text-[#A0A0A0] hover:text-orange-500 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Discovery
          </Link>
          <div className="mb-8">
            <Progress value={100} className="h-2 bg-[#2A2A2A]" />
            <p className="text-xs text-[#A0A0A0] mt-2">Step 6 of 6</p>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Let&apos;s create {productTitle}</h1>
          <p className="text-[#A0A0A0] mb-10">Choose the format and we&apos;ll generate it for you</p>

          <Label className="text-white text-base block mb-4">What type of product do you want to create?</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
            {PRODUCT_FORMATS.map((f) => {
              const Icon = f.icon;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFormat(f.id)}
                  className={`rounded-xl border-2 p-5 text-left transition-all ${
                    format === f.id ? "border-orange-500 bg-orange-500/10" : "border-[#2A2A2A] bg-[#1A1A1A] hover:border-[#3A3A3A]"
                  }`}
                >
                  <Icon className="w-8 h-8 text-orange-500 mb-3" />
                  <p className="font-semibold text-white mb-1">{f.label}</p>
                  <p className="text-xs text-[#A0A0A0] mb-2">{f.desc}</p>
                  <p className="text-xs text-[#666]">{f.perfect}</p>
                  <p className="text-xs text-orange-500 mt-2">{format === f.id ? "Selected" : "Select"}</p>
                </button>
              );
            })}
          </div>

          {format && (
            <>
              <Label className="text-white text-base block mb-3">Product Length/Depth</Label>
              <div className="flex flex-wrap gap-3 mb-8">
                {LENGTH_OPTIONS.map((l) => (
                  <label
                    key={l.value}
                    className={`flex items-center gap-2 rounded-lg border px-4 py-3 cursor-pointer ${
                      length === l.value ? "border-orange-500 bg-orange-500/10" : "border-[#2A2A2A]"
                    }`}
                  >
                    <input type="radio" name="length" value={l.value} checked={length === l.value} onChange={() => setLength(l.value)} className="sr-only" />
                    <span className="text-sm text-[#E0E0E0]">{l.label}</span>
                  </label>
                ))}
              </div>

              <Label className="text-white text-base block mb-3">Design Style</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                {DESIGN_STYLES.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => setDesignStyle(d.value)}
                    className={`rounded-xl border-2 p-4 text-center transition-all ${
                      designStyle === d.value ? "border-orange-500 bg-orange-500/10" : "border-[#2A2A2A] hover:border-[#3A3A3A]"
                    }`}
                  >
                    <p className="text-sm font-medium text-white">{d.label}</p>
                    <p className="text-xs text-[#A0A0A0] mt-0.5">{d.sub}</p>
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-4 mb-8">
                <div>
                  <Label className="text-white text-sm block mb-2">Brand Colors (optional)</Label>
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-lg bg-orange-500 border-2 border-[#2A2A2A]" />
                    <span className="text-xs text-[#A0A0A0]">Use suggested colors for this niche</span>
                  </div>
                </div>
                <div>
                  <Label className="text-white text-sm block mb-2">Add Your Logo (optional)</Label>
                  <Button variant="outline" size="sm" className="border-[#2A2A2A] text-[#A0A0A0]">Upload</Button>
                  <span className="text-xs text-[#666] ml-2">or Skip for now</span>
                </div>
              </div>

              <Card className={cardClass + " mb-8"}>
                <CardHeader>
                  <CardTitle className="text-lg text-white">Review & Generate</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-[#A0A0A0]">You&apos;re about to create:</p>
                  <div className="rounded-lg bg-[#0F0F0F] border border-[#2A2A2A] p-4 space-y-2 text-sm">
                    <p className="text-white font-medium">
                      {PRODUCT_FORMATS.find((x) => x.id === format)?.label}
                    </p>
                    <p><span className="text-[#A0A0A0]">Title:</span> {productTitle}</p>
                    <p><span className="text-[#A0A0A0]">Niche:</span> {nicheName}</p>
                    <p><span className="text-[#A0A0A0]">Length:</span> {LENGTH_OPTIONS.find((l) => l.value === length)?.label}</p>
                    <p><span className="text-[#A0A0A0]">Style:</span> {DESIGN_STYLES.find((d) => d.value === designStyle)?.label}</p>
                    <p className="text-[#A0A0A0] pt-2">What&apos;s inside:</p>
                    <ul className="list-disc list-inside text-[#E0E0E0] space-y-1">
                      {MOCK_TOC.map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                    <p className="text-orange-500 text-xs pt-2">This will use 1 product creation credit</p>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" className="border-[#2A2A2A] text-[#A0A0A0]" onClick={() => setFormat(null)}>
                      ← Back to Edit
                    </Button>
                    <Button className="bg-orange-500 hover:bg-orange-600" onClick={handleGenerateProduct}>
                      Generate My Product →
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {!format && (
            <p className="text-sm text-[#A0A0A0]">Select a product format above to continue.</p>
          )}
        </div>
      </main>
    );
  }

  // ─── STEP 7: Product Generation Loading ──────────────────────────────────
  if (step === 7) {
    return (
      <main className="min-h-screen bg-[#0F0F0F] text-white flex flex-col items-center justify-center p-6">
        {generateError ? (
          <>
            <p className="text-red-400 mb-4">{generateError}</p>
            <Button className="bg-orange-500 hover:bg-orange-600" onClick={handleGenerateProduct}>
              Try Again
            </Button>
            <Button variant="ghost" className="text-[#A0A0A0] mt-2" onClick={() => { setGenerateError(null); setStep(6); generationStartedRef.current = false; }}>
              Back to format
            </Button>
          </>
        ) : (
          <>
            <Loader2 className="w-16 h-16 text-orange-500 animate-spin mb-6" />
            <h2 className="text-xl font-semibold text-white mb-2">Generating your {PRODUCT_FORMATS.find((f) => f.id === format)?.label ?? "Product"}...</h2>
            <div className="w-full max-w-md space-y-3 mt-6">
              {LOADING_STEPS.map((s, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  {i < loadingStepIndex ? (
                    <Check className="w-5 h-5 text-green-500 shrink-0" />
                  ) : i === loadingStepIndex ? (
                    <Loader2 className="w-5 h-5 text-orange-500 animate-spin shrink-0" />
                  ) : (
                    <span className="w-5 h-5 rounded-full border border-[#2A2A2A] shrink-0" />
                  )}
                  <span className={i <= loadingStepIndex ? "text-[#E0E0E0]" : "text-[#666]"}>{s}</span>
                </div>
              ))}
            </div>
            <p className="text-sm text-[#A0A0A0] mt-8">AI is writing your content — usually 30–90 seconds</p>
            <Progress value={loadingProgress} className="w-full max-w-md h-2 mt-4 bg-[#2A2A2A]" />
          </>
        )}
      </main>
    );
  }

  // ─── STEP 8: Product Review & Edit ───────────────────────────────────────
  return (
    <main className="min-h-screen bg-[#0F0F0F] text-white pb-24">
      <div className="max-w-6xl mx-auto p-6 md:p-10">
        <div className="flex items-center gap-2 mb-2">
          <Check className="w-6 h-6 text-green-500" />
          <h1 className="text-2xl font-bold text-white">{productTitle} is ready!</h1>
        </div>
        <p className="text-[#A0A0A0] mb-8">Step 8 of 9 — Edit, design & export your product</p>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Left: HTML Preview - actual product content */}
          <div className="md:col-span-2">
            <Card className={cardClass}>
              <CardHeader>
                <CardTitle className="text-lg text-white">Preview</CardTitle>
                <p className="text-xs text-[#A0A0A0]">Page 1 of {productContent.length + 1}</p>
              </CardHeader>
              <CardContent>
                <div
                  ref={previewRef}
                  className={`max-h-[70vh] overflow-y-auto rounded-lg border border-[#2A2A2A] relative ${previewPlacementMode ? "cursor-crosshair" : ""}`}
                  style={{
                    minHeight: "480px",
                    backgroundColor,
                    color: textColor,
                    fontFamily: bodyFont === "Inter" ? "var(--font-sans), sans-serif" : bodyFont,
                    padding: marginPreset === "narrow" ? "12px 16px" : marginPreset === "wide" ? "24px 32px" : marginPreset === "custom" ? `${marginCustom.top * 8}px ${marginCustom.right * 8}px ${marginCustom.bottom * 8}px ${marginCustom.left * 8}px` : "20px 24px",
                    ...(designStyle === "minimal" ? { letterSpacing: "0.02em" } : designStyle === "bold" ? { fontWeight: 600 } : designStyle === "corporate" ? { letterSpacing: "0.01em" } : {}),
                  }}
                >
                  <div className="relative z-0">
                    <h2 className="font-bold border-b pb-2" style={{ color: primaryColor, fontFamily: headingFont, fontSize: `${h1Size}px` }}>
                      {productTitle}
                    </h2>
                    {productContent.map((section, idx) => (
                      <section key={section.id} className="space-y-3" style={{ marginTop: idx === 0 ? undefined : `${sectionSpacing}px` }}>
                        <h3 className="font-semibold" style={{ color: secondaryColor, fontFamily: headingFont, fontSize: `${h2Size}px` }}>
                          {section.title}
                        </h3>
                        <div className="leading-relaxed" style={{ fontSize: `${bodySize}px`, lineHeight }}>
                          {sectionBodyToHtml(section.body) ? (
                            <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: section.body }} />
                          ) : (
                            <span className="whitespace-pre-line">{section.body}</span>
                          )}
                        </div>
                      </section>
                    ))}
                    <p className="text-xs opacity-70 pt-4">Scroll for more content...</p>
                  </div>

                  {/* Overlay canvas for draggable/resizable elements */}
                  <div
                    className="absolute inset-0 z-10 min-h-[480px]"
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("[data-draggable-element]")) return;
                      setSelectedElementId(null);
                      if (previewPlacementMode && selectedIconForPlacement && previewRef.current) {
                        const rect = previewRef.current.getBoundingClientRect();
                        const scrollTop = previewRef.current.scrollTop || 0;
                        const scrollLeft = previewRef.current.scrollLeft || 0;
                        handleAddIcon(selectedIconForPlacement, {
                          x: e.clientX - rect.left + scrollLeft,
                          y: e.clientY - rect.top + scrollTop,
                        });
                      }
                    }}
                  >
                    {canvasElements.map((el) => {
                      const content =
                        el.type === "icon" && el.iconName ? (
                          (() => {
                            const IconC = ICON_MAP[el.iconName];
                            return IconC ? <IconC className="w-full h-full p-2" style={{ color: secondaryColor }} /> : <span>{el.iconName}</span>;
                          })()
                        ) : el.type === "image" && el.url ? (
                          <img src={el.url} alt="" className="w-full h-full object-cover" />
                        ) : null;
                      return (
                        <DraggableElement
                          key={el.id}
                          element={el}
                          content={content}
                          isSelected={selectedElementId === el.id}
                          onSelect={setSelectedElementId}
                          onDelete={handleDeleteElement}
                          onUpdate={handleUpdateElement}
                          onBringToFront={handleBringToFront}
                          onSendToBack={handleSendToBack}
                          accentColor={primaryColor}
                        />
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Edit panel - Content / Design (with sub-tabs) / Export */}
          <div>
            <Card className={cardClass}>
              <Tabs defaultValue="content" className="w-full">
                <TabsList className="bg-[#0F0F0F] border border-[#2A2A2A] w-full grid grid-cols-3">
                  <TabsTrigger value="content" className="data-[state=active]:bg-orange-500 text-xs">Content</TabsTrigger>
                  <TabsTrigger value="design" className="data-[state=active]:bg-orange-500 text-xs">Design</TabsTrigger>
                  <TabsTrigger value="export" className="data-[state=active]:bg-orange-500 text-xs">Export</TabsTrigger>
                </TabsList>
                <TabsContent value="content" className="mt-4 space-y-2">
                  <p className="text-xs text-[#A0A0A0] mb-3">Table of Contents</p>
                  {productContent.map((section, i) => (
                    <div key={section.id} className="flex items-center justify-between gap-2 rounded-lg border border-[#2A2A2A] p-2">
                      <span className="text-sm text-[#E0E0E0] truncate">{i + 1}. {section.title}</span>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0 text-[#A0A0A0] hover:text-orange-500" onClick={() => openEditSection(section)} aria-label="Edit section">
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </TabsContent>
                <TabsContent value="design" className="mt-4">
                  <div className="flex flex-wrap gap-1 mb-4">
                    {(["template", "colors", "typography", "graphics", "layout", "reference"] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setDesignSubTab(tab)}
                        className={`rounded-md px-2 py-1.5 text-xs capitalize ${designSubTab === tab ? "bg-orange-500 text-white" : "bg-[#2A2A2A] text-[#A0A0A0]"}`}
                      >
                        {tab === "template" ? "Template" : tab === "colors" ? "Colors" : tab === "typography" ? "Typography" : tab === "graphics" ? "Graphics" : tab === "layout" ? "Layout" : "Reference"}
                      </button>
                    ))}
                  </div>
                  {designSubTab === "template" && (
                    <div className="space-y-4">
                      <p className="text-sm font-medium text-white">Choose a Design Template</p>
                      <div className="grid grid-cols-2 gap-2">
                        {DESIGN_STYLES.map((d) => (
                          <button
                            key={d.value}
                            type="button"
                            onClick={() => setDesignStyle(d.value)}
                            className={`rounded-xl border-2 p-4 text-center transition-all ${designStyle === d.value ? "border-orange-500 bg-orange-500/10" : "border-[#2A2A2A] hover:border-[#3A3A3A]"}`}
                          >
                            <p className="text-sm font-medium text-white">{d.label}</p>
                            <p className="text-xs text-[#A0A0A0] mt-0.5">{d.sub}</p>
                            <p className="text-xs mt-2">{designStyle === d.value ? "● Selected" : "○ Select"}</p>
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-[#A0A0A0]">Template features: Clean typography · Modern colors · Professional spacing · Bold headings</p>
                      <Button size="sm" className="w-full bg-orange-500 hover:bg-orange-600" onClick={() => setDesignStyle(designStyle)}>
                        Apply Template
                      </Button>
                    </div>
                  )}
                  {designSubTab === "colors" && (
                    <div className="space-y-4">
                      <p className="text-sm font-medium text-white">Brand Colors</p>
                      <div className="space-y-3">
                        <div>
                          <Label className="text-xs text-[#A0A0A0]">Primary (Headers, Buttons)</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <ColorPickerSwatch color={primaryColor} onChange={setPrimaryColor} />
                            <Input
                              value={primaryColor}
                              onChange={(e) => { const v = e.target.value; setPrimaryColor(v.startsWith("#") ? v : "#" + v); }}
                              className="h-9 w-24 bg-[#0F0F0F] border-[#2A2A2A] text-white text-xs font-mono"
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-[#A0A0A0]">Secondary (Accents)</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <ColorPickerSwatch color={secondaryColor} onChange={setSecondaryColor} />
                            <Input
                              value={secondaryColor}
                              onChange={(e) => { const v = e.target.value; setSecondaryColor(v.startsWith("#") ? v : "#" + v); }}
                              className="h-9 w-24 bg-[#0F0F0F] border-[#2A2A2A] text-white text-xs font-mono"
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-[#A0A0A0]">Background Color</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <ColorPickerSwatch color={backgroundColor} onChange={setBackgroundColor} />
                            <Input
                              value={backgroundColor}
                              onChange={(e) => { const v = e.target.value; setBackgroundColor(v.startsWith("#") ? v : "#" + v); }}
                              className="h-9 w-24 bg-[#0F0F0F] border-[#2A2A2A] text-white text-xs font-mono"
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-[#A0A0A0]">Text Color</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <ColorPickerSwatch color={textColor} onChange={setTextColor} />
                            <Input
                              value={textColor}
                              onChange={(e) => { const v = e.target.value; setTextColor(v.startsWith("#") ? v : "#" + v); }}
                              className="h-9 w-24 bg-[#0F0F0F] border-[#2A2A2A] text-white text-xs font-mono"
                            />
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-[#A0A0A0] pt-1">Or use a preset palette:</p>
                      <div className="grid grid-cols-3 gap-2">
                        {COLOR_PRESETS.map((preset) => (
                          <button
                            key={preset.name}
                            type="button"
                            onClick={() => applyPreset(preset)}
                            className="flex flex-col items-center gap-1 rounded-lg border border-[#2A2A2A] p-2 hover:border-orange-500 transition-colors"
                          >
                            <div className="flex gap-0.5 w-full justify-center">
                              <span className="w-4 h-4 rounded border border-[#2A2A2A]" style={{ backgroundColor: preset.primary }} />
                              <span className="w-4 h-4 rounded border border-[#2A2A2A]" style={{ backgroundColor: preset.secondary }} />
                              <span className="w-4 h-4 rounded border border-[#2A2A2A]" style={{ backgroundColor: preset.background }} />
                            </div>
                            <span className="text-xs text-[#E0E0E0]">{preset.name}</span>
                          </button>
                        ))}
                      </div>
                      <Button size="sm" className="w-full bg-orange-500 hover:bg-orange-600" onClick={applyColors}>
                        Apply Colors
                      </Button>
                    </div>
                  )}
                  {designSubTab === "typography" && (
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                      <p className="text-sm font-medium text-white">Typography Settings</p>
                      <div>
                        <Label className="text-xs text-[#A0A0A0]">Heading Font</Label>
                        <select
                          value={headingFont}
                          onChange={(e) => setHeadingFont(e.target.value)}
                          className="mt-1 w-full rounded-md bg-[#0F0F0F] border border-[#2A2A2A] text-white text-sm px-3 py-2"
                        >
                          {["Inter", "Poppins", "Montserrat", "Roboto", "Playfair Display", "Lora"].map((f) => (
                            <option key={f} value={f}>{f}{headingFont === f ? " (selected)" : ""}</option>
                          ))}
                        </select>
                        <p className="text-xs text-[#666] mt-1">Preview: &ldquo;This is a heading&rdquo;</p>
                      </div>
                      <div>
                        <Label className="text-xs text-[#A0A0A0]">Body Font</Label>
                        <select
                          value={bodyFont}
                          onChange={(e) => setBodyFont(e.target.value)}
                          className="mt-1 w-full rounded-md bg-[#0F0F0F] border border-[#2A2A2A] text-white text-sm px-3 py-2"
                        >
                          {["Inter", "Open Sans", "Lato", "Source Sans Pro", "Merriweather"].map((f) => (
                            <option key={f} value={f}>{f}{bodyFont === f ? " (selected)" : ""}</option>
                          ))}
                        </select>
                        <p className="text-xs text-[#666] mt-1">Preview: &ldquo;This is body text. Lorem ipsum...&rdquo;</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-[#A0A0A0]">H1</Label>
                          <select value={h1Size} onChange={(e) => setH1Size(Number(e.target.value))} className="mt-1 w-full rounded-md bg-[#0F0F0F] border border-[#2A2A2A] text-white text-sm px-2 py-1.5">
                            {[28, 32, 36, 40, 44].map((n) => <option key={n} value={n}>{n}px</option>)}
                          </select>
                        </div>
                        <div>
                          <Label className="text-xs text-[#A0A0A0]">H2</Label>
                          <select value={h2Size} onChange={(e) => setH2Size(Number(e.target.value))} className="mt-1 w-full rounded-md bg-[#0F0F0F] border border-[#2A2A2A] text-white text-sm px-2 py-1.5">
                            {[22, 24, 28, 32].map((n) => <option key={n} value={n}>{n}px</option>)}
                          </select>
                        </div>
                        <div>
                          <Label className="text-xs text-[#A0A0A0]">H3</Label>
                          <select value={h3Size} onChange={(e) => setH3Size(Number(e.target.value))} className="mt-1 w-full rounded-md bg-[#0F0F0F] border border-[#2A2A2A] text-white text-sm px-2 py-1.5">
                            {[18, 20, 22, 24].map((n) => <option key={n} value={n}>{n}px</option>)}
                          </select>
                        </div>
                        <div>
                          <Label className="text-xs text-[#A0A0A0]">Body</Label>
                          <select value={bodySize} onChange={(e) => setBodySize(Number(e.target.value))} className="mt-1 w-full rounded-md bg-[#0F0F0F] border border-[#2A2A2A] text-white text-sm px-2 py-1.5">
                            {[14, 16, 18, 20].map((n) => <option key={n} value={n}>{n}px</option>)}
                          </select>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-[#A0A0A0]">Line Height</Label>
                        <select value={lineHeight} onChange={(e) => setLineHeight(Number(e.target.value))} className="mt-1 w-full rounded-md bg-[#0F0F0F] border border-[#2A2A2A] text-white text-sm px-3 py-2">
                          {[1.4, 1.5, 1.6, 1.8, 2].map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </div>
                      <Button size="sm" className="w-full bg-orange-500 hover:bg-orange-600">Apply Typography</Button>
                    </div>
                  )}
                  {designSubTab === "graphics" && (
                    <div className="space-y-4 max-h-[55vh] overflow-y-auto">
                      <p className="text-sm font-medium text-white">Graphics & Elements</p>
                      <p className="text-xs text-[#A0A0A0]">ILLUSTRATIONS</p>
                      <div className="grid grid-cols-6 gap-1.5">
                        {Object.entries(ICON_CATEGORIES).flatMap(([category, iconNames]) =>
                          iconNames.map((iconName) => {
                            const IconComponent = ICON_MAP[iconName];
                            if (!IconComponent) return null;
                            return (
                              <button
                                key={`${category}-${iconName}`}
                                type="button"
                                title={`${iconName} — click to add`}
                                onClick={() => {
                                  setSelectedIconForPlacement(iconName);
                                  setPreviewPlacementMode(true);
                                  handleAddIcon(iconName);
                                }}
                                className={`rounded-lg border p-2 flex items-center justify-center text-[#A0A0A0] hover:border-orange-500 hover:bg-[#2A2A2A] transition-colors ${selectedIconForPlacement === iconName ? "border-orange-500 bg-orange-500/10" : "border-[#2A2A2A]"}`}
                              >
                                <IconComponent className="w-5 h-5" />
                              </button>
                            );
                          })
                        )}
                      </div>
                      {previewPlacementMode && selectedIconForPlacement && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs text-orange-500">Click on preview to place another icon.</p>
                          <Button type="button" variant="ghost" size="sm" className="text-xs text-[#A0A0A0]" onClick={() => { setSelectedIconForPlacement(null); setPreviewPlacementMode(false); }}>Cancel</Button>
                        </div>
                      )}
                      <p className="text-xs text-[#A0A0A0] pt-2">PHOTOS (Stock)</p>
                      <div className="space-y-4">
                        <div className="flex gap-2">
                          <Input
                            type="text"
                            placeholder="Search photos..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && searchPhotos(searchQuery)}
                            className="flex-1 h-9 px-3 py-2 bg-[#0F0F0F] border-[#2A2A2A] text-white text-xs rounded"
                          />
                          <Button size="sm" className="h-9 px-4 bg-orange-500 hover:bg-orange-600 rounded shrink-0" onClick={() => searchPhotos(searchQuery)}>
                            <Search className="w-4 h-4" />
                          </Button>
                        </div>
                        {isLoading ? (
                          <div className="text-xs text-[#666] py-4">Loading photos...</div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
                            {photos.length === 0 ? (
                              <p className="col-span-2 text-xs text-[#666] py-4">Search for photos or try &quot;travel&quot;, &quot;beach&quot;, &quot;budget&quot;</p>
                            ) : (
                              photos.map((photo) => (
                                <div
                                  key={photo.id}
                                  className="relative group cursor-pointer rounded-lg overflow-hidden border border-[#2A2A2A]"
                                  onClick={() => handleAddImage(photo.fullUrl || photo.url || "")}
                                >
                                  {photo.thumb || photo.url ? (
                                    <img src={photo.thumb || photo.url} alt="" className="w-full h-24 object-cover" />
                                  ) : (
                                    <div className="w-full h-24 bg-[#2A2A2A] flex items-center justify-center text-[#666] text-xs">No image</div>
                                  )}
                                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                    <span className="text-white font-semibold text-sm">+ Add</span>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                        {photosTotalPages > 1 && photosPage < photosTotalPages && !isLoading && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full border-[#2A2A2A] text-[#A0A0A0]"
                            onClick={() => { setPhotosPage((p) => p + 1); fetchStockPhotos(searchQuery, photosPage + 1, true); }}
                          >
                            Load More Photos
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-[#666]">Powered by Unsplash</p>
                      <p className="text-xs text-[#A0A0A0]">UPLOAD CUSTOM</p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1 gap-1 border-[#2A2A2A] text-[#A0A0A0]"><Upload className="w-3.5 h-3.5" /> Upload Image</Button>
                        <Button variant="outline" size="sm" className="flex-1 gap-1 border-[#2A2A2A] text-[#A0A0A0]"><ImageIcon className="w-3.5 h-3.5" /> Upload Logo</Button>
                      </div>
                      <p className="text-xs text-[#666] italic">No custom uploads yet</p>
                      <p className="text-xs text-[#666] pt-1 italic">Click any icon, then click where you want it in the preview.</p>
                    </div>
                  )}
                  {designSubTab === "layout" && (
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                      <p className="text-sm font-medium text-white">Page Layout</p>
                      <div>
                        <Label className="text-xs text-[#A0A0A0]">Margins</Label>
                        <div className="space-y-2 mt-2">
                          {(["narrow", "normal", "wide"] as const).map((m) => (
                            <label key={m} className="flex items-center gap-2 cursor-pointer text-sm text-[#E0E0E0]">
                              <input type="radio" name="margin" checked={marginPreset === m && marginPreset !== "custom"} onChange={() => setMarginPreset(m)} className="rounded-full" />
                              {m === "narrow" ? "Narrow (0.5 in)" : m === "normal" ? "Normal (1 in)" : "Wide (1.5 in)"}
                            </label>
                          ))}
                          <label className="flex items-center gap-2 cursor-pointer text-sm text-[#E0E0E0]">
                            <input type="radio" name="margin" checked={marginPreset === "custom"} onChange={() => setMarginPreset("custom")} className="rounded-full" />
                            Custom (in)
                          </label>
                          {marginPreset === "custom" && (
                            <div className="grid grid-cols-4 gap-1 ml-6">
                              <div><Label className="text-[10px] text-[#666]">Top</Label><Input type="number" min={0} step={0.25} value={marginCustom.top} onChange={(e) => setMarginCustom((c) => ({ ...c, top: Number(e.target.value) || 0 }))} className="h-8 bg-[#0F0F0F] border-[#2A2A2A] text-white text-xs" /></div>
                              <div><Label className="text-[10px] text-[#666]">Bottom</Label><Input type="number" min={0} step={0.25} value={marginCustom.bottom} onChange={(e) => setMarginCustom((c) => ({ ...c, bottom: Number(e.target.value) || 0 }))} className="h-8 bg-[#0F0F0F] border-[#2A2A2A] text-white text-xs" /></div>
                              <div><Label className="text-[10px] text-[#666]">Left</Label><Input type="number" min={0} step={0.25} value={marginCustom.left} onChange={(e) => setMarginCustom((c) => ({ ...c, left: Number(e.target.value) || 0 }))} className="h-8 bg-[#0F0F0F] border-[#2A2A2A] text-white text-xs" /></div>
                              <div><Label className="text-[10px] text-[#666]">Right</Label><Input type="number" min={0} step={0.25} value={marginCustom.right} onChange={(e) => setMarginCustom((c) => ({ ...c, right: Number(e.target.value) || 0 }))} className="h-8 bg-[#0F0F0F] border-[#2A2A2A] text-white text-xs" /></div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-[#A0A0A0]">Page Orientation</Label>
                        <div className="flex gap-4 mt-2">
                          <label className="flex items-center gap-2 cursor-pointer text-sm text-[#E0E0E0]">
                            <input type="radio" name="orientation" checked={orientation === "portrait"} onChange={() => setOrientation("portrait")} className="rounded-full" />
                            Portrait
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer text-sm text-[#E0E0E0]">
                            <input type="radio" name="orientation" checked={orientation === "landscape"} onChange={() => setOrientation("landscape")} className="rounded-full" />
                            Landscape
                          </label>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-[#A0A0A0]">Include</Label>
                        <div className="space-y-1.5 mt-2">
                          <label className="flex items-center gap-2 text-sm text-[#E0E0E0] cursor-pointer"><Checkbox checked={includeTOC} onCheckedChange={(c) => setIncludeTOC(!!c)} /> Table of Contents</label>
                          <label className="flex items-center gap-2 text-sm text-[#E0E0E0] cursor-pointer"><Checkbox checked={includePageNumbers} onCheckedChange={(c) => setIncludePageNumbers(!!c)} /> Page Numbers</label>
                          <label className="flex items-center gap-2 text-sm text-[#E0E0E0] cursor-pointer"><Checkbox checked={includeHeaderFooter} onCheckedChange={(c) => setIncludeHeaderFooter(!!c)} /> Header/Footer</label>
                          <label className="flex items-center gap-2 text-sm text-[#E0E0E0] cursor-pointer"><Checkbox checked={includeWatermark} onCheckedChange={(c) => setIncludeWatermark(!!c)} /> Watermark</label>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-[#A0A0A0]">Section Spacing</Label>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-[#666]">Tight</span>
                          <input type="range" min={16} max={80} value={sectionSpacing} onChange={(e) => setSectionSpacing(Number(e.target.value))} className="flex-1 accent-orange-500" />
                          <span className="text-xs text-[#666]">Loose</span>
                        </div>
                      </div>
                      <Button size="sm" className="w-full bg-orange-500 hover:bg-orange-600">Apply Layout</Button>
                    </div>
                  )}
                  {designSubTab === "reference" && (
                    <div className="space-y-4">
                      <p className="text-sm font-medium text-white">Design Reference</p>
                      <p className="text-xs text-[#A0A0A0]">Upload design references to match style.</p>
                      <label className="block border-2 border-dashed border-[#2A2A2A] rounded-lg p-6 text-center cursor-pointer hover:border-orange-500 transition-colors">
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,application/pdf"
                          multiple
                          className="sr-only"
                          onChange={(e) => {
                            const files = e.target.files ? Array.from(e.target.files) : [];
                            if (files.some((f) => f.size > 10 * 1024 * 1024)) return;
                            setReferenceFiles((prev) => [...prev, ...files].slice(0, 10));
                            setReferenceImages((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
                          }}
                        />
                        <p className="text-sm text-[#E0E0E0]">Drag & drop images here or click to browse</p>
                        <p className="text-xs text-[#666] mt-1">PNG, JPG, PDF — Max 10MB each</p>
                      </label>
                      <p className="text-xs text-[#A0A0A0]">Uploaded References ({referenceFiles.length}):</p>
                      {referenceFiles.length === 0 ? (
                        <p className="text-xs text-[#666] italic">No references uploaded</p>
                      ) : (
                        <div className="flex gap-2 flex-wrap">
                          {referenceImages.map((url, i) => (
                            <div key={i} className="relative w-14 h-14 rounded bg-[#2A2A2A] overflow-hidden">
                              {referenceFiles[i]?.type?.includes("pdf") ? <span className="text-xs text-[#A0A0A0] p-2 flex items-center justify-center h-full">PDF</span> : <img src={url} alt="" className="w-full h-full object-cover" />}
                              <button type="button" onClick={() => { setReferenceImages((p) => p.filter((_, j) => j !== i)); setReferenceFiles((p) => p.filter((_, j) => j !== i)); }} className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white rounded-bl flex items-center justify-center"><X className="w-2.5 h-2.5" /></button>
                            </div>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-[#A0A0A0]">When you upload references, AI will match:</p>
                      <div className="space-y-1.5">
                        <label className="flex items-center gap-2 text-xs text-[#E0E0E0] cursor-pointer"><Checkbox checked={matchColors} onCheckedChange={(c) => setMatchColors(!!c)} /> Color palette</label>
                        <label className="flex items-center gap-2 text-xs text-[#E0E0E0] cursor-pointer"><Checkbox checked={matchTypography} onCheckedChange={(c) => setMatchTypography(!!c)} /> Typography style</label>
                        <label className="flex items-center gap-2 text-xs text-[#E0E0E0] cursor-pointer"><Checkbox checked={matchLayout} onCheckedChange={(c) => setMatchLayout(!!c)} /> Layout structure</label>
                        <label className="flex items-center gap-2 text-xs text-[#E0E0E0] cursor-pointer"><Checkbox checked={matchExact} onCheckedChange={(c) => setMatchExact(!!c)} /> Visual elements</label>
                      </div>
                      <Button variant="outline" size="sm" className="w-full border-orange-500/50 text-orange-500 hover:bg-orange-500/10">
                        Regenerate Product with References
                      </Button>
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="export" className="mt-4 space-y-4">
                  <p className="text-sm font-medium text-white">Download {productTitle}</p>
                  <div className="space-y-2 mb-4">
                    <Label className="text-xs text-[#A0A0A0]">Quality</Label>
                    <div className="flex gap-3">
                      <label className="flex items-center gap-2 cursor-pointer text-sm text-[#E0E0E0]">
                        <input type="radio" name="exportQuality" checked={exportQuality === "standard"} onChange={() => setExportQuality("standard")} className="rounded-full" />
                        Standard (faster, smaller file)
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-sm text-[#E0E0E0]">
                        <input type="radio" name="exportQuality" checked={exportQuality === "high"} onChange={() => setExportQuality("high")} className="rounded-full" />
                        High quality (slower, larger file)
                      </label>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {format === "spreadsheet" && (
                      <>
                        <Card className="border-[#2A2A2A] bg-[#0F0F0F]">
                          <CardContent className="p-4">
                            <p className="text-sm font-medium text-white">Excel Spreadsheet</p>
                            <p className="text-xs text-[#A0A0A0] mt-0.5">XLSX with sheets and formulas. Open in Excel or Google Sheets.</p>
                            <Button size="sm" className="mt-2 bg-orange-500 hover:bg-orange-600 gap-1" onClick={handleDownloadXlsx}>
                              <Download className="w-3.5 h-3.5" /> Download XLSX
                            </Button>
                          </CardContent>
                        </Card>
                        <Card className="border-[#2A2A2A] bg-[#0F0F0F]">
                          <CardContent className="p-4">
                            <p className="text-sm font-medium text-white">Google Sheets</p>
                            <p className="text-xs text-[#A0A0A0] mt-0.5">Upload the XLSX to Google Sheets to edit online</p>
                            <Button size="sm" variant="outline" className="mt-2 border-[#2A2A2A] text-[#A0A0A0]">Open Google Sheets</Button>
                          </CardContent>
                        </Card>
                      </>
                    )}
                    {format === "notion" && (
                      <>
                        <Card className="border-[#2A2A2A] bg-[#0F0F0F]">
                          <CardContent className="p-4">
                            <p className="text-sm font-medium text-white">Markdown File</p>
                            <p className="text-xs text-[#A0A0A0] mt-0.5">Import into Notion via /import</p>
                            <Button size="sm" className="mt-2 bg-orange-500 hover:bg-orange-600 gap-1" onClick={() => handleDownloadNotion("md")}>
                              <Download className="w-3.5 h-3.5" /> Download .md
                            </Button>
                          </CardContent>
                        </Card>
                        <Card className="border-[#2A2A2A] bg-[#0F0F0F]">
                          <CardContent className="p-4">
                            <p className="text-sm font-medium text-white">Database CSV</p>
                            <p className="text-xs text-[#A0A0A0] mt-0.5">Import as table in Notion</p>
                            <Button size="sm" variant="outline" className="mt-2 border-[#2A2A2A] text-[#A0A0A0] gap-1" onClick={() => handleDownloadNotion("csv")}>
                              <Download className="w-3.5 h-3.5" /> Download .csv
                            </Button>
                          </CardContent>
                        </Card>
                        <Card className="border-[#2A2A2A] bg-[#0F0F0F]">
                          <CardContent className="p-4">
                            <p className="text-sm font-medium text-white">Instructions</p>
                            <p className="text-xs text-[#A0A0A0] mt-0.5">How to import into Notion</p>
                            <Button size="sm" variant="outline" className="mt-2 border-[#2A2A2A] text-[#A0A0A0] gap-1" onClick={() => handleDownloadNotion("txt")}>
                              <Download className="w-3.5 h-3.5" /> Download instructions
                            </Button>
                          </CardContent>
                        </Card>
                      </>
                    )}
                    {format && ["ebook", "workbook", "course", "checklist"].includes(format) && (
                      <>
                        <Card className="border-[#2A2A2A] bg-[#0F0F0F]">
                          <CardContent className="p-4">
                            <p className="text-sm font-medium text-white">PDF</p>
                            <p className="text-xs text-[#A0A0A0] mt-0.5">{format === "ebook" && "Chapters & TOC. "}{format === "workbook" && "Fillable worksheets. "}{format === "course" && "Module outline. "}{format === "checklist" && "Printable checkboxes. "}Perfect for Gumroad, Etsy.</p>
                            <Button size="sm" className="mt-2 bg-orange-500 hover:bg-orange-600 gap-1" onClick={handleDownloadPdf}>
                              <Download className="w-3.5 h-3.5" /> Download PDF
                            </Button>
                          </CardContent>
                        </Card>
                        <Card className="border-[#2A2A2A] bg-[#0F0F0F]">
                          <CardContent className="p-4">
                            <p className="text-sm font-medium text-white">DOCX (Editable)</p>
                            <p className="text-xs text-[#A0A0A0] mt-0.5">Edit in Word or Google Docs</p>
                            <Button size="sm" variant="outline" className="mt-2 border-[#2A2A2A] text-[#A0A0A0] gap-1" onClick={handleDownloadDocx}>
                              <Download className="w-3.5 h-3.5" /> Download DOCX
                            </Button>
                          </CardContent>
                        </Card>
                        <Card className="border-[#2A2A2A] bg-[#0F0F0F]">
                          <CardContent className="p-4">
                            <p className="text-sm font-medium text-white">Google Docs</p>
                            <p className="text-xs text-[#A0A0A0] mt-0.5">Open and edit in Google Docs</p>
                            <Button size="sm" variant="outline" className="mt-2 border-[#2A2A2A] text-[#A0A0A0]">Generate link</Button>
                          </CardContent>
                        </Card>
                      </>
                    )}
                    {!format && (
                      <p className="text-xs text-[#666]">Select a product format in Step 6 to see export options.</p>
                    )}
                  </div>
                  {format && ["ebook", "workbook", "course", "checklist"].includes(format) && (
                    <div className="pt-2 border-t border-[#2A2A2A]">
                      <p className="text-xs font-medium text-[#A0A0A0] mb-2">Export settings</p>
                      <div className="space-y-2 text-xs text-[#E0E0E0]">
                        <div className="flex gap-3">
                          <span>Page size:</span>
                          <label className="flex items-center gap-1"><input type="radio" name="pageSize" checked={pageSize === "a4"} onChange={() => setPageSize("a4")} /> A4</label>
                          <label className="flex items-center gap-1"><input type="radio" name="pageSize" checked={pageSize === "letter"} onChange={() => setPageSize("letter")} /> Letter</label>
                        </div>
                        <div className="flex items-center gap-2">
                          <span>Margins:</span>
                          <select value={marginPreset} onChange={(e) => setMarginPreset(e.target.value as "narrow" | "normal" | "wide" | "custom")} className="rounded bg-[#1A1A1A] border border-[#2A2A2A] text-white px-2 py-1">
                            <option value="normal">Normal</option>
                            <option value="narrow">Narrow</option>
                            <option value="wide">Wide</option>
                            <option value="custom">Custom</option>
                          </select>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="flex items-center gap-2 cursor-pointer"><Checkbox checked={includePageNumbers} onCheckedChange={(c) => setIncludePageNumbers(!!c)} /> Page numbers</label>
                          <label className="flex items-center gap-2 cursor-pointer"><Checkbox checked={includeTOC} onCheckedChange={(c) => setIncludeTOC(!!c)} /> Table of contents</label>
                          <label className="flex items-center gap-2 cursor-pointer"><Checkbox checked={includeCover} onCheckedChange={(c) => setIncludeCover(!!c)} /> Cover page</label>
                        </div>
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </Card>
          </div>
        </div>

        {/* Edit Section Modal */}
        <Dialog open={!!editingSectionId} onOpenChange={(open) => !open && setEditingSectionId(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-[#1A1A1A] border-[#2A2A2A] text-white">
            <DialogHeader className="flex flex-row items-center justify-between gap-4">
              <DialogTitle className="text-lg">
                Edit Section: {productContent.find((s) => s.id === editingSectionId)?.title ?? ""}
              </DialogTitle>
              <Button variant="ghost" size="icon" className="shrink-0 text-[#A0A0A0]" onClick={() => setEditingSectionId(null)}>
                <X className="w-4 h-4" />
              </Button>
            </DialogHeader>
            <div className="space-y-3">
              <RichTextEditor
                value={editingBody}
                onChange={setEditingBody}
                placeholder="Section content..."
                minHeight="220px"
                className="min-h-[220px]"
              />
              <p className="text-xs text-[#A0A0A0]">Character count: {editingBody.replace(/<[^>]*>/g, "").length}/2000</p>
            </div>
            <DialogFooter className="flex flex-wrap gap-2 sm:justify-between">
              <Button variant="outline" className="border-[#2A2A2A] text-[#A0A0A0]" onClick={() => setEditingSectionId(null)}>Cancel</Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1 border-[#2A2A2A] text-[#A0A0A0]" onClick={handleRegenerateSection}>
                  <RefreshCw className="w-3.5 h-3.5" /> Regenerate This Section
                </Button>
                <Button className="bg-orange-500 hover:bg-orange-600" onClick={saveEditSection}>Save Changes</Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Regenerating loading modal */}
        <Dialog open={!!regeneratingSectionId} onOpenChange={() => {}}>
          <DialogContent className="max-w-sm bg-[#1A1A1A] border-[#2A2A2A] text-white" onPointerDownOutside={(e) => e.preventDefault()}>
            <div className="py-6 text-center space-y-4">
              <Loader2 className="w-12 h-12 text-orange-500 animate-spin mx-auto" />
              <p className="font-medium">Regenerating &ldquo;{productContent.find((s) => s.id === regeneratingSectionId)?.title ?? "section"}&rdquo;...</p>
              <p className="text-sm text-[#A0A0A0]">This takes 5–10 seconds</p>
            </div>
          </DialogContent>
        </Dialog>

        {/* Bottom bar */}
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#2A2A2A] bg-[#0F0F0F]/95 backdrop-blur py-4 px-4 md:px-6">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="flex gap-2">
              <Button variant="ghost" className="text-[#A0A0A0]" asChild>
                <Link href="/dashboard/digital-products/discover">← Start Over</Link>
              </Button>
              <Button variant="outline" className="border-[#2A2A2A] text-[#A0A0A0]">Save Changes</Button>
            </div>
            <Button className="bg-orange-500 hover:bg-orange-600" size="lg" onClick={handleGenerateVideos}>
              Create Video Guide →
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
