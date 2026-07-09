"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { Search, ShoppingBag, Sparkles, X, TrendingUp, Star, MoreVertical, Eye, EyeOff, Archive, Trash2, Star as StarIcon, Pin, PinOff, Edit3, ExternalLink, RotateCcw, Shield, AlertTriangle, Loader2, Check } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type MarketplaceItem = {
  id: string;
  title: string;
  niche: string;
  format: string;
  priceLabel: string | null;
  nativePrice: number | null;
  thumbnailUrl: string | null;
  description: string;
  creatorName: string;
  creatorUserId: string;
  salesCount: number | null;
  trendingCount: number;
  avgRating: number | null;
  reviewCount: number;
  wishlistCount: number;
  featured: boolean;
};

type ApiResponse = {
  items: MarketplaceItem[];
  total: number;
  page: number;
  pageSize: number;
  niches: string[];
  formats: string[];
};

type Sort = "newest" | "best-sellers" | "trending" | "price-asc" | "price-desc" | "free";

type RecommendedCreator = {
  userId: string;
  displayName: string;
  bio: string | null;
  profileImageUrl: string | null;
  accentColor: string;
  productCount: number;
  followerCount: number;
};

const SORT_TABS: { id: Sort; label: string; emoji: string }[] = [
  { id: "trending",     label: "Trending",    emoji: "🔥" },
  { id: "best-sellers", label: "Best Sellers", emoji: "⭐" },
  { id: "newest",       label: "New",          emoji: "🆕" },
  { id: "price-asc",   label: "Low Price",    emoji: "💸" },
  { id: "price-desc",  label: "High Price",   emoji: "💰" },
  { id: "free",        label: "Free",          emoji: "🎁" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function priceDisplay(item: MarketplaceItem) {
  if (item.nativePrice === 0) return "Free";
  if (item.nativePrice != null) return `£${(item.nativePrice / 100).toFixed(2)}`;
  if (item.priceLabel) return item.priceLabel;
  return "";
}

function creatorInitials(name: string) {
  return name.split(" ").map((w) => w[0]?.toUpperCase() ?? "").slice(0, 2).join("") || "CF";
}

// Creator level — mirrors CREATOR_LEVELS in lib/rewards-config.ts
function getCreatorLevelBadge(salesCount: number | null): { emoji: string; label: string } {
  const s = salesCount ?? 0;
  if (s >= 250) return { emoji: "💎", label: "Elite" };
  if (s >= 50)  return { emoji: "⭐", label: "Pro" };
  if (s >= 5)   return { emoji: "🚀", label: "Rising" };
  return { emoji: "🌱", label: "New" };
}

const AVATAR_COLORS = ["#f97316","#8b5cf6","#3b82f6","#10b981","#ec4899","#f59e0b","#6366f1"];
function avatarColor(userId: string) {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}

function StarRow({ rating, count, size = 13 }: { rating: number; count: number; size?: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} style={{ color: i < full ? "#f59e0b" : i === full && half ? "#f59e0b" : "#d1d5db", fontSize: `${size}px`, lineHeight: 1 }}>
          {i < full ? "★" : i === full && half ? "⯨" : "☆"}
        </span>
      ))}
      <span style={{ fontSize: `${size - 1}px`, color: "#374151", fontWeight: 700, marginLeft: "2px" }}>{rating.toFixed(1)}</span>
      <span style={{ fontSize: `${size - 2}px`, color: "#9ca3af" }}>({count})</span>
    </div>
  );
}

// ─── Admin: confirm modal ─────────────────────────────────────────────────────

type AdminAction = "feature" | "unfeature" | "staff-pick" | "unstaff-pick" | "pin" | "unpin" | "hide" | "archive" | "restore" | "remove" | "unpublish" | "duplicate";

type CreatorAdminAction = "suspend" | "activate" | "hide" | "unhide" | "delete";

interface AdminConfirmModalProps {
  action: AdminAction;
  productTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ADMIN_ACTION_META: Record<AdminAction, { label: string; description: string; danger: boolean; icon: React.ReactNode }> = {
  hide:         { label: "Hide product",    description: "This product will be removed from the marketplace immediately. The creator's draft is preserved.", danger: true,  icon: <EyeOff style={{ width: "18px", height: "18px" }} /> },
  archive:      { label: "Archive product", description: "This product will be archived and removed from the marketplace. The creator can still see it in their library.", danger: true,  icon: <Archive style={{ width: "18px", height: "18px" }} /> },
  remove:       { label: "Delete product",  description: "This product will be soft-deleted and removed from all views. Only admins can restore it.", danger: true,  icon: <Trash2 style={{ width: "18px", height: "18px" }} /> },
  feature:      { label: "Feature product", description: "This product will be pinned to the homepage as a featured item.", danger: false, icon: <Pin style={{ width: "18px", height: "18px" }} /> },
  unfeature:    { label: "Unfeature product", description: "This product will be removed from the featured homepage section.", danger: false, icon: <PinOff style={{ width: "18px", height: "18px" }} /> },
  "staff-pick": { label: "Mark as Staff Pick", description: "This product will receive the Staff Pick badge across the marketplace.", danger: false, icon: <StarIcon style={{ width: "18px", height: "18px" }} /> },
  "unstaff-pick": { label: "Remove Staff Pick", description: "The Staff Pick badge will be removed from this product.", danger: false, icon: <StarIcon style={{ width: "18px", height: "18px" }} /> },
  pin:          { label: "Pin to homepage", description: "This product will appear pinned at the top of the marketplace homepage.", danger: false, icon: <Pin style={{ width: "18px", height: "18px" }} /> },
  unpin:        { label: "Unpin from homepage", description: "This product will no longer be pinned to the homepage.", danger: false, icon: <PinOff style={{ width: "18px", height: "18px" }} /> },
  restore:      { label: "Restore product",   description: "This product will be restored and made visible in the marketplace.", danger: false, icon: <RotateCcw style={{ width: "18px", height: "18px" }} /> },
  unpublish:    { label: "Unpublish product",  description: "This product will be unpublished from the native store but remain in the creator's library.", danger: false, icon: <EyeOff style={{ width: "18px", height: "18px" }} /> },
  duplicate:    { label: "Duplicate product",  description: "A copy of this product will be created in the creator's library.", danger: false, icon: <Eye style={{ width: "18px", height: "18px" }} /> },
};

function AdminConfirmModal({ action, productTitle, onConfirm, onCancel }: AdminConfirmModalProps) {
  const meta = ADMIN_ACTION_META[action];
  return createPortal(
    <div
      onClick={onCancel}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(3px)", padding: "20px" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: "18px", padding: "28px 28px 24px", maxWidth: "440px", width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", animation: "slideInUp 0.2s cubic-bezier(.4,0,.2,1)" }}
      >
        {/* Icon */}
        <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: meta.danger ? "#fef2f2" : "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", color: meta.danger ? "#dc2626" : "#16a34a", marginBottom: "16px" }}>
          {meta.icon}
        </div>
        <h3 style={{ margin: "0 0 6px", fontSize: "17px", fontWeight: 700, color: "#111827" }}>{meta.label}</h3>
        <p style={{ margin: "0 0 6px", fontSize: "13px", color: "#6b7280" }}>{meta.description}</p>
        <p style={{ margin: "0 0 24px", fontSize: "13px", color: "#374151", fontWeight: 600, background: "#f9fafb", padding: "8px 12px", borderRadius: "8px", border: "1px solid #f3f4f6" }}>
          &ldquo;{productTitle}&rdquo;
        </p>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={onCancel}
            style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "1px solid #e5e7eb", background: "#fff", color: "#374151", fontSize: "14px", fontWeight: 600, cursor: "pointer", transition: "background 0.15s" }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "none", background: meta.danger ? "#dc2626" : "#16a34a", color: "#fff", fontSize: "14px", fontWeight: 700, cursor: "pointer", transition: "opacity 0.15s" }}
          >
            {meta.label}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Admin: actions menu ──────────────────────────────────────────────────────

interface AdminActionsMenuProps {
  item: MarketplaceItem;
  onAction: (productId: string, action: AdminAction) => void;
}

