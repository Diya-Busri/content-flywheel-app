"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, RefreshCw, Copy, Check, Tag, Shuffle, X } from "lucide-react";

type DiscountType = "percent" | "fixed";

type PromoCode = {
  id: string;
  code: string;
  description: string | null;
  discountType: DiscountType;
  discountValue: number;
  maxUses: number | null;
  usedCount: number;
  active: boolean;
  expiresAt: string | null;
  createdAt: string;
};

type Toast = { msg: string; ok: boolean };

function generateRandomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export default function AdminPromoCodesPage() {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  // Form state
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState<DiscountType>("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/promo-codes");
      const data = (await res.json().catch(() => ({}))) as { codes?: PromoCode[] };
      setCodes(data.codes ?? []);
    } catch {
      showToast("Failed to load promo codes", false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function toggleActive(pc: PromoCode) {
    setToggling(pc.id);
    try {
      const res = await fetch(`/api/admin/promo-codes/${pc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !pc.active }),
      });
      const data = (await res.json().catch(() => ({}))) as { code?: PromoCode };
      if (data.code) {
        setCodes((prev) => prev.map((c) => c.id === pc.id ? data.code! : c));
      } else {
        setCodes((prev) => prev.map((c) => c.id === pc.id ? { ...c, active: !c.active } : c));
      }
    } catch {
      showToast("Failed to update", false);
    } finally {
      setToggling(null);
    }
  }

  async function deleteCode(id: string) {
    setDeleting(id);
    try {
      await fetch(`/api/admin/promo-codes/${id}`, { method: "DELETE" });
      setCodes((prev) => prev.filter((c) => c.id !== id));
      showToast("Promo code deleted", true);
    } catch {
      showToast("Failed to delete", false);
    } finally {
      setDeleting(null);
    }
  }

  async function copyCode(codeStr: string) {
    try {
      await navigator.clipboard.writeText(codeStr);
      setCopied(codeStr);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      showToast("Could not copy to clipboard", false);
    }
  }

  async function createCode() {
    if (!code.trim() || !discountValue) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/promo-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          description: description.trim() || null,
          discountType,
          discountValue: parseFloat(discountValue),
          maxUses: maxUses ? parseInt(maxUses) : null,
          expiresAt: expiresAt || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { code?: PromoCode };
      if (data.code) {
        setCodes((prev) => [data.code!, ...prev]);
        setCode(""); setDescription(""); setDiscountType("percent");
        setDiscountValue(""); setMaxUses(""); setExpiresAt("");
        setShowForm(false);
        showToast("Promo code created", true);
      } else {
        showToast("Failed to create promo code", false);
      }
    } catch {
      showToast("Failed to create promo code", false);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
            toast.ok ? "bg-green-500 text-white" : "bg-red-500 text-white"
          }`}
        >
          {toast.msg}
          <button onClick={() => setToast(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Promo Codes</h1>
          <p className="text-sm text-muted-foreground mt-1">{codes.length} total codes</p>
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
            New Code
          </Button>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <Card className="border-orange-400/40 bg-orange-500/5">
          <CardContent className="pt-5 pb-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm text-gray-900 dark:text-white">New Promo Code</p>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {/* Code field with generate button */}
              <div className="space-y-1">
                <Label className="text-xs">Code *</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="SUMMER20"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="font-mono uppercase"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    title="Generate random code"
                    onClick={() => setCode(generateRandomCode())}
                  >
                    <Shuffle className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Description (optional)</Label>
                <Input
                  placeholder="Summer sale 20% off"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>

            {/* Discount */}
            <div className="space-y-2">
              <Label className="text-xs">Discount Type & Value *</Label>
              <div className="flex gap-2 items-center">
                {/* Toggle */}
                <div className="flex rounded-md border border-input overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setDiscountType("percent")}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                      discountType === "percent"
                        ? "bg-orange-500 text-white"
                        : "bg-background text-muted-foreground hover:bg-muted dark:bg-card"
                    }`}
                  >
                    %
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType("fixed")}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                      discountType === "fixed"
                        ? "bg-orange-500 text-white"
                        : "bg-background text-muted-foreground hover:bg-muted dark:bg-card"
                    }`}
                  >
                    $
                  </button>
                </div>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={discountType === "percent" ? "20" : "10.00"}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  className="w-32"
                />
                <span className="text-sm text-muted-foreground">
                  {discountType === "percent" ? "percent off" : "dollars off"}
                </span>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Max Uses (empty = unlimited)</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="100"
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
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
                disabled={creating || !code.trim() || !discountValue}
                onClick={() => void createCode()}
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {creating ? "Creating…" : "Create Code"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : codes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <Tag className="w-10 h-10 opacity-30" />
          <p className="text-sm">No promo codes yet. Create one above.</p>
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E5E7EB] dark:border-white/10">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Code</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Discount</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Uses</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Expires</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {codes.map((pc) => (
                  <tr
                    key={pc.id}
                    className="border-b border-[#E5E7EB] dark:border-white/10 last:border-0 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                  >
                    {/* Code */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-gray-900 dark:text-white">{pc.code}</span>
                        <button
                          onClick={() => void copyCode(pc.code)}
                          className="text-muted-foreground hover:text-orange-500 transition-colors"
                          title="Copy code"
                        >
                          {copied === pc.code ? (
                            <Check className="w-3.5 h-3.5 text-green-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Description */}
                    <td className="px-4 py-3 text-muted-foreground max-w-[180px]">
                      <span className="line-clamp-1">{pc.description ?? "—"}</span>
                    </td>

                    {/* Discount */}
                    <td className="px-4 py-3">
                      <span className="font-semibold text-orange-600 dark:text-orange-400">
                        {pc.discountType === "percent"
                          ? `${pc.discountValue}%`
                          : `$${pc.discountValue.toFixed(2)}`}
                      </span>
                      <span className="text-xs text-muted-foreground ml-1">
                        {pc.discountType === "percent" ? "off" : "off"}
                      </span>
                    </td>

                    {/* Uses */}
                    <td className="px-4 py-3 text-muted-foreground">
                      <span className="font-medium text-gray-900 dark:text-white">{pc.usedCount}</span>
                      <span className="text-muted-foreground"> / {pc.maxUses ?? "∞"}</span>
                    </td>

                    {/* Status + toggle */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => void toggleActive(pc)}
                        disabled={toggling === pc.id}
                        className="focus:outline-none"
                      >
                        {toggling === pc.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        ) : pc.active ? (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200 cursor-pointer text-[11px]">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="cursor-pointer text-[11px]">
                            Inactive
                          </Badge>
                        )}
                      </button>
                    </td>

                    {/* Expires */}
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {pc.expiresAt ? new Date(pc.expiresAt).toLocaleDateString() : "Never"}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive h-7 w-7 p-0"
                        disabled={deleting === pc.id}
                        onClick={() => void deleteCode(pc.id)}
                      >
                        {deleting === pc.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
