"use client";

import { useState } from "react";
import { Package, Plus, Trash2, ExternalLink, Copy, Check, X } from "lucide-react";

type Bundle = {
  id: string;
  title: string;
  description: string | null;
  bundlePrice: number;
  productIds: string[];
  active: boolean;
  createdAt: Date;
};

type Product = {
  id: string;
  title: string;
  marketingAssets: unknown;
};

interface Props {
  bundles: Bundle[];
  publishedProducts: Product[];
}

export function BundlesClient({ bundles: initialBundles, publishedProducts }: Props) {
  const [bundles, setBundles] = useState(initialBundles);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://contentflywheel.co.uk";

  const toggleProduct = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const handleCreate = async () => {
    setError(null);
    const price = Math.round(parseFloat(priceInput) * 100);
    if (!title.trim()) { setError("Title is required"); return; }
    if (isNaN(price) || price < 100) { setError("Price must be at least £1.00"); return; }
    if (selectedIds.length < 2) { setError("Select at least 2 products"); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/bundles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description: description.trim() || null, bundlePrice: price, productIds: selectedIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create bundle");
      setBundles((prev) => [...prev, data]);
      setShowCreate(false);
      setTitle(""); setDescription(""); setPriceInput(""); setSelectedIds([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this bundle? The public page will stop working.")) return;
    const res = await fetch(`/api/bundles/${id}`, { method: "DELETE" });
    if (res.ok) setBundles((prev) => prev.filter((b) => b.id !== id));
  };

  const copyLink = (id: string) => {
    navigator.clipboard.writeText(`${APP_URL}/bundle/${id}`).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Bundles</h1>
          <p className="text-sm text-gray-500 mt-0.5">Sell multiple products together at a combined price</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <Plus size={16} />
          New Bundle
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="rounded-2xl border border-orange-200 dark:border-orange-900/40 bg-orange-50 dark:bg-orange-950/20 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">Create bundle</h2>
            <button onClick={() => { setShowCreate(false); setError(null); }} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 block">Bundle title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Creator Starter Pack"
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 block">Description (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's in this bundle and why it's worth it…"
                rows={2}
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30 resize-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 block">Bundle price (£)</label>
              <div className="relative w-36">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">£</span>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  placeholder="9.99"
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 pl-7 pr-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
                Products to include ({selectedIds.length} selected, need at least 2)
              </label>
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {publishedProducts.length === 0 ? (
                  <p className="text-xs text-gray-400">No published products yet. Publish some products first.</p>
                ) : (
                  publishedProducts.map((p) => (
                    <label key={p.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 cursor-pointer hover:border-orange-300 transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(p.id)}
                        onChange={() => toggleProduct(p.id)}
                        className="accent-orange-500"
                      />
                      <span className="text-sm text-gray-900 dark:text-white font-medium">{p.title}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <button
            onClick={handleCreate}
            disabled={saving}
            className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {saving ? "Creating…" : "Create Bundle"}
          </button>
        </div>
      )}

      {/* Bundle list */}
      {bundles.length === 0 && !showCreate ? (
        <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 p-12 text-center">
          <Package className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">No bundles yet</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Create your first bundle to sell multiple products at once</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bundles.map((bundle) => {
            const bundleUrl = `${APP_URL}/bundle/${bundle.id}`;
            const productNames = publishedProducts
              .filter((p) => bundle.productIds.includes(p.id))
              .map((p) => p.title);
            return (
              <div key={bundle.id} className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">{bundle.title}</h3>
                      <span className="shrink-0 text-xs font-bold text-orange-600 dark:text-orange-400">
                        £{(bundle.bundlePrice / 100).toFixed(2)}
                      </span>
                    </div>
                    {bundle.description && (
                      <p className="text-xs text-gray-500 mb-2 line-clamp-2">{bundle.description}</p>
                    )}
                    <p className="text-xs text-gray-400">
                      {bundle.productIds.length} products
                      {productNames.length > 0 && ` · ${productNames.slice(0, 3).join(", ")}${productNames.length > 3 ? "…" : ""}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => copyLink(bundle.id)}
                      title="Copy link"
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-orange-300 transition-colors"
                    >
                      {copied === bundle.id ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                      {copied === bundle.id ? "Copied!" : "Copy link"}
                    </button>
                    <a
                      href={bundleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="View bundle page"
                      className="p-1.5 text-gray-400 hover:text-orange-500 transition-colors"
                    >
                      <ExternalLink size={15} />
                    </a>
                    <button
                      onClick={() => handleDelete(bundle.id)}
                      title="Delete bundle"
                      className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
