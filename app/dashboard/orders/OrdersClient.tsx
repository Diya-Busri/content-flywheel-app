"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  ShoppingBag,
  Loader2,
  Mail,
  Search,
  RotateCcw,
  TrendingUp,
  Package,
  Calendar,
  Download,
  Copy,
  Check,
} from "lucide-react";

type Order = {
  id: string;
  productId: string;
  productTitle: string | null;
  buyerEmail: string;
  buyerName: string | null;
  amountCents: number;
  currency: string;
  status: string;
  downloadToken: string | null;
  downloadExpiresAt: string | null;
  emailSent: boolean | null;
  createdAt: string;
};

type RevenueSummary = {
  allTime: { cents: number; orders: number };
  thisMonth: { cents: number; orders: number };
  bestSeller: { productTitle: string | null; salesCount: number; revenueCents: number } | null;
};

function formatPrice(cents: number) {
  return `£${(cents / 100).toFixed(2)}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function exportOrdersCSV(orders: Order[]) {
  const rows = [
    ["Date","Buyer Name","Buyer Email","Product","Amount (£)","Status"],
    ...orders.map(o => [
      formatDate(o.createdAt),
      o.buyerName ?? "",
      o.buyerEmail,
      o.productTitle ?? "",
      (o.amountCents / 100).toFixed(2),
      o.status,
    ]),
  ];
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `orders-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function CopyEmailButton({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(email).catch(()=>{}); setCopied(true); setTimeout(()=>setCopied(false),2000); }}
      className="p-1 rounded text-gray-600 hover:text-gray-300 transition-colors"
      title="Copy email"
    >
      {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

export function OrdersClient() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [revenue, setRevenue] = useState<RevenueSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [resending, setResending] = useState<string | null>(null);
  const [blastOpen, setBlastOpen] = useState(false);
  const [blastProductId, setBlastProductId] = useState("");
  const [blastSubject, setBlastSubject] = useState("");
  const [blastMessage, setBlastMessage] = useState("");
  const [blasting, setBlasting] = useState(false);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersRes, revenueRes] = await Promise.all([
        fetch("/api/orders"),
        fetch("/api/analytics/revenue-summary"),
      ]);
      if (ordersRes.ok) setOrders(await ordersRes.json());
      if (revenueRes.ok) setRevenue(await revenueRes.json());
    } catch {
      toast({ title: "Failed to load orders", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleBlast = async () => {
    if (!blastProductId || !blastSubject.trim() || !blastMessage.trim()) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return;
    }
    setBlasting(true);
    try {
      const res = await fetch(`/api/products/${blastProductId}/blast-buyers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: blastSubject.trim(), message: blastMessage.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({ title: `✅ Sent to ${data.sent} buyer${data.sent !== 1 ? "s" : ""}${data.failed ? ` (${data.failed} failed)` : ""}` });
      setBlastOpen(false);
      setBlastSubject("");
      setBlastMessage("");
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to send", variant: "destructive" });
    } finally {
      setBlasting(false);
    }
  };

  const handleResend = async (orderId: string) => {
    setResending(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/resend`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      toast({ title: "Download link resent!" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to resend", variant: "destructive" });
    } finally {
      setResending(null);
    }
  };

  const uniqueProducts = Array.from(
    new Map(orders.filter(o => o.productId && o.productTitle).map(o => [o.productId, o.productTitle])).entries()
  ).map(([id, title]) => ({ id, title }));

  const filtered = orders.filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      o.buyerEmail.toLowerCase().includes(q) ||
      (o.buyerName ?? "").toLowerCase().includes(q) ||
      (o.productTitle ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-background p-6 md:p-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <ShoppingBag className="w-5 h-5 text-orange-400" />
            <h1 className="text-2xl font-bold text-white tracking-tight">Orders</h1>
            {!loading && orders.length > 0 && (
              <span className="text-xs font-semibold bg-white/10 text-gray-300 px-2 py-0.5 rounded-full">{orders.length}</span>
            )}
          </div>
          <p className="text-sm text-gray-400">All sales from your digital products store.</p>
        </div>
        {!loading && orders.length > 0 && (
          <button
            onClick={() => exportOrdersCSV(filtered)}
            className="flex items-center gap-1.5 h-9 px-3 text-xs font-semibold text-gray-400 hover:text-white border border-white/10 rounded-xl transition-colors"
          >
            <Download className="w-3.5 h-3.5" />Export CSV
          </button>
        )}
      </div>

      {/* Revenue stats */}
      {revenue && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl bg-card border border-white/8 p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">All-time Revenue</p>
            <p className="text-3xl font-bold text-orange-400">{formatPrice(revenue.allTime.cents)}</p>
            <p className="text-xs text-gray-500 mt-0.5">{revenue.allTime.orders} orders</p>
          </div>
          <div className="rounded-2xl bg-card border border-white/8 p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">This Month</p>
            <p className="text-3xl font-bold text-white">{formatPrice(revenue.thisMonth.cents)}</p>
            <p className="text-xs text-gray-500 mt-0.5">{revenue.thisMonth.orders} orders</p>
          </div>
          {revenue.bestSeller && (
            <div className="col-span-2 sm:col-span-1 rounded-2xl bg-card border border-white/8 p-5">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" /> Best Seller
              </p>
              <p className="text-sm font-bold text-white truncate">{revenue.bestSeller.productTitle ?? "Unknown"}</p>
              <p className="text-xs text-gray-500 mt-0.5">{revenue.bestSeller.salesCount} sales · {formatPrice(Number(revenue.bestSeller.revenueCents))}</p>
            </div>
          )}
        </div>
      )}

      {/* Email blast panel */}
      {orders.length > 0 && (
        <div className="rounded-2xl bg-card border border-white/8 overflow-hidden">
          <button
            onClick={() => setBlastOpen((o) => !o)}
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <Mail className="w-4 h-4 text-orange-400" />
              <span className="text-sm font-semibold text-white">Email your buyers</span>
              <span className="text-xs text-gray-500">Send a message to all buyers of a product</span>
            </div>
            <span className="text-gray-500 text-xs">{blastOpen ? "▲" : "▼"}</span>
          </button>
          {blastOpen && (
            <div className="px-5 pb-5 space-y-3 border-t border-white/8 pt-4">
              <select
                value={blastProductId}
                onChange={(e) => setBlastProductId(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 text-sm text-white px-3 py-2 focus:outline-none focus:border-orange-500/50"
              >
                <option value="">Select a product…</option>
                {uniqueProducts.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
              <input
                type="text"
                value={blastSubject}
                onChange={(e) => setBlastSubject(e.target.value)}
                placeholder="Email subject…"
                className="w-full rounded-lg border border-white/10 bg-white/5 text-sm text-white px-3 py-2 placeholder:text-gray-500 focus:outline-none focus:border-orange-500/50"
              />
              <textarea
                value={blastMessage}
                onChange={(e) => setBlastMessage(e.target.value)}
                placeholder="Your message to buyers…"
                rows={4}
                className="w-full rounded-lg border border-white/10 bg-white/5 text-sm text-white px-3 py-2 placeholder:text-gray-500 focus:outline-none focus:border-orange-500/50 resize-none"
              />
              <Button
                onClick={handleBlast}
                disabled={blasting || !blastProductId || !blastSubject.trim() || !blastMessage.trim()}
                className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
              >
                {blasting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                {blasting ? "Sending…" : "Send to all buyers"}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by buyer name, email or product..."
          className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-orange-500/50"
        />
      </div>

      {/* Orders list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-7 h-7 animate-spin text-orange-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-card p-12 text-center">
          <ShoppingBag className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-400">
            {search ? "No orders match your search" : "No orders yet"}
          </p>
          {!search && (
            <p className="text-xs text-gray-600 mt-1">Sales will appear here once customers purchase your products.</p>
          )}
        </div>
      ) : (
        <div className="rounded-2xl bg-card border border-white/8 overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-4 px-5 py-3 border-b border-white/8 text-xs font-semibold uppercase tracking-wider text-gray-500">
            <span>Buyer</span>
            <span>Product</span>
            <span>Amount</span>
            <span></span>
          </div>
          {/* Rows */}
          <div className="divide-y divide-white/5">
            {filtered.map((order) => (
              <div key={order.id} className="grid grid-cols-[1fr_1fr_auto_auto] gap-4 px-5 py-4 items-center hover:bg-white/[0.02] transition-colors">
                {/* Buyer */}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{order.buyerName || "—"}</p>
                  <div className="flex items-center gap-1">
                    <p className="text-xs text-gray-500 truncate">{order.buyerEmail}</p>
                    <CopyEmailButton email={order.buyerEmail} />
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDate(order.createdAt)}
                  </p>
                </div>
                {/* Product */}
                <div className="min-w-0">
                  <p className="text-sm text-gray-300 truncate flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                    {order.productTitle ?? "Unknown product"}
                  </p>
                  <Badge
                    className={`mt-1 text-[10px] ${
                      order.status === "completed"
                        ? "bg-green-500/15 text-green-400 border border-green-500/20 hover:bg-green-500/15"
                        : "bg-yellow-500/15 text-yellow-400 border border-yellow-500/20 hover:bg-yellow-500/15"
                    }`}
                  >
                    {order.status}
                  </Badge>
                </div>
                {/* Amount */}
                <span className="text-sm font-bold text-orange-400 shrink-0">
                  {formatPrice(order.amountCents)}
                </span>
                {/* Actions */}
                <div className="shrink-0">
                  {order.downloadToken && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-white/10 text-gray-300 hover:text-white gap-1.5"
                      onClick={() => handleResend(order.id)}
                      disabled={resending === order.id}
                    >
                      {resending === order.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <RotateCcw className="w-3 h-3" />
                      )}
                      Resend
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <p className="text-xs text-gray-600 text-center">{filtered.length} of {orders.length} orders</p>
      )}
    </div>
  );
}
