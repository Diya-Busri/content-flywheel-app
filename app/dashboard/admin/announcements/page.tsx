"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, RefreshCw, Megaphone, X } from "lucide-react";

type AnnouncementType = "info" | "warning" | "success" | "promo";

type Announcement = {
  id: string;
  title: string;
  message: string;
  type: AnnouncementType;
  linkUrl: string | null;
  linkLabel: string | null;
  expiresAt: string | null;
  active: boolean;
  createdAt: string;
};

const TYPE_STYLES: Record<AnnouncementType, { badge: string; label: string }> = {
  info:    { badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",    label: "Info" },
  warning: { badge: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300", label: "Warning" },
  success: { badge: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",  label: "Success" },
  promo:   { badge: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300", label: "Promo" },
};

type Toast = { msg: string; ok: boolean };

export default function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<AnnouncementType>("info");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/announcements");
      const data = (await res.json().catch(() => ({}))) as { announcements?: Announcement[] };
      setAnnouncements(data.announcements ?? []);
    } catch {
      showToast("Failed to load announcements", false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function toggleActive(ann: Announcement) {
    setToggling(ann.id);
    try {
      const res = await fetch(`/api/admin/announcements/${ann.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !ann.active }),
      });
      const data = (await res.json().catch(() => ({}))) as { announcement?: Announcement };
      if (data.announcement) {
        setAnnouncements((prev) => prev.map((a) => a.id === ann.id ? data.announcement! : a));
      } else {
        // Optimistic fallback
        setAnnouncements((prev) => prev.map((a) => a.id === ann.id ? { ...a, active: !a.active } : a));
      }
    } catch {
      showToast("Failed to toggle announcement", false);
    } finally {
      setToggling(null);
    }
  }

  async function deleteAnn(id: string) {
    setDeleting(id);
    try {
      await fetch(`/api/admin/announcements/${id}`, { method: "DELETE" });
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
      showToast("Announcement deleted", true);
    } catch {
      showToast("Failed to delete", false);
    } finally {
      setDeleting(null);
    }
  }

  async function createAnnouncement() {
    if (!title.trim() || !message.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          type,
          linkUrl: linkUrl.trim() || null,
          linkLabel: linkLabel.trim() || null,
          expiresAt: expiresAt || null,
          active: true,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { announcement?: Announcement };
      if (data.announcement) {
        setAnnouncements((prev) => [data.announcement!, ...prev]);
        setTitle(""); setMessage(""); setType("info");
        setLinkUrl(""); setLinkLabel(""); setExpiresAt("");
        setShowForm(false);
        showToast("Announcement created", true);
      } else {
        showToast("Failed to create announcement", false);
      }
    } catch {
      showToast("Failed to create announcement", false);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
            toast.ok
              ? "bg-green-500 text-white"
              : "bg-red-500 text-white"
          }`}
        >
          {toast.msg}
          <button onClick={() => setToast(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Announcements</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage banners shown to users across the app</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            className="bg-orange-500 hover:bg-orange-600 text-white"
            onClick={() => setShowForm((v) => !v)}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Announcement
          </Button>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <Card className="border-orange-400/40 bg-orange-500/5">
          <CardContent className="pt-5 pb-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm text-gray-900 dark:text-white">New Announcement</p>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Title *</Label>
                <Input
                  placeholder="e.g. New feature available!"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-card dark:border-white/10"
                  value={type}
                  onChange={(e) => setType(e.target.value as AnnouncementType)}
                >
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="success">Success</option>
                  <option value="promo">Promo</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Message *</Label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-card dark:border-white/10 min-h-[80px] resize-y"
                placeholder="Announcement message shown to users…"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Link URL (optional)</Label>
                <Input
                  placeholder="https://…"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Link Label (optional)</Label>
                <Input
                  placeholder="Learn more"
                  value={linkLabel}
                  onChange={(e) => setLinkLabel(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Expires At (optional)</Label>
                <Input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="dark:[color-scheme:dark]"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                className="bg-orange-500 hover:bg-orange-600 text-white"
                disabled={creating || !title.trim() || !message.trim()}
                onClick={() => void createAnnouncement()}
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {creating ? "Creating…" : "Create Announcement"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : announcements.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <Megaphone className="w-10 h-10 opacity-30" />
          <p className="text-sm">No announcements yet. Create one above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((ann) => {
            const typeStyle = TYPE_STYLES[ann.type] ?? TYPE_STYLES.info;
            return (
              <Card key={ann.id} className={`transition-opacity ${ann.active ? "" : "opacity-60"}`}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-4">
                    {/* Toggle */}
                    <div className="pt-0.5 shrink-0">
                      <Switch
                        checked={ann.active}
                        disabled={toggling === ann.id}
                        onCheckedChange={() => void toggleActive(ann)}
                      />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-gray-900 dark:text-white">{ann.title}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${typeStyle.badge}`}>
                          {typeStyle.label}
                        </span>
                        {ann.active ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{ann.message}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5 text-xs text-muted-foreground">
                        <span>Created {new Date(ann.createdAt).toLocaleDateString()}</span>
                        {ann.expiresAt && (
                          <span>Expires {new Date(ann.expiresAt).toLocaleDateString()}</span>
                        )}
                        {ann.linkUrl && (
                          <a
                            href={ann.linkUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-orange-500 hover:underline"
                          >
                            {ann.linkLabel ?? ann.linkUrl}
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Delete */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive shrink-0 -mr-1"
                      disabled={deleting === ann.id}
                      onClick={() => void deleteAnn(ann.id)}
                    >
                      {deleting === ann.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
