"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import {
  ShoppingBag,
  Loader2,
  Mail,
  Search,
  RotateCcw,
  TrendingUp,
  Package,
  Download,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Star,
  DollarSign,
  Calendar,
  Users,
  X,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────────

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

type TimeFilter = "all" | "today" | "week" | "month";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatPrice(cents: number) {
  return `£${(cents / 100).toFixed(2)}`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) {
    return `Today, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
  }
  if (d.toDateString() === yesterday.toDateString()) {
    return `Yesterday, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function getInitials(name: string | null, email: string) {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function getAvatarColor(str: string) {
  const colors = [
    "bg-orange-500/15 text-orange-600 dark:text-orange-400",
    "bg-purple-500/15 text-purple-600 dark:text-purple-400",
    "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    "bg-green-500/15 text-green-600 dark:text-green-400",
    "bg-pink-500/15 text-pink-600 dark:text-pink-400",
    "bg-teal-500/15 text-teal-600 dark:text-teal-400",
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function exportOrdersCSV(orders: Order[]) {
  const rows = [
    ["Date", "Buyer Name", "Buyer Email", "Product", "Amount (£)", "Status"],
    ...orders.map((o) => [
      new Date(o.createdAt).toLocaleDateString("en-GB"),
      o.buyerName ?? "",
      o.buyerEmail,
      o.productTitle ?? "",
      (o.amountCents / 100).toFixed(2),
      o.status,
    ]),
  ];
  const csv = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-2xl border p-5 flex flex-col gap-3",
      accent
        ? "bg-orange-500 border-orange-600 text-white"
        : "bg-card border-border"
    )}>
      <div className="flex items-center justify-between">
        <p className={cn("text-xs font-semibold uppercase tracking-wider", accent ? "text-orange-100" : "text-muted-foreground")}>
          {label}
        </p>
        <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", accent ? "bg-white/20" : "bg-muted")}>
          {icon}
        </div>
      </div>
      <div>
        <p className={cn("text-3xl font-black tracking-tight", accent ? "text-white" : "text-foreground")}>{value}</p>
        <p className={cn("text-xs mt-0.5", accent ? "text-orange-100" : "text-muted-foreground")}>{sub}</p>
      </div>
    </div>
  );
}

function CopyEmailButton({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(email).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      title="Copy email"
    >
      {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────────

export function OrdersClient() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [revenue, setRevenue] = useState<RevenueSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [resending, setResending] = useState<string | null>(null);
  const [refunding, setRefunding] = useState<string | null>(null);
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
      toast({ title: `Sent to ${data.sent} buyer${data.sent !== 1 ? "s" : ""}${data.failed ? ` (${data.failed} failed)` : ""}` });
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

  const handleRefund = async (order: Order) => {
    const isFree = order.amountCents === 0;
    const confirmed = window.confirm(
      isFree
        ? "Revoke this buyer's download access? This cannot be undone."
        : `Refund ${formatPrice(order.amountCents)} to ${order.buyerEmail} and revoke their download access? This cannot be undone.`
    );
    if (!confirmed) return;

    setRefunding(order.id);
    try {
      const res = await fetch(`/api/orders/${order.id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to refund");
      toast({ title: isFree ? "Access revoked" : "Refund processed — access revoked" });
      fetchData();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to refund", variant: "destructive" });
    } finally {
      setRefunding(null);
    }
  };

  const uniqueProducts = Array.from(
    new Map(orders.filter((o) => o.productId && o.productTitle).map((o) => [o.productId, o.productTitle])).entries()
  ).map(([id, title]) => ({ id, title }));

  // Time filter
  const now = new Date();
  const filtered = orders.filter((o) => {
    // Time
    if (timeFilter !== "all") {
      const d = new Date(o.createdAt);
      if (timeFilter === "today") {
        if (d.toDateString() !== now.toDateString()) return false;
      } else if (timeFilter === "week") {
        const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
        if (d < weekAgo) return false;
      } else if (timeFilter === "month") {
        if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return false;
      }
    }
    // Status
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    // Search
    if (search) {
      const q = search.toLowerCase();
      return (
        o.buyerEmail.toLowerCase().includes(q) ||
        (o.buyerName ?? "").toLowerCase().includes(q) ||
        (o.productTitle ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const hasFilters = search || timeFilter !== "all" || statusFilter !== "all";
  const clearFilters = () => { setSearch(""); setTimeFilter("all"); setStatusFilter("all"); };

  return (
    <div className="p-6 md:p-8 max-w-none space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2.5">
            <ShoppingBag className="w-6 h-6 text-orange-500" />
            Orders
            {!loading && orders.length > 0 && (
              <span className="text-sm font-semibold bg-muted text-muted-foreground px-2.5 py-0.5 rounded-full">
                {orders.length}
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track every sale from your digital store.</p>
        </div>
        {!loading && orders.length > 0 && (
          <button
            onClick={() => exportOrdersCSV(filtered)}
            className="flex items-center gap-1.5 h-9 px-3.5 text-xs font-semibold text-muted-foreground hover:text-foreground border border-border rounded-xl hover:bg-accent transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        )}
      </div>

      {/* Stat cards */}
      {revenue && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="All-time Revenue"
            value={formatPrice(revenue.allTime.cents)}
            sub={`${revenue.allTime.orders} total orders`}
            icon={<DollarSign className="w-4 h-4 text-orange-500" />}
            accent
          />
          <StatCard
            label="This Month"
            value={formatPrice(revenue.thisMonth.cents)}
            sub={`${revenue.thisMonth.orders} orders`}
            icon={<Calendar className="w-4 h-4 text-muted-foreground" />}
          />
          {revenue.bestSeller ? (
            <StatCard
              label="Best Seller"
              value={revenue.bestSeller.productTitle?.split(" ").slice(0, 3).join(" ") ?? "—"}
              sub={`${revenue.bestSeller.salesCount} sales · ${formatPrice(Number(revenue.bestSeller.revenueCents))}`}
              icon={<Star className="w-4 h-4 text-muted-foreground" />}
            />
          ) : (
            <StatCard
              label="Unique Buyers"
              value={String(new Set(orders.map((o) => o.buyerEmail)).size)}
              sub="customers so far"
              icon={<Users className="w-4 h-4 text-muted-foreground" />}
            />
          )}
        </div>
      )}

      {/* Email blast */}
      {orders.length > 0 && (
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <button
            onClick={() => setBlastOpen((o) => !o)}
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-orange-500/10 flex items-center justify-center">
                <Mail className="w-4 h-4 text-orange-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Email your buyers</p>
                <p className="text-xs text-muted-foreground">Send a message to all buyers of a product</p>
              </div>
            </div>
            {blastOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          {blastOpen && (
            <div className="px-5 pb-5 space-y-3 border-t border-border pt-4">
              <select
                value={blastProductId}
                onChange={(e) => setBlastProductId(e.target.value)}
                className="w-full rounded-xl border border-border bg-background text-sm text-foreground px-3 py-2 focus:outline-none focus:ring-1 focus:ring-orange-500/50"
              >
                <option value="">Select a product…</option>
                {uniqueProducts.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
              <Input
                value={blastSubject}
                onChange={(e) => setBlastSubject(e.target.value)}
                placeholder="Email subject…"
                className="focus:ring-orange-500/50"
              />
              <textarea
                value={blastMessage}
                onChange={(e) => setBlastMessage(e.target.value)}
                placeholder="Your message to buyers…"
                rows={4}
                className="w-full rounded-xl border border-border bg-background text-sm text-foreground px-3 py-2 placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-orange-500/50 resize-none"
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleBlast}
                  disabled={blasting || !blastProductId || !blastSubject.trim() || !blastMessage.trim()}
                  className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
                >
                  {blasting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  {blasting ? "Sending…" : "Send to all buyers"}
                </Button>
                <Button variant="outline" onClick={() => setBlastOpen(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filters bar */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search buyer, email, product…"
            className="pl-9 h-9 text-sm"
          />
        </div>

        {/* Time filter */}
        <div className="flex items-center gap-1 bg-muted/50 rounded-xl p-1">
          {(["all", "today", "week", "month"] as TimeFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setTimeFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all",
                timeFilter === f
                  ? "bg-white dark:bg-[#1A1A1A] text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f === "all" ? "All time" : f === "today" ? "Today" : f === "week" ? "This week" : "This month"}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1 bg-muted/50 rounded-xl p-1">
          {["all", "completed", "pending", "refunded"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all",
                statusFilter === s
                  ? "bg-white dark:bg-[#1A1A1A] text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {s === "all" ? "All status" : s}
            </button>
          ))}
        </div>

        {/* Clear filters */}
        {hasFilters && (
          <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        )}
      </div>

      {/* Orders */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-7 h-7 animate-spin text-orange-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-16 text-center">
          <div className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <ShoppingBag className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold text-foreground mb-1">
            {hasFilters ? "No orders match your filters" : "No orders yet"}
          </p>
          <p className="text-xs text-muted-foreground">
            {hasFilters
              ? "Try changing your search or date range."
              : "Sales will appear here once customers purchase your products."}
          </p>
          {hasFilters && (
            <button onClick={clearFilters} className="mt-4 text-xs font-semibold text-orange-500 hover:text-orange-600 transition-colors">
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          {/* Table header */}
          <div className="hidden md:grid grid-cols-[2fr_2fr_1fr_auto] gap-4 px-5 py-3 border-b border-border">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Buyer</span>
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Product</span>
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Amount</span>
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Actions</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-border">
            {filtered.map((order) => {
              const initials = getInitials(order.buyerName, order.buyerEmail);
              const avatarColor = getAvatarColor(order.buyerEmail);
              return (
                <div
                  key={order.id}
                  className="grid grid-cols-1 md:grid-cols-[2fr_2fr_1fr_auto] gap-3 md:gap-4 px-5 py-4 items-center hover:bg-accent/30 transition-colors"
                >
                  {/* Buyer */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn("w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0", avatarColor)}>
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {order.buyerName || "Guest"}
                      </p>
                      <div className="flex items-center gap-0.5">
                        <p className="text-xs text-muted-foreground truncate">{order.buyerEmail}</p>
                        <CopyEmailButton email={order.buyerEmail} />
                      </div>
                      <p className="text-[11px] text-muted-foreground/70 mt-0.5">{formatDate(order.createdAt)}</p>
                    </div>
                  </div>

                  {/* Product */}
                  <div className="min-w-0 pl-12 md:pl-0">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                        <Package className="w-3.5 h-3.5 text-orange-500" />
                      </div>
                      <p className="text-sm text-foreground truncate font-medium">
                        {order.productTitle ?? "Unknown product"}
                      </p>
                    </div>
                    <div className="mt-1.5 pl-9">
                      <span className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold",
                        order.status === "completed"
                          ? "bg-green-500/10 text-green-600 dark:text-green-400"
                          : order.status === "refunded"
                          ? "bg-red-500/10 text-red-600 dark:text-red-400"
                          : "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                      )}>
                        {order.status === "completed" ? "✓ Completed" : order.status === "refunded" ? "↩ Refunded" : "⏳ Pending"}
                      </span>
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="pl-12 md:pl-0">
                    <span className="text-lg font-black text-orange-500">
                      {formatPrice(order.amountCents)}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="pl-12 md:pl-0 flex items-center gap-2 flex-wrap">
                    {order.downloadToken && order.status !== "refunded" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs gap-1.5"
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
                    {order.status === "completed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs gap-1.5 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-red-900/50 dark:hover:bg-red-950/30"
                        onClick={() => handleRefund(order)}
                        disabled={refunding === order.id}
                      >
                        {refunding === order.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Undo2 className="w-3 h-3" />
                        )}
                        {order.amountCents === 0 ? "Revoke access" : "Refund"}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Showing {filtered.length} of {orders.length} orders
          {filtered.length < orders.length && (
            <button onClick={clearFilters} className="ml-2 text-orange-500 hover:text-orange-600 font-semibold transition-colors">
              Clear filters
            </button>
          )}
        </p>
      )}
    </div>
  );
}
