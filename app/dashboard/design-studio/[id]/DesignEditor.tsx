"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft, Type, ImageIcon, Square, Trash2, Copy, Loader2, Check,
  Download, Bold, Italic, AlignLeft, AlignCenter, AlignRight, Minus, Plus,
  ChevronDown, FlipHorizontal, FlipVertical, RotateCw, Sparkles,
  AlignHorizontalJustifyCenter, AlignVerticalJustifyCenter,
  MoveLeft, MoveRight, MoveUp, MoveDown, Undo2, Redo2,
  Underline, Strikethrough, ZoomIn, ZoomOut, FileDown, Highlighter,
  LayoutTemplate, Images, Layers, X, Settings2, Palette,
  Grid3x3, Smartphone, Lock, Unlock, ArrowUp, ArrowDown, MessageSquare, Send, Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useDashboardTheme } from "@/components/dashboard-theme-provider";
import { useToast } from "@/components/ui/use-toast";
import { DesignData, DesignElement } from "@/db/schema/designs-schema";
import { getProxiedBackgroundImageUrl } from "@/lib/proxy-image-url";

// ── Shape library ──────────────────────────────────────────────────────────

type ShapeDef = { id: string; label: string; render: (fill: string, stroke?: string, sw?: number) => React.ReactNode };

const SHAPES: ShapeDef[] = [
  { id: "rect", label: "Rectangle", render: (f, s, sw) => <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}><rect x={sw ? sw / 2 : 0} y={sw ? sw / 2 : 0} width={100 - (sw ?? 0)} height={100 - (sw ?? 0)} fill={f} stroke={s ?? "none"} strokeWidth={sw ?? 0} rx="4" /></svg> },
  { id: "circle", label: "Circle", render: (f, s, sw) => <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}><ellipse cx="50" cy="50" rx={50 - (sw ?? 0) / 2} ry={50 - (sw ?? 0) / 2} fill={f} stroke={s ?? "none"} strokeWidth={sw ?? 0} /></svg> },
  { id: "triangle", label: "Triangle ▲", render: (f, s, sw) => <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}><polygon points="50,2 98,98 2,98" fill={f} stroke={s ?? "none"} strokeWidth={sw ?? 0} /></svg> },
  { id: "triangle-down", label: "Triangle ▼", render: (f, s, sw) => <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}><polygon points="2,2 98,2 50,98" fill={f} stroke={s ?? "none"} strokeWidth={sw ?? 0} /></svg> },
  { id: "diamond", label: "Diamond", render: (f, s, sw) => <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}><polygon points="50,2 98,50 50,98 2,50" fill={f} stroke={s ?? "none"} strokeWidth={sw ?? 0} /></svg> },
  { id: "star", label: "Star ★", render: (f, s, sw) => <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}><polygon points="50,2 61,35 96,35 68,57 79,91 50,70 21,91 32,57 4,35 39,35" fill={f} stroke={s ?? "none"} strokeWidth={sw ?? 0} /></svg> },
  { id: "heart", label: "Heart ♥", render: (f, s, sw) => <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}><path d="M50,85 C10,62 0,47 0,32 C0,16 12,5 25,5 C35,5 44,12 50,22 C56,12 65,5 75,5 C88,5 100,16 100,32 C100,47 90,62 50,85 Z" fill={f} stroke={s ?? "none"} strokeWidth={sw ?? 0} /></svg> },
  { id: "pentagon", label: "Pentagon", render: (f, s, sw) => <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}><polygon points="50,2 97,35 79,91 21,91 3,35" fill={f} stroke={s ?? "none"} strokeWidth={sw ?? 0} /></svg> },
  { id: "hexagon", label: "Hexagon", render: (f, s, sw) => <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}><polygon points="50,2 93,26 93,74 50,98 7,74 7,26" fill={f} stroke={s ?? "none"} strokeWidth={sw ?? 0} /></svg> },
  { id: "octagon", label: "Octagon", render: (f, s, sw) => <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}><polygon points="30,2 70,2 98,30 98,70 70,98 30,98 2,70 2,30" fill={f} stroke={s ?? "none"} strokeWidth={sw ?? 0} /></svg> },
  { id: "cross", label: "Plus +", render: (f, s, sw) => <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}><path d="M35,0 H65 V35 H100 V65 H65 V100 H35 V65 H0 V35 H35 Z" fill={f} stroke={s ?? "none"} strokeWidth={sw ?? 0} /></svg> },
  { id: "arrow-right", label: "Arrow →", render: (f, s, sw) => <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}><polygon points="0,32 62,32 62,12 100,50 62,88 62,68 0,68" fill={f} stroke={s ?? "none"} strokeWidth={sw ?? 0} /></svg> },
  { id: "arrow-left", label: "Arrow ←", render: (f, s, sw) => <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}><polygon points="100,32 38,32 38,12 0,50 38,88 38,68 100,68" fill={f} stroke={s ?? "none"} strokeWidth={sw ?? 0} /></svg> },
  { id: "arrow-double", label: "Arrow ↔", render: (f, s, sw) => <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}><polygon points="0,50 22,22 22,38 78,38 78,22 100,50 78,78 78,62 22,62 22,78" fill={f} stroke={s ?? "none"} strokeWidth={sw ?? 0} /></svg> },
  { id: "chevron", label: "Chevron", render: (f, s, sw) => <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}><polygon points="0,0 70,0 100,50 70,100 0,100 30,50" fill={f} stroke={s ?? "none"} strokeWidth={sw ?? 0} /></svg> },
  { id: "parallelogram", label: "Parallelogram", render: (f, s, sw) => <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}><polygon points="20,2 100,2 80,98 0,98" fill={f} stroke={s ?? "none"} strokeWidth={sw ?? 0} /></svg> },
  { id: "trapezoid", label: "Trapezoid", render: (f, s, sw) => <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}><polygon points="15,2 85,2 100,98 0,98" fill={f} stroke={s ?? "none"} strokeWidth={sw ?? 0} /></svg> },
  { id: "speech-bubble", label: "Speech Bubble", render: (f, s, sw) => <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}><path d="M5,2 Q2,2 2,5 L2,65 Q2,68 5,68 L30,68 L20,90 L55,68 L95,68 Q98,68 98,65 L98,5 Q98,2 95,2 Z" fill={f} stroke={s ?? "none"} strokeWidth={sw ?? 0} /></svg> },
  { id: "star4", label: "Star 4pt", render: (f, s, sw) => <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}><polygon points="50,0 58,42 100,50 58,58 50,100 42,58 0,50 42,42" fill={f} stroke={s ?? "none"} strokeWidth={sw ?? 0} /></svg> },
  { id: "crescent", label: "Crescent", render: (f, s, sw) => <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}><path d="M70,5 A45,45 0 1,0 70,95 A30,30 0 1,1 70,5 Z" fill={f} stroke={s ?? "none"} strokeWidth={sw ?? 0} /></svg> },
  { id: "line-h", label: "Line —", render: (f) => <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}><line x1="0" y1="50" x2="100" y2="50" stroke={f} strokeWidth={8} strokeLinecap="round" /></svg> },
];

// ── Constants ──────────────────────────────────────────────────────────────

const FONT_FAMILIES = [
  "Inter", "Georgia", "Playfair Display", "Oswald", "Pacifico",
  "Roboto Mono", "Dancing Script", "Arial", "Times New Roman", "Impact",
];

const QUICK_COLORS = [
  "#ffffff", "#000000", "#f97316", "#3b82f6", "#22c55e",
  "#ef4444", "#a855f7", "#eab308", "#ec4899", "#14b8a6",
  "#f1f5f9", "#1e293b", "#fef3c7", "#dbeafe", "#dcfce7",
  "#fda4af", "#86efac", "#93c5fd", "#d8b4fe", "#fde68a",
];

function uid() { return Math.random().toString(36).slice(2, 10); }
function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }

// ── Alignment snapping ─────────────────────────────────────────────────────
type SnapGuide = { axis: "h" | "v"; pos: number };

const SNAP_THRESHOLD = 8; // canvas-space pixels