function AdminActionsMenu({ item, onAction }: AdminActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const openMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      // Try to open below first, flip above if near viewport bottom
      const spaceBelow = window.innerHeight - rect.bottom;
      const menuH = 280;
      const top = spaceBelow > menuH ? rect.bottom + 4 : rect.top - menuH - 4;
      const left = Math.min(rect.left, window.innerWidth - 192);
      setPos({ top, left });
    }
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (btnRef.current && btnRef.current.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const trigger = (action: AdminAction) => {
    setOpen(false);
    onAction(item.id, action);
  };

  const actions: Array<{ action: AdminAction; label: string; icon: React.ReactNode; color: string; sep?: boolean; href?: string }> = [
    { action: "unpublish",    label: "Unpublish",        icon: <EyeOff style={{ width: "13px", height: "13px" }} />, color: "#6b7280" },
    { action: "feature",      label: item.featured ? "Unfeature" : "Feature",        icon: <Pin style={{ width: "13px", height: "13px" }} />, color: "#7c3aed" },
    { action: "staff-pick",   label: "Toggle Staff Pick",icon: <StarIcon style={{ width: "13px", height: "13px" }} />, color: "#f59e0b" },
    { action: "duplicate",    label: "Duplicate Product",icon: <RotateCcw style={{ width: "13px", height: "13px" }} />, color: "#374151" },
    { action: "hide",         label: "Hide from Marketplace", icon: <EyeOff style={{ width: "13px", height: "13px" }} />, color: "#ef4444", sep: true },
    { action: "archive",      label: "Archive",          icon: <Archive style={{ width: "13px", height: "13px" }} />, color: "#f97316" },
    { action: "remove",       label: "Delete Product",   icon: <Trash2 style={{ width: "13px", height: "13px" }} />, color: "#dc2626" },
  ];

  return (
    <>
      <button
        ref={btnRef}
        onClick={openMenu}
        title="Admin actions"
        style={{
          position: "absolute", bottom: "8px", right: "8px",
          background: "rgba(15,15,25,0.85)", backdropFilter: "blur(6px)",
          border: "1px solid rgba(255,255,255,0.15)", borderRadius: "8px",
          color: "#fff", width: "28px", height: "28px", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 20, transition: "background 0.15s",
          padding: 0,
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(249,115,22,0.9)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(15,15,25,0.85)"; }}
      >
        <MoreVertical style={{ width: "14px", height: "14px" }} />
      </button>

      {open && createPortal(
        <div
          style={{
            position: "fixed", top: pos.top, left: pos.left, zIndex: 99998,
            background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.18)", width: "192px", overflow: "hidden",
            animation: "fadeInScale 0.12s cubic-bezier(.4,0,.2,1)",
          }}
        >
          {/* Header */}
          <div style={{ padding: "8px 12px 6px", borderBottom: "1px solid #f3f4f6" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "1px" }}>
              <Shield style={{ width: "11px", height: "11px", color: "#f97316" }} />
              <span style={{ fontSize: "10px", fontWeight: 800, color: "#f97316", textTransform: "uppercase", letterSpacing: "0.06em" }}>Admin Actions</span>
            </div>
            <p style={{ margin: 0, fontSize: "10px", color: "#9ca3af", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.title}</p>
          </div>

          {/* Quick nav links */}
          <div style={{ padding: "4px 0", borderBottom: "1px solid #f3f4f6" }}>
            {[
              { href: `/product/${item.id}`, icon: <Eye style={{ width: "13px", height: "13px", color: "#9ca3af" }} />, label: "View Product" },
              { href: `/dashboard/digital-products/${item.id}/edit`, icon: <Edit3 style={{ width: "13px", height: "13px", color: "#9ca3af" }} />, label: "Edit Product" },
              { href: `/dashboard/admin/marketplace`, icon: <Shield style={{ width: "13px", height: "13px", color: "#9ca3af" }} />, label: "Admin Dashboard" },
            ].map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{ display: "flex", alignItems: "center", gap: "8px", padding: "7px 12px", fontSize: "13px", color: "#374151", textDecoration: "none", fontWeight: 500 }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "#f9fafb"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}
              >
                {link.icon} {link.label}
                <ExternalLink style={{ width: "11px", height: "11px", color: "#d1d5db", marginLeft: "auto" }} />
              </a>
            ))}
          </div>

          {/* Action buttons */}
          <div style={{ padding: "4px 0" }}>
            {actions.map((a) => (
              <div key={a.action}>
                {a.sep && <div style={{ height: "1px", background: "#f3f4f6", margin: "3px 0" }} />}
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); trigger(a.action); }}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: "8px", padding: "7px 12px", fontSize: "13px", color: a.color, fontWeight: 600, background: "transparent", border: "none", cursor: "pointer", textAlign: "left", transition: "background 0.1s" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#f9fafb"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                >
                  {a.icon} {a.label}
                </button>
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}

      {/* Busy / done feedback overlay (portal) */}
      {(busy || done) && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 99997, pointerEvents: "none", display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: "32px" }}>
          <div style={{ background: done ? "#16a34a" : "#1f1f2e", color: "#fff", borderRadius: "12px", padding: "10px 20px", fontSize: "13px", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px", boxShadow: "0 8px 24px rgba(0,0,0,0.25)", opacity: 1, animation: "fadeInScale 0.15s ease" }}>
            {done ? <Check style={{ width: "14px", height: "14px" }} /> : <Loader2 style={{ width: "14px", height: "14px", animation: "spin 0.8s linear infinite" }} />}
            {done ? "Done" : "Updating…"}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

// ─── Creator admin confirm modal ──────────────────────────────────────────────

interface CreatorAdminConfirmProps {
  action: CreatorAdminAction;
  creatorEmail: string;
  deleteProducts: boolean;
  setDeleteProducts: (v: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

const CREATOR_ACTION_META: Record<CreatorAdminAction, { label: string; description: string; danger: boolean }> = {
  suspend:  { label: "Suspend creator",               description: "Their account will be suspended and products removed from the marketplace.",        danger: true  },
  activate: { label: "Activate creator",              description: "Their account will be restored to active status.",                                  danger: false },
  hide:     { label: "Hide from marketplace",         description: "All their products will be hidden from the marketplace. The account stays intact.", danger: true  },
  unhide:   { label: "Show in marketplace",           description: "Their products will become visible in the marketplace again.",                       danger: false },
  delete:   { label: "Delete creator",                description: "The account will be soft-deleted and removed from the marketplace.",                danger: true  },
};

function CreatorAdminConfirmModal({ action, creatorEmail, deleteProducts, setDeleteProducts, onConfirm, onCancel }: CreatorAdminConfirmProps) {
  const meta = CREATOR_ACTION_META[action];
  return createPortal(
    <div onClick={onCancel} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(3px)", padding: "20px" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: "18px", padding: "28px 28px 24px", maxWidth: "440px", width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: meta.danger ? "#fef2f2" : "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", color: meta.danger ? "#dc2626" : "#16a34a", marginBottom: "16px" }}>
          <Shield style={{ width: "22px", height: "22px" }} />
        </div>
        <h3 style={{ margin: "0 0 6px", fontSize: "17px", fontWeight: 700, color: "#111827" }}>{meta.label}</h3>
        <p style={{ margin: "0 0 10px", fontSize: "13px", color: "#6b7280" }}>{meta.description}</p>
        <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#374151", fontWeight: 600, background: "#f9fafb", padding: "8px 12px", borderRadius: "8px", border: "1px solid #f3f4f6" }}>
          {creatorEmail}
        </p>
        {action === "delete" && (
          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#374151", marginBottom: "20px", cursor: "pointer" }}>
            <input type="checkbox" checked={deleteProducts} onChange={(e) => setDeleteProducts(e.target.checked)} style={{ width: "16px", height: "16px", cursor: "pointer" }} />
            Also delete all their products
          </label>
        )}
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={onCancel} style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "1px solid #e5e7eb", background: "#fff", color: "#374151", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={onConfirm} style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "none", background: meta.danger ? "#dc2626" : "#16a34a", color: "#fff", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>
            {meta.label}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Creator admin actions menu ───────────────────────────────────────────────

interface CreatorAdminMenuProps {
  creator: RecommendedCreator;
  onAction: (creatorId: string, creatorEmail: string, action: CreatorAdminAction) => void;
}

function CreatorAdminMenu({ creator, onAction }: CreatorAdminMenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos]   = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  const openMenu = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      const spaceBelow = window.innerHeight - rect.bottom;
      const top = spaceBelow > 220 ? rect.bottom + 4 : rect.top - 220 - 4;
      setPos({ top, left: Math.min(rect.left, window.innerWidth - 200) });
    }
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (btnRef.current && btnRef.current.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const trigger = (action: CreatorAdminAction) => {
    setOpen(false);
    onAction(creator.userId, creator.displayName, action);
  };

  const menuItems: Array<{ action: CreatorAdminAction; label: string; color: string; sep?: boolean }> = [
    { action: "suspend",  label: "Suspend Creator",          color: "#ef4444", sep: true },
    { action: "activate", label: "Activate Creator",         color: "#16a34a" },
    { action: "hide",     label: "Hide from Marketplace",    color: "#f97316" },
    { action: "unhide",   label: "Show in Marketplace",      color: "#6b7280" },
    { action: "delete",   label: "Delete Creator",           color: "#dc2626", sep: true },
  ];

  return (
    <>
      <button
        ref={btnRef}
        onClick={openMenu}
        title="Admin: creator actions"
        style={{
          position: "absolute", top: "8px", left: "8px", zIndex: 20,
          background: "rgba(15,15,25,0.85)", backdropFilter: "blur(6px)",
          border: "1px solid rgba(255,255,255,0.15)", borderRadius: "7px",
          color: "#fff", width: "26px", height: "26px", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 0, transition: "background 0.15s",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(249,115,22,0.9)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(15,15,25,0.85)"; }}
      >
        <Shield style={{ width: "12px", height: "12px" }} />
      </button>

      {open && createPortal(
        <div style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 99998, background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", boxShadow: "0 8px 32px rgba(0,0,0,0.18)", width: "200px", overflow: "hidden", animation: "fadeInScale 0.12s cubic-bezier(.4,0,.2,1)" }}>
          {/* Header */}
          <div style={{ padding: "8px 12px 6px", borderBottom: "1px solid #f3f4f6" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "1px" }}>
              <Shield style={{ width: "11px", height: "11px", color: "#f97316" }} />
              <span style={{ fontSize: "10px", fontWeight: 800, color: "#f97316", textTransform: "uppercase", letterSpacing: "0.06em" }}>Creator Actions</span>
            </div>
            <p style={{ margin: 0, fontSize: "10px", color: "#9ca3af", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{creator.displayName}</p>
          </div>

          {/* Nav links */}
          <div style={{ padding: "4px 0", borderBottom: "1px solid #f3f4f6" }}>
            {[
              { href: `/marketplace/creator/${creator.userId}`, label: "View Profile" },
              { href: `/c/${creator.userId}`, label: "Open Store" },
              { href: `/dashboard/admin/marketplace`, label: "Admin Panel" },
            ].map((link) => (
              <a key={link.href} href={link.href} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                style={{ display: "flex", alignItems: "center", gap: "8px", padding: "7px 12px", fontSize: "13px", color: "#374151", textDecoration: "none", fontWeight: 500 }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "#f9fafb"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}
              >
                {link.label}
                <ExternalLink style={{ width: "11px", height: "11px", color: "#d1d5db", marginLeft: "auto" }} />
              </a>
            ))}
          </div>

          {/* Action buttons */}
          <div style={{ padding: "4px 0" }}>
            {menuItems.map((item) => (
              <div key={item.action}>
                {item.sep && <div style={{ height: "1px", background: "#f3f4f6", margin: "3px 0" }} />}
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); trigger(item.action); }}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: "8px", padding: "7px 12px", fontSize: "13px", color: item.color, fontWeight: 600, background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#f9fafb"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                >
                  {item.label}
                </button>
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div style={{ borderRadius: "16px", background: "#fff", border: "1px solid #f3f4f6", overflow: "hidden" }}>
      <div style={{ aspectRatio: "4/3", background: "linear-gradient(90deg,#f3f4f6 25%,#e9eaec 50%,#f3f4f6 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
      <div style={{ padding: "16px" }}>
        <div style={{ height: "10px", width: "50%", borderRadius: "6px", background: "linear-gradient(90deg,#f3f4f6 25%,#e9eaec 50%,#f3f4f6 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite", marginBottom: "10px" }} />
        <div style={{ height: "15px", width: "85%", borderRadius: "6px", background: "linear-gradient(90deg,#f3f4f6 25%,#e9eaec 50%,#f3f4f6 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite", marginBottom: "6px" }} />
        <div style={{ height: "15px", width: "60%", borderRadius: "6px", background: "linear-gradient(90deg,#f3f4f6 25%,#e9eaec 50%,#f3f4f6 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite", marginBottom: "16px" }} />
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div style={{ height: "18px", width: "30%", borderRadius: "6px", background: "linear-gradient(90deg,#f3f4f6 25%,#e9eaec 50%,#f3f4f6 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
          <div style={{ height: "18px", width: "25%", borderRadius: "6px", background: "linear-gradient(90deg,#f3f4f6 25%,#e9eaec 50%,#f3f4f6 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
        </div>
      </div>
    </div>
  );
}

// ─── Product Card ─────────────────────────────────────────────────────────────

function ProductCard({
  item,
  inWishlist,
  onWishlist,
  onQuickView,
  onNicheClick,
  isAdmin,
  onAdminAction,
  isSelected,
  onSelect,
}: {
  item: MarketplaceItem;
  inWishlist: boolean;
  onWishlist: (id: string, e: React.MouseEvent) => void;
  onQuickView: (item: MarketplaceItem) => void;
  onNicheClick: (niche: string) => void;
  isAdmin?: boolean;
  onAdminAction?: (productId: string, action: AdminAction) => void;
  isSelected?: boolean;
  onSelect?: (productId: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const isFree = item.nativePrice === 0;
  const price = priceDisplay(item);

  // Badge logic
  const badge = (() => {
    if (item.featured)                                   return { label: "⭐ Featured",    bg: "#7c3aed" };
    if (item.salesCount !== null && item.salesCount > 9) return { label: "🏆 Best Seller", bg: "#f59e0b" };
    if (item.trendingCount > 0)                          return { label: "🔥 Trending",    bg: "#ef4444" };
    if (item.salesCount !== null && item.salesCount > 0) return { label: "✅ Verified",    bg: "#10b981" };
    return null;
  })();

  const initials = creatorInitials(item.creatorName);
  const bgColor  = avatarColor(item.creatorUserId);

  return (
    <Link href={`/product/${item.id}`} style={{ textDecoration: "none", display: "flex", height: "100%" }} className="mp-card-link">
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          borderRadius: "16px",
          background: "#fff",
          border: "1px solid #e5e7eb",
          overflow: "hidden",
          cursor: "pointer",
          transition: "box-shadow 0.22s cubic-bezier(.4,0,.2,1), transform 0.22s cubic-bezier(.4,0,.2,1), border-color 0.22s",
          boxShadow: hovered ? "0 12px 36px rgba(0,0,0,0.13)" : "0 1px 4px rgba(0,0,0,0.05)",
          transform: hovered ? "translateY(-4px)" : "none",
          borderColor: hovered ? "#f97316" : "#e5e7eb",
          display: "flex",
          flexDirection: "column",
          width: "100%",
        }}
      >
        {/* Thumbnail */}
        <div style={{ aspectRatio: "4/3", background: "linear-gradient(135deg,#0f0f12 0%,#1a1a2e 100%)", position: "relative", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {item.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.thumbnailUrl}
              alt={item.title}
              style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
            />
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", background: "linear-gradient(135deg,#1f1f2e 0%,#2d1f3d 100%)" }}>
              <ShoppingBag style={{ width: "40px", height: "40px", color: "rgba(249,115,22,0.6)" }} />
            </div>
          )}

          {/* Top-left: format */}
          <span style={{ position: "absolute", top: "10px", left: "10px", background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", color: "#fff", fontSize: "9px", fontWeight: 800, padding: "3px 8px", borderRadius: "999px", textTransform: "uppercase", letterSpacing: "0.07em" }}>
            {item.format}
          </span>

          {/* Top-right: wishlist */}
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onWishlist(item.id, e); }}
            style={{ position: "absolute", top: "8px", right: "8px", background: inWishlist ? "rgba(244,63,94,0.9)" : "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", border: "none", borderRadius: "50%", width: "32px", height: "32px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", transition: "all 0.15s", zIndex: 2, transform: hovered ? "scale(1.1)" : "scale(1)" }}
            title={inWishlist ? "Remove from wishlist" : "Save to wishlist"}
          >
            {inWishlist ? "❤️" : "🤍"}
          </button>
          {/* Wishlist count badge — only show if no social badge to avoid overlap */}
          {item.wishlistCount > 0 && !badge && (
            <span style={{ position: "absolute", top: "8px", right: "48px", background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", color: "#fda4af", fontSize: "9px", fontWeight: 800, padding: "3px 7px", borderRadius: "999px", letterSpacing: "0.02em" }}>
              ❤️ {item.wishlistCount}
            </span>
          )}

          {/* Social badge — pinned top-right below wishlist button */}
          {badge && (
            <span style={{ position: "absolute", top: "48px", right: "8px", background: badge.bg, color: "#fff", fontSize: "9px", fontWeight: 800, padding: "3px 8px", borderRadius: "999px", letterSpacing: "0.02em", whiteSpace: "nowrap" }}>
              {badge.label}
            </span>
          )}

          {/* Free ribbon */}
          {isFree && (
            <span style={{ position: "absolute", bottom: "10px", left: "10px", background: "#10b981", color: "#fff", fontSize: "10px", fontWeight: 800, padding: "4px 10px", borderRadius: "999px", letterSpacing: "0.03em" }}>
              FREE
            </span>
          )}

          {/* Quick view — shows on hover */}
          <button
            className="mp-quick-view"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onQuickView(item); }}
            style={{ position: "absolute", bottom: "10px", left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.78)", backdropFilter: "blur(4px)", color: "#fff", fontSize: "11px", fontWeight: 800, padding: "7px 18px", borderRadius: "999px", border: "none", cursor: "pointer", whiteSpace: "nowrap", opacity: 0, transition: "opacity 0.18s", letterSpacing: "0.02em" }}
          >
            Quick View
          </button>

          {/* Admin ⋮ button — portal-rendered dropdown, not clipped by overflow:hidden */}
          {isAdmin && onAdminAction && (
            <AdminActionsMenu item={item} onAction={onAdminAction} />
          )}

          {/* Admin bulk-select checkbox */}
          {isAdmin && onSelect && (
            <div
              role="checkbox"
              aria-checked={!!isSelected}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSelect(item.id); }}
              style={{
                position: "absolute", top: "8px", left: "8px", width: "22px", height: "22px",
                background: isSelected ? "#f97316" : "rgba(0,0,0,0.45)",
                border: `2px solid ${isSelected ? "#f97316" : "rgba(255,255,255,0.75)"}`,
                borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", zIndex: 15, transition: "all 0.15s",
              }}
            >
              {isSelected && <Check style={{ width: "12px", height: "12px", color: "#fff", pointerEvents: "none" }} />}
            </div>
          )}
        </div>

        {/* Card body */}
        <div style={{ padding: "14px 16px 16px", display: "flex", flexDirection: "column", flex: 1 }}>
          {/* Niche chip */}
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onNicheClick(item.niche.toLowerCase()); }}
            style={{ display: "inline-block", fontSize: "10px", color: "#f97316", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "5px", background: "rgba(249,115,22,0.08)", padding: "2px 8px", borderRadius: "999px", border: "1px solid rgba(249,115,22,0.2)", cursor: "pointer", lineHeight: 1.6 }}
          >
            {item.niche}
          </button>

          {/* Title */}
          <h3 style={{ margin: "0 0 6px", fontSize: "14px", fontWeight: 700, color: "#111827", lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: "38px" }}>
            {item.title}
          </h3>

          {/* Star rating — always reserve height so cards align */}
          <div style={{ minHeight: "24px", marginBottom: "8px" }}>
            {item.avgRating !== null && item.reviewCount > 0 && (
              <StarRow rating={item.avgRating} count={item.reviewCount} />
            )}
          </div>

          {/* Price + creator row — pinned to bottom */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
            <span style={{ fontSize: "17px", fontWeight: 800, color: isFree ? "#10b981" : "#111827", letterSpacing: "-0.02em" }}>
              {price}
              {item.salesCount !== null && item.salesCount > 0 && (
                <span style={{ fontSize: "10px", fontWeight: 600, color: "#9ca3af", marginLeft: "6px", letterSpacing: 0 }}>
                  {item.salesCount} sold
                </span>
              )}
            </span>

            {/* Creator avatar + name + level */}
            <Link
              href={`/marketplace/creator/${item.creatorUserId}`}
              onClick={(e) => e.stopPropagation()}
              style={{ display: "flex", alignItems: "center", gap: "6px", textDecoration: "none" }}
              className="mp-creator-link"
            >
              <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: bgColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", fontWeight: 800, color: "#fff", flexShrink: 0 }}>
                {initials}
              </div>
              <span style={{ fontSize: "11px", color: "#6b7280", fontWeight: 600, maxWidth: "70px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.creatorName}
              </span>
              {(() => {
                const lvl = getCreatorLevelBadge(item.salesCount);
                return (
                  <span style={{ fontSize: "10px", lineHeight: 1, whiteSpace: "nowrap", opacity: 0.8 }} title={lvl.label}>
                    {lvl.emoji}
                  </span>
                );
              })()}
            </Link>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Client-side guard: drop any stored item that fails the basic validity check. */
function isValidStoredItem(item: MarketplaceItem): boolean {
  return !!(item?.id && item?.title && item?.creatorUserId && item?.thumbnailUrl);
}

// ─── Horizontal scroll strip ──────────────────────────────────────────────────

function ProductStrip({
  title,
  icon,
  items,
  onWishlist,
  wishlist,
  onQuickView,
  onNicheClick,
  onRemoveItem,
  onClearAll,
  isAdmin,
  onAdminAction,
}: {
  title: string;
  icon: React.ReactNode;
  items: MarketplaceItem[];
  onWishlist: (id: string, e: React.MouseEvent) => void;
  wishlist: Set<string>;
  onQuickView: (item: MarketplaceItem) => void;
  onNicheClick: (niche: string) => void;
  onRemoveItem?: (id: string) => void;
  onClearAll?: () => void;
  isAdmin?: boolean;
  onAdminAction?: (productId: string, action: AdminAction) => void;
}) {
  if (!items.length) return null;
  return (
    <div style={{ background: "#fff", borderBottom: "1px solid #f0f0f0", padding: "20px 0" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
          {icon}
          <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#111827" }}>{title}</h2>
          {onClearAll && (
            <button
              onClick={onClearAll}
              style={{ marginLeft: "auto", fontSize: "11px", fontWeight: 700, color: "#9ca3af", background: "none", border: "1px solid #e5e7eb", borderRadius: "6px", padding: "3px 10px", cursor: "pointer", transition: "all 0.15s" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#fecaca"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#9ca3af"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#e5e7eb"; }}
            >
              Clear all
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: "14px", overflowX: "auto", paddingBottom: "8px", scrollbarWidth: "none" }}>
          {items.map((item) => (
            <div key={item.id} style={{ flexShrink: 0, width: "220px", position: "relative" }}>
              <ProductCard item={item} inWishlist={wishlist.has(item.id)} onWishlist={onWishlist} onQuickView={onQuickView} onNicheClick={onNicheClick} isAdmin={isAdmin} onAdminAction={onAdminAction} />
              {onRemoveItem && (
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemoveItem(item.id); }}
                  title="Remove from history"
                  style={{ position: "absolute", top: "8px", left: "8px", background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", border: "none", borderRadius: "50%", width: "26px", height: "26px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "15px", lineHeight: 1, zIndex: 10, transition: "background 0.15s" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.85)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,0,0,0.55)"; }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

// ─── Creator card (discovery strip) ──────────────────────────────────────────

function CreatorCard({
  creator,
  isFollowing,
  onFollow,
  isAdmin,
  onCreatorAdminAction,
}: {
  creator: RecommendedCreator;
  isFollowing: boolean;
  onFollow: (creatorId: string) => void;
  isAdmin?: boolean;
  onCreatorAdminAction?: (creatorId: string, creatorEmail: string, action: CreatorAdminAction) => void;
}) {
  const bg = creator.accentColor ?? "#f97316";
  return (
    <div style={{ flexShrink: 0, width: "200px", borderRadius: "16px", background: "#fff", border: "1px solid #f0f0f0", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", transition: "box-shadow 0.15s", position: "relative" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.10)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 4px rgba(0,0,0,0.06)"; }}
    >
      {/* Banner stripe */}
      <div style={{ height: "52px", background: bg, opacity: 0.85, position: "relative" }}>
        {isAdmin && onCreatorAdminAction && (
          <CreatorAdminMenu creator={creator} onAction={onCreatorAdminAction} />
        )}
      </div>
      <div style={{ padding: "0 14px 14px", marginTop: "-20px" }}>
        {/* Avatar */}
        {creator.profileImageUrl ? (
          <img src={creator.profileImageUrl} alt={creator.displayName}
            style={{ width: "44px", height: "44px", borderRadius: "50%", border: "3px solid #fff", objectFit: "cover", marginBottom: "8px" }} />
        ) : (
          <div style={{ width: "44px", height: "44px", borderRadius: "50%", background: bg, border: "3px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: 800, color: "#fff", marginBottom: "8px" }}>
            {creatorInitials(creator.displayName)}
          </div>
        )}
        <p style={{ margin: "0 0 2px", fontSize: "13px", fontWeight: 800, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{creator.displayName}</p>
        <p style={{ margin: "0 0 8px", fontSize: "11px", color: "#6b7280" }}>
          {creator.productCount} product{creator.productCount !== 1 ? "s" : ""}
          {creator.followerCount > 0 && ` · ${creator.followerCount} follower${creator.followerCount !== 1 ? "s" : ""}`}
        </p>
        {creator.bio && (
          <p style={{ margin: "0 0 10px", fontSize: "11px", color: "#6b7280", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {creator.bio}
          </p>
        )}
        <div style={{ display: "flex", gap: "6px" }}>
          <button
            onClick={() => onFollow(creator.userId)}
            style={{ flex: 1, padding: "5px 0", borderRadius: "8px", fontSize: "11px", fontWeight: 700, cursor: "pointer", border: isFollowing ? "1px solid #e5e7eb" : `1px solid ${bg}`, background: isFollowing ? "#f9fafb" : bg, color: isFollowing ? "#374151" : "#fff", transition: "all 0.15s" }}
          >
            {isFollowing ? "✓ Following" : "+ Follow"}
          </button>
          <a href={`/c/${creator.userId}`}
            style={{ padding: "5px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: 700, border: "1px solid #e5e7eb", background: "#fff", color: "#374151", textDecoration: "none", whiteSpace: "nowrap" }}
          >
            Store →
          </a>
        </div>
      </div>
    </div>
  );
}

export default function MarketplaceClient({ isAdmin = false }: { isAdmin?: boolean }) {
  const { isSignedIn } = useAuth();
  const [data, setData]           = useState<ApiResponse | null>(null);
  const [loading, setLoading]     = useState(true);
  const [q, setQ]                 = useState("");
  const [niche, setNiche]         = useState("");
  const [format, setFormat]       = useState("");
  const [sort, setSort]           = useState<Sort>("trending");
  const [page, setPage]           = useState(1);
  const [inputValue, setInputValue] = useState("");
  const [quickView, setQuickView]   = useState<MarketplaceItem | null>(null);
  const [newItems, setNewItems]         = useState<MarketplaceItem[]>([]);
  const [followingFeed, setFollowingFeed] = useState<MarketplaceItem[]>([]);
  const [recommendedCreators, setRecommendedCreators] = useState<RecommendedCreator[]>([]);
  const [followedCreators, setFollowedCreators] = useState<Set<string>>(new Set());
  const [minPrice, setMinPrice]     = useState("");
  const [maxPrice, setMaxPrice]     = useState("");
  const [minRating, setMinRating]   = useState("");
  const [wishlist, setWishlist]     = useState<Set<string>>(new Set());
  const [recentlyViewed, setRecentlyViewed] = useState<MarketplaceItem[]>([]);
  const [recommended, setRecommended]       = useState<MarketplaceItem[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);

  // ── Admin state ────────────────────────────────────────────────────────────
  const [adminConfirm, setAdminConfirm] = useState<{ productId: string; productTitle: string; action: AdminAction } | null>(null);
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminToast, setAdminToast] = useState<{ message: string; ok: boolean } | null>(null);

  // ── Creator admin state ─────────────────────────────────────────────────────
  const [creatorConfirm, setCreatorConfirm] = useState<{ creatorId: string; creatorEmail: string; action: CreatorAdminAction } | null>(null);
  const [creatorDeleteProducts, setCreatorDeleteProducts] = useState(false);

  // ── Bulk selection state ───────────────────────────────────────────────────
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  // Load wishlist from DB (falls back to localStorage for unauthenticated users)
  useEffect(() => {
    fetch("/api/marketplace/wishlist")
      .then((r) => r.json())
      .then((d) => {
        if (d?.ids?.length >= 0) {
          // Authenticated — use DB
          setWishlist(new Set(d.ids as string[]));
          // Sync localStorage to match DB
          try { localStorage.setItem("cf_wishlist", JSON.stringify(d.ids)); } catch { /* ignore */ }
        } else {
          // Unauthenticated — fall back to localStorage
          try {
            const w = JSON.parse(localStorage.getItem("cf_wishlist") ?? "[]") as string[];
            setWishlist(new Set(w));
          } catch { /* ignore */ }
        }
      })
      .catch(() => {
        // Network failure — fall back to localStorage
        try {
          const w = JSON.parse(localStorage.getItem("cf_wishlist") ?? "[]") as string[];
          setWishlist(new Set(w));
        } catch { /* ignore */ }
      });

    // Load recently viewed from localStorage
    try {
      const raw = JSON.parse(localStorage.getItem("cf_recently_viewed") ?? "[]") as MarketplaceItem[];
      // Prune any stored items that fail basic validity (deleted/missing-image entries)
      const valid = raw.filter(isValidStoredItem).slice(0, 8);
      setRecentlyViewed(valid);
      if (valid.length !== raw.length) {
        try { localStorage.setItem("cf_recently_viewed", JSON.stringify(valid)); } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  }, []);

  const removeRecentlyViewed = useCallback((id: string) => {
    setRecentlyViewed((prev) => {
      const next = prev.filter((i) => i.id !== id);
      try { localStorage.setItem("cf_recently_viewed", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const clearRecentlyViewed = useCallback(() => {
    setRecentlyViewed([]);
    try { localStorage.removeItem("cf_recently_viewed"); } catch { /* ignore */ }
  }, []);

  // ── Admin: request action (show confirm modal for destructive ones) ─────────
  const NEEDS_CONFIRM: AdminAction[] = ["hide", "archive", "remove"];

  const handleAdminAction = useCallback((productId: string, action: AdminAction) => {
    const item = data?.items.find((i) => i.id === productId);
    const productTitle = item?.title ?? "this product";
    if (NEEDS_CONFIRM.includes(action)) {
      setAdminConfirm({ productId, productTitle, action });
    } else {
      execAdminAction(productId, action);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const execAdminAction = useCallback(async (productId: string, action: AdminAction) => {
    setAdminConfirm(null);
    setAdminBusy(true);
    try {
      const res = await fetch(`/api/admin/marketplace/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Unknown error");
      // Optimistically remove the product from the local list if it becomes non-public
      if (action === "hide" || action === "archive" || action === "remove" || action === "unpublish") {
        setData((prev) => prev ? { ...prev, items: prev.items.filter((i) => i.id !== productId), total: prev.total - 1 } : prev);
        setRecentlyViewed((prev) => prev.filter((i) => i.id !== productId));
        setNewItems((prev) => prev.filter((i) => i.id !== productId));
        setFollowingFeed((prev) => prev.filter((i) => i.id !== productId));
        setRecommended((prev) => prev.filter((i) => i.id !== productId));
      }
      setAdminToast({ message: `Done: ${action}`, ok: true });
    } catch {
      setAdminToast({ message: "Action failed — check console", ok: false });
    } finally {
      setAdminBusy(false);
      setTimeout(() => setAdminToast(null), 3000);
    }
  }, []);

  // ── Creator admin handler ──────────────────────────────────────────────────
  const handleCreatorAdminAction = useCallback((creatorId: string, creatorEmail: string, action: CreatorAdminAction) => {
    setCreatorDeleteProducts(false);
    setCreatorConfirm({ creatorId, creatorEmail, action });
  }, []);

  const execCreatorAdminAction = useCallback(async () => {
    if (!creatorConfirm) return;
    const { creatorId, action } = creatorConfirm;
    setCreatorConfirm(null);
    setAdminBusy(true);
    try {
      const res = await fetch(`/api/admin/creators/${creatorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, deleteProducts: creatorDeleteProducts }),
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Unknown error");
      // Remove creator's products from marketplace view if hiding/deleting
      if (action === "hide" || action === "delete" || action === "suspend") {
        setRecommendedCreators((prev) => prev.filter((c) => c.userId !== creatorId));
        setFollowingFeed((prev) => prev.filter((i) => i.creatorUserId !== creatorId));
        setData((prev) => prev ? { ...prev, items: prev.items.filter((i) => i.creatorUserId !== creatorId) } : prev);
      }
      setAdminToast({ message: `Creator: ${action} done`, ok: true });
    } catch {
      setAdminToast({ message: "Creator action failed", ok: false });
    } finally {
      setAdminBusy(false);
      setTimeout(() => setAdminToast(null), 3000);
    }
  }, [creatorConfirm, creatorDeleteProducts]);

  // ── Bulk action handler ────────────────────────────────────────────────────
  const execBulkAction = useCallback(async (action: AdminAction) => {
    if (selectedProducts.size === 0) return;
    setBulkBusy(true);
    const ids = Array.from(selectedProducts);
    try {
      await Promise.all(ids.map((id) =>
        fetch(`/api/admin/marketplace/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        })
      ));
      // Optimistically remove from view if hiding/removing
      if (action === "hide" || action === "archive" || action === "remove") {
        const removed = new Set(ids);
        setData((prev) => prev ? { ...prev, items: prev.items.filter((i) => !removed.has(i.id)), total: prev.total - ids.length } : prev);
        setRecentlyViewed((prev) => prev.filter((i) => !removed.has(i.id)));
        setNewItems((prev) => prev.filter((i) => !removed.has(i.id)));
        setFollowingFeed((prev) => prev.filter((i) => !removed.has(i.id)));
      }
      if (action === "feature") {
        setData((prev) => prev ? { ...prev, items: prev.items.map((i) => ids.includes(i.id) ? { ...i, featured: true } : i) } : prev);
      }
      setSelectedProducts(new Set());
      setAdminToast({ message: `Bulk ${action}: ${ids.length} products`, ok: true });
    } catch {
      setAdminToast({ message: "Bulk action failed", ok: false });
    } finally {
      setBulkBusy(false);
      setTimeout(() => setAdminToast(null), 3000);
    }
  }, [selectedProducts]);

  const toggleProductSelection = useCallback((productId: string) => {
    setSelectedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId); else next.add(productId);
      return next;
    });
  }, []);

  const selectAllProducts = useCallback(() => {
    if (!data) return;
    setSelectedProducts(new Set(data.items.map((i) => i.id)));
  }, [data]);

  const clearSelection = useCallback(() => setSelectedProducts(new Set()), []);

  const toggleWishlist = useCallback((itemId: string, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setWishlist((prev) => {
      const next = new Set(prev);
      const adding = !next.has(itemId);
      if (adding) next.add(itemId); else next.delete(itemId);
      // Sync to localStorage (immediate)
      try { localStorage.setItem("cf_wishlist", JSON.stringify(Array.from(next))); } catch { /* ignore */ }
      // Sync to DB in background (best-effort)
      if (adding) {
        fetch("/api/marketplace/wishlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: itemId }) }).catch(() => {});
      } else {
        fetch(`/api/marketplace/wishlist?productId=${itemId}`, { method: "DELETE" }).catch(() => {});
      }
      return next;
    });
  }, []);

  // Track viewed items when quick view opens
  useEffect(() => {
    if (!quickView) return;
    setRecentlyViewed((prev) => {
      const next = [quickView, ...prev.filter((i) => i.id !== quickView.id)].slice(0, 8);
      try { localStorage.setItem("cf_recently_viewed", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, [quickView]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q)         params.set("q", q);
    if (niche)     params.set("niche", niche);
    if (format)    params.set("format", format);
    if (minPrice)  params.set("minPrice", minPrice);
    if (maxPrice)  params.set("maxPrice", maxPrice);
    if (minRating) params.set("minRating", minRating);
    params.set("sort", sort);
    params.set("page", String(page));
    const res = await fetch(`/api/marketplace?${params.toString()}`);
    if (res.ok) {
      const json = await res.json();
      setData(json);
      const liveItems = json.items as MarketplaceItem[];

      // Build "recommended for you" from niche history — only include items
      // that the API confirmed are still valid and published
      try {
        const rv = JSON.parse(localStorage.getItem("cf_recently_viewed") ?? "[]") as MarketplaceItem[];
        const topNiches = Array.from(new Set(rv.map((i) => i.niche.toLowerCase()))).slice(0, 3);
        if (topNiches.length > 0) {
          const recs = liveItems
            .filter((i) => topNiches.includes(i.niche.toLowerCase()) && !rv.some((r) => r.id === i.id))
            .slice(0, 8);
          setRecommended(recs);
        }
      } catch { /* ignore */ }

      // Cross-validate recently viewed: if an item appears in the live results
      // for this page (same sort/filter) and is still valid, keep it; otherwise
      // leave it untouched (it may just be off-page, not deleted)
      setRecentlyViewed((prev) => {
        const pruned = prev.filter((item) => {
          // If the API explicitly returned this ID, it's valid — keep it
          // If the API did NOT return it, we can't be sure it's deleted (might be filtered/paginated)
          // So only remove items that fail our client-side validity check
          return isValidStoredItem(item);
        });
        if (pruned.length !== prev.length) {
          try { localStorage.setItem("cf_recently_viewed", JSON.stringify(pruned)); } catch { /* ignore */ }
          return pruned;
        }
        return prev;
      });
    }
    setLoading(false);
  }, [q, niche, format, sort, page, minPrice, maxPrice, minRating]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // Fetch "new this week" once
  useEffect(() => {
    fetch("/api/marketplace?sort=newest&newThisWeek=1&page=1")
      .then((r) => r.json())
      .then((d) => setNewItems(d.items?.slice(0, 10) ?? []))
      .catch(() => {});
  }, []);

  // Fetch following feed + recommended creators + existing follows once
  useEffect(() => {
    fetch("/api/marketplace/following-feed")
      .then((r) => r.json())
      .then((d) => setFollowingFeed(d.items ?? []))
      .catch(() => {});

    fetch("/api/marketplace/recommended-creators?limit=10")
      .then((r) => r.json())
      .then((d) => setRecommendedCreators(d.creators ?? []))
      .catch(() => {});

    // Pre-load which creators the viewer already follows (for the Follow button state)
    fetch("/api/marketplace/follow")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.followingIds)) setFollowedCreators(new Set(d.followingIds as string[])); })
      .catch(() => {});
  }, []);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => { setQ(inputValue); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [inputValue]);

  const toggleFollowCreator = useCallback((creatorId: string) => {
    setFollowedCreators((prev) => {
      const next = new Set(prev);
      const isFollowing = next.has(creatorId);
      if (isFollowing) {
        next.delete(creatorId);
        fetch(`/api/marketplace/follow?creatorId=${creatorId}`, { method: "DELETE" }).catch(() => {});
      } else {
        next.add(creatorId);
        fetch("/api/marketplace/follow", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ creatorId }) }).catch(() => {});
      }
      return next;
    });
    // If now following, hide from recommended list
    setRecommendedCreators((prev) => {
      const isFollowing = followedCreators.has(creatorId);
      if (!isFollowing) return prev.filter((c) => c.userId !== creatorId);
      return prev;
    });
  }, [followedCreators]);

  const clearFilters = () => { setNiche(""); setFormat(""); setInputValue(""); setQ(""); setMinPrice(""); setMaxPrice(""); setMinRating(""); setPage(1); };
  const hasFilters = !!(niche || format || q || minPrice || maxPrice || minRating);
  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>

      {/* ── Compact Hero ───────────────────────────────────────────────────────── */}
      <div style={{ background: "#0B0B0F", padding: "28px 24px 22px", textAlign: "center" }}>
        {/* Logo + wishlist row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "18px", position: "relative" }}>
          <a href="/">
            <img src="/logo.png" alt="Content Flywheel" style={{ height: "44px", objectFit: "contain" }} />
          </a>
          <div style={{ position: "absolute", right: 0, display: "flex", alignItems: "center", gap: "8px" }}>
            {wishlist.size > 0 && (
              isSignedIn ? (
                <Link
                  href="/dashboard/wishlist"
                  title={`${wishlist.size} saved`}
                  style={{ background: "rgba(244,63,94,0.15)", border: "1px solid rgba(244,63,94,0.3)", borderRadius: "999px", padding: "5px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px", color: "#f9a8d4", fontSize: "12px", fontWeight: 700, textDecoration: "none" }}
                >
                  ❤️ {wishlist.size} saved
                </Link>
              ) : (
                <span
                  title="Sign in to keep your wishlist across devices"
                  style={{ background: "rgba(244,63,94,0.15)", border: "1px solid rgba(244,63,94,0.3)", borderRadius: "999px", padding: "5px 12px", display: "flex", alignItems: "center", gap: "5px", color: "#f9a8d4", fontSize: "12px", fontWeight: 700 }}
                >
                  ❤️ {wishlist.size} saved
                </span>
              )
            )}
            {!isSignedIn && (
              <a href="/sign-in" style={{ background: "rgba(249,115,22,0.15)", border: "1px solid rgba(249,115,22,0.3)", borderRadius: "999px", padding: "6px 14px", fontSize: "12px", fontWeight: 700, color: "#fb923c", textDecoration: "none", whiteSpace: "nowrap" }}>
                Sign in →
              </a>
            )}
            {isSignedIn && (
              <a href="/dashboard" style={{ background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.25)", borderRadius: "999px", padding: "6px 14px", fontSize: "12px", fontWeight: 700, color: "#fb923c", textDecoration: "none", whiteSpace: "nowrap" }}>
                Dashboard
              </a>
            )}
          </div>
        </div>

        <h1 style={{ margin: "0 0 8px", fontSize: "clamp(22px,4vw,38px)", fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", lineHeight: 1.15 }}>
          Digital Product Marketplace
        </h1>
        <p style={{ margin: "0 0 20px", fontSize: "15px", color: "#6b7280" }}>
          Templates, guides, courses & more from independent creators
        </p>

        {/* Search */}
        <div style={{ maxWidth: "540px", margin: "0 auto 16px", position: "relative" }}>
          <Search style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", color: "#6b7280", width: "17px", height: "17px", pointerEvents: "none" }} />
          <input
            ref={searchRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Search products, niches, formats…"
            style={{ width: "100%", padding: "12px 44px 12px 48px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)", fontSize: "15px", background: "#1a1a22", color: "#fff", outline: "none", boxSizing: "border-box", transition: "border-color 0.15s" }}
            onFocus={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = "#f97316"; }}
            onBlur={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = "rgba(255,255,255,0.08)"; }}
          />
          {inputValue && (
            <button onClick={() => { setInputValue(""); setQ(""); }} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#6b7280", cursor: "pointer", padding: "4px", display: "flex", alignItems: "center" }}>
              <X style={{ width: "15px", height: "15px" }} />
            </button>
          )}
        </div>

        {/* Sort tabs + leaderboard inline */}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
          {SORT_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setSort(tab.id); setPage(1); }}
              style={{
                padding: "6px 14px", borderRadius: "100px", border: "none", cursor: "pointer",
                fontSize: "12px", fontWeight: 700, transition: "all 0.15s",
                background: sort === tab.id ? "#f97316" : "rgba(255,255,255,0.08)",
                color: sort === tab.id ? "#fff" : "#9ca3af",
                boxShadow: sort === tab.id ? "0 3px 10px rgba(249,115,22,0.35)" : "none",
              }}
            >
              {tab.emoji} {tab.label}
            </button>
          ))}
          <a href="/marketplace/leaderboard" style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "12px", fontWeight: 700, color: "#fbbf24", textDecoration: "none", background: "rgba(251,191,36,0.1)", padding: "6px 12px", borderRadius: "999px", border: "1px solid rgba(251,191,36,0.2)", marginLeft: "4px" }}>
            🏆 Top Sellers
          </a>
        </div>
      </div>

      {/* ── Filters bar ─────────────────────────────────────────────────────────── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "0 24px", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", gap: "12px", alignItems: "center", overflowX: "auto", padding: "10px 0", scrollbarWidth: "none" }}>
          <span style={{ fontSize: "12px", fontWeight: 700, color: "#6b7280", whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: "0.05em" }}>Filter</span>

          <select value={niche} onChange={(e) => { setNiche(e.target.value); setPage(1); }}
            style={{ padding: "6px 10px", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px", background: niche ? "#fff7ed" : "#fff", color: niche ? "#ea580c" : "#374151", cursor: "pointer", fontWeight: niche ? 700 : 400 }}>
            <option value="">All niches</option>
            {(data?.niches ?? []).map((n) => <option key={n} value={n.toLowerCase()}>{n}</option>)}
          </select>

          <select value={format} onChange={(e) => { setFormat(e.target.value); setPage(1); }}
            style={{ padding: "6px 10px", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px", background: format ? "#fff7ed" : "#fff", color: format ? "#ea580c" : "#374151", cursor: "pointer", fontWeight: format ? 700 : 400 }}>
            <option value="">All formats</option>
            {(data?.formats ?? []).map((f) => <option key={f} value={f.toLowerCase()}>{f}</option>)}
          </select>

          <div style={{ display: "flex", alignItems: "center", gap: "4px", whiteSpace: "nowrap" }}>
            <span style={{ fontSize: "12px", color: "#9ca3af", fontWeight: 600 }}>£</span>
            <input type="number" value={minPrice} onChange={(e) => { setMinPrice(e.target.value); setPage(1); }} placeholder="Min" min={0}
              style={{ width: "56px", padding: "6px 8px", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px", background: "#fff" }} />
            <span style={{ fontSize: "12px", color: "#d1d5db" }}>–</span>
            <input type="number" value={maxPrice} onChange={(e) => { setMaxPrice(e.target.value); setPage(1); }} placeholder="Max" min={0}
              style={{ width: "56px", padding: "6px 8px", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px", background: "#fff" }} />
          </div>

          <select value={minRating} onChange={(e) => { setMinRating(e.target.value); setPage(1); }}
            style={{ padding: "6px 10px", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px", background: minRating ? "#fff7ed" : "#fff", color: minRating ? "#ea580c" : "#374151", cursor: "pointer", fontWeight: minRating ? 700 : 400 }}>
            <option value="">All ratings</option>
            <option value="4">⭐ 4.0+</option>
            <option value="3">⭐ 3.0+</option>
          </select>

          {hasFilters && (
            <button onClick={clearFilters}
              style={{ padding: "6px 12px", borderRadius: "8px", border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontSize: "12px", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "4px" }}>
              <X style={{ width: "12px", height: "12px" }} /> Clear
            </button>
          )}

          {data && (
            <span style={{ marginLeft: "auto", fontSize: "12px", color: "#9ca3af", whiteSpace: "nowrap", fontWeight: 600 }}>
              {data.total.toLocaleString()} product{data.total !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* ── AI Recommended For You ───────────────────────────────────────────── */}
      {recommended.length > 0 && !hasFilters && (
        <div style={{ background: "linear-gradient(to right, #0f0f18, #1a0f2e)", borderBottom: "1px solid rgba(139,92,246,0.2)", padding: "20px 0" }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
              <Sparkles style={{ width: "16px", height: "16px", color: "#a78bfa" }} />
              <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#e9d5ff" }}>Recommended for you</h2>
              <span style={{ fontSize: "11px", color: "#7c3aed", background: "rgba(124,58,237,0.15)", padding: "2px 8px", borderRadius: "999px", fontWeight: 700 }}>AI picks</span>
            </div>
            <div style={{ display: "flex", gap: "14px", overflowX: "auto", paddingBottom: "8px", scrollbarWidth: "none" }}>
              {recommended.map((item) => (
                <div key={item.id} style={{ flexShrink: 0, width: "220px" }}>
                  <ProductCard item={item} inWishlist={wishlist.has(item.id)} onWishlist={toggleWishlist} onQuickView={setQuickView} onNicheClick={(n) => { setNiche(n); setPage(1); }} isAdmin={isAdmin} onAdminAction={handleAdminAction} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Following strip ──────────────────────────────────────────────────── */}
      {followingFeed.length > 0 && !hasFilters && (
        <div style={{ background: "linear-gradient(to right, #0c1220, #0f1a2e)", borderBottom: "1px solid rgba(59,130,246,0.2)", padding: "20px 0" }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
              <span style={{ fontSize: "16px" }}>👥</span>
              <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#bfdbfe" }}>From creators you follow</h2>
              <span style={{ fontSize: "11px", color: "#3b82f6", background: "rgba(59,130,246,0.15)", padding: "2px 8px", borderRadius: "999px", fontWeight: 700 }}>New</span>
            </div>
            <div style={{ display: "flex", gap: "14px", overflowX: "auto", paddingBottom: "8px", scrollbarWidth: "none" }}>
              {followingFeed.map((item) => (
                <div key={item.id} style={{ flexShrink: 0, width: "220px" }}>
                  <ProductCard item={item} inWishlist={wishlist.has(item.id)} onWishlist={toggleWishlist} onQuickView={setQuickView} onNicheClick={(n) => { setNiche(n); setPage(1); }} isAdmin={isAdmin} onAdminAction={handleAdminAction} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Recommended Creators strip ───────────────────────────────────────── */}
      {recommendedCreators.length > 0 && !hasFilters && (
        <div style={{ background: "linear-gradient(to right, #0d1117, #141b27)", borderBottom: "1px solid rgba(99,102,241,0.2)", padding: "20px 0" }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
              <span style={{ fontSize: "16px" }}>✨</span>
              <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#c7d2fe" }}>Creators to discover</h2>
              <span style={{ fontSize: "11px", color: "#6366f1", background: "rgba(99,102,241,0.15)", padding: "2px 8px", borderRadius: "999px", fontWeight: 700 }}>Explore</span>
            </div>
            <div style={{ display: "flex", gap: "14px", overflowX: "auto", paddingBottom: "8px", scrollbarWidth: "none" }}>
              {recommendedCreators.map((creator) => (
                <CreatorCard
                  key={creator.userId}
                  creator={creator}
                  isFollowing={followedCreators.has(creator.userId)}
                  onFollow={toggleFollowCreator}
                  isAdmin={isAdmin}
                  onCreatorAdminAction={handleCreatorAdminAction}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── New this week strip ──────────────────────────────────────────────── */}
      {newItems.length > 0 && !hasFilters && (
        <ProductStrip
          title="New this week"
          icon={<span style={{ fontSize: "16px" }}>🆕</span>}
          items={newItems}
          wishlist={wishlist}
          onWishlist={toggleWishlist}
          onQuickView={setQuickView}
          onNicheClick={(n) => { setNiche(n); setPage(1); }}
          isAdmin={isAdmin}
          onAdminAction={handleAdminAction}
        />
      )}

      {/* ── Recently viewed strip ────────────────────────────────────────────── */}
      {recentlyViewed.length > 0 && !hasFilters && (
        <ProductStrip
          title="Recently viewed"
          icon={<span style={{ fontSize: "16px" }}>👁️</span>}
          items={recentlyViewed}
          wishlist={wishlist}
          onWishlist={toggleWishlist}
          onQuickView={setQuickView}
          onNicheClick={(n) => { setNiche(n); setPage(1); }}
          onRemoveItem={removeRecentlyViewed}
          onClearAll={clearRecentlyViewed}
          isAdmin={isAdmin}
          onAdminAction={handleAdminAction}
        />
      )}

      {/* ── Quick category chips ─────────────────────────────────────────────── */}
      {(data?.niches ?? []).length > 0 && !hasFilters && (
        <div style={{ background: "#fff", borderBottom: "1px solid #f0f0f0", padding: "12px 0" }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 24px", display: "flex", gap: "8px", overflowX: "auto", scrollbarWidth: "none" }}>
            {(data?.niches ?? []).slice(0, 16).map((n) => (
              <button
                key={n}
                onClick={() => { setNiche(n.toLowerCase()); setPage(1); }}
                style={{ flexShrink: 0, padding: "5px 14px", borderRadius: "999px", border: "1px solid #e5e7eb", background: niche === n.toLowerCase() ? "#f97316" : "#f9fafb", color: niche === n.toLowerCase() ? "#fff" : "#374151", fontSize: "12px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s" }}
              >
                {n}
              </button>
            ))}
            {niche && (
              <button
                onClick={() => { setNiche(""); setPage(1); }}
                style={{ flexShrink: 0, padding: "5px 14px", borderRadius: "999px", border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
              >
                ✕ Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Product grid ────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "24px 24px 48px" }}>

        {loading ? (
          <div className="mp-grid">
            {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : data?.items.length === 0 ? (
          <div style={{ textAlign: "center", padding: "72px 24px" }}>
            <div style={{ fontSize: "64px", marginBottom: "16px", opacity: 0.6 }}>🔍</div>
            <h2 style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: 700, color: "#374151" }}>No products found</h2>
            <p style={{ color: "#9ca3af", fontSize: "15px", marginBottom: "20px", maxWidth: "320px", margin: "0 auto 24px" }}>
              {q ? `No results for "${q}". Try different keywords.` : "No products match your current filters."}
            </p>
            {hasFilters && (
              <button onClick={clearFilters}
                style={{ padding: "10px 24px", borderRadius: "12px", background: "#f97316", color: "#fff", fontSize: "14px", fontWeight: 700, border: "none", cursor: "pointer", boxShadow: "0 4px 14px rgba(249,115,22,0.35)" }}>
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="mp-grid">
              {data?.items.map((item) => (
                <ProductCard
                  key={item.id}
                  item={item}
                  inWishlist={wishlist.has(item.id)}
                  onWishlist={toggleWishlist}
                  onQuickView={setQuickView}
                  onNicheClick={(n) => { setNiche(n); setPage(1); }}
                  isAdmin={isAdmin}
                  onAdminAction={handleAdminAction}
                  isSelected={selectedProducts.has(item.id)}
                  onSelect={isAdmin ? toggleProductSelection : undefined}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "6px", marginTop: "40px" }}>
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  style={{ padding: "8px 18px", borderRadius: "10px", border: "1px solid #e5e7eb", background: page === 1 ? "#f9fafb" : "#fff", color: page === 1 ? "#d1d5db" : "#374151", fontWeight: 700, fontSize: "13px", cursor: page === 1 ? "default" : "pointer", transition: "all 0.15s" }}>
                  ← Prev
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                  return p <= totalPages ? (
                    <button key={p} onClick={() => setPage(p)}
                      style={{ width: "36px", height: "36px", borderRadius: "10px", border: "1px solid", borderColor: p === page ? "#f97316" : "#e5e7eb", background: p === page ? "#f97316" : "#fff", color: p === page ? "#fff" : "#374151", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>
                      {p}
                    </button>
                  ) : null;
                })}
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  style={{ padding: "8px 18px", borderRadius: "10px", border: "1px solid #e5e7eb", background: page === totalPages ? "#f9fafb" : "#fff", color: page === totalPages ? "#d1d5db" : "#374151", fontWeight: 700, fontSize: "13px", cursor: page === totalPages ? "default" : "pointer", transition: "all 0.15s" }}>
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div style={{ textAlign: "center", padding: "28px 24px", borderTop: "1px solid #e5e7eb" }}>
        <p style={{ margin: 0, fontSize: "13px", color: "#9ca3af" }}>
          Powered by <a href="/" style={{ color: "#f97316", fontWeight: 700, textDecoration: "none" }}>Content Flywheel</a>
          {" · "}
          <a href="/pricing" style={{ color: "#9ca3af", textDecoration: "none" }}>Sell your own products</a>
        </p>
      </div>

      {/* ── Quick-view panel ─────────────────────────────────────────────────── */}
      {quickView && (
        <div onClick={() => setQuickView(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "stretch", justifyContent: "flex-end", backdropFilter: "blur(2px)" }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: "460px", background: "#fff", overflowY: "auto", boxShadow: "-8px 0 48px rgba(0,0,0,0.2)", display: "flex", flexDirection: "column", animation: "slideInRight 0.22s cubic-bezier(.4,0,.2,1)" }}>

            {/* Modal header */}
            <div style={{ position: "sticky", top: 0, background: "#fff", borderBottom: "1px solid #f3f4f6", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 10 }}>
              <span style={{ fontSize: "11px", fontWeight: 800, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em" }}>Quick View</span>
              <button onClick={() => setQuickView(null)} style={{ background: "#f3f4f6", border: "none", borderRadius: "50%", width: "28px", height: "28px", fontSize: "16px", color: "#6b7280", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
            </div>

            {/* Thumbnail */}
            <div style={{ aspectRatio: "4/3", background: "linear-gradient(135deg,#0f0f12 0%,#1a1a2e 100%)", flexShrink: 0, overflow: "hidden", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {quickView.thumbnailUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={quickView.thumbnailUrl} alt={quickView.title} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}><ShoppingBag style={{ width: "52px", height: "52px", color: "rgba(255,255,255,0.5)" }} /></div>
              }
              {quickView.nativePrice === 0 && (
                <span style={{ position: "absolute", top: "12px", left: "12px", background: "#10b981", color: "#fff", fontSize: "11px", fontWeight: 800, padding: "4px 12px", borderRadius: "999px" }}>FREE</span>
              )}
            </div>

            {/* Content */}
            <div style={{ padding: "24px", flex: 1 }}>
              <span style={{ fontSize: "10px", color: "#f97316", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", background: "rgba(249,115,22,0.08)", padding: "3px 8px", borderRadius: "999px", border: "1px solid rgba(249,115,22,0.2)" }}>
                {quickView.niche} · {quickView.format}
              </span>
              <h2 style={{ margin: "12px 0 10px", fontSize: "20px", fontWeight: 800, color: "#111827", lineHeight: 1.25 }}>{quickView.title}</h2>

              {quickView.avgRating !== null && quickView.reviewCount > 0 && (
                <div style={{ marginBottom: "14px" }}>
                  <StarRow rating={quickView.avgRating} count={quickView.reviewCount} size={15} />
                </div>
              )}

              {quickView.description && (
                <p style={{ margin: "0 0 20px", fontSize: "14px", color: "#4b5563", lineHeight: 1.7 }}>{quickView.description}</p>
              )}

              {/* Creator row */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px", padding: "12px", background: "#f9fafb", borderRadius: "12px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: avatarColor(quickView.creatorUserId), display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 800, color: "#fff", flexShrink: 0 }}>
                  {creatorInitials(quickView.creatorName)}
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "#111827" }}>{quickView.creatorName}</p>
                  {quickView.salesCount !== null && quickView.salesCount > 0 && (
                    <p style={{ margin: 0, fontSize: "11px", color: "#9ca3af" }}>{quickView.salesCount} sales</p>
                  )}
                </div>
                <Link href={`/marketplace/creator/${quickView.creatorUserId}`} style={{ marginLeft: "auto", fontSize: "12px", color: "#f97316", fontWeight: 700, textDecoration: "none", background: "rgba(249,115,22,0.08)", padding: "4px 12px", borderRadius: "999px", border: "1px solid rgba(249,115,22,0.2)" }}>
                  View profile →
                </Link>
              </div>

              <div style={{ fontSize: "30px", fontWeight: 900, color: quickView.nativePrice === 0 ? "#10b981" : "#111827", marginBottom: "20px", letterSpacing: "-0.03em" }}>
                {priceDisplay(quickView)}
              </div>

              <a href={`/product/${quickView.id}`}
                style={{ display: "block", width: "100%", padding: "14px", borderRadius: "14px", background: "linear-gradient(135deg,#f97316,#ea580c)", color: "#fff", fontSize: "15px", fontWeight: 800, textAlign: "center", textDecoration: "none", boxShadow: "0 4px 18px rgba(249,115,22,0.4)", boxSizing: "border-box", letterSpacing: "0.01em" }}>
                {quickView.nativePrice === 0 ? "Get for Free →" : "Buy Now →"}
              </a>
              <a href={`/product/${quickView.id}`}
                style={{ display: "block", textAlign: "center", marginTop: "12px", fontSize: "12px", color: "#9ca3af", textDecoration: "none" }}>
                View full product page →
              </a>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .mp-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 18px;
          align-items: stretch;
        }
        @media (max-width: 640px) {
          .mp-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
        }
        @media (max-width: 400px) {
          .mp-grid { grid-template-columns: 1fr; }
        }
        .mp-card-link:hover .mp-quick-view { opacity: 1 !important; }
        .mp-creator-link:hover span { color: #f97316 !important; }
        ::-webkit-scrollbar { display: none; }
        @keyframes fadeInScale { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes slideInUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* ── Bulk action toolbar (admin, floats at bottom when items are selected) ── */}
      {isAdmin && selectedProducts.size > 0 && typeof document !== "undefined" && createPortal(
        <div style={{ position: "fixed", bottom: "28px", left: "50%", transform: "translateX(-50%)", zIndex: 9999, display: "flex", alignItems: "center", gap: "8px", background: "#1f1f2e", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "14px", padding: "10px 16px", boxShadow: "0 12px 40px rgba(0,0,0,0.4)", backdropFilter: "blur(8px)", animation: "slideInUp 0.18s cubic-bezier(.4,0,.2,1)", whiteSpace: "nowrap" }}>
          <span style={{ fontSize: "12px", fontWeight: 700, color: "#e5e7eb" }}>
            {selectedProducts.size} selected
          </span>
          <div style={{ width: "1px", height: "20px", background: "rgba(255,255,255,0.15)" }} />
          <button onClick={selectAllProducts} style={{ fontSize: "12px", fontWeight: 700, color: "#9ca3af", background: "transparent", border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: "6px" }}
            onMouseEnter={(e) => { (e.currentTarget).style.color = "#fff"; }} onMouseLeave={(e) => { (e.currentTarget).style.color = "#9ca3af"; }}>
            Select all
          </button>
          <button onClick={clearSelection} style={{ fontSize: "12px", fontWeight: 700, color: "#9ca3af", background: "transparent", border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: "6px" }}
            onMouseEnter={(e) => { (e.currentTarget).style.color = "#fff"; }} onMouseLeave={(e) => { (e.currentTarget).style.color = "#9ca3af"; }}>
            Clear
          </button>
          <div style={{ width: "1px", height: "20px", background: "rgba(255,255,255,0.15)" }} />
          <button disabled={bulkBusy} onClick={() => execBulkAction("feature")} style={{ fontSize: "12px", fontWeight: 700, color: "#a78bfa", background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)", borderRadius: "8px", padding: "5px 12px", cursor: "pointer" }}>
            ⭐ Feature
          </button>
          <button disabled={bulkBusy} onClick={() => execBulkAction("hide")} style={{ fontSize: "12px", fontWeight: 700, color: "#fbbf24", background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.25)", borderRadius: "8px", padding: "5px 12px", cursor: "pointer" }}>
            Hide
          </button>
          <button disabled={bulkBusy} onClick={() => execBulkAction("archive")} style={{ fontSize: "12px", fontWeight: 700, color: "#fb923c", background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.25)", borderRadius: "8px", padding: "5px 12px", cursor: "pointer" }}>
            Archive
          </button>
          <button disabled={bulkBusy} onClick={() => execBulkAction("remove")} style={{ fontSize: "12px", fontWeight: 700, color: "#f87171", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "8px", padding: "5px 12px", cursor: "pointer" }}>
            Delete
          </button>
        </div>,
        document.body
      )}

      {/* ── Admin confirm modal (products) ─────────────────────────────────── */}
      {adminConfirm && (
        <AdminConfirmModal
          action={adminConfirm.action}
          productTitle={adminConfirm.productTitle}
          onConfirm={() => execAdminAction(adminConfirm.productId, adminConfirm.action)}
          onCancel={() => setAdminConfirm(null)}
        />
      )}

      {/* ── Creator admin confirm modal ────────────────────────────────────── */}
      {creatorConfirm && (
        <CreatorAdminConfirmModal
          action={creatorConfirm.action}
          creatorEmail={creatorConfirm.creatorEmail}
          deleteProducts={creatorDeleteProducts}
          setDeleteProducts={setCreatorDeleteProducts}
          onConfirm={execCreatorAdminAction}
          onCancel={() => setCreatorConfirm(null)}
        />
      )}

      {/* ── Admin toast ────────────────────────────────────────────────────── */}
      {(adminBusy || adminToast) && typeof document !== "undefined" && createPortal(
        <div style={{ position: "fixed", bottom: "28px", left: "50%", transform: "translateX(-50%)", zIndex: 99997, pointerEvents: "none" }}>
          <div style={{ background: adminToast?.ok === false ? "#dc2626" : adminToast?.ok ? "#16a34a" : "#1f1f2e", color: "#fff", borderRadius: "12px", padding: "10px 20px", fontSize: "13px", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px", boxShadow: "0 8px 24px rgba(0,0,0,0.25)", animation: "fadeInScale 0.15s ease", whiteSpace: "nowrap" }}>
            {adminBusy
              ? <><Loader2 style={{ width: "14px", height: "14px", animation: "spin 0.8s linear infinite" }} /> Updating…</>
              : adminToast?.ok
                ? <><Check style={{ width: "14px", height: "14px" }} /> {adminToast.message}</>
                : <><AlertTriangle style={{ width: "14px", height: "14px" }} /> {adminToast?.message}</>
            }
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
