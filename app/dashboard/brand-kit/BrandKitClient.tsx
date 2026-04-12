"use client";

import { useState, useEffect, useCallback } from "react";
import { Palette, Save, Check, Loader2, Home, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import Link from "next/link";

const FONTS = [
  "Inter",
  "Poppins",
  "Bebas Neue",
  "Playfair Display",
  "Raleway",
  "Oswald",
  "Montserrat",
  "Space Grotesk",
  "DM Sans",
  "Syne",
];

type BrandProfile = {
  brandName?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor?: string;
  primaryFont?: string;
  logoUrl?: string;
};

function ColorSwatch({
  label,
  value,
  onChange,
  description,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  description: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs text-gray-500 dark:text-[#A0A0A0] font-medium uppercase tracking-wide">
        {label}
      </Label>
      <div className="flex items-center gap-3">
        <div className="relative">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-12 h-12 rounded-xl cursor-pointer border-0 p-0.5 bg-transparent"
            style={{ colorScheme: "dark" }}
          />
        </div>
        <div className="flex-1 space-y-1">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="#000000"
            className="bg-gray-50 dark:bg-[#111] border-gray-200 dark:border-[#2A2A2A] font-mono text-sm h-9"
          />
          <p className="text-[11px] text-gray-400">{description}</p>
        </div>
      </div>
    </div>
  );
}

export default function BrandKitClient() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { toast } = useToast();

  const [brandName, setBrandName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#1a1a1a");
  const [secondaryColor, setSecondaryColor] = useState("#475569");
  const [accentColor, setAccentColor] = useState("#f97316");
  const [primaryFont, setPrimaryFont] = useState("Inter");
  const [logoUrl, setLogoUrl] = useState("");

  useEffect(() => {
    fetch("/api/brand-profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: BrandProfile | null) => {
        if (data) {
          setBrandName(data.brandName ?? "");
          setPrimaryColor(data.primaryColor ?? "#1a1a1a");
          setSecondaryColor(data.secondaryColor ?? "#475569");
          setAccentColor(data.accentColor ?? "#f97316");
          setPrimaryFont(data.primaryFont ?? "Inter");
          setLogoUrl(data.logoUrl ?? "");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/brand-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primaryColor, secondaryColor, accentColor, primaryFont }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      toast({ title: "Brand kit saved ✓" });
    } catch {
      toast({ title: "Error", description: "Failed to save brand kit", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [primaryColor, secondaryColor, accentColor, primaryFont, toast]);

  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-[#A0A0A0] mb-8">
          <Link href="/dashboard" className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-white transition-colors">
            <Home className="w-4 h-4" />
            Dashboard
          </Link>
          <ChevronRight className="w-4 h-4 text-gray-400 dark:text-[#666]" />
          <span className="text-gray-900 dark:text-white">Brand Kit</span>
        </nav>

        <div className="flex items-center gap-3 mb-2">
          <Palette className="w-7 h-7 text-orange-500" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Brand Kit</h1>
        </div>
        <p className="text-gray-500 dark:text-[#A0A0A0] mb-10">
          Your colours and font — used across AI-generated designs, mockups, and captions.
        </p>

        {loading ? (
          <div className="flex items-center gap-2 text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="grid lg:grid-cols-[1fr_340px] gap-8">
            {/* Left: controls */}
            <div className="space-y-8">
              {/* Colours */}
              <div className="rounded-2xl border border-gray-100 dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] p-6 space-y-6">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-widest">
                  Colours
                </h2>
                <ColorSwatch
                  label="Primary"
                  value={primaryColor}
                  onChange={setPrimaryColor}
                  description="Main brand colour — buttons, headings, key elements"
                />
                <ColorSwatch
                  label="Secondary"
                  value={secondaryColor}
                  onChange={setSecondaryColor}
                  description="Supporting colour — subtext, borders, backgrounds"
                />
                <ColorSwatch
                  label="Accent"
                  value={accentColor}
                  onChange={setAccentColor}
                  description="Pop colour — highlights, badges, CTAs"
                />
              </div>

              {/* Font */}
              <div className="rounded-2xl border border-gray-100 dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] p-6 space-y-4">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-widest">
                  Typography
                </h2>
                <div className="space-y-2">
                  <Label className="text-xs text-gray-500 dark:text-[#A0A0A0] font-medium uppercase tracking-wide">
                    Primary Font
                  </Label>
                  <select
                    value={primaryFont}
                    onChange={(e) => setPrimaryFont(e.target.value)}
                    className="w-full h-10 rounded-lg border border-gray-200 dark:border-[#2A2A2A] bg-gray-50 dark:bg-[#111] text-gray-900 dark:text-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                  >
                    {FONTS.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-gray-400">Used in Design Studio and AI-generated graphics</p>
                </div>
              </div>

              {/* Logo */}
              <div className="rounded-2xl border border-gray-100 dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] p-6 space-y-4">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-widest">
                  Logo
                </h2>
                {logoUrl ? (
                  <div className="flex items-center gap-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoUrl} alt="Brand logo" className="w-16 h-16 object-contain rounded-xl border border-gray-200 dark:border-[#2A2A2A] bg-gray-50 dark:bg-[#111] p-2" />
                    <div>
                      <p className="text-sm text-gray-700 dark:text-gray-300">Logo saved</p>
                      <p className="text-xs text-gray-400 mt-0.5">Update your logo in Brand Builder → Settings</p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-[#2A2A2A] p-6 text-center">
                    <p className="text-sm text-gray-500 dark:text-[#A0A0A0]">No logo uploaded yet</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Upload your logo in{" "}
                      <Link href="/dashboard/brand-builder" className="text-orange-500 hover:underline">
                        Brand Builder
                      </Link>
                    </p>
                  </div>
                )}
              </div>

              <Button
                onClick={save}
                disabled={saving}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold h-12 gap-2"
              >
                {saving ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Saving…</>
                ) : saved ? (
                  <><Check className="w-4 h-4" />Saved!</>
                ) : (
                  <><Save className="w-4 h-4" />Save Brand Kit</>
                )}
              </Button>
            </div>

            {/* Right: live preview */}
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-widest text-gray-400 font-semibold">Live Preview</p>
              <div
                className="rounded-2xl overflow-hidden border border-gray-100 dark:border-[#2A2A2A]"
                style={{ fontFamily: `'${primaryFont}', sans-serif` }}
              >
                {/* Hero block */}
                <div
                  className="p-8 text-white"
                  style={{ backgroundColor: primaryColor }}
                >
                  <div
                    className="inline-block text-xs font-bold px-3 py-1 rounded-full mb-4"
                    style={{ backgroundColor: accentColor }}
                  >
                    NEW DROP
                  </div>
                  <h3 className="text-2xl font-bold leading-tight mb-2">
                    {brandName || "Your Brand"}
                  </h3>
                  <p className="text-sm opacity-75">Building quietly. Dropping soon.</p>
                </div>
                {/* Body block */}
                <div
                  className="p-5 space-y-3"
                  style={{ backgroundColor: secondaryColor + "15" }}
                >
                  <div className="h-2 rounded-full w-3/4" style={{ backgroundColor: primaryColor, opacity: 0.3 }} />
                  <div className="h-2 rounded-full w-1/2" style={{ backgroundColor: primaryColor, opacity: 0.2 }} />
                  <div
                    className="mt-4 inline-block text-xs font-semibold px-4 py-2 rounded-lg text-white"
                    style={{ backgroundColor: accentColor }}
                  >
                    Shop Now
                  </div>
                </div>
              </div>

              {/* Colour chips */}
              <div className="flex gap-2 pt-1">
                {[
                  { color: primaryColor, label: "Primary" },
                  { color: secondaryColor, label: "Secondary" },
                  { color: accentColor, label: "Accent" },
                ].map(({ color, label }) => (
                  <div key={label} className="flex-1 text-center">
                    <div
                      className="h-10 rounded-lg w-full mb-1"
                      style={{ backgroundColor: color }}
                    />
                    <p className="text-[10px] text-gray-400">{label}</p>
                    <p className="text-[10px] font-mono text-gray-500">{color}</p>
                  </div>
                ))}
              </div>

              {/* Font preview */}
              <div className="rounded-xl border border-gray-100 dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] p-4">
                <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-2">Font: {primaryFont}</p>
                <p
                  className="text-2xl font-bold text-gray-900 dark:text-white"
                  style={{ fontFamily: `'${primaryFont}', sans-serif` }}
                >
                  The quick brown fox
                </p>
                <p
                  className="text-sm text-gray-500 mt-1"
                  style={{ fontFamily: `'${primaryFont}', sans-serif` }}
                >
                  Aa Bb Cc Dd Ee Ff
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
