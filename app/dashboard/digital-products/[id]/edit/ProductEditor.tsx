"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Rnd } from "react-rnd";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SaveAsTemplateButton } from "@/components/save-as-template-button";
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
  Upload,
  Bold,
  Italic,
  Underline,
  Crown,
} from "lucide-react";
import { Icon } from "@iconify/react";
import { HexColorPicker } from "react-colorful";
import { RichTextEditor } from "@/components/RichTextEditor";
import { ThumbnailMockup, THUMBNAIL_TEMPLATES, type ThumbnailTemplateId } from "@/components/product-editor/ThumbnailMockup";
import { cleanMarkdownToHtml } from "@/lib/clean-markdown";
import { sanitizeHtml } from "@/lib/sanitize-html";
import html2canvas from "html2canvas";
import { captureCanvasPagesToPdf } from "@/lib/pdf-client-export";
import { getProxiedBackgroundImageUrl, getBackgroundUrlToSave } from "@/lib/proxy-image-url";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDashboardTheme } from "@/components/dashboard-theme-provider";
import { EditorToolbar } from "./EditorToolbar";
import { CoverPageEditor } from "./CoverPageEditor";
import { BackCoverEditor } from "./BackCoverEditor";
import { ContentPageEditor } from "./ContentPageEditor";
import { EditorRightPanel } from "./EditorRightPanel";
import { BookMockupPanel } from "@/components/product-editor/BookMockupPanel";
import { AvatarVideoPanel } from "@/components/product-editor/AvatarVideoPanel";
import { NextStepPrompt } from "@/components/product-editor/NextStepPrompt";
import { ReadyToSellChecklist } from "@/components/product-editor/ReadyToSellChecklist";
import { BrandVoiceIndicator } from "@/components/product-editor/BrandVoiceIndicator";
import { SellItNowPanel } from "@/components/product-editor/SellItNowPanel";
import { PricingCard } from "@/components/product-editor/PricingCard";
import { SocialCaptionsCard } from "@/components/product-editor/SocialCaptionsCard";
import { EmailSequenceCard } from "@/components/product-editor/EmailSequenceCard";
import { SalesPageCard } from "@/components/product-editor/SalesPageCard";
import { ThumbnailVariantPicker } from "@/components/product-editor/ThumbnailVariantPicker";
import { RevenueTracker } from "@/components/product-editor/RevenueTracker";

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

/** Normalize any CSS color to 6-char lowercase hex so picker and canvas stay in sync. */
function normalizeTextColorToHex(cssColor: string): string {
  const s = (cssColor ?? "").trim();
  const hex = (x: number) => ("0" + Math.min(255, Math.max(0, x)).toString(16)).slice(-2);
  if (s.startsWith("#")) {
    const hexOnly = s.slice(1).replace(/[^0-9A-Fa-f]/g, "");
    if (hexOnly.length === 6) return "#" + hexOnly.toLowerCase();
    if (hexOnly.length === 3) {
      const r = parseInt(hexOnly[0]! + hexOnly[0], 16);
      const g = parseInt(hexOnly[1]! + hexOnly[1], 16);
      const b = parseInt(hexOnly[2]! + hexOnly[2], 16);
      return "#" + hex(r) + hex(g) + hex(b);
    }
    return "#333333";
  }
  const rgbMatch = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch)
    return "#" + hex(parseInt(rgbMatch[1], 10)) + hex(parseInt(rgbMatch[2], 10)) + hex(parseInt(rgbMatch[3], 10));
  return "#333333";
}

function rgbToHex(rgb: string): string {
  return normalizeTextColorToHex(rgb);
}

function overlayColorToHex(color: string): string {
  if (color.startsWith("#")) return color;
  const rgba = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgba) {
    const hex = (x: number) => ("0" + Math.min(255, Math.max(0, x)).toString(16)).slice(-2);
    return "#" + hex(parseInt(rgba[1], 10)) + hex(parseInt(rgba[2], 10)) + hex(parseInt(rgba[3], 10));
  }
  return rgbToHex(color);
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
  /** Solid background colour for the full page (e.g. content pages). Hex. */
  backgroundColor?: string | null;
  /** Text colour for all content on this page (product title, section title, body). Hex. */
  pageTextColor?: string | null;
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
    backCoverSocialLinks?: { tiktok?: string; instagram?: string; youtube?: string; facebook?: string };
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
  fontWeight?: string;
  fontStyle?: string;
  textDecoration?: string;
  // Text shadow
  textShadowEnabled?: boolean;
  textShadowOffsetX?: number;
  textShadowOffsetY?: number;
  textShadowBlur?: number;
  textShadowColor?: string;
  // Text stroke / outline
  textStrokeEnabled?: boolean;
  textStrokeWidth?: number;
  textStrokeColor?: string;
};

const DEFAULT_TEXT_BOX: TextBoxSettings = {
  fontSize: 16,
  fontFamily: "Inter, system-ui, sans-serif",
  color: "#333333",
  textAlign: "left",
  fontWeight: "400",
  fontStyle: "normal",
  textDecoration: "none",
  textShadowEnabled: false,
  textShadowOffsetX: 0,
  textShadowOffsetY: 2,
  textShadowBlur: 4,
  textShadowColor: "#000000",
  textStrokeEnabled: false,
  textStrokeWidth: 1,
  textStrokeColor: "#000000",
};

export type PlacedElement = {
  id: string;
  type: "icon" | "image" | "text" | "social";
  content: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  rotation: number;
  zIndex: number;
  imageSettings?: ImageSettings;
  textSettings?: TextBoxSettings;
  linkUrl?: string;
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

/** Get character offset from the start of blockEl to the given (node, offset). */
function getCharacterOffsetWithinBlock(blockEl: HTMLElement, targetNode: Node, targetOffset: number): number {
  const walker = document.createTreeWalker(blockEl, NodeFilter.SHOW_TEXT, null);
  let count = 0;
  let node: Node | null = walker.nextNode();
  while (node) {
    const len = node.textContent?.length ?? 0;
    if (node === targetNode) return count + Math.min(targetOffset, len);
    count += len;
    node = walker.nextNode();
  }
  return count;
}

/** Set the cursor/collapse selection to the given character offset within blockEl. */
function setCursorToCharacterOffset(blockEl: HTMLElement, charOffset: number): void {
  const sel = window.getSelection();
  if (!sel) return;
  const walker = document.createTreeWalker(blockEl, NodeFilter.SHOW_TEXT, null);
  let count = 0;
  let node: Node | null = walker.nextNode();
  while (node) {
    const len = node.textContent?.length ?? 0;
    if (count + len >= charOffset) {
      const offsetInNode = Math.min(charOffset - count, len);
      const range = document.createRange();
      range.setStart(node, offsetInNode);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }
    count += len;
    node = walker.nextNode();
  }
  const range = document.createRange();
  range.selectNodeContents(blockEl);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
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

// Memoized map for O(1) icon lookup on canvas (avoids .find() on every element render)
const ICON_NAME_TO_LUCIDE: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = Object.fromEntries(
  GRAPHICS_ICONS.map((i) => [i.name, i.icon])
);

const SOCIAL_PLATFORMS = ["tiktok", "instagram", "youtube", "facebook"] as const;
const SOCIAL_SIZE = 40;
const SOCIAL_GAP = 12;

/** Sync back cover page elements with backCoverSocialLinks: add/update social elements for each URL, remove for empty. */
function ensureBackPageSocialElements(
  backPage: PlacedElement[],
  links: Record<string, string>
): PlacedElement[] {
  const nonSocial = backPage.filter((el) => el.type !== "social");
  const startXForPlatform = (idx: number) =>
    CANVAS_WIDTH / 2 - (SOCIAL_PLATFORMS.length * (SOCIAL_SIZE + SOCIAL_GAP)) / 2 + idx * (SOCIAL_SIZE + SOCIAL_GAP);
  const socialElements: PlacedElement[] = [];
  SOCIAL_PLATFORMS.forEach((platform, idx) => {
    const url = links[platform]?.trim();
    if (!url) return;
    const existing = backPage.find((el) => el.type === "social" && el.content === platform);
    if (existing) {
      socialElements.push({ ...existing, linkUrl: url });
    } else {
      socialElements.push({
        id: `social-${platform}-${Date.now()}`,
        type: "social",
        content: platform,
        position: { x: startXForPlatform(idx), y: CANVAS_HEIGHT - 120 },
        size: { width: SOCIAL_SIZE, height: SOCIAL_SIZE },
        rotation: 0,
        zIndex: 10,
        linkUrl: url,
      });
    }
  });
  return [...nonSocial, ...socialElements];
}

function SocialIconSvg({ platform, className, style }: { platform: string; className?: string; style?: React.CSSProperties }) {
  const props = { className: className ?? "w-full h-full", style: style ?? {}, viewBox: "0 0 24 24" as const, fill: "currentColor" };
  const p = (platform ?? "").toLowerCase().trim();
  switch (p) {
    case "tiktok":
      return (
        <svg {...props} xmlns="http://www.w3.org/2000/svg">
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
        </svg>
      );
    case "instagram":
      return (
        <svg {...props} xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
        </svg>
      );
    case "youtube":
      return (
        <svg {...props} xmlns="http://www.w3.org/2000/svg">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      );
    case "facebook":
      return (
        <svg {...props} xmlns="http://www.w3.org/2000/svg">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      );
    default:
      return (
        <svg {...props} xmlns="http://www.w3.org/2000/svg">
          <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" />
        </svg>
      );
  }
}

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
      const raw = item as PlacedElement & { imageSettings?: unknown; textSettings?: unknown; linkUrl?: string };
      const imgSettings = raw.imageSettings && typeof raw.imageSettings === "object" ? raw.imageSettings as ImageSettings : undefined;
      const txtSettings = raw.textSettings && typeof raw.textSettings === "object" ? raw.textSettings as Partial<TextBoxSettings> : undefined;
      const type = raw.type === "text" ? "text" : raw.type === "image" ? "image" : raw.type === "social" ? "social" : "icon";
      const content = type === "social" && typeof raw.content === "string" ? raw.content.toLowerCase().trim() : (raw.content ?? "");
      const base = {
        id: raw.id,
        type,
        content,
        position: { x: Number(raw.position?.x) || 0, y: Number(raw.position?.y) || 0 },
        size: {
          width: Number(raw.size?.width) || (type === "text" ? 200 : type === "social" ? 40 : 80),
          height: Number(raw.size?.height) || (type === "text" ? 48 : type === "social" ? 40 : 80),
        },
        rotation: Number(raw.rotation) || 0,
        zIndex: Number(raw.zIndex) ?? 0,
      };
      if (type === "text") {
        return { ...base, textSettings: { ...DEFAULT_TEXT_BOX, ...txtSettings } };
      }
      if (type === "social") {
        const linkUrl = typeof raw.linkUrl === "string" ? raw.linkUrl.trim() : undefined;
        return { ...base, ...(linkUrl ? { linkUrl } : {}) };
      }
      if (imgSettings) {
        return { ...base, imageSettings: { ...DEFAULT_IMAGE_SETTINGS, ...imgSettings } };
      }
      return base;
    });
}

/**
 * Migration: ensure cover (page 0) and back (last page) text elements have full formatting
 * properties so bold, italic, underline, and colour controls work for existing products.
 */
