"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft, Type, ImageIcon, Square, Trash2, Copy, Loader2, Check,
  Download, Bold, Italic, AlignLeft, AlignCenter, AlignRight, Minus, Plus,
  ChevronDown, FlipHorizontal, FlipVertical, RotateCw, Sparkles,
  AlignHorizontalJustifyCenter, AlignVerticalJustifyCenter,
  MoveLeft, MoveRight, MoveUp, MoveDown, Undo2, Redo2,
  Underline, Strikethrough, ZoomIn, ZoomOut, FileDown, Highlighter,
  LayoutTemplate, Images, Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDashboardTheme } from "@/components/dashboard-theme-provider";
import { DesignData, DesignElement } from "@/db/schema/designs-schema";

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
function buildBg(data: DesignData): string {
  if (data.backgroundType === "gradient" && data.backgroundGradient) {
    const { color1, color2, angle } = data.backgroundGradient;
    return `linear-gradient(${angle}deg, ${color1}, ${color2})`;
  }
  return data.background;
}

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
];

type DragState = { startX: number; startY: number; origX: number; origY: number };
type ResizeState = { startX: number; startY: number; origW: number; origH: number };

const MAX_HISTORY = 60;

// ── Main editor ────────────────────────────────────────────────────────────

export function DesignEditor({ designId }: { designId: string }) {
  const { theme } = useDashboardTheme();
  const isDark = theme === "dark";

  const [title, setTitle] = useState("Untitled Design");
  const [editingTitle, setEditingTitle] = useState(false);
  const [data, setData] = useState<DesignData>({ width: 800, height: 1100, background: "#ffffff", elements: [] });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [showShapePicker, setShowShapePicker] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiStyle, setAiStyle] = useState("bold");
  const [aiError, setAiError] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showUploads, setShowUploads] = useState(false);
  const [recentUploads, setRecentUploads] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("cf_design_uploads") ?? "[]"); } catch { return []; }
  });

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
    setShowShapePicker(false);
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
    input.onchange = async () => {
      const file = input.files?.[0]; if (!file) return;
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) return;
      const { url } = await res.json();
      saveUpload(url);
      addImageUrl(url);
    };
    input.click();
  }

  function applyTemplate(tpl: TemplateDef) {
    const patch = tpl.make(data.width, data.height);
    updateData((prev) => ({ ...prev, ...patch }));
    setShowTemplates(false);
    setSelectedId(null);
  }

  function addBgImage() {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0]; if (!file) return;
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) return;
      const { url } = await res.json();
      saveUpload(url);
      updateData((prev) => ({ ...prev, backgroundImage: url, backgroundImageFit: "cover" }));
    };
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
      setShowAiPanel(false);
    } catch {
      setAiError("Network error. Please try again.");
    } finally { setAiLoading(false); }
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

  // ── Drag/resize/rotate ──

  function onElementMouseDown(e: React.MouseEvent, id: string) {
    if ((e.target as HTMLElement).dataset.resize || (e.target as HTMLElement).dataset.rotate) return;
    e.stopPropagation();
    setSelectedId(id);
    const el = data.elements.find((x) => x.id === id)!;
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: el.x, origY: el.y };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      updateElement(id, {
        x: clamp(dragRef.current.origX + (ev.clientX - dragRef.current.startX) / scale, -el.width + 20, data.width - 20),
        y: clamp(dragRef.current.origY + (ev.clientY - dragRef.current.startY) / scale, -el.height + 20, data.height - 20),
      }, false);
    };
    const onUp = () => {
      dragRef.current = null;
      pushHistory(historyRef.current[historyIdx.current]); // commit move
      window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
  }

  function onResizeMouseDown(e: React.MouseEvent, id: string) {
    e.stopPropagation(); e.preventDefault();
    const el = data.elements.find((x) => x.id === id)!;
    resizeRef.current = { startX: e.clientX, startY: e.clientY, origW: el.width, origH: el.height };
    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      updateElement(id, {
        width: Math.max(20, resizeRef.current.origW + (ev.clientX - resizeRef.current.startX) / scale),
        height: Math.max(20, resizeRef.current.origH + (ev.clientY - resizeRef.current.startY) / scale),
      }, false);
    };
    const onUp = () => { resizeRef.current = null; pushHistory(historyRef.current[historyIdx.current]); window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
  }

  function onRotateMouseDown(e: React.MouseEvent, id: string) {
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
    const onMove = (ev: MouseEvent) => {
      if (!rotateRef.current || !canvasRect) return;
      const mx2 = (ev.clientX - canvasRect.left) / scale;
      const my2 = (ev.clientY - canvasRect.top) / scale;
      const angle = Math.atan2(my2 - rotateRef.current.cy, mx2 - rotateRef.current.cx) * 180 / Math.PI;
      const delta = angle - rotateRef.current.startAngle;
      updateElement(id, { rotation: Math.round(rotateRef.current.origRotation + delta) }, false);
    };
    const onUp = () => { rotateRef.current = null; pushHistory(historyRef.current[historyIdx.current]); window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
  }

  function onCanvasClick(e: React.MouseEvent) {
    if ((e.target as HTMLElement) === canvasRef.current) setSelectedId(null);
  }

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if (meta && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); redo(); return; }
      if (meta && e.key === "d") { e.preventDefault(); duplicateSelected(); return; }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        const el = document.activeElement as HTMLElement;
        if (el?.tagName === "INPUT" || el?.tagName === "TEXTAREA" || el?.isContentEditable) return;
        deleteSelected();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, data]);

  async function exportPng() {
    const { toPng } = await import("html-to-image");
    if (!canvasRef.current) return;
    // pixelRatio: 2/scale → output is always 2× native canvas resolution regardless of zoom
    const url = await toPng(canvasRef.current, { pixelRatio: 2 / scale });
    const a = document.createElement("a"); a.href = url; a.download = `${title}.png`; a.click();
  }

  async function exportPdf() {
    const { toPng } = await import("html-to-image");
    const { jsPDF } = await import("jspdf");
    if (!canvasRef.current) return;
    // pixelRatio: 1/scale → output exactly matches native canvas resolution regardless of zoom
    const url = await toPng(canvasRef.current, { pixelRatio: 1 / scale });
    const mmW = data.width * 0.2646;
    const mmH = data.height * 0.2646;
    const pdf = new jsPDF({ orientation: mmW > mmH ? "landscape" : "portrait", unit: "mm", format: [mmW, mmH] });
    pdf.addImage(url, "PNG", 0, 0, mmW, mmH);
    pdf.save(`${title}.pdf`);
  }

  const panelCls = isDark ? "border-[#2A2A2A] bg-[#1A1A1A]" : "border-gray-200 bg-white";

  if (loading) return <div className="flex items-center justify-center h-screen"><Loader2 className="w-6 h-6 animate-spin text-orange-500" /></div>;

  return (
    <div className={`flex flex-col h-full overflow-hidden ${isDark ? "bg-[#0F0F0F] text-white" : "bg-[#F9FAFB] text-gray-900"}`}>

      {/* Top bar */}
      <header className={`shrink-0 flex items-center justify-between gap-3 px-4 border-b ${isDark ? "bg-[#0F0F0F]/95 border-[#2A2A2A]" : "bg-white/95 border-gray-200"} backdrop-blur-sm shadow-sm z-40`} style={{ height: 52 }}>
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/dashboard/design-studio" className={`flex items-center gap-1 text-sm shrink-0 ${isDark ? "text-gray-400 hover:text-orange-500" : "text-gray-500 hover:text-orange-500"}`}>
            <ChevronLeft className="w-4 h-4" /> Back
          </Link>
          <div className={`h-5 w-px ${isDark ? "bg-[#2A2A2A]" : "bg-gray-200"}`} />
          {editingTitle
            ? <Input autoFocus value={title} onChange={(e) => updateTitle(e.target.value)} onBlur={() => setEditingTitle(false)} onKeyDown={(e) => { if (e.key === "Enter") setEditingTitle(false); }} className="h-7 text-sm font-semibold w-44 px-2" />
            : <button onClick={() => setEditingTitle(true)} className={`text-sm font-semibold truncate max-w-[180px] hover:text-orange-500 ${isDark ? "text-white" : "text-gray-900"}`}>{title}</button>}
          {saving ? <span className="flex items-center gap-1 text-xs text-gray-400"><Loader2 className="w-3 h-3 animate-spin" /> Saving…</span>
            : lastSaved ? <span className="flex items-center gap-1 text-xs text-emerald-600"><Check className="w-3 h-3" /> Saved</span> : null}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button size="sm" variant="ghost" onClick={undo} className={`h-8 w-8 p-0 ${isDark ? "text-gray-400 hover:text-white" : "text-gray-500"}`} title="Undo (⌘Z)"><Undo2 className="w-4 h-4" /></Button>
          <Button size="sm" variant="ghost" onClick={redo} className={`h-8 w-8 p-0 ${isDark ? "text-gray-400 hover:text-white" : "text-gray-500"}`} title="Redo (⌘⇧Z)"><Redo2 className="w-4 h-4" /></Button>
          <div className={`h-5 w-px mx-1 ${isDark ? "bg-[#2A2A2A]" : "bg-gray-200"}`} />
          <Button size="sm" variant="ghost" onClick={() => setScale((s) => Math.max(0.2, +(s - 0.1).toFixed(1)))} className={`h-8 w-8 p-0 ${isDark ? "text-gray-400 hover:text-white" : "text-gray-500"}`} title="Zoom out"><ZoomOut className="w-4 h-4" /></Button>
          <span className={`text-xs w-12 text-center tabular-nums ${isDark ? "text-gray-400" : "text-gray-500"}`}>{Math.round(scale * 100)}%</span>
          <Button size="sm" variant="ghost" onClick={() => setScale((s) => Math.min(2, +(s + 0.1).toFixed(1)))} className={`h-8 w-8 p-0 ${isDark ? "text-gray-400 hover:text-white" : "text-gray-500"}`} title="Zoom in"><ZoomIn className="w-4 h-4" /></Button>
          <div className={`h-5 w-px mx-1 ${isDark ? "bg-[#2A2A2A]" : "bg-gray-200"}`} />
          <Button size="sm" variant="outline" className={`gap-1.5 ${isDark ? "border-[#2A2A2A] text-gray-300 hover:text-white" : ""}`} onClick={exportPdf}>
            <FileDown className="w-4 h-4" /> PDF
          </Button>
          <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white gap-1.5" onClick={exportPng}>
            <Download className="w-4 h-4" /> PNG
          </Button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Left tools panel */}
        <aside className={`w-[76px] shrink-0 border-r flex flex-col gap-0.5 py-3 px-1.5 items-center overflow-y-auto ${panelCls}`}>
          <SideLabel label="Add" isDark={isDark} />
          <ToolBtn icon={<Type className="w-5 h-5" />} label="Text" onClick={addText} isDark={isDark} />

          {/* Shapes */}
          <div className="relative w-full">
            <button onClick={() => { setShowShapePicker((v) => !v); setShowAiPanel(false); }}
              className={`w-full flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg transition-colors ${isDark ? "text-gray-400 hover:bg-white/10 hover:text-white" : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"}`}>
              <div className="flex items-center gap-0.5"><Square className="w-5 h-5" /><ChevronDown className="w-3 h-3" /></div>
              <span className="text-[9px] font-medium leading-none">Shapes</span>
            </button>
            {showShapePicker && (
              <div className={`absolute left-full top-0 ml-2 z-50 rounded-xl border shadow-xl p-3 w-72 ${isDark ? "bg-[#1A1A1A] border-[#2A2A2A]" : "bg-white border-gray-200"}`}>
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
          </div>

          <ToolBtn icon={<ImageIcon className="w-5 h-5" />} label="Image" onClick={addImage} isDark={isDark} />

          {/* AI Generate */}
          <div className="relative w-full">
            <button onClick={() => { setShowAiPanel((v) => !v); setShowShapePicker(false); }}
              className={`w-full flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg transition-colors ${showAiPanel ? "bg-orange-500 text-white" : isDark ? "text-gray-400 hover:bg-white/10 hover:text-white" : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"}`}>
              <Sparkles className="w-5 h-5" />
              <span className="text-[9px] font-medium leading-none">AI Image</span>
            </button>
            {showAiPanel && (
              <div className={`absolute left-full top-0 ml-2 z-50 rounded-xl border shadow-xl p-4 w-80 ${isDark ? "bg-[#1A1A1A] border-[#2A2A2A]" : "bg-white border-gray-200"}`}>
                <p className={`text-sm font-semibold mb-1 ${isDark ? "text-white" : "text-gray-900"}`}>Generate AI Image</p>
                <p className={`text-xs mb-3 ${isDark ? "text-gray-400" : "text-gray-500"}`}>Uses 1 video credit · Background auto-removed</p>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => { setAiPrompt(e.target.value); setAiError(null); }}
                  placeholder="e.g. golden crown on white background, detailed illustration"
                  rows={3}
                  className={`w-full text-xs rounded-lg border px-3 py-2 resize-none mb-3 ${isDark ? "bg-[#111] border-[#2A2A2A] text-white placeholder-gray-600" : "bg-white border-gray-200 text-gray-900 placeholder-gray-400"}`}
                />
                <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${isDark ? "text-gray-500" : "text-gray-400"}`}>Style</p>
                <div className="grid grid-cols-3 gap-1.5 mb-3">
                  {([
                    ["bold", "Bold"],
                    ["minimalist", "Minimal"],
                    ["vintage", "Vintage"],
                    ["abstract", "Abstract"],
                    ["lineart", "Line Art"],
                    ["typography", "Typography"],
                  ] as const).map(([val, lbl]) => (
                    <button key={val} onClick={() => setAiStyle(val)}
                      className={`py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${aiStyle === val ? "bg-orange-500 text-white border-orange-500" : isDark ? "border-[#2A2A2A] text-gray-400 hover:border-gray-500" : "border-gray-200 text-gray-600 hover:border-gray-400"}`}>
                      {lbl}
                    </button>
                  ))}
                </div>
                {aiError && <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{aiError}</p>}
                <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white gap-2" onClick={generateAiImage} disabled={aiLoading || !aiPrompt.trim()}>
                  {aiLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : <><Sparkles className="w-4 h-4" /> Generate Image</>}
                </Button>
              </div>
            )}
          </div>

          {/* Templates */}
          <div className="relative w-full">
            <button onClick={() => { setShowTemplates((v) => !v); setShowShapePicker(false); setShowAiPanel(false); setShowUploads(false); }}
              className={`w-full flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg transition-colors ${showTemplates ? "bg-orange-500 text-white" : isDark ? "text-gray-400 hover:bg-white/10 hover:text-white" : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"}`}>
              <LayoutTemplate className="w-5 h-5" />
              <span className="text-[9px] font-medium leading-none">Templates</span>
            </button>
            {showTemplates && (
              <div className={`absolute left-full top-0 ml-2 z-50 rounded-xl border shadow-xl p-4 w-80 ${isDark ? "bg-[#1A1A1A] border-[#2A2A2A]" : "bg-white border-gray-200"}`}>
                <p className={`text-sm font-semibold mb-1 ${isDark ? "text-white" : "text-gray-900"}`}>Templates</p>
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
          </div>

          {/* Uploads */}
          <div className="relative w-full">
            <button onClick={() => { setShowUploads((v) => !v); setShowShapePicker(false); setShowAiPanel(false); setShowTemplates(false); }}
              className={`w-full flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg transition-colors ${showUploads ? "bg-orange-500 text-white" : isDark ? "text-gray-400 hover:bg-white/10 hover:text-white" : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"}`}>
              <Images className="w-5 h-5" />
              <span className="text-[9px] font-medium leading-none">Uploads</span>
            </button>
            {showUploads && (
              <div className={`absolute left-full top-0 ml-2 z-50 rounded-xl border shadow-xl p-4 w-72 ${isDark ? "bg-[#1A1A1A] border-[#2A2A2A]" : "bg-white border-gray-200"}`}>
                <p className={`text-sm font-semibold mb-1 ${isDark ? "text-white" : "text-gray-900"}`}>My Uploads</p>
                <p className={`text-xs mb-3 ${isDark ? "text-gray-400" : "text-gray-500"}`}>Click an image to add it to the canvas</p>
                <Button size="sm" variant="outline" className={`w-full mb-3 gap-2 ${isDark ? "border-[#2A2A2A] text-gray-300" : ""}`} onClick={() => { addImage(); setShowUploads(false); }}>
                  <Images className="w-4 h-4" /> Upload new image
                </Button>
                {recentUploads.length === 0
                  ? <p className={`text-xs text-center py-6 ${isDark ? "text-gray-600" : "text-gray-400"}`}>No uploads yet. Upload an image to get started.</p>
                  : <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                      {recentUploads.map((url) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <button key={url} onClick={() => { addImageUrl(url); setShowUploads(false); }} className={`rounded-lg overflow-hidden border-2 hover:border-orange-500 transition-colors ${isDark ? "border-[#2A2A2A]" : "border-gray-200"}`}>
                          <img src={url} alt="" className="w-full h-16 object-cover" />
                        </button>
                      ))}
                    </div>
                }
              </div>
            )}
          </div>

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
          className={`flex-1 flex items-center justify-center overflow-auto p-8 ${isDark ? "bg-[#151515]" : "bg-gray-100"}`}
          style={{ backgroundImage: isDark ? "radial-gradient(circle, #2A2A2A 1px, transparent 1px)" : "radial-gradient(circle, #d1d5db 1px, transparent 1px)", backgroundSize: "24px 24px" }}
          onClick={() => { setSelectedId(null); setShowShapePicker(false); setShowAiPanel(false); setShowTemplates(false); setShowUploads(false); }}
        >
          <div style={{ width: data.width * scale, height: data.height * scale, position: "relative", flexShrink: 0 }}>
            <div
              ref={canvasRef}
              style={{ width: data.width, height: data.height, background: buildBg(data), backgroundImage: data.backgroundImage ? `url(${data.backgroundImage})` : undefined, backgroundSize: data.backgroundImageFit ?? "cover", backgroundPosition: "center", position: "absolute", top: 0, left: 0, transform: `scale(${scale})`, transformOrigin: "top left", overflow: "hidden", boxShadow: "0 4px 40px rgba(0,0,0,0.25)" }}
              onClick={onCanvasClick}
            >
              {[...data.elements].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)).map((el) => (
                <CanvasElement key={el.id} el={el} selected={el.id === selectedId}
                  onMouseDown={onElementMouseDown}
                  onResizeMouseDown={onResizeMouseDown}
                  onRotateMouseDown={onRotateMouseDown}
                  onUpdate={(patch) => updateElement(el.id, patch)} />
              ))}
            </div>
          </div>
        </div>

        {/* Right panel */}
        <aside className={`w-64 shrink-0 border-l flex flex-col overflow-y-auto ${panelCls}`}>
          {selectedEl
            ? <ElementPanel el={selectedEl} isDark={isDark}
                onUpdate={(patch) => updateElement(selectedEl.id, patch)}
                onDelete={deleteSelected} onDuplicate={duplicateSelected}
                onAlign={alignEl} canvasW={data.width} canvasH={data.height} />
            : <CanvasPanel isDark={isDark} data={data}
                onUpdate={(patch) => updateData((prev) => ({ ...prev, ...patch }))}
                elementCount={data.elements.length} />}
        </aside>
      </div>
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

function CanvasElement({ el, selected, onMouseDown, onResizeMouseDown, onRotateMouseDown, onUpdate }: {
  el: DesignElement; selected: boolean;
  onMouseDown: (e: React.MouseEvent, id: string) => void;
  onResizeMouseDown: (e: React.MouseEvent, id: string) => void;
  onRotateMouseDown: (e: React.MouseEvent, id: string) => void;
  onUpdate: (patch: Partial<DesignElement>) => void;
}) {
  const [editing, setEditing] = useState(false);

  const shadow = el.shadowBlur || el.shadowX || el.shadowY
    ? `drop-shadow(${el.shadowX ?? 0}px ${el.shadowY ?? 4}px ${el.shadowBlur ?? 8}px ${el.shadowColor ?? "rgba(0,0,0,0.4)"})`
    : undefined;

  const flipTransform = [
    el.flipX ? "scaleX(-1)" : "",
    el.flipY ? "scaleY(-1)" : "",
  ].filter(Boolean).join(" ") || undefined;

  const base: React.CSSProperties = {
    position: "absolute", left: el.x, top: el.y, width: el.width, height: el.height,
    opacity: el.opacity ?? 1, cursor: "move", userSelect: "none",
    transform: `rotate(${el.rotation ?? 0}deg)${flipTransform ? ` ${flipTransform}` : ""}`,
    transformOrigin: "center center",
    filter: shadow,
    outline: selected ? "2px solid #f97316" : "none", outlineOffset: 2, zIndex: el.zIndex ?? 0,
  };

  const rotateHandle = selected ? (
    <div
      data-rotate="true"
      onMouseDown={(e) => onRotateMouseDown(e, el.id)}
      style={{
        position: "absolute", top: -28, left: "50%", transform: "translateX(-50%)",
        width: 20, height: 20, background: "#f97316", border: "2px solid white",
        borderRadius: "50%", cursor: "grab", zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <RotateCw style={{ width: 11, height: 11, color: "white", pointerEvents: "none" }} />
    </div>
  ) : null;

  if (el.type === "text") return (
    <div style={base} onMouseDown={(e) => onMouseDown(e, el.id)} onClick={(e) => e.stopPropagation()} onDoubleClick={() => setEditing(true)}>
      {rotateHandle}
      {editing ? (
        <textarea autoFocus value={el.content ?? ""} onChange={(e) => onUpdate({ content: e.target.value })} onBlur={() => setEditing(false)}
          style={{ width: "100%", height: "100%", background: el.textBackground ?? "transparent", border: "none", outline: "none", resize: "none", fontFamily: el.fontFamily ?? "Inter", fontSize: el.fontSize ?? 32, color: el.color ?? "#1a1a1a", fontWeight: el.fontWeight ?? "normal", fontStyle: el.fontStyle ?? "normal", textDecoration: el.textDecoration, textAlign: (el.textAlign as React.CSSProperties["textAlign"]) ?? "left", lineHeight: el.lineHeight ?? 1.3, letterSpacing: `${el.letterSpacing ?? 0}px`, cursor: "text" }} />
      ) : (
        <div style={{ width: "100%", height: "100%", background: el.textBackground ?? "transparent", fontFamily: el.fontFamily ?? "Inter", fontSize: el.fontSize ?? 32, color: el.color ?? "#1a1a1a", fontWeight: el.fontWeight ?? "normal", fontStyle: el.fontStyle ?? "normal", textDecoration: el.textDecoration, textAlign: (el.textAlign as React.CSSProperties["textAlign"]) ?? "left", lineHeight: el.lineHeight ?? 1.3, letterSpacing: `${el.letterSpacing ?? 0}px`, wordBreak: "break-word", whiteSpace: "pre-wrap", overflow: "hidden" }}>
          {el.content}
        </div>
      )}
      {selected && <ResizeHandle onMouseDown={(e) => onResizeMouseDown(e, el.id)} />}
    </div>
  );

  if (el.type === "image") return (
    <div style={base} onMouseDown={(e) => onMouseDown(e, el.id)} onClick={(e) => e.stopPropagation()}>
      {rotateHandle}
      {el.imageUrl
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={el.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: (el.objectFit as "cover" | "contain" | "fill") ?? "cover", display: "block", pointerEvents: "none" }} draggable={false} />
        : <div style={{ width: "100%", height: "100%", background: "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: 14 }}>No image</div>}
      {selected && <ResizeHandle onMouseDown={(e) => onResizeMouseDown(e, el.id)} />}
    </div>
  );

  const shapeDef = SHAPES.find((s) => s.id === (el.shapeType ?? "rect")) ?? SHAPES[0];
  return (
    <div style={{ ...base, overflow: "visible" }} onMouseDown={(e) => onMouseDown(e, el.id)} onClick={(e) => e.stopPropagation()}>
      {rotateHandle}
      {shapeDef.render(el.fill ?? "#f97316", el.stroke, (el.strokeWidth ?? 0) > 0 ? el.strokeWidth : undefined)}
      {selected && <ResizeHandle onMouseDown={(e) => onResizeMouseDown(e, el.id)} />}
    </div>
  );
}

function ResizeHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return <div data-resize="true" onMouseDown={onMouseDown} style={{ position: "absolute", bottom: -5, right: -5, width: 12, height: 12, background: "#f97316", border: "2px solid white", borderRadius: 3, cursor: "se-resize", zIndex: 999 }} />;
}

// ── Canvas settings panel ──────────────────────────────────────────────────

function CanvasPanel({ isDark, data, onUpdate, elementCount }: { isDark: boolean; data: DesignData; onUpdate: (p: Partial<DesignData>) => void; elementCount: number }) {
  const lbl = `block text-xs mb-1.5 ${isDark ? "text-gray-400" : "text-gray-600"}`;
  const sec = `text-[10px] font-bold uppercase tracking-widest mb-2 ${isDark ? "text-gray-500" : "text-gray-400"}`;
  const isGradient = data.backgroundType === "gradient";
  const grad = data.backgroundGradient ?? { color1: "#f97316", color2: "#3b82f6", angle: 135 };
  return (
    <div className="p-4 space-y-5">
      <p className={sec}>Canvas</p>

      {/* Background type */}
      <div>
        <div className="flex gap-2 mb-3">
          <button onClick={() => onUpdate({ backgroundType: "solid" })}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${!isGradient ? "bg-orange-500 text-white border-orange-500" : isDark ? "border-[#2A2A2A] text-gray-400" : "border-gray-200 text-gray-600"}`}>
            Solid
          </button>
          <button onClick={() => onUpdate({ backgroundType: "gradient", backgroundGradient: grad })}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${isGradient ? "bg-orange-500 text-white border-orange-500" : isDark ? "border-[#2A2A2A] text-gray-400" : "border-gray-200 text-gray-600"}`}>
            Gradient
          </button>
        </div>

        {!isGradient ? (
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
              <button onClick={() => onUpdate({ backgroundImage: undefined })} className="px-2 h-8 rounded-md text-xs text-red-500 border hover:bg-red-50" style={{ borderColor: isDark ? "#2A2A2A" : "#e5e7eb" }}>Remove</button>
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

function ElementPanel({ el, isDark, onUpdate, onDelete, onDuplicate, onAlign }: {
  el: DesignElement; isDark: boolean;
  onUpdate: (p: Partial<DesignElement>) => void;
  onDelete: () => void; onDuplicate: () => void;
  onAlign: (d: "left" | "center-h" | "right" | "top" | "center-v" | "bottom") => void;
  canvasW: number; canvasH: number;
}) {
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
