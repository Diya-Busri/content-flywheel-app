"use client";

import { useState } from "react";
import { Trash2, RefreshCw, Plus, X, Shuffle } from "lucide-react";
import { createPromoCodeAction, deletePromoCodeAction, getAllPromoCodesAction } from "@/actions/promo-codes-actions";
import { SelectPromoCode } from "@/db/schema/promo-codes-schema";

interface Props {
  initialCodes: SelectPromoCode[];
}

type DiscountType = "percent" | "fixed";
type Plan = "monthly" | "yearly" | "both";

function randomCode(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

function formatDiscount(code: SelectPromoCode): string {
  if (code.discountPercent > 0) return `${code.discountPercent}% off`;
  return `£${(code.discountAmount / 100).toFixed(2)} off`;
}

function planLabel(plan: string): string {
  if (plan === "monthly") return "Monthly only";
  if (plan === "yearly") return "Yearly only";
  return "Both plans";
}

export default function PromoCodesClient({ initialCodes }: Props) {
  const [codes, setCodes] = useState<SelectPromoCode[]>(initialCodes);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState<DiscountType>("percent");
  const [discountValue, setDiscountValue] = useState("20");
  const [maxUses, setMaxUses] = useState("100");
  const [expiresAt, setExpiresAt] = useState("");
  const [plan, setPlan] = useState<Plan>("both");

  const resetForm = () => {
    setCode("");
    setDescription("");
    setDiscountType("percent");
    setDiscountValue("20");
    setMaxUses("100");
    setExpiresAt("");
    setPlan("both");
    setError(null);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    const res = await getAllPromoCodesAction();
    if (res.isSuccess && res.data) setCodes(res.data);
    setRefreshing(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) { setError("Code is required"); return; }
    const value = parseInt(discountValue, 10);
    if (isNaN(value) || value <= 0) { setError("Enter a valid discount value"); return; }

    setLoading(true);
    setError(null);
    const res = await createPromoCodeAction({
      code: code.trim(),
      description: description.trim() || null,
      discountType,
      discountValue: value,
      maxUses: maxUses ? parseInt(maxUses, 10) || null : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      plan,
    } as any);
    setLoading(false);

    if (res.isSuccess && res.data) {
      setCodes((prev) => [...prev, res.data!]);
      resetForm();
      setShowForm(false);
    } else {
      setError(res.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this promo code?")) return;
    const res = await deletePromoCodeAction(id);
    if (res.isSuccess) setCodes((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold">Promo Codes</h1>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            <Plus size={14} />
            New Code
          </button>
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-6">{codes.length} total code{codes.length !== 1 ? "s" : ""}</p>

      {/* Create form */}
      {showForm && (
        <div className="mb-6 border border-gray-200 rounded-xl bg-gray-50 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">New Promo Code</h2>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleCreate} className="space-y-4">
            {/* Code + Description */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Code <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="SUMMER20"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                  <button
                    type="button"
                    onClick={() => setCode(randomCode())}
                    className="px-2.5 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                    title="Generate random code"
                  >
                    <Shuffle size={14} className="text-gray-500" />
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optional)
                </label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Summer sale 20% off"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
            </div>

            {/* Discount Type & Value */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Discount Type & Value <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2 items-center">
                <button
                  type="button"
                  onClick={() => setDiscountType("percent")}
                  className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                    discountType === "percent"
                      ? "bg-orange-500 text-white border-orange-500"
                      : "border-gray-200 hover:bg-gray-100"
                  }`}
                >
                  %
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountType("fixed")}
                  className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                    discountType === "fixed"
                      ? "bg-orange-500 text-white border-orange-500"
                      : "border-gray-200 hover:bg-gray-100"
                  }`}
                >
                  £
                </button>
                <input
                  type="number"
                  min="1"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
                <span className="text-sm text-gray-500">
                  {discountType === "percent" ? "percent off" : "pounds off"}
                </span>
              </div>
            </div>

            {/* Plan restriction */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Applies to Plan <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                {(["both", "monthly", "yearly"] as Plan[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlan(p)}
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors capitalize ${
                      plan === p
                        ? "bg-orange-500 text-white border-orange-500"
                        : "border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    {p === "both" ? "Both plans" : p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-gray-400">
                {plan === "monthly" && "Code can only be used on the Monthly plan."}
                {plan === "yearly" && "Code can only be used on the Yearly plan."}
                {plan === "both" && "Code works on both Monthly and Yearly plans."}
              </p>
            </div>

            {/* Max Uses + Expiry */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Uses (empty = unlimited)
                </label>
                <input
                  type="number"
                  min="1"
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                  placeholder="100"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expires At (optional)
                </label>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-60"
              >
                {loading ? "Creating…" : "Create Code"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-500 uppercase text-xs tracking-wide">Code</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 uppercase text-xs tracking-wide">Description</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 uppercase text-xs tracking-wide">Discount</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 uppercase text-xs tracking-wide">Plan</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 uppercase text-xs tracking-wide">Uses</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 uppercase text-xs tracking-wide">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 uppercase text-xs tracking-wide">Expires</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {codes.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  No promo codes yet. Create one above.
                </td>
              </tr>
            )}
            {codes.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-mono font-semibold">{c.code}</td>
                <td className="px-4 py-3 text-gray-500">{c.description ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className="font-semibold text-orange-600">{formatDiscount(c)}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    c.plan === "monthly"
                      ? "bg-blue-50 text-blue-700"
                      : c.plan === "yearly"
                      ? "bg-purple-50 text-purple-700"
                      : "bg-gray-100 text-gray-600"
                  }`}>
                    {planLabel(c.plan)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-gray-700 font-medium">
                      {c.usedCount} / {c.maxUses ?? "∞"}
                    </span>
                    {c.usedCount === 0 ? (
                      <span className="text-xs text-gray-400">Not used yet</span>
                    ) : c.maxUses !== null && c.usedCount >= c.maxUses ? (
                      <span className="text-xs text-red-500 font-medium">Limit reached</span>
                    ) : (
                      <span className="text-xs text-amber-600 font-medium">{c.usedCount} use{c.usedCount !== 1 ? "s" : ""}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {(() => {
                    const isExpired = c.expiresAt && new Date(c.expiresAt) < new Date();
                    const isExhausted = c.maxUses !== null && c.usedCount >= c.maxUses;
                    if (!c.active || isExpired || isExhausted) {
                      const label = isExpired ? "Expired" : isExhausted ? "Exhausted" : "Inactive";
                      return (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">
                          {label}
                        </span>
                      );
                    }
                    return (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                        Active
                      </span>
                    );
                  })()}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString("en-GB") : "Never"}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="text-gray-300 hover:text-red-500 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
