"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  Type,
  ImageIcon,
  Square,
  Trash2,
  Copy,
  Loader2,
  Check,
  Download,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Minus,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDashboardTheme } from "@/components/dashboard-theme-provider";
import { DesignData, DesignElement } from "@/db/schema/designs-schema";

const FONT_FAMILIES = ["Inter", "Georgia", "Playfair Display", "Oswald", "Pacifico", "Roboto Mono", "Dancing Script"];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

type DragState = {
  startX: number;
  startY: number;
  origX: number;
  origY: number;
};

type ResizeState = {
  startX: number;
  startY: number;
  origW: number;
  origH: number;
  origX: number;
  origY: number;
};

export function DesignEditor({ designId }: { designId: string }) {
  const { theme } = useDashboardTheme();
  const isDark = theme === "dark";

  const [title, setTitle] = useState("Untitled Design");
  const [editingTitle, setEditingTitle] = useState(false);
  const [data, setData] = useState<DesignData>({
    width: 800,
    height: 1100,
    background: "#ffffff",
    elements: [],
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  const canvasRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const dragRef = useRef<DragState | null>(null);
  const resizeRef = useRef<ResizeState | null>(null);
  const draggingId = useRef<string | null>(null);
  const resizingId = useRef<string | null>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load design
  useEffect(() => {
    fetch(`/api/designs/${designId}`)
      .then((r) => r.json())
      .then(({ design }) => {
        if (design) {
          setTitle(design.title);
          setData(design.data as DesignData);
        }
      })
      .finally(() => setLoading(false));
  }, [designId]);

  // Auto-fit canvas to container
  useEffect(() => {
    const obs = new ResizeObserver(() => {
      if (!containerRef.current) return;
      const { width, height } = containerRef.current.getBoundingClientRect();
      const padding = 80;
      const scaleW = (width - padding) / data.width;
      const scaleH = (height - padding) / data.height;
      setScale(Math.min(scaleW, scaleH, 2));
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [data.width, data.height]);

  // Debounced save
  const scheduleSave = useCallback(
    (nextData: DesignData, nextTitle: string) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        setSaving(true);
        try {
          await fetch(`/api/designs/${designId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: nextTitle, data: nextData }),
          });
          setLastSaved(new Date());
        } finally {
          setSaving(false);
        }
      }, 1200);
    },
    [designId]
  );

  function updateData(updater: (prev: DesignData) => DesignData) {
    setData((prev) => {
      const next = updater(prev);
      scheduleSave(next, title);
      return next;
    });
  }

  function updateTitle(val: string) {
    setTitle(val);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      await fetch(`/api/designs/${designId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: val, data }),
      });
      setLastSaved(new Date());
      setSaving(false);
    }, 800);
  }

  const selectedEl = data.elements.find((e) => e.id === selectedId) ?? null;

  function updateElement(id: string, patch: Partial<DesignElement>) {
    updateData((prev) => ({
      ...prev,
      elements: prev.elements.map((el) => (el.id === id ? { ...el, ...patch } : el)),
    }));
  }

  function addText() {
    const el: DesignElement = {
      id: uid(),
      type: "text",
      x: 80,
      y: 80,
      width: 300,
      height: 60,
      content: "Double-click to edit",
      fontSize: 32,
      fontFamily: "Inter",
      color: "#1a1a1a",
      fontWeight: "600",
      fontStyle: "normal",
      textAlign: "left",
      zIndex: data.elements.length,
    };
    updateData((prev) => ({ ...prev, elements: [...prev.elements, el] }));
    setSelectedId(el.id);
  }

  function addShape() {
    const el: DesignElement = {
      id: uid(),
      type: "shape",
      x: 100,
      y: 100,
      width: 200,
      height: 200,
      fill: "#f97316",
      borderRadius: 16,
      zIndex: data.elements.length,
    };
    updateData((prev) => ({ ...prev, elements: [...prev.elements, el] }));
    setSelectedId(el.id);
  }

  function addImage() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) return;
      const { url } = await res.json();
      const el: DesignElement = {
        id: uid(),
        type: "image",
        x: 50,
        y: 50,
        width: 300,
        height: 300,
        imageUrl: url,
        objectFit: "cover",
        zIndex: data.elements.length,
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

  // --- Drag logic ---
  function onElementMouseDown(e: React.MouseEvent, id: string) {
    if ((e.target as HTMLElement).dataset.resize) return;
    e.stopPropagation();
    setSelectedId(id);
    const el = data.elements.find((x) => x.id === id)!;
    draggingId.current = id;
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: el.x, origY: el.y };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = (ev.clientX - dragRef.current.startX) / scale;
      const dy = (ev.clientY - dragRef.current.startY) / scale;
      updateElement(id, {
        x: clamp(dragRef.current.origX + dx, 0, data.width - 20),
        y: clamp(dragRef.current.origY + dy, 0, data.height - 20),
      });
    };
    const onUp = () => {
      dragRef.current = null;
      draggingId.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function onResizeMouseDown(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    e.preventDefault();
    const el = data.elements.find((x) => x.id === id)!;
    resizingId.current = id;
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origW: el.width,
      origH: el.height,
      origX: el.x,
      origY: el.y,
    };
    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const dx = (ev.clientX - resizeRef.current.startX) / scale;
      const dy = (ev.clientY - resizeRef.current.startY) / scale;
      updateElement(id, {
        width: Math.max(40, resizeRef.current.origW + dx),
        height: Math.max(20, resizeRef.current.origH + dy),
      });
    };
    const onUp = () => {
      resizeRef.current = null;
      resizingId.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function onCanvasClick(e: React.MouseEvent) {
    if ((e.target as HTMLElement) === canvasRef.current) setSelectedId(null);
  }

  // Delete key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selectedId) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        const tag = (document.activeElement as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "DIV") return;
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
    const dataUrl = await toPng(canvasRef.current, { width: data.width, height: data.height, pixelRatio: 2 });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${title}.png`;
    a.click();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full overflow-hidden ${isDark ? "bg-[#0F0F0F] text-white" : "bg-[#F9FAFB] text-gray-900"}`}>
      {/* Toolbar */}
      <header className={`shrink-0 h-14 flex items-center justify-between gap-4 px-4 border-b ${isDark ? "bg-[#0F0F0F]/95 border-[#2A2A2A]" : "bg-white/95 border-gray-200"} backdrop-blur-sm shadow-sm z-40`}>
        <div className="flex items-center gap-4 min-w-0">
          <Link href="/dashboard/design-studio" className={`flex items-center gap-1 text-sm shrink-0 ${isDark ? "text-gray-400 hover:text-orange-500" : "text-gray-500 hover:text-orange-500"}`}>
            <ChevronLeft className="w-4 h-4" /> Back
          </Link>
          <div className={`h-5 w-px hidden sm:block ${isDark ? "bg-[#2A2A2A]" : "bg-gray-200"}`} />
          {editingTitle ? (
            <Input
              autoFocus
              value={title}
              onChange={(e) => updateTitle(e.target.value)}
              onBlur={() => setEditingTitle(false)}
              onKeyDown={(e) => { if (e.key === "Enter") setEditingTitle(false); }}
              className="h-7 text-sm font-semibold w-48 px-2"
            />
          ) : (
            <button onClick={() => setEditingTitle(true)} className={`text-sm font-semibold truncate max-w-[200px] hover:text-orange-500 transition-colors ${isDark ? "text-white" : "text-gray-900"}`}>
              {title}
            </button>
          )}
          {saving ? (
            <span className={`flex items-center gap-1 text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}><Loader2 className="w-3 h-3 animate-spin" /> Saving…</span>
          ) : lastSaved ? (
            <span className="flex items-center gap-1 text-xs text-emerald-600"><Check className="w-3 h-3" /> Saved</span>
          ) : null}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Add tools */}
          <Button size="sm" variant="outline" onClick={addText} className={isDark ? "border-[#2A2A2A] text-gray-300 hover:bg-[#2A2A2A]" : ""}>
            <Type className="w-4 h-4" /><span className="hidden sm:inline ml-1.5">Text</span>
          </Button>
          <Button size="sm" variant="outline" onClick={addShape} className={isDark ? "border-[#2A2A2A] text-gray-300 hover:bg-[#2A2A2A]" : ""}>
            <Square className="w-4 h-4" /><span className="hidden sm:inline ml-1.5">Shape</span>
          </Button>
          <Button size="sm" variant="outline" onClick={addImage} className={isDark ? "border-[#2A2A2A] text-gray-300 hover:bg-[#2A2A2A]" : ""}>
            <ImageIcon className="w-4 h-4" /><span className="hidden sm:inline ml-1.5">Image</span>
          </Button>

          <div className={`h-5 w-px ${isDark ? "bg-[#2A2A2A]" : "bg-gray-200"}`} />

          <Button size="sm" variant="outline" onClick={exportPng} className={isDark ? "border-[#2A2A2A] text-gray-300 hover:bg-[#2A2A2A]" : ""}>
            <Download className="w-4 h-4" /><span className="hidden sm:inline ml-1.5">Export PNG</span>
          </Button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Canvas area */}
        <div
          ref={containerRef}
          className={`flex-1 flex items-center justify-center overflow-auto p-8 ${isDark ? "bg-[#151515]" : "bg-gray-100"}`}
          style={{ backgroundImage: isDark ? "radial-gradient(circle, #2A2A2A 1px, transparent 1px)" : "radial-gradient(circle, #d1d5db 1px, transparent 1px)", backgroundSize: "24px 24px" }}
        >
          <div
            style={{
              width: data.width * scale,
              height: data.height * scale,
              position: "relative",
              flexShrink: 0,
            }}
          >
            <div
              ref={canvasRef}
              style={{
                width: data.width,
                height: data.height,
                background: data.background,
                position: "absolute",
                top: 0,
                left: 0,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
                overflow: "hidden",
                boxShadow: "0 4px 40px rgba(0,0,0,0.25)",
              }}
              onClick={onCanvasClick}
            >
              {[...data.elements]
                .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
                .map((el) => (
                  <CanvasElement
                    key={el.id}
                    el={el}
                    selected={el.id === selectedId}
                    onMouseDown={onElementMouseDown}
                    onResizeMouseDown={onResizeMouseDown}
                    onUpdate={(patch) => updateElement(el.id, patch)}
                  />
                ))}
            </div>
          </div>
        </div>

        {/* Right panel */}
        <aside className={`w-72 shrink-0 border-l flex flex-col overflow-y-auto ${isDark ? "border-[#2A2A2A] bg-[#1A1A1A]" : "border-gray-200 bg-white"}`}>
          {selectedEl ? (
            <ElementPanel
              el={selectedEl}
              isDark={isDark}
              onUpdate={(patch) => updateElement(selectedEl.id, patch)}
              onDelete={deleteSelected}
              onDuplicate={duplicateSelected}
            />
          ) : (
            <CanvasPanel isDark={isDark} data={data} onUpdate={(patch) => updateData((prev) => ({ ...prev, ...patch }))} />
          )}
        </aside>
      </div>
    </div>
  );
}

// ---- Canvas Element ----

function CanvasElement({
  el,
  selected,
  onMouseDown,
  onResizeMouseDown,
  onUpdate,
}: {
  el: DesignElement;
  selected: boolean;
  onMouseDown: (e: React.MouseEvent, id: string) => void;
  onResizeMouseDown: (e: React.MouseEvent, id: string) => void;
  onUpdate: (patch: Partial<DesignElement>) => void;
}) {
  const [editing, setEditing] = useState(false);

  const style: React.CSSProperties = {
    position: "absolute",
    left: el.x,
    top: el.y,
    width: el.width,
    height: el.height,
    opacity: el.opacity ?? 1,
    cursor: "move",
    userSelect: "none",
    outline: selected ? "2px solid #f97316" : "none",
    outlineOffset: 2,
    zIndex: el.zIndex ?? 0,
  };

  if (el.type === "text") {
    return (
      <div
        style={style}
        onMouseDown={(e) => onMouseDown(e, el.id)}
        onDoubleClick={() => setEditing(true)}
      >
        {editing ? (
          <textarea
            autoFocus
            value={el.content ?? ""}
            onChange={(e) => onUpdate({ content: e.target.value })}
            onBlur={() => setEditing(false)}
            style={{
              width: "100%",
              height: "100%",
              background: "transparent",
              border: "none",
              outline: "none",
              resize: "none",
              fontFamily: el.fontFamily ?? "Inter",
              fontSize: el.fontSize ?? 32,
              color: el.color ?? "#1a1a1a",
              fontWeight: el.fontWeight ?? "normal",
              fontStyle: el.fontStyle ?? "normal",
              textAlign: (el.textAlign as React.CSSProperties["textAlign"]) ?? "left",
              lineHeight: el.lineHeight ?? 1.3,
              cursor: "text",
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              fontFamily: el.fontFamily ?? "Inter",
              fontSize: el.fontSize ?? 32,
              color: el.color ?? "#1a1a1a",
              fontWeight: el.fontWeight ?? "normal",
              fontStyle: el.fontStyle ?? "normal",
              textAlign: (el.textAlign as React.CSSProperties["textAlign"]) ?? "left",
              lineHeight: el.lineHeight ?? 1.3,
              wordBreak: "break-word",
              whiteSpace: "pre-wrap",
              overflow: "hidden",
            }}
          >
            {el.content}
          </div>
        )}
        {selected && <ResizeHandle onMouseDown={(e) => onResizeMouseDown(e, el.id)} />}
      </div>
    );
  }

  if (el.type === "image") {
    return (
      <div style={style} onMouseDown={(e) => onMouseDown(e, el.id)}>
        {el.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={el.imageUrl}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: (el.objectFit as "cover" | "contain" | "fill") ?? "cover", display: "block", pointerEvents: "none" }}
            draggable={false}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", background: "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: 14 }}>No image</div>
        )}
        {selected && <ResizeHandle onMouseDown={(e) => onResizeMouseDown(e, el.id)} />}
      </div>
    );
  }

  // shape
  return (
    <div
      style={{
        ...style,
        background: el.fill ?? "#f97316",
        borderRadius: el.borderRadius ?? 0,
        border: el.stroke ? `${el.strokeWidth ?? 2}px solid ${el.stroke}` : undefined,
      }}
      onMouseDown={(e) => onMouseDown(e, el.id)}
    >
      {selected && <ResizeHandle onMouseDown={(e) => onResizeMouseDown(e, el.id)} />}
    </div>
  );
}

function ResizeHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <div
      data-resize="true"
      onMouseDown={onMouseDown}
      style={{
        position: "absolute",
        bottom: -5,
        right: -5,
        width: 12,
        height: 12,
        background: "#f97316",
        border: "2px solid white",
        borderRadius: 3,
        cursor: "se-resize",
        zIndex: 999,
      }}
    />
  );
}

// ---- Right Panel: Canvas settings ----

function CanvasPanel({
  isDark,
  data,
  onUpdate,
}: {
  isDark: boolean;
  data: DesignData;
  onUpdate: (patch: Partial<DesignData>) => void;
}) {
  return (
    <div className="p-4 space-y-5">
      <p className={`text-xs font-semibold uppercase tracking-wider ${isDark ? "text-gray-500" : "text-gray-400"}`}>Canvas</p>
      <div>
        <label className={`block text-xs mb-1.5 ${isDark ? "text-gray-400" : "text-gray-600"}`}>Background color</label>
        <div className="flex items-center gap-2">
          <input type="color" value={data.background} onChange={(e) => onUpdate({ background: e.target.value })} className="w-8 h-8 rounded border-0 cursor-pointer" />
          <Input
            value={data.background}
            onChange={(e) => onUpdate({ background: e.target.value })}
            className="h-8 text-xs font-mono flex-1"
          />
        </div>
      </div>
      <div>
        <p className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>
          Size: {data.width} × {data.height}px
          {data.presetName ? ` (${data.presetName})` : ""}
        </p>
      </div>
      <p className={`text-xs ${isDark ? "text-gray-600" : "text-gray-400"}`}>
        Click an element to edit its properties, or use the toolbar buttons to add text, shapes, or images.
      </p>
    </div>
  );
}

// ---- Right Panel: Element properties ----

function ElementPanel({
  el,
  isDark,
  onUpdate,
  onDelete,
  onDuplicate,
}: {
  el: DesignElement;
  isDark: boolean;
  onUpdate: (patch: Partial<DesignElement>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const label = isDark ? "text-gray-400" : "text-gray-600";
  const section = `text-xs font-semibold uppercase tracking-wider mb-3 ${isDark ? "text-gray-500" : "text-gray-400"}`;

  return (
    <div className="p-4 space-y-5 overflow-y-auto">
      <div className="flex items-center justify-between">
        <p className={section} style={{ marginBottom: 0 }}>{el.type === "text" ? "Text" : el.type === "image" ? "Image" : "Shape"}</p>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={onDuplicate} className="h-7 w-7 p-0"><Copy className="w-3.5 h-3.5" /></Button>
          <Button size="sm" variant="ghost" onClick={onDelete} className="h-7 w-7 p-0 text-red-500"><Trash2 className="w-3.5 h-3.5" /></Button>
        </div>
      </div>

      {/* Position & Size */}
      <div>
        <p className={section}>Position & Size</p>
        <div className="grid grid-cols-2 gap-2">
          {(["x", "y", "width", "height"] as const).map((key) => (
            <div key={key}>
              <label className={`block text-[10px] mb-1 ${label}`}>{key.toUpperCase()}</label>
              <Input
                type="number"
                value={Math.round(el[key] as number)}
                onChange={(e) => onUpdate({ [key]: Number(e.target.value) })}
                className="h-7 text-xs"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Opacity */}
      <div>
        <label className={`block text-xs mb-1 ${label}`}>Opacity {Math.round((el.opacity ?? 1) * 100)}%</label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={el.opacity ?? 1}
          onChange={(e) => onUpdate({ opacity: Number(e.target.value) })}
          className="w-full"
        />
      </div>

      {/* Text-specific */}
      {el.type === "text" && (
        <>
          <div>
            <p className={section}>Typography</p>
            <div className="space-y-2">
              <div>
                <label className={`block text-xs mb-1 ${label}`}>Font family</label>
                <select
                  value={el.fontFamily ?? "Inter"}
                  onChange={(e) => onUpdate({ fontFamily: e.target.value })}
                  className={`w-full h-8 text-xs rounded-md border px-2 ${isDark ? "bg-[#111] border-[#2A2A2A] text-white" : "bg-white border-gray-200 text-gray-900"}`}
                >
                  {FONT_FAMILIES.map((f) => <option key={f}>{f}</option>)}
                </select>
              </div>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className={`block text-xs mb-1 ${label}`}>Size</label>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onUpdate({ fontSize: Math.max(8, (el.fontSize ?? 32) - 2) })}><Minus className="w-3 h-3" /></Button>
                    <Input type="number" value={el.fontSize ?? 32} onChange={(e) => onUpdate({ fontSize: Number(e.target.value) })} className="h-7 text-xs text-center" />
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onUpdate({ fontSize: (el.fontSize ?? 32) + 2 })}><Plus className="w-3 h-3" /></Button>
                  </div>
                </div>
              </div>
              <div>
                <label className={`block text-xs mb-1 ${label}`}>Color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={el.color ?? "#1a1a1a"} onChange={(e) => onUpdate({ color: e.target.value })} className="w-8 h-8 rounded cursor-pointer border-0" />
                  <Input value={el.color ?? "#1a1a1a"} onChange={(e) => onUpdate({ color: e.target.value })} className="h-8 text-xs font-mono flex-1" />
                </div>
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" variant={el.fontWeight === "bold" || el.fontWeight === "700" ? "default" : "outline"} className="h-7 flex-1" onClick={() => onUpdate({ fontWeight: el.fontWeight === "700" ? "400" : "700" })}>
                  <Bold className="w-3.5 h-3.5" />
                </Button>
                <Button size="sm" variant={el.fontStyle === "italic" ? "default" : "outline"} className="h-7 flex-1" onClick={() => onUpdate({ fontStyle: el.fontStyle === "italic" ? "normal" : "italic" })}>
                  <Italic className="w-3.5 h-3.5" />
                </Button>
                {(["left", "center", "right"] as const).map((align) => (
                  <Button key={align} size="sm" variant={el.textAlign === align ? "default" : "outline"} className="h-7 flex-1" onClick={() => onUpdate({ textAlign: align })}>
                    {align === "left" ? <AlignLeft className="w-3.5 h-3.5" /> : align === "center" ? <AlignCenter className="w-3.5 h-3.5" /> : <AlignRight className="w-3.5 h-3.5" />}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Shape-specific */}
      {el.type === "shape" && (
        <div>
          <p className={section}>Shape</p>
          <div className="space-y-2">
            <div>
              <label className={`block text-xs mb-1 ${label}`}>Fill color</label>
              <div className="flex items-center gap-2">
                <input type="color" value={el.fill ?? "#f97316"} onChange={(e) => onUpdate({ fill: e.target.value })} className="w-8 h-8 rounded cursor-pointer border-0" />
                <Input value={el.fill ?? "#f97316"} onChange={(e) => onUpdate({ fill: e.target.value })} className="h-8 text-xs font-mono flex-1" />
              </div>
            </div>
            <div>
              <label className={`block text-xs mb-1 ${label}`}>Border radius</label>
              <Input type="number" value={el.borderRadius ?? 0} onChange={(e) => onUpdate({ borderRadius: Number(e.target.value) })} className="h-8 text-xs" />
            </div>
            <div>
              <label className={`block text-xs mb-1 ${label}`}>Stroke color</label>
              <div className="flex items-center gap-2">
                <input type="color" value={el.stroke ?? "#000000"} onChange={(e) => onUpdate({ stroke: e.target.value })} className="w-8 h-8 rounded cursor-pointer border-0" />
                <Input value={el.stroke ?? ""} placeholder="none" onChange={(e) => onUpdate({ stroke: e.target.value || undefined })} className="h-8 text-xs font-mono flex-1" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image-specific */}
      {el.type === "image" && (
        <div>
          <p className={section}>Image</p>
          <div>
            <label className={`block text-xs mb-1 ${label}`}>Fit</label>
            <select
              value={el.objectFit ?? "cover"}
              onChange={(e) => onUpdate({ objectFit: e.target.value })}
              className={`w-full h-8 text-xs rounded-md border px-2 ${isDark ? "bg-[#111] border-[#2A2A2A] text-white" : "bg-white border-gray-200 text-gray-900"}`}
            >
              <option value="cover">Cover</option>
              <option value="contain">Contain</option>
              <option value="fill">Fill</option>
            </select>
          </div>
        </div>
      )}

      {/* Layer order */}
      <div>
        <p className={section}>Layer</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className={`flex-1 text-xs ${isDark ? "border-[#2A2A2A] text-gray-300" : ""}`}
            onClick={() => onUpdate({ zIndex: (el.zIndex ?? 0) + 1 })}>Bring forward</Button>
          <Button size="sm" variant="outline" className={`flex-1 text-xs ${isDark ? "border-[#2A2A2A] text-gray-300" : ""}`}
            onClick={() => onUpdate({ zIndex: Math.max(0, (el.zIndex ?? 0) - 1) })}>Send back</Button>
        </div>
      </div>
    </div>
  );
}