function migrateCoverBackTextFormatting(placedElementsByPage: PlacedElement[][]): PlacedElement[][] {
  if (!Array.isArray(placedElementsByPage) || placedElementsByPage.length < 2) return placedElementsByPage;
  const lastIdx = placedElementsByPage.length - 1;
  return placedElementsByPage.map((pageArr, pageIndex) => {
    if (pageIndex !== 0 && pageIndex !== lastIdx) return pageArr;
    return pageArr.map((el) => {
      if (el.type !== "text") return el;
      const merged = { ...DEFAULT_TEXT_BOX, ...el.textSettings };
      return { ...el, textSettings: merged };
    });
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

type CanvasPlacedElementProps = {
  element: PlacedElement;
  isSelected: boolean;
  isEditing: boolean;
  graphicsAccentColor: string;
  editingTextAreaRef: React.RefObject<HTMLTextAreaElement | null>;
  onSelectElement: (id: string) => void;
  onElementDragStop: (id: string, position: { x: number; y: number }) => void;
  onElementResizeStop: (id: string, size: { width: number; height: number }, position: { x: number; y: number }) => void;
  onTextContentChange: (id: string, value: string) => void;
  onTextBlur: (id: string, value: string) => void;
  onTextEscape: (id: string) => void;
  onStartEditTextBox: (id: string, content: string) => void;
  updateTextBoxSetting: (key: keyof TextBoxSettings, value: string | number | boolean) => void;
  deleteElement: (id: string) => void;
  duplicateElement: (id: string) => void;
  bringToFront: () => void;
  sendToBack: () => void;
};

const CanvasPlacedElement = React.memo(function CanvasPlacedElement({
  element,
  isSelected,
  isEditing,
  graphicsAccentColor,
  editingTextAreaRef,
  onSelectElement,
  onElementDragStop,
  onElementResizeStop,
  onTextContentChange,
  onTextBlur,
  onTextEscape,
  onStartEditTextBox,
  updateTextBoxSetting,
  deleteElement,
  duplicateElement,
  bringToFront,
  sendToBack,
}: CanvasPlacedElementProps) {
  const isIconify = element.type === "icon" && element.content.includes(":");
  const LucideIcon = !isIconify && element.type === "icon" ? ICON_NAME_TO_LUCIDE[element.content] : null;
  const handleRndClick = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelectElement(element.id);
    },
    [element.id, onSelectElement]
  );
  const handleRndDoubleClick = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (element.type === "text") {
        e.preventDefault();
        onStartEditTextBox(element.id, element.content || "");
        return;
      }
      if (element.type === "social" && element.linkUrl) {
        window.open(element.linkUrl, "_blank", "noopener,noreferrer");
      }
    },
    [element.type, element.id, element.content, element.linkUrl, onStartEditTextBox]
  );
  const handleDragStop = React.useCallback(
    (_e: unknown, d: { x: number; y: number }) => onElementDragStop(element.id, { x: d.x, y: d.y }),
    [element.id, onElementDragStop]
  );
  const handleResizeStop = React.useCallback(
    (_e: unknown, _dir: unknown, ref: HTMLElement, _delta: unknown, position: { x: number; y: number }) =>
      onElementResizeStop(element.id, { width: ref.offsetWidth, height: ref.offsetHeight }, position),
    [element.id, onElementResizeStop]
  );
  const handleTextChange = React.useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => onTextContentChange(element.id, e.target.value),
    [element.id, onTextContentChange]
  );
  const handleTextBlur = React.useCallback(
    (e: React.FocusEvent<HTMLTextAreaElement>) => onTextBlur(element.id, e.target.value),
    [element.id, onTextBlur]
  );
  const handleTextKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onTextEscape(element.id);
      }
    },
    [element.id, onTextEscape]
  );
  const handleDoubleClickText = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      onStartEditTextBox(element.id, element.content || "");
    },
    [element.id, element.content, onStartEditTextBox]
  );
  const ts = element.textSettings;
  const isWebsiteLink = element.id === "back-url" && element.type === "text";
  const textColor = isWebsiteLink ? "#2563eb" : (ts?.color ?? DEFAULT_TEXT_BOX.color);
  const textStyle = element.type === "text" ? {
    fontSize: ts?.fontSize ?? DEFAULT_TEXT_BOX.fontSize,
    fontFamily: ts?.fontFamily ?? DEFAULT_TEXT_BOX.fontFamily,
    color: textColor,
    textAlign: (ts?.textAlign ?? DEFAULT_TEXT_BOX.textAlign) as React.CSSProperties["textAlign"],
    fontWeight: ts?.fontWeight ?? DEFAULT_TEXT_BOX.fontWeight,
    fontStyle: (ts?.fontStyle ?? DEFAULT_TEXT_BOX.fontStyle) as React.CSSProperties["fontStyle"],
    textDecoration: (isWebsiteLink ? "underline" : (ts?.textDecoration ?? DEFAULT_TEXT_BOX.textDecoration)) as React.CSSProperties["textDecoration"],
    wordBreak: "break-word" as const,
    textShadow: (ts?.textShadowEnabled ?? DEFAULT_TEXT_BOX.textShadowEnabled) ? `${ts?.textShadowOffsetX ?? DEFAULT_TEXT_BOX.textShadowOffsetX}px ${ts?.textShadowOffsetY ?? DEFAULT_TEXT_BOX.textShadowOffsetY}px ${ts?.textShadowBlur ?? DEFAULT_TEXT_BOX.textShadowBlur}px ${ts?.textShadowColor ?? DEFAULT_TEXT_BOX.textShadowColor}` : "none",
    WebKitTextStroke: (ts?.textStrokeEnabled ?? DEFAULT_TEXT_BOX.textStrokeEnabled) ? `${ts?.textStrokeWidth ?? DEFAULT_TEXT_BOX.textStrokeWidth}px ${ts?.textStrokeColor ?? DEFAULT_TEXT_BOX.textStrokeColor}` : "none",
  } : undefined;
  const textStyleNoBackground = textStyle ? (() => { const { backgroundColor: _b, ...rest } = textStyle as React.CSSProperties & { backgroundColor?: string }; return rest; })() : undefined;

  return (
    <Rnd
      data-placed-element
      position={{ x: element.position.x, y: element.position.y }}
      size={{ width: element.size.width, height: element.size.height }}
      onDragStop={handleDragStop}
      onResizeStop={handleResizeStop}
      bounds="parent"
      disableDragging={element.type === "text" && isEditing}
      enableResizing={true}
      className={`pointer-events-auto ${element.type === "text" ? "!bg-transparent" : ""} ${element.type === "text" && isEditing ? "cursor-text" : "cursor-move"} ${isSelected ? "outline outline-2 outline-orange-500 outline-offset-0" : ""}`}
      onClick={handleRndClick}
      onDoubleClick={handleRndDoubleClick}
      style={{
        zIndex: Math.max(1, element.zIndex),
        ...(element.type === "text" ? { backgroundColor: "transparent" } : {}),
      }}
    >
      <div className="w-full h-full flex items-center justify-center bg-transparent" style={element.type === "text" ? { backgroundColor: "transparent" } : undefined} data-placed-element>
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
        ) : element.type === "social" ? (
          element.linkUrl ? (
            <a
              href={element.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              draggable={false}
              className="w-full h-full flex items-center justify-center hover:opacity-80 transition-opacity pointer-events-none"
              style={{ color: graphicsAccentColor }}
              aria-label={`Open ${element.content}`}
            >
              <SocialIconSvg platform={element.content} style={{ color: graphicsAccentColor }} />
            </a>
          ) : (
            <span className="w-full h-full flex items-center justify-center pointer-events-none" style={{ color: graphicsAccentColor }}>
              <SocialIconSvg platform={element.content} style={{ color: graphicsAccentColor }} />
            </span>
          )
        ) : element.type === "text" ? (
          isEditing ? (
            <textarea
              ref={editingTextAreaRef}
              className="w-full h-full overflow-auto p-1 resize-none bg-transparent border border-orange-400 rounded outline-none"
              style={{ ...textStyleNoBackground, backgroundColor: "transparent" }}
              value={element.content}
              onChange={handleTextChange}
              onBlur={handleTextBlur}
              onKeyDown={handleTextKeyDown}
              onClick={(e) => e.stopPropagation()}
              placeholder="Enter text..."
            />
          ) : (
            <div
              key={`text-display-${element.id}-${textColor}`}
              className={`w-full h-full overflow-auto p-1 flex items-center select-text ${isWebsiteLink ? "cursor-pointer hover:opacity-90" : "cursor-text"}`}
              style={{ ...textStyleNoBackground, color: textColor, backgroundColor: "transparent" }}
              onDoubleClick={handleDoubleClickText}
              onClick={isWebsiteLink ? (e) => {
                e.stopPropagation();
                const url = (element.content || "").trim();
                if (/^https?:\/\//i.test(url)) window.open(url, "_blank", "noopener,noreferrer");
              } : undefined}
            >
              {element.content || "Double-click to edit"}
            </div>
          )
        ) : (
          <span className="text-[#999] text-xs">?</span>
        )}
      </div>
      {isSelected && (
        element.type === "text" ? (
          <div
            className="absolute left-1/2 -translate-x-1/2 -top-11 flex items-center gap-0.5 bg-white text-gray-800 rounded-xl px-2 py-1.5 shadow-[0_2px_12px_rgba(0,0,0,0.12)] border border-gray-200/80"
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" onClick={(e) => { e.stopPropagation(); updateTextBoxSetting("fontWeight", (ts?.fontWeight ?? DEFAULT_TEXT_BOX.fontWeight) === "700" ? "400" : "700"); }} className={`rounded-lg p-1.5 transition-colors ${(ts?.fontWeight ?? DEFAULT_TEXT_BOX.fontWeight) === "700" ? "bg-gray-200 text-gray-900" : "hover:bg-gray-100"}`} title="Bold"><Bold className="w-4 h-4" /></button>
            <button type="button" onClick={(e) => { e.stopPropagation(); updateTextBoxSetting("fontStyle", (ts?.fontStyle ?? DEFAULT_TEXT_BOX.fontStyle) === "italic" ? "normal" : "italic"); }} className={`rounded-lg p-1.5 transition-colors ${(ts?.fontStyle ?? DEFAULT_TEXT_BOX.fontStyle) === "italic" ? "bg-gray-200 text-gray-900" : "hover:bg-gray-100"}`} title="Italic"><Italic className="w-4 h-4" /></button>
            <button type="button" onClick={(e) => { e.stopPropagation(); updateTextBoxSetting("textDecoration", (ts?.textDecoration ?? DEFAULT_TEXT_BOX.textDecoration) === "underline" ? "none" : "underline"); }} className={`rounded-lg p-1.5 transition-colors ${(ts?.textDecoration ?? DEFAULT_TEXT_BOX.textDecoration) === "underline" ? "bg-gray-200 text-gray-900" : "hover:bg-gray-100"}`} title="Underline"><Underline className="w-4 h-4" /></button>
            <div className="w-px h-5 bg-gray-200 mx-0.5" />
            <input type="number" min={8} max={200} value={ts?.fontSize ?? DEFAULT_TEXT_BOX.fontSize} onChange={(e) => { const v = parseInt(e.target.value, 10); if (!Number.isNaN(v)) updateTextBoxSetting("fontSize", Math.min(200, Math.max(8, v))); }} onClick={(e) => e.stopPropagation()} className="w-11 text-center text-sm border-0 bg-transparent focus:outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
            <div className="w-px h-5 bg-gray-200 mx-0.5" />
            <input type="color" value={ts?.color ?? DEFAULT_TEXT_BOX.color} onChange={(e) => updateTextBoxSetting("color", e.target.value)} onClick={(e) => e.stopPropagation()} className="w-6 h-6 rounded cursor-pointer border border-gray-200 p-0 bg-transparent" title="Text colour" />
            <div className="w-px h-5 bg-gray-200 mx-0.5" />
            <button type="button" onClick={(e) => { e.stopPropagation(); deleteElement(element.id); }} className="hover:bg-gray-100 rounded-lg p-1.5" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
            <button type="button" onClick={(e) => { e.stopPropagation(); duplicateElement(element.id); }} className="hover:bg-gray-100 rounded-lg p-1.5" title="Duplicate"><Copy className="w-3.5 h-3.5" /></button>
          </div>
        ) : (
          <div className="absolute -top-9 left-0 flex gap-1 bg-white text-gray-700 rounded-lg px-2 py-1.5 text-xs border border-gray-200 shadow-lg">
            <button type="button" onClick={(e) => { e.stopPropagation(); deleteElement(element.id); }} className="hover:bg-gray-100 rounded p-1" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
            <button type="button" onClick={(e) => { e.stopPropagation(); duplicateElement(element.id); }} className="hover:bg-gray-100 rounded p-1" title="Duplicate"><Copy className="w-3.5 h-3.5" /></button>
            <button type="button" onClick={(e) => { e.stopPropagation(); bringToFront(); }} className="hover:bg-gray-100 rounded p-1" title="Bring to front"><ArrowUp className="w-3.5 h-3.5" /></button>
            <button type="button" onClick={(e) => { e.stopPropagation(); sendToBack(); }} className="hover:bg-gray-100 rounded p-1" title="Send to back"><ArrowDown className="w-3.5 h-3.5" /></button>
          </div>
        )
      )}
    </Rnd>
  );
});

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
  const [regeneratingSectionId, setRegeneratingSectionId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [applyAllPagesTextColor, setApplyAllPagesTextColor] = useState("#1a1a1a");
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showGenerateAIDialog, setShowGenerateAIDialog] = useState(false);
  const [generateAICustomType, setGenerateAICustomType] = useState("");
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [showFullPreview, setShowFullPreview] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [marketingGenerating, setMarketingGenerating] = useState(false);
  const [marketingRegenerating, setMarketingRegenerating] = useState(false);
  const [activeEditorTab, setActiveEditorTab] = useState("content");
  const [pricingRecommendationLoading, setPricingRecommendationLoading] = useState(false);
  const [platformCopyPlatform, setPlatformCopyPlatform] = useState<string>("beacons");
  const [platformCopyLoading, setPlatformCopyLoading] = useState(false);
  const [platformCopyResult, setPlatformCopyResult] = useState<string | null>(null);
  const [pricingRecommendation, setPricingRecommendation] = useState<{
    priceRange: string;
    strategy: string;
    reasoning: string;
  } | null>(null);
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
  const photoSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const photoSearchCacheRef = useRef<
    Map<string, { photos: { id: string; url?: string; fullUrl?: string; thumb?: string }[]; totalPages: number }>
  >(new Map());
  const [addImageModalOpen, setAddImageModalOpen] = useState(false);
  const [addImageTab, setAddImageTab] = useState<"stock" | "ai" | "upload">("stock");
  const [autoDesignLoading, setAutoDesignLoading] = useState(false);
  const [regenerateDesignLoading, setRegenerateDesignLoading] = useState(false);
  const [showBrandSetupDialog, setShowBrandSetupDialog] = useState(false);
  const [showAutoDesignChoiceDialog, setShowAutoDesignChoiceDialog] = useState(false);
  const [brandProfile, setBrandProfile] = useState<{
    tiktokUrl?: string;
    instagramUrl?: string;
    youtubeUrl?: string;
    facebookUrl?: string;
    websiteUrl?: string;
    primaryColor: string;
    secondaryColor: string;
    logoUrl?: string;
    preferAiColors: boolean;
  } | null>(null);
  const [brandSetupForm, setBrandSetupForm] = useState({
    tiktokUrl: "",
    instagramUrl: "",
    youtubeUrl: "",
    facebookUrl: "",
    websiteUrl: "",
    primaryColor: "#1a1a1a",
    secondaryColor: "#475569",
    logoBase64: "",
  });
  const [autoDesignChoice, setAutoDesignChoice] = useState<"brand" | "ai">("brand");
  const [coverBackgroundPreference, setCoverBackgroundPreference] = useState<"match_product" | "random">("match_product");
  const [autoDesignSuccessView, setAutoDesignSuccessView] = useState(false);
  const preventAutoDesignCloseRef = useRef(false);
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
  const lastSelectedTextMetaRef = useRef<SelectedTextMeta | null>(null);
  const pendingContentCursorRef = useRef<{ sectionId: string; type: string; blockIndex?: number; offset: number } | null>(null);
  const contentAreaRef = useRef<HTMLDivElement | null>(null);
  const previewContentRef = useRef<HTMLDivElement | null>(null);
  const lastPreviewHtmlRef = useRef<{ sectionId: string; html: string } | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const [coverThumbnailCaptureTrigger, setCoverThumbnailCaptureTrigger] = useState(0);
  const savedPageIndexRef = useRef<number | null>(null);
  const coverImageInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedTextMeta, setSelectedTextMeta] = useState<SelectedTextMeta | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [undoStack, setUndoStack] = useState<EditorSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<EditorSnapshot[]>([]);
  const [coverBackHintDismissed, setCoverBackHintDismissed] = useState(false);
  const [backCoverWebsiteUrl, setBackCoverWebsiteUrl] = useState<string | null>(null);
  const recordingRef = useRef(false);
  const recordUndoDebouncedRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentPageElements = useMemo(
    () => placedElementsByPage[currentPageIndex] ?? [],
    [placedElementsByPage, currentPageIndex]
  );
  const sortedPageElements = useMemo(
    () => [...currentPageElements].sort((a, b) => a.zIndex - b.zIndex),
    [currentPageElements]
  );

  useEffect(() => {
    if (!productId) return;
    let cancelled = false;
    fetch("/api/brand-profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { websiteUrl?: string } | null) => {
        if (cancelled || !data) return;
        const url = data.websiteUrl?.trim() ?? null;
        setBackCoverWebsiteUrl(url);
        setPlacedElementsByPage((prev) => {
          const lastIdx = prev.length - 1;
          if (lastIdx < 0) return prev;
          return prev.map((pageArr, i) =>
            i !== lastIdx
              ? pageArr
              : pageArr.map((el) =>
                  el.id === "back-url" && el.type === "text"
                    ? { ...el, content: url || "Add your website in brand profile" }
                    : el
                )
          );
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [productId]);

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
      const totalPagesForPlaced = sectionsCountForPlaced + 2; // cover + content + back
      let elementsToSet: PlacedElement[][];
      if (Array.isArray(byPage) && byPage.length > 0) {
        const parsed = byPage.map((pageArr) => (Array.isArray(pageArr) ? parsePlacedElements(pageArr) : []));
        // Ensure we have exactly totalPagesForPlaced: [cover, ...content, back]
        if (parsed.length >= totalPagesForPlaced) {
          elementsToSet = parsed.slice(0, totalPagesForPlaced);
        } else if (parsed.length === sectionsCountForPlaced) {
          elementsToSet = [[], ...parsed, []];
        } else if (parsed.length > 0) {
          elementsToSet = Array.from({ length: totalPagesForPlaced }, (_, i) => parsed[i] ?? []);
        } else {
          elementsToSet = Array.from({ length: totalPagesForPlaced }, () => []);
        }
      } else {
        const legacy = parsePlacedElements(data.placedElements ?? []);
        const contentOnly = legacy.length ? [legacy] : [[]];
        elementsToSet = [[], ...contentOnly, []];
      }
      const migrated = migrateCoverBackTextFormatting(elementsToSet);
      const backCoverSocialLinksFromProduct = (data.designSettings as { backCoverSocialLinks?: Record<string, string> })?.backCoverSocialLinks ?? {};
      const lastPageIdx = migrated.length - 1;
      if (lastPageIdx >= 0) {
        migrated[lastPageIdx] = ensureBackPageSocialElements(migrated[lastPageIdx] ?? [], backCoverSocialLinksFromProduct);
      }
      setPlacedElementsByPage(migrated);

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
      const totalPagesExpected = sectionsCount + 2; // cover + content pages + back
      const legacyBgUrl = ds?.backgroundImage ?? ds?.background_image ?? null;
      let pages: PageBackground[];
      if (Array.isArray(ds?.pages) && ds.pages.length >= totalPagesExpected) {
        // Saved format: [cover, ...content, back] — use as-is (index 0 = cover, last = back)
        pages = ds.pages.slice(0, totalPagesExpected).map((p) => ({
          backgroundImage: p?.backgroundImage ?? null,
          backgroundSettings: p?.backgroundSettings ? { ...DEFAULT_IMAGE_SETTINGS, ...p.backgroundSettings } : undefined,
          overlaySettings: p?.overlaySettings ? { ...DEFAULT_OVERLAY, ...p.overlaySettings } : undefined,
          backgroundColor: p?.backgroundColor ?? undefined,
          pageTextColor: p?.pageTextColor ?? undefined,
        }));
      } else if (Array.isArray(ds?.pages) && ds.pages.length >= sectionsCount) {
        // Legacy: only content pages saved — wrap with empty cover and back
        const contentPages = ds.pages.slice(0, sectionsCount).map((p) => ({
          backgroundImage: p?.backgroundImage ?? null,
          backgroundSettings: p?.backgroundSettings ? { ...DEFAULT_IMAGE_SETTINGS, ...p.backgroundSettings } : undefined,
          overlaySettings: p?.overlaySettings ? { ...DEFAULT_OVERLAY, ...p.overlaySettings } : undefined,
          backgroundColor: p?.backgroundColor ?? undefined,
          pageTextColor: p?.pageTextColor ?? undefined,
        }));
        pages = [{}, ...contentPages, {}];
      } else {
        const contentPages = Array.from({ length: sectionsCount }, (_, i) =>
          i === 0 && legacyBgUrl
            ? {
                backgroundImage: legacyBgUrl,
                backgroundSettings: ds?.backgroundSettings ? { ...DEFAULT_IMAGE_SETTINGS, ...ds.backgroundSettings } : undefined,
                overlaySettings: ds?.overlaySettings ? { ...DEFAULT_OVERLAY, ...ds.overlaySettings } : undefined,
              }
            : {}
        );
        pages = [{}, ...contentPages, {}];
      }
      setPageBackgrounds(pages);

      // Debug: cover and back page data loaded
      const coverPage = pages[0];
      const backPage = pages[pages.length - 1];
      console.log("[ProductEditor] Load — cover page (index 0):", {
        backgroundImage: coverPage?.backgroundImage ?? null,
        overlaySettings: coverPage?.overlaySettings ?? null,
      });
      console.log("[ProductEditor] Load — back cover page (index " + (pages.length - 1) + "):", {
        backgroundImage: backPage?.backgroundImage ?? null,
        overlaySettings: backPage?.overlaySettings ?? null,
      });
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

  const saveToServer = useCallback(
    async (payload: {
      content?: { sections: Section[] };
      designSettings?: Record<string, unknown>;
      placedElements?: PlacedElement[];
      placedElementsByPage?: PlacedElement[][];
      marketingAssets?: Record<string, unknown>;
    }) => {
      if (!productId) return;
      if (payload.designSettings) {
        const ds = payload.designSettings as { pages?: PageBackground[]; placedElementsByPage?: PlacedElement[][] };
        const pages = ds.pages ?? [];
        const byPage = ds.placedElementsByPage ?? [];
        const coverPage = pages[0];
        const backPage = pages.length > 0 ? pages[pages.length - 1] : undefined;
        const coverEls = byPage[0] ?? [];
        const backEls = byPage.length > 0 ? (byPage[byPage.length - 1] ?? []) : [];
        console.log("[ProductEditor] Save — cover page (index 0):", {
          backgroundImage: coverPage?.backgroundImage ?? null,
          overlaySettings: coverPage?.overlaySettings ?? null,
          placedElementsCount: coverEls.length,
        });
        console.log("[ProductEditor] Save — back cover page (index " + (pages.length - 1) + "):", {
          backgroundImage: backPage?.backgroundImage ?? null,
          overlaySettings: backPage?.overlaySettings ?? null,
          placedElementsCount: backEls.length,
        });
      }
      setSaving(true);
      try {
        const res = await fetch(`/api/products/${productId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          setLastSaved(new Date());
          setCoverThumbnailCaptureTrigger((v) => v + 1);
          // Do not switch to cover page here — stay on current page so the user is not
          // sent back to page 1 when clicking on the back cover (which can trigger save).
          // Cover thumbnail is captured only when the user is already on page 0 (see effect below).
        }
      } catch {
        // ignore
      } finally {
        setSaving(false);
      }
    },
    [productId]
  );

  const brandSocialsAppliedForProductRef = useRef<string | null>(null);
  useEffect(() => {
    const pid = product?.id;
    if (!pid || !product?.designSettings) return;
    if (brandSocialsAppliedForProductRef.current === pid) return;
    const current = product.designSettings.backCoverSocialLinks ?? {};
    const hasAny = !!(current.tiktok || current.instagram || current.youtube || current.facebook);
    if (hasAny) return;
    fetch("/api/brand-profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((profile: { tiktokUrl?: string; instagramUrl?: string; youtubeUrl?: string; facebookUrl?: string } | null) => {
        if (!profile) return;
        const tiktok = profile.tiktokUrl?.trim();
        const instagram = profile.instagramUrl?.trim();
        const youtube = profile.youtubeUrl?.trim();
        const facebook = profile.facebookUrl?.trim();
        if (!tiktok && !instagram && !youtube && !facebook) return;
        brandSocialsAppliedForProductRef.current = pid;
        setProduct((p) =>
          p
            ? {
                ...p,
                designSettings: {
                  ...p.designSettings,
                  backCoverSocialLinks: {
                    ...(tiktok ? { tiktok } : {}),
                    ...(instagram ? { instagram } : {}),
                    ...(youtube ? { youtube } : {}),
                    ...(facebook ? { facebook } : {}),
                  },
                },
              }
            : null
        );
        saveToServer({
          designSettings: {
            ...product.designSettings,
            backCoverSocialLinks: {
              ...(tiktok ? { tiktok } : {}),
              ...(instagram ? { instagram } : {}),
              ...(youtube ? { youtube } : {}),
              ...(facebook ? { facebook } : {}),
            },
          },
        });
      })
      .catch(() => {});
  }, [product?.id, product?.designSettings, saveToServer]);

  useEffect(() => {
    if (searchParams.get("created") === "1") setShowCreatedBanner(true);
  }, [searchParams]);

  const totalPages = Math.max(2, sections.length + 2);

  const displayPageElements = useMemo(() => {
    return sortedPageElements;
  }, [sortedPageElements]);

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
    const textStyles = product?.designSettings?.textStyles;
    const timer = setTimeout(() => {
      requestAnimationFrame(() => {
        const root = contentAreaRef.current;
        if (!root) return;
        // Apply product title (h2) styles so canvas updates when textStyles change
      const productTitleEl = root.querySelector('h2[data-section-id="__product_title"]') as HTMLElement | null;
      if (productTitleEl && textStyles?.__product_title?.title) {
        const t = textStyles.__product_title.title;
        if (t.color) productTitleEl.style.color = t.color;
        if (t.fontSize) productTitleEl.style.fontSize = t.fontSize;
        if (t.fontFamily) productTitleEl.style.fontFamily = t.fontFamily;
        if (t.fontWeight) productTitleEl.style.fontWeight = t.fontWeight;
        if (t.textAlign) productTitleEl.style.textAlign = t.textAlign;
        if (t.lineHeight) productTitleEl.style.lineHeight = t.lineHeight;
        if (t.textDecoration) productTitleEl.style.textDecoration = t.textDecoration;
        if (t.textTransform) productTitleEl.style.textTransform = t.textTransform;
        if (t.backgroundColor) productTitleEl.style.backgroundColor = t.backgroundColor;
      }
      root.querySelectorAll("section[data-section-id]").forEach((sectionEl) => {
        const sectionId = sectionEl.getAttribute("data-section-id") ?? "";
        // Apply section title (h3) styles from textStyles
        const sectionTitleEl = sectionEl.querySelector("h3[data-text-type='title']") as HTMLElement | null;
        if (sectionTitleEl && textStyles?.[sectionId]?.title) {
          const t = textStyles[sectionId].title!;
          if (t.color) sectionTitleEl.style.color = t.color;
          if (t.fontSize) sectionTitleEl.style.fontSize = t.fontSize;
          if (t.fontFamily) sectionTitleEl.style.fontFamily = t.fontFamily;
          if (t.fontWeight) sectionTitleEl.style.fontWeight = t.fontWeight;
          if (t.textAlign) sectionTitleEl.style.textAlign = t.textAlign;
          if (t.lineHeight) sectionTitleEl.style.lineHeight = t.lineHeight;
          if (t.textDecoration) sectionTitleEl.style.textDecoration = t.textDecoration;
          if (t.textTransform) sectionTitleEl.style.textTransform = t.textTransform;
          if (t.backgroundColor) sectionTitleEl.style.backgroundColor = t.backgroundColor;
        }
        const preview = sectionEl.querySelector(".preview-content");
        if (!preview) return;
        const blocks = preview.querySelectorAll(SELECTION_BLOCK_SELECTOR);
        const blockStyles = textStyles?.[sectionId]?.blocks ?? [];
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
    });
    }, 0);
    return () => clearTimeout(timer);
  }, [sections, product?.designSettings?.textStyles, currentPageIndex]);

  const currentContentSection = currentPageIndex >= 1 && currentPageIndex < totalPages - 1 ? sections[currentPageIndex - 1] : null;
  useEffect(() => {
    if (!currentContentSection || !previewContentRef.current) return;
    const html = (currentContentSection.contentHtml ?? cleanMarkdownToHtml(currentContentSection.content ?? "")) || "";
    const last = lastPreviewHtmlRef.current;
    if (last?.sectionId === currentContentSection.id && last?.html === html) return;
    lastPreviewHtmlRef.current = { sectionId: currentContentSection.id, html };
    previewContentRef.current.innerHTML = html;
  }, [currentContentSection?.id, currentContentSection?.contentHtml, currentContentSection?.content]);

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

  const prevPageIndexRef = useRef(currentPageIndex);
  useEffect(() => {
    if (currentPageIndex === 0 && prevPageIndexRef.current === totalPages - 1 && totalPages > 1) {
      setCurrentPageIndex(totalPages - 1);
    }
    prevPageIndexRef.current = currentPageIndex;
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
            { id: "back-url", type: "text", content: "Add your website in brand profile", position: { x: CANVAS_WIDTH / 2 - 200, y: 500 }, size: { width: 400, height: 24 }, rotation: 0, zIndex: 1, textSettings: { ...DEFAULT_TEXT_BOX, fontSize: 14, textAlign: "center" } },
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

  /** Apply the same text colour to every content page (not cover/back) in one go. */
  const applyTextColorToAllContentPages = useCallback(
    (color: string) => {
      recordUndo();
      setPageBackgrounds((prev) => {
        const next = [...prev];
        const need = Math.max(2, sections.length + 2);
        while (next.length < need) next.push({});
        for (let i = 1; i < need - 1; i++) {
          next[i] = { ...next[i], pageTextColor: color };
        }
        return next;
      });
      recordUndoDebounced();
      toast({ title: "Text colour applied to all content pages" });
    },
    [sections.length, recordUndo, recordUndoDebounced, toast]
  );

  /** Clear page text colour from every content page. */
  const clearTextColorFromAllContentPages = useCallback(() => {
    recordUndo();
    setPageBackgrounds((prev) => {
      const next = prev.map((p) => {
        const { pageTextColor: _, ...rest } = p as PageBackground & { pageTextColor?: string };
        return rest;
      });
      return next;
    });
    recordUndoDebounced();
    toast({ title: "Text colour cleared from all content pages" });
  }, [recordUndo, recordUndoDebounced, toast]);

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
          pages: pageBackgrounds.length ? pageBackgrounds : Array.from({ length: Math.max(2, sections.length + 2) }, () => ({})),
          layout: { ...layoutSettings, ...preset.layout },
          placedElementsByPage,
        },
      });
    },
    [product?.designSettings, sections, pageBackgrounds, layoutSettings, placedElementsByPage, saveToServer]
  );

  useEffect(() => {
    if (!product || sections.length === 0) return;
    const totalPages = Math.max(2, sections.length + 2);
    autoSaveTimerRef.current = setInterval(() => {
      // Always send full pages and placedElementsByPage (cover + content + back) so Supabase persists them
      const pagesToSave = pageBackgrounds.length >= totalPages ? pageBackgrounds : Array.from({ length: totalPages }, (_, i) => pageBackgrounds[i] ?? {});
      const elementsToSave = placedElementsByPage.length >= totalPages ? placedElementsByPage : Array.from({ length: totalPages }, (_, i) => placedElementsByPage[i] ?? []);
      saveToServer({
        content: { sections },
        designSettings: {
          ...product.designSettings,
          template,
          layout: layoutSettings,
          colors: { ...product.designSettings?.colors, graphics: graphicsAccentColor },
          typography: product.designSettings?.typography,
          pages: pagesToSave,
          placedElementsByPage: elementsToSave,
        },
      });
    }, 5000);
    return () => {
      if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
    };
  }, [sections, template, product, placedElementsByPage, graphicsAccentColor, layoutSettings, pageBackgrounds, saveToServer]);

  useEffect(() => {
    if (currentPageIndex !== 0 || !productId || coverThumbnailCaptureTrigger === 0) return;
    const restorePage = savedPageIndexRef.current;
    const t = setTimeout(async () => {
      const el = canvasContainerRef.current;
      if (!el) {
        if (restorePage != null) setCurrentPageIndex(restorePage);
        savedPageIndexRef.current = null;
        return;
      }
      try {
        const canvas = await html2canvas(el, {
          useCORS: true,
          allowTaint: true,
          scale: 0.5,
          backgroundColor: "#ffffff",
          logging: false,
        });
        const dataUrl = canvas.toDataURL("image/png");
        const res = await fetch(`/api/products/${productId}/cover-thumbnail`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: dataUrl }),
        });
        if (res.ok) {
          const data = (await res.json()) as { url?: string };
          if (data.url) {
            setProduct((p) =>
              p
                ? {
                    ...p,
                    marketingAssets: {
                      ...p.marketingAssets,
                      coverThumbnailUrl: data.url,
                    },
                  }
                : null
            );
          }
        }
      } catch {
        // ignore
      } finally {
        if (restorePage != null) setCurrentPageIndex(restorePage);
        savedPageIndexRef.current = null;
      }
    }, 700);
    return () => clearTimeout(t);
  }, [currentPageIndex, productId, coverThumbnailCaptureTrigger, placedElementsByPage, pageBackgrounds]);

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

  async function handleImproveSection(sectionId: string) {
    const section = sections.find((s) => s.id === sectionId);
    if (!section || !productId || !section.content?.trim()) return;
    setIsRegenerating(true);
    try {
      const res = await fetch(`/api/products/${productId}/improve-section`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionTitle: section.title,
          content: section.content,
        }),
      });
      const data = (await res.json()) as { improved?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      if (data.improved) {
        recordUndo();
        setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, content: data.improved! } : s)));
        if (editingSectionId === sectionId) setEditingContent(data.improved);
        toast({ title: "Section improved! ✨" });
      }
    } catch (err) {
      toast({
        title: "Failed to improve section",
        description: err instanceof Error ? err.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsRegenerating(false);
    }
  }

  async function handleRegenerateSectionFromTOC(sectionId: string) {
    if (!productId) return;
    setRegeneratingSectionId(sectionId);
    try {
      const res = await fetch(`/api/products/${productId}/regenerate-section`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionId }),
      });
      const data = (await res.json()) as { newContent?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      if (data.newContent != null) {
        recordUndo();
        setSections((prev) =>
          prev.map((s) =>
            s.id === sectionId
              ? { ...s, content: data.newContent!, contentHtml: data.newContent! }
              : s
          )
        );
        if (editingSectionId === sectionId) setEditingContent(data.newContent);
        // Don't set lastPreviewHtmlRef here — let the effect sync the preview div so the new content actually shows
        if (previewContentRef.current && currentPageIndex >= 1 && currentPageIndex < totalPages - 1 && sections[currentPageIndex - 1]?.id === sectionId) {
          previewContentRef.current.innerHTML = data.newContent;
          lastPreviewHtmlRef.current = { sectionId, html: data.newContent };
        }
        toast({ title: "Section regenerated!" });
      }
    } catch (err) {
      toast({
        title: "Regenerate failed",
        description: err instanceof Error ? err.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setRegeneratingSectionId(null);
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
      const cacheKey = `${q.toLowerCase()}:${page}`;
      const cached = photoSearchCacheRef.current.get(cacheKey);
      if (cached) {
        setPhotoCurrentQuery(q);
        setPhotoPage(page);
        setPhotoTotalPages(cached.totalPages);
        setPhotos((prev) => (append && page > 1 ? [...prev, ...cached.photos] : cached.photos));
        return;
      }
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
        const totalPages = data.totalPages ?? 0;
        photoSearchCacheRef.current.set(cacheKey, { photos: newPhotos, totalPages });
        setPhotoCurrentQuery(q);
        setPhotoPage(page);
        setPhotoTotalPages(totalPages);
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

  const handlePhotoSearchInputChange = useCallback(
    (value: string) => {
      setPhotoSearch(value);
      if (photoSearchDebounceRef.current) {
        clearTimeout(photoSearchDebounceRef.current);
        photoSearchDebounceRef.current = null;
      }
      photoSearchDebounceRef.current = setTimeout(() => {
        photoSearchDebounceRef.current = null;
        const q = value.trim() || "nature";
        searchPhotos(q, 1, false);
      }, 1000);
    },
    [searchPhotos]
  );

  useEffect(() => {
    return () => {
      if (photoSearchDebounceRef.current) clearTimeout(photoSearchDebounceRef.current);
    };
  }, []);

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
      const data = (await res.json()) as { url?: string; imageUrl?: string; data?: { url?: string }[]; error?: string };
      console.log("DALL-E Response:", data);
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      const imageUrl =
        (typeof data.url === "string" && data.url.trim()) ||
        (typeof data.imageUrl === "string" && data.imageUrl.trim()) ||
        (Array.isArray(data.data) && typeof data.data[0]?.url === "string" && data.data[0].url.trim())
          ? (data.url?.trim() ?? data.imageUrl?.trim() ?? data.data?.[0]?.url?.trim() ?? "")
          : "";
      if (imageUrl) setAiImageUrl(imageUrl);
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

  const selectedTextElement = useMemo(() => {
    if (!selectedElement) return null;
    let foundPageIndex = -1;
    const el = placedElementsByPage.flat().find((e) => e.id === selectedElement && e.type === "text") ?? null;
    if (el) {
      for (let i = 0; i < placedElementsByPage.length; i++) {
        if (placedElementsByPage[i].some((e) => e.id === selectedElement && e.type === "text")) {
          foundPageIndex = i;
          break;
        }
      }
      const totalPages = placedElementsByPage.length;
      const isCover = foundPageIndex === 0;
      const isBack = totalPages > 0 && foundPageIndex === totalPages - 1;
      const isContent = !isCover && !isBack;
      console.log("[ProductEditor] selectedTextElement — data structure", {
        currentPageIndex,
        totalPages,
        foundPageIndex,
        pageType: isCover ? "COVER" : isBack ? "BACK" : "CONTENT",
        elementId: el.id,
        elementKeys: Object.keys(el),
        textSettingsKeys: el.textSettings ? Object.keys(el.textSettings) : null,
        textSettings: el.textSettings ? { ...el.textSettings } : null,
        fullElement: JSON.stringify({ id: el.id, type: el.type, content: el.content?.slice(0, 30), textSettings: el.textSettings }),
      });
    }
    return el;
  }, [selectedElement, placedElementsByPage, currentPageIndex]);

  useEffect(() => {
    if (editingTextBoxId) {
      editingTextAreaRef.current?.focus();
      const len = editingTextAreaRef.current?.value?.length ?? 0;
      editingTextAreaRef.current?.setSelectionRange(len, len);
    }
  }, [editingTextBoxId]);

  useEffect(() => {
    const pending = pendingContentCursorRef.current;
    if (!pending || !selectedTextMeta) return;
    if (
      pending.sectionId !== selectedTextMeta.sectionId ||
      pending.type !== selectedTextMeta.type ||
      (pending.blockIndex ?? -1) !== (selectedTextMeta.blockIndex ?? -1)
    ) {
      return;
    }
    const root = contentAreaRef.current;
    if (!root) return;
    let block: HTMLElement | null = null;
    if (pending.sectionId === "__product_title" && pending.type === "heading") {
      block = root.querySelector('h2[data-section-id="__product_title"]');
    } else {
      const section = root.querySelector(`section[data-section-id="${pending.sectionId}"]`);
      if (!section) return;
      if (pending.type === "title") {
        block = section.querySelector("h3[data-text-type='title']");
      } else {
        const preview = section.querySelector(".preview-content");
        const blocks = preview?.querySelectorAll("h1, h2, h3, h4, p, li");
        if (blocks && pending.blockIndex !== undefined && blocks[pending.blockIndex]) {
          block = blocks[pending.blockIndex] as HTMLElement;
        }
      }
    }
    if (block) {
      const offset = Math.min(pending.offset, block.textContent?.length ?? 0);
      pendingContentCursorRef.current = null;
      requestAnimationFrame(() => {
        if (!contentAreaRef.current?.contains(block)) return;
        setCursorToCharacterOffset(block, offset);
        block.focus({ preventScroll: false });
      });
    } else {
      pendingContentCursorRef.current = null;
    }
  }, [selectedTextMeta]);

  const updateTextBoxContent = useCallback(
    (content: string) => {
      if (!selectedElement) return;
      recordUndoDebounced();
      setPlacedElementsByPage((prev) =>
        prev.map((pageArr) =>
          pageArr.map((el) => (el.id === selectedElement ? { ...el, content } : el))
        )
      );
    },
    [selectedElement, recordUndoDebounced]
  );

  const saveTextBoxContentById = useCallback(
    (elementId: string, content: string) => {
      recordUndoDebounced();
      setPlacedElementsByPage((prev) =>
        prev.map((pageArr) =>
          pageArr.map((el) => (el.id === elementId && el.type === "text" ? { ...el, content } : el))
        )
      );
      setEditingTextBoxId(null);
      if (elementId === "back-url") {
        const trimmed = content.trim() || "";
        setBackCoverWebsiteUrl(trimmed || null);
        fetch("/api/brand-profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ websiteUrl: trimmed }),
        }).catch(() => {});
      }
    },
    [recordUndoDebounced]
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
    lastSelectedTextMetaRef.current = null;
    setSelectedTextMeta(null);
  }, []);

  const handleSelectElement = useCallback(
    (id: string) => {
      deselectText();
      setSelectedElement(id);
    },
    [deselectText]
  );
  const updateTextBoxContentById = useCallback(
    (elementId: string, value: string) => {
      recordUndoDebounced();
      setPlacedElementsByPage((prev) =>
        prev.map((pageArr) =>
          pageArr.map((el) => (el.id === elementId && el.type === "text" ? { ...el, content: value } : el))
        )
      );
    },
    [recordUndoDebounced]
  );
  const cancelTextBoxEdit = useCallback((elementId: string) => {
    setPlacedElementsByPage((prev) =>
      prev.map((pageArr) =>
        pageArr.map((el) =>
          el.id === elementId && el.type === "text" ? { ...el, content: editingTextBoxInitialContentRef.current } : el
        )
      )
    );
    setEditingTextBoxId(null);
  }, []);
  const handleStartEditTextBox = useCallback((elementId: string, content: string) => {
    editingTextBoxInitialContentRef.current = content || "";
    setEditingTextBoxId(elementId);
    setSelectedElement(elementId);
  }, []);

  const updateTextBoxSetting = useCallback(
    (key: keyof TextBoxSettings, value: string | number | boolean) => {
      console.log("[ProductEditor] updateTextBoxSetting called", {
        selectedElementId: selectedElement ?? null,
        key,
        value,
        isColorUpdate: key === "color",
      });
      if (!selectedElement) {
        console.log("[ProductEditor] updateTextBoxSetting — no selectedElement, returning");
        return;
      }
      const pageOfElement = placedElementsByPage.findIndex((pageArr) =>
        pageArr.some((el) => el.id === selectedElement && el.type === "text")
      );
      const elementBefore = placedElementsByPage.flat().find((el) => el.id === selectedElement && el.type === "text");
      console.log("[ProductEditor] updateTextBoxSetting — where formatting is applied", {
        selectedElement,
        key,
        value,
        currentPageIndex,
        pageOfElement,
        elementLivesOnPage: pageOfElement,
        elementBefore: elementBefore
          ? { id: elementBefore.id, textSettings: elementBefore.textSettings ? { ...elementBefore.textSettings } : null }
          : null,
        placedElementsByPageLength: placedElementsByPage.length,
        placedElementsByPagePageLengths: placedElementsByPage.map((arr) => arr.length),
      });
      recordUndoDebounced();
      const normalizedValue = key === "color" && typeof value === "string"
        ? (value.startsWith("#") ? value : `#${value}`).toLowerCase()
        : value;
      if (key === "color") {
        console.log("Updating element:", selectedElement, "colour:", normalizedValue);
      }
      setPlacedElementsByPage((prev) => {
        let updatedCount = 0;
        const next = prev.map((pageArr, pageIdx) =>
          pageArr.map((el) => {
            if (el.id !== selectedElement || el.type !== "text") return el;
            updatedCount++;
            const nextSettings = { ...el.textSettings, [key]: normalizedValue } as TextBoxSettings;
            const updated = { ...el, textSettings: { ...DEFAULT_TEXT_BOX, ...nextSettings } };
            console.log("[ProductEditor] updateTextBoxSetting — inside updater", {
              pageIdx,
              updatedCount,
              key,
              newTextSettings: updated.textSettings,
            });
            return updated;
          })
        );
        if (updatedCount === 0) {
          console.warn("[ProductEditor] updateTextBoxSetting — updater ran but no element was updated (updatedCount=0)");
        }
        return next;
      });
      if (pageOfElement >= 0 && pageOfElement !== currentPageIndex) {
        const totalP = Math.max(2, sections.length + 2);
        const isOnBackCover = currentPageIndex === totalP - 1;
        if (!(isOnBackCover && pageOfElement === 0)) {
          setCurrentPageIndex(pageOfElement);
        }
      }
    },
    [selectedElement, recordUndoDebounced, placedElementsByPage, currentPageIndex, sections.length]
  );

  const applyTextColorToCurrentPage = useCallback(
    (color: string) => {
      recordUndo();
      setPlacedElementsByPage((prev) =>
        prev.map((pageArr, pageIndex) =>
          pageIndex === currentPageIndex
            ? pageArr.map((el) =>
                el.type === "text"
                  ? { ...el, textSettings: { ...DEFAULT_TEXT_BOX, ...el.textSettings, color } }
                  : el
              )
            : pageArr
        )
      );
      toast({ title: "Colour applied to all text on this page" });
    },
    [currentPageIndex, recordUndo, toast]
  );

  const applyTextColorToAllPages = useCallback(
    (color: string) => {
      recordUndo();
      setPlacedElementsByPage((prev) =>
        prev.map((pageArr) =>
          pageArr.map((el) =>
            el.type === "text"
              ? { ...el, textSettings: { ...DEFAULT_TEXT_BOX, ...el.textSettings, color } }
              : el
          )
        )
      );
      toast({ title: "Colour applied to all text on every page" });
    },
    [recordUndo, toast]
  );

  const setBackgroundFromUrl = useCallback(
    (imageUrl: string) => {
      recordUndo();
      const rawUrl = typeof imageUrl === "string" ? imageUrl.trim() : "";
      if (!rawUrl) {
        toast({ title: "No image URL to set as background", variant: "destructive" });
        return;
      }
      const url = getBackgroundUrlToSave(rawUrl) ?? rawUrl;
      const newBgSettings = { ...DEFAULT_IMAGE_SETTINGS };
      const defaultOverlay = DEFAULT_OVERLAY;
      setBackgroundImage(url);
      setBackgroundSettings(newBgSettings);
      setOverlaySettings(defaultOverlay);
      persistCurrentPageBackground({ backgroundImage: url, backgroundSettings: newBgSettings, overlaySettings: defaultOverlay });
      saveToServer({
        designSettings: {
          ...product?.designSettings,
          placedElementsByPage,
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
    [toast, product?.designSettings, saveToServer, persistCurrentPageBackground, pageBackgrounds, placedElementsByPage, currentPageIndex, recordUndo]
  );

  const setAsBackground = useCallback(() => {
    const el = selectedImageElement;
    if (!el) return;
    recordUndo();
    const rawImageUrl = typeof el.content === "string" ? el.content.trim() : "";
    if (!rawImageUrl) {
      toast({ title: "No image URL to set as background", variant: "destructive" });
      return;
    }
    const imageUrl = getBackgroundUrlToSave(rawImageUrl) ?? rawImageUrl;
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
    saveToServer({ designSettings: { ...product?.designSettings, pages: nextPages, placedElementsByPage } });
    toast({ title: "Background removed from this page" });
  }, [toast, persistCurrentPageBackground, pageBackgrounds, placedElementsByPage, currentPageIndex, product?.designSettings, saveToServer, recordUndo]);

  const applyBackgroundToAllPages = useCallback(() => {
    recordUndo();
    const currentBg: PageBackground = {
      backgroundImage: backgroundImage ?? undefined,
      backgroundSettings: { ...backgroundSettings },
      overlaySettings: { ...overlaySettings },
    };
    const nextPages = Array.from({ length: totalPages }, () => ({ ...currentBg }));
    setPageBackgrounds(nextPages);
    saveToServer({ designSettings: { ...product?.designSettings, pages: nextPages, placedElementsByPage } });
    toast({ title: "Background applied to all pages" });
  }, [totalPages, backgroundImage, backgroundSettings, overlaySettings, placedElementsByPage, product?.designSettings, saveToServer, toast, recordUndo]);

  const applyGraphicsToAllPages = useCallback(() => {
    recordUndo();
    const currentGraphics = currentPageElements.map((e) => ({ ...e }));
    const nextByPage = Array.from({ length: totalPages }, (_, i) =>
      currentGraphics.map((e) => ({ ...e, id: `${e.type}-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}` }))
    );
    setPlacedElementsByPage(nextByPage);
    saveToServer({ designSettings: { ...product?.designSettings, pages: pageBackgrounds, placedElementsByPage: nextByPage } });
    toast({ title: "Graphics applied to all pages" });
  }, [totalPages, currentPageElements, pageBackgrounds, product?.designSettings, saveToServer, toast, recordUndo]);

  const applyCoverBackgroundToBackCover = useCallback(() => {
    const coverPage = pageBackgrounds[0];
    if (!coverPage) return;
    recordUndo();
    const backBg: PageBackground = {
      backgroundImage: coverPage.backgroundImage ?? undefined,
      backgroundSettings: coverPage.backgroundSettings ? { ...coverPage.backgroundSettings } : undefined,
      overlaySettings: coverPage.overlaySettings ? { ...coverPage.overlaySettings } : undefined,
    };
    const nextPages = [...pageBackgrounds];
    nextPages[nextPages.length - 1] = backBg;
    setPageBackgrounds(nextPages);
    saveToServer({ designSettings: { ...product?.designSettings, pages: nextPages, placedElementsByPage } });
    toast({ title: "Background applied to back cover" });
  }, [pageBackgrounds, placedElementsByPage, product?.designSettings, saveToServer, toast, recordUndo]);

  const applyBackBackgroundToCover = useCallback(() => {
    const backIdx = pageBackgrounds.length - 1;
    const backPage = pageBackgrounds[backIdx];
    if (!backPage) return;
    recordUndo();
    const coverBg: PageBackground = {
      backgroundImage: backPage.backgroundImage ?? undefined,
      backgroundSettings: backPage.backgroundSettings ? { ...backPage.backgroundSettings } : undefined,
      overlaySettings: backPage.overlaySettings ? { ...backPage.overlaySettings } : undefined,
    };
    const nextPages = [...pageBackgrounds];
    nextPages[0] = coverBg;
    setPageBackgrounds(nextPages);
    if (currentPageIndex === 0) {
      setBackgroundImage(coverBg.backgroundImage ?? null);
      setBackgroundSettings(coverBg.backgroundSettings ? { ...DEFAULT_IMAGE_SETTINGS, ...coverBg.backgroundSettings } : DEFAULT_IMAGE_SETTINGS);
      setOverlaySettings(coverBg.overlaySettings ? { ...DEFAULT_OVERLAY, ...coverBg.overlaySettings } : DEFAULT_OVERLAY);
    }
    saveToServer({ designSettings: { ...product?.designSettings, pages: nextPages, placedElementsByPage } });
    toast({ title: "Background applied to front cover" });
  }, [pageBackgrounds, placedElementsByPage, product?.designSettings, saveToServer, toast, recordUndo, currentPageIndex]);

  const runAutoDesign = useCallback(
    async (options?: {
      useBrandColors?: boolean;
      regenerate?: boolean;
      brand?: {
        primaryColor: string;
        secondaryColor: string;
        tiktokUrl?: string;
        instagramUrl?: string;
        youtubeUrl?: string;
        facebookUrl?: string;
        websiteUrl?: string;
      };
    }) => {
      const title = product?.title ?? "";
      const niche = product?.niche ?? "";
      const useBrand = Boolean(options?.useBrandColors && options?.brand);
      setAutoDesignLoading(true);
      try {
        const designRes = await fetch("/api/auto-design", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            niche,
            ...(product?.format ? { format: product.format } : {}),
            ...(options?.regenerate ? { regenerate: true } : {}),
            ...(useBrand && options?.brand
              ? {
                  brandPrimary: options.brand.primaryColor,
                  brandSecondary: options.brand.secondaryColor,
                }
              : {}),
          }),
        });
      if (!designRes.ok) {
        const err = (await designRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "Design suggestion failed");
      }
      const design = (await designRes.json()) as {
        primary: string;
        secondary: string;
        accent: string;
        headingFont: string;
        bodyFont: string;
        pexelsKeyword: string;
      };
      const pexelsPage = options?.regenerate ? Math.min(5, 1 + Math.floor(Math.random() * 5)) : 1;
      const pexelsRes = await fetch(
        `/api/stock-photos?query=${encodeURIComponent(design.pexelsKeyword)}&per_page=1&page=${pexelsPage}`
      );
      let bgImageUrl: string | null = null;
      if (pexelsRes.ok) {
        const pexelsData = (await pexelsRes.json()) as { photos?: { fullUrl?: string; url?: string }[] };
        const first = pexelsData.photos?.[0];
        const raw = first?.fullUrl ?? first?.url ?? null;
        bgImageUrl = raw ? (getBackgroundUrlToSave(raw) ?? raw) : null;
      }
      recordUndo();
      const primary = design.primary.startsWith("#") ? design.primary : `#${design.primary}`;
      const secondary = design.secondary.startsWith("#") ? design.secondary : `#${design.secondary}`;
      const accent = design.accent.startsWith("#") ? design.accent : `#${design.accent}`;
      const headingFont = `${design.headingFont}, serif`;
      const bodyFont = `${design.bodyFont}, system-ui, sans-serif`;
      const overlayForCoverBack: OverlaySettings = {
        color: primary,
        opacity: 0.75,
      };

      const nextPlaced = placedElementsByPage.map((pageArr) =>
        pageArr.map((el) => {
          if (el.type !== "text") return el;
          const ts = { ...DEFAULT_TEXT_BOX, ...el.textSettings };
          if (el.id === "cover-title") {
            return {
              ...el,
              textSettings: {
                ...ts,
                color: primary,
                fontWeight: "700",
                fontSize: 32,
                textAlign: "center",
                fontFamily: headingFont,
              },
            };
          }
          if (el.id === "cover-subtitle") {
            return {
              ...el,
              textSettings: {
                ...ts,
                color: secondary,
                fontSize: 16,
                textAlign: "center",
                fontFamily: bodyFont,
              },
            };
          }
          return {
            ...el,
            textSettings: { ...ts, color: primary, fontFamily: bodyFont },
          };
        })
      );
      setPlacedElementsByPage(nextPlaced);

      setGraphicsAccentColor(accent);
      setCustomColor(accent);

      const nextPages = [...pageBackgrounds];
      while (nextPages.length < totalPages) nextPages.push({});
      const coverBackBg: PageBackground = {
        backgroundImage: bgImageUrl ?? undefined,
        backgroundSettings: DEFAULT_IMAGE_SETTINGS,
        overlaySettings: overlayForCoverBack,
      };
      nextPages[0] = { ...nextPages[0], ...coverBackBg };
      nextPages[nextPages.length - 1] = { ...(nextPages[nextPages.length - 1] ?? {}), ...coverBackBg };
      setPageBackgrounds(nextPages);
      if (currentPageIndex === 0) {
        setBackgroundImage(bgImageUrl);
        setBackgroundSettings(DEFAULT_IMAGE_SETTINGS);
        setOverlaySettings(overlayForCoverBack);
      }

      const prevStyles = product?.designSettings?.textStyles ?? {};
      const nextTextStyles: Record<string, { title?: TextStyles; body?: TextStyles; blocks?: TextStyles[] }> = {};
      nextTextStyles["__product_title"] = {
        ...prevStyles["__product_title"],
        title: {
          color: primary,
          fontFamily: headingFont,
          fontSize: "24px",
          fontWeight: "700",
          textAlign: "left",
        },
      };
      sections.forEach((sec) => {
        nextTextStyles[sec.id] = {
          title: {
            color: primary,
            fontFamily: headingFont,
          },
          body: {
            color: secondary,
            fontFamily: bodyFont,
          },
          blocks: prevStyles[sec.id]?.blocks,
        };
      });

      const backCoverSocials =
        useBrand && options?.brand
          ? {
              ...product?.designSettings?.backCoverSocialLinks,
              ...(options.brand.tiktokUrl ? { tiktok: options.brand.tiktokUrl } : {}),
              ...(options.brand.instagramUrl ? { instagram: options.brand.instagramUrl } : {}),
              ...(options.brand.youtubeUrl ? { youtube: options.brand.youtubeUrl } : {}),
              ...(options.brand.facebookUrl ? { facebook: options.brand.facebookUrl } : {}),
            }
          : product?.designSettings?.backCoverSocialLinks;

      const backIdx = nextPlaced.length - 1;
      if (backIdx >= 0) {
        const links = (backCoverSocials ?? {}) as Record<string, string>;
        nextPlaced[backIdx] = ensureBackPageSocialElements(nextPlaced[backIdx] ?? [], links);
      }

      setProduct((p) =>
        p
          ? {
              ...p,
              designSettings: {
                ...p.designSettings,
                colors: { ...p.designSettings?.colors, graphics: accent },
                textStyles: nextTextStyles,
                ...(backCoverSocials ? { backCoverSocialLinks: backCoverSocials } : {}),
              },
            }
          : null
      );
      saveToServer({
        designSettings: {
          ...product?.designSettings,
          colors: { ...product?.designSettings?.colors, graphics: accent },
          textStyles: nextTextStyles,
          pages: nextPages,
          placedElementsByPage: nextPlaced,
          ...(backCoverSocials ? { backCoverSocialLinks: backCoverSocials } : {}),
        },
      });
      toast({ title: "Auto-design applied" });
    } catch (err) {
      toast({
        title: "Auto-design failed",
        description: err instanceof Error ? err.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setAutoDesignLoading(false);
    }
    },
    [product, sections, totalPages, pageBackgrounds, placedElementsByPage, currentPageIndex, recordUndo, saveToServer, toast]
  );

  const handleAutoDesignClick = useCallback(async () => {
    try {
      const res = await fetch("/api/brand-profile");
      if (res.status === 404) {
        setBrandProfile(null);
        setShowBrandSetupDialog(true);
        return;
      }
      if (!res.ok) {
        toast({ title: "Could not load brand profile", variant: "destructive" });
        return;
      }
      const data = (await res.json()) as {
        primaryColor: string;
        secondaryColor: string;
        tiktokUrl?: string;
        instagramUrl?: string;
        youtubeUrl?: string;
        facebookUrl?: string;
        websiteUrl?: string;
        preferAiColors: boolean;
        coverBackgroundPreference?: string;
      };
      setBrandProfile({
        ...data,
        primaryColor: data.primaryColor ?? "#1a1a1a",
        secondaryColor: data.secondaryColor ?? "#475569",
        preferAiColors: data.preferAiColors ?? false,
      });
      setAutoDesignChoice(data.preferAiColors ? "ai" : "brand");
      setCoverBackgroundPreference(data.coverBackgroundPreference === "random" ? "random" : "match_product");
      setShowAutoDesignChoiceDialog(true);
    } catch {
      toast({ title: "Could not load brand profile. Check your connection and try again.", variant: "destructive" });
    }
  }, [toast]);

  const handleRegenerateDesign = useCallback(async () => {
    if (!productId) return;
    setRegenerateDesignLoading(true);
    try {
      const url = `/api/products/${productId}/apply-design`;
      const body = { useBrandColors: false, regenerate: true, pageSeed: Date.now() };
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "same-origin",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const apiError = typeof data?.error === "string" ? data.error : data?.message ?? "Regenerate failed";
        console.log("[Regenerate Design] API error:", {
          status: res.status,
          statusText: res.statusText,
          error: apiError,
          productId,
          bodySent: body,
        });
        throw new Error(apiError);
      }
      await fetchProduct();
      toast({ title: "Design updated" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not regenerate design";
      console.log("[Regenerate Design] Error:", message, err);
      toast({ title: "Could not regenerate design", description: message, variant: "destructive" });
    } finally {
      setRegenerateDesignLoading(false);
    }
  }, [productId, fetchProduct, toast]);

  const backCoverSocialLinks = product?.designSettings?.backCoverSocialLinks ?? {};

  const updateBackCoverWebsiteUrlFromInput = useCallback(
    (value: string) => {
      const trimmed = value.trim() || "";
      setBackCoverWebsiteUrl(trimmed || null);
      setPlacedElementsByPage((prev) => {
        const lastIdx = prev.length - 1;
        if (lastIdx < 0) return prev;
        return prev.map((pageArr, i) =>
          i !== lastIdx
            ? pageArr
            : pageArr.map((el) =>
                el.id === "back-url" && el.type === "text"
                  ? { ...el, content: trimmed || "Add your website in brand profile" }
                  : el
              )
        );
      });
    },
    []
  );

  const saveBackCoverWebsiteUrlToBrandProfile = useCallback((url: string) => {
    const trimmed = url.trim() || "";
    fetch("/api/brand-profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ websiteUrl: trimmed || null }),
    }).catch(() => {});
  }, []);

  const updateBackCoverSocialLink = useCallback(
    (platform: "tiktok" | "instagram" | "youtube" | "facebook", url: string) => {
      recordUndo();
      const trimmed = url.trim();
      const nextLinks = { ...backCoverSocialLinks, [platform]: trimmed || undefined };
      if (!trimmed) delete nextLinks[platform];
      setProduct((p) =>
        p ? { ...p, designSettings: { ...p.designSettings, backCoverSocialLinks: nextLinks } } : null
      );
      const backIdx = placedElementsByPage.length - 1;
      if (backIdx < 0) return;
      const socialSize = 40;
      const startXForPlatform = (idx: number) =>
        CANVAS_WIDTH / 2 - (SOCIAL_PLATFORMS.length * (socialSize + 12)) / 2 + idx * (socialSize + 12);
      const backPage = placedElementsByPage[backIdx] ?? [];
      let nextBackPage: PlacedElement[];
      if (trimmed) {
        const existing = backPage.find((el) => el.type === "social" && el.content === platform);
        if (existing) {
          nextBackPage = backPage.map((el) =>
            el.type === "social" && el.content === platform ? { ...el, linkUrl: trimmed } : el
          );
        } else {
          nextBackPage = [
            ...backPage,
            {
              id: `social-${platform}-${Date.now()}`,
              type: "social" as const,
              content: platform,
              position: { x: startXForPlatform(SOCIAL_PLATFORMS.indexOf(platform)), y: CANVAS_HEIGHT - 120 },
              size: { width: socialSize, height: socialSize },
              rotation: 0,
              zIndex: 10,
              linkUrl: trimmed,
            },
          ];
        }
      } else {
        nextBackPage = backPage.filter((el) => !(el.type === "social" && el.content === platform));
      }
      const nextPlacedElementsByPage = placedElementsByPage.map((arr, i) => (i === backIdx ? nextBackPage : arr));
      setPlacedElementsByPage(nextPlacedElementsByPage);
      saveToServer({
        designSettings: { ...product?.designSettings, backCoverSocialLinks: nextLinks },
        placedElementsByPage: nextPlacedElementsByPage,
      });
    },
    [backCoverSocialLinks, placedElementsByPage, product?.designSettings, saveToServer, recordUndo]
  );

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
    saveToServer({ designSettings: { ...product?.designSettings, pages: pageBackgrounds, placedElementsByPage: nextByPage } });
    toast({ title: "Icon applied to all pages" });
  }, [selectedGraphicElement, currentPageIndex, placedElementsByPage, pageBackgrounds, product?.designSettings, saveToServer, toast, recordUndo]);

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
    saveToServer({ designSettings: { ...product?.designSettings, pages: pageBackgrounds, placedElementsByPage: nextByPage } });
    toast({ title: `Icon removed from all ${pagesAffected} pages` });
  }, [selectedGraphicElement, placedElementsByPage, pageBackgrounds, product?.designSettings, saveToServer, toast, recordUndo]);

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

      blockEl.style.outline = "2px solid #f97316";
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
      const dataBlockIndex = blockEl.getAttribute("data-block-index");
      if (dataTextType) {
        type = dataTextType as TextElementType;
        if (dataBlockIndex !== null && dataBlockIndex !== "") {
          const idx = parseInt(dataBlockIndex, 10);
          if (!Number.isNaN(idx) && idx >= 0) blockIndex = idx;
        }
        if (blockIndex === undefined && blockEl.closest(".preview-content")) {
          const preview = blockEl.closest(".preview-content");
          const blocks = preview ? preview.querySelectorAll("h1, h2, h3, h4, p, li") : [];
          blockIndex = Array.prototype.indexOf.call(blocks, blockEl);
          if (blockIndex < 0) blockIndex = undefined;
        }
      } else if (blockEl.closest(".preview-content")) {
        type = getBlockType(blockEl);
        const preview = blockEl.closest(".preview-content");
        const blocks = preview ? preview.querySelectorAll("h1, h2, h3, h4, p, li") : [];
        blockIndex = Array.prototype.indexOf.call(blocks, blockEl);
      } else {
        type = getBlockType(blockEl);
      }

      let cursorOffset = 0;
      const doc = blockEl.ownerDocument;
      const range = typeof doc.caretRangeFromPoint === "function"
        ? doc.caretRangeFromPoint(e.clientX, e.clientY)
        : null;
      if (range && blockEl.contains(range.startContainer)) {
        cursorOffset = getCharacterOffsetWithinBlock(blockEl, range.startContainer, range.startOffset);
        pendingContentCursorRef.current = { sectionId, type, blockIndex, offset: cursorOffset };
      } else {
        pendingContentCursorRef.current = null;
      }

      const comp = window.getComputedStyle(blockEl);
      const styles: TextStyles = {
        color: normalizeTextColorToHex(comp.color),
        fontSize: comp.fontSize,
        fontFamily: comp.fontFamily,
        fontWeight: comp.fontWeight,
        textAlign: comp.textAlign,
        lineHeight: comp.lineHeight,
        textDecoration: comp.textDecoration,
        textTransform: comp.textTransform,
        backgroundColor: comp.backgroundColor === "rgba(0, 0, 0, 0)" || comp.backgroundColor === "transparent" ? "transparent" : normalizeTextColorToHex(comp.backgroundColor),
      };
      const meta: SelectedTextMeta = {
        sectionId,
        type,
        blockIndex,
        content: type === "title" || type === "heading" ? blockEl.textContent ?? "" : blockEl.innerHTML,
        styles,
      };
      setSelectedTextMeta(meta);
      lastSelectedTextMetaRef.current = meta;
    },
    []
  );

  const persistTextStyles = useCallback(
    (sectionId: string, type: TextElementType, styles: TextStyles, blockIndex?: number) => {
      setProduct((p) => {
        if (!p) return null;
        const prevSection = p.designSettings?.textStyles?.[sectionId] ?? { title: {} as TextStyles, body: {} as TextStyles };
        const nextSection = { ...prevSection };
        // Only update the single block at blockIndex; never apply to whole section when a block is selected
        if (blockIndex !== undefined && (type === "heading" || type === "subheading" || type === "body")) {
          const blocks = Array.isArray(prevSection.blocks) ? [...prevSection.blocks] : [];
          while (blocks.length <= blockIndex) blocks.push({} as TextStyles);
          blocks[blockIndex] = styles;
          nextSection.blocks = blocks;
        } else if (blockIndex === undefined && sectionId === "__product_title" && type === "heading") {
          nextSection.title = styles;
        } else if (blockIndex === undefined) {
          nextSection[type === "title" ? "title" : "body"] = styles;
        }
        const next = {
          ...p,
          designSettings: {
            ...(p.designSettings ?? {}),
            textStyles: {
              ...(p.designSettings?.textStyles ?? {}),
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

  const applyTextStylesToCanvasElement = useCallback(
    (sectionId: string, type: TextElementType, blockIndex: number | undefined, styles: TextStyles) => {
      const root = contentAreaRef.current;
      if (!root) return;
      let el: HTMLElement | null = null;
      if (sectionId === "__product_title" && type === "heading") {
        el = root.querySelector('h2[data-section-id="__product_title"]') as HTMLElement | null;
      } else if (type === "title" && blockIndex === undefined) {
        const sectionEl = root.querySelector(`section[data-section-id="${sectionId}"]`);
        el = sectionEl?.querySelector("h3[data-text-type='title']") as HTMLElement | null ?? null;
      } else if (blockIndex !== undefined) {
        const sectionEl = root.querySelector(`section[data-section-id="${sectionId}"]`);
        const preview = sectionEl?.querySelector(".preview-content");
        const blocks = preview?.querySelectorAll(SELECTION_BLOCK_SELECTOR);
        el = blocks?.[blockIndex] as HTMLElement | null ?? null;
      }
      if (!el) return;
      const style = el.style as unknown as Record<string, string>;
      if (styles.color) style.color = styles.color;
      if (styles.fontSize) style.fontSize = styles.fontSize;
      if (styles.fontFamily) style.fontFamily = styles.fontFamily;
      if (styles.fontWeight) style.fontWeight = styles.fontWeight;
      if (styles.textAlign) style.textAlign = styles.textAlign;
      if (styles.lineHeight) style.lineHeight = styles.lineHeight;
      if (styles.textDecoration) style.textDecoration = styles.textDecoration;
      if (styles.textTransform) style.textTransform = styles.textTransform;
      if (styles.backgroundColor) style.backgroundColor = styles.backgroundColor;
    },
    []
  );

  const updateTextStyle = useCallback(
    (property: string, value: string) => {
      const meta = selectedTextMeta ?? lastSelectedTextMetaRef.current;
      if (!meta) return;
      const normalized =
        property === "color"
          ? normalizeTextColorToHex(value)
          : property === "backgroundColor" && value !== "transparent" && !value.startsWith("rgba(0, 0, 0, 0)")
            ? normalizeTextColorToHex(value)
            : property === "backgroundColor"
              ? value
              : value;
      const mergedStyles = { ...meta.styles, [property]: normalized };
      if (selectedTextRef.current) {
        (selectedTextRef.current.style as unknown as Record<string, string>)[property] = normalized;
      }
      setSelectedTextMeta((prev) => (prev ? { ...prev, styles: mergedStyles } : null));
      if (lastSelectedTextMetaRef.current) {
        lastSelectedTextMetaRef.current = { ...lastSelectedTextMetaRef.current, styles: mergedStyles };
      }
      persistTextStyles(meta.sectionId, meta.type, mergedStyles, meta.blockIndex);
      applyTextStylesToCanvasElement(meta.sectionId, meta.type, meta.blockIndex, mergedStyles);
      requestAnimationFrame(() => {
        applyTextStylesToCanvasElement(meta.sectionId, meta.type, meta.blockIndex, mergedStyles);
      });
      setTimeout(() => {
        applyTextStylesToCanvasElement(meta.sectionId, meta.type, meta.blockIndex, mergedStyles);
      }, 150);
    },
    [selectedTextMeta, persistTextStyles, applyTextStylesToCanvasElement]
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

  const persistBodyHtml = useCallback(
    (sectionId: string, html: string) => {
      const nextSections = sections.map((s) => (s.id === sectionId ? { ...s, contentHtml: html } : s));
      setSections(nextSections);
      saveToServer({ content: { sections: nextSections } });
    },
    [sections, saveToServer]
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

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!selectedElement) return;
      const target = e.target as Node | null;
      const isEditingText = target && (
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLInputElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      );
      if (isEditingText) return;
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

      // PDF export: client-side html2canvas + jsPDF (capture editor canvas as-is, no server)
      const container = previewPagesContainerRef.current;
      if (!container) {
        throw new Error("Preview not ready. Try again in a moment.");
      }
      // Resolve back-cover website link rect for clickable PDF link (before container may move)
      const linkOverlays: Array<{ pageIndex: number; url: string; left: number; top: number; width: number; height: number }> = [];
      const previewPages = container.querySelectorAll<HTMLElement>(".preview-page");
      const backPageEl = includeBackPage && previewPages.length > 0 ? previewPages[previewPages.length - 1]! : null;
      const websiteLinkEl = backPageEl?.querySelector<HTMLElement>("[data-website-link]");
      if (backPageEl && websiteLinkEl) {
        let url = websiteLinkEl.getAttribute("data-website-link")?.trim();
        if (url) {
          if (!/^https?:\/\//i.test(url)) url = "https://" + url;
          const pageRect = backPageEl.getBoundingClientRect();
          const linkRect = websiteLinkEl.getBoundingClientRect();
          linkOverlays.push({
            pageIndex: previewPages.length - 1,
            url,
            left: linkRect.left - pageRect.left,
            top: linkRect.top - pageRect.top,
            width: linkRect.width,
            height: linkRect.height,
          });
        }
      }
      await new Promise((r) => setTimeout(r, 150));
      const blob = await captureCanvasPagesToPdf(container, undefined, linkOverlays.length > 0 ? linkOverlays : undefined);
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
      const rawMessage = err instanceof Error ? err.message : "Export failed.";
      const message =
        rawMessage === "Failed to fetch" || rawMessage.toLowerCase().includes("failed to fetch")
          ? "Could not reach the server. Check your connection and that the app is running, then try again."
          : rawMessage;
      console.error("[Export failed]", { error: err, rawMessage, message });
      toast({
        title: "Export failed",
        description: message,
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
    coverThumbnailUrl?: string | null;
    thumbnailStyle?: ThumbnailTemplateId;
    bookMockupUrl?: string | null;
    promoVideoUrl?: string | null;
    promoVideoStatus?: string | null;
    promoVideoId?: string | null;
    testimonials?: Array<{ name: string; text: string; rating?: number }>;
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
      if (!res.ok) {
        const msg = typeof data?.details === "string" ? data.details : typeof data?.error === "string" ? data.error : "Failed to generate";
        console.error("[marketing-assets] API error:", res.status, data);
        throw new Error(msg);
      }
      setProduct((p) => (p ? { ...p, marketingAssets: data } : null));
      toast({ title: "Marketing assets generated", description: "Edit any field and save. Use Copy to paste into Etsy, Gumroad, etc." });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong";
      if (message === "Failed to fetch") {
        console.error("[marketing-assets] Network error (request may have timed out or server unreachable):", e);
        toast({ title: "Generation failed", description: "Network error. Check the console and server logs for details.", variant: "destructive" });
      } else {
        toast({ title: "Generation failed", description: message, variant: "destructive" });
      }
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
      if (!res.ok) {
        const msg = typeof data?.details === "string" ? data.details : typeof data?.error === "string" ? data.error : "Failed to regenerate";
        console.error("[marketing-assets] API error:", res.status, data);
        throw new Error(msg);
      }
      setProduct((p) => (p ? { ...p, marketingAssets: { ...p.marketingAssets, ...data } } : null));
      toast({ title: "Description regenerated" });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong";
      if (message === "Failed to fetch") {
        console.error("[marketing-assets] Network error:", e);
        toast({ title: "Regenerate failed", description: "Network error. Check the console and server logs.", variant: "destructive" });
      } else {
        toast({ title: "Regenerate failed", description: message, variant: "destructive" });
      }
    } finally {
      setMarketingRegenerating(false);
    }
  }, [productId, toast]);

  const handleGetPricingRecommendation = useCallback(async () => {
    if (!productId) return;
    setPricingRecommendationLoading(true);
    setPricingRecommendation(null);
    try {
      const res = await fetch(`/api/products/${productId}/pricing-recommendation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Failed to get recommendation");
      }
      if (data.priceRange != null && data.strategy != null && data.reasoning != null) {
        setPricingRecommendation({
          priceRange: String(data.priceRange),
          strategy: String(data.strategy),
          reasoning: String(data.reasoning),
        });
      }
    } catch (e) {
      toast({
        title: "Pricing recommendation failed",
        description: e instanceof Error ? e.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setPricingRecommendationLoading(false);
    }
  }, [productId, toast]);

  const handleGeneratePlatformCopy = useCallback(async () => {
    if (!productId) return;
    setPlatformCopyLoading(true);
    setPlatformCopyResult(null);
    try {
      const res = await fetch(`/api/products/${productId}/platform-copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: platformCopyPlatform }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Failed to generate copy");
      }
      if (typeof data?.copy === "string") {
        setPlatformCopyResult(data.copy);
      }
    } catch (e) {
      toast({
        title: "Platform copy failed",
        description: e instanceof Error ? e.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setPlatformCopyLoading(false);
    }
  }, [productId, platformCopyPlatform, toast]);

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

  const handleCoverImageUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Image files only", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Max 5MB", variant: "destructive" });
      return;
    }
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", "product-cover");
      const res = await fetch("/api/upload/store-image", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      saveMarketingEdits({ coverThumbnailUrl: data.url });
      toast({ title: "Cover image uploaded!" });
    } catch (err) {
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : "Try again", variant: "destructive" });
    }
  }, [saveMarketingEdits, toast]);

  const hasDalleThumbnail = !!marketingAssets.thumbnailUrl;
  const effectiveOrientation = (marketingAssets as { thumbnailOrientation?: "horizontal" | "vertical" }).thumbnailOrientation ?? thumbnailOrientation;
  const thumbCaptureWidth = effectiveOrientation === "vertical" ? 1024 : hasDalleThumbnail ? 1792 : 1600;
  const thumbCaptureHeight = effectiveOrientation === "vertical" ? 1792 : hasDalleThumbnail ? 1024 : 1200;

  const handleDownloadThumbnail = useCallback(async () => {
    const thumbUrl = marketingAssets.thumbnailUrl;
    const filename = `${(product?.title ?? "product").replace(/\s+/g, "-")}-thumbnail.png`;

    if (thumbUrl && (thumbUrl.startsWith("http://") || thumbUrl.startsWith("https://"))) {
      try {
        const res = await fetch(`/api/download-image?url=${encodeURIComponent(thumbUrl)}`);
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
  // Use pageBackgrounds for current page when available so canvas updates after auto-design (which sets pageBackgrounds, not only local state)
  const currentPageBgFromPages = pageBackgrounds[currentPageIndex]?.backgroundImage;
  const rawCanvasBg =
    (typeof currentPageBgFromPages === "string" ? currentPageBgFromPages.trim() : "") ||
    (typeof backgroundImage === "string" ? backgroundImage.trim() : "") ||
    (typeof dsBg === "string" ? dsBg.trim() : "") ||
    null;
  const canvasBgUrl = getProxiedBackgroundImageUrl(rawCanvasBg) || null;
  const currentPageBackgroundColor = pageBackgrounds[currentPageIndex]?.backgroundColor ?? null;
  const currentPageTextColor = pageBackgrounds[currentPageIndex]?.pageTextColor ?? null;

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
      {autoDesignLoading && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className={`flex flex-col items-center gap-4 rounded-xl px-8 py-6 ${isDark ? "bg-[#1A1A1A] border border-[#2A2A2A]" : "bg-white border border-gray-200"} shadow-xl`}>
            <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
            <p className="text-sm font-medium text-gray-900 dark:text-white">Designing your product...</p>
          </div>
        </div>
      )}

      {/* Brand profile first-time setup */}
      <Dialog open={showBrandSetupDialog} onOpenChange={setShowBrandSetupDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Set up your brand profile</DialogTitle>
            <DialogDescription>Used for Auto-Design and back cover social links. Save once, use everywhere.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">TikTok URL</Label>
                <Input placeholder="https://tiktok.com/@" value={brandSetupForm.tiktokUrl} onChange={(e) => setBrandSetupForm((f) => ({ ...f, tiktokUrl: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Instagram URL</Label>
                <Input placeholder="https://instagram.com/..." value={brandSetupForm.instagramUrl} onChange={(e) => setBrandSetupForm((f) => ({ ...f, instagramUrl: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">YouTube URL</Label>
                <Input placeholder="https://youtube.com/..." value={brandSetupForm.youtubeUrl} onChange={(e) => setBrandSetupForm((f) => ({ ...f, youtubeUrl: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Facebook URL</Label>
                <Input placeholder="https://facebook.com/..." value={brandSetupForm.facebookUrl} onChange={(e) => setBrandSetupForm((f) => ({ ...f, facebookUrl: e.target.value }))} className="mt-1" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Website/Store URL</Label>
                <Input placeholder="https://yoursite.com" value={brandSetupForm.websiteUrl} onChange={(e) => setBrandSetupForm((f) => ({ ...f, websiteUrl: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Primary brand colour</Label>
              <div className="flex gap-2 mt-1.5 items-center">
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="h-9 w-9 shrink-0 rounded-md border border-input bg-background shadow-sm hover:ring-2 hover:ring-ring focus:outline-none focus:ring-2 focus:ring-ring"
                      style={{ backgroundColor: brandSetupForm.primaryColor }}
                      aria-label="Pick primary colour"
                    />
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-3" align="start">
                    <div className="[&_.react-colorful]:h-32 [&_.react-colorful]:w-44 [&_.react-colorful]:rounded-md">
                      <HexColorPicker
                        color={brandSetupForm.primaryColor}
                        onChange={(c) => setBrandSetupForm((f) => ({ ...f, primaryColor: c }))}
                      />
                    </div>
                  </PopoverContent>
                </Popover>
                <Input
                  type="text"
                  value={brandSetupForm.primaryColor}
                  onChange={(e) => setBrandSetupForm((f) => ({ ...f, primaryColor: e.target.value }))}
                  className="h-9 w-24 font-mono text-sm"
                  placeholder="#1a1a1a"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Secondary brand colour</Label>
              <div className="flex gap-2 mt-1.5 items-center">
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="h-9 w-9 shrink-0 rounded-md border border-input bg-background shadow-sm hover:ring-2 hover:ring-ring focus:outline-none focus:ring-2 focus:ring-ring"
                      style={{ backgroundColor: brandSetupForm.secondaryColor }}
                      aria-label="Pick secondary colour"
                    />
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-3" align="start">
                    <div className="[&_.react-colorful]:h-32 [&_.react-colorful]:w-44 [&_.react-colorful]:rounded-md">
                      <HexColorPicker
                        color={brandSetupForm.secondaryColor}
                        onChange={(c) => setBrandSetupForm((f) => ({ ...f, secondaryColor: c }))}
                      />
                    </div>
                  </PopoverContent>
                </Popover>
                <Input
                  type="text"
                  value={brandSetupForm.secondaryColor}
                  onChange={(e) => setBrandSetupForm((f) => ({ ...f, secondaryColor: e.target.value }))}
                  className="h-9 w-24 font-mono text-sm"
                  placeholder="#475569"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Logo (optional)</Label>
              <Input
                type="file"
                accept="image/*"
                className="mt-1"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => setBrandSetupForm((f) => ({ ...f, logoBase64: String(reader.result ?? "") }));
                  reader.readAsDataURL(file);
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBrandSetupDialog(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                try {
                  const res = await fetch("/api/brand-profile", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      tiktokUrl: brandSetupForm.tiktokUrl || undefined,
                      instagramUrl: brandSetupForm.instagramUrl || undefined,
                      youtubeUrl: brandSetupForm.youtubeUrl || undefined,
                      facebookUrl: brandSetupForm.facebookUrl || undefined,
                      websiteUrl: brandSetupForm.websiteUrl || undefined,
                      primaryColor: brandSetupForm.primaryColor,
                      secondaryColor: brandSetupForm.secondaryColor,
                      preferAiColors: false,
                      ...(brandSetupForm.logoBase64 ? { logoBase64: brandSetupForm.logoBase64 } : {}),
                    }),
                  });
                  if (!res.ok) throw new Error("Failed to save");
                  const saved = (await res.json()) as { primaryColor: string; secondaryColor: string; tiktokUrl?: string; instagramUrl?: string; youtubeUrl?: string; facebookUrl?: string; websiteUrl?: string };
                  setBrandProfile({
                    ...saved,
                    primaryColor: saved.primaryColor ?? "#1a1a1a",
                    secondaryColor: saved.secondaryColor ?? "#475569",
                    preferAiColors: false,
                  });
                  setShowBrandSetupDialog(false);
                  await runAutoDesign({
                    useBrandColors: true,
                    brand: {
                      primaryColor: saved.primaryColor ?? brandSetupForm.primaryColor,
                      secondaryColor: saved.secondaryColor ?? brandSetupForm.secondaryColor,
                      tiktokUrl: saved.tiktokUrl,
                      instagramUrl: saved.instagramUrl,
                      youtubeUrl: saved.youtubeUrl,
                      facebookUrl: saved.facebookUrl,
                    },
                  });
                  await fetch("/api/brand-profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ preferAiColors: false }) });
                } catch (err) {
                  toast({ title: "Could not save brand profile", variant: "destructive", description: err instanceof Error ? err.message : undefined });
                }
              }}
            >
              Save & run Auto-Design
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Auto-Design choice: use brand vs AI; after apply: Regenerate / Done */}
      <Dialog
        open={showAutoDesignChoiceDialog}
        onOpenChange={(open) => {
          if (open) preventAutoDesignCloseRef.current = false;
          if (!open && preventAutoDesignCloseRef.current) return;
          setShowAutoDesignChoiceDialog(open);
          if (!open) setAutoDesignSuccessView(false);
        }}
      >
        <DialogContent className="max-w-sm">
          {autoDesignSuccessView ? (
            <>
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                  <Check className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-center text-lg font-medium">Design applied!</p>
                <p className="text-center text-sm text-muted-foreground">{(product?.title ?? "Product")} has been styled with new colours, fonts, and a cover image. Try Regenerate for a different look.</p>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  variant="outline"
                  onClick={async () => {
                    if (!productId) return;
                    setAutoDesignLoading(true);
                    try {
                      const res = await fetch(`/api/products/${productId}/apply-design`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          useBrandColors: autoDesignChoice === "brand",
                          regenerate: true,
                          pageSeed: Date.now(),
                        }),
                      });
                      if (!res.ok) throw new Error("Regenerate failed");
                      await fetchProduct();
                      toast({ title: "Design updated" });
                    } catch {
                      toast({ title: "Could not regenerate design", variant: "destructive" });
                    } finally {
                      setAutoDesignLoading(false);
                    }
                  }}
                  disabled={autoDesignLoading}
                >
                  {autoDesignLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Regenerating...
                    </>
                  ) : (
                    "Regenerate"
                  )}
                </Button>
                <Button onClick={() => { setShowAutoDesignChoiceDialog(false); setAutoDesignSuccessView(false); }}>
                  Done
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Auto-Design</DialogTitle>
                <DialogDescription>Use your brand colours or let AI choose the best colours for this product.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Colours</p>
                <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50 dark:hover:bg-[#2A2A2A]">
                  <input type="radio" name="autoDesignChoice" checked={autoDesignChoice === "brand"} onChange={() => setAutoDesignChoice("brand")} className="text-orange-500" />
                  <span className="text-sm font-medium">Use my brand colours</span>
                </label>
                <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50 dark:hover:bg-[#2A2A2A]">
                  <input type="radio" name="autoDesignChoice" checked={autoDesignChoice === "ai"} onChange={() => setAutoDesignChoice("ai")} className="text-orange-500" />
                  <span className="text-sm font-medium">Let AI decide</span>
                </label>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 pt-2">Cover background image</p>
                <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50 dark:hover:bg-[#2A2A2A]">
                  <input type="radio" name="coverBackgroundPreference" checked={coverBackgroundPreference === "match_product"} onChange={() => setCoverBackgroundPreference("match_product")} className="text-orange-500" />
                  <span className="text-sm font-medium">Match my product</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">— Pexels search based on your product niche and type</span>
                </label>
                <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50 dark:hover:bg-[#2A2A2A]">
                  <input type="radio" name="coverBackgroundPreference" checked={coverBackgroundPreference === "random"} onChange={() => setCoverBackgroundPreference("random")} className="text-orange-500" />
                  <span className="text-sm font-medium">Random / Surprise me</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">— A random aesthetic background unrelated to your niche</span>
                </label>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAutoDesignChoiceDialog(false)}>Cancel</Button>
                <Button
                  onClick={async () => {
                    if (!productId) return;
                    preventAutoDesignCloseRef.current = true;
                    setAutoDesignLoading(true);
                    try {
                      await fetch("/api/brand-profile", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          preferAiColors: autoDesignChoice === "ai",
                          coverBackgroundPreference: coverBackgroundPreference === "random" ? "random" : "match_product",
                        }),
                      });
                      const res = await fetch(`/api/products/${productId}/apply-design`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          useBrandColors: autoDesignChoice === "brand",
                          coverBackgroundPreference: coverBackgroundPreference === "random" ? "random" : "match_product",
                        }),
                      });
                      if (!res.ok) throw new Error("Apply design failed");
                      await fetchProduct();
                      setAutoDesignSuccessView(true);
                      toast({ title: "Auto-design applied" });
                    } catch {
                      toast({ title: "Auto-design failed", variant: "destructive" });
                    } finally {
                      setAutoDesignLoading(false);
                      setTimeout(() => {
                        preventAutoDesignCloseRef.current = false;
                      }, 0);
                    }
                  }}
                  disabled={autoDesignLoading}
                >
                  {autoDesignLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Applying...
                    </>
                  ) : (
                    "Continue"
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <EditorToolbar
        productTitle={product.title}
        saving={saving}
        lastSaved={lastSaved}
        formatLastSaved={formatLastSaved}
        isDark={isDark}
        onAutoDesignClick={handleAutoDesignClick}
        onRegenerateDesign={handleRegenerateDesign}
        onPreview={() => setShowFullPreview(true)}
        autoDesignLoading={autoDesignLoading}
        regenerateDesignLoading={regenerateDesignLoading}
        exportLabel={exportLabel}
        showCreatedBanner={showCreatedBanner}
        onGenerateVideos={handleGenerateVideos}
        onDismissCreatedBanner={() => setShowCreatedBanner(false)}
      />

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Center content area - scrollable */}
        <div className={`flex-1 min-w-0 overflow-y-auto ${isDark ? "bg-[#0F0F0F]" : "bg-gray-100"}`}>
          <div className="flex flex-col items-center px-4 py-8">
              {/* Toolbar above canvas */}
              <div className="flex items-center justify-between w-full max-w-[816px] mb-4">
                <div className="flex items-center gap-2">
                  {(isOnCoverPage || isOnBackPage) && (
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${isDark ? "bg-orange-500/20 text-orange-300 border border-orange-500/40" : "bg-orange-100 text-orange-800 border border-orange-200"}`}>
                      {isOnCoverPage ? <Crown className="w-3.5 h-3.5" /> : <Star className="w-3.5 h-3.5" />}
                      Cover Mode
                    </span>
                  )}
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
                    <span className={`text-sm font-medium min-w-[100px] text-center flex items-center justify-center gap-1.5 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                      {currentPageIndex === 0 ? (
                        <><Crown className="w-3.5 h-3.5 shrink-0" /> Cover</>
                      ) : currentPageIndex === totalPages - 1 ? (
                        <><Star className="w-3.5 h-3.5 shrink-0" /> Back Cover</>
                      ) : (
                        <>Page {currentPageIndex + 1}</>
                      )}
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
                ref={canvasContainerRef}
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
                      data-cover-bg-url={canvasBgUrl}
                      className="absolute inset-0 overflow-hidden"
                      style={{
                        position: "absolute",
                        inset: 0,
                        zIndex: 0,
                        pointerEvents: "none",
                        backgroundImage: `url(${canvasBgUrl})`,
                        backgroundSize: "cover",
                        backgroundPosition: backgroundSettings.position ?? "center center",
                        opacity: backgroundSettings.opacity ?? 1,
                        filter:
                          (backgroundSettings.blur ?? 0) > 0
                            ? `blur(${backgroundSettings.blur}px) brightness(${backgroundSettings.brightness ?? 100}%) contrast(${backgroundSettings.contrast ?? 100}%) saturate(${backgroundSettings.saturation ?? 100}%)`
                            : `brightness(${backgroundSettings.brightness ?? 100}%) contrast(${backgroundSettings.contrast ?? 100}%) saturate(${backgroundSettings.saturation ?? 100}%)`,
                      }}
                      aria-hidden
                      ref={(el) => {
                        if (el && typeof window !== "undefined" && canvasBgUrl) {
                          console.log("[ProductEditor] Cover/canvas background URL:", canvasBgUrl);
                        }
                      }}
                    />
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
                    backgroundColor: canvasBgUrl ? "transparent" : (currentPageBackgroundColor ?? "#ffffff"),
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
                      zIndex: currentPageIndex > 0 && currentPageIndex < totalPages - 1 ? 25 : 10,
                      pointerEvents: "auto",
                      ...(canvasBgUrl ? { backgroundColor: "transparent" } : {}),
                      minHeight: CANVAS_HEIGHT,
                    }}
                    onClick={(e) => {
                      const blockEl = (e.target as HTMLElement).closest("h1, h2, h3, h4, p, li");
                      if (!blockEl) {
                        deselectText();
                      } else {
                        handleTextClick(e);
                      }
                      e.stopPropagation();
                    }}
                  >
                    {currentPageIndex === 0 || currentPageIndex === totalPages - 1 ? (
                      <div className="min-h-[var(--canvas-height,1100px)] w-full pointer-events-none" style={{ minHeight: CANVAS_HEIGHT }} aria-label={currentPageIndex === 0 ? "Cover page" : "Back cover"} />
                    ) : (
                      <>
                        <h2
                          data-section-id="__product_title"
                          data-text-type="heading"
                          contentEditable
                          suppressContentEditableWarning
                          className="text-2xl font-bold border-b pb-2 cursor-text select-text outline-none focus:outline-none"
                          style={{
                            ...(product.designSettings?.textStyles?.["__product_title"]?.title ?? {}),
                            color: currentPageTextColor ?? product.designSettings?.textStyles?.["__product_title"]?.title?.color ?? templatePreset.titleColor,
                          }}
                          onBlur={(e) => {
                            const text = e.currentTarget.textContent ?? "";
                            setProduct((p) => (p ? { ...p, title: text } : null));
                            setSelectedTextMeta((prev) => (prev && prev.sectionId === "__product_title" ? { ...prev, content: text } : prev));
                            saveToServer({ title: text });
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
                                contentEditable
                                suppressContentEditableWarning
                                className="text-lg font-semibold cursor-text select-text outline-none focus:outline-none"
                                style={{ ...titleStyles, color: currentPageTextColor ?? titleStyles?.color ?? templatePreset.headingColor }}
                                onBlur={(e) => {
                                  const text = e.currentTarget.textContent ?? "";
                                  const nextSections = sections.map((s) => (s.id === section.id ? { ...s, title: text } : s));
                                  setSections(nextSections);
                                  setSelectedTextMeta((prev) => (prev && prev.sectionId === section.id && prev.type === "title" ? { ...prev, content: text } : prev));
                                  saveToServer({ content: { sections: nextSections } });
                                }}
                              >
                                {section.title}
                              </h3>
                              {section.imageUrl?.trim() ? (
                                <img
                                  src={section.imageUrl}
                                  alt=""
                                  style={{
                                    width: "100%",
                                    maxHeight: "300px",
                                    objectFit: "cover",
                                    borderRadius: "8px",
                                    marginBottom: "16px",
                                  }}
                                />
                              ) : null}
                              <div
                                data-section-id={section.id}
                                data-text-type="body"
                                className="mt-2 prose prose-sm max-w-none prose-p:mb-4 prose-p:leading-relaxed prose-headings:mb-4 prose-headings:mt-6 prose-ul:mb-4 prose-ol:mb-4 prose-li:mb-2 cursor-text [&_.preview-content]:outline-none [&_.preview-content]:focus:outline-none"
                                style={{ ...bodyStyles, color: currentPageTextColor ?? bodyStyles?.color ?? templatePreset.bodyColor }}
                              >
                                <div
                                  ref={previewContentRef}
                                  className="preview-content min-h-[1.5em] empty:before:content-[attr(data-placeholder)] empty:before:text-[#999]"
                                  contentEditable
                                  suppressContentEditableWarning
                                  onBlur={(e) => {
                                    const html = e.currentTarget.innerHTML.trim();
                                    persistBodyHtml(section.id, html || "");
                                    lastPreviewHtmlRef.current = { sectionId: section.id, html: html || "" };
                                  }}
                                  data-placeholder="Click to add content..."
                                />
                              </div>
                            </section>
                          );
                        })}
                      </>
                    )}
                  </div>
                  {/* Placed elements layer: pointer-events auto on all pages so text boxes are selectable and the panel (same state) can update colour; click on empty space deselects. */}
                  <div
                    className="absolute inset-0 z-20"
                    style={{ pointerEvents: "auto" }}
                    onClick={(e) => {
                      const insidePlacedElement = (e.target as HTMLElement).closest("[data-placed-element]");
                      if (insidePlacedElement) {
                        e.stopPropagation();
                        return;
                      }
                      setSelectedElement(null);
                      setEditingTextBoxId(null);
                      deselectText();
                      setCoverBackHintDismissed(true);
                    }}
                    role="presentation"
                  >
                    <div className="w-full h-full relative">
                      {displayPageElements.map((element) => (
                        <CanvasPlacedElement
                          key={element.id}
                          element={element}
                          isSelected={selectedElement === element.id}
                          isEditing={editingTextBoxId === element.id}
                          graphicsAccentColor={graphicsAccentColor}
                          editingTextAreaRef={editingTextAreaRef}
                          onSelectElement={handleSelectElement}
                          onElementDragStop={updateElementPosition}
                          onElementResizeStop={updateElementSize}
                          onTextContentChange={updateTextBoxContentById}
                          onTextBlur={saveTextBoxContentById}
                          onTextEscape={cancelTextBoxEdit}
                          onStartEditTextBox={handleStartEditTextBox}
                          updateTextBoxSetting={updateTextBoxSetting}
                          deleteElement={deleteElement}
                          duplicateElement={duplicateElement}
                          bringToFront={bringToFront}
                          sendToBack={sendToBack}
                        />
                      ))}
                    </div>
                  </div>
                </div>
            </div>
          </div>
        </div>

        <EditorRightPanel isDark={isDark}>
            {isOnBackPage && (
              <BackCoverEditor
                backCoverSocialLinks={backCoverSocialLinks}
                updateBackCoverSocialLink={updateBackCoverSocialLink}
                backCoverWebsiteUrl={backCoverWebsiteUrl ?? ""}
                onWebsiteUrlChange={(v) => updateBackCoverWebsiteUrlFromInput(v)}
                onWebsiteUrlBlur={(v) => saveBackCoverWebsiteUrlToBrandProfile(v)}
                overlaySettings={overlaySettings}
                overlayColorToHex={overlayColorToHex}
                updateOverlay={updateOverlay}
                hasBackgroundImage={!!backgroundImage}
                onCopyBackgroundToFrontCover={applyBackBackgroundToCover}
                isDark={isDark}
                showSocialBlock
                showOverlayAndCopy={false}
              />
            )}
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
                        className={`w-7 h-7 rounded border-2 shrink-0 ${normalizeTextColorToHex(selectedTextMeta.styles.color ?? "") === color ? "border-orange-500" : "border-gray-200"}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <div
                    className="relative h-20 w-full overflow-hidden rounded-lg border border-gray-200"
                    style={{
                      background: `linear-gradient(to top, #000 0%, transparent 50%), linear-gradient(to right, #fff 0%, ${normalizeTextColorToHex(selectedTextMeta.styles.color ?? "#333333")} 100%)`,
                    }}
                  >
                    <input
                      type="color"
                      value={normalizeTextColorToHex(selectedTextMeta.styles.color ?? "#333333")}
                      onChange={(e) => updateTextStyle("color", e.target.value)}
                      className="absolute inset-0 h-full w-full cursor-pointer border-0 bg-transparent opacity-0"
                      title="Pick text color"
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
            {selectedTextElement && (
              <div className="p-3 border-b border-gray-200 bg-gray-50 space-y-3">
                <p className="text-xs font-medium text-gray-900">Text box — format</p>
                <div>
                  <label className="text-xs text-gray-600 font-medium block mb-1.5">Bold · Italic · Underline</label>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => updateTextBoxSetting("fontWeight", (selectedTextElement.textSettings?.fontWeight ?? DEFAULT_TEXT_BOX.fontWeight) === "700" ? "400" : "700")}
                      className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-colors ${(selectedTextElement.textSettings?.fontWeight ?? DEFAULT_TEXT_BOX.fontWeight) === "700" ? "bg-orange-500 text-white border-orange-500" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-100"}`}
                      title="Bold"
                    >
                      B
                    </button>
                    <button
                      type="button"
                      onClick={() => updateTextBoxSetting("fontStyle", (selectedTextElement.textSettings?.fontStyle ?? DEFAULT_TEXT_BOX.fontStyle) === "italic" ? "normal" : "italic")}
                      className={`flex-1 py-2 rounded-lg text-sm italic border transition-colors ${(selectedTextElement.textSettings?.fontStyle ?? DEFAULT_TEXT_BOX.fontStyle) === "italic" ? "bg-orange-500 text-white border-orange-500" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-100"}`}
                      title="Italic"
                    >
                      I
                    </button>
                    <button
                      type="button"
                      onClick={() => updateTextBoxSetting("textDecoration", (selectedTextElement.textSettings?.textDecoration ?? DEFAULT_TEXT_BOX.textDecoration) === "underline" ? "none" : "underline")}
                      className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${(selectedTextElement.textSettings?.textDecoration ?? DEFAULT_TEXT_BOX.textDecoration) === "underline" ? "bg-orange-500 text-white border-orange-500" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-100"}`}
                      style={{ textDecoration: "underline" }}
                      title="Underline"
                    >
                      U
                    </button>
                  </div>
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
                  <label className="text-xs text-gray-600 font-medium block mt-2 mb-1">Weight</label>
                  <div className="grid grid-cols-4 gap-1">
                    {[
                      { label: "Light", value: "300" },
                      { label: "Normal", value: "400" },
                      { label: "Semi", value: "600" },
                      { label: "Bold", value: "700" },
                    ].map(({ label, value }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => updateTextBoxSetting("fontWeight", value)}
                        className={`py-1.5 rounded-lg text-xs font-medium border transition-colors ${(selectedTextElement.textSettings?.fontWeight ?? DEFAULT_TEXT_BOX.fontWeight) === value ? "bg-orange-500 text-white border-orange-500" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-100"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <Tabs value={activeEditorTab} onValueChange={setActiveEditorTab} className="w-full flex flex-col flex-1 min-h-0">
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
                <BrandVoiceIndicator />
                <ReadyToSellChecklist
                  hasThumbnail={!!(marketingAssets.thumbnailUrl || marketingAssets.coverThumbnailUrl)}
                  hasBookMockup={!!marketingAssets.bookMockupUrl}
                  hasMarketingAssets={!!(marketingAssets.productTitle?.trim() && marketingAssets.productDescription?.trim())}
                  hasPromoVideo={!!(marketingAssets.promoVideoUrl && marketingAssets.promoVideoStatus === "completed")}
                  onSwitchTab={setActiveEditorTab}
                />
                <ContentPageEditor
                  isOnContentPage={currentPageIndex > 0 && currentPageIndex < totalPages - 1}
                  currentPageBackgroundColor={currentPageBackgroundColor ?? null}
                  currentPageTextColor={currentPageTextColor ?? null}
                  persistCurrentPageBackground={persistCurrentPageBackground}
                  recordUndo={recordUndo}
                  recordUndoDebounced={recordUndoDebounced}
                  sections={sections}
                  onOpenEdit={openEdit}
                  onSetSectionToDeleteId={setSectionToDeleteId}
                  onAddSection={addSection}
                  onRegenerateSectionFromTOC={handleRegenerateSectionFromTOC}
                  regeneratingSectionId={regeneratingSectionId}
                  isDark={isDark}
                />
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

                {sections.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-gray-200 space-y-3">
                    <h3 className="text-sm font-semibold text-gray-900">Text colour for all content pages</h3>
                    <p className="text-xs text-gray-500">Set the same text colour on every content page in one go. Saves time if you want everything the same.</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={applyAllPagesTextColor}
                        onChange={(e) => setApplyAllPagesTextColor(e.target.value)}
                        className="h-9 w-14 cursor-pointer rounded border border-gray-200 bg-white p-0.5"
                        aria-label="Colour for all pages"
                      />
                      <input
                        type="text"
                        value={applyAllPagesTextColor}
                        onChange={(e) => {
                          const raw = e.target.value.trim();
                          const hex = raw.startsWith("#") ? raw : raw ? `#${raw}` : "";
                          if (!hex || !/^#[0-9A-Fa-f]{6}$/.test(hex)) return;
                          setApplyAllPagesTextColor(hex);
                        }}
                        className="flex-1 min-w-0 p-2 rounded-lg border border-gray-200 text-sm font-mono text-gray-900"
                        placeholder="#1a1a1a"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => applyTextColorToAllContentPages(applyAllPagesTextColor)}
                        className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                      >
                        Apply to all content pages
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={clearTextColorFromAllContentPages}
                        className="shrink-0 border-gray-200 text-gray-600"
                      >
                        Clear from all
                      </Button>
                    </div>
                  </div>
                )}

                {isOnCoverPage && (
                  <CoverPageEditor
                    overlaySettings={overlaySettings}
                    overlayColorToHex={overlayColorToHex}
                    updateOverlay={updateOverlay}
                    hasBackgroundImage={!!backgroundImage}
                    onCopyBackgroundToBackCover={applyCoverBackgroundToBackCover}
                    isDark={isDark}
                  />
                )}
                {isOnBackPage && (
                  <BackCoverEditor
                    backCoverSocialLinks={backCoverSocialLinks}
                    updateBackCoverSocialLink={updateBackCoverSocialLink}
                    backCoverWebsiteUrl={backCoverWebsiteUrl ?? ""}
                    onWebsiteUrlChange={(v) => updateBackCoverWebsiteUrlFromInput(v)}
                    onWebsiteUrlBlur={(v) => saveBackCoverWebsiteUrlToBrandProfile(v)}
                    overlaySettings={overlaySettings}
                    overlayColorToHex={overlayColorToHex}
                    updateOverlay={updateOverlay}
                    hasBackgroundImage={!!backgroundImage}
                    onCopyBackgroundToFrontCover={applyBackBackgroundToCover}
                    isDark={isDark}
                    showSocialBlock={false}
                    showOverlayAndCopy
                  />
                )}
              </TabsContent>
              <TabsContent value="graphics" className="mt-0 p-4 space-y-6 overflow-y-auto">
                {/* Social links for back cover are shown at top of right panel when on back page (BackCoverEditor) */}
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
                <div className="flex flex-col gap-2">
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
                  {isOnCoverPage && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={applyCoverBackgroundToBackCover}
                      className="w-full border-gray-200 text-gray-600 hover:bg-gray-100"
                    >
                      Copy background to back cover
                    </Button>
                  )}
                  {isOnBackPage && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={applyBackBackgroundToCover}
                      className="w-full border-gray-200 text-gray-600 hover:bg-gray-100"
                    >
                      Copy background to front cover
                    </Button>
                  )}
                </div>

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
                      <label className="text-xs text-gray-600 font-medium block mb-1.5">Bold · Italic · Underline</label>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => updateTextBoxSetting("fontWeight", (selectedTextElement.textSettings?.fontWeight ?? DEFAULT_TEXT_BOX.fontWeight) === "700" ? "400" : "700")}
                          className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-colors ${(selectedTextElement.textSettings?.fontWeight ?? DEFAULT_TEXT_BOX.fontWeight) === "700" ? "bg-orange-500 text-white border-orange-500" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-100"}`}
                          title="Bold"
                        >
                          B
                        </button>
                        <button
                          type="button"
                          onClick={() => updateTextBoxSetting("fontStyle", (selectedTextElement.textSettings?.fontStyle ?? DEFAULT_TEXT_BOX.fontStyle) === "italic" ? "normal" : "italic")}
                          className={`flex-1 py-2 rounded-lg text-sm italic border transition-colors ${(selectedTextElement.textSettings?.fontStyle ?? DEFAULT_TEXT_BOX.fontStyle) === "italic" ? "bg-orange-500 text-white border-orange-500" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-100"}`}
                          title="Italic"
                        >
                          I
                        </button>
                        <button
                          type="button"
                          onClick={() => updateTextBoxSetting("textDecoration", (selectedTextElement.textSettings?.textDecoration ?? DEFAULT_TEXT_BOX.textDecoration) === "underline" ? "none" : "underline")}
                          className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${(selectedTextElement.textSettings?.textDecoration ?? DEFAULT_TEXT_BOX.textDecoration) === "underline" ? "bg-orange-500 text-white border-orange-500" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-100"}`}
                          style={{ textDecoration: "underline" }}
                          title="Underline"
                        >
                          U
                        </button>
                      </div>
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
                      <label className="text-xs text-gray-600 font-medium block mt-2 mb-1">Weight</label>
                      <div className="grid grid-cols-4 gap-1">
                        {[
                          { label: "Light", value: "300" },
                          { label: "Normal", value: "400" },
                          { label: "Semi", value: "600" },
                          { label: "Bold", value: "700" },
                        ].map(({ label, value }) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => updateTextBoxSetting("fontWeight", value)}
                            className={`py-1.5 rounded-lg text-xs font-medium border transition-colors ${(selectedTextElement.textSettings?.fontWeight ?? DEFAULT_TEXT_BOX.fontWeight) === value ? "bg-orange-500 text-white border-orange-500" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-100"}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 font-medium block mb-1">Color</label>
                      <div className="[&_.react-colorful]:h-20 [&_.react-colorful]:w-full [&_.react-colorful]:rounded">
                        <HexColorPicker
                          color={selectedTextElement.textSettings?.color ?? DEFAULT_TEXT_BOX.color}
                          onChange={(c) => {
                            console.log("[ProductEditor] Text colour picker onChange fired → calling updateTextBoxSetting('color', …)");
                            updateTextBoxSetting("color", c);
                          }}
                        />
                      </div>
                      <input
                        type="text"
                        value={selectedTextElement.textSettings?.color ?? DEFAULT_TEXT_BOX.color}
                        onChange={(e) => updateTextBoxSetting("color", e.target.value)}
                        className="w-full mt-2 p-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 font-mono"
                      />
                      <div className="flex flex-col gap-1.5 mt-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => applyTextColorToCurrentPage(selectedTextElement.textSettings?.color ?? DEFAULT_TEXT_BOX.color)}
                          className="w-full border-gray-200 text-gray-600 hover:bg-gray-100 text-xs"
                        >
                          Apply to this page
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => applyTextColorToAllPages(selectedTextElement.textSettings?.color ?? DEFAULT_TEXT_BOX.color)}
                          className="w-full border-gray-200 text-gray-600 hover:bg-gray-100 text-xs"
                        >
                          Apply colour to all pages
                        </Button>
                      </div>
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
                    <div>
                      <label className="text-xs text-gray-600 font-medium block mb-1">Effects</label>
                      <div className="space-y-3">
                        <div className="rounded-lg border border-gray-200 bg-white p-2.5 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-700">Text shadow</span>
                            <button
                              type="button"
                              onClick={() => updateTextBoxSetting("textShadowEnabled", !(selectedTextElement.textSettings?.textShadowEnabled ?? DEFAULT_TEXT_BOX.textShadowEnabled))}
                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-1 ${(selectedTextElement.textSettings?.textShadowEnabled ?? DEFAULT_TEXT_BOX.textShadowEnabled) ? "border-orange-500 bg-orange-500" : "border-gray-200 bg-gray-200"}`}
                            >
                              <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition-transform ${(selectedTextElement.textSettings?.textShadowEnabled ?? DEFAULT_TEXT_BOX.textShadowEnabled) ? "translate-x-4" : "translate-x-0.5"} mt-0.5`} />
                            </button>
                          </div>
                          {(selectedTextElement.textSettings?.textShadowEnabled ?? DEFAULT_TEXT_BOX.textShadowEnabled) && (
                            <div className="space-y-1.5 pt-1 border-t border-gray-100">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-500 w-6">X</span>
                                <input type="range" min="-20" max="20" value={selectedTextElement.textSettings?.textShadowOffsetX ?? DEFAULT_TEXT_BOX.textShadowOffsetX} onChange={(e) => updateTextBoxSetting("textShadowOffsetX", parseInt(e.target.value, 10))} className="flex-1 h-2 bg-gray-200 rounded-lg accent-orange-500" />
                                <span className="text-[10px] text-gray-500 w-5">{(selectedTextElement.textSettings?.textShadowOffsetX ?? DEFAULT_TEXT_BOX.textShadowOffsetX)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-500 w-6">Y</span>
                                <input type="range" min="-20" max="20" value={selectedTextElement.textSettings?.textShadowOffsetY ?? DEFAULT_TEXT_BOX.textShadowOffsetY} onChange={(e) => updateTextBoxSetting("textShadowOffsetY", parseInt(e.target.value, 10))} className="flex-1 h-2 bg-gray-200 rounded-lg accent-orange-500" />
                                <span className="text-[10px] text-gray-500 w-5">{(selectedTextElement.textSettings?.textShadowOffsetY ?? DEFAULT_TEXT_BOX.textShadowOffsetY)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-500 w-6">Blur</span>
                                <input type="range" min="0" max="24" value={selectedTextElement.textSettings?.textShadowBlur ?? DEFAULT_TEXT_BOX.textShadowBlur} onChange={(e) => updateTextBoxSetting("textShadowBlur", parseInt(e.target.value, 10))} className="flex-1 h-2 bg-gray-200 rounded-lg accent-orange-500" />
                                <span className="text-[10px] text-gray-500 w-5">{(selectedTextElement.textSettings?.textShadowBlur ?? DEFAULT_TEXT_BOX.textShadowBlur)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-500">Color</span>
                                <input type="color" value={selectedTextElement.textSettings?.textShadowColor ?? DEFAULT_TEXT_BOX.textShadowColor} onChange={(e) => updateTextBoxSetting("textShadowColor", e.target.value)} className="w-7 h-7 rounded border border-gray-200 cursor-pointer p-0" />
                                <input type="text" value={selectedTextElement.textSettings?.textShadowColor ?? DEFAULT_TEXT_BOX.textShadowColor} onChange={(e) => updateTextBoxSetting("textShadowColor", e.target.value)} className="flex-1 min-w-0 p-1.5 text-xs font-mono bg-gray-50 border border-gray-200 rounded" />
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="rounded-lg border border-gray-200 bg-white p-2.5 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-700">Text stroke / outline</span>
                            <button
                              type="button"
                              onClick={() => updateTextBoxSetting("textStrokeEnabled", !(selectedTextElement.textSettings?.textStrokeEnabled ?? DEFAULT_TEXT_BOX.textStrokeEnabled))}
                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-1 ${(selectedTextElement.textSettings?.textStrokeEnabled ?? DEFAULT_TEXT_BOX.textStrokeEnabled) ? "border-orange-500 bg-orange-500" : "border-gray-200 bg-gray-200"}`}
                            >
                              <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition-transform ${(selectedTextElement.textSettings?.textStrokeEnabled ?? DEFAULT_TEXT_BOX.textStrokeEnabled) ? "translate-x-4" : "translate-x-0.5"} mt-0.5`} />
                            </button>
                          </div>
                          {(selectedTextElement.textSettings?.textStrokeEnabled ?? DEFAULT_TEXT_BOX.textStrokeEnabled) && (
                            <div className="space-y-1.5 pt-1 border-t border-gray-100">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-500">Thickness</span>
                                <input type="range" min="1" max="12" value={selectedTextElement.textSettings?.textStrokeWidth ?? DEFAULT_TEXT_BOX.textStrokeWidth} onChange={(e) => updateTextBoxSetting("textStrokeWidth", parseInt(e.target.value, 10))} className="flex-1 h-2 bg-gray-200 rounded-lg accent-orange-500" />
                                <span className="text-[10px] text-gray-500 w-5">{(selectedTextElement.textSettings?.textStrokeWidth ?? DEFAULT_TEXT_BOX.textStrokeWidth)}px</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-500">Color</span>
                                <input type="color" value={selectedTextElement.textSettings?.textStrokeColor ?? DEFAULT_TEXT_BOX.textStrokeColor} onChange={(e) => updateTextBoxSetting("textStrokeColor", e.target.value)} className="w-7 h-7 rounded border border-gray-200 cursor-pointer p-0" />
                                <input type="text" value={selectedTextElement.textSettings?.textStrokeColor ?? DEFAULT_TEXT_BOX.textStrokeColor} onChange={(e) => updateTextBoxSetting("textStrokeColor", e.target.value)} className="flex-1 min-w-0 p-1.5 text-xs font-mono bg-gray-50 border border-gray-200 rounded" />
                              </div>
                            </div>
                          )}
                        </div>
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
                    <HexColorPicker
                      color={customColor}
                      onChange={(c) => {
                        setCustomColor(c);
                        handleApplyColor(c);
                      }}
                    />
                  </div>
                  <input
                    type="text"
                    value={customColor}
                    onChange={(e) => setCustomColor(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const v = (e.target as HTMLInputElement).value.trim();
                        const hex = v.startsWith("#") ? v : `#${v}`;
                        if (/^#[0-9A-Fa-f]{6}$/.test(hex) || /^#[0-9A-Fa-f]{3}$/.test(hex)) {
                          setCustomColor(hex);
                          handleApplyColor(hex);
                        }
                      }
                    }}
                    className="w-full mt-2 p-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 font-mono"
                  />
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
                    placeholder="Search free photos (results after 1s)..."
                    className="w-full p-2.5 mb-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400"
                    value={photoSearch}
                    onChange={(e) => handlePhotoSearchInputChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        if (photoSearchDebounceRef.current) {
                          clearTimeout(photoSearchDebounceRef.current);
                          photoSearchDebounceRef.current = null;
                        }
                        searchPhotos();
                      }
                    }}
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
                    <button
                      type="button"
                      onClick={() => {
                        if (photoSearchDebounceRef.current) {
                          clearTimeout(photoSearchDebounceRef.current);
                          photoSearchDebounceRef.current = null;
                        }
                        searchPhotos();
                      }}
                      className="px-2 py-1 bg-orange-500 hover:bg-orange-600 rounded text-xs text-white"
                    >
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
                        Search stock photos (Unsplash), generate an image with AI, or upload your own image (JPG, PNG, WEBP). The image will be added to the current page and can be moved and resized on the canvas.
                      </DialogDescription>
                    </DialogHeader>
                    <Tabs value={addImageTab} onValueChange={(v) => setAddImageTab(v as "stock" | "ai" | "upload")} className="flex-1 min-h-0 flex flex-col">
                      <TabsList className="grid w-full grid-cols-3 mb-4">
                        <TabsTrigger value="stock">Search stock (Unsplash)</TabsTrigger>
                        <TabsTrigger value="ai">Generate AI image</TabsTrigger>
                        <TabsTrigger value="upload">Upload file</TabsTrigger>
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
                      <TabsContent value="upload" className="mt-0 flex-1 min-h-0 flex flex-col">
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                          Choose a JPG, PNG, or WEBP image from your device. It will be placed on the canvas like other images.
                        </p>
                        <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-orange-500 dark:hover:border-orange-500 transition-colors cursor-pointer py-10 px-6">
                          <Upload className="w-10 h-10 text-gray-400 dark:text-gray-500" />
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Click to upload or drag and drop</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">JPG, PNG or WEBP</span>
                          <input
                            type="file"
                            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const reader = new FileReader();
                              reader.onload = () => {
                                const dataUrl = reader.result;
                                if (typeof dataUrl === "string") {
                                  addImageToCanvasAndClose(dataUrl);
                                }
                              };
                              reader.readAsDataURL(file);
                              e.target.value = "";
                            }}
                          />
                        </label>
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
                <div className="pt-2 border-t border-gray-200">
                  <AvatarVideoPanel
                    productId={productId}
                    productTitle={product?.title ?? "Digital Product"}
                    existingVideoUrl={marketingAssets.promoVideoUrl}
                    existingVideoStatus={marketingAssets.promoVideoStatus}
                    existingVideoId={marketingAssets.promoVideoId}
                    onVideoReady={(url) => {
                      setProduct((p) => p ? { ...p, marketingAssets: { ...p.marketingAssets, promoVideoUrl: url, promoVideoStatus: "completed" } } : null);
                    }}
                  />
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
                <NextStepPrompt
                  emoji="🎬"
                  title="Turn this into a promo video"
                  description="Generate an AI avatar video that sells this product — ready for TikTok, Reels, or YouTube Shorts."
                  actionLabel="Create avatar video"
                  onAction={() => setActiveEditorTab("videos")}
                />
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
                    <div className="space-y-2 pt-2 border-t border-gray-100">
                      <ThumbnailVariantPicker
                        productId={productId}
                        onSelect={(url, style) => {
                          setProduct((p) => p ? { ...p, marketingAssets: { ...p.marketingAssets, thumbnailUrl: url, thumbnailStyle: style as ThumbnailTemplateId } } : null);
                          saveToServer({ marketingAssets: { ...marketingAssets, thumbnailUrl: url, thumbnailStyle: style as ThumbnailTemplateId } });
                        }}
                      />
                    </div>
                    <div className="space-y-2 pt-2 border-t border-gray-100">
                      <BookMockupPanel
                        productId={productId}
                        existingMockupUrl={marketingAssets.bookMockupUrl}
                        onMockupGenerated={(url) => {
                          setProduct((p) => p ? { ...p, marketingAssets: { ...p.marketingAssets, bookMockupUrl: url } } : null);
                        }}
                      />
                    </div>

                    {/* Sales page cover image upload */}
                    <div className="space-y-2 pt-2 border-t border-gray-100">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <Label className="text-xs font-medium text-gray-700">Sales page cover image</Label>
                          <p className="text-xs text-gray-400 mt-0.5">Shown at the top of your public product page &amp; store</p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5 shrink-0 border-gray-200 text-xs"
                          onClick={() => coverImageInputRef.current?.click()}
                        >
                          <Upload className="w-3.5 h-3.5" />
                          Upload image
                        </Button>
                        <input
                          ref={coverImageInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleCoverImageUpload(f);
                            e.target.value = "";
                          }}
                        />
                      </div>
                      {marketingAssets.coverThumbnailUrl ? (
                        <div className="relative rounded-lg overflow-hidden border border-gray-200">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={marketingAssets.coverThumbnailUrl} alt="Cover" className="w-full object-cover max-h-48" />
                          <button
                            type="button"
                            onClick={() => saveMarketingEdits({ coverThumbnailUrl: null })}
                            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors text-xs"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div
                          className="rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-6 text-center cursor-pointer hover:border-orange-300 hover:bg-orange-50 transition-colors"
                          onClick={() => coverImageInputRef.current?.click()}
                        >
                          <ImageIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                          <p className="text-xs text-gray-400">Click to upload a cover image</p>
                          <p className="text-xs text-gray-300 mt-0.5">JPG, PNG, WEBP · max 5MB</p>
                        </div>
                      )}
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
                    <SellItNowPanel productId={productId} />
                    <PricingCard productId={productId} />
                    <RevenueTracker productId={productId} />
                    <SocialCaptionsCard productId={productId} productTitle={product?.title ?? "Digital Product"} />
                    <EmailSequenceCard productId={productId} />
                    <SalesPageCard productId={productId} initialCheckoutUrl={(marketingAssets as { checkoutUrl?: string | null; priceLabel?: string | null }).checkoutUrl} initialPriceLabel={(marketingAssets as { checkoutUrl?: string | null; priceLabel?: string | null }).priceLabel} />

                    {/* Testimonials */}
                    {(() => {
                      const testimonials: Array<{ name: string; text: string; rating?: number }> = marketingAssets.testimonials ?? [];
                      const saveTestimonials = async (updated: typeof testimonials) => {
                        if (!productId) return;
                        await fetch(`/api/products/${productId}/testimonials`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ testimonials: updated }) });
                        setProduct((p) => p ? { ...p, marketingAssets: { ...p.marketingAssets, testimonials: updated } } : null);
                      };
                      return (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <Label className="text-xs font-medium text-gray-700">Customer testimonials</Label>
                            <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1"
                              onClick={() => saveTestimonials([...testimonials, { name: "", text: "", rating: 5 }])}>
                              <Plus className="w-3 h-3" /> Add
                            </Button>
                          </div>
                          {testimonials.length === 0 && (
                            <p className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3 text-center">No testimonials yet. Add a few customer quotes to boost conversions on your product page.</p>
                          )}
                          {testimonials.map((t, i) => (
                            <div key={i} className="rounded-lg border border-gray-200 p-3 space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <Input value={t.name} onChange={(e) => { const u = [...testimonials]; u[i] = { ...u[i], name: e.target.value }; setProduct((p) => p ? { ...p, marketingAssets: { ...p.marketingAssets, testimonials: u } } : null); }} onBlur={() => saveTestimonials(testimonials)} placeholder="Customer name" className="text-xs h-7 flex-1" />
                                <select value={t.rating ?? 5} onChange={async (e) => { const u = [...testimonials]; u[i] = { ...u[i], rating: parseInt(e.target.value) }; await saveTestimonials(u); }} className="h-7 text-xs border border-gray-200 rounded px-1">
                                  {[5,4,3,2,1].map((r) => <option key={r} value={r}>{"★".repeat(r)}</option>)}
                                </select>
                                <button type="button" onClick={() => saveTestimonials(testimonials.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500 transition-colors">
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                              <Textarea value={t.text} onChange={(e) => { const u = [...testimonials]; u[i] = { ...u[i], text: e.target.value }; setProduct((p) => p ? { ...p, marketingAssets: { ...p.marketingAssets, testimonials: u } } : null); }} onBlur={() => saveTestimonials(testimonials)} placeholder="What did they say about your product?" rows={2} className="text-xs resize-none" />
                            </div>
                          ))}
                        </div>
                      );
                    })()}

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
                {marketingAssets.productTitle && (
                  <NextStepPrompt
                    emoji="🎬"
                    title="Now make a promo video"
                    description="Your listing copy is ready. Create an AI avatar video to promote this product on social media."
                    actionLabel="Generate avatar video"
                    onAction={() => setActiveEditorTab("videos")}
                    secondaryLabel="Maybe later"
                    dismissible={true}
                  />
                )}
              </TabsContent>
              </div>
            </Tabs>
        </EditorRightPanel>
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
                className="border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10"
                onClick={() => handleImproveSection(editingSectionId)}
                disabled={isRegenerating}
              >
                <Sparkles className="w-4 h-4" />
                <span className="ml-1.5">Improve</span>
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
                            <img src={element.content} alt="" crossOrigin="anonymous" className="w-full h-full object-cover" style={{ opacity: element.imageSettings?.opacity ?? 1, filter: `blur(${element.imageSettings?.blur ?? 0}px) brightness(${element.imageSettings?.brightness ?? 100}%) contrast(${element.imageSettings?.contrast ?? 100}%) saturate(${element.imageSettings?.saturation ?? 100}%)` }} />
                          ) : element.type === "social" ? (
                            element.linkUrl ? (
                              <a href={element.linkUrl} target="_blank" rel="noopener noreferrer" className="w-full h-full flex items-center justify-center" style={{ color: iconColor }}>
                                <SocialIconSvg platform={element.content} style={{ color: iconColor }} />
                              </a>
                            ) : (
                              <span className="w-full h-full flex items-center justify-center" style={{ color: iconColor }}>
                                <SocialIconSvg platform={element.content} style={{ color: iconColor }} />
                              </span>
                            )
                          ) : element.type === "text" ? (
                            (element.id === "back-url" && /^https?:\/\//i.test((element.content || "").trim()) ? (
                              <div className="w-full h-full overflow-auto p-1 flex items-center" style={{ fontSize: element.textSettings?.fontSize ?? DEFAULT_TEXT_BOX.fontSize, fontFamily: element.textSettings?.fontFamily ?? DEFAULT_TEXT_BOX.fontFamily, color: "#2563eb", textAlign: element.textSettings?.textAlign ?? DEFAULT_TEXT_BOX.textAlign, wordBreak: "break-word", textDecoration: "underline" }} data-website-link={(element.content || "").trim()}>{element.content || ""}</div>
                            ) : (
                              <div className="w-full h-full overflow-auto p-1 flex items-center" style={{ fontSize: element.textSettings?.fontSize ?? DEFAULT_TEXT_BOX.fontSize, fontFamily: element.textSettings?.fontFamily ?? DEFAULT_TEXT_BOX.fontFamily, color: element.textSettings?.color ?? DEFAULT_TEXT_BOX.color, textAlign: element.textSettings?.textAlign ?? DEFAULT_TEXT_BOX.textAlign, wordBreak: "break-word", textShadow: (element.textSettings?.textShadowEnabled ?? DEFAULT_TEXT_BOX.textShadowEnabled) ? `${element.textSettings?.textShadowOffsetX ?? DEFAULT_TEXT_BOX.textShadowOffsetX}px ${element.textSettings?.textShadowOffsetY ?? DEFAULT_TEXT_BOX.textShadowOffsetY}px ${element.textSettings?.textShadowBlur ?? DEFAULT_TEXT_BOX.textShadowBlur}px ${element.textSettings?.textShadowColor ?? DEFAULT_TEXT_BOX.textShadowColor}` : "none", WebKitTextStroke: (element.textSettings?.textStrokeEnabled ?? DEFAULT_TEXT_BOX.textStrokeEnabled) ? `${element.textSettings?.textStrokeWidth ?? DEFAULT_TEXT_BOX.textStrokeWidth}px ${element.textSettings?.textStrokeColor ?? DEFAULT_TEXT_BOX.textStrokeColor}` : "none" }}>{element.content || ""}</div>
                            ))
                          ) : <span className="text-[#999] text-xs">?</span>}
                        </div>
                      );
                    });
                  }

                  return pages.map((page, pageIdx) => {
                    if (page.type === "cover") {
                      const coverPageBg = pageBackgrounds[0];
                      const coverBgUrl = getProxiedBackgroundImageUrl(coverPageBg?.backgroundImage ?? null) ?? null;
                      if (typeof window !== "undefined" && coverBgUrl && process.env.NODE_ENV !== "production") {
                        console.log("[ProductEditor] Multi-page strip cover background URL:", coverBgUrl.slice(0, 120));
                      }
                      const coverBgSettings = coverPageBg?.backgroundSettings ? { ...DEFAULT_IMAGE_SETTINGS, ...coverPageBg.backgroundSettings } : DEFAULT_IMAGE_SETTINGS;
                      const coverOverlay = coverPageBg?.overlaySettings ? { ...DEFAULT_OVERLAY, ...coverPageBg.overlaySettings } : DEFAULT_OVERLAY;
                      return (
                        <div
                          key="cover"
                          id="preview-page-0"
                          data-pdf-page
                          data-page
                          data-page-type="cover"
                          data-cover-bg-url={coverBgUrl ?? undefined}
                          className="preview-page product-page relative shrink-0 rounded-lg overflow-hidden border border-gray-200 bg-white shadow-lg"
                          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, minHeight: CANVAS_HEIGHT, pageBreakAfter: "always", pageBreakInside: "avoid" }}
                        >
                          {coverBgUrl ? (
                            <>
                              <div
                                className="absolute inset-0 z-0 overflow-hidden pointer-events-none"
                                aria-hidden
                                style={{
                                  backgroundImage: `url(${coverBgUrl})`,
                                  backgroundSize: (coverBgSettings.fit ?? "cover") as React.CSSProperties["backgroundSize"],
                                  backgroundPosition: coverBgSettings.position ?? "center center",
                                  opacity: coverBgSettings.opacity ?? 1,
                                  filter: (coverBgSettings.blur ?? 0) > 0 ? `blur(${coverBgSettings.blur}px) brightness(${coverBgSettings.brightness ?? 100}%) contrast(${coverBgSettings.contrast ?? 100}%) saturate(${coverBgSettings.saturation ?? 100}%)` : `brightness(${coverBgSettings.brightness ?? 100}%) contrast(${coverBgSettings.contrast ?? 100}%) saturate(${coverBgSettings.saturation ?? 100}%)`,
                                }}
                              />
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
                      const backBgUrl = getProxiedBackgroundImageUrl(backPageBg?.backgroundImage ?? null) ?? null;
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
                              <div
                                className="absolute inset-0 z-0 overflow-hidden pointer-events-none"
                                aria-hidden
                                style={{
                                  backgroundImage: `url(${backBgUrl})`,
                                  backgroundSize: (backBgSettings.fit ?? "cover") as React.CSSProperties["backgroundSize"],
                                  backgroundPosition: backBgSettings.position ?? "center center",
                                  opacity: backBgSettings.opacity ?? 1,
                                }}
                              />
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
                    const bgUrl = getProxiedBackgroundImageUrl(pageBg?.backgroundImage ?? null) ?? null;
                    const bgSettings = pageBg?.backgroundSettings ? { ...DEFAULT_IMAGE_SETTINGS, ...pageBg.backgroundSettings } : DEFAULT_IMAGE_SETTINGS;
                    const overlay = pageBg?.overlaySettings ? { ...DEFAULT_OVERLAY, ...pageBg.overlaySettings } : DEFAULT_OVERLAY;
                    const titleStyles = product.designSettings?.textStyles?.[section.id]?.title;
                    const bodyStyles = product.designSettings?.textStyles?.[section.id]?.body;
                    const pageTextColor = pageBg?.pageTextColor ?? null;
                    return (
                      <div
                        key={section.id}
                        id={`preview-page-${pageIdx}`}
                        data-pdf-page
                        data-page
                        className="preview-page product-page relative shrink-0 rounded-lg overflow-hidden border border-gray-200 shadow-lg"
                        style={{
                          width: CANVAS_WIDTH,
                          minHeight: CANVAS_HEIGHT,
                          pageBreakAfter: "always",
                          pageBreakInside: "avoid",
                          backgroundColor: bgUrl ? undefined : (pageBg?.backgroundColor ?? "#ffffff"),
                        }}
                      >
                        {bgUrl ? (
                          <>
                            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden>
                              <img
                                src={bgUrl}
                                alt=""
                                crossOrigin="anonymous"
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
                          <h2 className="text-2xl font-bold border-b pb-2" style={{ color: pageTextColor ?? templatePreset.titleColor }}>{product.title}</h2>
                          <section>
                            <h3 className="text-lg font-semibold" style={{ ...titleStyles, color: pageTextColor ?? titleStyles?.color ?? templatePreset.headingColor }}>{section.title}</h3>
                            {section.imageUrl?.trim() ? (
                              <img
                                src={section.imageUrl}
                                alt=""
                                crossOrigin="anonymous"
                                style={{
                                  width: "100%",
                                  maxHeight: "300px",
                                  objectFit: "cover",
                                  borderRadius: "8px",
                                  marginBottom: "16px",
                                }}
                              />
                            ) : null}
                            <div className="mt-2 prose prose-sm max-w-none prose-p:mb-4 prose-p:leading-relaxed prose-headings:mb-4 prose-headings:mt-6 prose-ul:mb-4 prose-ol:mb-4 prose-li:mb-2" style={{ ...bodyStyles, color: pageTextColor ?? bodyStyles?.color ?? templatePreset.bodyColor }}>
                              {section.content || section.contentHtml ? (
                                <div className="preview-content" dangerouslySetInnerHTML={{ __html: sanitizeHtml(section.contentHtml ?? cleanMarkdownToHtml(section.content ?? "")) }} />
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
