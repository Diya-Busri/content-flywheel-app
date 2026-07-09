"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Plus, RefreshCw, Copy, Check, FlaskConical, X,
  Trash2, Info, ChevronDown, ChevronUp, Users,
} from "lucide-react";

type Variant = {
  key: string;
  label: string;
  weight: number;
};

type ABTest = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  active: boolean;
  variants: Variant[];
  participantCount: number;
  createdAt: string;
};

type Toast = { msg: string; ok: boolean };

type FormVariant = { key: string; label: string; weight: string };

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export default function AdminABTestsPage() {
  const [tests, setTests] = useState<ABTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  // Form state
  const [testKey, setTestKey] = useState("");
  const [testName, setTestName] = useState("");
  const [testDesc, setTestDesc] = useState("");
  const [variants, setVariants] = useState<FormVariant[]>([
    { key: "control", label: "Control", weight: "50" },
    { key: "variant_a", label: "Variant A", weight: "50" },
  ]);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ab-tests");
      const data = (await res.json().catch(() => ({}))) as { tests?: ABTest[] };
      setTests(data.tests ?? []);
    } catch {
      showToast("Failed to load A/B tests", false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function toggleTest(test: ABTest) {
    setToggling(test.id);
    try {
      const res = await fetch(`/api/admin/ab-tests`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: test.id, active: !test.active }),
      });
      const data = (await res.json().catch(() => ({}))) as { test?: ABTest };
      if (data.test) {
        setTests((prev) => prev.map((t) => t.id === test.id ? data.test! : t));
      } else {
        setTests((prev) => prev.map((t) => t.id === test.id ? { ...t, active: !t.active } : t));
      }
    } catch {
      showToast("Failed to toggle test", false);
    } finally {
      setToggling(null);
    }
  }

  async function copyKey(key: string) {
    try {
      await navigator.clipboard.writeText(key);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      showToast("Could not copy to clipboard", false);
    }
  }

  function addVariant() {
    setVariants((prev) => [...prev, { key: "", label: "", weight: "0" }]);
  }

  function removeVariant(idx: number) {
    setVariants((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateVariant(idx: number, field: keyof FormVariant, value: string) {
    setVariants((prev) =>
      prev.map((v, i) =>
        i === idx
          ? { ...v, [field]: field === "key" ? slugify(value) : value }
          : v
      )
    );
  }

  const totalWeight = variants.reduce((sum, v) => sum + (parseFloat(v.weight) || 0), 0);
  const weightOk = Math.abs(totalWeight - 100) < 0.01;

  async function createTest() {
    if (!testKey.trim() || !testName.trim() || variants.length < 2 || !weightOk) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/ab-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: testKey.trim(),
          name: testName.trim(),
          description: testDesc.trim() || null,
          variants: variants.map((v) => ({
            key: v.key.trim(),
            label: v.label.trim(),
            weight: parseFloat(v.weight) || 0,
          })),
          active: false,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { test?: ABTest };
      if (data.test) {
        setTests((prev) => [data.test!, ...prev]);
        setTestKey(""); setTestName(""); setTestDesc("");
        setVariants([
          { key: "control", label: "Control", weight: "50" },
          { key: "variant_a", label: "Variant A", weight: "50" },
        ]);
        setShowForm(false);
        showToast("A/B test created", true);
      } else {
        showToast("Failed to create test", false);
      }
    } catch {
      showToast("Failed to create test", false);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">A/B Tests</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage feature experiments and variant assignments</p>
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
            New Test
          </Button>
        </div>
      </div>

      {/* API hint */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 text-blue-800 dark:text-blue-300 text-sm">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          Assign users to variants by calling{" "}
          <code className="font-mono bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 rounded text-xs">
            /api/ab-assign?test=your_test_key
          </code>
        </span>
      </div>

      {/* Create form */}
      {showForm && (
        <Card className="border-orange-400/40 bg-orange-500/5">
          <CardContent className="pt-5 pb-5 space-y-5">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm text-gray-900 dark:text-white">New A/B Test</p>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Test Key * (slug format)</Label>
                <Input
                  placeholder="checkout_cta_test"
                  value={testKey}
                  onChange={(e) => setTestKey(slugify(e.target.value))}
                  className="font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Name *</Label>
                <Input
                  placeholder="Checkout CTA Button Test"
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Description (optional)</Label>
              <Input
                placeholder="Test whether a different CTA improves conversion"
                value={testDesc}
                onChange={(e) => setTestDesc(e.target.value)}
              />
            </div>

            {/* Variants */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Variants * (weights must sum to 100)</Label>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${weightOk ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                    Total: {totalWeight.toFixed(0)}%
                  </span>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addVariant}>
                    <Plus className="w-3 h-3 mr-1" /> Add Variant
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {variants.map((v, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      placeholder="key (slug)"
                      value={v.key}
                      onChange={(e) => updateVariant(idx, "key", e.target.value)}
                      className="font-mono w-36 text-sm"
                    />
                    <Input
                      placeholder="Label"
                      value={v.label}
                      onChange={(e) => updateVariant(idx, "label", e.target.value)}
                      className="flex-1 text-sm"
                    />
                    <div className="flex items-center gap-1 shrink-0">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        placeholder="50"
                        value={v.weight}
                        onChange={(e) => updateVariant(idx, "weight", e.target.value)}
                        className="w-16 text-sm text-center"
                      />
                      <span className="text-muted-foreground text-sm">%</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive h-8 w-8 p-0 shrink-0"
                      onClick={() => removeVariant(idx)}
                      disabled={variants.length <= 2}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>

              {!weightOk && (
                <p className="text-xs text-red-500">Weights must sum to exactly 100%</p>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                className="bg-orange-500 hover:bg-orange-600 text-white"
                disabled={creating || !testKey.trim() || !testName.trim() || variants.length < 2 || !weightOk}
                onClick={() => void createTest()}
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {creating ? "Creating…" : "Create Test"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Test list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : tests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <FlaskConical className="w-10 h-10 opacity-30" />
          <p className="text-sm">No A/B tests yet. Create one above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tests.map((test) => {
            const isExpanded = expanded === test.id;
            return (
              <Card key={test.id} className={`transition-opacity ${test.active ? "" : "opacity-70"}`}>
                <CardContent className="pt-4 pb-4">
                  <div className="space-y-3">
                    {/* Top row */}
                    <div className="flex items-start gap-3">
                      {/* Active toggle */}
                      <div className="pt-0.5 shrink-0">
                        <Switch
                          checked={test.active}
                          disabled={toggling === test.id}
                          onCheckedChange={() => void toggleTest(test)}
                        />
                      </div>

                      {/* Main info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-gray-900 dark:text-white">{test.name}</span>
                          {test.active ? (
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-[11px]">
                              Running
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[11px]">Paused</Badge>
                          )}
                        </div>

                        {/* Key with copy */}
                        <div className="flex items-center gap-1.5 mt-1">
                          <code className="text-xs font-mono text-muted-foreground bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded">
                            {test.key}
                          </code>
                          <button
                            onClick={() => void copyKey(test.key)}
                            className="text-muted-foreground hover:text-orange-500 transition-colors"
                            title="Copy test key"
                          >
                            {copied === test.key ? (
                              <Check className="w-3.5 h-3.5 text-green-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>

                        {test.description && (
                          <p className="text-xs text-muted-foreground mt-1">{test.description}</p>
                        )}

                        {/* Stats */}
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {test.participantCount.toLocaleString()} participants
                          </span>
                          <span>{test.variants.length} variants</span>
                          <span>Created {new Date(test.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {/* Expand toggle */}
                      <button
                        onClick={() => setExpanded(isExpanded ? null : test.id)}
                        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-1"
                        title={isExpanded ? "Collapse" : "Show variants"}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Variant breakdown (expandable) */}
                    {isExpanded && (
                      <div className="ml-9 border border-[#E5E7EB] dark:border-white/10 rounded-lg overflow-hidden">
                        <div className="px-3 py-2 bg-gray-50 dark:bg-white/5 border-b border-[#E5E7EB] dark:border-white/10">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Variant Weights
                          </span>
                        </div>
                        <div className="divide-y divide-[#E5E7EB] dark:divide-white/10">
                          {test.variants.map((v) => (
                            <div key={v.key} className="flex items-center justify-between px-3 py-2.5">
                              <div className="flex items-center gap-2">
                                <code className="text-xs font-mono text-muted-foreground bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded">
                                  {v.key}
                                </code>
                                <span className="text-sm text-gray-900 dark:text-white">{v.label}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-24 h-1.5 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-orange-500 rounded-full"
                                    style={{ width: `${v.weight}%` }}
                                  />
                                </div>
                                <span className="text-xs font-semibold text-orange-600 dark:text-orange-400 w-10 text-right">
                                  {v.weight}%
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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
