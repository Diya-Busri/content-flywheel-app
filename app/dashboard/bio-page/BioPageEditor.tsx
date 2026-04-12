"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Link2,
  Save,
  Check,
  Loader2,
  Plus,
  Trash2,
  Copy,
  ExternalLink,
  Home,
  ChevronRight,
  Users,
  Mail,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import Link from "next/link";

type BioLink = { label: string; url: string };
type BioPage = {
  id?: string;
  slug: string;
  title: string;
  bio: string;
  avatarUrl?: string;
  primaryColor: string;
  links: BioLink[];
  showWaitlist: boolean;
  waitlistCta: string;
  isPublished: boolean;
};
type WaitlistEntry = { id: string; email: string; name?: string; createdAt: string };

const BASE_URL = typeof window !== "undefined" ? window.location.origin : "https://contentflywheel.com";

function BioPreview({ page }: { page: BioPage }) {
  const initials = page.title ? page.title.slice(0, 2).toUpperCase() : "??";
  return (
    <div
      className="rounded-2xl overflow-hidden min-h-[500px] flex flex-col"
      style={{ background: `linear-gradient(135deg, #0a0a0a 0%, #111111 100%)` }}
    >
      {/* Color bar */}
      <div className="h-1.5 w-full" style={{ backgroundColor: page.primaryColor }} />

      <div className="flex-1 p-8 flex flex-col items-center">
        {/* Avatar */}
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-4 mt-4"
          style={{ backgroundColor: page.primaryColor }}
        >
          {initials}
        </div>

        {/* Title */}
        <h1 className="text-xl font-bold text-white mb-1 text-center">
          {page.title || "Your Brand Name"}
        </h1>

        {/* Bio */}
        {page.bio && (
          <p className="text-sm text-gray-400 mb-6 text-center max-w-xs leading-relaxed">
            {page.bio}
          </p>
        )}

        {/* Links */}
        <div className="w-full max-w-xs space-y-3 mb-6">
          {page.links.length > 0 ? (
            page.links.map((link, i) => (
              <div
                key={i}
                className="w-full py-3 px-5 rounded-xl text-sm font-semibold text-center text-white"
                style={{ backgroundColor: page.primaryColor }}
              >
                {link.label || "Link"}
              </div>
            ))
          ) : (
            <div className="w-full py-3 px-5 rounded-xl text-sm font-semibold text-center text-white opacity-40"
              style={{ backgroundColor: page.primaryColor }}>
              Your link here
            </div>
          )}
        </div>

        {/* Waitlist */}
        {page.showWaitlist && (
          <div className="w-full max-w-xs mt-auto pt-6 border-t border-white/10">
            <p className="text-xs text-gray-400 text-center mb-3">{page.waitlistCta || "Be first to know when we drop"}</p>
            <div className="flex gap-2">
              <div className="flex-1 h-9 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-500 px-3 flex items-center">
                your@email.com
              </div>
              <div
                className="px-4 h-9 rounded-lg text-xs font-semibold text-white flex items-center"
                style={{ backgroundColor: page.primaryColor }}
              >
                Join
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function BioPageEditor() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<"edit" | "waitlist">("edit");
  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistEntry[]>([]);
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const [page, setPage] = useState<BioPage>({
    slug: "",
    title: "",
    bio: "",
    primaryColor: "#f97316",
    links: [],
    showWaitlist: true,
    waitlistCta: "Be first to know when we drop",
    isPublished: false,
  });

  useEffect(() => {
    fetch("/api/bio-page")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setPage({
            id: data.id,
            slug: data.slug ?? "",
            title: data.title ?? "",
            bio: data.bio ?? "",
            avatarUrl: data.avatarUrl ?? "",
            primaryColor: data.primaryColor ?? "#f97316",
            links: (() => { try { return JSON.parse(data.links ?? "[]"); } catch { return []; } })(),
            showWaitlist: data.showWaitlist ?? true,
            waitlistCta: data.waitlistCta ?? "Be first to know when we drop",
            isPublished: data.isPublished ?? false,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const loadWaitlist = useCallback(async () => {
    setWaitlistLoading(true);
    try {
      const res = await fetch("/api/bio-page/waitlist");
      const data = await res.json() as { entries: WaitlistEntry[] };
      setWaitlistEntries(data.entries ?? []);
    } catch {
      toast({ title: "Error", description: "Failed to load waitlist", variant: "destructive" });
    } finally {
      setWaitlistLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (activeTab === "waitlist") void loadWaitlist();
  }, [activeTab, loadWaitlist]);

  const save = useCallback(async () => {
    if (!page.slug) { toast({ title: "Slug required", description: "Enter a URL slug for your page", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/bio-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...page }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      toast({ title: "Bio page saved ✓" });
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [page, toast]);

  const addLink = () => {
    if (page.links.length >= 6) return;
    setPage((p) => ({ ...p, links: [...p.links, { label: "", url: "" }] }));
  };

  const updateLink = (i: number, field: "label" | "url", value: string) => {
    setPage((p) => {
      const links = [...p.links];
      links[i] = { ...links[i], [field]: value };
      return { ...p, links };
    });
  };

  const removeLink = (i: number) => {
    setPage((p) => ({ ...p, links: p.links.filter((_, idx) => idx !== i) }));
  };

  const publicUrl = `${BASE_URL}/bio/${page.slug}`;

  const copyUrl = () => {
    navigator.clipboard.writeText(publicUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="max-w-5xl mx-auto">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-[#A0A0A0] mb-8">
          <Link href="/dashboard" className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-white transition-colors">
            <Home className="w-4 h-4" />
            Dashboard
          </Link>
          <ChevronRight className="w-4 h-4 text-gray-400 dark:text-[#666]" />
          <span className="text-gray-900 dark:text-white">Link in Bio</span>
        </nav>

        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Link2 className="w-7 h-7 text-orange-500" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Link in Bio</h1>
          </div>
          {page.slug && (
            <div className="flex items-center gap-2">
              <button
                onClick={copyUrl}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-[#2A2A2A] px-3 py-1.5 rounded-lg transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                {page.slug ? `/bio/${page.slug}` : "Set a slug first"}
              </button>
              {page.isPublished && page.slug && (
                <a
                  href={`/bio/${page.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-orange-500 hover:text-orange-600 border border-orange-200 dark:border-orange-900/40 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View live
                </a>
              )}
            </div>
          )}
        </div>
        <p className="text-gray-500 dark:text-[#A0A0A0] mb-8">
          One link for your TikTok and Instagram bio — hoodie pre-order, email waitlist, social links.
        </p>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 border-b border-gray-200 dark:border-[#2A2A2A]">
          {([["edit", "Edit Page"], ["waitlist", "Email Waitlist"]] as const).map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === tab
                  ? "border-orange-500 text-orange-500"
                  : "border-transparent text-gray-500 dark:text-[#A0A0A0] hover:text-gray-700 dark:hover:text-white"
              }`}
            >
              {tab === "waitlist" && waitlistEntries.length > 0 && (
                <span className="mr-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-full bg-orange-500 text-white">
                  {waitlistEntries.length > 9 ? "9+" : waitlistEntries.length}
                </span>
              )}
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-gray-400 py-12 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : activeTab === "edit" ? (
          <div className="grid lg:grid-cols-[1fr_320px] gap-8">
            {/* Left: form */}
            <div className="space-y-6">
              {/* Slug + publish */}
              <div className="rounded-2xl border border-gray-100 dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] p-5 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-500 font-medium uppercase tracking-wide">Your URL slug</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400 whitespace-nowrap">contentflywheel.com/bio/</span>
                    <Input
                      placeholder="voidhours"
                      value={page.slug}
                      onChange={(e) => setPage((p) => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))}
                      className="bg-gray-50 dark:bg-[#111] border-gray-200 dark:border-[#2A2A2A] font-mono"
                    />
                  </div>
                  <p className="text-[11px] text-gray-400">Lowercase letters, numbers, hyphens only (3–30 chars)</p>
                </div>

                {/* Publish toggle */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-[#2A2A2A]">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Published</p>
                    <p className="text-xs text-gray-400">Make this page publicly visible</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPage((p) => ({ ...p, isPublished: !p.isPublished }))}
                    className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
                      page.isPublished
                        ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900/40 text-green-600"
                        : "bg-gray-50 dark:bg-[#111] border-gray-200 dark:border-[#2A2A2A] text-gray-400"
                    }`}
                  >
                    {page.isPublished ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    {page.isPublished ? "Live" : "Hidden"}
                  </button>
                </div>
              </div>

              {/* Profile */}
              <div className="rounded-2xl border border-gray-100 dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] p-5 space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-widest">Profile</h3>
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-500">Brand name</Label>
                  <Input
                    placeholder="Void Hours"
                    value={page.title}
                    onChange={(e) => setPage((p) => ({ ...p, title: e.target.value }))}
                    className="bg-gray-50 dark:bg-[#111] border-gray-200 dark:border-[#2A2A2A]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-500">Tagline</Label>
                  <Input
                    placeholder="Building quietly. Dropping soon."
                    value={page.bio}
                    onChange={(e) => setPage((p) => ({ ...p, bio: e.target.value }))}
                    className="bg-gray-50 dark:bg-[#111] border-gray-200 dark:border-[#2A2A2A]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-500">Accent colour</Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={page.primaryColor}
                      onChange={(e) => setPage((p) => ({ ...p, primaryColor: e.target.value }))}
                      className="w-10 h-10 rounded-lg cursor-pointer border-0 p-0.5 bg-transparent"
                    />
                    <Input
                      value={page.primaryColor}
                      onChange={(e) => setPage((p) => ({ ...p, primaryColor: e.target.value }))}
                      className="bg-gray-50 dark:bg-[#111] border-gray-200 dark:border-[#2A2A2A] font-mono w-32"
                    />
                  </div>
                </div>
              </div>

              {/* Links */}
              <div className="rounded-2xl border border-gray-100 dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-widest">Links</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addLink}
                    disabled={page.links.length >= 6}
                    className="gap-1 text-xs h-7"
                  >
                    <Plus className="w-3 h-3" />
                    Add link
                  </Button>
                </div>
                {page.links.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">
                    No links yet. Add a link to get started.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {page.links.map((link, i) => (
                      <div key={i} className="flex gap-2 items-start">
                        <div className="flex-1 space-y-2">
                          <Input
                            placeholder="Label (e.g. Pre-order hoodie)"
                            value={link.label}
                            onChange={(e) => updateLink(i, "label", e.target.value)}
                            className="bg-gray-50 dark:bg-[#111] border-gray-200 dark:border-[#2A2A2A] text-sm"
                          />
                          <Input
                            placeholder="https://..."
                            value={link.url}
                            onChange={(e) => updateLink(i, "url", e.target.value)}
                            className="bg-gray-50 dark:bg-[#111] border-gray-200 dark:border-[#2A2A2A] text-sm font-mono"
                          />
                        </div>
                        <button
                          onClick={() => removeLink(i)}
                          className="mt-1 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-md transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Waitlist settings */}
              <div className="rounded-2xl border border-gray-100 dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-widest">Email Waitlist</h3>
                  <button
                    type="button"
                    onClick={() => setPage((p) => ({ ...p, showWaitlist: !p.showWaitlist }))}
                    className={`text-xs font-medium px-3 py-1 rounded-full border transition-all ${
                      page.showWaitlist
                        ? "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900/40 text-orange-500"
                        : "bg-gray-50 dark:bg-[#111] border-gray-200 dark:border-[#2A2A2A] text-gray-400"
                    }`}
                  >
                    {page.showWaitlist ? "On" : "Off"}
                  </button>
                </div>
                {page.showWaitlist && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500">CTA text</Label>
                    <Input
                      placeholder="Be first to know when we drop"
                      value={page.waitlistCta}
                      onChange={(e) => setPage((p) => ({ ...p, waitlistCta: e.target.value }))}
                      className="bg-gray-50 dark:bg-[#111] border-gray-200 dark:border-[#2A2A2A]"
                    />
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
                  <><Save className="w-4 h-4" />Save Page</>
                )}
              </Button>
            </div>

            {/* Right: preview */}
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-widest text-gray-400 font-semibold">Live Preview</p>
              <BioPreview page={page} />
            </div>
          </div>
        ) : (
          /* Waitlist tab */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-orange-500" />
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  {waitlistEntries.length} {waitlistEntries.length === 1 ? "subscriber" : "subscribers"}
                </h2>
              </div>
              <Button variant="outline" size="sm" onClick={loadWaitlist} disabled={waitlistLoading} className="gap-1.5 text-xs">
                <Loader2 className={`w-3.5 h-3.5 ${waitlistLoading ? "animate-spin" : "hidden"}`} />
                Refresh
              </Button>
            </div>

            {waitlistLoading ? (
              <div className="flex items-center gap-2 text-gray-400 py-8 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading…
              </div>
            ) : waitlistEntries.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 dark:border-[#2A2A2A] p-10 text-center">
                <Mail className="w-8 h-8 text-gray-300 dark:text-[#444] mx-auto mb-3" />
                <p className="text-gray-500 dark:text-[#A0A0A0] text-sm">No emails yet.</p>
                <p className="text-gray-400 text-xs mt-1">
                  {page.isPublished
                    ? "Share your link-in-bio URL to start collecting emails."
                    : "Publish your page first, then share it on TikTok and Instagram."}
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-gray-100 dark:border-[#2A2A2A] overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-[#111]">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-[#2A2A2A]">
                    {waitlistEntries.map((entry) => (
                      <tr key={entry.id} className="bg-white dark:bg-[#1A1A1A] hover:bg-gray-50 dark:hover:bg-[#222] transition-colors">
                        <td className="px-4 py-3 text-gray-900 dark:text-white font-mono text-xs">{entry.email}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{entry.name || "—"}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">
                          {new Date(entry.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
