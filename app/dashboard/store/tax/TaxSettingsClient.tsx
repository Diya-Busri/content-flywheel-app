"use client";

import { useEffect, useState } from "react";

interface TaxSettings {
  vatEnabled: boolean;
  vatRate: number;
  vatNumber: string;
  businessName: string;
  businessAddress: string;
}

interface QuarterlyRevenue {
  revenueCents: number;
  vatEstimateCents: number;
}

export default function TaxSettingsClient() {
  const [settings, setSettings] = useState<TaxSettings>({
    vatEnabled: false,
    vatRate: 20,
    vatNumber: "",
    businessName: "",
    businessAddress: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [quarterly, setQuarterly] = useState<QuarterlyRevenue | null>(null);

  useEffect(() => {
    // Load store settings
    fetch("/api/store-settings")
      .then((r) => r.json())
      .then((d) => {
        setSettings({
          vatEnabled: d.vatEnabled ?? false,
          vatRate: d.vatRate ?? 20,
          vatNumber: d.vatNumber ?? "",
          businessName: d.businessName ?? "",
          businessAddress: d.businessAddress ?? "",
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Load analytics for quarterly estimate
    fetch("/api/analytics/revenue")
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) {
          // Approximate last quarter as last 90 days from total / 4
          const quarterCents = Math.round((d.totalRevenueCents ?? 0) / 4);
          setQuarterly({
            revenueCents: quarterCents,
            vatEstimateCents: 0, // computed after settings load
          });
        }
      })
      .catch(() => {});
  }, []);

  // Recompute VAT estimate when rate or quarterly revenue changes
  useEffect(() => {
    if (quarterly) {
      const rate = settings.vatRate ?? 20;
      const vatFraction = rate / (100 + rate);
      const vatCents = Math.round(quarterly.revenueCents * vatFraction);
      setQuarterly((q) => q ? { ...q, vatEstimateCents: vatCents } : q);
    }
  }, [settings.vatRate, quarterly?.revenueCents]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/store-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vatEnabled: settings.vatEnabled,
          vatRate: Number(settings.vatRate),
          vatNumber: settings.vatNumber,
          businessName: settings.businessName,
          businessAddress: settings.businessAddress,
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-gray-400 text-sm animate-pulse">Loading tax settings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 md:p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Tax &amp; VAT Settings</h1>
          <p className="text-gray-400 text-sm mt-1">
            Configure VAT collection for your digital product sales
          </p>
        </div>

        {/* Main form card */}
        <div className="bg-card border border-white/10 rounded-xl p-6 space-y-6">
          {/* VAT toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-medium">Enable VAT Collection</p>
              <p className="text-gray-400 text-sm mt-0.5">
                Mark your product prices as VAT-inclusive
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setSettings((s) => ({ ...s, vatEnabled: !s.vatEnabled }))
              }
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ${
                settings.vatEnabled ? "bg-orange-500" : "bg-white/10"
              }`}
              role="switch"
              aria-checked={settings.vatEnabled}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  settings.vatEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Info box when VAT enabled */}
          {settings.vatEnabled && (
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 text-sm text-orange-200">
              When VAT is enabled, your product prices are treated as VAT-inclusive. Buyers see the
              VAT-inclusive price. You are responsible for filing your VAT returns.
            </div>
          )}

          <div className="h-px bg-white/10" />

          {/* VAT Rate */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              VAT Rate (%)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={100}
                value={settings.vatRate}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, vatRate: Number(e.target.value) }))
                }
                className="w-28 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500 transition-colors"
              />
              <span className="text-gray-400 text-sm">%</span>
            </div>
          </div>

          {/* VAT Number */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              VAT Number
            </label>
            <input
              type="text"
              placeholder="e.g. GB123456789"
              value={settings.vatNumber}
              onChange={(e) =>
                setSettings((s) => ({ ...s, vatNumber: e.target.value }))
              }
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-orange-500 transition-colors"
            />
          </div>

          {/* Business Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Business Name
            </label>
            <input
              type="text"
              placeholder="Your business or trading name"
              value={settings.businessName}
              onChange={(e) =>
                setSettings((s) => ({ ...s, businessName: e.target.value }))
              }
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-orange-500 transition-colors"
            />
          </div>

          {/* Business Address */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Business Address
            </label>
            <textarea
              rows={3}
              placeholder="Your registered business address"
              value={settings.businessAddress}
              onChange={(e) =>
                setSettings((s) => ({ ...s, businessAddress: e.target.value }))
              }
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-orange-500 transition-colors resize-none"
            />
          </div>

          {/* Save button */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors"
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>
            {saved && (
              <span className="text-green-400 text-sm">Saved successfully</span>
            )}
          </div>
        </div>

        {/* VAT Summary */}
        {quarterly && (
          <div className="bg-card border border-white/10 rounded-xl p-6 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-white">VAT Summary</h2>
              <p className="text-gray-400 text-xs mt-0.5">Based on your all-time revenue (estimated quarterly)</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 rounded-lg p-4">
                <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">
                  Est. Revenue / Quarter
                </p>
                <p className="text-white font-bold text-xl">
                  £{(quarterly.revenueCents / 100).toFixed(2)}
                </p>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">
                  Est. VAT Collected ({settings.vatRate}%)
                </p>
                <p className="text-orange-400 font-bold text-xl">
                  £{(quarterly.vatEstimateCents / 100).toFixed(2)}
                </p>
              </div>
            </div>

            <p className="text-gray-500 text-xs">
              This is an estimate only. Consult your accountant for official VAT returns.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
