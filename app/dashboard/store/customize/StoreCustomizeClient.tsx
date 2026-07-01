"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Save, ArrowLeft, Palette, Layout, User, Image as ImageIcon, Upload, X } from "lucide-react";
import Link from "next/link";

// ─── Types ──────────────────────────────────────────────────────────────────

interface StoreSettings {
  theme: string;
  accentColor: string;
  layout: string;
  bannerImageUrl: string | null;
  bannerGradient: string | null;
  profileImageUrl: string | null;
  bio: string | null;
  showSocialLinks: boolean;
  socialLinks: string | null;
}

interface StoreCustomizeClientProps {
  userId: string;
  brandName: string;
}

// ─── Theme presets ───────────────────────────────────────────────────────────

const THEMES = [
  {
    key: "warm",
    label: "Warm",
    emoji: "🌅",
    bg: "#fff7ed",
    accent: "#f97316",
    text: "#111827",
    cardBg: "#ffffff",
  },
  {
    key: "dark",
    label: "Dark",
    emoji: "🌙",
    bg: "#0B0B0F",
    accent: "#f97316",
    text: "#ffffff",
    cardBg: "#1c1c24",
  },
  {
    key: "light",
    label: "Light",
    emoji: "☁️",
    bg: "#ffffff",
    accent: "#6366f1",
    text: "#111827",
    cardBg: "#f8fafc",
  },
  {
    key: "minimal",
    label: "Minimal",
    emoji: "🌿",
    bg: "#f9fafb",
    accent: "#10b981",
    text: "#111827",
    cardBg: "#ffffff",
  },
  {
    key: "bold",
    label: "Bold",
    emoji: "🔥",
    bg: "#1a1a2e",
    accent: "#e94560",
    text: "#ffffff",
    cardBg: "#16213e",
  },
] as const;

// ─── Gradient presets ────────────────────────────────────────────────────────

const GRADIENTS = [
  { label: "Orange", value: "135deg, #f97316 0%, #ea580c 100%", preview: "linear-gradient(135deg, #f97316, #ea580c)" },
  { label: "Purple", value: "135deg, #7c3aed 0%, #4f46e5 100%", preview: "linear-gradient(135deg, #7c3aed, #4f46e5)" },
  { label: "Teal", value: "135deg, #0d9488 0%, #0891b2 100%", preview: "linear-gradient(135deg, #0d9488, #0891b2)" },
  { label: "Pink", value: "135deg, #db2777 0%, #9333ea 100%", preview: "linear-gradient(135deg, #db2777, #9333ea)" },
  { label: "Dark", value: "135deg, #0B0B0F 0%, #1f2937 100%", preview: "linear-gradient(135deg, #0B0B0F, #1f2937)" },
  { label: "Sunset", value: "135deg, #f59e0b 0%, #ef4444 100%", preview: "linear-gradient(135deg, #f59e0b, #ef4444)" },
];

// ─── Fake products for preview ───────────────────────────────────────────────

const FAKE_PRODUCTS = [
  { id: "1", title: "Ultimate Content Playbook", desc: "The complete guide to viral content", price: "£27" },
  { id: "2", title: "Creator Email Templates", desc: "50 proven email templates", price: "£19" },
  { id: "3", title: "Social Media Masterclass", desc: "Grow from 0 to 10k followers", price: "£47" },
];

// ─── Theme config (mirrors /c/[userId]/page.tsx) ─────────────────────────────

const THEME_CONFIG: Record<string, { page: string; card: string; cardBorder: string; text: string; subText: string; mutedText: string; isDark: boolean }> = {
  warm:    { page: "#FAFAF8", card: "#FFFFFF", cardBorder: "#F0EDE8", text: "#111111", subText: "#555555", mutedText: "#999999", isDark: false },
  dark:    { page: "#0A0A0A", card: "#141414", cardBorder: "#222222", text: "#F5F5F5", subText: "rgba(255,255,255,0.55)", mutedText: "rgba(255,255,255,0.25)", isDark: true },
  light:   { page: "#FFFFFF", card: "#F8F8F8", cardBorder: "#EFEFEF", text: "#111111", subText: "#555555", mutedText: "#AAAAAA", isDark: false },
  minimal: { page: "#F5F5F5", card: "#FFFFFF", cardBorder: "#E8E8E8", text: "#111111", subText: "#666666", mutedText: "#AAAAAA", isDark: false },
  bold:    { page: "#0D0D1A", card: "#13131F", cardBorder: "#1F1F2E", text: "#FFFFFF", subText: "rgba(255,255,255,0.6)", mutedText: "rgba(255,255,255,0.25)", isDark: true },
};

