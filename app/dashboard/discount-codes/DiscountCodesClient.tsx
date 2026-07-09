"use client";
import { useState } from "react";
import { Tag, Zap, Download, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PromoCode = {
  id: string;
  code: string;
  discountPercent: number | null;
  discountAmount: number | null;
  maxUses: number | null;
  usedCount: number;
  active: boolean;
  expiresAt: Date | null;
  createdAt: Date;
};

function downloadCsv(codes: PromoCode[]) {
  const header = "Code,Discount,Max Uses,Expires";
  const rows = codes.map((c) => {
    const discount = c.discountPercent ? `${c.discountPercent}%` : c.discountAmount ? `£${(c.discountAmount / 100).toFixed(2)}` : "";
    const expires = c.expiresAt ? new Date(c.expiresAt).toLocaleDateString("en-GB") : "Never";
    return `${c.code},${discount},${c.maxUses ?? "Unlimited"},${expires}`;
  });
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `promo-codes-${Date.now()}.csv`; a.click();
  URL.revokeObjectURL(url);
}

const inputCls = "w-full rounded-lg border border-input bg-background text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-orange-500 text-foreground placeholder:text-muted-foreground";

export default function DiscountCodesClient({ initialCodes }: { initialCodes: PromoCode[] }) {
  const [codes, setCodes] = useState<PromoCode[]>(initialCodes);
  const [form, setForm] = useState({ code: "", type: "percent", value: "", maxUses: "", expiresAt: "" });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [bulk, setBulk] = useState({ prefix: "LAUNCH", count: "10", type: "percent", value: "", maxUses: "", expiresAt: "" });
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [lastBatch, setLastBatch] = useState<PromoCode[]>([]);

  async function create() {
    if (!form.code || !form.value) { setError("Code and discount value are required"); return; }
    setCreating(true); setError("");
    const body: Record<string, unknown> = {
      code: form.code.toUpperCase().trim(),
      discountPercent: form.type === "percent" ? parseInt(form.value) : null,
      discountAmount: form.type === "fixed" ? parseFloat(form.value) : null,
      maxUses: form.maxUses ? parseInt(form.maxUses) : null,
      expiresAt: form.expiresAt || null,
    };
    const res = await fetch("/api/creator/promo-codes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) { const created = await res.json(); setCodes((c) => [created, ...c]); setForm({ code: "", type: "percent", value: "", maxUses: "", expiresAt: "" }); }
    else { setError("Failed to create code. The code may already exist."); }
    setCreating(false);
  }

  async function bulkGenerate() {
    if (!bulk.value) { setBulkError("Discount value is required"); return; }
    const count = parseInt(bulk.count) || 10;
    if (count < 1 || count > 100) { setBulkError("Count must be 1–100"); return; }
    setBulkGenerating(true); setBulkError(""); setLastBatch([]);
    const body: Record<string, unknown> = {
      prefix: bulk.prefix.trim() || "CODE", count,
      discountPercent: bulk.type === "percent" ? parseInt(bulk.value) : null,
      discountAmount: bulk.type === "fixed" ? parseFloat(bulk.value) : null,
      maxUses: bulk.maxUses ? parseInt(bulk.maxUses) : null,
      expiresAt: bulk.expiresAt || null,
    };
    const res = await fetch("/api/creator/promo-codes/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    if (res.ok && data.codes) { setCodes((c) => [...data.codes, ...c]); setLastBatch(data.codes); }
    else { setBulkError(data.error ?? "Failed to generate codes"); }
    setBulkGenerating(false);
  }

  async function deactivate(id: string) {
    await fetch("/api/creator/promo-codes", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setCodes((c) => c.map((code) => code.id === id ? { ...code, active: false } : code));
  }

  const labelFor = (c: PromoCode) => {
    if (c.discountPercent) return `${c.discountPercent}% off`;
    if (c.discountAmount) return `£${(c.discountAmount / 100).toFixed(2)} off`;
    return "—";
  };

  return (
    <div className="min-h-screen bg-background p-6 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <Tag className="w-5 h-5 text-orange-400" />
            <h1 className="text-2xl font-bold text-foreground">Discount Codes</h1>
          </div>
          <p className="text-sm text-muted-foreground">Create codes customers use at checkout — e.g. <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">LAUNCH50</code> for 50% off.</p>
        </div>

        {/* Single code form */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground">Create single code</h2>
            <button
              onClick={() => { setShowBulk((v) => !v); setBulkError(""); setLastBatch([]); }}
              className={cn("flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors",
                showBulk ? "border-orange-500/30 bg-orange-500/10 text-orange-400" : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {showBulk ? <><X className="w-3 h-3" />Close bulk</> : <><Zap className="w-3 h-3" />Bulk generate</>}
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Code</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="LAUNCH50"
                className="font-mono tracking-wider text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Type</Label>
              <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className={inputCls}>
                <option value="percent">% Off</option>
                <option value="fixed">£ Off</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{form.type === "percent" ? "Percent (%)" : "Amount (£)"}</Label>
              <Input type="number" value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                placeholder={form.type === "percent" ? "20" : "5.00"} min="0" max={form.type === "percent" ? "100" : undefined} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Max uses</Label>
              <Input type="number" value={form.maxUses} onChange={(e) => setForm((f) => ({ ...f, maxUses: e.target.value }))}
                placeholder="Unlimited" min="1" />
            </div>
          </div>

          <div className="flex items-end gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Expiry (optional)</Label>
              <Input type="date" value={form.expiresAt} onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))} className="w-44" />
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button onClick={create} disabled={creating} className="bg-orange-500 hover:bg-orange-600 text-white h-9 text-xs font-semibold">
            {creating ? "Creating…" : "Create Code"}
          </Button>
        </div>

        {/* Bulk generator */}
        {showBulk && (
          <div className="bg-orange-500/5 border border-orange-500/20 rounded-2xl p-5 space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-orange-400" />
                <h2 className="text-sm font-bold text-orange-400">Bulk code generator</h2>
              </div>
              <p className="text-xs text-muted-foreground">Generate up to 100 unique codes at once. Download as CSV to share with your audience.</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: "Prefix", field: "prefix", type: "text", placeholder: "LAUNCH", max: 16 },
                { label: "Count (1–100)", field: "count", type: "number", placeholder: "10" },
                { label: "Type", field: "type", type: "select" },
                { label: bulk.type === "percent" ? "Percent (%)" : "Amount (£)", field: "value", type: "number", placeholder: bulk.type === "percent" ? "20" : "5.00" },
                { label: "Max uses/code", field: "maxUses", type: "number", placeholder: "1" },
              ].map(({ label, field, type, placeholder, max }) => (
                <div key={field} className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{label}</Label>
                  {type === "select" ? (
                    <select value={bulk.type} onChange={(e) => setBulk((b) => ({ ...b, type: e.target.value }))} className={inputCls}>
                      <option value="percent">% Off</option>
                      <option value="fixed">£ Off</option>
                    </select>
                  ) : (
                    <Input
                      type={type}
                      value={bulk[field as keyof typeof bulk]}
                      onChange={(e) => {
                        let v = e.target.value;
                        if (field === "prefix") v = v.toUpperCase().replace(/[^A-Z0-9]/g, "");
                        setBulk((b) => ({ ...b, [field]: v }));
                      }}
                      placeholder={placeholder}
                      maxLength={max}
                      min={type === "number" ? "0" : undefined}
                      className={field === "prefix" ? "font-mono tracking-wider" : ""}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Expiry date (optional)</Label>
              <Input type="date" value={bulk.expiresAt} onChange={(e) => setBulk((b) => ({ ...b, expiresAt: e.target.value }))} className="w-44" />
            </div>

            {bulkError && <p className="text-sm text-red-500">{bulkError}</p>}

            <div className="flex items-center gap-3 flex-wrap">
              <Button onClick={bulkGenerate} disabled={bulkGenerating} className="bg-orange-500 hover:bg-orange-600 text-white gap-1.5 h-9 text-xs font-semibold">
                <Zap className="w-3.5 h-3.5" />{bulkGenerating ? "Generating…" : `Generate ${bulk.count || 10} codes`}
              </Button>
              {lastBatch.length > 0 && (
                <Button variant="outline" onClick={() => downloadCsv(lastBatch)} className="gap-1.5 h-9 text-xs border-orange-500/30 text-orange-400 hover:bg-orange-500/10">
                  <Download className="w-3.5 h-3.5" />Download CSV ({lastBatch.length} codes)
                </Button>
              )}
            </div>

            {lastBatch.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-4 max-h-36 overflow-y-auto">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Generated codes preview</p>
                <div className="flex flex-wrap gap-1.5">
                  {lastBatch.map((c) => (
                    <span key={c.id} className="font-mono text-xs font-bold bg-muted px-2 py-0.5 rounded-md text-foreground">{c.code}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Codes table */}
        {codes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-14 text-center">
            <Tag className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground font-medium">No codes yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Create your first discount code above.</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
              <span className="text-sm font-semibold text-foreground">{codes.filter((c) => c.active).length} active codes</span>
              <Button variant="outline" size="sm" onClick={() => downloadCsv(codes.filter((c) => c.active))}
                className="gap-1.5 h-7 text-xs border-border text-muted-foreground hover:text-foreground">
                <Download className="w-3 h-3" />Export active
              </Button>
            </div>

            {/* Header row */}
            <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr_auto] gap-3 px-5 py-2.5 border-b border-border text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <span>Code</span><span>Discount</span><span>Used</span><span>Status</span><span>Expires</span><span></span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-border">
              {codes.map((c) => (
                <div key={c.id} className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr_auto] gap-3 px-5 py-3.5 items-center hover:bg-muted/30 transition-colors">
                  <span className="font-mono text-sm font-bold bg-muted px-2.5 py-1 rounded-lg text-foreground inline-block">{c.code}</span>
                  <span className="text-sm font-semibold text-orange-400">{labelFor(c)}</span>
                  <span className="text-sm text-foreground">{c.usedCount}{c.maxUses ? ` / ${c.maxUses}` : ""}</span>
                  <span className={cn("text-[10px] px-2.5 py-0.5 rounded-full font-bold border w-fit",
                    c.active ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-muted text-muted-foreground border-border")}>
                    {c.active ? "Active" : "Inactive"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Never"}
                  </span>
                  <div>
                    {c.active && (
                      <button onClick={() => deactivate(c.id)}
                        className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-border text-muted-foreground hover:border-red-500/30 hover:text-red-500 hover:bg-red-500/5 transition-colors">
                        Deactivate
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
