"use client";

import { useState, useEffect } from "react";
import { Sparkles, X } from "lucide-react";

type Product = { id: string; title: string; niche: string };

export default function MarketplaceFeaturePanel() {
  const [products, setProducts]       = useState<Product[]>([]);
  const [credits, setCredits]         = useState(0);
  const [featured, setFeatured]       = useState<{ productId: string; featuredUntil: string } | null>(null);
  const [selectedId, setSelectedId]   = useState("");
  const [loading, setLoading]         = useState(false);
  const [saving, setSaving]           = useState(false);
  const [msg, setMsg]                 = useState("");

  useEffect(() => {
    // Load creator's published products
    fetch("/api/products")
      .then((r) => r.json())
      .then((data) => {
        const pub = (data.products ?? []).filter((p: { marketingAssets?: { isNativePublished?: boolean } }) => p.marketingAssets?.isNativePublished);
        setProducts(pub);
      })
      .catch(() => {});

    // Load current featured + referral credits
    setLoading(true);
    fetch("/api/marketplace/feature")
      .then((r) => r.json())
      .then((data) => {
        setCredits(data.referralCredits ?? 0);
        setFeatured(data.featured ?? null);
        if (data.featured) setSelectedId(data.featured.productId);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleFeature = async () => {
    if (!selectedId) return;
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/marketplace/feature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: selectedId }),
      });
      const data = await res.json();
      if (!res.ok) { setMsg(data.error ?? "Error"); return; }
      setFeatured({ productId: selectedId, featuredUntil: data.featuredUntil });
      setCredits((c) => Math.max(0, c - 1));
      setMsg("✅ Your product is now featured on the marketplace for 7 days!");
    } catch {
      setMsg("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    await fetch("/api/marketplace/feature", { method: "DELETE" });
    setFeatured(null);
    setSelectedId("");
    setMsg("Featured placement removed.");
  };

  if (loading) return null;

  const featuredUntilDate = featured?.featuredUntil
    ? new Date(featured.featuredUntil).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : null;

  return (
    <div className="bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-xl p-5 mb-6 mx-6 mt-6">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-violet-600 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Sparkles size={16} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-bold text-gray-900">Feature your product</h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
              {credits} referral credit{credits !== 1 ? "s" : ""}
            </span>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Pin one product to the top of the marketplace for 7 days. Costs 1 referral credit.{" "}
            <a href="/dashboard/referral" className="text-violet-600 font-semibold hover:underline">Earn credits by inviting creators →</a>
          </p>

          {featured ? (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm text-gray-700">
                Currently featuring: <strong>{products.find((p) => p.id === featured.productId)?.title ?? "your product"}</strong>
                {featuredUntilDate && <span className="text-gray-400 ml-1">until {featuredUntilDate}</span>}
              </span>
              <button
                onClick={handleRemove}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-500 transition-colors"
              >
                <X size={12} /> Remove
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:border-violet-400"
                disabled={credits < 1}
              >
                <option value="">Choose a product…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
              <button
                onClick={handleFeature}
                disabled={!selectedId || credits < 1 || saving}
                className="text-sm font-bold px-4 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? "Featuring…" : "Feature for 7 days"}
              </button>
              {credits < 1 && (
                <span className="text-xs text-gray-400">No credits — <a href="/dashboard/referral" className="text-violet-600 font-semibold">invite a creator</a> to earn one</span>
              )}
            </div>
          )}

          {msg && <p className="text-xs mt-2 text-gray-600">{msg}</p>}
        </div>
      </div>
    </div>
  );
}
