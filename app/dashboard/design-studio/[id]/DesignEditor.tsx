"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft, Type, ImageIcon, Square, Trash2, Copy, Loader2, Check,
  Download, Bold, Italic, AlignLeft, AlignCenter, AlignRight, Minus, Plus, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDashboardTheme } from "@/components/dashboard-theme-provider";
import { DesignData, DesignElement } from "@/db/schema/designs-schema";

// ── Shape library ──────────────────────────────────────────────────────────

type ShapeDef = { id: string; label: string; render: (fill: string, stroke?: string, sw?: number) => React.ReactNode };

const SHAPES: ShapeDef[] = [
  {
    id: "rect", label: "Rectangle",
    render: (f, s, sw) => <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}><rect x={sw ? sw / 2 : 0} y={sw ? sw / 2 : 0} width={100 - (sw ?? 0)} height={100 - (sw ?? 0)} fill={f} stroke={s ?? "none"} strokeWidth={sw ?? 0} rx="4" /></svg>,
  },
  {
    id: "circle", label: "Circle",
    render: (f, s, sw) => <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}><ellipse cx="50" cy="50" rx={50 - (sw ?? 0) / 2} ry={50 - (sw ?? 0) / 2} fill={f} stroke={s ?? "none"} strokeWidth={sw ?? 0} /></svg>,
  },
  {
    id: "triangle", label: "Triangle",
    render: (f, s, sw) => <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}><polygon points="50,2 98,98 2,98" fill={f} stroke={s ?? "none"} strokeWidth={sw ?? 0} /></svg>,
  },
  {
    id: "triangle-down", label: "Triangle Down",
    render: (f, s, sw) => <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}><polygon points="2,2 98,2 50,98" fill={f} stroke={s ?? "none"} strokeWidth={sw ?? 0} /></svg>,
  },
  {
    id: "diamond", label: "Diamond",
    render: (f, s, sw) => <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}><polygon points="50,2 98,50 50,98 2,50" fill={f} stroke={s ?? "none"} strokeWidth={sw ?? 0} /></svg>,
  },
  {
    id: "star", label: "Star",
    render: (f, s, sw) => <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}><polygon points="50,2 61,35 96,35 68,57 79,91 50,70 21,91 32,57 4,35 39,35" fill={f} stroke={s ?? "none"} strokeWidth={sw ?? 0} /></svg>,
  },
  {
    id: "star6", label: "Star 6",
    render: (f, s, sw) => <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}><polygon points="50,2 61,38 96,38 68,60 80,95 50,75 20,95 32,60 4,38 39,38" fill={f} stroke={s ?? "none"} strokeWidth={sw ?? 0} /><polygon points="50,98 39,62 4,62 32,40 20,5 50,25 80,5 68,40 96,62 61,62" fill={f} stroke={s ?? "none"} strokeWidth={sw ?? 0} /></svg>,
  },
  {
    id: "heart", label: "Heart",
    render: (f, s, sw) => <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}><path d="M50,85 C10,62 0,47 0,32 C0,16 12,5 25,5 C35,5 44,12 50,22 C56,12 65,5 75,5 C88,5 100,16 100,32 C100,47 90,62 50,85 Z" fill={f} stroke={s ?? "none"} strokeWidth={sw ?? 0} /></svg>,
  },
  {
    id: "pentagon", label: "Pentagon",
    render: (f, s, sw) => <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}><polygon points="50,2 97,35 79,91 21,91 3,35" fill={f} stroke={s ?? "none"} strokeWidth={sw ?? 0} /></svg>,
  },
  {
    id: "hexagon", label: "Hexagon",
    render: (f, s, sw) => <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}><polygon points="50,2 93,26 93,74 50,98 7,74 7,26" fill={f} stroke={s ?? "none"} strokeWidth={sw ?? 0} /></svg>,
  },
  {
    id: "octagon", label: "Octagon",
    render: (f, s, sw) => <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}><polygon points="30,2 70,2 98,30 98,70 70,98 30,98 2,70 2,30" fill={f} stroke={s ?? "none"} strokeWidth={sw ?? 0} /></svg>,
  },
  {
    id: "cross", label: "Plus / Cross",
    render: (f, s, sw) => <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}><path d="M35,0 H65 V35 H100 V65 H65 V100 H35 V65 H0 V35 H35 Z" fill={f} stroke={s ?? "none"} strokeWidth={sw ?? 0} /></svg>,
  },
  {
    id: "arrow-right", label: "Arrow →",
    render: (f, s, sw) => <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}><polygon points="0,32 62,32 62,12 100,50 62,88 62,68 0,68" fill={f} stroke={s ?? "none"} strokeWidth={sw ?? 0} /></svg>,
  },
  {
    id: "arrow-left", label: "Arrow ←",
    render: (f, s, sw) => <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}><polygon points="100,32 38,32 38,12 0,50 38,88 38,68 100,68" fill={f} stroke={s ?? "none"} strokeWidth={sw ?? 0} /></svg>,
  },
  {
    id: "arrow-double", label: "Arrow ↔",
    render: (f, s, sw) => <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}><polygon points="0,50 22,22 22,38 78,38 78,22 100,50 78,78 78,62 22,62 22,78" fill={f} stroke={s ?? "none"} strokeWidth={sw ?? 0} /></svg>,
  },
  {
    id: "chevron", label: "Chevron →",
    render: (f, s, sw) => <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}><polygon points="0,0 70,0 100,50 70,100 0,100 30,50" fill={f} stroke={s ?? "none"} strokeWidth={sw ?? 0} /></svg>,
  },
  {
    id: "parallelogram", label: "Parallelogram",
    render: (f, s, sw) => <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}><polygon points="20,2 100,2 80,98 0,98" fill={f} stroke={s ?? "none"} strokeWidth={sw ?? 0} /></svg>,
  },
  {
    id: "trapezoid", label: "Trapezoid",
    render: (f, s, sw) => <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}><polygon points="15,2 85,2 100,98 0,98" fill={f} stroke={s ?? "none"} strokeWidth={sw ?? 0} /></svg>,
  },
  {
    id: "speech-bubble", label: "Speech Bubble",
    render: (f, s, sw) => <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}><path d="M5,2 Q2,2 2,5 L2,65 Q2,68 5,68 L30,68 L20,90 L55,68 L95,68 Q98,68 98,65 L98,5 Q98,2 95,2 Z" fill={f} stroke={s ?? "none"} strokeWidth={sw ?? 0} /></svg>,
  },
  {
    id: "line-h", label: "Line —",
    render: (f, s) => <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}><line x1="0" y1="50" x2="100" y2="50" stroke={f} strokeWidth={8} strokeLinecap="round" /></svg>,
  },
  {
    id: "line-diag", label: "Line ╲",
    render: (f) => <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}><line x1="5" y1="5" x2="95" y2="95" stroke={f} strokeWidth={8} strokeLinecap="round" /></svg>,
  },
];

