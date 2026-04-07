"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Trash2, RefreshCw, Globe, User } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";

type Flag = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  enabled: boolean;
  userId: string | null;
  createdAt: string;
};

export default function AdminFeatureFlagsPage() {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newUserId, setNewUserId] = useState("");
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/feature-flags");
    const data = (await res.json().catch(() => ({}))) as { flags?: Flag[] };
    setFlags(data.flags ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function toggleFlag(flag: Flag) {
    setSaving(flag.id);
    const res = await fetch(`/api/admin/feature-flags/${flag.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !flag.enabled }),
    });
    const data = (await res.json().catch(() => ({}))) as { flag?: Flag };
    if (data.flag) {
      setFlags((prev) => prev.map((f) => f.id === flag.id ? data.flag! : f));
    }
    setSaving(null);
  }

  async function deleteFlag(id: string) {
    setDeleting(id);
    await fetch(`/api/admin/feature-flags/${id}`, { method: "DELETE" });
    setFlags((prev) => prev.filter((f) => f.id !== id));
    setDeleting(null);
    toast({ title: "Flag deleted" });
  }

  async function createFlag() {
    if (!newKey.trim() || !newLabel.trim()) return;
    setCreating(true);
    const res = await fetch("/api/admin/feature-flags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: newKey.trim(), label: newLabel.trim(), description: newDesc.trim() || null, userId: newUserId.trim() || null, enabled: false }),
    });
    const data = (await res.json().catch(() => ({}))) as { flag?: Flag };
    if (data.flag) {
      setFlags((prev) => [...prev, data.flag!]);
      setNewKey(""); setNewLabel(""); setNewDesc(""); setNewUserId("");
      setShowNew(false);
      toast({ title: "Flag created" });
    }
    setCreating(false);
  }

  const globalFlags = flags.filter((f) => !f.userId);
  const userFlags = flags.filter((f) => f.userId);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Feature Flags</h1>
          <p className="text-sm text-muted-foreground mt-1">Toggle features on/off globally or per user</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white" onClick={() => setShowNew(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Flag
          </Button>
        </div>
      </div>

      {/* New flag form */}
      {showNew && (
        <Card className="border-orange-400/40 bg-orange-500/5">
          <CardContent className="pt-4 pb-4 space-y-3">
            <p className="font-medium text-sm">New Feature Flag</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Key (e.g. new_dashboard)</Label>
                <Input placeholder="feature_key" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Label</Label>
                <Input placeholder="New Dashboard" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Description (optional)</Label>
                <Input placeholder="What this flag controls" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">User ID (blank = global)</Label>
                <Input placeholder="user_abc123 or leave blank" value={newUserId} onChange={(e) => setNewUserId(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white" disabled={creating || !newKey || !newLabel} onClick={() => void createFlag()}>
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* Global flags */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Globe className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Global Flags</h2>
            </div>
            {globalFlags.length === 0 ? (
              <p className="text-sm text-muted-foreground pl-6">No global flags yet.</p>
            ) : (
              <div className="space-y-2">
                {globalFlags.map((flag) => (
                  <Card key={flag.id}>
                    <CardContent className="pt-3 pb-3">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <Switch
                            checked={flag.enabled}
                            disabled={saving === flag.id}
                            onCheckedChange={() => void toggleFlag(flag)}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{flag.label}</span>
                              <Badge variant="outline" className="text-[10px] font-mono">{flag.key}</Badge>
                              <Badge variant={flag.enabled ? "default" : "secondary"} className="text-[10px]">
                                {flag.enabled ? "ON" : "OFF"}
                              </Badge>
                            </div>
                            {flag.description && <p className="text-xs text-muted-foreground mt-0.5">{flag.description}</p>}
                          </div>
                        </div>
                        <Button
                          variant="ghost" size="sm"
                          className="text-destructive hover:text-destructive shrink-0"
                          disabled={deleting === flag.id}
                          onClick={() => void deleteFlag(flag.id)}
                        >
                          {deleting === flag.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Per-user flags */}
          {userFlags.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <User className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Per-User Flags</h2>
              </div>
              <div className="space-y-2">
                {userFlags.map((flag) => (
                  <Card key={flag.id}>
                    <CardContent className="pt-3 pb-3">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <Switch
                            checked={flag.enabled}
                            disabled={saving === flag.id}
                            onCheckedChange={() => void toggleFlag(flag)}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{flag.label}</span>
                              <Badge variant="outline" className="text-[10px] font-mono">{flag.key}</Badge>
                              <Badge variant={flag.enabled ? "default" : "secondary"} className="text-[10px]">{flag.enabled ? "ON" : "OFF"}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 font-mono">{flag.userId}</p>
                          </div>
                        </div>
                        <Button
                          variant="ghost" size="sm"
                          className="text-destructive hover:text-destructive shrink-0"
                          disabled={deleting === flag.id}
                          onClick={() => void deleteFlag(flag.id)}
                        >
                          {deleting === flag.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