function snapElement(
  x: number, y: number, w: number, h: number,
  canvasW: number, canvasH: number,
  others: { x: number; y: number; width: number; height: number }[],
): { x: number; y: number; guides: SnapGuide[] } {
  const vTargets = [0, canvasW / 2, canvasW, ...others.flatMap((e) => [e.x, e.x + e.width / 2, e.x + e.width])];
  const hTargets = [0, canvasH / 2, canvasH, ...others.flatMap((e) => [e.y, e.y + e.height / 2, e.y + e.height])];
  const elXPts = [{ pt: x, off: 0 }, { pt: x + w / 2, off: w / 2 }, { pt: x + w, off: w }];
  const elYPts = [{ pt: y, off: 0 }, { pt: y + h / 2, off: h / 2 }, { pt: y + h, off: h }];
  let snappedX = x, snappedY = y;
  const guides: SnapGuide[] = [];
  let bestX = SNAP_THRESHOLD + 1, snapXT: number | null = null, snapXOff = 0;
  for (const { pt, off } of elXPts) {
    for (const t of vTargets) {
      const d = Math.abs(pt - t);
      if (d < bestX) { bestX = d; snapXT = t; snapXOff = off; }
    }
  }
  if (snapXT !== null && bestX <= SNAP_THRESHOLD) { snappedX = snapXT - snapXOff; guides.push({ axis: "v", pos: snapXT }); }
  let bestY = SNAP_THRESHOLD + 1, snapYT: number | null = null, snapYOff = 0;
  for (const { pt, off } of elYPts) {
    for (const t of hTargets) {
      const d = Math.abs(pt - t);
      if (d < bestY) { bestY = d; snapYT = t; snapYOff = off; }
    }
  }
  if (snapYT !== null && bestY <= SNAP_THRESHOLD) { snappedY = snapYT - snapYOff; guides.push({ axis: "h", pos: snapYT }); }
  return { x: snappedX, y: snappedY, guides };
}
function hexToRgba(hex: string, opacity: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${opacity})`;
}
function buildBg(data: DesignData): string {
  if (data.backgroundType === "gradient" && data.backgroundGradient) {
    const { color1, color2, angle } = data.backgroundGradient;
    return `linear-gradient(${angle}deg, ${color1}, ${color2})`;
  }
  return data.background;
}

type PaletteDef = {
  id: string; name: string; colors: string[];
  bg: string; bgType: "solid" | "gradient";
  bgGradient?: { color1: string; color2: string; angle: number };
  headingFont: string; bodyFont: string;
  headingColor: string; bodyColor: string; accentColor: string;
};
const PALETTE_CATEGORIES: { id: string; label: string; palettes: PaletteDef[] }[] = [
  {
    id: "warm", label: "Warm",
    palettes: [
      { id: "sunset", name: "Sunset", colors: ["#FF6B35", "#F7C59F", "#FFE66D", "#FF9F1C", "#FFBF69"], bg: "#FF6B35", bgType: "gradient", bgGradient: { color1: "#FF6B35", color2: "#FFE66D", angle: 135 }, headingFont: "Oswald", bodyFont: "Inter", headingColor: "#ffffff", bodyColor: "rgba(255,255,255,0.85)", accentColor: "#FFE66D" },
      { id: "autumn", name: "Autumn", colors: ["#D62828", "#F77F00", "#FCBF49", "#EAE2B7", "#A4303F"], bg: "#1a0800", bgType: "gradient", bgGradient: { color1: "#1a0800", color2: "#7c2d12", angle: 160 }, headingFont: "Impact", bodyFont: "Georgia", headingColor: "#FCBF49", bodyColor: "#EAE2B7", accentColor: "#F77F00" },
      { id: "terra", name: "Terra Cotta", colors: ["#E07A5F", "#F2CC8F", "#F4F1DE", "#81B29A", "#3D405B"], bg: "#fdf8f0", bgType: "solid", headingFont: "Playfair Display", bodyFont: "Georgia", headingColor: "#3D405B", bodyColor: "#6b4c3b", accentColor: "#E07A5F" },
      { id: "coral", name: "Coral", colors: ["#FF6B6B", "#FFEAA7", "#DDA0DD", "#98FB98", "#FFA07A"], bg: "#fff5f0", bgType: "solid", headingFont: "Pacifico", bodyFont: "Inter", headingColor: "#FF6B6B", bodyColor: "#666666", accentColor: "#FFA07A" },
    ],
  },
  {
    id: "cool", label: "Cool",
    palettes: [
      { id: "ocean", name: "Ocean", colors: ["#03045E", "#0077B6", "#00B4D8", "#90E0EF", "#CAF0F8"], bg: "#03045E", bgType: "gradient", bgGradient: { color1: "#03045E", color2: "#0077B6", angle: 160 }, headingFont: "Oswald", bodyFont: "Inter", headingColor: "#CAF0F8", bodyColor: "#90E0EF", accentColor: "#00B4D8" },
      { id: "arctic", name: "Arctic", colors: ["#E0FBFC", "#98C1D9", "#3D5A80", "#293241", "#EE6C4D"], bg: "#E0FBFC", bgType: "solid", headingFont: "Inter", bodyFont: "Inter", headingColor: "#293241", bodyColor: "#3D5A80", accentColor: "#EE6C4D" },
      { id: "lavender", name: "Lavender", colors: ["#7400B8", "#6930C3", "#5E60CE", "#5390D9", "#4EA8DE"], bg: "#1a0033", bgType: "gradient", bgGradient: { color1: "#1a0033", color2: "#4c1d95", angle: 135 }, headingFont: "Playfair Display", bodyFont: "Inter", headingColor: "#C4B5FD", bodyColor: "#A78BFA", accentColor: "#7C3AED" },
      { id: "mint", name: "Mint", colors: ["#264653", "#2A9D8F", "#E9C46A", "#F4A261", "#E76F51"], bg: "#F0FDF4", bgType: "solid", headingFont: "Oswald", bodyFont: "Georgia", headingColor: "#264653", bodyColor: "#2A9D8F", accentColor: "#E9C46A" },
    ],
  },
  {
    id: "seasonal", label: "Seasonal",
    palettes: [
      { id: "spring", name: "Spring", colors: ["#F72585", "#FF9AA2", "#FDFD96", "#B5EAD7", "#C7CEEA"], bg: "#fff0f7", bgType: "solid", headingFont: "Pacifico", bodyFont: "Inter", headingColor: "#F72585", bodyColor: "#7C3AED", accentColor: "#FF9AA2" },
      { id: "summer", name: "Summer", colors: ["#FFBE0B", "#FB5607", "#FF006E", "#8338EC", "#3A86FF"], bg: "#0f0025", bgType: "gradient", bgGradient: { color1: "#0f0025", color2: "#1a0050", angle: 135 }, headingFont: "Impact", bodyFont: "Inter", headingColor: "#FFBE0B", bodyColor: "#FF006E", accentColor: "#3A86FF" },
      { id: "fall", name: "Fall", colors: ["#6D4C3D", "#AE4E33", "#E8871A", "#F4C244", "#F4E9CD"], bg: "#fdf8f0", bgType: "solid", headingFont: "Georgia", bodyFont: "Georgia", headingColor: "#6D4C3D", bodyColor: "#AE4E33", accentColor: "#E8871A" },
      { id: "winter", name: "Winter", colors: ["#22223B", "#4A4E69", "#9A8C98", "#C9ADA7", "#F2E9E4"], bg: "#22223B", bgType: "gradient", bgGradient: { color1: "#22223B", color2: "#4A4E69", angle: 160 }, headingFont: "Inter", bodyFont: "Inter", headingColor: "#F2E9E4", bodyColor: "#C9ADA7", accentColor: "#9A8C98" },
    ],
  },
  {
    id: "pastel", label: "Pastel",
    palettes: [
      { id: "candy", name: "Candy", colors: ["#FFB5E8", "#FF9CEE", "#FFC8A2", "#D4F0F0", "#B5EAD7"], bg: "#fff0fa", bgType: "solid", headingFont: "Pacifico", bodyFont: "Inter", headingColor: "#d63384", bodyColor: "#6f42c1", accentColor: "#FFB5E8" },
      { id: "dreamy", name: "Dreamy", colors: ["#E8D5F5", "#D0E8F2", "#FAEFD4", "#F5E6E8", "#D5F5E3"], bg: "#f5f0ff", bgType: "solid", headingFont: "Playfair Display", bodyFont: "Inter", headingColor: "#6B21A8", bodyColor: "#7C3AED", accentColor: "#E8D5F5" },
      { id: "cotton", name: "Cotton", colors: ["#FCE4EC", "#F8BBD9", "#E1BEE7", "#D1C4E9", "#C5CAE9"], bg: "#eff6ff", bgType: "solid", headingFont: "Inter", bodyFont: "Inter", headingColor: "#312E81", bodyColor: "#4338CA", accentColor: "#D1C4E9" },
      { id: "peach", name: "Peach", colors: ["#FFD7BA", "#FEC89A", "#FFB347", "#FFDAB9", "#F4A460"], bg: "#fff7ed", bgType: "solid", headingFont: "Playfair Display", bodyFont: "Georgia", headingColor: "#92400E", bodyColor: "#B45309", accentColor: "#FEC89A" },
    ],
  },
  {
    id: "bold", label: "Bold",
    palettes: [
      { id: "neon", name: "Neon", colors: ["#FF0090", "#00F5FF", "#B4FF39", "#FF6A00", "#7B00FF"], bg: "#000000", bgType: "solid", headingFont: "Impact", bodyFont: "Roboto Mono", headingColor: "#B4FF39", bodyColor: "#00F5FF", accentColor: "#FF0090" },
      { id: "primary", name: "Primary", colors: ["#FF0000", "#0000FF", "#FFFF00", "#009900", "#FF6600"], bg: "#1a1a1a", bgType: "solid", headingFont: "Impact", bodyFont: "Inter", headingColor: "#FFFF00", bodyColor: "#ffffff", accentColor: "#FF0000" },
      { id: "electric", name: "Electric", colors: ["#FF3CAC", "#784BA0", "#2B86C5", "#00F2FE", "#4FACFE"], bg: "#0f0028", bgType: "gradient", bgGradient: { color1: "#0f0028", color2: "#1e005a", angle: 135 }, headingFont: "Impact", bodyFont: "Inter", headingColor: "#FF3CAC", bodyColor: "#4FACFE", accentColor: "#784BA0" },
      { id: "vivid", name: "Vivid", colors: ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7"], bg: "#FF6B6B", bgType: "solid", headingFont: "Impact", bodyFont: "Inter", headingColor: "#ffffff", bodyColor: "#1a1a1a", accentColor: "#4ECDC4" },
    ],
  },
  {
    id: "earthy", label: "Earthy",
    palettes: [
      { id: "natural", name: "Natural", colors: ["#606C38", "#283618", "#FEFAE0", "#DDA15E", "#BC6C25"], bg: "#FEFAE0", bgType: "solid", headingFont: "Playfair Display", bodyFont: "Georgia", headingColor: "#283618", bodyColor: "#606C38", accentColor: "#DDA15E" },
      { id: "desert", name: "Desert", colors: ["#CCD5AE", "#D4A373", "#E9EDC9", "#FEFAE0", "#FAEDCD"], bg: "#FEFAE0", bgType: "solid", headingFont: "Georgia", bodyFont: "Georgia", headingColor: "#5C3A1E", bodyColor: "#8B5E3C", accentColor: "#D4A373" },
      { id: "forest", name: "Forest", colors: ["#386641", "#6A994E", "#A7C957", "#BC4749", "#F2E8CF"], bg: "#F0FDF4", bgType: "solid", headingFont: "Oswald", bodyFont: "Inter", headingColor: "#283618", bodyColor: "#386641", accentColor: "#6A994E" },
      { id: "slate", name: "Slate", colors: ["#F8FAFC", "#CBD5E1", "#64748B", "#334155", "#0F172A"], bg: "#0F172A", bgType: "solid", headingFont: "Inter", bodyFont: "Inter", headingColor: "#F8FAFC", bodyColor: "#94A3B8", accentColor: "#64748B" },
    ],
  },
];

const PATTERNS = [
  { id: "dots", label: "Dots", css: "radial-gradient(#d1d5db 1px, #ffffff 1px) center / 16px 16px" },
  { id: "grid", label: "Grid", css: "linear-gradient(#d1d5db 1px, transparent 1px) center / 20px 20px, linear-gradient(90deg, #d1d5db 1px, transparent 1px) center / 20px 20px, #ffffff" },
  { id: "diagonal", label: "Diagonal", css: "repeating-linear-gradient(45deg, #e5e7eb 0, #e5e7eb 1px, #ffffff 0, #ffffff 8px)" },
  { id: "stripes-h", label: "Stripes H", css: "repeating-linear-gradient(#f3f4f6 0, #f3f4f6 8px, #ffffff 0, #ffffff 24px)" },
  { id: "stripes-v", label: "Stripes V", css: "repeating-linear-gradient(90deg, #f3f4f6 0, #f3f4f6 8px, #ffffff 0, #ffffff 24px)" },
  { id: "checker", label: "Checker", css: "conic-gradient(#e5e7eb 25%, #ffffff 0 50%, #e5e7eb 0 75%, #ffffff 0) 0 0 / 24px 24px" },
  { id: "dots-dark", label: "Dark Dots", css: "radial-gradient(#4b5563 1.5px, #111827 1.5px) center / 16px 16px" },
  { id: "grid-dark", label: "Dark Grid", css: "linear-gradient(#374151 1px, transparent 1px) center / 20px 20px, linear-gradient(90deg, #374151 1px, transparent 1px) center / 20px 20px, #111827" },
];

// ── Templates ──────────────────────────────────────────────────────────────

type TemplateDef = { id: string; label: string; bg: string; preview: string; make: (w: number, h: number) => Partial<DesignData> & { elements: DesignElement[] } };

const TEMPLATES: TemplateDef[] = [
  {
    id: "bold-dark", label: "Bold Dark", bg: "#0f172a", preview: "linear-gradient(135deg,#0f172a,#1e3a5f)",
    make: (w, h) => ({
      background: "#0f172a", backgroundType: "solid" as const,
      elements: [
        { id: uid(), type: "text" as const, x: Math.round(w*0.08), y: Math.round(h*0.32), width: Math.round(w*0.84), height: Math.round(h*0.18), content: "YOUR TITLE HERE", fontSize: Math.round(w*0.09), fontFamily: "Impact", color: "#ffffff", fontWeight: "700", textAlign: "center", zIndex: 1, lineHeight: 1.1, letterSpacing: 2 },
        { id: uid(), type: "text" as const, x: Math.round(w*0.15), y: Math.round(h*0.53), width: Math.round(w*0.7), height: Math.round(h*0.08), content: "Subtitle · Date · Venue", fontSize: Math.round(w*0.028), fontFamily: "Inter", color: "#94a3b8", fontWeight: "400", textAlign: "center", zIndex: 2, lineHeight: 1.3, letterSpacing: 4 },
        { id: uid(), type: "shape" as const, shapeType: "line-h", x: Math.round(w*0.3), y: Math.round(h*0.5), width: Math.round(w*0.4), height: 8, fill: "#f97316", zIndex: 0 },
      ]
    })
  },
  {
    id: "orange-gradient", label: "Vibrant", bg: "", preview: "linear-gradient(135deg,#f97316,#ec4899)",
    make: (w, h) => ({
      background: "#f97316", backgroundType: "gradient" as const, backgroundGradient: { color1: "#f97316", color2: "#ec4899", angle: 135 },
      elements: [
        { id: uid(), type: "shape" as const, shapeType: "star", x: Math.round(w*0.05), y: Math.round(h*0.04), width: Math.round(w*0.12), height: Math.round(w*0.12), fill: "rgba(255,255,255,0.25)", zIndex: 0 },
        { id: uid(), type: "shape" as const, shapeType: "star", x: Math.round(w*0.78), y: Math.round(h*0.06), width: Math.round(w*0.15), height: Math.round(w*0.15), fill: "rgba(255,255,255,0.2)", zIndex: 0 },
        { id: uid(), type: "text" as const, x: Math.round(w*0.07), y: Math.round(h*0.35), width: Math.round(w*0.86), height: Math.round(h*0.2), content: "MAKE IT\nHAPPEN", fontSize: Math.round(w*0.11), fontFamily: "Impact", color: "#ffffff", fontWeight: "700", textAlign: "center", zIndex: 1, lineHeight: 1.1, letterSpacing: 3 },
        { id: uid(), type: "text" as const, x: Math.round(w*0.1), y: Math.round(h*0.6), width: Math.round(w*0.8), height: Math.round(h*0.07), content: "Your tagline goes here", fontSize: Math.round(w*0.03), fontFamily: "Inter", color: "rgba(255,255,255,0.9)", fontWeight: "400", textAlign: "center", zIndex: 2, lineHeight: 1.4 },
      ]
    })
  },
  {
    id: "minimal-white", label: "Minimal", bg: "#ffffff", preview: "#ffffff",
    make: (w, h) => ({
      background: "#ffffff", backgroundType: "solid" as const,
      elements: [
        { id: uid(), type: "shape" as const, shapeType: "rect", x: Math.round(w*0.08), y: Math.round(h*0.3), width: Math.round(w*0.06), height: Math.round(h*0.12), fill: "#f97316", zIndex: 0 },
        { id: uid(), type: "text" as const, x: Math.round(w*0.18), y: Math.round(h*0.3), width: Math.round(w*0.74), height: Math.round(h*0.14), content: "Clean Heading", fontSize: Math.round(w*0.07), fontFamily: "Georgia", color: "#1a1a1a", fontWeight: "700", textAlign: "left", zIndex: 1, lineHeight: 1.2 },
        { id: uid(), type: "text" as const, x: Math.round(w*0.18), y: Math.round(h*0.46), width: Math.round(w*0.65), height: Math.round(h*0.12), content: "A simple, elegant description for your design project.", fontSize: Math.round(w*0.025), fontFamily: "Inter", color: "#64748b", fontWeight: "400", textAlign: "left", zIndex: 2, lineHeight: 1.6 },
        { id: uid(), type: "shape" as const, shapeType: "line-h", x: Math.round(w*0.08), y: Math.round(h*0.62), width: Math.round(w*0.84), height: 6, fill: "#e2e8f0", zIndex: 0 },
      ]
    })
  },
  {
    id: "night-stars", label: "Night Sky", bg: "", preview: "linear-gradient(160deg,#0a1628,#1e3a5f)",
    make: (w, h) => ({
      background: "#0a1628", backgroundType: "gradient" as const, backgroundGradient: { color1: "#0a1628", color2: "#1e3a5f", angle: 160 },
      elements: [
        { id: uid(), type: "shape" as const, shapeType: "star", x: Math.round(w*0.08), y: Math.round(h*0.05), width: Math.round(w*0.18), height: Math.round(w*0.18), fill: "#eab308", shadowColor: "#eab308", shadowBlur: 20, shadowX: 0, shadowY: 0, zIndex: 0 },
        { id: uid(), type: "shape" as const, shapeType: "star", x: Math.round(w*0.72), y: Math.round(h*0.04), width: Math.round(w*0.2), height: Math.round(w*0.2), fill: "#eab308", shadowColor: "#eab308", shadowBlur: 15, shadowX: 0, shadowY: 0, zIndex: 0 },
        { id: uid(), type: "text" as const, x: Math.round(w*0.07), y: Math.round(h*0.38), width: Math.round(w*0.86), height: Math.round(h*0.18), content: "DREAM BIG", fontSize: Math.round(w*0.1), fontFamily: "Impact", color: "#fef3c7", fontWeight: "700", textAlign: "center", zIndex: 1, lineHeight: 1.1, letterSpacing: 5 },
        { id: uid(), type: "text" as const, x: Math.round(w*0.1), y: Math.round(h*0.58), width: Math.round(w*0.8), height: Math.round(h*0.07), content: "Reach for the stars", fontSize: Math.round(w*0.028), fontFamily: "Dancing Script", color: "#94a3b8", fontWeight: "400", textAlign: "center", zIndex: 2, lineHeight: 1.4 },
      ]
    })
  },
  {
    id: "bold-red", label: "Bold Red", bg: "#dc2626", preview: "linear-gradient(135deg,#dc2626,#991b1b)",
    make: (w, h) => ({
      background: "#dc2626", backgroundType: "solid" as const,
      elements: [
        { id: uid(), type: "shape" as const, shapeType: "rect", x: 0, y: Math.round(h*0.38), width: w, height: Math.round(h*0.24), fill: "#991b1b", zIndex: 0 },
        { id: uid(), type: "text" as const, x: Math.round(w*0.06), y: Math.round(h*0.4), width: Math.round(w*0.88), height: Math.round(h*0.2), content: "SALE", fontSize: Math.round(w*0.22), fontFamily: "Impact", color: "#fef08a", fontWeight: "700", textAlign: "center", zIndex: 1, lineHeight: 1.0, letterSpacing: 8 },
        { id: uid(), type: "text" as const, x: Math.round(w*0.08), y: Math.round(h*0.65), width: Math.round(w*0.84), height: Math.round(h*0.08), content: "LIMITED TIME OFFER", fontSize: Math.round(w*0.032), fontFamily: "Inter", color: "#ffffff", fontWeight: "700", textAlign: "center", zIndex: 2, lineHeight: 1.3, letterSpacing: 4 },
        { id: uid(), type: "text" as const, x: Math.round(w*0.1), y: Math.round(h*0.22), width: Math.round(w*0.8), height: Math.round(h*0.08), content: "DON'T MISS OUT", fontSize: Math.round(w*0.032), fontFamily: "Inter", color: "rgba(255,255,255,0.8)", fontWeight: "700", textAlign: "center", zIndex: 2, lineHeight: 1.3, letterSpacing: 3 },
      ]
    })
  },
  {
    id: "elegant-cream", label: "Elegant", bg: "#fdf8f0", preview: "#fdf8f0",
    make: (w, h) => ({
      background: "#fdf8f0", backgroundType: "solid" as const,
      elements: [
        { id: uid(), type: "shape" as const, shapeType: "diamond", x: Math.round(w*0.44), y: Math.round(h*0.12), width: Math.round(w*0.12), height: Math.round(w*0.12), fill: "#d4a574", zIndex: 0 },
        { id: uid(), type: "text" as const, x: Math.round(w*0.08), y: Math.round(h*0.28), width: Math.round(w*0.84), height: Math.round(h*0.15), content: "Elegant Title", fontSize: Math.round(w*0.075), fontFamily: "Playfair Display", color: "#2c1810", fontWeight: "700", textAlign: "center", zIndex: 1, lineHeight: 1.2 },
        { id: uid(), type: "shape" as const, shapeType: "line-h", x: Math.round(w*0.25), y: Math.round(h*0.45), width: Math.round(w*0.5), height: 4, fill: "#d4a574", zIndex: 0 },
        { id: uid(), type: "text" as const, x: Math.round(w*0.12), y: Math.round(h*0.5), width: Math.round(w*0.76), height: Math.round(h*0.1), content: "A refined, timeless description\nfor your special occasion", fontSize: Math.round(w*0.026), fontFamily: "Georgia", color: "#6b4c3b", fontWeight: "400", textAlign: "center", zIndex: 2, lineHeight: 1.7 },
      ]
    })
  },
  {
    id: "quote-card", label: "Quote", bg: "#1e293b", preview: "linear-gradient(135deg,#1e293b,#334155)",
    make: (w, h) => ({
      background: "#1e293b", backgroundType: "solid" as const,
      elements: [
        { id: uid(), type: "text" as const, x: Math.round(w*0.08), y: Math.round(h*0.12), width: Math.round(w*0.2), height: Math.round(h*0.18), content: "“", fontSize: Math.round(w*0.2), fontFamily: "Georgia", color: "#f97316", fontWeight: "700", textAlign: "left", zIndex: 0, lineHeight: 1.0 },
        { id: uid(), type: "text" as const, x: Math.round(w*0.1), y: Math.round(h*0.28), width: Math.round(w*0.8), height: Math.round(h*0.35), content: "Write something\ninspirational here", fontSize: Math.round(w*0.058), fontFamily: "Playfair Display", color: "#f1f5f9", fontWeight: "400", textAlign: "center", zIndex: 1, lineHeight: 1.5 },
        { id: uid(), type: "shape" as const, shapeType: "line-h", x: Math.round(w*0.3), y: Math.round(h*0.66), width: Math.round(w*0.4), height: 4, fill: "#f97316", zIndex: 0 },
        { id: uid(), type: "text" as const, x: Math.round(w*0.1), y: Math.round(h*0.7), width: Math.round(w*0.8), height: Math.round(h*0.06), content: "— Author Name", fontSize: Math.round(w*0.026), fontFamily: "Inter", color: "#64748b", fontWeight: "400", textAlign: "center", zIndex: 2, lineHeight: 1.3 },
      ]
    })
  },
  {
    id: "social-pop", label: "Social Pop", bg: "", preview: "linear-gradient(135deg,#7c3aed,#3b82f6)",
    make: (w, h) => ({
      background: "#7c3aed", backgroundType: "gradient" as const, backgroundGradient: { color1: "#7c3aed", color2: "#3b82f6", angle: 135 },
      elements: [
        { id: uid(), type: "shape" as const, shapeType: "circle", x: Math.round(w*-0.1), y: Math.round(h*-0.05), width: Math.round(w*0.5), height: Math.round(w*0.5), fill: "rgba(255,255,255,0.08)", zIndex: 0 },
        { id: uid(), type: "shape" as const, shapeType: "circle", x: Math.round(w*0.6), y: Math.round(h*0.6), width: Math.round(w*0.55), height: Math.round(w*0.55), fill: "rgba(255,255,255,0.06)", zIndex: 0 },
        { id: uid(), type: "text" as const, x: Math.round(w*0.07), y: Math.round(h*0.34), width: Math.round(w*0.86), height: Math.round(h*0.2), content: "NEW DROP", fontSize: Math.round(w*0.12), fontFamily: "Impact", color: "#ffffff", fontWeight: "700", textAlign: "center", zIndex: 1, lineHeight: 1.0, letterSpacing: 5 },
        { id: uid(), type: "text" as const, x: Math.round(w*0.08), y: Math.round(h*0.57), width: Math.round(w*0.84), height: Math.round(h*0.07), content: "Check it out now 🔥", fontSize: Math.round(w*0.032), fontFamily: "Inter", color: "rgba(255,255,255,0.85)", fontWeight: "600", textAlign: "center", zIndex: 2, lineHeight: 1.3 },
      ]
    })
  },
  {
    id: "fitness", label: "Fitness", bg: "", preview: "linear-gradient(135deg,#1a1a1a,#ef4444)",
    make: (w, h) => ({
      background: "#1a1a1a", backgroundType: "gradient" as const, backgroundGradient: { color1: "#1a1a1a", color2: "#7f1d1d", angle: 135 },
      elements: [
        { id: uid(), type: "shape" as const, shapeType: "parallelogram", x: 0, y: Math.round(h*0.55), width: w, height: Math.round(h*0.12), fill: "#ef4444", zIndex: 0 },
        { id: uid(), type: "text" as const, x: Math.round(w*0.05), y: Math.round(h*0.2), width: Math.round(w*0.9), height: Math.round(h*0.28), content: "NO\nEXCUSES", fontSize: Math.round(w*0.14), fontFamily: "Impact", color: "#ffffff", fontWeight: "700", textAlign: "center", zIndex: 1, lineHeight: 1.0, letterSpacing: 4 },
        { id: uid(), type: "text" as const, x: Math.round(w*0.08), y: Math.round(h*0.56), width: Math.round(w*0.84), height: Math.round(h*0.09), content: "TRAIN HARDER · GET STRONGER", fontSize: Math.round(w*0.028), fontFamily: "Inter", color: "#ffffff", fontWeight: "700", textAlign: "center", zIndex: 2, lineHeight: 1.3, letterSpacing: 3 },
        { id: uid(), type: "text" as const, x: Math.round(w*0.1), y: Math.round(h*0.72), width: Math.round(w*0.8), height: Math.round(h*0.06), content: "@yourusername", fontSize: Math.round(w*0.025), fontFamily: "Inter", color: "#ef4444", fontWeight: "600", textAlign: "center", zIndex: 2, lineHeight: 1.3 },
      ]
    })
  },
  {
    id: "birthday", label: "Birthday", bg: "", preview: "linear-gradient(135deg,#f59e0b,#ec4899)",
    make: (w, h) => ({
      background: "#fef3c7", backgroundType: "solid" as const,
      elements: [
        { id: uid(), type: "shape" as const, shapeType: "star", x: Math.round(w*0.04), y: Math.round(h*0.05), width: Math.round(w*0.14), height: Math.round(w*0.14), fill: "#f59e0b", zIndex: 0 },
        { id: uid(), type: "shape" as const, shapeType: "star", x: Math.round(w*0.82), y: Math.round(h*0.03), width: Math.round(w*0.12), height: Math.round(w*0.12), fill: "#ec4899", zIndex: 0 },
        { id: uid(), type: "shape" as const, shapeType: "circle", x: Math.round(w*0.78), y: Math.round(h*0.7), width: Math.round(w*0.16), height: Math.round(w*0.16), fill: "#a78bfa", zIndex: 0 },
        { id: uid(), type: "shape" as const, shapeType: "circle", x: Math.round(w*0.04), y: Math.round(h*0.72), width: Math.round(w*0.12), height: Math.round(w*0.12), fill: "#34d399", zIndex: 0 },
        { id: uid(), type: "text" as const, x: Math.round(w*0.06), y: Math.round(h*0.22), width: Math.round(w*0.88), height: Math.round(h*0.12), content: "Happy Birthday!", fontSize: Math.round(w*0.085), fontFamily: "Pacifico", color: "#92400e", fontWeight: "400", textAlign: "center", zIndex: 1, lineHeight: 1.2 },
        { id: uid(), type: "text" as const, x: Math.round(w*0.1), y: Math.round(h*0.38), width: Math.round(w*0.8), height: Math.round(h*0.08), content: "Wishing you all the joy", fontSize: Math.round(w*0.032), fontFamily: "Georgia", color: "#78350f", fontWeight: "400", textAlign: "center", zIndex: 2, lineHeight: 1.4 },
      ]
    })
  },
  {
    id: "travel", label: "Travel", bg: "", preview: "linear-gradient(160deg,#0ea5e9,#065f46)",
    make: (w, h) => ({
      background: "#0c4a6e", backgroundType: "gradient" as const, backgroundGradient: { color1: "#0c4a6e", color2: "#064e3b", angle: 160 },
      elements: [
        { id: uid(), type: "shape" as const, shapeType: "circle", x: Math.round(w*0.6), y: Math.round(h*-0.1), width: Math.round(w*0.6), height: Math.round(w*0.6), fill: "rgba(14,165,233,0.2)", zIndex: 0 },
        { id: uid(), type: "text" as const, x: Math.round(w*0.07), y: Math.round(h*0.28), width: Math.round(w*0.86), height: Math.round(h*0.2), content: "WANDER\nMORE", fontSize: Math.round(w*0.1), fontFamily: "Oswald", color: "#ffffff", fontWeight: "700", textAlign: "center", zIndex: 1, lineHeight: 1.1, letterSpacing: 5 },
        { id: uid(), type: "shape" as const, shapeType: "line-h", x: Math.round(w*0.2), y: Math.round(h*0.51), width: Math.round(w*0.6), height: 4, fill: "#38bdf8", zIndex: 0 },
        { id: uid(), type: "text" as const, x: Math.round(w*0.08), y: Math.round(h*0.55), width: Math.round(w*0.84), height: Math.round(h*0.07), content: "Explore · Discover · Dream", fontSize: Math.round(w*0.028), fontFamily: "Inter", color: "#bae6fd", fontWeight: "400", textAlign: "center", zIndex: 2, lineHeight: 1.4, letterSpacing: 3 },
      ]
    })
  },
  {
    id: "wedding", label: "Wedding", bg: "#fff5f7", preview: "linear-gradient(135deg,#fce7f3,#fff5f7)",
    make: (w, h) => ({
      background: "#fff5f7", backgroundType: "solid" as const,
      elements: [
        { id: uid(), type: "shape" as const, shapeType: "heart", x: Math.round(w*0.38), y: Math.round(h*0.1), width: Math.round(w*0.24), height: Math.round(w*0.22), fill: "#fbcfe8", zIndex: 0 },
        { id: uid(), type: "text" as const, x: Math.round(w*0.06), y: Math.round(h*0.3), width: Math.round(w*0.88), height: Math.round(h*0.14), content: "Together Forever", fontSize: Math.round(w*0.075), fontFamily: "Playfair Display", color: "#831843", fontWeight: "700", textAlign: "center", zIndex: 1, lineHeight: 1.2 },
        { id: uid(), type: "text" as const, x: Math.round(w*0.1), y: Math.round(h*0.46), width: Math.round(w*0.8), height: Math.round(h*0.06), content: "Name & Name", fontSize: Math.round(w*0.045), fontFamily: "Dancing Script", color: "#be185d", fontWeight: "400", textAlign: "center", zIndex: 2, lineHeight: 1.4 },
        { id: uid(), type: "shape" as const, shapeType: "line-h", x: Math.round(w*0.22), y: Math.round(h*0.55), width: Math.round(w*0.56), height: 3, fill: "#f9a8d4", zIndex: 0 },
        { id: uid(), type: "text" as const, x: Math.round(w*0.1), y: Math.round(h*0.6), width: Math.round(w*0.8), height: Math.round(h*0.06), content: "Date · Venue · City", fontSize: Math.round(w*0.026), fontFamily: "Georgia", color: "#9d174d", fontWeight: "400", textAlign: "center", zIndex: 2, lineHeight: 1.4, letterSpacing: 2 },
      ]
    })
  },
  {
    id: "tech-launch", label: "Tech Launch", bg: "", preview: "linear-gradient(135deg,#0f172a,#1e3a5f)",
    make: (w, h) => ({
      background: "#0f172a", backgroundType: "gradient" as const, backgroundGradient: { color1: "#0f172a", color2: "#1e3a5f", angle: 135 },
      elements: [
        { id: uid(), type: "shape" as const, shapeType: "hexagon", x: Math.round(w*0.72), y: Math.round(h*0.05), width: Math.round(w*0.32), height: Math.round(w*0.32), fill: "rgba(59,130,246,0.15)", zIndex: 0 },
        { id: uid(), type: "shape" as const, shapeType: "hexagon", x: Math.round(w*-0.06), y: Math.round(h*0.55), width: Math.round(w*0.25), height: Math.round(w*0.25), fill: "rgba(59,130,246,0.1)", zIndex: 0 },
        { id: uid(), type: "text" as const, x: Math.round(w*0.06), y: Math.round(h*0.22), width: Math.round(w*0.88), height: Math.round(h*0.09), content: "INTRODUCING", fontSize: Math.round(w*0.028), fontFamily: "Inter", color: "#60a5fa", fontWeight: "700", textAlign: "center", zIndex: 1, lineHeight: 1.3, letterSpacing: 6 },
        { id: uid(), type: "text" as const, x: Math.round(w*0.05), y: Math.round(h*0.32), width: Math.round(w*0.9), height: Math.round(h*0.2), content: "Product Name", fontSize: Math.round(w*0.1), fontFamily: "Inter", color: "#ffffff", fontWeight: "700", textAlign: "center", zIndex: 1, lineHeight: 1.1 },
        { id: uid(), type: "shape" as const, shapeType: "rect", x: Math.round(w*0.3), y: Math.round(h*0.56), width: Math.round(w*0.4), height: Math.round(h*0.06), fill: "#3b82f6", borderRadius: 8, zIndex: 2 },
        { id: uid(), type: "text" as const, x: Math.round(w*0.3), y: Math.round(h*0.565), width: Math.round(w*0.4), height: Math.round(h*0.05), content: "Learn More →", fontSize: Math.round(w*0.024), fontFamily: "Inter", color: "#ffffff", fontWeight: "600", textAlign: "center", zIndex: 3, lineHeight: 1.4 },
      ]
    })
  },
  {
    id: "food", label: "Food & Menu", bg: "#1c0a00", preview: "linear-gradient(160deg,#1c0a00,#7c2d12)",
    make: (w, h) => ({
      background: "#1c0a00", backgroundType: "gradient" as const, backgroundGradient: { color1: "#1c0a00", color2: "#7c2d12", angle: 160 },
      elements: [
        { id: uid(), type: "shape" as const, shapeType: "circle", x: Math.round(w*0.35), y: Math.round(h*0.08), width: Math.round(w*0.3), height: Math.round(w*0.3), fill: "rgba(234,179,8,0.15)", zIndex: 0 },
        { id: uid(), type: "text" as const, x: Math.round(w*0.08), y: Math.round(h*0.1), width: Math.round(w*0.84), height: Math.round(h*0.08), content: "EST. 2024", fontSize: Math.round(w*0.024), fontFamily: "Inter", color: "#d97706", fontWeight: "600", textAlign: "center", zIndex: 1, lineHeight: 1.3, letterSpacing: 5 },
        { id: uid(), type: "shape" as const, shapeType: "line-h", x: Math.round(w*0.2), y: Math.round(h*0.2), width: Math.round(w*0.6), height: 3, fill: "#d97706", zIndex: 0 },
        { id: uid(), type: "text" as const, x: Math.round(w*0.06), y: Math.round(h*0.24), width: Math.round(w*0.88), height: Math.round(h*0.18), content: "Restaurant Name", fontSize: Math.round(w*0.085), fontFamily: "Playfair Display", color: "#fef3c7", fontWeight: "700", textAlign: "center", zIndex: 1, lineHeight: 1.2 },
        { id: uid(), type: "shape" as const, shapeType: "line-h", x: Math.round(w*0.2), y: Math.round(h*0.44), width: Math.round(w*0.6), height: 3, fill: "#d97706", zIndex: 0 },
        { id: uid(), type: "text" as const, x: Math.round(w*0.1), y: Math.round(h*0.49), width: Math.round(w*0.8), height: Math.round(h*0.06), content: "Fine Dining · Private Events", fontSize: Math.round(w*0.026), fontFamily: "Georgia", color: "#fcd34d", fontWeight: "400", textAlign: "center", zIndex: 2, lineHeight: 1.4, letterSpacing: 2 },
      ]
    })
  },
  {
    id: "motivational", label: "Motivational", bg: "", preview: "linear-gradient(135deg,#4f46e5,#7c3aed)",
    make: (w, h) => ({
      background: "#312e81", backgroundType: "gradient" as const, backgroundGradient: { color1: "#312e81", color2: "#4c1d95", angle: 135 },
      elements: [
        { id: uid(), type: "shape" as const, shapeType: "star4", x: Math.round(w*0.06), y: Math.round(h*0.07), width: Math.round(w*0.1), height: Math.round(w*0.1), fill: "#a78bfa", opacity: 0.6, zIndex: 0 },
        { id: uid(), type: "shape" as const, shapeType: "star4", x: Math.round(w*0.82), y: Math.round(h*0.12), width: Math.round(w*0.08), height: Math.round(w*0.08), fill: "#c4b5fd", opacity: 0.5, zIndex: 0 },
        { id: uid(), type: "text" as const, x: Math.round(w*0.06), y: Math.round(h*0.28), width: Math.round(w*0.88), height: Math.round(h*0.3), content: "BELIEVE\nIN YOUR\nSELF", fontSize: Math.round(w*0.1), fontFamily: "Oswald", color: "#ffffff", fontWeight: "700", textAlign: "center", zIndex: 1, lineHeight: 1.0, letterSpacing: 3 },
        { id: uid(), type: "shape" as const, shapeType: "line-h", x: Math.round(w*0.25), y: Math.round(h*0.63), width: Math.round(w*0.5), height: 4, fill: "#a78bfa", zIndex: 0 },
        { id: uid(), type: "text" as const, x: Math.round(w*0.1), y: Math.round(h*0.68), width: Math.round(w*0.8), height: Math.round(h*0.06), content: "The power is within you", fontSize: Math.round(w*0.026), fontFamily: "Inter", color: "#c4b5fd", fontWeight: "400", textAlign: "center", zIndex: 2, lineHeight: 1.4 },
      ]
    })
  },
];

type DragState = { startX: number; startY: number; origX: number; origY: number };
type ResizeState = { startX: number; startY: number; origW: number; origH: number };

const MAX_HISTORY = 60;

// ── Main editor ────────────────────────────────────────────────────────────

export function DesignEditor({ designId }: { designId: string }) {
  const { theme } = useDashboardTheme();
  const isDark = theme === "dark";
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const bundleId = searchParams.get("bundle");

  const [title, setTitle] = useState("Untitled Design");
  const [editingTitle, setEditingTitle] = useState(false);
  const [data, setData] = useState<DesignData>({ width: 800, height: 1100, background: "#ffffff", elements: [] });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePanel, setActivePanel] = useState<"shapes" | "ai" | "templates" | "uploads" | "chat" | null>(null);
  const [flyoutPos, setFlyoutPos] = useState({ x: 84, y: 60 });
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStyle, setAiStyle] = useState("bold");
  const [aiError, setAiError] = useState<string | null>(null);
  const [recentUploads, setRecentUploads] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("cf_design_uploads") ?? "[]"); } catch { return []; }
  });
  const [mobileToolSheet, setMobileToolSheet] = useState<"shapes" | "ai" | "templates" | "uploads" | "background" | "chat" | null>(null);
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [liveCredits, setLiveCredits] = useState<number | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [chatProducts, setChatProducts] = useState<{ id: string; title: string }[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  const [activeGuides, setActiveGuides] = useState<SnapGuide[]>([]);
  const [showGrid, setShowGrid] = useState(false);
  const [showSafeArea, setShowSafeArea] = useState(false);

  function togglePanel(panel: "shapes" | "ai" | "templates" | "uploads" | "chat", e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setFlyoutPos({ x: rect.right + 8, y: Math.max(8, rect.top) });
    setActivePanel((prev) => prev === panel ? null : panel);
    if (panel === "chat" && chatProducts.length === 0) {
      fetch("/api/products").then((r) => r.json()).then((d) => {
        setChatProducts((d.products ?? []).filter((p: { status: string }) => p.status === "complete"));
      }).catch(() => {});
    }
  }

  // Undo/redo
  const historyRef = useRef<DesignData[]>([]);
  const historyIdx = useRef(-1);
  const skipHistoryRef = useRef(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.7);

  const dragRef = useRef<DragState | null>(null);
  const resizeRef = useRef<ResizeState | null>(null);
  const rotateRef = useRef<{ startAngle: number; origRotation: number; cx: number; cy: number } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Always-fresh refs so keyboard/pointer handlers don't capture stale closures
  const dataRef = useRef<DesignData>(data);
  useEffect(() => { dataRef.current = data; }, [data]);
  const selectedIdRef = useRef<string | null>(selectedId);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

  useEffect(() => {
    fetch(`/api/designs/${designId}`)
      .then((r) => r.json())
      .then(({ design }) => {
        if (design) {
          setTitle(design.title);
          const d = design.data as DesignData;
          setData(d);
          historyRef.current = [d];
          historyIdx.current = 0;
        }
      })
      .finally(() => setLoading(false));
  }, [designId]);

  function refreshCredits() {
    fetch("/api/credits").then((r) => r.json()).then(({ videoCredits }) => {
      if (typeof videoCredits === "number") setLiveCredits(videoCredits);
    }).catch(() => {});
  }

  useEffect(() => { refreshCredits(); }, []);

  useEffect(() => {
    const obs = new ResizeObserver(() => {
      if (!containerRef.current) return;
      const { width, height } = containerRef.current.getBoundingClientRect();
      setScale(Math.min((width - 80) / data.width, (height - 80) / data.height, 1.5));
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [data.width, data.height]);

  const scheduleSave = useCallback((d: DesignData, t: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        await fetch(`/api/designs/${designId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: t, data: d }),
        });
        setLastSaved(new Date());
      } finally { setSaving(false); }
    }, 1200);
  }, [designId]);

  function pushHistory(d: DesignData) {
    if (skipHistoryRef.current) return;
    const next = historyRef.current.slice(0, historyIdx.current + 1);
    next.push(d);
    if (next.length > MAX_HISTORY) next.shift();
    historyRef.current = next;
    historyIdx.current = next.length - 1;
  }

  function updateData(updater: (prev: DesignData) => DesignData, addToHistory = true) {
    setData((prev) => {
      const next = updater(prev);
      if (addToHistory) pushHistory(next);
      scheduleSave(next, title);
      return next;
    });
  }

  function undo() {
    if (historyIdx.current <= 0) return;
    historyIdx.current--;
    const d = historyRef.current[historyIdx.current];
    skipHistoryRef.current = true;
    setData(d);
    scheduleSave(d, title);
    skipHistoryRef.current = false;
  }

  function redo() {
    if (historyIdx.current >= historyRef.current.length - 1) return;
    historyIdx.current++;
    const d = historyRef.current[historyIdx.current];
    skipHistoryRef.current = true;
    setData(d);
    scheduleSave(d, title);
    skipHistoryRef.current = false;
  }

  function updateTitle(val: string) {
    setTitle(val);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      await fetch(`/api/designs/${designId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: val, data }),
      });
      setLastSaved(new Date()); setSaving(false);
    }, 800);
  }

  const selectedEl = data.elements.find((e) => e.id === selectedId) ?? null;

  function updateElement(id: string, patch: Partial<DesignElement>, addToHistory = true) {
    updateData((prev) => ({ ...prev, elements: prev.elements.map((el) => el.id === id ? { ...el, ...patch } : el) }), addToHistory);
  }

  // ── Add elements ──

  function addText() {
    const el: DesignElement = {
      id: uid(), type: "text",
      x: Math.round(data.width / 2 - 150), y: Math.round(data.height / 2 - 30),
      width: 300, height: 60, content: "Add your text here",
      fontSize: 40, fontFamily: "Inter", color: "#1a1a1a",
      fontWeight: "700", textAlign: "center", lineHeight: 1.3, letterSpacing: 0, zIndex: data.elements.length,
    };
    updateData((prev) => ({ ...prev, elements: [...prev.elements, el] }));
    setSelectedId(el.id);
  }

  function addShape(shapeType = "rect") {
    const el: DesignElement = {
      id: uid(), type: "shape", shapeType,
      x: Math.round(data.width / 2 - 100), y: Math.round(data.height / 2 - 100),
      width: 200, height: 200, fill: "#f97316", strokeWidth: 0, zIndex: data.elements.length,
    };
    updateData((prev) => ({ ...prev, elements: [...prev.elements, el] }));
    setSelectedId(el.id);
    setActivePanel(null);
  }

  function addImageUrl(url: string) {
    const el: DesignElement = {
      id: uid(), type: "image",
      x: Math.round(data.width / 2 - 150), y: Math.round(data.height / 2 - 150),
      width: 300, height: 300, imageUrl: url, objectFit: "cover", zIndex: data.elements.length,
    };
    updateData((prev) => ({ ...prev, elements: [...prev.elements, el] }));
    setSelectedId(el.id);
  }

  function saveUpload(url: string) {
    setRecentUploads((prev) => {
      const next = [url, ...prev.filter((u) => u !== url)].slice(0, 20);
      try { localStorage.setItem("cf_design_uploads", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }

  function addImage() {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*";
    input.style.display = "none";
    document.body.appendChild(input);
    input.onchange = async () => {
      const file = input.files?.[0];
      document.body.removeChild(input);
      if (!file) return;
      setUploadLoading(true);
      setUploadError(null);
      try {
        const fd = new FormData(); fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        let json: { url?: string; error?: string } = {};
        try { json = await res.json(); } catch { /* non-JSON response body */ }
        if (!res.ok) { setUploadError(json.error ?? `Upload failed (${res.status})`); return; }
        if (!json.url) { setUploadError("Upload succeeded but no URL returned."); return; }
        saveUpload(json.url);
        addImageUrl(json.url);
        setActivePanel("uploads");
      } catch (err) {
        console.error("[upload]", err);
        setUploadError("Upload failed. Please try again.");
      } finally {
        setUploadLoading(false);
      }
    };
    input.oncancel = () => { try { document.body.removeChild(input); } catch { /* ok */ } };
    input.click();
  }

  function applyTemplate(tpl: TemplateDef) {
    const patch = tpl.make(data.width, data.height);
    updateData((prev) => ({ ...prev, ...patch }));
    setActivePanel(null);
    setSelectedId(null);
  }

  function applyPaletteToDesign(pal: PaletteDef) {
    updateData((prev) => ({
      ...prev,
      background: pal.bg,
      backgroundType: pal.bgType,
      backgroundGradient: pal.bgGradient,
      backgroundImage: undefined,
      activePalette: pal.colors,
      elements: prev.elements.map((el) => {
        if (el.type === "text") {
          const isHeading = (el.fontSize ?? 32) >= 40;
          return { ...el, color: isHeading ? pal.headingColor : pal.bodyColor, fontFamily: isHeading ? pal.headingFont : pal.bodyFont };
        }
        if (el.type === "shape") {
          return { ...el, fill: pal.accentColor };
        }
        return el;
      }),
    }));
    setSelectedId(null);
  }

  function addBgImage() {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*";
    input.style.display = "none";
    document.body.appendChild(input);
    input.onchange = async () => {
      const file = input.files?.[0];
      document.body.removeChild(input);
      if (!file) return;
      setUploadLoading(true);
      setUploadError(null);
      try {
        const fd = new FormData(); fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        let json: { url?: string; error?: string } = {};
        try { json = await res.json(); } catch { /* non-JSON response body */ }
        if (!res.ok) { setUploadError(json.error ?? `Upload failed (${res.status})`); return; }
        if (!json.url) { setUploadError("Upload succeeded but no URL returned."); return; }
        saveUpload(json.url);
        updateData((prev) => ({ ...prev, backgroundImage: json.url!, backgroundImageFit: "cover" }));
      } catch (err) {
        console.error("[upload-bg]", err);
        setUploadError("Upload failed. Please try again.");
      } finally {
        setUploadLoading(false);
      }
    };
    input.oncancel = () => { try { document.body.removeChild(input); } catch { /* ok */ } };
    input.click();
  }

  async function generateAiImage() {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch("/api/ai-design/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt, style: aiStyle, textColor: "#ffffff" }),
      });
      const json = await res.json();
      if (!res.ok) {
        setAiError(json.error ?? "Generation failed. Please try again.");
        return;
      }
      const url = json.url;
      if (!url) { setAiError("No image returned. Please try again."); return; }
      const el: DesignElement = {
        id: uid(), type: "image",
        x: Math.round(data.width / 2 - 200), y: Math.round(data.height / 2 - 200),
        width: 400, height: 400, imageUrl: url, objectFit: "contain", zIndex: data.elements.length,
      };
      updateData((prev) => ({ ...prev, elements: [...prev.elements, el] }));
      setSelectedId(el.id);
      setAiPrompt("");
      setActivePanel(null);
      refreshCredits();
    } catch {
      setAiError("Network error. Please try again.");
    } finally { setAiLoading(false); }
  }

  async function sendChatMessage() {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;
    const newHistory = [...chatMessages, { role: "user" as const, content: msg }];
    setChatMessages(newHistory);
    setChatInput("");
    setChatLoading(true);
    try {
      const res = await fetch("/api/ai-design/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          productId: data.productId ?? null,
          canvasWidth: data.width,
          canvasHeight: data.height,
          currentElements: data.elements.map((el) => ({
            id: el.id,
            type: el.type,
            x: el.x,
            y: el.y,
            width: el.width,
            height: el.height,
            zIndex: el.zIndex,
            ...(el.type === "text" ? { content: el.content, fontSize: el.fontSize, fontFamily: el.fontFamily, color: el.color, fontWeight: el.fontWeight, textAlign: el.textAlign } : {}),
            ...(el.type === "shape" ? { shapeType: el.shapeType, fill: el.fill } : {}),
          })),
          history: chatMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const json = await res.json();
      const reply = json.reply ?? "Done!";
      setChatMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      if (json.elements && json.elements.length > 0) {
        const toDesignEl = (el: Partial<DesignElement>, i: number): DesignElement => ({
          id: (el.id && data.elements.find(e => e.id === el.id)) ? el.id : uid(),
          type: (el.type === "shape" ? "shape" : "text") as "text" | "shape",
          x: el.x ?? 0,
          y: el.y ?? 0,
          width: el.width ?? 200,
          height: el.height ?? 60,
          zIndex: el.zIndex ?? i,
          ...(el.type === "text" ? {
            content: el.content ?? "",
            fontSize: el.fontSize ?? 24,
            fontFamily: el.fontFamily ?? "Inter",
            color: el.color ?? "#ffffff",
            fontWeight: el.fontWeight ?? "700",
            textAlign: (el.textAlign as "left" | "center" | "right") ?? "center",
            lineHeight: el.lineHeight ?? 1.3,
          } : {
            shapeType: el.shapeType ?? "rect",
            fill: el.fill ?? "#f97316",
            borderRadius: el.borderRadius ?? 0,
          }),
        });
        // mode:"replace" = AI modified existing elements; mode:"add" (default) = new elements
        if (json.mode === "replace") {
          const replacedEls = (json.elements as Partial<DesignElement>[]).map(toDesignEl);
          updateData((prev) => ({
            ...prev,
            elements: replacedEls,
            ...(json.background ? { background: json.background } : {}),
          }));
        } else {
          const newEls = (json.elements as Partial<DesignElement>[]).map(toDesignEl);
          updateData((prev) => ({
            ...prev,
            elements: [...prev.elements, ...newEls],
            ...(json.background ? { background: json.background } : {}),
          }));
        }
      } else if (json.background) {
        updateData((prev) => ({ ...prev, background: json.background }));
      }
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch {
      setChatMessages((prev) => [...prev, { role: "assistant", content: "Sorry, something went wrong. Please try again." }]);
    } finally {
      setChatLoading(false);
    }
  }

  function deleteSelected() {
    if (!selectedId) return;
    updateData((prev) => ({ ...prev, elements: prev.elements.filter((e) => e.id !== selectedId) }));
    setSelectedId(null);
  }

  function duplicateSelected() {
    if (!selectedEl) return;
    const clone: DesignElement = { ...selectedEl, id: uid(), x: selectedEl.x + 20, y: selectedEl.y + 20, zIndex: (selectedEl.zIndex ?? 0) + 1 };
    updateData((prev) => ({ ...prev, elements: [...prev.elements, clone] }));
    setSelectedId(clone.id);
  }

  // ── Alignment ──

  function alignEl(direction: "left" | "center-h" | "right" | "top" | "center-v" | "bottom") {
    if (!selectedEl) return;
    let x = selectedEl.x, y = selectedEl.y;
    if (direction === "left") x = 0;
    else if (direction === "center-h") x = Math.round((data.width - selectedEl.width) / 2);
    else if (direction === "right") x = data.width - selectedEl.width;
    else if (direction === "top") y = 0;
    else if (direction === "center-v") y = Math.round((data.height - selectedEl.height) / 2);
    else if (direction === "bottom") y = data.height - selectedEl.height;
    updateElement(selectedEl.id, { x, y });
  }

  // ── Lock / unlock ──────────────────────────────────────────────────────────
  function lockSelected() {
    if (selectedEl) updateElement(selectedEl.id, { locked: true });
  }
  function unlockSelected() {
    if (selectedEl) updateElement(selectedEl.id, { locked: false });
  }

  // ── Bring / send layers ────────────────────────────────────────────────────
  function bringForward() {
    if (!selectedEl) return;
    updateElement(selectedEl.id, { zIndex: (selectedEl.zIndex ?? 0) + 1 });
  }
  function sendBackward() {
    if (!selectedEl) return;
    updateElement(selectedEl.id, { zIndex: Math.max(0, (selectedEl.zIndex ?? 0) - 1) });
  }
  function bringToFront() {
    if (!selectedEl) return;
    const maxZ = Math.max(0, ...data.elements.map((e) => e.zIndex ?? 0));
    updateElement(selectedEl.id, { zIndex: maxZ + 1 });
  }
  function sendToBack() {
    if (!selectedEl) return;
    const minZ = Math.min(0, ...data.elements.map((e) => e.zIndex ?? 0));
    updateElement(selectedEl.id, { zIndex: minZ - 1 });
  }

  // ── Drag/resize/rotate — pointer events work for both mouse and touch ──

  function onElementPointerDown(e: React.PointerEvent, id: string) {
    if ((e.target as HTMLElement).dataset.resize || (e.target as HTMLElement).dataset.rotate) return;
    e.stopPropagation();
    e.preventDefault(); // prevent page scroll while dragging on touch
    // Skip interaction if element is locked
    const el = data.elements.find((x) => x.id === id)!;
    if (el?.locked) { setSelectedId(id); return; } // allow select but no drag
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: el.x, origY: el.y };
    // Pointer capture keeps events flowing even if finger slides off the element
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ignore */ }
    const others = data.elements.filter((x) => x.id !== id);
    const onMove = (ev: PointerEvent) => {
      if (!dragRef.current) return;
      const rawX = clamp(dragRef.current.origX + (ev.clientX - dragRef.current.startX) / scale, -el.width + 20, data.width - 20);
      const rawY = clamp(dragRef.current.origY + (ev.clientY - dragRef.current.startY) / scale, -el.height + 20, data.height - 20);
      const { x, y, guides } = snapElement(rawX, rawY, el.width, el.height, data.width, data.height, others);
      setActiveGuides(guides);
      updateElement(id, { x, y }, false);
    };
    const onUp = () => {
      dragRef.current = null;
      setActiveGuides([]);
      pushHistory(historyRef.current[historyIdx.current]);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function onResizePointerDown(e: React.PointerEvent, id: string) {
    onResizeCornerPointerDown(e, id, "se");
  }

  /**
   * Corner-aware resize handler. Supports all 4 corners.
   * On touch (pointerType === "touch") aspect ratio is locked by default for images.
   */
  function onResizeCornerPointerDown(
    e: React.PointerEvent,
    id: string,
    corner: "nw" | "ne" | "sw" | "se"
  ) {
    e.stopPropagation(); e.preventDefault();
    const el = data.elements.find((x) => x.id === id)!;
    const ar = el.height / el.width; // aspect ratio
    const lockAR = e.pointerType === "touch" && (el.type === "image" || e.shiftKey);
    resizeRef.current = {
      startX: e.clientX, startY: e.clientY,
      origW: el.width, origH: el.height,
    };
    // Also stash original x/y for NW corner dragging
    const origX = el.x, origY = el.y;
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ignore */ }
    const onMove = (ev: PointerEvent) => {
      if (!resizeRef.current) return;
      const dx = (ev.clientX - resizeRef.current.startX) / scale;
      const dy = (ev.clientY - resizeRef.current.startY) / scale;
      let { origW, origH } = resizeRef.current;
      let newW = origW, newH = origH, newX = origX, newY = origY;

      if (corner === "se") {
        newW = Math.max(20, origW + dx);
        newH = lockAR ? newW * ar : Math.max(20, origH + dy);
      } else if (corner === "sw") {
        newW = Math.max(20, origW - dx);
        newH = lockAR ? newW * ar : Math.max(20, origH + dy);
        newX = origX + (origW - newW);
      } else if (corner === "ne") {
        newW = Math.max(20, origW + dx);
        newH = lockAR ? newW * ar : Math.max(20, origH - dy);
        newY = origY + (origH - newH);
      } else { // nw
        newW = Math.max(20, origW - dx);
        newH = lockAR ? newW * ar : Math.max(20, origH - dy);
        newX = origX + (origW - newW);
        newY = origY + (origH - newH);
      }
      updateElement(id, { width: newW, height: newH, x: newX, y: newY }, false);
    };
    const onUp = () => {
      resizeRef.current = null;
      pushHistory(historyRef.current[historyIdx.current]);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function onRotatePointerDown(e: React.PointerEvent, id: string) {
    e.stopPropagation(); e.preventDefault();
    const el = data.elements.find((x) => x.id === id)!;
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;
    const mx = (e.clientX - canvasRect.left) / scale;
    const my = (e.clientY - canvasRect.top) / scale;
    const startAngle = Math.atan2(my - cy, mx - cx) * 180 / Math.PI;
    rotateRef.current = { startAngle, origRotation: el.rotation ?? 0, cx, cy };
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ignore */ }
    const onMove = (ev: PointerEvent) => {
      if (!rotateRef.current || !canvasRect) return;
      const mx2 = (ev.clientX - canvasRect.left) / scale;
      const my2 = (ev.clientY - canvasRect.top) / scale;
      const angle = Math.atan2(my2 - rotateRef.current.cy, mx2 - rotateRef.current.cx) * 180 / Math.PI;
      const delta = angle - rotateRef.current.startAngle;
      updateElement(id, { rotation: Math.round(rotateRef.current.origRotation + delta) }, false);
    };
    const onUp = () => {
      rotateRef.current = null;
      pushHistory(historyRef.current[historyIdx.current]);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function onCanvasClick(e: React.MouseEvent) {
    if ((e.target as HTMLElement) === canvasRef.current) setSelectedId(null);
  }

  // Keyboard shortcuts — use refs to avoid stale closures and unnecessary re-registration
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      const activeEl = document.activeElement as HTMLElement;
      const inInput = activeEl?.tagName === "INPUT" || activeEl?.tagName === "TEXTAREA" || activeEl?.isContentEditable;

      if (meta && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if (meta && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); redo(); return; }
      if (meta && e.key === "d") { e.preventDefault(); duplicateSelected(); return; }

      if ((e.key === "Delete" || e.key === "Backspace") && selectedIdRef.current && !inInput) {
        deleteSelected();
        return;
      }

      // Arrow key nudge — 1px normally, 10px with Shift
      if (selectedIdRef.current && !inInput && ["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key)) {
        e.preventDefault();
        const dist = e.shiftKey ? 10 : 1;
        const id = selectedIdRef.current;
        const el = dataRef.current.elements.find((x) => x.id === id);
        if (!el || el.locked) return;
        const dx = e.key === "ArrowLeft" ? -dist : e.key === "ArrowRight" ? dist : 0;
        const dy = e.key === "ArrowUp" ? -dist : e.key === "ArrowDown" ? dist : 0;
        updateElement(id, { x: el.x + dx, y: el.y + dy });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // stable — uses refs internally

  async function captureCanvas(): Promise<string> {
    const { toPng } = await import("html-to-image");
    const el = canvasRef.current!;
    // Wait for all web fonts to load so text renders correctly in the export
    await document.fonts.ready;
    // Remove the zoom transform so html-to-image captures the element at its
    // native CSS size (data.width × data.height) with no scaling artifacts.
    const saved = el.style.transform;
    el.style.transform = "none";
    try {
      // Run twice — first pass loads cross-origin images into the browser cache,
      // second pass captures them correctly (html-to-image known limitation)
      await toPng(el, { pixelRatio: 2, width: data.width, height: data.height });
      return await toPng(el, { pixelRatio: 2, width: data.width, height: data.height });
    } finally {
      el.style.transform = saved;
    }
  }

  async function exportPng() {
    if (!canvasRef.current) return;
    const url = await captureCanvas();
    const a = document.createElement("a"); a.href = url; a.download = `${title}.png`; a.click();
  }

  async function duplicateDesign() {
    const root = title.replace(/ \(Copy\)$/, "").replace(/ v\d+$/, "").replace(/ Remix$/, "");
    const newTitle = `${root} (Copy)`;
    const res = await fetch("/api/designs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle, data }),
    });
    const json = await res.json();
    if (!json.design?.id) return;
    toast({
      title: "Remix created",
      description: `"${newTitle}" is ready.`,
    });
    router.push(`/dashboard/design-studio/${json.design.id}`);
  }

  async function exportPdf() {
    const { jsPDF } = await import("jspdf");
    if (!canvasRef.current) return;
    const url = await captureCanvas();
    const mmW = data.width * 0.2646;
    const mmH = data.height * 0.2646;
    const pdf = new jsPDF({ orientation: mmW > mmH ? "landscape" : "portrait", unit: "mm", format: [mmW, mmH] });
    pdf.addImage(url, "PNG", 0, 0, mmW, mmH);
    pdf.save(`${title}.pdf`);
  }

  const panelCls = isDark ? "border-[#2A2A2A] bg-[#1A1A1A]" : "border-gray-200 bg-white";

  if (loading) return <div className="flex items-center justify-center h-full min-h-[50dvh]"><Loader2 className="w-6 h-6 animate-spin text-orange-500" /></div>;

  return (
    <div className={`flex flex-col flex-1 min-h-0 overflow-hidden ${isDark ? "bg-[#0F0F0F] text-white" : "bg-[#F9FAFB] text-gray-900"}`}>

      {/* Top bar */}
      <header className={`shrink-0 flex items-center justify-between gap-2 px-3 md:px-4 border-b overflow-x-hidden ${isDark ? "bg-[#0F0F0F]/95 border-[#2A2A2A]" : "bg-white/95 border-gray-200"} backdrop-blur-sm shadow-sm z-40`} style={{ height: 52 }}>
        <div className="flex items-center gap-2 md:gap-3 min-w-0 shrink">
          <Link
            href={bundleId ? `/dashboard/design-studio/bundle/${bundleId}` : "/dashboard/design-studio"}
            className={`flex items-center gap-1 text-sm shrink-0 ${isDark ? "text-gray-400 hover:text-orange-500" : "text-gray-500 hover:text-orange-500"}`}
          >
            <ChevronLeft className="w-4 h-4" /> {bundleId ? "Bundle" : "Back"}
          </Link>
          <div className={`h-5 w-px hidden sm:block ${isDark ? "bg-[#2A2A2A]" : "bg-gray-200"}`} />
          {editingTitle
            ? <Input autoFocus value={title} onChange={(e) => updateTitle(e.target.value)} onBlur={() => setEditingTitle(false)} onKeyDown={(e) => { if (e.key === "Enter") setEditingTitle(false); }} className="h-7 text-sm font-semibold w-32 sm:w-44 px-2" />
            : <button onClick={() => setEditingTitle(true)} className={`text-sm font-semibold truncate max-w-[100px] sm:max-w-[180px] hover:text-orange-500 ${isDark ? "text-white" : "text-gray-900"}`}>{title}</button>}
          {saving ? <span className="hidden sm:flex items-center gap-1 text-xs text-gray-400"><Loader2 className="w-3 h-3 animate-spin" /> Saving…</span>
            : lastSaved ? <span className="hidden sm:flex items-center gap-1 text-xs text-emerald-600"><Check className="w-3 h-3" /> Saved</span> : null}
        </div>
        <div className="flex items-center gap-1 md:gap-1.5 shrink-0">
          <Button size="sm" variant="ghost" onClick={undo} className={`h-8 w-8 p-0 ${isDark ? "text-gray-400 hover:text-white" : "text-gray-500"}`} title="Undo (⌘Z)"><Undo2 className="w-4 h-4" /></Button>
          <Button size="sm" variant="ghost" onClick={redo} className={`h-8 w-8 p-0 ${isDark ? "text-gray-400 hover:text-white" : "text-gray-500"}`} title="Redo (⌘⇧Z)"><Redo2 className="w-4 h-4" /></Button>
          <div className={`hidden md:block h-5 w-px mx-1 ${isDark ? "bg-[#2A2A2A]" : "bg-gray-200"}`} />
          <Button size="sm" variant="ghost" onClick={() => setScale((s) => Math.max(0.2, +(s - 0.1).toFixed(1)))} className={`hidden md:inline-flex h-8 w-8 p-0 ${isDark ? "text-gray-400 hover:text-white" : "text-gray-500"}`} title="Zoom out"><ZoomOut className="w-4 h-4" /></Button>
          <span className={`hidden md:inline text-xs w-12 text-center tabular-nums ${isDark ? "text-gray-400" : "text-gray-500"}`}>{Math.round(scale * 100)}%</span>
          <Button size="sm" variant="ghost" onClick={() => setScale((s) => Math.min(2, +(s + 0.1).toFixed(1)))} className={`hidden md:inline-flex h-8 w-8 p-0 ${isDark ? "text-gray-400 hover:text-white" : "text-gray-500"}`} title="Zoom in"><ZoomIn className="w-4 h-4" /></Button>
          <div className={`hidden md:block h-5 w-px mx-1 ${isDark ? "bg-[#2A2A2A]" : "bg-gray-200"}`} />
          <Button size="sm" variant="ghost" onClick={() => setShowGrid((v) => !v)} className={`hidden md:inline-flex h-8 w-8 p-0 ${showGrid ? "text-orange-500" : isDark ? "text-gray-400 hover:text-white" : "text-gray-500"}`} title="Toggle grid overlay"><Grid3x3 className="w-4 h-4" /></Button>
          <Button size="sm" variant="ghost" onClick={() => setShowSafeArea((v) => !v)} className={`hidden md:inline-flex h-8 w-8 p-0 ${showSafeArea ? "text-orange-500" : isDark ? "text-gray-400 hover:text-white" : "text-gray-500"}`} title="Toggle safe area (TikTok/Reels)"><Smartphone className="w-4 h-4" /></Button>
          <div className={`hidden md:block h-5 w-px mx-1 ${isDark ? "bg-[#2A2A2A]" : "bg-gray-200"}`} />
          <Button size="sm" variant="outline" className={`hidden md:inline-flex gap-1.5 ${isDark ? "border-[#2A2A2A] text-gray-300 hover:text-white" : ""}`} onClick={duplicateDesign} title="Duplicate design">
            <Copy className="w-4 h-4" /> Duplicate
          </Button>
          <Button size="sm" variant="outline" className={`hidden md:inline-flex gap-1.5 ${isDark ? "border-[#2A2A2A] text-gray-300 hover:text-white" : ""}`} onClick={exportPdf}>
            <FileDown className="w-4 h-4" /> PDF
          </Button>
          <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white gap-1.5" onClick={exportPng}>
            <Download className="w-4 h-4" /> PNG
          </Button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Left tools panel — desktop only */}
        <aside className={`hidden md:flex w-[76px] shrink-0 border-r flex-col gap-0.5 py-3 px-1.5 items-center overflow-y-auto ${panelCls}`}>
          <SideLabel label="Add" isDark={isDark} />
          <ToolBtn icon={<Type className="w-5 h-5" />} label="Text" onClick={addText} isDark={isDark} />

          <button onClick={(e) => togglePanel("shapes", e)}
            className={`w-full flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg transition-colors ${activePanel === "shapes" ? "bg-orange-500 text-white" : isDark ? "text-gray-400 hover:bg-white/10 hover:text-white" : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"}`}>
            <div className="flex items-center gap-0.5"><Square className="w-5 h-5" /><ChevronDown className="w-3 h-3" /></div>
            <span className="text-[9px] font-medium leading-none">Shapes</span>
          </button>

          <ToolBtn icon={<ImageIcon className="w-5 h-5" />} label="Image" onClick={addImage} isDark={isDark} />

          <button onClick={(e) => togglePanel("ai", e)}
            className={`w-full flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg transition-colors ${activePanel === "ai" ? "bg-orange-500 text-white" : isDark ? "text-gray-400 hover:bg-white/10 hover:text-white" : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"}`}>
            <Sparkles className="w-5 h-5" />
            <span className="text-[9px] font-medium leading-none">AI Image</span>
          </button>

          <button onClick={(e) => togglePanel("templates", e)}
            className={`w-full flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg transition-colors ${activePanel === "templates" ? "bg-orange-500 text-white" : isDark ? "text-gray-400 hover:bg-white/10 hover:text-white" : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"}`}>
            <LayoutTemplate className="w-5 h-5" />
            <span className="text-[9px] font-medium leading-none">Templates</span>
          </button>

          <button onClick={(e) => togglePanel("uploads", e)}
            className={`w-full flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg transition-colors ${activePanel === "uploads" ? "bg-orange-500 text-white" : isDark ? "text-gray-400 hover:bg-white/10 hover:text-white" : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"}`}>
            <Images className="w-5 h-5" />
            <span className="text-[9px] font-medium leading-none">Uploads</span>
          </button>

          <button onClick={(e) => togglePanel("chat", e)}
            className={`w-full flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg transition-colors ${activePanel === "chat" ? "bg-orange-500 text-white" : isDark ? "text-gray-400 hover:bg-white/10 hover:text-white" : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"}`}>
            <MessageSquare className="w-5 h-5" />
            <span className="text-[9px] font-medium leading-none">AI Chat</span>
          </button>

          <div className={`w-full my-2 border-t ${isDark ? "border-[#2A2A2A]" : "border-gray-200"}`} />
          <SideLabel label="BG" isDark={isDark} />
          <div className="relative w-10 h-10 rounded-lg overflow-hidden border-2 cursor-pointer shadow-sm" style={{ borderColor: isDark ? "#2A2A2A" : "#e5e7eb" }}>
            <div className="absolute inset-0" style={{ background: buildBg(data) }} />
            <input type="color" value={data.background} onChange={(e) => updateData((prev) => ({ ...prev, background: e.target.value, backgroundType: "solid" }))} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
          </div>

          {selectedId && (
            <>
              <div className={`w-full my-2 border-t ${isDark ? "border-[#2A2A2A]" : "border-gray-200"}`} />
              <SideLabel label="Sel" isDark={isDark} />
              <ToolBtn icon={<Copy className="w-5 h-5" />} label="Copy" onClick={duplicateSelected} isDark={isDark} />
              <ToolBtn icon={<Trash2 className="w-5 h-5" />} label="Delete" onClick={deleteSelected} isDark={isDark} danger />
            </>
          )}
        </aside>

        {/* Canvas */}
        <div
          ref={containerRef}
          className={`flex-1 flex items-center justify-center overflow-auto p-2 sm:p-8 pb-editor-toolbar md:pb-8 ${selectedEl ? "pt-14" : ""} ${isDark ? "bg-[#151515]" : "bg-gray-100"}`}
          style={{ backgroundImage: isDark ? "radial-gradient(circle, #2A2A2A 1px, transparent 1px)" : "radial-gradient(circle, #d1d5db 1px, transparent 1px)", backgroundSize: "24px 24px" }}
          onClick={() => { setSelectedId(null); setActivePanel(null); }}
        >
          <div style={{ width: data.width * scale, height: data.height * scale, position: "relative", flexShrink: 0 }}>
            <div
              ref={canvasRef}
              style={{ width: data.width, height: data.height, background: buildBg(data), backgroundImage: data.backgroundImage && !(data.backgroundImageBlur ?? 0) ? `url(${getProxiedBackgroundImageUrl(data.backgroundImage) ?? data.backgroundImage})` : undefined, backgroundSize: data.backgroundImageFit ?? "cover", backgroundPosition: "center", position: "absolute", top: 0, left: 0, transform: `scale(${scale})`, transformOrigin: "top left", overflow: "hidden", boxShadow: "0 4px 40px rgba(0,0,0,0.25)" }}
              onClick={onCanvasClick}
            >
              {/* Blurred background image layer */}
              {data.backgroundImage && (data.backgroundImageBlur ?? 0) > 0 && (
                <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${getProxiedBackgroundImageUrl(data.backgroundImage) ?? data.backgroundImage})`, backgroundSize: data.backgroundImageFit ?? "cover", backgroundPosition: "center", filter: `blur(${data.backgroundImageBlur}px)`, transform: "scale(1.06)", transformOrigin: "center", zIndex: -1, pointerEvents: "none" }} />
              )}
              {/* Overlay / dim layer */}
              {(data.backgroundImageOverlayOpacity ?? 0) > 0 && data.backgroundImage && (
                <div style={{ position: "absolute", inset: 0, background: hexToRgba(data.backgroundImageOverlayColor ?? "#000000", data.backgroundImageOverlayOpacity ?? 0), zIndex: -1, pointerEvents: "none" }} />
              )}
              {/* Grid overlay */}
              {showGrid && (
                <div style={{ position: "absolute", inset: 0, zIndex: 1000, pointerEvents: "none", backgroundImage: "linear-gradient(rgba(99,102,241,0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.25) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
              )}
              {/* Safe area overlay (TikTok/Reels 9:16 safe zone ~10% inset) */}
              {showSafeArea && (
                <div style={{ position: "absolute", inset: 0, zIndex: 1001, pointerEvents: "none" }}>
                  <div style={{ position: "absolute", top: "10%", left: "10%", right: "10%", bottom: "10%", border: "2px dashed rgba(251,146,60,0.7)", borderRadius: 4 }} />
                  <span style={{ position: "absolute", top: "calc(10% + 4px)", left: "calc(10% + 6px)", fontSize: 11, color: "rgba(251,146,60,0.9)", fontFamily: "Inter, sans-serif", fontWeight: 600, letterSpacing: 0.3, userSelect: "none" }}>SAFE AREA</span>
                </div>
              )}
              {[...data.elements].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)).map((el) => (
                <CanvasElement key={el.id} el={el} selected={el.id === selectedId}
                  onPointerDown={onElementPointerDown}
                  onResizePointerDown={onResizePointerDown}
                  onResizeCornerPointerDown={onResizeCornerPointerDown}
                  onRotatePointerDown={onRotatePointerDown}
                  onUpdate={(patch) => updateElement(el.id, patch)} />
              ))}
            </div>
            {/* Snap guide overlays — rendered in scaled wrapper space */}
            {activeGuides.map((g, i) =>
              g.axis === "v" ? (
                <div key={i} style={{ position: "absolute", top: 0, bottom: 0, left: g.pos * scale, width: 1, background: "#f97316", pointerEvents: "none", zIndex: 9999 }} />
              ) : (
                <div key={i} style={{ position: "absolute", left: 0, right: 0, top: g.pos * scale, height: 1, background: "#f97316", pointerEvents: "none", zIndex: 9999 }} />
              )
            )}
          </div>
        </div>

        {/* Right panel — desktop only */}
        <aside className={`hidden md:flex w-64 shrink-0 border-l flex-col overflow-y-auto ${panelCls}`}>
          {selectedEl
            ? <ElementPanel el={selectedEl} isDark={isDark}
                onUpdate={(patch) => updateElement(selectedEl.id, patch)}
                onDelete={deleteSelected} onDuplicate={duplicateSelected}
                onAlign={alignEl} canvasW={data.width} canvasH={data.height}
                palette={data.activePalette} />
            : <CanvasPanel isDark={isDark} data={data}
                onUpdate={(patch) => updateData((prev) => ({ ...prev, ...patch }))}
                onApplyPalette={applyPaletteToDesign}
                onApplyTemplate={applyTemplate}
                elementCount={data.elements.length} />}
        </aside>

        {/* ── Element editing toolbar ────────────────────────────────────────
            Appears when an element is selected. Fixed below the 52px header.
            Horizontally scrollable so all controls are reachable on mobile.
        */}
        {selectedEl && (
          <div
            className={`fixed left-0 right-0 z-[49] overflow-x-auto border-b shadow-sm ${panelCls}`}
            style={{ top: 52, WebkitOverflowScrolling: "touch" } as React.CSSProperties}
          >
          <div className="inline-flex items-center gap-1 px-3 py-2 min-w-max">
            {/* Text-specific controls: color, font, size, bold/italic */}
            {selectedEl.type === "text" && !selectedEl.locked && (
              <>
                {/* Color picker */}
                <div className="flex flex-col items-center gap-0.5 min-w-[44px]">
                  <div className="relative w-7 h-7 rounded-lg overflow-hidden border-2 cursor-pointer shadow-sm" style={{ borderColor: isDark ? "#3A3A3A" : "#e5e7eb" }}>
                    <div className="absolute inset-0" style={{ background: selectedEl.color ?? "#1a1a1a" }} />
                    <input
                      type="color"
                      value={selectedEl.color ?? "#1a1a1a"}
                      onChange={(e) => updateElement(selectedEl.id, { color: e.target.value })}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      title="Text color"
                    />
                  </div>
                  <span className="text-[9px] font-medium leading-none">Color</span>
                </div>
                <div className={`w-px h-6 mx-0.5 ${isDark ? "bg-[#3A3A3A]" : "bg-gray-200"}`} />

                {/* Font family */}
                <div className="flex flex-col items-center gap-0.5">
                  <select
                    value={selectedEl.fontFamily ?? "Inter"}
                    onChange={(e) => updateElement(selectedEl.id, { fontFamily: e.target.value })}
                    className={`h-7 text-[10px] rounded-lg border px-1.5 cursor-pointer ${isDark ? "bg-[#1A1A1A] border-[#3A3A3A] text-gray-200" : "bg-white border-gray-200 text-gray-700"}`}
                    title="Font family"
                  >
                    {FONT_FAMILIES.map((f) => <option key={f}>{f}</option>)}
                  </select>
                  <span className="text-[9px] font-medium leading-none">Font</span>
                </div>
                <div className={`w-px h-6 mx-0.5 ${isDark ? "bg-[#3A3A3A]" : "bg-gray-200"}`} />

                {/* Bold / Italic */}
                <button
                  type="button"
                  onClick={() => updateElement(selectedEl.id, { fontWeight: selectedEl.fontWeight === "700" ? "400" : "700" })}
                  className={`flex flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 min-w-[44px] transition-colors ${selectedEl.fontWeight === "700" ? "bg-orange-500 text-white" : isDark ? "text-gray-300 hover:bg-white/10" : "text-gray-600 hover:bg-gray-100"}`}
                  title="Bold"
                >
                  <Bold className="w-4 h-4" />
                  <span className="text-[9px] font-medium leading-none">Bold</span>
                </button>
                <button
                  type="button"
                  onClick={() => updateElement(selectedEl.id, { fontStyle: selectedEl.fontStyle === "italic" ? "normal" : "italic" })}
                  className={`flex flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 min-w-[44px] transition-colors ${selectedEl.fontStyle === "italic" ? "bg-orange-500 text-white" : isDark ? "text-gray-300 hover:bg-white/10" : "text-gray-600 hover:bg-gray-100"}`}
                  title="Italic"
                >
                  <Italic className="w-4 h-4" />
                  <span className="text-[9px] font-medium leading-none">Italic</span>
                </button>
                <div className={`w-px h-6 mx-0.5 ${isDark ? "bg-[#3A3A3A]" : "bg-gray-200"}`} />

                {/* Font size */}
                <button
                  type="button"
                  onClick={() => updateElement(selectedEl.id, { fontSize: Math.max(8, (selectedEl.fontSize ?? 32) - 2) })}
                  className={`flex flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 min-w-[44px] transition-colors ${isDark ? "text-gray-300 hover:bg-white/10" : "text-gray-600 hover:bg-gray-100"}`}
                  title="Decrease font size"
                >
                  <Minus className="w-4 h-4" />
                  <span className="text-[9px] font-medium leading-none">Smaller</span>
                </button>
                <div className={`flex flex-col items-center justify-center rounded-xl px-2 py-1 min-w-[44px] ${isDark ? "bg-white/5 text-gray-200" : "bg-gray-100 text-gray-700"}`}>
                  <span className="text-sm font-bold leading-none">{selectedEl.fontSize ?? 32}</span>
                  <span className="text-[9px] font-medium leading-none mt-0.5">pt</span>
                </div>
                <button
                  type="button"
                  onClick={() => updateElement(selectedEl.id, { fontSize: (selectedEl.fontSize ?? 32) + 2 })}
                  className={`flex flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 min-w-[44px] transition-colors ${isDark ? "text-gray-300 hover:bg-white/10" : "text-gray-600 hover:bg-gray-100"}`}
                  title="Increase font size"
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-[9px] font-medium leading-none">Bigger</span>
                </button>
                <div className={`w-px h-6 mx-1 ${isDark ? "bg-[#3A3A3A]" : "bg-gray-200"}`} />
              </>
            )}

            {/* Lock / Unlock */}
            <button
              type="button"
              onClick={selectedEl.locked ? unlockSelected : lockSelected}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 min-w-[44px] transition-colors ${selectedEl.locked ? "bg-orange-500 text-white" : isDark ? "text-gray-300 hover:bg-white/10" : "text-gray-600 hover:bg-gray-100"}`}
              title={selectedEl.locked ? "Unlock" : "Lock"}
            >
              {selectedEl.locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              <span className="text-[9px] font-medium leading-none">{selectedEl.locked ? "Locked" : "Lock"}</span>
            </button>

            <div className={`w-px h-6 mx-1 ${isDark ? "bg-[#3A3A3A]" : "bg-gray-200"}`} />

            {/* Bring Forward */}
            <button
              type="button"
              onClick={bringForward}
              disabled={!!selectedEl.locked}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 min-w-[44px] transition-colors disabled:opacity-40 ${isDark ? "text-gray-300 hover:bg-white/10" : "text-gray-600 hover:bg-gray-100"}`}
              title="Bring forward (one step)"
            >
              <ArrowUp className="w-4 h-4" />
              <span className="text-[9px] font-medium leading-none">Forward</span>
            </button>

            {/* Send Backward */}
            <button
              type="button"
              onClick={sendBackward}
              disabled={!!selectedEl.locked}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 min-w-[44px] transition-colors disabled:opacity-40 ${isDark ? "text-gray-300 hover:bg-white/10" : "text-gray-600 hover:bg-gray-100"}`}
              title="Send backward (one step)"
            >
              <ArrowDown className="w-4 h-4" />
              <span className="text-[9px] font-medium leading-none">Back</span>
            </button>

            {/* Bring to Front */}
            <button
              type="button"
              onClick={bringToFront}
              disabled={!!selectedEl.locked}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 min-w-[44px] transition-colors disabled:opacity-40 ${isDark ? "text-gray-300 hover:bg-white/10" : "text-gray-600 hover:bg-gray-100"}`}
              title="Bring to front"
            >
              <MoveUp className="w-4 h-4" />
              <span className="text-[9px] font-medium leading-none">Front</span>
            </button>

            {/* Send to Back */}
            <button
              type="button"
              onClick={sendToBack}
              disabled={!!selectedEl.locked}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 min-w-[44px] transition-colors disabled:opacity-40 ${isDark ? "text-gray-300 hover:bg-white/10" : "text-gray-600 hover:bg-gray-100"}`}
              title="Send to back"
            >
              <MoveDown className="w-4 h-4" />
              <span className="text-[9px] font-medium leading-none">Back-most</span>
            </button>

            <div className={`w-px h-6 mx-1 ${isDark ? "bg-[#3A3A3A]" : "bg-gray-200"}`} />

            {/* Duplicate */}
            <button
              type="button"
              onClick={duplicateSelected}
              disabled={!!selectedEl.locked}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 min-w-[44px] transition-colors disabled:opacity-40 ${isDark ? "text-gray-300 hover:bg-white/10" : "text-gray-600 hover:bg-gray-100"}`}
              title="Duplicate"
            >
              <Copy className="w-4 h-4" />
              <span className="text-[9px] font-medium leading-none">Copy</span>
            </button>

            {/* Delete */}
            <button
              type="button"
              onClick={deleteSelected}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 min-w-[44px] transition-colors ${isDark ? "text-red-400 hover:bg-red-500/20" : "text-red-500 hover:bg-red-50"}`}
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
              <span className="text-[9px] font-medium leading-none">Delete</span>
            </button>

            {/* Dismiss / deselect */}
            <div className={`w-px h-6 mx-1 ${isDark ? "bg-[#3A3A3A]" : "bg-gray-200"}`} />
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 min-w-[44px] transition-colors ${isDark ? "text-gray-400 hover:bg-white/10" : "text-gray-500 hover:bg-gray-100"}`}
              title="Deselect"
            >
              <X className="w-4 h-4" />
              <span className="text-[9px] font-medium leading-none">Done</span>
            </button>
          </div>{/* end scrollable inner */}
          </div>
        )}
      </div>

      {/* ── Mobile bottom toolbar ── fixed directly above app nav, no gap */}
      <div
        className={`md:hidden flex items-center justify-around border-t px-1 py-1 z-[48] ${panelCls}`}
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: "calc(3.5rem + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <button onClick={() => { addText(); }} className={`flex flex-col items-center gap-0.5 py-2 px-3 rounded-xl ${isDark ? "text-gray-300 hover:bg-white/10" : "text-gray-600 hover:bg-gray-100"}`}>
          <Type className="w-5 h-5" />
          <span className="text-[9px] font-medium">Text</span>
        </button>
        <button onClick={() => setMobileToolSheet((prev) => prev === "shapes" ? null : "shapes")} className={`flex flex-col items-center gap-0.5 py-2 px-3 rounded-xl ${mobileToolSheet === "shapes" ? "bg-orange-500 text-white" : isDark ? "text-gray-300 hover:bg-white/10" : "text-gray-600 hover:bg-gray-100"}`}>
          <Square className="w-5 h-5" />
          <span className="text-[9px] font-medium">Shapes</span>
        </button>
        <button onClick={() => setMobileToolSheet((prev) => prev === "uploads" ? null : "uploads")} className={`flex flex-col items-center gap-0.5 py-2 px-3 rounded-xl ${mobileToolSheet === "uploads" ? "bg-orange-500 text-white" : isDark ? "text-gray-300 hover:bg-white/10" : "text-gray-600 hover:bg-gray-100"}`}>
          <Images className="w-5 h-5" />
          <span className="text-[9px] font-medium">Uploads</span>
        </button>
        <button onClick={() => setMobileToolSheet((prev) => prev === "ai" ? null : "ai")} className={`flex flex-col items-center gap-0.5 py-2 px-3 rounded-xl ${mobileToolSheet === "ai" ? "bg-orange-500 text-white" : isDark ? "text-gray-300 hover:bg-white/10" : "text-gray-600 hover:bg-gray-100"}`}>
          <Sparkles className="w-5 h-5" />
          <span className="text-[9px] font-medium">AI</span>
        </button>
        <button onClick={() => setMobileToolSheet((prev) => prev === "templates" ? null : "templates")} className={`flex flex-col items-center gap-0.5 py-2 px-3 rounded-xl ${mobileToolSheet === "templates" ? "bg-orange-500 text-white" : isDark ? "text-gray-300 hover:bg-white/10" : "text-gray-600 hover:bg-gray-100"}`}>
          <LayoutTemplate className="w-5 h-5" />
          <span className="text-[9px] font-medium">Templates</span>
        </button>
        <button onClick={() => setMobileToolSheet((prev) => prev === "background" ? null : "background")} className={`flex flex-col items-center gap-0.5 py-2 px-3 rounded-xl ${mobileToolSheet === "background" ? "bg-orange-500 text-white" : isDark ? "text-gray-300 hover:bg-white/10" : "text-gray-600 hover:bg-gray-100"}`}>
          <Palette className="w-5 h-5" />
          <span className="text-[9px] font-medium">Canvas</span>
        </button>
        {/* Zoom controls — mobile only */}
        <button onClick={() => setScale((s) => Math.max(0.2, +(s - 0.15).toFixed(2)))} className={`flex flex-col items-center gap-0.5 py-2 px-3 rounded-xl ${isDark ? "text-gray-300 hover:bg-white/10" : "text-gray-600 hover:bg-gray-100"}`}>
          <ZoomOut className="w-5 h-5" />
          <span className="text-[9px] font-medium">{Math.round(scale * 100)}%</span>
        </button>
        <button onClick={() => setScale((s) => Math.min(3, +(s + 0.15).toFixed(2)))} className={`flex flex-col items-center gap-0.5 py-2 px-3 rounded-xl ${isDark ? "text-gray-300 hover:bg-white/10" : "text-gray-600 hover:bg-gray-100"}`}>
          <ZoomIn className="w-5 h-5" />
          <span className="text-[9px] font-medium">Zoom</span>
        </button>
        <button onClick={() => setMobileSettingsOpen((prev) => !prev)} className={`flex flex-col items-center gap-0.5 py-2 px-3 rounded-xl ${mobileSettingsOpen ? "bg-orange-500 text-white" : isDark ? "text-gray-300 hover:bg-white/10" : "text-gray-600 hover:bg-gray-100"}`}>
          <Settings2 className="w-5 h-5" />
          <span className="text-[9px] font-medium">{selectedId ? "Element" : "Settings"}</span>
        </button>
      </div>

      {/* ── Mobile tool Sheet ── */}
      <Sheet open={mobileToolSheet !== null} onOpenChange={(o) => { if (!o) setMobileToolSheet(null); }}>
        <SheetContent side="bottom" className={`h-[65dvh] rounded-t-2xl p-0 flex flex-col ${isDark ? "bg-[#1A1A1A] border-[#2A2A2A] text-white" : "bg-white text-gray-900"}`}>
          <div className={`flex items-center justify-between px-4 py-3 border-b shrink-0 ${isDark ? "border-[#2A2A2A]" : "border-gray-100"}`}>
            <p className="text-sm font-semibold capitalize">{mobileToolSheet === "background" ? "Canvas & Background" : mobileToolSheet}</p>
            <button onClick={() => setMobileToolSheet(null)} className={`p-1.5 rounded-lg ${isDark ? "hover:bg-white/10 text-gray-400" : "hover:bg-gray-100 text-gray-500"}`}><X className="w-4 h-4" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">

            {/* Shapes */}
            {mobileToolSheet === "shapes" && (
              <>
                <p className={`text-[10px] font-bold uppercase tracking-widest mb-3 ${isDark ? "text-gray-500" : "text-gray-400"}`}>Choose a shape</p>
                <div className="grid grid-cols-5 gap-2">
                  {SHAPES.map((s) => (
                    <button key={s.id} onClick={() => { addShape(s.id); setMobileToolSheet(null); }} title={s.label}
                      className={`flex flex-col items-center gap-1 p-2 rounded-lg ${isDark ? "hover:bg-white/10" : "hover:bg-gray-100"}`}>
                      <div className="w-10 h-10">{s.render("#f97316")}</div>
                      <span className={`text-[9px] leading-tight text-center line-clamp-1 ${isDark ? "text-gray-400" : "text-gray-500"}`}>{s.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* AI Image */}
            {mobileToolSheet === "ai" && (
              <>
                <p className="text-sm font-semibold mb-1">Generate AI Image</p>
                <p className={`text-xs mb-3 ${isDark ? "text-gray-400" : "text-gray-500"}`}>Uses 10 video credits · Background auto-removed{liveCredits !== null ? ` · Balance: ${liveCredits}` : ""}</p>
                <textarea value={aiPrompt} onChange={(e) => { setAiPrompt(e.target.value); setAiError(null); }}
                  placeholder="e.g. golden crown on white background, detailed illustration"
                  rows={3}
                  className={`w-full text-sm rounded-xl border px-3 py-2.5 resize-none mb-3 ${isDark ? "bg-[#111] border-[#2A2A2A] text-white placeholder-gray-600" : "bg-white border-gray-200 text-gray-900 placeholder-gray-400"}`} />
                <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${isDark ? "text-gray-500" : "text-gray-400"}`}>Style</p>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {(["bold","minimalist","vintage","abstract","lineart","typography"] as const).map((val) => {
                    const lbls: Record<string, string> = { bold:"Bold", minimalist:"Minimal", vintage:"Vintage", abstract:"Abstract", lineart:"Line Art", typography:"Typography" };
                    return (
                      <button key={val} onClick={() => setAiStyle(val)}
                        className={`py-2 rounded-xl text-xs font-medium border transition-colors ${aiStyle === val ? "bg-orange-500 text-white border-orange-500" : isDark ? "border-[#2A2A2A] text-gray-400" : "border-gray-200 text-gray-600"}`}>
                        {lbls[val]}
                      </button>
                    );
                  })}
                </div>
                {aiError && <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-3">{aiError}</p>}
                <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white gap-2 h-11 text-sm" onClick={generateAiImage} disabled={aiLoading || !aiPrompt.trim()}>
                  {aiLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : <><Sparkles className="w-4 h-4" /> Generate Image</>}
                </Button>
              </>
            )}

            {/* Uploads */}
            {mobileToolSheet === "uploads" && (
              <>
                <Button size="sm" variant="outline" className={`w-full mb-3 gap-2 h-11 text-sm ${isDark ? "border-[#2A2A2A] text-gray-300" : ""}`}
                  onClick={addImage} disabled={uploadLoading}>
                  {uploadLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</> : <><Images className="w-4 h-4" /> Upload new image</>}
                </Button>
                {uploadError && (
                  <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{uploadError}</p>
                )}
                {recentUploads.length === 0
                  ? <p className={`text-sm text-center py-8 ${isDark ? "text-gray-600" : "text-gray-400"}`}>No uploads yet. Upload an image to get started.</p>
                  : <div className="grid grid-cols-3 gap-2">
                      {recentUploads.map((url) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <button key={url} onClick={() => { addImageUrl(url); setMobileToolSheet(null); }}
                          className={`rounded-xl overflow-hidden border-2 hover:border-orange-500 transition-colors ${isDark ? "border-[#2A2A2A]" : "border-gray-200"}`}>
                          <img src={url} alt="" className="w-full h-20 object-cover"
                            onError={(e) => {
                              setRecentUploads((prev) => {
                                const next = prev.filter((u) => u !== url);
                                try { localStorage.setItem("cf_design_uploads", JSON.stringify(next)); } catch { /* ignore */ }
                                return next;
                              });
                              (e.currentTarget.parentElement as HTMLElement)?.remove();
                            }}
                          />
                        </button>
                      ))}
                    </div>
                }
              </>
            )}

            {/* Templates */}
            {mobileToolSheet === "templates" && (
              <>
                <p className="text-sm font-semibold mb-1">Templates</p>
                <p className={`text-xs mb-3 ${isDark ? "text-gray-400" : "text-gray-500"}`}>Tap to apply — replaces background &amp; adds starter elements</p>
                <div className="grid grid-cols-2 gap-3">
                  {TEMPLATES.map((tpl) => (
                    <button key={tpl.id} onClick={() => { applyTemplate(tpl); setMobileToolSheet(null); }}
                      className={`rounded-xl overflow-hidden border-2 hover:border-orange-500 transition-colors text-left ${isDark ? "border-[#2A2A2A]" : "border-gray-200"}`}>
                      <div className="h-24" style={{ background: tpl.preview }} />
                      <div className={`px-2 py-2 text-xs font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}>{tpl.label}</div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Canvas / Background */}
            {mobileToolSheet === "background" && (
              <>
                <p className={`text-[10px] font-bold uppercase tracking-widest mb-3 ${isDark ? "text-gray-500" : "text-gray-400"}`}>Background color</p>
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden border-2 cursor-pointer shadow-sm flex-shrink-0" style={{ borderColor: isDark ? "#2A2A2A" : "#e5e7eb" }}>
                    <div className="absolute inset-0" style={{ background: buildBg(data) }} />
                    <input type="color" value={data.background} onChange={(e) => updateData((prev) => ({ ...prev, background: e.target.value, backgroundType: "solid" }))} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                  </div>
                  <span className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>Tap to pick a color</span>
                </div>
                <p className={`text-[10px] font-bold uppercase tracking-widest mb-3 ${isDark ? "text-gray-500" : "text-gray-400"}`}>Quick colors</p>
                <div className="grid grid-cols-10 gap-1.5 mb-4">
                  {QUICK_COLORS.map((c) => (
                    <button key={c} onClick={() => updateData((prev) => ({ ...prev, background: c, backgroundType: "solid" }))}
                      className="w-7 h-7 rounded-lg border-2 transition-all hover:scale-110"
                      style={{ background: c, borderColor: data.background === c ? "#f97316" : isDark ? "#3A3A3A" : "#e5e7eb" }} />
                  ))}
                </div>
                <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${isDark ? "text-gray-500" : "text-gray-400"}`}>Canvas size</p>
                <p className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>{data.width} × {data.height} px</p>
              </>
            )}

          </div>
        </SheetContent>
      </Sheet>

      {/* ── Mobile settings Sheet ── */}
      <Sheet open={mobileSettingsOpen} onOpenChange={setMobileSettingsOpen}>
        <SheetContent side="bottom" className={`h-[75dvh] rounded-t-2xl p-0 flex flex-col ${isDark ? "bg-[#1A1A1A] border-[#2A2A2A] text-white" : "bg-white text-gray-900"}`}>
          <div className={`flex items-center justify-between px-4 py-3 border-b shrink-0 ${isDark ? "border-[#2A2A2A]" : "border-gray-100"}`}>
            <p className="text-sm font-semibold">{selectedEl ? "Element Settings" : "Canvas Settings"}</p>
            <button onClick={() => setMobileSettingsOpen(false)} className={`p-1.5 rounded-lg ${isDark ? "hover:bg-white/10 text-gray-400" : "hover:bg-gray-100 text-gray-500"}`}><X className="w-4 h-4" /></button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {selectedEl
              ? <ElementPanel el={selectedEl} isDark={isDark}
                  onUpdate={(patch) => updateElement(selectedEl.id, patch)}
                  onDelete={() => { deleteSelected(); setMobileSettingsOpen(false); }}
                  onDuplicate={duplicateSelected}
                  onAlign={alignEl} canvasW={data.width} canvasH={data.height}
                  palette={data.activePalette} />
              : <CanvasPanel isDark={isDark} data={data}
                  onUpdate={(patch) => updateData((prev) => ({ ...prev, ...patch }))}
                  onApplyPalette={applyPaletteToDesign}
                  onApplyTemplate={applyTemplate}
                  elementCount={data.elements.length} />}
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Flyout panels – fixed so they escape overflow clipping ── */}
      {activePanel && (
        <div style={{ position: "fixed", left: flyoutPos.x, top: Math.min(flyoutPos.y, Math.max(8, window.innerHeight - (activePanel === "chat" ? 520 : 420))), zIndex: 300, maxHeight: "calc(100dvh - 16px)", display: "flex", flexDirection: "column" }}
          className={`rounded-xl border shadow-2xl ${isDark ? "bg-[#1A1A1A] border-[#2A2A2A] text-white" : "bg-white border-gray-200 text-gray-900"}`}>

          {/* Shapes */}
          {activePanel === "shapes" && (
            <div className="p-3 w-72">
              <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${isDark ? "text-gray-500" : "text-gray-400"}`}>Choose a shape</p>
              <div className="grid grid-cols-5 gap-2">
                {SHAPES.map((s) => (
                  <button key={s.id} onClick={() => addShape(s.id)} title={s.label}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg ${isDark ? "hover:bg-white/10" : "hover:bg-gray-100"}`}>
                    <div className="w-9 h-9">{s.render("#f97316")}</div>
                    <span className={`text-[9px] leading-tight text-center line-clamp-1 ${isDark ? "text-gray-400" : "text-gray-500"}`}>{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* AI Image */}
          {activePanel === "ai" && (
            <div className="p-4 w-80">
              <p className="text-sm font-semibold mb-1">Generate AI Image</p>
              <p className={`text-xs mb-3 ${isDark ? "text-gray-400" : "text-gray-500"}`}>Uses 10 video credits · Background auto-removed{liveCredits !== null ? ` · Balance: ${liveCredits}` : ""}</p>
              <textarea value={aiPrompt} onChange={(e) => { setAiPrompt(e.target.value); setAiError(null); }}
                placeholder="e.g. golden crown on white background, detailed illustration"
                rows={3}
                className={`w-full text-xs rounded-lg border px-3 py-2 resize-none mb-3 ${isDark ? "bg-[#111] border-[#2A2A2A] text-white placeholder-gray-600" : "bg-white border-gray-200 text-gray-900 placeholder-gray-400"}`} />
              <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${isDark ? "text-gray-500" : "text-gray-400"}`}>Style</p>
              <div className="grid grid-cols-3 gap-1.5 mb-3">
                {(["bold","minimalist","vintage","abstract","lineart","typography"] as const).map((val) => {
                  const lbls: Record<string, string> = { bold:"Bold", minimalist:"Minimal", vintage:"Vintage", abstract:"Abstract", lineart:"Line Art", typography:"Typography" };
                  return (
                    <button key={val} onClick={() => setAiStyle(val)}
                      className={`py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${aiStyle === val ? "bg-orange-500 text-white border-orange-500" : isDark ? "border-[#2A2A2A] text-gray-400 hover:border-gray-500" : "border-gray-200 text-gray-600 hover:border-gray-400"}`}>
                      {lbls[val]}
                    </button>
                  );
                })}
              </div>
              {aiError && <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{aiError}</p>}
              <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white gap-2" onClick={generateAiImage} disabled={aiLoading || !aiPrompt.trim()}>
                {aiLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : <><Sparkles className="w-4 h-4" /> Generate Image</>}
              </Button>
            </div>
          )}

          {/* Templates */}
          {activePanel === "templates" && (
            <div className="p-4 w-80">
              <p className="text-sm font-semibold mb-1">Templates</p>
              <p className={`text-xs mb-3 ${isDark ? "text-gray-400" : "text-gray-500"}`}>Click to apply — replaces background &amp; adds starter elements</p>
              <div className="grid grid-cols-2 gap-2">
                {TEMPLATES.map((tpl) => (
                  <button key={tpl.id} onClick={() => applyTemplate(tpl)}
                    className={`rounded-xl overflow-hidden border-2 hover:border-orange-500 transition-colors text-left ${isDark ? "border-[#2A2A2A]" : "border-gray-200"}`}>
                    <div className="h-20" style={{ background: tpl.preview }} />
                    <div className={`px-2 py-1.5 text-xs font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}>{tpl.label}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Uploads */}
          {activePanel === "uploads" && (
            <div className="p-4 w-72">
              <p className="text-sm font-semibold mb-1">My Uploads</p>
              <p className={`text-xs mb-3 ${isDark ? "text-gray-400" : "text-gray-500"}`}>Click an image to add it to the canvas</p>
              <Button size="sm" variant="outline" className={`w-full mb-3 gap-2 ${isDark ? "border-[#2A2A2A] text-gray-300" : ""}`}
                onClick={addImage} disabled={uploadLoading}>
                {uploadLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</> : <><Images className="w-4 h-4" /> Upload new image</>}
              </Button>
              {uploadError && (
                <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{uploadError}</p>
              )}
              {recentUploads.length === 0
                ? <p className={`text-xs text-center py-6 ${isDark ? "text-gray-600" : "text-gray-400"}`}>No uploads yet. Upload an image to get started.</p>
                : <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                    {recentUploads.map((url) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <button key={url} onClick={() => { addImageUrl(url); setActivePanel(null); }}
                        className={`rounded-lg overflow-hidden border-2 hover:border-orange-500 transition-colors ${isDark ? "border-[#2A2A2A]" : "border-gray-200"}`}>
                        <img
                          src={url} alt="" className="w-full h-16 object-cover"
                          onError={(e) => {
                            // Remove broken URL from localStorage and state
                            setRecentUploads((prev) => {
                              const next = prev.filter((u) => u !== url);
                              try { localStorage.setItem("cf_design_uploads", JSON.stringify(next)); } catch { /* ignore */ }
                              return next;
                            });
                            (e.currentTarget.parentElement as HTMLElement)?.remove();
                          }}
                        />
                      </button>
                    ))}
                  </div>
              }
            </div>
          )}

          {/* AI Chat */}
          {activePanel === "chat" && (
            <div className="flex flex-col w-80" style={{ height: "min(500px, calc(100dvh - 80px))" }}>
              {/* Header */}
              <div className={`px-4 py-3 border-b shrink-0 ${isDark ? "border-[#2A2A2A]" : "border-gray-200"}`}>
                <p className="text-sm font-semibold flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-orange-500" /> AI Design Chat
                </p>
                {/* Product picker */}
                <div className="mt-2">
                  <select
                    value={data.productId ?? ""}
                    onChange={(e) => {
                      const p = chatProducts.find((x) => x.id === e.target.value);
                      updateData((prev) => ({ ...prev, productId: p?.id ?? undefined, productName: p?.title ?? undefined }));
                    }}
                    className={`w-full text-xs rounded-lg border px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-400 ${isDark ? "bg-[#111] border-[#2A2A2A] text-white" : "bg-white border-gray-200 text-gray-900"}`}
                  >
                    <option value="">No product (blank canvas)</option>
                    {chatProducts.map((p) => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                  {data.productName && (
                    <p className={`text-[10px] mt-1 flex items-center gap-1 ${isDark ? "text-orange-400" : "text-orange-500"}`}>
                      <Package className="w-2.5 h-2.5" /> AI will use this product as context
                    </p>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
                {chatMessages.length === 0 && (
                  <div className={`text-xs text-center py-6 space-y-2 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                    <MessageSquare className="w-8 h-8 mx-auto opacity-30" />
                    <p>Try: &ldquo;Make me a story post for this product&rdquo;</p>
                    <p className="opacity-70">or &ldquo;Design a bold banner with a call to action&rdquo;</p>
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                      msg.role === "user"
                        ? "bg-orange-500 text-white rounded-br-sm"
                        : isDark ? "bg-[#2A2A2A] text-gray-200 rounded-bl-sm" : "bg-gray-100 text-gray-800 rounded-bl-sm"
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className={`rounded-xl rounded-bl-sm px-3 py-2 ${isDark ? "bg-[#2A2A2A]" : "bg-gray-100"}`}>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-500" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div className={`p-3 border-t shrink-0 ${isDark ? "border-[#2A2A2A]" : "border-gray-200"}`}>
                <div className="flex gap-2">
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }}
                    placeholder="e.g. Make me a story post…"
                    className={`flex-1 text-xs rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400 ${isDark ? "bg-[#111] border-[#2A2A2A] text-white placeholder-gray-600" : "bg-white border-gray-200 text-gray-900 placeholder-gray-400"}`}
                  />
                  <button
                    onClick={sendChatMessage}
                    disabled={chatLoading || !chatInput.trim()}
                    className="shrink-0 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white rounded-lg px-3 py-2 transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function SideLabel({ label, isDark }: { label: string; isDark: boolean }) {
  return <p className={`text-[9px] font-bold uppercase tracking-widest mb-0.5 ${isDark ? "text-gray-600" : "text-gray-400"}`}>{label}</p>;
}

function ToolBtn({ icon, label, onClick, isDark, danger }: { icon: React.ReactNode; label: string; onClick: () => void; isDark: boolean; danger?: boolean }) {
  return (
    <button onClick={onClick} title={label}
      className={`w-full flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg transition-colors ${danger ? "text-red-400 hover:bg-red-500/10" : isDark ? "text-gray-400 hover:bg-white/10 hover:text-white" : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"}`}>
      {icon}
      <span className="text-[9px] font-medium leading-none">{label}</span>
    </button>
  );
}

// ── Canvas element ─────────────────────────────────────────────────────────

function CanvasElement({ el, selected, onPointerDown, onResizePointerDown, onResizeCornerPointerDown, onRotatePointerDown, onUpdate }: {
  el: DesignElement; selected: boolean;
  onPointerDown: (e: React.PointerEvent, id: string) => void;
  onResizePointerDown: (e: React.PointerEvent, id: string) => void;
  onResizeCornerPointerDown: (e: React.PointerEvent, id: string, corner: "nw" | "ne" | "sw" | "se") => void;
  onRotatePointerDown: (e: React.PointerEvent, id: string) => void;
  onUpdate: (patch: Partial<DesignElement>) => void;
}) {
  const [editing, setEditing] = useState(false);
  // Pinch-to-resize state — tracks the initial pinch distance + element size
  const pinchRef = useRef<{ startDist: number; origW: number; origH: number } | null>(null);

  const shadow = el.shadowBlur || el.shadowX || el.shadowY
    ? `drop-shadow(${el.shadowX ?? 0}px ${el.shadowY ?? 4}px ${el.shadowBlur ?? 8}px ${el.shadowColor ?? "rgba(0,0,0,0.4)"})`
    : undefined;
  const elBlur = (el.blur ?? 0) > 0 ? `blur(${el.blur}px)` : undefined;
  const filterVal = [shadow, elBlur].filter(Boolean).join(" ") || undefined;

  const flipTransform = [
    el.flipX ? "scaleX(-1)" : "",
    el.flipY ? "scaleY(-1)" : "",
  ].filter(Boolean).join(" ") || undefined;

  const base: React.CSSProperties = {
    position: "absolute", left: el.x, top: el.y, width: el.width, height: el.height,
    opacity: el.opacity ?? 1,
    cursor: el.locked ? "not-allowed" : "move",
    userSelect: "none",
    touchAction: "none",
    transform: `rotate(${el.rotation ?? 0}deg)${flipTransform ? ` ${flipTransform}` : ""}`,
    transformOrigin: "center center",
    filter: filterVal,
    // Thicker, more visible selection ring — especially important on mobile
    outline: selected ? "2.5px solid #f97316" : "none",
    outlineOffset: 3,
    // Subtle glow on selected elements to aid discoverability
    boxShadow: selected ? "0 0 0 4px rgba(249,115,22,0.18)" : undefined,
    zIndex: el.zIndex ?? 0,
  };

  // Pinch handlers — two touches on the element resize it proportionally
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && !el.locked) {
      e.preventDefault();
      const t1 = e.touches[0], t2 = e.touches[1];
      pinchRef.current = {
        startDist: Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY),
        origW: el.width, origH: el.height,
      };
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current && !el.locked) {
      e.preventDefault();
      const t1 = e.touches[0], t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const ratio = dist / pinchRef.current.startDist;
      onUpdate({
        width: Math.max(20, pinchRef.current.origW * ratio),
        height: Math.max(20, pinchRef.current.origH * ratio),
      });
    }
  };
  const onTouchEnd = () => { pinchRef.current = null; };

  const rotateHandle = selected && !el.locked ? (
    <div
      data-rotate="true"
      onPointerDown={(e) => onRotatePointerDown(e, el.id)}
      style={{
        position: "absolute", top: -40, left: "50%", transform: "translateX(-50%)",
        width: 32, height: 32, background: "#f97316", border: "2px solid white",
        borderRadius: "50%", cursor: "grab", zIndex: 1000, touchAction: "none",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <RotateCw style={{ width: 14, height: 14, color: "white", pointerEvents: "none" }} />
    </div>
  ) : null;

  // 4-corner resize handles, shown when selected and not locked
  const cornerHandles = selected && !el.locked ? (
    <>
      <CornerHandle corner="nw" onPointerDown={(e) => onResizeCornerPointerDown(e, el.id, "nw")} />
      <CornerHandle corner="ne" onPointerDown={(e) => onResizeCornerPointerDown(e, el.id, "ne")} />
      <CornerHandle corner="sw" onPointerDown={(e) => onResizeCornerPointerDown(e, el.id, "sw")} />
      <CornerHandle corner="se" onPointerDown={(e) => onResizeCornerPointerDown(e, el.id, "se")} />
    </>
  ) : null;

  const sharedTouchProps = { onTouchStart, onTouchMove, onTouchEnd };

  if (el.type === "text") return (
    <div style={base} onPointerDown={(e) => onPointerDown(e, el.id)} onClick={(e) => e.stopPropagation()} onDoubleClick={() => !el.locked && setEditing(true)} {...sharedTouchProps}>
      {rotateHandle}
      {editing ? (
        <textarea autoFocus value={el.content ?? ""} onChange={(e) => onUpdate({ content: e.target.value })} onBlur={() => setEditing(false)}
          style={{ width: "100%", height: "100%", background: el.textBackground ?? "transparent", border: "none", outline: "none", resize: "none", fontFamily: el.fontFamily ?? "Inter", fontSize: el.fontSize ?? 32, color: el.color ?? "#1a1a1a", fontWeight: el.fontWeight ?? "normal", fontStyle: el.fontStyle ?? "normal", textDecoration: el.textDecoration, textAlign: (el.textAlign as React.CSSProperties["textAlign"]) ?? "left", lineHeight: el.lineHeight ?? 1.3, letterSpacing: `${el.letterSpacing ?? 0}px`, cursor: "text", touchAction: "auto" }} />
      ) : (
        <div style={{ width: "100%", height: "100%", background: el.textBackground ?? "transparent", fontFamily: el.fontFamily ?? "Inter", fontSize: el.fontSize ?? 32, color: el.color ?? "#1a1a1a", fontWeight: el.fontWeight ?? "normal", fontStyle: el.fontStyle ?? "normal", textDecoration: el.textDecoration, textAlign: (el.textAlign as React.CSSProperties["textAlign"]) ?? "left", lineHeight: el.lineHeight ?? 1.3, letterSpacing: `${el.letterSpacing ?? 0}px`, wordBreak: "break-word", whiteSpace: "pre-wrap", overflow: "visible" }}>
          {el.content}
        </div>
      )}
      {cornerHandles}
    </div>
  );

  if (el.type === "image") return (
    <div style={base} onPointerDown={(e) => onPointerDown(e, el.id)} onClick={(e) => e.stopPropagation()} {...sharedTouchProps}>
      {rotateHandle}
      {el.imageUrl
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={getProxiedBackgroundImageUrl(el.imageUrl) ?? el.imageUrl} crossOrigin="anonymous" alt="" style={{ width: "100%", height: "100%", objectFit: (el.objectFit as "cover" | "contain" | "fill") ?? "cover", display: "block", pointerEvents: "none" }} draggable={false} />
        : <div style={{ width: "100%", height: "100%", background: "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: 14 }}>🖼 No image</div>}
      {cornerHandles}
    </div>
  );

  const shapeDef = SHAPES.find((s) => s.id === (el.shapeType ?? "rect")) ?? SHAPES[0];
  return (
    <div style={{ ...base, overflow: "visible" }} onPointerDown={(e) => onPointerDown(e, el.id)} onClick={(e) => e.stopPropagation()} {...sharedTouchProps}>
      {rotateHandle}
      {shapeDef.render(el.fill ?? "#f97316", el.stroke, (el.strokeWidth ?? 0) > 0 ? el.strokeWidth : undefined)}
      {cornerHandles}
    </div>
  );
}

/** 4-corner resize handle — 28px visible, 44×44 touch target via negative margin */
function CornerHandle({ corner, onPointerDown }: {
  corner: "nw" | "ne" | "sw" | "se";
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const cursors: Record<string, string> = { nw: "nw-resize", ne: "ne-resize", sw: "sw-resize", se: "se-resize" };
  const pos: React.CSSProperties =
    corner === "nw" ? { top: -10, left: -10 } :
    corner === "ne" ? { top: -10, right: -10 } :
    corner === "sw" ? { bottom: -10, left: -10 } :
                      { bottom: -10, right: -10 };
  return (
    <div
      data-resize="true"
      onPointerDown={onPointerDown}
      style={{
        position: "absolute", ...pos,
        // 28px visible handle, large enough for finger touch
        width: 28, height: 28,
        background: "#f97316", border: "2.5px solid white", borderRadius: 5,
        cursor: cursors[corner], zIndex: 999, touchAction: "none",
        // Transparent padding to expand the touch target without increasing visible size
        boxSizing: "content-box",
      }}
    />
  );
}

// ── Canvas settings panel ──────────────────────────────────────────────────

function CanvasPanel({ isDark, data, onUpdate, onApplyPalette, onApplyTemplate, elementCount }: { isDark: boolean; data: DesignData; onUpdate: (p: Partial<DesignData>) => void; onApplyPalette: (pal: PaletteDef) => void; onApplyTemplate: (tpl: TemplateDef) => void; elementCount: number }) {
  const [paletteCat, setPaletteCat] = useState("warm");
  function shufflePalette() {
    const activeKey = data.activePalette?.join(",");
    const appliedCat = PALETTE_CATEGORIES.find((c) => c.palettes.some((p) => p.colors.join(",") === activeKey));
    const targetCat = appliedCat ?? PALETTE_CATEGORIES.find((c) => c.id === paletteCat) ?? PALETTE_CATEGORIES[0];
    const appliedPal = targetCat.palettes.find((p) => p.colors.join(",") === activeKey) ?? targetCat.palettes[0];
    // Shuffle the 5 palette colors and reassign roles randomly
    const shuffled = [...appliedPal.colors].sort(() => Math.random() - 0.5);
    const remixed: PaletteDef = {
      ...appliedPal,
      bg: shuffled[0],
      bgType: "solid",
      bgGradient: undefined,
      headingColor: shuffled[1],
      bodyColor: shuffled[2],
      accentColor: shuffled[3],
    };
    setPaletteCat(targetCat.id);
    onApplyPalette(remixed);
  }
  const lbl = `block text-xs mb-1.5 ${isDark ? "text-gray-400" : "text-gray-600"}`;
  const sec = `text-[10px] font-bold uppercase tracking-widest mb-2 ${isDark ? "text-gray-500" : "text-gray-400"}`;
  const isGradient = data.backgroundType === "gradient";
  const isPattern = data.backgroundType === "pattern";
  const grad = data.backgroundGradient ?? { color1: "#f97316", color2: "#3b82f6", angle: 135 };
  return (
    <div className="p-4 space-y-5">
      <p className={sec}>Canvas</p>

      {/* Background type */}
      <div>
        <div className="flex gap-1.5 mb-3">
          <button onClick={() => onUpdate({ backgroundType: "solid", background: "#ffffff" })}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${!isGradient && !isPattern ? "bg-orange-500 text-white border-orange-500" : isDark ? "border-[#2A2A2A] text-gray-400" : "border-gray-200 text-gray-600"}`}>
            Solid
          </button>
          <button onClick={() => onUpdate({ backgroundType: "gradient", backgroundGradient: grad })}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${isGradient ? "bg-orange-500 text-white border-orange-500" : isDark ? "border-[#2A2A2A] text-gray-400" : "border-gray-200 text-gray-600"}`}>
            Gradient
          </button>
          <button onClick={() => onUpdate({ backgroundType: "pattern", background: PATTERNS[0].css })}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${isPattern ? "bg-orange-500 text-white border-orange-500" : isDark ? "border-[#2A2A2A] text-gray-400" : "border-gray-200 text-gray-600"}`}>
            Pattern
          </button>
        </div>

        {isPattern ? (
          <div className="grid grid-cols-4 gap-1.5">
            {PATTERNS.map((p) => (
              <button key={p.id} onClick={() => onUpdate({ background: p.css })}
                className={`rounded-lg border-2 overflow-hidden transition-colors ${data.background === p.css ? "border-orange-500" : isDark ? "border-[#2A2A2A] hover:border-gray-500" : "border-gray-200 hover:border-gray-400"}`}>
                <div className="h-10" style={{ background: p.css }} />
                <div className={`text-[9px] font-medium px-1 py-0.5 truncate ${isDark ? "text-gray-400" : "text-gray-500"}`}>{p.label}</div>
              </button>
            ))}
          </div>
        ) : !isGradient ? (
          <>
            <label className={lbl}>Background color</label>
            <div className="flex items-center gap-2 mb-2">
              <input type="color" value={data.background} onChange={(e) => onUpdate({ background: e.target.value })} className="w-8 h-8 rounded border-0 cursor-pointer shrink-0" />
              <Input value={data.background} onChange={(e) => onUpdate({ background: e.target.value })} className="h-8 text-xs font-mono" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_COLORS.map((c) => <button key={c} onClick={() => onUpdate({ background: c })} className={`w-6 h-6 rounded-md border-2 hover:scale-110 transition-transform ${data.background === c ? "border-orange-500" : isDark ? "border-[#2A2A2A]" : "border-gray-200"}`} style={{ background: c }} />)}
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <div className="h-8 rounded-lg mb-2" style={{ background: `linear-gradient(${grad.angle}deg, ${grad.color1}, ${grad.color2})` }} />
            <div className="flex gap-2">
              <div className="flex-1">
                <label className={lbl}>Color 1</label>
                <input type="color" value={grad.color1} onChange={(e) => onUpdate({ backgroundGradient: { ...grad, color1: e.target.value } })} className="w-full h-8 rounded border-0 cursor-pointer" />
              </div>
              <div className="flex-1">
                <label className={lbl}>Color 2</label>
                <input type="color" value={grad.color2} onChange={(e) => onUpdate({ backgroundGradient: { ...grad, color2: e.target.value } })} className="w-full h-8 rounded border-0 cursor-pointer" />
              </div>
            </div>
            <div>
              <label className={lbl}>Angle: {grad.angle}°</label>
              <input type="range" min={0} max={360} value={grad.angle} onChange={(e) => onUpdate({ backgroundGradient: { ...grad, angle: Number(e.target.value) } })} className="w-full" />
            </div>
          </div>
        )}
      </div>

      {/* Color Palettes */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className={sec} style={{ margin: 0 }}>Themes</p>
          <button onClick={shufflePalette} title="Apply a random theme"
            className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md border transition-colors ${isDark ? "border-[#2A2A2A] text-gray-400 hover:text-orange-400 hover:border-orange-500" : "border-gray-200 text-gray-500 hover:text-orange-500 hover:border-orange-400"}`}>
            ↻ Shuffle
          </button>
        </div>
        <p className={`text-[10px] mb-3 ${isDark ? "text-gray-600" : "text-gray-400"}`}>Applies background, fonts &amp; colours to your whole design</p>
        <div className="flex flex-wrap gap-1 mb-3">
          {PALETTE_CATEGORIES.map((cat) => (
            <button key={cat.id} onClick={() => setPaletteCat(cat.id)}
              className={`px-2 py-0.5 rounded-md text-[10px] font-medium border transition-colors ${paletteCat === cat.id ? "bg-orange-500 text-white border-orange-500" : isDark ? "border-[#2A2A2A] text-gray-400 hover:border-gray-500" : "border-gray-200 text-gray-600 hover:border-gray-400"}`}>
              {cat.label}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {(PALETTE_CATEGORIES.find((c) => c.id === paletteCat) ?? PALETTE_CATEGORIES[0]).palettes.map((pal) => {
            const isActive = data.activePalette?.join(",") === pal.colors.join(",");
            return (
              <div key={pal.id} className={`rounded-xl border-2 overflow-hidden transition-colors ${isActive ? "border-orange-500" : isDark ? "border-[#2A2A2A]" : "border-gray-200"}`}>
                {/* Color bar */}
                <div className="flex h-10">
                  {pal.colors.map((c) => <div key={c} style={{ background: c, flex: 1 }} />)}
                </div>
                {/* Info + Apply */}
                <div className={`flex items-center justify-between px-2 py-1.5 ${isDark ? "bg-[#111]" : "bg-gray-50"}`}>
                  <div>
                    <p className={`text-[11px] font-semibold ${isActive ? isDark ? "text-orange-400" : "text-orange-600" : isDark ? "text-gray-300" : "text-gray-700"}`}>{pal.name}</p>
                    <p className={`text-[9px] ${isDark ? "text-gray-600" : "text-gray-400"}`}>{pal.headingFont} · {pal.bodyFont}</p>
                  </div>
                  <button onClick={() => onApplyPalette(pal)}
                    className={`text-[10px] font-semibold px-2 py-1 rounded-lg transition-colors ${isActive ? "bg-orange-500 text-white" : isDark ? "bg-white/10 text-gray-300 hover:bg-orange-500 hover:text-white" : "bg-gray-200 text-gray-600 hover:bg-orange-500 hover:text-white"}`}>
                    {isActive ? "Applied ✓" : "Apply"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Style Templates */}
      <div>
        <p className={sec}>Style Templates</p>
        <p className={`text-[10px] mb-3 ${isDark ? "text-gray-600" : "text-gray-400"}`}>Instantly replace background &amp; layout with a preset style</p>
        <div className="grid grid-cols-2 gap-2">
          {TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => onApplyTemplate(tpl)}
              className={`group relative rounded-xl overflow-hidden border-2 transition-colors ${isDark ? "border-[#2A2A2A] hover:border-orange-500" : "border-gray-200 hover:border-orange-400"}`}
            >
              <div className="h-16 w-full" style={{ background: tpl.preview }} />
              <div className={`px-2 py-1.5 text-left ${isDark ? "bg-[#111]" : "bg-gray-50"}`}>
                <p className={`text-[10px] font-semibold truncate ${isDark ? "text-gray-300 group-hover:text-orange-400" : "text-gray-700 group-hover:text-orange-600"}`}>{tpl.label}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Background image */}
      <div>
        <p className={sec}>Background Image</p>
        {data.backgroundImage ? (
          <div className="space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={data.backgroundImage} alt="" className="w-full h-24 object-cover rounded-lg border" style={{ borderColor: isDark ? "#2A2A2A" : "#e5e7eb" }} />
            <div className="flex gap-2">
              <select value={data.backgroundImageFit ?? "cover"} onChange={(e) => onUpdate({ backgroundImageFit: e.target.value as "cover" | "contain" })}
                className={`flex-1 h-8 text-xs rounded-md border px-2 ${isDark ? "bg-[#111] border-[#2A2A2A] text-white" : "bg-white border-gray-200 text-gray-900"}`}>
                <option value="cover">Cover (fill)</option>
                <option value="contain">Contain (fit)</option>
              </select>
              <button onClick={() => onUpdate({ backgroundImage: undefined, backgroundImageBlur: undefined, backgroundImageOverlayOpacity: undefined })} className="px-2 h-8 rounded-md text-xs text-red-500 border hover:bg-red-50" style={{ borderColor: isDark ? "#2A2A2A" : "#e5e7eb" }}>Remove</button>
            </div>
            {/* Blur */}
            <div>
              <label className={lbl}>Blur: {data.backgroundImageBlur ?? 0}px</label>
              <input type="range" min={0} max={20} step={0.5} value={data.backgroundImageBlur ?? 0} onChange={(e) => onUpdate({ backgroundImageBlur: Number(e.target.value) || undefined })} className="w-full" />
            </div>
            {/* Overlay / Dim */}
            <div>
              <label className={lbl}>Overlay: {Math.round((data.backgroundImageOverlayOpacity ?? 0) * 100)}%</label>
              <div className="flex items-center gap-2">
                <input type="color" value={data.backgroundImageOverlayColor ?? "#000000"} onChange={(e) => onUpdate({ backgroundImageOverlayColor: e.target.value, backgroundImageOverlayOpacity: data.backgroundImageOverlayOpacity ?? 0.4 })} className="w-8 h-7 rounded cursor-pointer border-0 shrink-0" />
                <input type="range" min={0} max={0.9} step={0.05} value={data.backgroundImageOverlayOpacity ?? 0} onChange={(e) => onUpdate({ backgroundImageOverlayOpacity: Number(e.target.value) || undefined })} className="flex-1" />
              </div>
              <div className="flex gap-1 mt-1">
                <button onClick={() => onUpdate({ backgroundImageOverlayColor: "#000000", backgroundImageOverlayOpacity: 0.5 })} className={`flex-1 py-0.5 rounded text-[10px] border ${isDark ? "border-[#2A2A2A] text-gray-400" : "border-gray-200 text-gray-500"}`}>Dim</button>
                <button onClick={() => onUpdate({ backgroundImageOverlayColor: "#ffffff", backgroundImageOverlayOpacity: 0.5 })} className={`flex-1 py-0.5 rounded text-[10px] border ${isDark ? "border-[#2A2A2A] text-gray-400" : "border-gray-200 text-gray-500"}`}>Fade</button>
                <button onClick={() => onUpdate({ backgroundImageOverlayOpacity: undefined })} className={`flex-1 py-0.5 rounded text-[10px] border text-red-400 ${isDark ? "border-[#2A2A2A]" : "border-gray-200"}`}>Clear</button>
              </div>
            </div>
          </div>
        ) : (
          <label className={`flex items-center justify-center gap-2 h-16 rounded-xl border-2 border-dashed cursor-pointer text-xs font-medium transition-colors ${isDark ? "border-[#2A2A2A] text-gray-500 hover:border-orange-500 hover:text-orange-500" : "border-gray-200 text-gray-400 hover:border-orange-400 hover:text-orange-500"}`}>
            <ImageIcon className="w-4 h-4" /> Upload background image
            <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0]; if (!file) return;
              const fd = new FormData(); fd.append("file", file);
              const res = await fetch("/api/upload", { method: "POST", body: fd });
              if (!res.ok) return;
              const { url } = await res.json();
              onUpdate({ backgroundImage: url, backgroundImageFit: "cover" });
            }} />
          </label>
        )}
      </div>

      <p className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>{data.width} × {data.height}px · {elementCount} element{elementCount !== 1 ? "s" : ""}</p>
      <div className={`rounded-xl p-3 text-xs space-y-1 ${isDark ? "bg-white/5 text-gray-400" : "bg-gray-50 text-gray-500"}`}>
        <p className="font-semibold">Shortcuts</p>
        <p>⌘Z undo · ⌘⇧Z redo · ⌘D duplicate</p>
        <p>Double-click text to edit</p>
        <p>Orange circle above = rotate</p>
        <p>Orange corner = resize</p>
      </div>
    </div>
  );
}

// ── Element properties panel ───────────────────────────────────────────────

function ElementPanel({ el, isDark, onUpdate, onDelete, onDuplicate, onAlign, palette }: {
  el: DesignElement; isDark: boolean;
  onUpdate: (p: Partial<DesignElement>) => void;
  onDelete: () => void; onDuplicate: () => void;
  onAlign: (d: "left" | "center-h" | "right" | "top" | "center-v" | "bottom") => void;
  canvasW: number; canvasH: number;
  palette?: string[];
}) {
  const [removingBg, setRemovingBg] = useState(false);
  const [removeBgError, setRemoveBgError] = useState<string | null>(null);
  const [aiRewriteAction, setAiRewriteAction] = useState<string | null>(null);
  const [aiRewriteError, setAiRewriteError] = useState<string | null>(null);

  async function runAiRewrite(action: string) {
    const text = el.content?.trim();
    if (!text || aiRewriteAction) return;
    setAiRewriteAction(action);
    setAiRewriteError(null);
    try {
      const res = await fetch("/api/designs/ai-rewrite", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, action }),
      });
      const json = await res.json();
      if (!res.ok || !json.result) { setAiRewriteError(json.error ?? "AI rewrite failed."); return; }
      onUpdate({ content: json.result });
    } catch {
      setAiRewriteError("Network error. Please try again.");
    } finally { setAiRewriteAction(null); }
  }

  async function removeBg() {
    if (!el.imageUrl) return;
    setRemovingBg(true);
    setRemoveBgError(null);
    try {
      const res = await fetch("/api/designs/remove-bg", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: el.imageUrl }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) { setRemoveBgError(json.error ?? "Failed to remove background."); return; }
      onUpdate({ imageUrl: json.url });
    } catch {
      setRemoveBgError("Network error. Please try again.");
    } finally { setRemovingBg(false); }
  }

  const lbl = `block text-xs mb-1 ${isDark ? "text-gray-400" : "text-gray-600"}`;
  const sec = `text-[10px] font-bold uppercase tracking-widest mb-2 ${isDark ? "text-gray-500" : "text-gray-400"}`;
  const sel = isDark ? "bg-[#111] border-[#2A2A2A] text-white" : "bg-white border-gray-200 text-gray-900";
  const btn = `flex-1 h-7 text-xs ${isDark ? "border-[#2A2A2A] text-gray-300" : ""}`;

  return (
    <div className="p-4 space-y-4 overflow-y-auto">
      <div className="flex items-center justify-between">
        <p className={sec} style={{ margin: 0 }}>{el.type === "text" ? "Text" : el.type === "image" ? "Image" : (SHAPES.find((s) => s.id === el.shapeType)?.label ?? "Shape")}</p>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={onDuplicate} className="h-7 w-7 p-0"><Copy className="w-3.5 h-3.5" /></Button>
          <Button size="sm" variant="ghost" onClick={onDelete} className="h-7 w-7 p-0 text-red-500"><Trash2 className="w-3.5 h-3.5" /></Button>
        </div>
      </div>

      {/* Position & Size */}
      <div>
        <p className={sec}>Position &amp; Size</p>
        <div className="grid grid-cols-2 gap-2">
          {(["x", "y", "width", "height"] as const).map((k) => (
            <div key={k}>
              <label className={lbl}>{k.toUpperCase()}</label>
              <Input type="number" value={Math.round(el[k] as number)} onChange={(e) => onUpdate({ [k]: Number(e.target.value) })} className="h-7 text-xs" />
            </div>
          ))}
        </div>
      </div>

      {/* Rotation */}
      <div>
        <p className={sec}>Transform</p>
        <div className="space-y-2">
          <div>
            <label className={lbl}>Rotation: {el.rotation ?? 0}°</label>
            <div className="flex items-center gap-2">
              <input type="range" min={-180} max={180} value={el.rotation ?? 0} onChange={(e) => onUpdate({ rotation: Number(e.target.value) })} className="flex-1" />
              <Input type="number" value={el.rotation ?? 0} onChange={(e) => onUpdate({ rotation: Number(e.target.value) })} className="h-7 text-xs w-14 shrink-0" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className={btn} onClick={() => onUpdate({ flipX: !el.flipX })} title="Flip horizontal">
              <FlipHorizontal className="w-3.5 h-3.5 mr-1" /> Flip H
            </Button>
            <Button size="sm" variant="outline" className={btn} onClick={() => onUpdate({ flipY: !el.flipY })} title="Flip vertical">
              <FlipVertical className="w-3.5 h-3.5 mr-1" /> Flip V
            </Button>
          </div>
        </div>
      </div>

      {/* Alignment */}
      <div>
        <p className={sec}>Align to canvas</p>
        <div className="grid grid-cols-3 gap-1.5">
          {(["left","center-h","right","top","center-v","bottom"] as const).map((dir) => {
            const icons: Record<string, React.ReactNode> = {
              "left": <MoveLeft className="w-3.5 h-3.5" />,
              "center-h": <AlignHorizontalJustifyCenter className="w-3.5 h-3.5" />,
              "right": <MoveRight className="w-3.5 h-3.5" />,
              "top": <MoveUp className="w-3.5 h-3.5" />,
              "center-v": <AlignVerticalJustifyCenter className="w-3.5 h-3.5" />,
              "bottom": <MoveDown className="w-3.5 h-3.5" />,
            };
            const labels: Record<string, string> = { "left":"Left","center-h":"Center","right":"Right","top":"Top","center-v":"Middle","bottom":"Bottom" };
            return (
              <Button key={dir} size="sm" variant="outline" className={`h-7 text-[10px] flex items-center gap-1 ${isDark ? "border-[#2A2A2A] text-gray-300" : ""}`} onClick={() => onAlign(dir)}>
                {icons[dir]}{labels[dir]}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Opacity */}
      <div>
        <label className={lbl}>Opacity: {Math.round((el.opacity ?? 1) * 100)}%</label>
        <input type="range" min={0} max={1} step={0.01} value={el.opacity ?? 1} onChange={(e) => onUpdate({ opacity: Number(e.target.value) })} className="w-full" />
      </div>

      {/* Shadow */}
      <div>
        <p className={sec}>Shadow</p>
        <div className="space-y-2">
          <div className="flex gap-2 items-center">
            <input type="color" value={el.shadowColor ?? "#000000"} onChange={(e) => onUpdate({ shadowColor: e.target.value, shadowBlur: el.shadowBlur ?? 10 })} className="w-8 h-8 rounded cursor-pointer border-0 shrink-0" />
            <Input value={el.shadowColor ?? ""} placeholder="none" onChange={(e) => onUpdate({ shadowColor: e.target.value || undefined })} className="h-8 text-xs font-mono" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><label className={lbl}>Blur</label><Input type="number" value={el.shadowBlur ?? 0} onChange={(e) => onUpdate({ shadowBlur: Number(e.target.value) })} className="h-7 text-xs" /></div>
            <div><label className={lbl}>X</label><Input type="number" value={el.shadowX ?? 0} onChange={(e) => onUpdate({ shadowX: Number(e.target.value) })} className="h-7 text-xs" /></div>
            <div><label className={lbl}>Y</label><Input type="number" value={el.shadowY ?? 0} onChange={(e) => onUpdate({ shadowY: Number(e.target.value) })} className="h-7 text-xs" /></div>
          </div>
        </div>
      </div>

      {/* Text-specific */}
      {el.type === "text" && (
        <div className="space-y-3">
          <p className={sec}>Text</p>
          <div>
            <label className={lbl}>Content</label>
            <textarea value={el.content ?? ""} onChange={(e) => onUpdate({ content: e.target.value })} rows={3} className={`w-full text-xs rounded-md border px-2 py-1.5 resize-none ${sel}`} />
          </div>
          {/* AI Rewrite actions */}
          <div>
            <p className={lbl}><Sparkles className="w-3 h-3 inline mr-1 text-orange-500" />AI Rewrite</p>
            <div className="flex flex-wrap gap-1.5">
              {([
                { action: "viral",        label: "Make Viral" },
                { action: "hook",         label: "Rewrite Hook" },
                { action: "shorten",      label: "Shorten" },
                { action: "expand",       label: "Expand" },
                { action: "cta",          label: "Write CTA" },
                { action: "luxury",       label: "Luxury Tone" },
                { action: "casual",       label: "Casual" },
                { action: "professional", label: "Professional" },
                { action: "motivational", label: "Motivational" },
                { action: "wellness",     label: "Wellness" },
              ] as { action: string; label: string }[]).map(({ action, label }) => (
                <button
                  key={action}
                  onClick={() => runAiRewrite(action)}
                  disabled={!!aiRewriteAction}
                  className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                    aiRewriteAction === action
                      ? "bg-orange-500 text-white border-orange-500"
                      : isDark
                        ? "border-white/10 text-gray-300 hover:border-orange-500/60 hover:text-orange-400 disabled:opacity-40"
                        : "border-gray-200 text-gray-600 hover:border-orange-400 hover:text-orange-500 disabled:opacity-40"
                  }`}
                >
                  {aiRewriteAction === action ? <Loader2 className="w-2.5 h-2.5 animate-spin inline" /> : label}
                </button>
              ))}
            </div>
            {aiRewriteError && <p className="text-[10px] text-red-500 mt-1">{aiRewriteError}</p>}
          </div>
          <div>
            <label className={lbl}>Font</label>
            <select value={el.fontFamily ?? "Inter"} onChange={(e) => onUpdate({ fontFamily: e.target.value })} className={`w-full h-8 text-xs rounded-md border px-2 ${sel}`}>
              {FONT_FAMILIES.map((f) => <option key={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Size</label>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onUpdate({ fontSize: Math.max(8, (el.fontSize ?? 32) - 2) })}><Minus className="w-3 h-3" /></Button>
              <Input type="number" value={el.fontSize ?? 32} onChange={(e) => onUpdate({ fontSize: Number(e.target.value) })} className="h-7 text-xs text-center" />
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onUpdate({ fontSize: (el.fontSize ?? 32) + 2 })}><Plus className="w-3 h-3" /></Button>
            </div>
          </div>
          <div>
            <label className={lbl}>Color</label>
            <div className="flex gap-2 items-center mb-2">
              <input type="color" value={el.color ?? "#1a1a1a"} onChange={(e) => onUpdate({ color: e.target.value })} className="w-8 h-8 rounded cursor-pointer border-0 shrink-0" />
              <Input value={el.color ?? "#1a1a1a"} onChange={(e) => onUpdate({ color: e.target.value })} className="h-8 text-xs font-mono" />
            </div>
            {palette && palette.length > 0 && (
              <div className="mb-1.5">
                <p className={`text-[9px] mb-1 uppercase tracking-widest font-bold ${isDark ? "text-gray-600" : "text-gray-400"}`}>Palette</p>
                <div className="flex gap-1">
                  {palette.map((c) => <button key={c} onClick={() => onUpdate({ color: c })} className={`w-6 h-6 rounded-md border-2 hover:scale-110 transition-transform ${el.color === c ? "border-orange-500" : isDark ? "border-[#2A2A2A]" : "border-gray-200"}`} style={{ background: c }} />)}
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-1">
              {QUICK_COLORS.map((c) => <button key={c} onClick={() => onUpdate({ color: c })} className={`w-5 h-5 rounded border ${el.color === c ? "border-orange-500" : isDark ? "border-[#2A2A2A]" : "border-gray-200"}`} style={{ background: c }} />)}
            </div>
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant={el.fontWeight === "700" ? "default" : "outline"} className="h-7 flex-1" onClick={() => onUpdate({ fontWeight: el.fontWeight === "700" ? "400" : "700" })}><Bold className="w-3.5 h-3.5" /></Button>
            <Button size="sm" variant={el.fontStyle === "italic" ? "default" : "outline"} className="h-7 flex-1" onClick={() => onUpdate({ fontStyle: el.fontStyle === "italic" ? "normal" : "italic" })}><Italic className="w-3.5 h-3.5" /></Button>
            <Button size="sm" variant={(el.textDecoration ?? "").includes("underline") ? "default" : "outline"} className="h-7 flex-1" onClick={() => onUpdate({ textDecoration: (el.textDecoration ?? "").includes("underline") ? (el.textDecoration ?? "").replace("underline","").trim() || undefined : ((el.textDecoration ?? "") + " underline").trim() })}><Underline className="w-3.5 h-3.5" /></Button>
            <Button size="sm" variant={(el.textDecoration ?? "").includes("line-through") ? "default" : "outline"} className="h-7 flex-1" onClick={() => onUpdate({ textDecoration: (el.textDecoration ?? "").includes("line-through") ? (el.textDecoration ?? "").replace("line-through","").trim() || undefined : ((el.textDecoration ?? "") + " line-through").trim() })}><Strikethrough className="w-3.5 h-3.5" /></Button>
            {(["left", "center", "right"] as const).map((a) => (
              <Button key={a} size="sm" variant={el.textAlign === a ? "default" : "outline"} className="h-7 flex-1" onClick={() => onUpdate({ textAlign: a })}>
                {a === "left" ? <AlignLeft className="w-3.5 h-3.5" /> : a === "center" ? <AlignCenter className="w-3.5 h-3.5" /> : <AlignRight className="w-3.5 h-3.5" />}
              </Button>
            ))}
          </div>
          <div>
            <label className={lbl}><Highlighter className="w-3 h-3 inline mr-1" />Text highlight</label>
            <div className="flex gap-2 items-center">
              <input type="color" value={el.textBackground ?? "#ffff00"} onChange={(e) => onUpdate({ textBackground: e.target.value })} className="w-8 h-8 rounded cursor-pointer border-0 shrink-0" />
              <Input value={el.textBackground ?? ""} placeholder="none" onChange={(e) => onUpdate({ textBackground: e.target.value || undefined })} className="h-8 text-xs font-mono" />
              {el.textBackground && <Button size="sm" variant="ghost" className="h-8 text-xs text-gray-400" onClick={() => onUpdate({ textBackground: undefined })}>Clear</Button>}
            </div>
          </div>
          <div>
            <label className={lbl}>Letter spacing: {el.letterSpacing ?? 0}px</label>
            <input type="range" min={-5} max={30} step={0.5} value={el.letterSpacing ?? 0} onChange={(e) => onUpdate({ letterSpacing: Number(e.target.value) })} className="w-full" />
          </div>
          <div>
            <label className={lbl}>Line height: {el.lineHeight ?? 1.3}</label>
            <input type="range" min={0.8} max={3} step={0.05} value={el.lineHeight ?? 1.3} onChange={(e) => onUpdate({ lineHeight: Number(e.target.value) })} className="w-full" />
          </div>
        </div>
      )}

      {/* Shape-specific */}
      {el.type === "shape" && (
        <div className="space-y-3">
          <p className={sec}>Shape</p>
          <div>
            <label className={lbl}>Shape type</label>
            <div className="grid grid-cols-5 gap-1.5 max-h-44 overflow-y-auto">
              {SHAPES.map((s) => (
                <button key={s.id} onClick={() => onUpdate({ shapeType: s.id })} title={s.label}
                  className={`p-1 rounded-lg border-2 ${el.shapeType === s.id ? "border-orange-500 bg-orange-50 dark:bg-orange-500/10" : isDark ? "border-[#2A2A2A] hover:border-gray-500" : "border-gray-200 hover:border-gray-400"}`}>
                  <div className="w-full aspect-square">{s.render(el.fill ?? "#f97316")}</div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={lbl}>Fill color</label>
            <div className="flex gap-2 items-center mb-2">
              <input type="color" value={el.fill ?? "#f97316"} onChange={(e) => onUpdate({ fill: e.target.value })} className="w-8 h-8 rounded cursor-pointer border-0 shrink-0" />
              <Input value={el.fill ?? "#f97316"} onChange={(e) => onUpdate({ fill: e.target.value })} className="h-8 text-xs font-mono" />
            </div>
            {palette && palette.length > 0 && (
              <div className="mb-1.5">
                <p className={`text-[9px] mb-1 uppercase tracking-widest font-bold ${isDark ? "text-gray-600" : "text-gray-400"}`}>Palette</p>
                <div className="flex gap-1">
                  {palette.map((c) => <button key={c} onClick={() => onUpdate({ fill: c })} className={`w-6 h-6 rounded-md border-2 hover:scale-110 transition-transform ${el.fill === c ? "border-orange-500" : isDark ? "border-[#2A2A2A]" : "border-gray-200"}`} style={{ background: c }} />)}
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-1">
              {QUICK_COLORS.map((c) => <button key={c} onClick={() => onUpdate({ fill: c })} className={`w-5 h-5 rounded border ${el.fill === c ? "border-orange-500" : isDark ? "border-[#2A2A2A]" : "border-gray-200"}`} style={{ background: c }} />)}
            </div>
          </div>
          <div>
            <label className={lbl}>Stroke</label>
            <div className="flex gap-2 items-center mb-1">
              <input type="color" value={el.stroke ?? "#000000"} onChange={(e) => onUpdate({ stroke: e.target.value })} className="w-8 h-8 rounded cursor-pointer border-0 shrink-0" />
              <Input value={el.stroke ?? ""} placeholder="none" onChange={(e) => onUpdate({ stroke: e.target.value || undefined })} className="h-8 text-xs font-mono" />
            </div>
            <label className={lbl}>Width: {el.strokeWidth ?? 0}px</label>
            <input type="range" min={0} max={20} value={el.strokeWidth ?? 0} onChange={(e) => onUpdate({ strokeWidth: Number(e.target.value) })} className="w-full" />
          </div>
        </div>
      )}

      {/* Image-specific */}
      {el.type === "image" && (
        <div className="space-y-3">
          <p className={sec}>Image</p>
          <div>
            <label className={lbl}>Object fit</label>
            <select value={el.objectFit ?? "cover"} onChange={(e) => onUpdate({ objectFit: e.target.value })} className={`w-full h-8 text-xs rounded-md border px-2 ${sel}`}>
              <option value="cover">Cover (fill frame)</option>
              <option value="contain">Contain (fit inside)</option>
              <option value="fill">Stretch</option>
            </select>
          </div>
          <div>
            <label className={lbl}>Blur: {el.blur ?? 0}px</label>
            <input type="range" min={0} max={20} step={0.5} value={el.blur ?? 0} onChange={(e) => onUpdate({ blur: Number(e.target.value) || undefined })} className="w-full" />
          </div>
          <div>
            <Button className="w-full gap-2 bg-purple-600 hover:bg-purple-700 text-white" size="sm" onClick={removeBg} disabled={removingBg || !el.imageUrl}>
              {removingBg ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Removing BG…</> : <><Sparkles className="w-3.5 h-3.5" /> Remove Background</>}
            </Button>
            {removeBgError && <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-2 py-1.5">{removeBgError}</p>}
          </div>
        </div>
      )}

      {/* Layer */}
      <div>
        <p className={sec}>Layer</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className={btn} onClick={() => onUpdate({ zIndex: (el.zIndex ?? 0) + 1 })}>Forward</Button>
          <Button size="sm" variant="outline" className={btn} onClick={() => onUpdate({ zIndex: Math.max(0, (el.zIndex ?? 0) - 1) })}>Back</Button>
        </div>
      </div>
    </div>
  );
}
