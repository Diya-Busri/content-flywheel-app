"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Search, Filter, MoreVertical, Eye, EyeOff, Archive, Trash2,
  RefreshCw, Star, Pin, PinOff, Edit3, AlertTriangle, Shield,
  ShieldOff, Package, ChevronLeft, ChevronRight,
  X, Check, Loader2, StickyNote, ExternalLink,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdminProduct {
  id: string;
  userId: string;
  title: string;
  niche: string;
  format: string;
  status: string;
  moderationStatus: string | null;
  staffPick: boolean;
  pinnedHomepage: boolean;
  adminNotes: string | null;
  isNativePublished: boolean;
  nativePrice: number | null;
  priceLabel: string | null;
  thumbnailUrl: string | null;
  archivedAt: string | null;
  removedAt: string | null;
  createdAt: string;
  updatedAt: string;
  creatorEmail: string | null;
  creatorMembership: string | null;
  creatorStatus: string | null;
  orderCount: number;
  revenueGbp: number;
  viewCount: number;
}

type ModerationAction =
  | "hide" | "suspend" | "restore" | "archive" | "remove"
  | "feature" | "unfeature" | "staff-pick" | "unstaff-pick"
  | "pin" | "unpin" | "edit-metadata" | "add-note";

type StatusTab = "all" | "published" | "hidden" | "archived" | "removed" | "suspended" | "featured";

const STATUS_TABS: { id: StatusTab; label: string; color: string }[] = [
  { id: "all",       label: "All",       color: "text-foreground" },
  { id: "published", label: "Published", color: "text-emerald-600 dark:text-emerald-400" },
  { id: "featured",  label: "Featured",  color: "text-amber-500 dark:text-amber-400" },
  { id: "hidden",    label: "Hidden",    color: "text-amber-600 dark:text-amber-400" },
  { id: "suspended", label: "Suspended", color: "text-orange-600 dark:text-orange-400" },
  { id: "archived",  label: "Archived",  color: "text-muted-foreground" },
  { id: "removed",   label: "Removed",   color: "text-red-600 dark:text-red-400" },
];

// ─── Creator types (for Creators tab) ────────────────────────────────────────

interface AdminCreator {
  userId: string;
  email: string | null;
  membership: string;
  status: string | null;
  hiddenFromMarketplace: boolean;
  deletedAt: string | null;
  productCount: number;
  publishedCount: number;
  isDeleted: boolean;
  isSuspended: boolean;
  createdAt: string;
  lastActiveAt: string | null;
}

type CreatorStatusTab = "all" | "active" | "suspended" | "hidden" | "deleted";

const CREATOR_STATUS_TABS: { id: CreatorStatusTab; label: string; color: string }[] = [
  { id: "all",       label: "All",       color: "text-foreground" },
  { id: "active",    label: "Active",    color: "text-emerald-600 dark:text-emerald-400" },
  { id: "suspended", label: "Suspended", color: "text-orange-600 dark:text-orange-400" },
  { id: "hidden",    label: "Hidden",    color: "text-amber-600 dark:text-amber-400" },
  { id: "deleted",   label: "Deleted",   color: "text-red-600 dark:text-red-400" },
];

const FORMAT_EMOJI: Record<string, string> = {
  ebook: "📘", workbook: "📓", course: "🎓", guide: "📋",
  template: "📄", notion: "📔", checklist: "✅", planner: "📅",
  journal: "📖", spreadsheet: "📊", toolkit: "🧰",
};

// ─── Confirmation Modal ───────────────────────────────────────────────────────

interface ConfirmModalProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  note?: string;
  setNote?: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