// ── Constants ──────────────────────────────────────────────────────────────

const FONT_FAMILIES = [
  "Inter", "Georgia", "Playfair Display", "Oswald", "Pacifico",
  "Roboto Mono", "Dancing Script", "Arial", "Times New Roman",
];

const QUICK_COLORS = [
  "#ffffff", "#000000", "#f97316", "#3b82f6", "#22c55e",
  "#ef4444", "#a855f7", "#eab308", "#ec4899", "#14b8a6",
  "#f1f5f9", "#1e293b", "#fef3c7", "#dbeafe", "#dcfce7",
];

function uid() { return Math.random().toString(36).slice(2, 10); }
function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }

type DragState = { startX: number; startY: number; origX: number; origY: number };
type ResizeState = { startX: number; startY: number; origW: number; origH: number; origX: number; origY: number };

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

  const canvasRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.7);

  const dragRef = useRef<DragState | null>(null);
  const resizeRef = useRef<ResizeState | null>(null);
  const draggingId = useRef<string | null>(null);
  const resizingId = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch(`/api/designs/${designId}`)
      .then((r) => r.json())
      .then(({ design }) => { if (design) { setTitle(design.title); setData(design.data as DesignData); } })
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

  const scheduleSave = useCallback((nextData: DesignData, nextTitle: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        await fetch(`/api/designs/${designId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: nextTitle, data: nextData }),
        });
        setLastSaved(new Date());
      } finally { setSaving(false); }
    }, 1200);
  }, [designId]);

  function updateData(updater: (prev: DesignData) => DesignData) {
    setData((prev) => { const next = updater(prev); scheduleSave(next, title); return next; });
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

  function updateElement(id: string, patch: Partial<DesignElement>) {
    updateData((prev) => ({ ...prev, elements: prev.elements.map((el) => el.id === id ? { ...el, ...patch } : el) }));
  }

  function addText() {
    const el: DesignElement = {
      id: uid(), type: "text",
      x: Math.round(data.width / 2 - 150), y: Math.round(data.height / 2 - 30),
      width: 300, height: 60, content: "Add your text here",
      fontSize: 40, fontFamily: "Inter", color: "#1a1a1a",
      fontWeight: "700", fontStyle: "normal", textAlign: "center", zIndex: data.elements.length,
    };
    updateData((prev) => ({ ...prev, elements: [...prev.elements, el] }));
    setSelectedId(el.id);
  }

  function addShape(shapeType = "rect") {
    const el: DesignElement = {
      id: uid(), type: "shape", shapeType,
      x: Math.round(data.width / 2 - 100), y: Math.round(data.height / 2 - 100),
      width: 200, height: 200, fill: "#f97316",
      strokeWidth: 0, zIndex: data.elements.length,
    };
    updateData((prev) => ({ ...prev, elements: [...prev.elements, el] }));
    setSelectedId(el.id);
    setShowShapePicker(false);
  }

  function addImage() {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) return;
      const { url } = await res.json();
      const el: DesignElement = {
        id: uid(), type: "image",
        x: Math.round(data.width / 2 - 150), y: Math.round(data.height / 2 - 150),
        width: 300, height: 300, imageUrl: url, objectFit: "cover", zIndex: data.elements.length,
      };
      updateData((prev) => ({ ...prev, elements: [...prev.elements, el] }));
      setSelectedId(el.id);
    };
    input.click();
  }

  function deleteSelected() {
    if (!selectedId) return;
    updateData((prev) => ({ ...prev, elements: prev.elements.filter((e) => e.id !== selectedId) }));
    setSelectedId(null);
  }

  function duplicateSelected() {
    if (!selectedEl) return;
    const clone: DesignElement = { ...selectedEl, id: uid(), x: selectedEl.x + 20, y: selectedEl.y + 20 };
    updateData((prev) => ({ ...prev, elements: [...prev.elements, clone] }));
    setSelectedId(clone.id);
  }

  function onElementMouseDown(e: React.MouseEvent, id: string) {
    if ((e.target as HTMLElement).dataset.resize) return;
    e.stopPropagation();
    setSelectedId(id);
    const el = data.elements.find((x) => x.id === id)!;
    draggingId.current = id;
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: el.x, origY: el.y };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      updateElement(id, {
        x: clamp(dragRef.current.origX + (ev.clientX - dragRef.current.startX) / scale, -el.width + 20, data.width - 20),
        y: clamp(dragRef.current.origY + (ev.clientY - dragRef.current.startY) / scale, -el.height + 20, data.height - 20),
      });
    };
    const onUp = () => { dragRef.current = null; draggingId.current = null; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
  }

  function onResizeMouseDown(e: React.MouseEvent, id: string) {
    e.stopPropagation(); e.preventDefault();
    const el = data.elements.find((x) => x.id === id)!;
    resizingId.current = id;
    resizeRef.current = { startX: e.clientX, startY: e.clientY, origW: el.width, origH: el.height, origX: el.x, origY: el.y };
    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      updateElement(id, {
        width: Math.max(20, resizeRef.current.origW + (ev.clientX - resizeRef.current.startX) / scale),
        height: Math.max(20, resizeRef.current.origH + (ev.clientY - resizeRef.current.startY) / scale),
      });
    };
    const onUp = () => { resizeRef.current = null; resizingId.current = null; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
  }

  function onCanvasClick(e: React.MouseEvent) {
    if ((e.target as HTMLElement) === canvasRef.current) setSelectedId(null);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selectedId) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        const el = document.activeElement as HTMLElement;
        if (el?.tagName === "INPUT" || el?.tagName === "TEXTAREA" || el?.isContentEditable) return;
        deleteSelected();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  async function exportPng() {
    const { toPng } = await import("html-to-image");
    if (!canvasRef.current) return;
    const url = await toPng(canvasRef.current, { width: data.width, height: data.height, pixelRatio: 2 });
    const a = document.createElement("a"); a.href = url; a.download = `${title}.png`; a.click();
  }

  const panelCls = isDark ? "border-[#2A2A2A] bg-[#1A1A1A]" : "border-gray-200 bg-white";

  if (loading) return <div className="flex items-center justify-center h-screen"><Loader2 className="w-6 h-6 animate-spin text-orange-500" /></div>;

  return (
    <div className={`flex flex-col h-full overflow-hidden ${isDark ? "bg-[#0F0F0F] text-white" : "bg-[#F9FAFB] text-gray-900"}`}>

      {/* Top bar */}
      <header className={`shrink-0 flex items-center justify-between gap-4 px-4 border-b ${isDark ? "bg-[#0F0F0F]/95 border-[#2A2A2A]" : "bg-white/95 border-gray-200"} backdrop-blur-sm shadow-sm z-40`} style={{ height: 52 }}>
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/dashboard/design-studio" className={`flex items-center gap-1 text-sm shrink-0 ${isDark ? "text-gray-400 hover:text-orange-500" : "text-gray-500 hover:text-orange-500"}`}>
            <ChevronLeft className="w-4 h-4" /> Back
          </Link>
          <div className={`h-5 w-px ${isDark ? "bg-[#2A2A2A]" : "bg-gray-200"}`} />
          {editingTitle ? (
            <Input autoFocus value={title} onChange={(e) => updateTitle(e.target.value)} onBlur={() => setEditingTitle(false)} onKeyDown={(e) => { if (e.key === "Enter") setEditingTitle(false); }} className="h-7 text-sm font-semibold w-44 px-2" />
          ) : (
            <button onClick={() => setEditingTitle(true)} className={`text-sm font-semibold truncate max-w-[180px] hover:text-orange-500 ${isDark ? "text-white" : "text-gray-900"}`}>{title}</button>
          )}
          {saving ? <span className="flex items-center gap-1 text-xs text-gray-400"><Loader2 className="w-3 h-3 animate-spin" /> Saving…</span>
            : lastSaved ? <span className="flex items-center gap-1 text-xs text-emerald-600"><Check className="w-3 h-3" /> Saved</span> : null}
        </div>
        <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white gap-1.5" onClick={exportPng}>
          <Download className="w-4 h-4" /> Export PNG
        </Button>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Left tools panel */}
        <aside className={`w-[76px] shrink-0 border-r flex flex-col gap-1 py-3 px-2 items-center overflow-y-auto ${panelCls}`}>
          <p className={`text-[9px] font-bold uppercase tracking-widest mb-1 ${isDark ? "text-gray-600" : "text-gray-400"}`}>Add</p>

          <ToolBtn icon={<Type className="w-5 h-5" />} label="Text" onClick={addText} isDark={isDark} />

          {/* Shape button with picker */}
          <div className="relative w-full">
            <button
              onClick={() => setShowShapePicker((v) => !v)}
              className={`w-full flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg transition-colors ${isDark ? "text-gray-400 hover:bg-white/10 hover:text-white" : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"}`}
            >
              <div className="flex items-center gap-0.5">
                <Square className="w-5 h-5" />
                <ChevronDown className="w-3 h-3" />
              </div>
              <span className="text-[9px] font-medium leading-none">Shapes</span>
            </button>
            {showShapePicker && (
              <div className={`absolute left-full top-0 ml-2 z-50 rounded-xl border shadow-xl p-3 w-64 ${isDark ? "bg-[#1A1A1A] border-[#2A2A2A]" : "bg-white border-gray-200"}`}>
                <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${isDark ? "text-gray-500" : "text-gray-400"}`}>Choose a shape</p>
                <div className="grid grid-cols-4 gap-2">
                  {SHAPES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => addShape(s.id)}
                      title={s.label}
                      className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${isDark ? "hover:bg-white/10" : "hover:bg-gray-100"}`}
                    >
                      <div className="w-10 h-10">{s.render("#f97316")}</div>
                      <span className={`text-[9px] leading-none text-center ${isDark ? "text-gray-400" : "text-gray-500"}`}>{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <ToolBtn icon={<ImageIcon className="w-5 h-5" />} label="Image" onClick={addImage} isDark={isDark} />

          <div className={`w-full my-2 border-t ${isDark ? "border-[#2A2A2A]" : "border-gray-200"}`} />

          {/* Background color */}
          <p className={`text-[9px] font-bold uppercase tracking-widest mb-1 ${isDark ? "text-gray-600" : "text-gray-400"}`}>BG</p>
          <div className="relative w-10 h-10 rounded-lg overflow-hidden border-2 cursor-pointer shadow-sm" style={{ borderColor: isDark ? "#2A2A2A" : "#e5e7eb" }}>
            <div className="absolute inset-0 checkerboard" />
            <div className="absolute inset-0" style={{ background: data.background }} />
            <input type="color" value={data.background} onChange={(e) => updateData((prev) => ({ ...prev, background: e.target.value }))} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
          </div>

          {selectedId && (
            <>
              <div className={`w-full my-2 border-t ${isDark ? "border-[#2A2A2A]" : "border-gray-200"}`} />
              <p className={`text-[9px] font-bold uppercase tracking-widest mb-1 ${isDark ? "text-gray-600" : "text-gray-400"}`}>Sel</p>
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
          onClick={() => { setSelectedId(null); setShowShapePicker(false); }}
        >
          <div style={{ width: data.width * scale, height: data.height * scale, position: "relative", flexShrink: 0 }}>
            <div
              ref={canvasRef}
              style={{ width: data.width, height: data.height, background: data.background, position: "absolute", top: 0, left: 0, transform: `scale(${scale})`, transformOrigin: "top left", overflow: "hidden", boxShadow: "0 4px 40px rgba(0,0,0,0.25)" }}
              onClick={onCanvasClick}
            >
              {[...data.elements].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)).map((el) => (
                <CanvasElement key={el.id} el={el} selected={el.id === selectedId} onMouseDown={onElementMouseDown} onResizeMouseDown={onResizeMouseDown} onUpdate={(patch) => updateElement(el.id, patch)} />
              ))}
            </div>
          </div>
        </div>

        {/* Right panel */}
        <aside className={`w-64 shrink-0 border-l flex flex-col overflow-y-auto ${panelCls}`}>
          {selectedEl
            ? <ElementPanel el={selectedEl} isDark={isDark} onUpdate={(patch) => updateElement(selectedEl.id, patch)} onDelete={deleteSelected} onDuplicate={duplicateSelected} />
            : <CanvasPanel isDark={isDark} data={data} onUpdate={(patch) => updateData((prev) => ({ ...prev, ...patch }))} elementCount={data.elements.length} />}
        </aside>
      </div>
    </div>
  );
}

// ── Tool button ─────────────────────────────────────────────────────────────

function ToolBtn({ icon, label, onClick, isDark, danger }: { icon: React.ReactNode; label: string; onClick: () => void; isDark: boolean; danger?: boolean }) {
  return (
    <button onClick={onClick} title={label}
      className={`w-full flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg transition-colors ${danger ? "text-red-400 hover:bg-red-500/10" : isDark ? "text-gray-400 hover:bg-white/10 hover:text-white" : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"}`}>
      {icon}
      <span className="text-[9px] font-medium leading-none">{label}</span>
    </button>
  );
}

// ── Canvas element ──────────────────────────────────────────────────────────

function CanvasElement({ el, selected, onMouseDown, onResizeMouseDown, onUpdate }: {
  el: DesignElement; selected: boolean;
  onMouseDown: (e: React.MouseEvent, id: string) => void;
  onResizeMouseDown: (e: React.MouseEvent, id: string) => void;
  onUpdate: (patch: Partial<DesignElement>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const base: React.CSSProperties = {
    position: "absolute", left: el.x, top: el.y, width: el.width, height: el.height,
    opacity: el.opacity ?? 1, cursor: "move", userSelect: "none",
    outline: selected ? "2px solid #f97316" : "none", outlineOffset: 2, zIndex: el.zIndex ?? 0,
  };

  if (el.type === "text") return (
    <div style={base} onMouseDown={(e) => onMouseDown(e, el.id)} onClick={(e) => e.stopPropagation()} onDoubleClick={() => setEditing(true)}>
      {editing ? (
        <textarea autoFocus value={el.content ?? ""} onChange={(e) => onUpdate({ content: e.target.value })} onBlur={() => setEditing(false)}
          style={{ width: "100%", height: "100%", background: "transparent", border: "none", outline: "none", resize: "none", fontFamily: el.fontFamily ?? "Inter", fontSize: el.fontSize ?? 32, color: el.color ?? "#1a1a1a", fontWeight: el.fontWeight ?? "normal", fontStyle: el.fontStyle ?? "normal", textAlign: (el.textAlign as React.CSSProperties["textAlign"]) ?? "left", lineHeight: el.lineHeight ?? 1.3, cursor: "text" }} />
      ) : (
        <div style={{ width: "100%", height: "100%", fontFamily: el.fontFamily ?? "Inter", fontSize: el.fontSize ?? 32, color: el.color ?? "#1a1a1a", fontWeight: el.fontWeight ?? "normal", fontStyle: el.fontStyle ?? "normal", textAlign: (el.textAlign as React.CSSProperties["textAlign"]) ?? "left", lineHeight: el.lineHeight ?? 1.3, wordBreak: "break-word", whiteSpace: "pre-wrap", overflow: "hidden" }}>
          {el.content}
        </div>
      )}
      {selected && <ResizeHandle onMouseDown={(e) => onResizeMouseDown(e, el.id)} />}
    </div>
  );

  if (el.type === "image") return (
    <div style={base} onMouseDown={(e) => onMouseDown(e, el.id)} onClick={(e) => e.stopPropagation()}>
      {el.imageUrl
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={el.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: (el.objectFit as "cover" | "contain" | "fill") ?? "cover", display: "block", pointerEvents: "none" }} draggable={false} />
        : <div style={{ width: "100%", height: "100%", background: "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: 14 }}>No image</div>}
      {selected && <ResizeHandle onMouseDown={(e) => onResizeMouseDown(e, el.id)} />}
    </div>
  );

  // Shape — rendered as SVG
  const shapeDef = SHAPES.find((s) => s.id === (el.shapeType ?? "rect")) ?? SHAPES[0];
  return (
    <div style={{ ...base, overflow: "visible" }} onMouseDown={(e) => onMouseDown(e, el.id)} onClick={(e) => e.stopPropagation()}>
      {shapeDef.render(el.fill ?? "#f97316", el.stroke, (el.strokeWidth ?? 0) > 0 ? el.strokeWidth : undefined)}
      {selected && <ResizeHandle onMouseDown={(e) => onResizeMouseDown(e, el.id)} />}
    </div>
  );
}

function ResizeHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return <div data-resize="true" onMouseDown={onMouseDown} style={{ position: "absolute", bottom: -5, right: -5, width: 12, height: 12, background: "#f97316", border: "2px solid white", borderRadius: 3, cursor: "se-resize", zIndex: 999 }} />;
}

// ── Canvas settings panel ───────────────────────────────────────────────────

function CanvasPanel({ isDark, data, onUpdate, elementCount }: { isDark: boolean; data: DesignData; onUpdate: (p: Partial<DesignData>) => void; elementCount: number }) {
  const lbl = `block text-xs mb-1.5 ${isDark ? "text-gray-400" : "text-gray-600"}`;
  const sec = `text-[10px] font-bold uppercase tracking-widest mb-2 ${isDark ? "text-gray-500" : "text-gray-400"}`;
  return (
    <div className="p-4 space-y-5">
      <p className={sec}>Canvas</p>
      <div>
        <label className={lbl}>Background</label>
        <div className="flex items-center gap-2 mb-2">
          <input type="color" value={data.background} onChange={(e) => onUpdate({ background: e.target.value })} className="w-8 h-8 rounded border-0 cursor-pointer shrink-0" />
          <Input value={data.background} onChange={(e) => onUpdate({ background: e.target.value })} className="h-8 text-xs font-mono" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_COLORS.map((c) => <button key={c} onClick={() => onUpdate({ background: c })} className={`w-6 h-6 rounded-md border-2 hover:scale-110 transition-transform ${data.background === c ? "border-orange-500" : isDark ? "border-[#2A2A2A]" : "border-gray-200"}`} style={{ background: c }} />)}
        </div>
      </div>
      <p className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>{data.width} × {data.height}px{data.presetName ? ` · ${data.presetName}` : ""} · {elementCount} element{elementCount !== 1 ? "s" : ""}</p>
      <div className={`rounded-xl p-3 text-xs space-y-1.5 ${isDark ? "bg-white/5 text-gray-400" : "bg-gray-50 text-gray-500"}`}>
        <p className="font-semibold">Tips</p>
        <p>• Click <strong>Shapes</strong> to pick from 20+ shapes</p>
        <p>• Double-click text to edit it</p>
        <p>• Drag the orange corner to resize</p>
        <p>• <kbd className="px-1 py-0.5 rounded bg-gray-200 dark:bg-white/10 font-mono text-[10px]">Delete</kbd> removes selected</p>
      </div>
    </div>
  );
}

// ── Element properties panel ────────────────────────────────────────────────

function ElementPanel({ el, isDark, onUpdate, onDelete, onDuplicate }: {
  el: DesignElement; isDark: boolean;
  onUpdate: (p: Partial<DesignElement>) => void;
  onDelete: () => void; onDuplicate: () => void;
}) {
  const lbl = `block text-xs mb-1 ${isDark ? "text-gray-400" : "text-gray-600"}`;
  const sec = `text-[10px] font-bold uppercase tracking-widest mb-2 ${isDark ? "text-gray-500" : "text-gray-400"}`;
  const sel = isDark ? "bg-[#111] border-[#2A2A2A] text-white" : "bg-white border-gray-200 text-gray-900";

  return (
    <div className="p-4 space-y-5">
      <div className="flex items-center justify-between">
        <p className={sec} style={{ margin: 0 }}>{el.type === "text" ? "Text" : el.type === "image" ? "Image" : (SHAPES.find((s) => s.id === el.shapeType)?.label ?? "Shape")}</p>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={onDuplicate} className="h-7 w-7 p-0" title="Duplicate"><Copy className="w-3.5 h-3.5" /></Button>
          <Button size="sm" variant="ghost" onClick={onDelete} className="h-7 w-7 p-0 text-red-500" title="Delete"><Trash2 className="w-3.5 h-3.5" /></Button>
        </div>
      </div>

      {/* Position & size */}
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

      {/* Opacity */}
      <div>
        <label className={lbl}>Opacity {Math.round((el.opacity ?? 1) * 100)}%</label>
        <input type="range" min={0} max={1} step={0.01} value={el.opacity ?? 1} onChange={(e) => onUpdate({ opacity: Number(e.target.value) })} className="w-full" />
      </div>

      {/* Text */}
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
            <div className="flex gap-2 items-center">
              <input type="color" value={el.color ?? "#1a1a1a"} onChange={(e) => onUpdate({ color: e.target.value })} className="w-8 h-8 rounded cursor-pointer border-0 shrink-0" />
              <Input value={el.color ?? "#1a1a1a"} onChange={(e) => onUpdate({ color: e.target.value })} className="h-8 text-xs font-mono" />
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {QUICK_COLORS.map((c) => <button key={c} onClick={() => onUpdate({ color: c })} className={`w-5 h-5 rounded border ${el.color === c ? "border-orange-500" : isDark ? "border-[#2A2A2A]" : "border-gray-200"}`} style={{ background: c }} />)}
            </div>
          </div>
          <div className="flex gap-1.5">
            <Button size="sm" variant={el.fontWeight === "700" ? "default" : "outline"} className="h-7 flex-1" onClick={() => onUpdate({ fontWeight: el.fontWeight === "700" ? "400" : "700" })}><Bold className="w-3.5 h-3.5" /></Button>
            <Button size="sm" variant={el.fontStyle === "italic" ? "default" : "outline"} className="h-7 flex-1" onClick={() => onUpdate({ fontStyle: el.fontStyle === "italic" ? "normal" : "italic" })}><Italic className="w-3.5 h-3.5" /></Button>
            {(["left", "center", "right"] as const).map((a) => (
              <Button key={a} size="sm" variant={el.textAlign === a ? "default" : "outline"} className="h-7 flex-1" onClick={() => onUpdate({ textAlign: a })}>
                {a === "left" ? <AlignLeft className="w-3.5 h-3.5" /> : a === "center" ? <AlignCenter className="w-3.5 h-3.5" /> : <AlignRight className="w-3.5 h-3.5" />}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Shape */}
      {el.type === "shape" && (
        <div className="space-y-3">
          <p className={sec}>Shape</p>
          {/* Change shape type */}
          <div>
            <label className={lbl}>Shape type</label>
            <div className="grid grid-cols-5 gap-1.5 max-h-40 overflow-y-auto">
              {SHAPES.map((s) => (
                <button key={s.id} onClick={() => onUpdate({ shapeType: s.id })} title={s.label}
                  className={`p-1 rounded-lg border-2 transition-colors ${el.shapeType === s.id ? "border-orange-500 bg-orange-50 dark:bg-orange-500/10" : isDark ? "border-[#2A2A2A] hover:border-gray-500" : "border-gray-200 hover:border-gray-400"}`}>
                  <div className="w-full aspect-square">{s.render(el.fill ?? "#f97316")}</div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={lbl}>Fill color</label>
            <div className="flex gap-2 items-center">
              <input type="color" value={el.fill ?? "#f97316"} onChange={(e) => onUpdate({ fill: e.target.value })} className="w-8 h-8 rounded cursor-pointer border-0 shrink-0" />
              <Input value={el.fill ?? "#f97316"} onChange={(e) => onUpdate({ fill: e.target.value })} className="h-8 text-xs font-mono" />
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {QUICK_COLORS.map((c) => <button key={c} onClick={() => onUpdate({ fill: c })} className={`w-5 h-5 rounded border ${el.fill === c ? "border-orange-500" : isDark ? "border-[#2A2A2A]" : "border-gray-200"}`} style={{ background: c }} />)}
            </div>
          </div>
          <div>
            <label className={lbl}>Stroke color</label>
            <div className="flex gap-2 items-center">
              <input type="color" value={el.stroke ?? "#000000"} onChange={(e) => onUpdate({ stroke: e.target.value })} className="w-8 h-8 rounded cursor-pointer border-0 shrink-0" />
              <Input value={el.stroke ?? ""} placeholder="none" onChange={(e) => onUpdate({ stroke: e.target.value || undefined })} className="h-8 text-xs font-mono" />
            </div>
          </div>
          <div>
            <label className={lbl}>Stroke width: {el.strokeWidth ?? 0}px</label>
            <input type="range" min={0} max={20} step={1} value={el.strokeWidth ?? 0} onChange={(e) => onUpdate({ strokeWidth: Number(e.target.value) })} className="w-full" />
          </div>
        </div>
      )}

      {/* Image */}
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
          <Button size="sm" variant="outline" className={`flex-1 text-xs ${isDark ? "border-[#2A2A2A] text-gray-300" : ""}`} onClick={() => onUpdate({ zIndex: (el.zIndex ?? 0) + 1 })}>Forward</Button>
          <Button size="sm" variant="outline" className={`flex-1 text-xs ${isDark ? "border-[#2A2A2A] text-gray-300" : ""}`} onClick={() => onUpdate({ zIndex: Math.max(0, (el.zIndex ?? 0) - 1) })}>Back</Button>
        </div>
      </div>
    </div>
  );
}
