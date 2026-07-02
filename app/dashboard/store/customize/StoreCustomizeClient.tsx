"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import {
  Loader2, Save, ArrowLeft, Palette, Layout, User, Image as ImageIcon,
  Upload, X, Megaphone, Settings2, Share2, Sparkles, ChevronDown, ChevronUp, Globe, Lock,
} from "lucide-react";
import Link from "next/link";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SocialLinksData {
  twitter?: string;
  instagram?: string;
  youtube?: string;
  tiktok?: string;
  linkedin?: string;
  website?: string;
}

interface StoreSettings {
  theme: string;
  accentColor: string;
  layout: string;
  bannerImageUrl: string | null;
  bannerGradient: string | null;
  profileImageUrl: string | null;
  bio: string | null;
  storeName: string | null;
  tagline: string | null;
  showSocialLinks: boolean;
  socialLinks: string | null; // JSON string
  announcementText: string | null;
  announcementColor: string;
  buttonText: string;
  fontFamily: string;
  productSort: string;
  showTrustBadges: boolean;
  showSalesCount: boolean;
  customDomain: string | null;
  customDomainActive: boolean;
}

interface StoreCustomizeClientProps {
  userId: string;
  brandName: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const THEMES = [
  { key: "warm",    label: "Warm",    emoji: "🌅", bg: "#fff7ed", accent: "#f97316" },
  { key: "dark",    label: "Dark",    emoji: "🌙", bg: "#0B0B0F", accent: "#f97316" },
  { key: "light",   label: "Light",   emoji: "☁️",  bg: "#ffffff", accent: "#6366f1" },
  { key: "minimal", label: "Minimal", emoji: "🌿", bg: "#f9fafb", accent: "#10b981" },
  { key: "bold",    label: "Bold",    emoji: "🔥", bg: "#1a1a2e", accent: "#e94560" },
] as const;

const GRADIENTS = [
  { label: "Orange",  value: "135deg, #f97316 0%, #ea580c 100%",  preview: "linear-gradient(135deg, #f97316, #ea580c)" },
  { label: "Purple",  value: "135deg, #7c3aed 0%, #4f46e5 100%",  preview: "linear-gradient(135deg, #7c3aed, #4f46e5)" },
  { label: "Teal",    value: "135deg, #0d9488 0%, #0891b2 100%",  preview: "linear-gradient(135deg, #0d9488, #0891b2)" },
  { label: "Pink",    value: "135deg, #db2777 0%, #9333ea 100%",  preview: "linear-gradient(135deg, #db2777, #9333ea)" },
  { label: "Dark",    value: "135deg, #0B0B0F 0%, #1f2937 100%",  preview: "linear-gradient(135deg, #0B0B0F, #1f2937)" },
  { label: "Sunset",  value: "135deg, #f59e0b 0%, #ef4444 100%",  preview: "linear-gradient(135deg, #f59e0b, #ef4444)" },
];

const FONTS = [
  { key: "inter",       label: "Inter",            style: "font-sans" },
  { key: "poppins",     label: "Poppins",           style: "font-sans" },
  { key: "playfair",    label: "Playfair Display",  style: "font-serif" },
  { key: "montserrat",  label: "Montserrat",        style: "font-sans" },
  { key: "dm-sans",     label: "DM Sans",           style: "font-sans" },
];

const FONT_CSS: Record<string, string> = {
  inter:       "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  poppins:     "'Poppins', sans-serif",
  playfair:    "'Playfair Display', Georgia, serif",
  montserrat:  "'Montserrat', sans-serif",
  "dm-sans":   "'DM Sans', sans-serif",
};

const THEME_CONFIG: Record<string, { page: string; card: string; cardBorder: string; text: string; subText: string; mutedText: string; isDark: boolean }> = {
  warm:    { page: "#FAFAF8", card: "#FFFFFF", cardBorder: "#F0EDE8", text: "#111111", subText: "#555555", mutedText: "#999999", isDark: false },
  dark:    { page: "#0A0A0A", card: "#141414", cardBorder: "#222222", text: "#F5F5F5", subText: "rgba(255,255,255,0.55)", mutedText: "rgba(255,255,255,0.25)", isDark: true },
  light:   { page: "#FFFFFF", card: "#F8F8F8", cardBorder: "#EFEFEF", text: "#111111", subText: "#555555", mutedText: "#AAAAAA", isDark: false },
  minimal: { page: "#F5F5F5", card: "#FFFFFF", cardBorder: "#E8E8E8", text: "#111111", subText: "#666666", mutedText: "#AAAAAA", isDark: false },
  bold:    { page: "#0D0D1A", card: "#13131F", cardBorder: "#1F1F2E", text: "#FFFFFF",  subText: "rgba(255,255,255,0.6)", mutedText: "rgba(255,255,255,0.25)", isDark: true },
};

const FAKE_PRODUCTS = [
  { id: "1", title: "Ultimate Content Playbook", desc: "The complete guide to viral content", price: "£27" },
  { id: "2", title: "Creator Email Templates", desc: "50 proven email templates", price: "£19" },
  { id: "3", title: "Social Media Masterclass", desc: "Grow from 0 to 10k followers", price: "£47" },
];

// ─── Live Preview ─────────────────────────────────────────────────────────────

function StorePreview({ settings, brandName }: { settings: StoreSettings; brandName: string }) {
  const t = THEME_CONFIG[settings.theme] ?? THEME_CONFIG.warm;
  const accent = settings.accentColor || "#f97316";
  const displayName = settings.storeName?.trim() || brandName;
  const fontFamily = FONT_CSS[settings.fontFamily] ?? FONT_CSS.inter;
  const initials = displayName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const isList = settings.layout === "list";
  const isFeatured = settings.layout === "featured";
  let socialData: SocialLinksData = {};
  try { if (settings.socialLinks) socialData = JSON.parse(settings.socialLinks); } catch { /* noop */ }
  const socialEntries = Object.entries(socialData).filter(([, v]) => v);

  let bannerBg: string;
  if (settings.bannerImageUrl) {
    bannerBg = `url(${settings.bannerImageUrl}) center/cover no-repeat`;
  } else if (settings.bannerGradient) {
    bannerBg = `linear-gradient(${settings.bannerGradient})`;
  } else {
    bannerBg = t.isDark
      ? `radial-gradient(ellipse at 60% 0%, ${accent}55 0%, transparent 70%), radial-gradient(ellipse at 20% 100%, ${accent}33 0%, transparent 60%), ${t.page}`
      : `radial-gradient(ellipse at 60% 0%, ${accent}44 0%, transparent 65%), linear-gradient(180deg, ${accent}18 0%, transparent 100%)`;
  }

  return (
    <div style={{ background: t.page, fontFamily, overflow: "hidden", minHeight: "600px" }}>

      {/* Announcement bar */}
      {settings.announcementText && (
        <div style={{ background: accent, padding: "6px 12px", textAlign: "center", fontSize: "9px", fontWeight: "700", color: "#fff", letterSpacing: "0.02em" }}>
          📢 {settings.announcementText}
        </div>
      )}

      {/* Banner */}
      <div style={{ position: "relative", height: "110px", overflow: "hidden" }}>
        <div style={{ width: "100%", height: "100%", background: bannerBg }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "40px", background: `linear-gradient(to bottom, transparent, ${t.page})` }} />
      </div>

      <div style={{ padding: "0 16px 32px" }}>

        {/* Avatar */}
        <div style={{ marginTop: "-32px", marginBottom: "10px" }}>
          {settings.profileImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.profileImageUrl} alt="" style={{ width: "60px", height: "60px", borderRadius: "50%", objectFit: "cover", border: `3px solid ${t.page}`, boxShadow: `0 0 0 1px ${t.cardBorder}` }} />
          ) : (
            <div style={{ width: "60px", height: "60px", borderRadius: "50%", background: `linear-gradient(135deg, ${accent}, ${accent}bb)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", fontWeight: "800", color: "#fff", border: `3px solid ${t.page}`, boxShadow: `0 0 0 1px ${t.cardBorder}, 0 4px 16px ${accent}44` }}>
              {initials}
            </div>
          )}
        </div>

        {/* Name + tagline */}
        <h2 style={{ margin: "0 0 2px", fontSize: "16px", fontWeight: "800", color: t.text, letterSpacing: "-0.3px" }}>{displayName}</h2>
        {settings.tagline && (
          <p style={{ margin: "0 0 4px", fontSize: "10px", color: accent, fontWeight: "600" }}>{settings.tagline}</p>
        )}
        {settings.bio && (
          <p style={{ margin: "0 0 8px", fontSize: "10px", color: t.subText, lineHeight: "1.5" }}>{settings.bio.slice(0, 80)}{settings.bio.length > 80 ? "…" : ""}</p>
        )}

        {/* Social links */}
        {settings.showSocialLinks && socialEntries.length > 0 && (
          <div style={{ display: "flex", gap: "6px", marginBottom: "10px", flexWrap: "wrap" }}>
            {socialEntries.slice(0, 4).map(([key]) => (
              <div key={key} style={{ fontSize: "8px", padding: "3px 8px", borderRadius: "20px", border: `1px solid ${t.cardBorder}`, color: t.subText, background: t.card, fontWeight: "600", textTransform: "capitalize" }}>
                {key}
              </div>
            ))}
          </div>
        )}

        {/* Subscribe button */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "7px 14px", borderRadius: "8px", background: accent, color: "#fff", fontSize: "10px", fontWeight: "700", marginBottom: "20px", boxShadow: `0 3px 10px ${accent}44` }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          {(settings.buttonText || "Subscribe for updates").slice(0, 24)}
        </div>

        {/* Trust badges */}
        {settings.showTrustBadges && (
          <div style={{ display: "flex", gap: "6px", marginBottom: "16px", flexWrap: "wrap" }}>
            {["🔒 Secure", "⚡ Instant", "📧 Email"].map((b) => (
              <span key={b} style={{ fontSize: "8px", color: t.mutedText, background: `${t.card}`, border: `1px solid ${t.cardBorder}`, padding: "3px 7px", borderRadius: "20px", fontWeight: "600" }}>{b}</span>
            ))}
          </div>
        )}

        {/* Products label */}
        <p style={{ margin: "0 0 10px", fontSize: "9px", fontWeight: "700", color: t.mutedText, textTransform: "uppercase", letterSpacing: "0.1em" }}>Products</p>

        {/* Grid */}
        {!isList && !isFeatured && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            {FAKE_PRODUCTS.map((p) => (
              <div key={p.id} style={{ background: t.card, borderRadius: "10px", overflow: "hidden", border: `1px solid ${t.cardBorder}` }}>
                <div style={{ width: "100%", aspectRatio: "1/1", background: `linear-gradient(135deg, ${accent}18, ${accent}38)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>📄</div>
                <div style={{ padding: "8px 10px 10px" }}>
                  <p style={{ margin: "0 0 2px", fontSize: "10px", fontWeight: "700", color: t.text, lineHeight: "1.3" }}>{p.title}</p>
                  <p style={{ margin: "0 0 6px", fontSize: "9px", color: t.subText }}>{p.desc}</p>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "12px", fontWeight: "800", color: accent }}>{p.price}</span>
                    <div style={{ fontSize: "9px", fontWeight: "700", color: "#fff", background: accent, padding: "3px 8px", borderRadius: "6px" }}>Buy</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* List */}
        {isList && (
          <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
            {FAKE_PRODUCTS.map((p) => (
              <div key={p.id} style={{ background: t.card, borderRadius: "10px", border: `1px solid ${t.cardBorder}`, display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "7px", background: `linear-gradient(135deg, ${accent}20, ${accent}40)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", flexShrink: 0 }}>📄</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: "0 0 1px", fontSize: "10px", fontWeight: "700", color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</p>
                  <p style={{ margin: 0, fontSize: "9px", color: t.subText }}>{p.desc}</p>
                </div>
                <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "12px", fontWeight: "800", color: accent }}>{p.price}</span>
                  <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: `${accent}18`, display: "flex", alignItems: "center", justifyContent: "center", color: accent, fontSize: "10px" }}>→</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Featured */}
        {isFeatured && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ background: t.card, borderRadius: "12px", overflow: "hidden", border: `1px solid ${t.cardBorder}`, boxShadow: `0 4px 20px ${accent}18` }}>
              <div style={{ height: "80px", background: `linear-gradient(135deg, ${accent}30, ${accent}60)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px" }}>📄</div>
              <div style={{ padding: "10px 12px" }}>
                <span style={{ display: "inline-block", fontSize: "8px", fontWeight: "700", color: accent, background: `${accent}18`, padding: "2px 7px", borderRadius: "20px", marginBottom: "5px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Featured</span>
                <p style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: "800", color: t.text }}>{FAKE_PRODUCTS[0].title}</p>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "13px", fontWeight: "800", color: accent }}>{FAKE_PRODUCTS[0].price}</span>
                  <div style={{ padding: "4px 10px", borderRadius: "6px", background: accent, color: "#fff", fontSize: "9px", fontWeight: "700" }}>Get it →</div>
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              {FAKE_PRODUCTS.slice(1).map((p) => (
                <div key={p.id} style={{ background: t.card, borderRadius: "10px", overflow: "hidden", border: `1px solid ${t.cardBorder}` }}>
                  <div style={{ width: "100%", aspectRatio: "1/1", background: `linear-gradient(135deg, ${accent}18, ${accent}38)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>📄</div>
                  <div style={{ padding: "7px 9px 9px" }}>
                    <p style={{ margin: "0 0 3px", fontSize: "9px", fontWeight: "700", color: t.text }}>{p.title}</p>
                    <span style={{ fontSize: "11px", fontWeight: "800", color: accent }}>{p.price}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <p style={{ textAlign: "center", marginTop: "20px", fontSize: "9px", color: t.mutedText }}>
          Powered by <span style={{ color: accent, fontWeight: "700" }}>Content Flywheel</span>
        </p>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-7 h-7 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500">
        {icon}
      </div>
      <span className="text-sm font-semibold text-gray-900">{label}</span>
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <div
        className={`relative w-9 h-5 rounded-full transition-colors ${checked ? "bg-orange-500" : "bg-gray-200"}`}
        onClick={() => onChange(!checked)}
      >
        <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-4" : "translate-x-0"}`} />
      </div>
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function StoreCustomizeClient({ userId, brandName }: StoreCustomizeClientProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [generatingBanner, setGeneratingBanner] = useState(false);
  const [generatingProfile, setGeneratingProfile] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const profileInputRef = useRef<HTMLInputElement>(null);

  const [settings, setSettings] = useState<StoreSettings>({
    theme: "warm",
    accentColor: "#f97316",
    layout: "grid",
    bannerImageUrl: null,
    bannerGradient: null,
    profileImageUrl: null,
    bio: null,
    storeName: null,
    tagline: null,
    showSocialLinks: false,
    socialLinks: null,
    announcementText: null,
    announcementColor: "#f97316",
    buttonText: "Subscribe for updates",
    fontFamily: "inter",
    productSort: "newest",
    showTrustBadges: true,
    showSalesCount: false,
    customDomain: null,
    customDomainActive: false,
  });

  // Parse / serialise social links
  const getSocial = (): SocialLinksData => {
    try { return settings.socialLinks ? JSON.parse(settings.socialLinks) : {}; } catch { return {}; }
  };
  const setSocial = (key: keyof SocialLinksData, value: string) => {
    const current = getSocial();
    const updated = { ...current, [key]: value || undefined };
    set("socialLinks", JSON.stringify(updated));
  };

  const generateImage = useCallback(async (type: "banner" | "profile") => {
    const setGenerating = type === "banner" ? setGeneratingBanner : setGeneratingProfile;
    setGenerating(true);
    try {
      // Build a brand context hint from whatever the user has filled in
      const hint = [settings.storeName, settings.tagline, settings.bio]
        .filter(Boolean).join(". ").slice(0, 200);
      const res = await fetch("/api/store-settings/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, hint }),
      });
      const data: { url?: string; error?: string } = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      const key = type === "banner" ? "bannerImageUrl" : "profileImageUrl";
      setSettings((prev) => ({ ...prev, [key]: data.url!, ...(type === "banner" ? { bannerGradient: null } : {}) }));
      toast({ title: `✨ AI ${type} generated!`, description: "Hit Save Changes to publish it." });
    } catch (err) {
      toast({ title: "Generation failed", description: err instanceof Error ? err.message : "Try again", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }, [settings.storeName, settings.tagline, settings.bio, toast]);

  const uploadImage = useCallback(async (file: File, type: "banner" | "profile") => {
    const setUploading = type === "banner" ? setUploadingBanner : setUploadingProfile;
    setUploading(true);
    try {
      if (!file.type.startsWith("image/")) throw new Error("Only image files are allowed");
      if (file.size > 4 * 1024 * 1024) throw new Error("Image must be under 4MB");
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", type);
      const res = await fetch("/api/upload/store-image", { method: "POST", body: fd });
      let data: { url?: string; error?: string } = {};
      try { data = await res.json(); } catch { throw new Error("Upload failed — please try again"); }
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      const key = type === "banner" ? "bannerImageUrl" : "profileImageUrl";
      setSettings((prev) => ({ ...prev, [key]: data.url! }));
      toast({ title: `${type === "banner" ? "Banner" : "Profile"} image uploaded!` });
    } catch (err) {
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : "Try again", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetch("/api/store-settings")
      .then((r) => r.json())
      .then((data) => {
        if (data && !data.error) {
          setSettings({
            theme: data.theme ?? "warm",
            accentColor: data.accentColor ?? "#f97316",
            layout: data.layout ?? "grid",
            bannerImageUrl: data.bannerImageUrl ?? null,
            bannerGradient: data.bannerGradient ?? null,
            profileImageUrl: data.profileImageUrl ?? null,
            bio: data.bio ?? null,
            storeName: data.storeName ?? null,
            tagline: data.tagline ?? null,
            showSocialLinks: data.showSocialLinks ?? false,
            socialLinks: data.socialLinks ?? null,
            announcementText: data.announcementText ?? null,
            announcementColor: data.announcementColor ?? "#f97316",
            buttonText: data.buttonText ?? "Subscribe for updates",
            fontFamily: data.fontFamily ?? "inter",
            productSort: data.productSort ?? "newest",
            showTrustBadges: data.showTrustBadges ?? true,
            showSalesCount: data.showSalesCount ?? false,
            customDomain: data.customDomain ?? null,
            customDomainActive: data.customDomainActive ?? false,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const set = useCallback(<K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleThemeSelect = useCallback((themeKey: string) => {
    const theme = THEMES.find((t) => t.key === themeKey);
    if (theme) setSettings((prev) => ({ ...prev, theme: themeKey, accentColor: theme.accent }));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/store-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast({ title: "Saved!", description: "Your store has been updated." });
    } catch {
      toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ── Domain availability state ──
  const [domainStatus, setDomainStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const domainCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkDomain = useCallback((value: string) => {
    if (domainCheckTimer.current) clearTimeout(domainCheckTimer.current);
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) { setDomainStatus("idle"); return; }
    setDomainStatus("checking");
    domainCheckTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/store-settings/check-domain?domain=${encodeURIComponent(trimmed)}`);
        const data = await res.json() as { available: boolean; reason?: string };
        if (data.reason === "Invalid domain format") setDomainStatus("invalid");
        else setDomainStatus(data.available ? "available" : "taken");
      } catch {
        setDomainStatus("idle");
      }
    }, 600);
  }, []);

  // ── AI Design state ──
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReasoning, setAiReasoning] = useState<string | null>(null);

  const handleAiDesign = async () => {
    setAiLoading(true);
    setAiReasoning(null);
    try {
      const res = await fetch("/api/store-settings/ai-design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt.trim() || undefined }),
      });
      if (!res.ok) throw new Error("AI design failed");
      const data = await res.json() as {
        theme?: string; accentColor?: string; tagline?: string | null;
        bio?: string | null; announcementText?: string | null;
        buttonText?: string; fontFamily?: string; bannerGradient?: string;
        reasoning?: string | null;
      };
      setSettings((prev) => ({
        ...prev,
        ...(data.theme && { theme: data.theme }),
        ...(data.accentColor && { accentColor: data.accentColor }),
        ...(data.tagline !== undefined && { tagline: data.tagline }),
        ...(data.bio !== undefined && { bio: data.bio }),
        ...(data.announcementText !== undefined && { announcementText: data.announcementText }),
        ...(data.buttonText && { buttonText: data.buttonText }),
        ...(data.fontFamily && { fontFamily: data.fontFamily }),
        ...(data.bannerGradient && { bannerGradient: data.bannerGradient, bannerImageUrl: null }),
      }));
      if (data.reasoning) setAiReasoning(data.reasoning);
      toast({ title: "✨ AI design applied!", description: data.reasoning ?? "Your store has been redesigned." });
    } catch {
      toast({ title: "AI design failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  const social = getSocial();

  return (
    <div className="min-h-screen bg-white">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/store">
            <Button variant="ghost" size="sm" className="gap-2 text-gray-500 hover:text-gray-900 h-8">
              <ArrowLeft className="w-4 h-4" />
              Back to Store
            </Button>
          </Link>
          <div className="h-5 w-px bg-gray-200" />
          <h1 className="text-base font-bold text-gray-900">Customise Store</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/c/${userId}`} target="_blank">
            <Button variant="outline" size="sm" className="gap-2 h-8 border-gray-200 text-gray-600 text-xs">
              View live store ↗
            </Button>
          </Link>
          <Button onClick={handleSave} disabled={saving} className="bg-orange-500 hover:bg-orange-600 text-white gap-2 h-8 text-sm">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Two-panel */}
      <div className="flex h-[calc(100vh-53px)]">

        {/* Left — settings */}
        <div className="w-[380px] flex-shrink-0 overflow-y-auto border-r border-gray-200 bg-gray-50">
          <div className="p-5 space-y-7">

            {/* ── AI Design ── */}
            <div className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 overflow-hidden">
              <button
                type="button"
                onClick={() => setAiOpen((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-orange-100/50 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-orange-500 flex items-center justify-center flex-shrink-0">
                    <Sparkles size={14} className="text-white" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-gray-900 leading-none mb-0.5">AI Auto-Design</p>
                    <p className="text-[11px] text-gray-500">Let AI design your store in seconds</p>
                  </div>
                </div>
                {aiOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
              </button>

              {aiOpen && (
                <div className="px-4 pb-4 space-y-3 border-t border-orange-200/60">
                  <p className="text-xs text-gray-500 pt-3">
                    AI will pick your theme, colours, font, tagline, bio and banner based on your brand.
                    Optionally describe what you want.
                  </p>

                  {/* Quick niche chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {["Wellness & fitness", "Tech & SaaS", "Fashion & lifestyle", "Finance & business", "Art & creative", "Education & courses", "Food & cooking"].map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => setAiPrompt(chip)}
                        className={`text-[11px] px-2.5 py-1 rounded-full border transition-all font-medium ${
                          aiPrompt === chip
                            ? "border-orange-500 bg-orange-500 text-white"
                            : "border-gray-200 bg-white text-gray-600 hover:border-orange-300"
                        }`}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="Or describe your brand / vibe…"
                      maxLength={300}
                      className="flex-1 h-9 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 px-3 placeholder:text-gray-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20"
                      onKeyDown={(e) => { if (e.key === "Enter") handleAiDesign(); }}
                    />
                    <Button
                      type="button"
                      onClick={handleAiDesign}
                      disabled={aiLoading}
                      className="h-9 bg-orange-500 hover:bg-orange-600 text-white text-sm gap-1.5 flex-shrink-0"
                    >
                      {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      {aiLoading ? "Designing…" : "Design"}
                    </Button>
                  </div>

                  {aiReasoning && (
                    <div className="flex gap-2 p-3 bg-white rounded-xl border border-orange-100">
                      <span className="text-base flex-shrink-0">✨</span>
                      <p className="text-xs text-gray-600 leading-relaxed">{aiReasoning}</p>
                    </div>
                  )}

                  <p className="text-[10px] text-gray-400">
                    Changes are previewed live — save when you&apos;re happy.
                  </p>
                </div>
              )}
            </div>

            {/* ── Identity ── */}
            <div>
              <SectionHeader icon={<User size={14} />} label="Identity" />
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Store Name</label>
                  <Input
                    value={settings.storeName ?? ""}
                    onChange={(e) => set("storeName", e.target.value || null)}
                    className="h-9 text-sm border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:border-orange-500"
                    placeholder={brandName || "Your Store Name"}
                  />
                  <p className="text-[11px] text-gray-400 mt-1">Defaults to your brand name if left blank</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Tagline</label>
                  <Input
                    value={settings.tagline ?? ""}
                    onChange={(e) => set("tagline", e.target.value || null)}
                    className="h-9 text-sm border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:border-orange-500"
                    placeholder="e.g. Digital products for creators"
                    maxLength={80}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Bio <span className="text-gray-400">({(settings.bio ?? "").length}/200)</span>
                  </label>
                  <textarea
                    value={settings.bio ?? ""}
                    onChange={(e) => set("bio", e.target.value.slice(0, 200) || null)}
                    rows={3}
                    maxLength={200}
                    className="w-full rounded-lg border border-gray-200 bg-white text-gray-900 text-sm px-3 py-2 placeholder:text-gray-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 resize-none"
                    placeholder="Tell your audience who you are…"
                  />
                </div>
              </div>
            </div>

            {/* ── Appearance ── */}
            <div>
              <SectionHeader icon={<Palette size={14} />} label="Appearance" />
              <div className="space-y-4">

                {/* Theme presets */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">Theme</label>
                  <div className="grid grid-cols-5 gap-2">
                    {THEMES.map((theme) => (
                      <button
                        key={theme.key}
                        type="button"
                        onClick={() => handleThemeSelect(theme.key)}
                        className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${
                          settings.theme === theme.key
                            ? "border-orange-500 ring-1 ring-orange-500/30 bg-orange-50"
                            : "border-gray-200 hover:border-gray-300 bg-white"
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg border border-gray-200" style={{ background: theme.bg }} />
                        <span className="text-[9px] text-gray-400 leading-none">{theme.emoji}</span>
                        <span className="text-[9px] text-gray-600 leading-none font-medium">{theme.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Accent color */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">Accent Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={settings.accentColor}
                      onChange={(e) => set("accentColor", e.target.value)}
                      className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer bg-white p-0.5 flex-shrink-0"
                    />
                    <Input
                      value={settings.accentColor}
                      onChange={(e) => set("accentColor", e.target.value)}
                      className="w-28 h-9 text-sm border-gray-200 bg-white text-gray-900 font-mono focus:border-orange-500"
                      maxLength={7}
                      placeholder="#f97316"
                    />
                    <div className="w-9 h-9 rounded-lg border border-gray-200 flex-shrink-0" style={{ background: settings.accentColor }} />
                  </div>
                </div>

                {/* Font */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">Font</label>
                  <div className="grid grid-cols-1 gap-1.5">
                    {FONTS.map((f) => (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => set("fontFamily", f.key)}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-all text-left ${
                          settings.fontFamily === f.key
                            ? "border-orange-500 bg-orange-50 text-orange-700 font-semibold"
                            : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                        }`}
                        style={{ fontFamily: FONT_CSS[f.key] }}
                      >
                        {f.label}
                        {settings.fontFamily === f.key && <span className="text-[10px] text-orange-500 font-bold tracking-wide">ACTIVE</span>}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Layout ── */}
            <div>
              <SectionHeader icon={<Layout size={14} />} label="Layout" />
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">Product Display</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: "grid", label: "Grid", icon: (
                        <svg width="28" height="22" viewBox="0 0 32 24" fill="none"><rect x="1" y="1" width="13" height="10" rx="2" fill="currentColor" opacity="0.5"/><rect x="18" y="1" width="13" height="10" rx="2" fill="currentColor" opacity="0.5"/><rect x="1" y="13" width="13" height="10" rx="2" fill="currentColor" opacity="0.5"/><rect x="18" y="13" width="13" height="10" rx="2" fill="currentColor" opacity="0.5"/></svg>
                      )},
                      { key: "list", label: "List", icon: (
                        <svg width="28" height="22" viewBox="0 0 32 24" fill="none"><rect x="1" y="1" width="30" height="6" rx="2" fill="currentColor" opacity="0.5"/><rect x="1" y="9" width="30" height="6" rx="2" fill="currentColor" opacity="0.5"/><rect x="1" y="17" width="30" height="6" rx="2" fill="currentColor" opacity="0.5"/></svg>
                      )},
                      { key: "featured", label: "Featured", icon: (
                        <svg width="28" height="22" viewBox="0 0 32 24" fill="none"><rect x="1" y="1" width="30" height="12" rx="2" fill="currentColor" opacity="0.5"/><rect x="1" y="15" width="13" height="8" rx="2" fill="currentColor" opacity="0.3"/><rect x="18" y="15" width="13" height="8" rx="2" fill="currentColor" opacity="0.3"/></svg>
                      )},
                    ].map(({ key, label, icon }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => set("layout", key)}
                        className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                          settings.layout === key
                            ? "border-orange-500 ring-1 ring-orange-500/30 bg-orange-50 text-orange-500"
                            : "border-gray-200 hover:border-gray-300 bg-white text-gray-400"
                        }`}
                      >
                        {icon}
                        <span className="text-xs font-medium text-gray-700">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">Product Sort Order</label>
                  <select
                    value={settings.productSort}
                    onChange={(e) => set("productSort", e.target.value)}
                    className="w-full h-9 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 px-3 focus:outline-none focus:border-orange-500"
                  >
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="price-asc">Price: low to high</option>
                    <option value="price-desc">Price: high to low</option>
                  </select>
                </div>
              </div>
            </div>

            {/* ── Profile Image ── */}
            <div>
              <SectionHeader icon={<User size={14} />} label="Profile Image" />
              <div className="space-y-2">
                <input ref={profileInputRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f, "profile"); e.target.value = ""; }} />
                {settings.profileImageUrl ? (
                  <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={settings.profileImageUrl} alt="Profile" className="w-12 h-12 rounded-full object-cover flex-shrink-0 border border-gray-200" />
                    <span className="text-xs text-gray-500 flex-1 truncate">{settings.profileImageUrl.split("/").pop()}</span>
                    <button onClick={() => set("profileImageUrl", null)} className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"><X size={14} /></button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => profileInputRef.current?.click()}
                      disabled={uploadingProfile || generatingProfile}
                      className="flex-1 border-gray-200 text-gray-600 hover:border-orange-500 bg-white h-9">
                      {uploadingProfile ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Upload size={14} className="mr-1.5" />}
                      {uploadingProfile ? "Uploading…" : "Upload"}
                    </Button>
                    <Button type="button" size="sm" onClick={() => generateImage("profile")}
                      disabled={uploadingProfile || generatingProfile}
                      className="flex-1 bg-gradient-to-r from-purple-500 to-orange-500 hover:from-purple-600 hover:to-orange-600 text-white h-9 border-0">
                      {generatingProfile ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Sparkles size={14} className="mr-1.5" />}
                      {generatingProfile ? "Generating…" : "AI Generate"}
                    </Button>
                  </div>
                )}
                <p className="text-[11px] text-gray-400">Or paste a URL:</p>
                <Input value={settings.profileImageUrl ?? ""} onChange={(e) => set("profileImageUrl", e.target.value || null)}
                  className="h-8 text-xs border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:border-orange-500"
                  placeholder="https://example.com/avatar.jpg" />
              </div>
            </div>

            {/* ── Banner ── */}
            <div>
              <SectionHeader icon={<ImageIcon size={14} />} label="Banner" />
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Banner Image <span className="text-gray-400 font-normal">(takes priority over gradient)</span></label>
                  <input ref={bannerInputRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f, "banner"); e.target.value = ""; }} />
                  {settings.bannerImageUrl ? (
                    <div className="relative rounded-xl overflow-hidden border border-gray-200 mb-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={settings.bannerImageUrl} alt="Banner" className="w-full h-20 object-cover" />
                      <button onClick={() => set("bannerImageUrl", null)}
                        className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition-colors">
                        <X size={11} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2 mb-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => bannerInputRef.current?.click()}
                        disabled={uploadingBanner || generatingBanner}
                        className="flex-1 border-gray-200 text-gray-600 hover:border-orange-500 bg-white h-9">
                        {uploadingBanner ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Upload size={14} className="mr-1.5" />}
                        {uploadingBanner ? "Uploading…" : "Upload"}
                      </Button>
                      <Button type="button" size="sm" onClick={() => generateImage("banner")}
                        disabled={uploadingBanner || generatingBanner}
                        className="flex-1 bg-gradient-to-r from-purple-500 to-orange-500 hover:from-purple-600 hover:to-orange-600 text-white h-9 border-0">
                        {generatingBanner ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Sparkles size={14} className="mr-1.5" />}
                        {generatingBanner ? "Generating…" : "AI Generate"}
                      </Button>
                    </div>
                  )}
                  <p className="text-[11px] text-gray-400">Or paste a URL:</p>
                  <Input value={settings.bannerImageUrl ?? ""} onChange={(e) => set("bannerImageUrl", e.target.value || null)}
                    className="h-8 text-xs border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:border-orange-500 mt-1"
                    placeholder="https://example.com/banner.jpg" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">Or choose a gradient</label>
                  <div className="grid grid-cols-6 gap-2">
                    {GRADIENTS.map((g) => (
                      <button key={g.value} type="button" title={g.label}
                        onClick={() => { set("bannerGradient", g.value); set("bannerImageUrl", null); }}
                        className={`w-full aspect-square rounded-lg border-2 transition-all ${
                          settings.bannerGradient === g.value && !settings.bannerImageUrl
                            ? "border-orange-500 ring-1 ring-orange-500/30 scale-105"
                            : "border-transparent hover:border-gray-300"
                        }`}
                        style={{ background: g.preview }}
                      />
                    ))}
                  </div>
                  {settings.bannerGradient && !settings.bannerImageUrl && (
                    <button type="button" onClick={() => set("bannerGradient", null)}
                      className="mt-2 text-xs text-gray-400 hover:text-gray-600 transition-colors">
                      Clear gradient
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* ── Social Links ── */}
            <div>
              <SectionHeader icon={<Share2 size={14} />} label="Social Links" />
              <div className="space-y-3">
                <Toggle
                  checked={settings.showSocialLinks}
                  onChange={(v) => set("showSocialLinks", v)}
                  label="Show social links on store"
                />
                {settings.showSocialLinks && (
                  <div className="space-y-2 pt-1">
                    {([
                      { key: "website",   placeholder: "https://yourwebsite.com",      label: "Website" },
                      { key: "twitter",   placeholder: "https://twitter.com/handle",   label: "Twitter / X" },
                      { key: "instagram", placeholder: "https://instagram.com/handle", label: "Instagram" },
                      { key: "youtube",   placeholder: "https://youtube.com/@handle",  label: "YouTube" },
                      { key: "tiktok",    placeholder: "https://tiktok.com/@handle",   label: "TikTok" },
                      { key: "linkedin",  placeholder: "https://linkedin.com/in/...",  label: "LinkedIn" },
                    ] as { key: keyof SocialLinksData; placeholder: string; label: string }[]).map(({ key, placeholder, label }) => (
                      <div key={key}>
                        <label className="block text-[11px] font-medium text-gray-500 mb-1">{label}</label>
                        <Input
                          value={social[key] ?? ""}
                          onChange={(e) => setSocial(key, e.target.value)}
                          className="h-8 text-xs border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:border-orange-500"
                          placeholder={placeholder}
                          type="url"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Announcement Bar ── */}
            <div>
              <SectionHeader icon={<Megaphone size={14} />} label="Announcement Bar" />
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">
                    Message <span className="text-gray-400">(leave blank to hide)</span>
                  </label>
                  <Input
                    value={settings.announcementText ?? ""}
                    onChange={(e) => set("announcementText", e.target.value || null)}
                    className="h-9 text-sm border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:border-orange-500"
                    placeholder="e.g. 🎉 New product drop — limited time 20% off!"
                    maxLength={120}
                  />
                </div>
              </div>
            </div>

            {/* ── Store Settings ── */}
            <div>
              <SectionHeader icon={<Settings2 size={14} />} label="Store Options" />
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Subscribe Button Text</label>
                  <Input
                    value={settings.buttonText}
                    onChange={(e) => set("buttonText", e.target.value || "Subscribe for updates")}
                    className="h-9 text-sm border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:border-orange-500"
                    placeholder="Subscribe for updates"
                    maxLength={40}
                  />
                </div>
                <Toggle
                  checked={settings.showTrustBadges}
                  onChange={(v) => set("showTrustBadges", v)}
                  label="Show trust badges (Secure checkout, Instant download…)"
                />
                <Toggle
                  checked={settings.showSalesCount}
                  onChange={(v) => set("showSalesCount", v)}
                  label="Show sales count publicly on the Marketplace (e.g. '12 sales')"
                />
              </div>
            </div>

            {/* Store URL / Subdomain — free for all paying members */}
            {(() => {
              const SUFFIX = ".contentflywheel.co.uk";
              const storedDomain = settings.customDomain ?? "";
              const currentHandle = storedDomain.endsWith(SUFFIX)
                ? storedDomain.slice(0, -SUFFIX.length)
                : storedDomain.includes(".") ? "" : storedDomain;
              return (
                <div className="space-y-3 border-t border-gray-200 pt-4">
                  <SectionHeader icon={<Globe size={14} />} label="Your Store URL" />
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-gray-500">Choose your store address</label>
                    <div className="flex items-center gap-0">
                      <div className="relative flex-1">
                        <Input
                          value={currentHandle}
                          onChange={(e) => {
                            const handle = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
                            const full = handle ? `${handle}${SUFFIX}` : null;
                            set("customDomain", full);
                            checkDomain(handle);
                          }}
                          placeholder="yourbrand"
                          maxLength={40}
                          className={`h-9 text-sm bg-white text-gray-900 placeholder:text-gray-400 focus:border-orange-500 rounded-r-none ${
                            domainStatus === "taken" || domainStatus === "invalid"
                              ? "border-red-400"
                              : domainStatus === "available"
                              ? "border-green-400"
                              : "border-gray-200"
                          }`}
                        />
                      </div>
                      <div className="h-9 px-2.5 flex items-center bg-gray-100 border border-l-0 border-gray-200 rounded-r-md text-xs text-gray-500 font-mono whitespace-nowrap">
                        .contentflywheel.co.uk
                      </div>
                    </div>
                    {domainStatus !== "idle" && (
                      <p className={`text-[11px] font-medium ${
                        domainStatus === "checking" ? "text-gray-400" :
                        domainStatus === "available" ? "text-green-600" : "text-red-500"
                      }`}>
                        {domainStatus === "checking" && "Checking…"}
                        {domainStatus === "available" && `✓ Available — your store will be at ${currentHandle}${SUFFIX}`}
                        {domainStatus === "taken" && "✗ This name is already taken by another store."}
                        {domainStatus === "invalid" && "✗ Only letters, numbers and hyphens allowed (min 2 characters)."}
                      </p>
                    )}
                    {domainStatus === "idle" && currentHandle && (
                      <p className="text-[11px] text-gray-400">
                        Your store: <span className="font-mono text-gray-600">{currentHandle}{SUFFIX}</span>
                      </p>
                    )}
                  </div>

                  {/* Custom .com domain upsell */}
                  {settings.customDomainActive ? (
                    <div className="rounded-xl border border-green-200 bg-green-50 p-3 flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                        <Globe size={13} className="text-green-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-green-800">Custom Domain Unlocked</p>
                        <p className="text-[11px] text-green-600">Connect your own .com domain — coming soon.</p>
                      </div>
                      <span className="text-[10px] font-bold text-green-600 bg-green-100 border border-green-200 px-2 py-0.5 rounded-full">Active</span>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-3 flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                        <Globe size={13} className="text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-700">Want your own domain?</p>
                        <p className="text-[11px] text-gray-400">e.g. <span className="font-mono">yourbrand.com</span> — one-time unlock.</p>
                      </div>
                      <a
                        href="/dashboard/video-credits"
                        className="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors whitespace-nowrap"
                      >
                        £19.99
                      </a>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Save */}
            <div className="pb-4 pt-2">
              <Button
                onClick={handleSave}
                disabled={saving || domainStatus === "taken" || domainStatus === "invalid"}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white gap-2 h-10 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? "Saving…" : "Save Changes"}
              </Button>
              <p className="text-xs text-gray-400 text-center mt-2">
                Publishes to{" "}
                <Link href={`/c/${userId}`} target="_blank" className="text-orange-500 hover:text-orange-600">
                  /c/{userId}
                </Link>
              </p>
            </div>

          </div>
        </div>

        {/* Right — live preview */}
        <div className="flex-1 bg-[#111118] overflow-y-auto flex flex-col">
          <div className="flex items-center gap-2 px-6 py-3 border-b border-white/10">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-gray-400 font-medium">Live Preview</span>
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-gray-600">Updates as you change settings</span>
              <Link href={`/c/${userId}`} target="_blank"
                className="text-xs text-orange-400 hover:text-orange-300 font-medium transition-colors">
                Test Wizard ↗
              </Link>
            </div>
          </div>
          <div className="flex-1 p-6 flex items-start justify-center">
            <div className="w-full shadow-2xl overflow-hidden" style={{ maxWidth: "360px", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.08)" }}>
              <StorePreview settings={settings} brandName={brandName} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
