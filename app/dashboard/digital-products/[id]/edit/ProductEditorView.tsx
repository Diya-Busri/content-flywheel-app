"use client";

import { useContext } from "react";
import Link from "next/link";
import { Loader2, Undo2, Redo2, BookOpen, X } from "lucide-react";
import { ProductEditorContext } from "./ProductEditorContext";

const PRODUCT_EDITOR_PREVIEW_CSS =
  ".product-editor-preview-layout p { margin-bottom: var(--paragraph-spacing, 1rem); line-height: var(--line-height, 1.6); text-align: var(--text-align, left); } " +
  ".product-editor-preview-layout h2 { margin-top: calc(var(--section-spacing, 2rem) * 1.5); margin-bottom: calc(var(--paragraph-spacing, 1rem) * 1.5); text-align: var(--text-align, left); } " +
  ".product-editor-preview-layout h3 { margin-top: calc(var(--section-spacing, 2rem) * 0.75); margin-bottom: calc(var(--paragraph-spacing, 1rem) * 0.75); text-align: var(--text-align, left); } " +
  ".product-editor-preview-layout section { margin-bottom: var(--section-spacing, 2rem); } " +
  ".product-editor-preview-layout ul, .product-editor-preview-layout ol { margin-bottom: var(--paragraph-spacing, 1rem); padding-left: 1.5rem; text-align: var(--text-align, left); } " +
  ".product-editor-preview-layout li { margin-bottom: 0.5rem; }";

export function ProductEditorView() {
  const ctx = useContext(ProductEditorContext);
  if (!ctx) return null;

  const product = ctx.product as { title: string };
  const saving = ctx.saving as boolean;
  const lastSaved = ctx.lastSaved as Date | null;
  const showHistory = ctx.showHistory as boolean;
  const setShowHistory = ctx.setShowHistory as (v: boolean | ((prev: boolean) => boolean)) => void;
  const historyIndex = ctx.historyIndex as number;
  const history = ctx.history as { timestamp?: number }[];
  const jumpToHistoryVersion = ctx.jumpToHistoryVersion as (i: number) => void;
  const setShowFullPreview = ctx.setShowFullPreview as (v: boolean) => void;
  const handleDownloadPdf = ctx.handleDownloadPdf as () => void;
  const handleUndo = ctx.handleUndo as () => void;
  const handleRedo = ctx.handleRedo as () => void;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <style dangerouslySetInnerHTML={{ __html: PRODUCT_EDITOR_PREVIEW_CSS }} />
      <header className="sticky top-0 z-40 border-b border-border bg-background px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/digital-products" className="text-muted-foreground hover:text-white text-sm transition-colors">
              ← Back
            </Link>
            <h1 className="text-lg font-semibold text-white truncate max-w-[220px] md:max-w-md">{product?.title ?? "Product"}</h1>
            {saving ? (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Saving...
              </span>
            ) : lastSaved ? (
              <span className="text-sm text-green-500">✓ Saved</span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              className="p-2 hover:bg-muted rounded disabled:opacity-30 text-foreground transition-colors"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={historyIndex >= (history?.length ?? 1) - 1}
              className="p-2 hover:bg-muted rounded disabled:opacity-30 text-foreground transition-colors"
              title="Redo (Ctrl+Shift+Z)"
            >
              <Redo2 className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowHistory((v: boolean) => !v)}
              className="p-2 hover:bg-muted rounded text-muted-foreground hover:text-white transition-colors"
              title="History"
            >
              <BookOpen className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setShowFullPreview(true)}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded text-white text-sm transition-colors"
            >
              Preview
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded font-medium text-white text-sm transition-colors"
            >
              Export
            </button>
          </div>
        </div>
      </header>

      {showHistory && Array.isArray(history) && (
        <div className="fixed right-0 top-0 h-screen w-64 bg-[#1A1A1A] border-l border-[#2A2A2A] shadow-xl p-4 overflow-y-auto z-50">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-white">Edit history</h3>
            <button
              type="button"
              onClick={() => setShowHistory(false)}
              className="p-1.5 rounded hover:bg-[#2A2A2A] text-[#A0A0A0]"
              aria-label="Close history"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2">
            {history.map((state, index) => (
              <button
                key={index}
                type="button"
                onClick={() => jumpToHistoryVersion(index)}
                className={`w-full text-left p-2 rounded text-sm ${
                  index === historyIndex ? "bg-orange-500 text-white" : "bg-[#2A2A2A] hover:bg-[#333] text-[#E0E0E0]"
                }`}
              >
                <div className="font-medium">{index === historyIndex ? "→ " : ""}Version {index + 1}</div>
                <div className="text-xs opacity-80">
                  {state?.timestamp ? new Date(state.timestamp).toLocaleTimeString() : "—"}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-1 min-h-0 p-8">
        <div className="flex-1 bg-muted rounded-lg flex items-center justify-center text-muted-foreground">
          <p>Editor canvas — full UI is being restored. Use Preview and Export above.</p>
        </div>
      </div>
    </div>
  );
}