function ConfirmModal({ open, title, body, confirmLabel, danger, note, setNote, onConfirm, onCancel, loading }: ConfirmModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-start gap-3">
          {danger && <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />}
          <div>
            <p className="font-semibold text-foreground text-[15px]">{title}</p>
            <p className="text-sm text-muted-foreground mt-1">{body}</p>
          </div>
        </div>
        {setNote !== undefined && (
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60">
              Admin Note (optional)
            </label>
            <textarea
              value={note ?? ""}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Reason for this action…"
              className="w-full text-sm rounded-lg border border-border bg-muted/30 px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-orange-500/30"
            />
          </div>
        )}
        <div className="flex gap-3 justify-end">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={loading}>Cancel</Button>
          <Button
            size="sm"
            disabled={loading}
            onClick={onConfirm}
            className={cn(danger ? "bg-red-500 hover:bg-red-600 text-white" : "bg-orange-500 hover:bg-orange-600 text-white")}
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Metadata Modal ──────────────────────────────────────────────────────

interface EditMetaModalProps {
  open: boolean;
  product: AdminProduct | null;
  onSave: (data: { title: string; niche: string; priceLabel: string; adminNotes: string }) => Promise<void>;
  onClose: () => void;
  loading?: boolean;
}

function EditMetaModal({ open, product, onSave, onClose, loading }: EditMetaModalProps) {
  const [title, setTitle]           = useState("");
  const [niche, setNiche]           = useState("");
  const [priceLabel, setPriceLabel] = useState("");
  const [adminNotes, setAdminNotes] = useState("");

  useEffect(() => {
    if (product) {
      setTitle(product.title ?? "");
      setNiche(product.niche ?? "");
      setPriceLabel(product.priceLabel ?? "");
      setAdminNotes(product.adminNotes ?? "");
    }
  }, [product]);

  if (!open || !product) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-foreground">Edit Product Metadata</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60">Niche</label>
            <Input value={niche} onChange={(e) => setNiche(e.target.value)} className="text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60">Price Label</label>
            <Input value={priceLabel} onChange={(e) => setPriceLabel(e.target.value)} placeholder="e.g. £27" className="text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60">Admin Notes (internal)</label>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              rows={3}
              placeholder="Internal notes about this product…"
              className="w-full text-sm rounded-lg border border-border bg-muted/30 px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-orange-500/30"
            />
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button
            size="sm"
            disabled={loading}
            onClick={() => void onSave({ title, niche, priceLabel, adminNotes })}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Actions Dropdown ─────────────────────────────────────────────────────────

interface ActionMenuProps {
  product: AdminProduct;
  onAction: (product: AdminProduct, action: ModerationAction) => void;
}

function ActionMenu({ product, onAction }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const isRemoved  = !!product.removedAt;
  const isHidden   = product.moderationStatus === "hidden";
  const isSuspended = product.moderationStatus === "suspended";
  const isArchived = !!product.archivedAt && !isRemoved;
  const isActive   = !isRemoved && !isHidden && !isSuspended && !isArchived;

  const item = (icon: React.ReactNode, label: string, action: ModerationAction, className?: string) => (
    <button
      key={action}
      onClick={() => { setOpen(false); onAction(product, action); }}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2 text-[13px] rounded-lg hover:bg-accent transition-colors text-left",
        className
      )}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-30 w-52 bg-popover border border-border rounded-xl shadow-xl p-1.5 space-y-0.5">
          {item(<ExternalLink className="w-3.5 h-3.5" />, "View on Marketplace", "feature")}

          <div className="h-px bg-border my-1" />

          {item(<Edit3 className="w-3.5 h-3.5" />, "Edit Metadata", "edit-metadata")}
          {item(<StickyNote className="w-3.5 h-3.5" />, "Add/Edit Note", "add-note")}

          <div className="h-px bg-border my-1" />

          {/* Feature / Staff Pick / Pin */}
          {product.staffPick
            ? item(<Star className="w-3.5 h-3.5" />, "Remove Staff Pick", "unstaff-pick")
            : item(<Star className="w-3.5 h-3.5 text-amber-500" />, "Mark as Staff Pick", "staff-pick")}
          {product.pinnedHomepage
            ? item(<PinOff className="w-3.5 h-3.5" />, "Unpin from Homepage", "unpin")
            : item(<Pin className="w-3.5 h-3.5 text-blue-500" />, "Pin to Homepage", "pin")}

          <div className="h-px bg-border my-1" />

          {/* Moderation actions */}
          {isActive && item(<EyeOff className="w-3.5 h-3.5 text-amber-500" />, "Hide from Marketplace", "hide", "text-amber-600 dark:text-amber-400")}
          {isActive && item(<Shield className="w-3.5 h-3.5 text-orange-500" />, "Suspend Product", "suspend", "text-orange-600 dark:text-orange-400")}
          {isActive && item(<Archive className="w-3.5 h-3.5" />, "Archive Product", "archive")}
          {(isHidden || isSuspended || isArchived) && item(<RefreshCw className="w-3.5 h-3.5 text-emerald-500" />, "Restore Product", "restore", "text-emerald-600 dark:text-emerald-400")}
          {isRemoved && item(<RefreshCw className="w-3.5 h-3.5 text-emerald-500" />, "Restore Removed Product", "restore", "text-emerald-600 dark:text-emerald-400")}

          <div className="h-px bg-border my-1" />

          {!isRemoved && item(<Trash2 className="w-3.5 h-3.5" />, "Remove Product", "remove", "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20")}
        </div>
      )}
    </div>
  );
}

