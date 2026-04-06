"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, DollarSign, Plus, Trash2, TrendingUp } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

type Sale = {
  id: string;
  platform: string;
  amountCents: number;
  currency: string;
  note: string | null;
  soldAt: string;
};

const PLATFORMS = [
  { value: "gumroad", label: "Gumroad" },
  { value: "etsy", label: "Etsy" },
  { value: "stan-store", label: "Stan Store" },
  { value: "beacons", label: "Beacons" },
  { value: "payhip", label: "Payhip" },
  { value: "other", label: "Other" },
];

function formatCurrency(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function RevenueTracker({ productId }: { productId: string }) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [totalCents, setTotalCents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();

  // Form state
  const [platform, setPlatform] = useState("gumroad");
  const [amountStr, setAmountStr] = useState("");
  const [note, setNote] = useState("");
  const [soldAt, setSoldAt] = useState(() => new Date().toISOString().slice(0, 10));

  const fetchSales = useCallback(async () => {
    try {
      const res = await fetch(`/api/products/${productId}/sales`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSales(data.sales ?? []);
        setTotalCents(data.totalCents ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => { fetchSales(); }, [fetchSales]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(amountStr.replace(/[^0-9.]/g, ""));
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    setAdding(true);
    try {
      const res = await fetch(`/api/products/${productId}/sales`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          amountCents: Math.round(amount * 100),
          note: note.trim() || null,
          soldAt: new Date(soldAt).toISOString(),
        }),
      });
      if (!res.ok) throw new Error("Failed to log sale");
      toast({ title: "Sale logged! 💰" });
      setAmountStr("");
      setNote("");
      setShowForm(false);
      fetchSales();
    } catch {
      toast({ title: "Failed to log sale", variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (saleId: string) => {
    try {
      await fetch(`/api/products/${productId}/sales`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saleId }),
      });
      setSales((s) => s.filter((x) => x.id !== saleId));
      setTotalCents((t) => t - (sales.find((x) => x.id === saleId)?.amountCents ?? 0));
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  // Revenue by platform
  const byPlatform = sales.reduce<Record<string, number>>((acc, s) => {
    acc[s.platform] = (acc[s.platform] ?? 0) + s.amountCents;
    return acc;
  }, {});

  return (
    <Card className="border-gray-200 dark:border-gray-800">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-500" />
            <CardTitle className="text-sm font-semibold text-gray-900 dark:text-white">Revenue Tracker</CardTitle>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-xs border-gray-200"
            onClick={() => setShowForm((v) => !v)}
          >
            <Plus className="w-3 h-3" />
            Log Sale
          </Button>
        </div>

        {/* Total */}
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-green-600 dark:text-green-400">
            {formatCurrency(totalCents)}
          </span>
          <span className="text-xs text-gray-500">total from {sales.length} {sales.length === 1 ? "sale" : "sales"}</span>
        </div>

        {/* Platform breakdown */}
        {Object.keys(byPlatform).length > 1 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {Object.entries(byPlatform).map(([p, cents]) => (
              <span key={p} className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md px-2 py-0.5">
                {p}: {formatCurrency(cents)}
              </span>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-3">
        {/* Log sale form */}
        {showForm && (
          <form onSubmit={handleAdd} className="rounded-lg border border-green-200 bg-green-50/60 dark:bg-green-950/20 dark:border-green-900/40 p-3 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Platform</Label>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger className="h-8 text-xs border-gray-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map((p) => (
                      <SelectItem key={p.value} value={p.value} className="text-xs">{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Amount ($)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="19.99"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Date sold</Label>
                <Input
                  type="date"
                  value={soldAt}
                  onChange={(e) => setSoldAt(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Note (optional)</Label>
                <Input
                  type="text"
                  placeholder="e.g. promo code"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white gap-1" disabled={adding}>
                {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : <DollarSign className="w-3 h-3" />}
                {adding ? "Saving…" : "Log Sale"}
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </form>
        )}

        {/* Sales list */}
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
          </div>
        ) : sales.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-3">No sales logged yet. Click "Log Sale" to record your first sale!</p>
        ) : (
          <ul className="space-y-1.5 max-h-52 overflow-y-auto">
            {sales.map((sale) => (
              <li key={sale.id} className="flex items-center gap-2 rounded-md bg-gray-50 dark:bg-gray-800/50 px-2.5 py-1.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-green-700 dark:text-green-400">
                      {formatCurrency(sale.amountCents, sale.currency)}
                    </span>
                    <span className="text-xs text-gray-500 capitalize">{sale.platform}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-400">{formatDate(sale.soldAt)}</span>
                    {sale.note && <span className="text-xs text-gray-400 truncate">· {sale.note}</span>}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-gray-400 hover:text-red-500 shrink-0"
                  onClick={() => handleDelete(sale.id)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