// ─── Live Preview ─────────────────────────────────────────────────────────────

function StorePreview({ settings, brandName }: { settings: StoreSettings; brandName: string }) {
  const t = THEME_CONFIG[settings.theme] ?? THEME_CONFIG.warm;
  const accent = settings.accentColor || "#f97316";

  const initials = brandName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const isList = settings.layout === "list";
  const isFeatured = settings.layout === "featured";

  // Banner background
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
    <div style={{ background: t.page, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", overflow: "hidden", minHeight: "600px" }}>

      {/* Banner */}
      <div style={{ position: "relative", height: "120px", overflow: "hidden" }}>
        <div style={{ width: "100%", height: "100%", background: bannerBg }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "48px", background: `linear-gradient(to bottom, transparent, ${t.page})` }} />
      </div>

      {/* Content */}
      <div style={{ padding: "0 16px 32px" }}>

        {/* Avatar */}
        <div style={{ marginTop: "-36px", marginBottom: "12px" }}>
          {settings.profileImageUrl ? (
            <img src={settings.profileImageUrl} alt="" style={{ width: "64px", height: "64px", borderRadius: "50%", objectFit: "cover", border: `3px solid ${t.page}`, boxShadow: `0 0 0 1px ${t.cardBorder}` }} />
          ) : (
            <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: `linear-gradient(135deg, ${accent}, ${accent}bb)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", fontWeight: "800", color: "#fff", border: `3px solid ${t.page}`, boxShadow: `0 0 0 1px ${t.cardBorder}, 0 4px 16px ${accent}44` }}>
              {initials}
            </div>
          )}
        </div>

        {/* Name */}
        <h2 style={{ margin: "0 0 4px", fontSize: "17px", fontWeight: "800", color: t.text, letterSpacing: "-0.3px" }}>{brandName}</h2>

        {/* Bio */}
        {settings.bio && (
          <p style={{ margin: "0 0 12px", fontSize: "11px", color: t.subText, lineHeight: "1.5" }}>{settings.bio}</p>
        )}

        {/* Subscribe button */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "7px 14px", borderRadius: "8px", background: accent, color: "#fff", fontSize: "11px", fontWeight: "700", marginBottom: "24px", boxShadow: `0 3px 10px ${accent}44` }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          Subscribe for updates
        </div>

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
              <div style={{ height: "90px", background: `linear-gradient(135deg, ${accent}30, ${accent}60)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px" }}>📄</div>
              <div style={{ padding: "12px 14px" }}>
                <span style={{ display: "inline-block", fontSize: "8px", fontWeight: "700", color: accent, background: `${accent}18`, padding: "2px 7px", borderRadius: "20px", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Featured</span>
                <p style={{ margin: "0 0 4px", fontSize: "12px", fontWeight: "800", color: t.text }}>{FAKE_PRODUCTS[0].title}</p>
                <p style={{ margin: "0 0 10px", fontSize: "9px", color: t.subText }}>{FAKE_PRODUCTS[0].desc}</p>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "14px", fontWeight: "800", color: accent }}>{FAKE_PRODUCTS[0].price}</span>
                  <div style={{ padding: "5px 12px", borderRadius: "7px", background: accent, color: "#fff", fontSize: "9px", fontWeight: "700" }}>Get it →</div>
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              {FAKE_PRODUCTS.slice(1).map((p) => (
                <div key={p.id} style={{ background: t.card, borderRadius: "10px", overflow: "hidden", border: `1px solid ${t.cardBorder}` }}>
                  <div style={{ width: "100%", aspectRatio: "1/1", background: `linear-gradient(135deg, ${accent}18, ${accent}38)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>📄</div>
                  <div style={{ padding: "8px 10px 10px" }}>
                    <p style={{ margin: "0 0 3px", fontSize: "10px", fontWeight: "700", color: t.text, lineHeight: "1.3" }}>{p.title}</p>
                    <span style={{ fontSize: "11px", fontWeight: "800", color: accent }}>{p.price}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <p style={{ textAlign: "center", marginTop: "24px", fontSize: "9px", color: t.mutedText }}>
          Powered by <span style={{ color: accent, fontWeight: "700" }}>Content Flywheel</span>
        </p>
      </div>
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-7 h-7 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
        {icon}
      </div>
      <span className="text-sm font-semibold text-white">{label}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function StoreCustomizeClient({ userId, brandName }: StoreCustomizeClientProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const profileInputRef = useRef<HTMLInputElement>(null);

  const uploadImage = useCallback(async (file: File, type: "banner" | "profile") => {
    const setUploading = type === "banner" ? setUploadingBanner : setUploadingProfile;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", type);
      const res = await fetch("/api/upload/store-image", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      const key = type === "banner" ? "bannerImageUrl" : "profileImageUrl";
      setSettings((prev) => ({ ...prev, [key]: data.url }));
      toast({ title: `${type === "banner" ? "Banner" : "Profile"} image uploaded!` });
    } catch (err) {
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : "Try again", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }, [toast]);
  const [settings, setSettings] = useState<StoreSettings>({
    theme: "warm",
    accentColor: "#f97316",
    layout: "grid",
    bannerImageUrl: null,
    bannerGradient: null,
    profileImageUrl: null,
    bio: null,
    showSocialLinks: false,
    socialLinks: null,
  });

  // Load settings on mount
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
            showSocialLinks: data.showSocialLinks ?? false,
            socialLinks: data.socialLinks ?? null,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const set = useCallback(<K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleThemeSelect = useCallback(
    (themeKey: string) => {
      const theme = THEMES.find((t) => t.key === themeKey);
      if (theme) {
        setSettings((prev) => ({
          ...prev,
          theme: themeKey,
          accentColor: theme.accent,
        }));
      }
    },
    []
  );

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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/store">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-gray-400 hover:text-white h-8"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Store
            </Button>
          </Link>
          <div className="h-5 w-px bg-white/10" />
          <h1 className="text-lg font-bold text-white">Customise Store</h1>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-orange-500 hover:bg-orange-600 text-white gap-2 h-9"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {/* Two-panel layout */}
      <div className="flex gap-0 h-[calc(100vh-65px)]">
        {/* Left panel — settings */}
        <div className="w-[380px] flex-shrink-0 overflow-y-auto border-r border-white/10 p-6 space-y-8">

          {/* Theme presets */}
          <div>
            <SectionHeader icon={<Palette size={14} />} label="Theme" />
            <div className="grid grid-cols-5 gap-2">
              {THEMES.map((theme) => (
                <button
                  key={theme.key}
                  type="button"
                  onClick={() => handleThemeSelect(theme.key)}
                  className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${
                    settings.theme === theme.key
                      ? "border-orange-500 ring-1 ring-orange-500/40 bg-orange-500/5"
                      : "border-white/10 hover:border-white/20 bg-white/5"
                  }`}
                >
                  <div
                    className="w-8 h-8 rounded-lg border border-white/10"
                    style={{ background: theme.bg }}
                  />
                  <span className="text-[9px] text-gray-400 leading-none">{theme.emoji}</span>
                  <span className="text-[9px] text-gray-300 leading-none font-medium">{theme.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Accent color */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
              Accent Color
            </label>
            <div className="flex items-center gap-3">
              <div className="relative">
                <input
                  type="color"
                  value={settings.accentColor}
                  onChange={(e) => set("accentColor", e.target.value)}
                  className="w-10 h-10 rounded-lg border border-white/10 cursor-pointer bg-transparent p-0.5"
                  style={{ appearance: "none" }}
                />
              </div>
              <Input
                value={settings.accentColor}
                onChange={(e) => set("accentColor", e.target.value)}
                className="w-32 h-10 text-sm bg-white/5 border-white/10 text-white font-mono placeholder:text-gray-500 focus:border-orange-500/50"
                maxLength={7}
                placeholder="#f97316"
              />
              <div
                className="w-10 h-10 rounded-lg border border-white/10 flex-shrink-0"
                style={{ background: settings.accentColor }}
              />
            </div>
          </div>

          {/* Layout */}
          <div>
            <SectionHeader icon={<Layout size={14} />} label="Layout" />
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  key: "grid",
                  label: "Grid",
                  icon: (
                    <svg width="32" height="24" viewBox="0 0 32 24" fill="none">
                      <rect x="1" y="1" width="13" height="10" rx="2" fill="currentColor" opacity="0.5" />
                      <rect x="18" y="1" width="13" height="10" rx="2" fill="currentColor" opacity="0.5" />
                      <rect x="1" y="13" width="13" height="10" rx="2" fill="currentColor" opacity="0.5" />
                      <rect x="18" y="13" width="13" height="10" rx="2" fill="currentColor" opacity="0.5" />
                    </svg>
                  ),
                },
                {
                  key: "list",
                  label: "List",
                  icon: (
                    <svg width="32" height="24" viewBox="0 0 32 24" fill="none">
                      <rect x="1" y="1" width="30" height="6" rx="2" fill="currentColor" opacity="0.5" />
                      <rect x="1" y="9" width="30" height="6" rx="2" fill="currentColor" opacity="0.5" />
                      <rect x="1" y="17" width="30" height="6" rx="2" fill="currentColor" opacity="0.5" />
                    </svg>
                  ),
                },
                {
                  key: "featured",
                  label: "Featured",
                  icon: (
                    <svg width="32" height="24" viewBox="0 0 32 24" fill="none">
                      <rect x="1" y="1" width="30" height="12" rx="2" fill="currentColor" opacity="0.5" />
                      <rect x="1" y="15" width="13" height="8" rx="2" fill="currentColor" opacity="0.3" />
                      <rect x="18" y="15" width="13" height="8" rx="2" fill="currentColor" opacity="0.3" />
                    </svg>
                  ),
                },
              ].map(({ key, label, icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => set("layout", key)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                    settings.layout === key
                      ? "border-orange-500 ring-1 ring-orange-500/40 bg-orange-500/5 text-orange-400"
                      : "border-white/10 hover:border-white/20 bg-white/5 text-gray-400"
                  }`}
                >
                  {icon}
                  <span className="text-xs font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Profile */}
          <div>
            <SectionHeader icon={<User size={14} />} label="Profile" />
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Profile Image</label>
                <input ref={profileInputRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f, "profile"); e.target.value = ""; }} />
                {settings.profileImageUrl ? (
                  <div className="flex items-center gap-2">
                    <img src={settings.profileImageUrl} alt="Profile" className="w-10 h-10 rounded-full object-cover border border-white/10 flex-shrink-0" />
                    <span className="text-xs text-gray-400 flex-1 truncate">{settings.profileImageUrl.split("/").pop()}</span>
                    <button onClick={() => set("profileImageUrl", null)} className="text-gray-500 hover:text-red-400 transition-colors flex-shrink-0"><X size={14} /></button>
                  </div>
                ) : (
                  <Button type="button" variant="outline" size="sm" onClick={() => profileInputRef.current?.click()}
                    disabled={uploadingProfile}
                    className="w-full border-white/10 text-gray-300 hover:text-white hover:border-orange-500/50 bg-white/5">
                    {uploadingProfile ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Upload size={14} className="mr-1.5" />}
                    {uploadingProfile ? "Uploading…" : "Upload from device"}
                  </Button>
                )}
                <p className="text-xs text-gray-600 mt-1.5">Or paste a URL:</p>
                <Input value={settings.profileImageUrl ?? ""} onChange={(e) => set("profileImageUrl", e.target.value || null)}
                  className="h-8 text-xs bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-orange-500/50 mt-1"
                  placeholder="https://example.com/avatar.jpg" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">
                  Bio{" "}
                  <span className="text-gray-600">
                    ({(settings.bio ?? "").length}/200)
                  </span>
                </label>
                <textarea
                  value={settings.bio ?? ""}
                  onChange={(e) => set("bio", e.target.value.slice(0, 200) || null)}
                  rows={3}
                  maxLength={200}
                  className="w-full rounded-lg border border-white/10 bg-white/5 text-white text-sm px-3 py-2 placeholder:text-gray-500 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 resize-none"
                  placeholder="Tell your audience who you are..."
                />
              </div>
            </div>
          </div>

          {/* Banner */}
          <div>
            <SectionHeader icon={<ImageIcon size={14} />} label="Banner" />
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">
                  Banner Image <span className="text-gray-600 font-normal">(takes priority over gradient)</span>
                </label>
                <input ref={bannerInputRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f, "banner"); e.target.value = ""; }} />
                {settings.bannerImageUrl ? (
                  <div className="relative rounded-lg overflow-hidden border border-white/10 mb-2">
                    <img src={settings.bannerImageUrl} alt="Banner" className="w-full h-20 object-cover" />
                    <button onClick={() => set("bannerImageUrl", null)}
                      className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition-colors">
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <Button type="button" variant="outline" size="sm" onClick={() => bannerInputRef.current?.click()}
                    disabled={uploadingBanner}
                    className="w-full border-white/10 text-gray-300 hover:text-white hover:border-orange-500/50 bg-white/5 mb-2">
                    {uploadingBanner ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Upload size={14} className="mr-1.5" />}
                    {uploadingBanner ? "Uploading…" : "Upload from device"}
                  </Button>
                )}
                <p className="text-xs text-gray-600 mt-1.5">Or paste a URL:</p>
                <Input value={settings.bannerImageUrl ?? ""} onChange={(e) => set("bannerImageUrl", e.target.value || null)}
                  className="h-8 text-xs bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-orange-500/50 mt-1"
                  placeholder="https://example.com/banner.jpg" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-2">Or choose a gradient</label>
                <div className="grid grid-cols-6 gap-2">
                  {GRADIENTS.map((g) => (
                    <button
                      key={g.value}
                      type="button"
                      title={g.label}
                      onClick={() => set("bannerGradient", g.value)}
                      className={`w-full aspect-square rounded-lg border-2 transition-all ${
                        settings.bannerGradient === g.value && !settings.bannerImageUrl
                          ? "border-white ring-1 ring-white/40 scale-105"
                          : "border-transparent hover:border-white/40"
                      }`}
                      style={{ background: g.preview }}
                    />
                  ))}
                </div>
                {settings.bannerGradient && (
                  <button
                    type="button"
                    onClick={() => set("bannerGradient", null)}
                    className="mt-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    Clear gradient
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Save button (bottom) */}
          <div className="pb-4">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "Saving..." : "Save Changes"}
            </Button>
            <p className="text-xs text-gray-500 text-center mt-2">
              Changes apply to your public store at{" "}
              <Link
                href={`/c/${userId}`}
                target="_blank"
                className="text-orange-400 hover:text-orange-300"
              >
                /c/{userId}
              </Link>
            </p>
          </div>
        </div>

        {/* Right panel — live preview */}
        <div className="flex-1 bg-[#111118] overflow-y-auto flex flex-col">
          <div className="flex items-center gap-2 px-6 py-3 border-b border-white/10">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-gray-400 font-medium">Live Preview</span>
            <span className="text-xs text-gray-600 ml-auto">Updates as you change settings</span>
          </div>
          <div className="flex-1 p-6 flex items-start justify-center">
            <div
              className="w-full shadow-2xl overflow-hidden"
              style={{
                maxWidth: "360px",
                transform: "scale(1)",
                transformOrigin: "top center",
                borderRadius: "16px",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <StorePreview settings={settings} brandName={brandName} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
