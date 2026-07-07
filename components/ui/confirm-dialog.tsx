/**
 * ConfirmDialog — accessible replacement for window.confirm()
 * ──────────────────────────────────────────────────────────────────────────────
 * Usage (controlled):
 *   const [open, setOpen] = useState(false);
 *   <ConfirmDialog
 *     open={open}
 *     onOpenChange={setOpen}
 *     title="Delete section?"
 *     description="This cannot be undone."
 *     confirmLabel="Delete"
 *     confirmVariant="destructive"
 *     onConfirm={() => { deleteSection(); setOpen(false); }}
 *   />
 *
 * Usage (imperative hook):
 *   const confirm = useConfirm();
 *   const ok = await confirm({ title: "Start over?", description: "..." });
 *   if (ok) { ... }
 */
"use client";

import { useState, useCallback, createContext, useContext, useRef } from "react";
import { AlertTriangle, Info } from "lucide-react";

/* ─── Types ──────────────────────────────────────────────────────────────────── */

type Variant = "destructive" | "warning" | "info";

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Variant;
};

/* ─── Controlled component ───────────────────────────────────────────────────── */

type Props = ConfirmOptions & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

const VARIANT_STYLES: Record<Variant, { icon: React.ReactNode; btn: string }> = {
  destructive: {
    icon: <AlertTriangle className="w-5 h-5 text-red-500" />,
    btn:  "bg-red-500 hover:bg-red-600 text-white",
  },
  warning: {
    icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,
    btn:  "bg-amber-500 hover:bg-amber-600 text-white",
  },
  info: {
    icon: <Info className="w-5 h-5 text-blue-500" />,
    btn:  "bg-orange-500 hover:bg-orange-600 text-white",
  },
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel  = "Cancel",
  variant      = "destructive",
  onConfirm,
}: Props) {
  const v = VARIANT_STYLES[variant];

  if (!open) return null;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby={description ? "confirm-desc" : undefined}
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#111] shadow-2xl p-6 animate-[fade-slide-in_0.15s_ease-out]">
        {/* Icon + title */}
        <div className="flex items-start gap-3 mb-3">
          <div className="mt-0.5 shrink-0">{v.icon}</div>
          <div>
            <h2 id="confirm-title" className="text-base font-bold text-gray-900 dark:text-white">
              {title}
            </h2>
            {description && (
              <p id="confirm-desc" className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 mt-5">
          <button
            autoFocus
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 rounded-lg text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-500 ${v.btn}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Imperative hook via context ─────────────────────────────────────────────── */

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

type ProviderState = { open: boolean; opts: ConfirmOptions; resolve: ((v: boolean) => void) | null };

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ProviderState>({
    open: false,
    opts: { title: "" },
    resolve: null,
  });

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ open: true, opts, resolve });
    });
  }, []);

  const handleConfirm = () => {
    state.resolve?.(true);
    setState(s => ({ ...s, open: false, resolve: null }));
  };

  const handleCancel = () => {
    state.resolve?.(false);
    setState(s => ({ ...s, open: false, resolve: null }));
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        open={state.open}
        onOpenChange={(o) => { if (!o) handleCancel(); }}
        onConfirm={handleConfirm}
        title={state.opts.title}
        description={state.opts.description}
        confirmLabel={state.opts.confirmLabel}
        cancelLabel={state.opts.cancelLabel}
        variant={state.opts.variant}
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return ctx;
}