// ─── Product Row ──────────────────────────────────────────────────────────────

interface ProductRowProps {
  product: AdminProduct;
  onAction: (product: AdminProduct, action: ModerationAction) => void;
}

function ProductRow({ product, onAction }: ProductRowProps) {
  const isRemoved   = !!product.removedAt;
  const isHidden    = product.moderationStatus === "hidden";
  const isSuspended = product.moderationStatus === "suspended";
  const isArchived  = !!product.archivedAt && !isRemoved;

  const statusLabel = isRemoved ? "Removed"
    : isSuspended ? "Suspended"
    : isHidden    ? "Hidden"
    : isArchived  ? "Archived"
    : product.isNativePublished ? "Published"
    : "Draft";

  const statusColor = isRemoved   ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
    : isSuspended  ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
    : isHidden     ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
    : isArchived   ? "bg-muted text-muted-foreground"
    : product.isNativePublished ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
    : "bg-muted text-muted-foreground";

  const emoji = FORMAT_EMOJI[product.format.toLowerCase()] ?? "📦";
  const price = product.priceLabel ?? (product.nativePrice ? `£${(product.nativePrice / 100).toFixed(2)}` : "—");

  return (
    <tr className={cn("border-b border-border/40 hover:bg-accent/20 transition-colors", isRemoved && "opacity-60")}>
      {/* Product */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0 text-lg leading-none">
            {product.thumbnailUrl
              ? <img src={product.thumbnailUrl} alt="" className="w-9 h-9 rounded-lg object-cover" />
              : emoji}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-foreground truncate max-w-[200px]">{product.title}</p>
            <p className="text-[11px] text-muted-foreground capitalize">{product.format} · {product.niche}</p>
            {(product.staffPick || product.pinnedHomepage) && (
              <div className="flex items-center gap-1.5 mt-0.5">
                {product.staffPick && <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400"><Star className="w-2.5 h-2.5" />Staff Pick</span>}
                {product.pinnedHomepage && <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400"><Pin className="w-2.5 h-2.5" />Pinned</span>}
              </div>
            )}
          </div>
        </div>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold", statusColor)}>
          {statusLabel}
        </span>
      </td>

      {/* Creator */}
      <td className="px-4 py-3">
        <p className="text-[12px] text-foreground truncate max-w-[160px]">{product.creatorEmail ?? "—"}</p>
        <p className="text-[10px] text-muted-foreground capitalize">{product.creatorMembership ?? "free"}</p>
      </td>

      {/* Price */}
      <td className="px-4 py-3 text-[13px] text-foreground">{price}</td>

      {/* Analytics */}
      <td className="px-4 py-3">
        <div className="flex flex-col gap-0.5 text-[11px]">
          <span className="text-foreground font-medium">{product.viewCount.toLocaleString()} views</span>
          <span className="text-muted-foreground">{product.orderCount} sales · £{(product.revenueGbp / 100).toFixed(0)}</span>
        </div>
      </td>

      {/* Date */}
      <td className="px-4 py-3 text-[11px] text-muted-foreground">
        {new Date(product.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
      </td>

      {/* Admin Notes */}
      <td className="px-4 py-3 max-w-[140px]">
        {product.adminNotes
          ? <span className="text-[11px] text-muted-foreground line-clamp-2">{product.adminNotes}</span>
          : <span className="text-[11px] text-muted-foreground/40">—</span>}
      </td>

      {/* Actions */}
      <td className="px-4 py-3 text-right">
        <ActionMenu product={product} onAction={onAction} />
      </td>
    </tr>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminMarketplacePage() {
  // ── Data state ──────────────────────────────────────────────────────────
  const [products, setProducts]     = useState<AdminProduct[]>([]);
  const [total, setTotal]           = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  // ── Filter state ──────────────────────────────────────────────────────
  const [statusTab, setStatusTab]   = useState<StatusTab>("all");
  const [q, setQ]                   = useState("");
  const [qInput, setQInput]         = useState("");
  const [niche, setNiche]           = useState("");
  const [sort, setSort]             = useState("newest");
  const [page, setPage]             = useState(1);

  // ── Modal state ──────────────────────────────────────────────────────
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    product: AdminProduct | null;
    action: ModerationAction | null;
    loading: boolean;
    note: string;
  }>({ open: false, product: null, action: null, loading: false, note: "" });

  const [editModal, setEditModal]   = useState<{ open: boolean; product: AdminProduct | null; loading: boolean }>({
    open: false, product: null, loading: false,
  });

  const [noteModal, setNoteModal]   = useState<{ open: boolean; product: AdminProduct | null; loading: boolean; note: string }>({
    open: false, product: null, loading: false, note: "",
  });

  const [toast, setToast]           = useState<{ msg: string; ok: boolean } | null>(null);

  // ── Section toggle (Products / Creators) ─────────────────────────────
  const [section, setSection]         = useState<"products" | "creators">("products");

  // ── Creators tab state ────────────────────────────────────────────────
  const [creators, setCreators]               = useState<AdminCreator[]>([]);
  const [creatorsTotal, setCreatorsTotal]     = useState(0);
  const [creatorsTotalPages, setCreatorsTotalPages] = useState(1);
  const [creatorsLoading, setCreatorsLoading] = useState(false);
  const [creatorsPage, setCreatorsPage]       = useState(1);
  const [creatorsStatusTab, setCreatorsStatusTab] = useState<CreatorStatusTab>("all");
  const [creatorsQ, setCreatorsQ]             = useState("");
  const [creatorsQInput, setCreatorsQInput]   = useState("");
  const [creatorActionBusy, setCreatorActionBusy] = useState(false);

  // ── Fetch products ────────────────────────────────────────────────────
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const isFeaturedTab = statusTab === "featured";
      const params = new URLSearchParams({
        status: isFeaturedTab ? "all" : statusTab,
        sort,
        page: String(page),
        pageSize: "40",
        ...(q     && { q }),
        ...(niche && { niche }),
        ...(isFeaturedTab && { featured: "1" }),
      });
      const res  = await fetch(`/api/admin/marketplace?${params.toString()}`);
      const json = await res.json() as {
        products?: AdminProduct[];
        total?: number;
        totalPages?: number;
        error?: string;
      };
      if (!res.ok) {
        setError(json.error ?? "Failed to load products");
        return;
      }
      setProducts(json.products ?? []);
      setTotal(json.total ?? 0);
      setTotalPages(json.totalPages ?? 1);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }, [statusTab, q, niche, sort, page]);

  useEffect(() => { void fetchProducts(); }, [fetchProducts]);

  // ── Fetch creators ────────────────────────────────────────────────────
  const fetchCreators = useCallback(async () => {
    setCreatorsLoading(true);
    try {
      const params = new URLSearchParams({
        status: creatorsStatusTab,
        page: String(creatorsPage),
        pageSize: "40",
        ...(creatorsQ && { q: creatorsQ }),
      });
      const res  = await fetch(`/api/admin/creators?${params.toString()}`);
      const json = await res.json() as {
        creators?: AdminCreator[];
        total?: number;
        totalPages?: number;
        error?: string;
      };
      setCreators(json.creators ?? []);
      setCreatorsTotal(json.total ?? 0);
      setCreatorsTotalPages(json.totalPages ?? 1);
    } catch {
      // ignore — handled by empty state
    } finally {
      setCreatorsLoading(false);
    }
  }, [creatorsStatusTab, creatorsPage, creatorsQ]);

  useEffect(() => {
    if (section === "creators") void fetchCreators();
  }, [fetchCreators, section]);

  // ── Creator moderation action ─────────────────────────────────────────
  const performCreatorAction = useCallback(async (
    userId: string,
    action: "suspend" | "activate" | "hide" | "unhide" | "delete" | "restore"
  ) => {
    setCreatorActionBusy(true);
    try {
      const res  = await fetch(`/api/admin/creators/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Action failed");
      showToast(`Creator: ${action} done.`);
      void fetchCreators();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Action failed", false);
    } finally {
      setCreatorActionBusy(false);
    }
  }, [fetchCreators]);

  // ── Search submit ─────────────────────────────────────────────────────
  const submitSearch = () => { setQ(qInput); setPage(1); };

  // ── Show toast ────────────────────────────────────────────────────────
  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Perform moderation action ─────────────────────────────────────────
  const performAction = useCallback(async (
    productId: string,
    action: ModerationAction,
    payload: Record<string, unknown> = {}
  ) => {
    const res  = await fetch(`/api/admin/marketplace/${productId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    });
    const json = await res.json() as { ok?: boolean; error?: string };
    if (!res.ok || !json.ok) throw new Error(json.error ?? "Action failed");
    return json;
  }, []);

  // ── Handle action from dropdown ───────────────────────────────────────
  const handleAction = useCallback((product: AdminProduct, action: ModerationAction) => {
    // Actions that need no modal (just execute immediately if non-destructive)
    if (action === "feature" || action === "unfeature") {
      // "feature" from dropdown just opens the product page
      window.open(`/store/${product.userId}/${product.id}`, "_blank");
      return;
    }

    if (action === "staff-pick" || action === "unstaff-pick" || action === "pin" || action === "unpin") {
      void performAction(product.id, action)
        .then(() => {
          showToast(action.includes("un") ? "Badge removed." : "Badge applied.");
          void fetchProducts();
        })
        .catch((e: unknown) => showToast(e instanceof Error ? e.message : "Action failed", false));
      return;
    }

    if (action === "edit-metadata") {
      setEditModal({ open: true, product, loading: false });
      return;
    }

    if (action === "add-note") {
      setNoteModal({ open: true, product, loading: false, note: product.adminNotes ?? "" });
      return;
    }

    // Destructive/moderation actions — show confirmation modal
    setConfirmModal({ open: true, product, action, loading: false, note: "" });
  }, [performAction, fetchProducts]);

  // ── Confirm modal execute ─────────────────────────────────────────────
  const executeConfirm = useCallback(async () => {
    const { product, action, note } = confirmModal;
    if (!product || !action) return;
    setConfirmModal((prev) => ({ ...prev, loading: true }));
    try {
      await performAction(product.id, action, note ? { adminNotes: note } : {});
      setConfirmModal({ open: false, product: null, action: null, loading: false, note: "" });
      const labels: Record<string, string> = {
        hide: "Product hidden.", suspend: "Product suspended.", restore: "Product restored.",
        archive: "Product archived.", remove: "Product removed.",
      };
      showToast(labels[action] ?? "Done.");
      void fetchProducts();
    } catch (e: unknown) {
      setConfirmModal((prev) => ({ ...prev, loading: false }));
      showToast(e instanceof Error ? e.message : "Action failed", false);
    }
  }, [confirmModal, performAction, fetchProducts]);

  // ── Edit metadata save ────────────────────────────────────────────────
  const saveMetadata = useCallback(async (data: { title: string; niche: string; priceLabel: string; adminNotes: string }) => {
    if (!editModal.product) return;
    setEditModal((prev) => ({ ...prev, loading: true }));
    try {
      await performAction(editModal.product.id, "edit-metadata", data);
      setEditModal({ open: false, product: null, loading: false });
      showToast("Metadata saved.");
      void fetchProducts();
    } catch (e: unknown) {
      setEditModal((prev) => ({ ...prev, loading: false }));
      showToast(e instanceof Error ? e.message : "Save failed", false);
    }
  }, [editModal, performAction, fetchProducts]);

  // ── Save admin note ───────────────────────────────────────────────────
  const saveNote = useCallback(async () => {
    if (!noteModal.product) return;
    setNoteModal((prev) => ({ ...prev, loading: true }));
    try {
      await performAction(noteModal.product.id, "add-note", { adminNotes: noteModal.note });
      setNoteModal({ open: false, product: null, loading: false, note: "" });
      showToast("Note saved.");
      void fetchProducts();
    } catch (e: unknown) {
      setNoteModal((prev) => ({ ...prev, loading: false }));
      showToast(e instanceof Error ? e.message : "Save failed", false);
    }
  }, [noteModal, performAction, fetchProducts]);

  // ── Confirm modal copy ────────────────────────────────────────────────
  const confirmCopy: Record<string, { title: string; body: string; label: string; danger?: boolean }> = {
    hide:     { title: "Hide from Marketplace", body: "The product will disappear from the marketplace. The creator's draft is preserved and can be restored.", label: "Hide", danger: false },
    suspend:  { title: "Suspend Product", body: "The product will be suspended and unpublished from the marketplace. This signals a rule violation.", label: "Suspend", danger: true },
    restore:  { title: "Restore Product", body: "The product will be restored to its previous state and may reappear on the marketplace.", label: "Restore", danger: false },
    archive:  { title: "Archive Product", body: "The product will be archived and removed from the marketplace. The creator can restore it themselves.", label: "Archive", danger: false },
    remove:   { title: "Remove Product", body: "The product will be soft-deleted and completely removed from the marketplace. Only admins can see and restore it.", label: "Remove", danger: true },
  };

  const modal = confirmModal.action ? confirmCopy[confirmModal.action] : null;

  // ─────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F9FAFB] dark:bg-[#0F0F0F]">

      {/* Toast */}
      {toast && (
        <div className={cn(
          "fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium shadow-lg transition-all",
          toast.ok
            ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300"
            : "bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700 text-red-700 dark:text-red-300"
        )}>
          {toast.ok ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Confirm Modal */}
      {modal && (
        <ConfirmModal
          open={confirmModal.open}
          title={modal.title}
          body={modal.body}
          confirmLabel={modal.label}
          danger={modal.danger}
          note={confirmModal.note}
          setNote={(v) => setConfirmModal((prev) => ({ ...prev, note: v }))}
          onConfirm={() => void executeConfirm()}
          onCancel={() => setConfirmModal({ open: false, product: null, action: null, loading: false, note: "" })}
          loading={confirmModal.loading}
        />
      )}

      {/* Edit Modal */}
      <EditMetaModal
        open={editModal.open}
        product={editModal.product}
        onSave={saveMetadata}
        onClose={() => setEditModal({ open: false, product: null, loading: false })}
        loading={editModal.loading}
      />

      {/* Note Modal */}
      {noteModal.open && noteModal.product && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-foreground">Admin Note</p>
              <button onClick={() => setNoteModal({ open: false, product: null, loading: false, note: "" })} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <textarea
              value={noteModal.note}
              onChange={(e) => setNoteModal((prev) => ({ ...prev, note: e.target.value }))}
              rows={4}
              placeholder="Internal notes about this product (not visible to creator)…"
              className="w-full text-sm rounded-lg border border-border bg-muted/30 px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-orange-500/30"
            />
            <div className="flex gap-3 justify-end">
              <Button variant="outline" size="sm" onClick={() => setNoteModal({ open: false, product: null, loading: false, note: "" })} disabled={noteModal.loading}>Cancel</Button>
              <Button size="sm" disabled={noteModal.loading} onClick={() => void saveNote()} className="bg-orange-500 hover:bg-orange-600 text-white">
                {noteModal.loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save Note"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="border-b border-border bg-background/95 backdrop-blur-sm px-6 py-4">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Shield className="w-5 h-5 text-orange-500" />
                Marketplace Moderation
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {section === "products" ? `${total.toLocaleString()} products` : `${creatorsTotal.toLocaleString()} creators`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Section toggle */}
              <div className="flex items-center bg-muted/40 rounded-lg p-0.5 border border-border">
                <button
                  onClick={() => setSection("products")}
                  className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold transition-all", section === "products" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
                >
                  <Package className="w-3.5 h-3.5" /> Products
                </button>
                <button
                  onClick={() => setSection("creators")}
                  className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold transition-all", section === "creators" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
                >
                  <Users className="w-3.5 h-3.5" /> Creators
                </button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => section === "products" ? void fetchProducts() : void fetchCreators()}
                className="gap-1.5"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", (loading || creatorsLoading) && "animate-spin")} />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-5">

        {/* ── Creators Section ──────────────────────────────────────────────── */}
        {section === "creators" && (
          <>
            {/* Creator status tabs */}
            <div className="flex items-center gap-1 bg-muted/40 rounded-xl p-1 w-fit border border-border">
              {CREATOR_STATUS_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => { setCreatorsStatusTab(tab.id); setCreatorsPage(1); }}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all",
                    creatorsStatusTab === tab.id
                      ? "bg-background shadow-sm " + tab.color
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Creator search */}
            <div className="flex items-center gap-2 max-w-md">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  value={creatorsQInput}
                  onChange={(e) => setCreatorsQInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { setCreatorsQ(creatorsQInput); setCreatorsPage(1); } }}
                  placeholder="Search by email or user ID…"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                />
              </div>
              <Button size="sm" onClick={() => { setCreatorsQ(creatorsQInput); setCreatorsPage(1); }} className="bg-orange-500 hover:bg-orange-600 text-white shrink-0">Search</Button>
            </div>

            {/* Creator table */}
            <div className="rounded-2xl border border-border bg-background overflow-hidden">
              {creatorsLoading ? (
                <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Loading creators…</span>
                </div>
              ) : creators.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                  <Users className="w-10 h-10 opacity-30" />
                  <p className="text-sm">No creators found.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Creator</th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Products</th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Marketplace</th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Joined</th>
                        <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {creators.map((creator) => {
                        const isDeleted   = !!creator.deletedAt;
                        const isSuspended = creator.isSuspended;
                        const isHidden    = creator.hiddenFromMarketplace && !isDeleted;
                        const statusLabel = isDeleted ? "Deleted" : isSuspended ? "Suspended" : "Active";
                        const statusColor = isDeleted
                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          : isSuspended
                            ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";

                        return (
                          <tr key={creator.userId} className={cn("border-b border-border/40 hover:bg-accent/20 transition-colors", isDeleted && "opacity-60")}>
                            <td className="px-4 py-3">
                              <p className="text-[13px] font-semibold text-foreground truncate max-w-[220px]">{creator.email ?? creator.userId}</p>
                              <p className="text-[10px] text-muted-foreground capitalize">{creator.membership} · {creator.userId.slice(0, 12)}…</p>
                            </td>
                            <td className="px-4 py-3">
                              <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold", statusColor)}>
                                {statusLabel}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-[13px] text-foreground">{creator.publishedCount} published</p>
                              <p className="text-[10px] text-muted-foreground">{creator.productCount} total</p>
                            </td>
                            <td className="px-4 py-3">
                              {isHidden ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                                  <EyeOff className="w-3 h-3" /> Hidden
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                  <Eye className="w-3 h-3" /> Visible
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-[11px] text-muted-foreground">
                              {new Date(creator.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <a href={`/c/${creator.userId}`} target="_blank" rel="noreferrer"
                                  className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors inline-flex items-center"
                                  title="Open store">
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                                {!isDeleted && !isSuspended && (
                                  <button
                                    disabled={creatorActionBusy}
                                    onClick={() => void performCreatorAction(creator.userId, "suspend")}
                                    className="p-1.5 rounded-lg hover:bg-accent text-orange-500 hover:text-orange-600 transition-colors"
                                    title="Suspend creator">
                                    <ShieldOff className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {isSuspended && (
                                  <button
                                    disabled={creatorActionBusy}
                                    onClick={() => void performCreatorAction(creator.userId, "activate")}
                                    className="p-1.5 rounded-lg hover:bg-accent text-emerald-500 hover:text-emerald-600 transition-colors"
                                    title="Activate creator">
                                    <RefreshCw className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {!isDeleted && !isHidden && (
                                  <button
                                    disabled={creatorActionBusy}
                                    onClick={() => void performCreatorAction(creator.userId, "hide")}
                                    className="p-1.5 rounded-lg hover:bg-accent text-amber-500 hover:text-amber-600 transition-colors"
                                    title="Hide from marketplace">
                                    <EyeOff className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {isHidden && (
                                  <button
                                    disabled={creatorActionBusy}
                                    onClick={() => void performCreatorAction(creator.userId, "unhide")}
                                    className="p-1.5 rounded-lg hover:bg-accent text-emerald-500 hover:text-emerald-600 transition-colors"
                                    title="Show in marketplace">
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {isDeleted ? (
                                  <button
                                    disabled={creatorActionBusy}
                                    onClick={() => void performCreatorAction(creator.userId, "restore")}
                                    className="p-1.5 rounded-lg hover:bg-accent text-emerald-500 hover:text-emerald-600 transition-colors"
                                    title="Restore deleted creator">
                                    <RefreshCw className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <button
                                    disabled={creatorActionBusy}
                                    onClick={() => void performCreatorAction(creator.userId, "delete")}
                                    className="p-1.5 rounded-lg hover:bg-accent text-red-500 hover:text-red-600 transition-colors"
                                    title="Delete creator">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Creator pagination */}
            {!creatorsLoading && creatorsTotalPages > 1 && (
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Page {creatorsPage} of {creatorsTotalPages} ({creatorsTotal} creators)</span>
                <div className="flex items-center gap-2">
                  <button disabled={creatorsPage <= 1} onClick={() => setCreatorsPage((p) => p - 1)} className="p-1.5 rounded-lg border border-border hover:bg-accent disabled:opacity-40 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                  <button disabled={creatorsPage >= creatorsTotalPages} onClick={() => setCreatorsPage((p) => p + 1)} className="p-1.5 rounded-lg border border-border hover:bg-accent disabled:opacity-40 transition-colors"><ChevronRight className="w-4 h-4" /></button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Products Section ──────────────────────────────────────────────── */}
        {section === "products" && (<>

        {/* Status Tabs */}
        <div className="flex items-center gap-1 bg-muted/40 rounded-xl p-1 w-fit border border-border">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setStatusTab(tab.id); setPage(1); }}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all",
                statusTab === tab.id
                  ? "bg-background shadow-sm " + tab.color
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search + Filters row */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[260px] max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitSearch()}
                placeholder="Search title, niche, creator…"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-orange-500/30"
              />
            </div>
            <Button size="sm" onClick={submitSearch} className="bg-orange-500 hover:bg-orange-600 text-white shrink-0">Search</Button>
          </div>

          <input
            value={niche}
            onChange={(e) => { setNiche(e.target.value); setPage(1); }}
            placeholder="Filter by niche…"
            className="px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-orange-500/30 w-[160px]"
          />

          <select
            value={sort}
            onChange={(e) => { setSort(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-orange-500/30"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="sales">Most sales</option>
          </select>

          {(q || niche) && (
            <button
              onClick={() => { setQ(""); setQInput(""); setNiche(""); setPage(1); }}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" /> Clear filters
            </button>
          )}
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-border bg-background overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading products…</span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-16 gap-3 text-red-500">
              <AlertTriangle className="w-5 h-5" />
              <span className="text-sm">{error}</span>
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <Package className="w-10 h-10 opacity-30" />
              <p className="text-sm">No products found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Product</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Creator</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Price</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Analytics</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Created</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Notes</th>
                    <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <ProductRow key={p.id} product={p} onAction={handleAction} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Page {page} of {totalPages} ({total} products)</span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="p-1.5 rounded-lg border border-border hover:bg-accent disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="p-1.5 rounded-lg border border-border hover:bg-accent disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        </>)} {/* end products section */}
      </div>
    </div>
  );
}
