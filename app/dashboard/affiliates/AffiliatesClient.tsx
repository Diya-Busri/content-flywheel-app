"use client";

import { useState } from "react";
import { Link2, Copy, Check, Users, TrendingUp, PoundSterling, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type AffiliateLink = {
  id: string;
  affiliateName: string;
  affiliateEmail: string | null;
  code: string;
  commissionPercent: number;
  totalEarnedCents: number;
  active: boolean;
  createdAt: Date;
};

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://contentflywheel.co.uk";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className={cn("flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-all",
        copied ? "border-green-500/40 bg-green-500/10 text-green-500" : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-orange-500/40"
      )}
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

export default function AffiliatesClient({
  initialLinks,
  creatorUserId,
}: {
  initialLinks: AffiliateLink[];
  creatorUserId: string;
}) {
  const [links, setLinks] = useState<AffiliateLink[]>(initialLinks);
  const [form, setForm] = useState({ affiliateName: "", affiliateEmail: "", commissionPercent: "20" });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  const storeUrl = `${BASE_URL}/c/${creatorUserId}`;
  const totalCommissionCents = links.reduce((s, l) => s + (l.totalEarnedCents ?? 0), 0);
  const activeCount = links.filter(l => l.active).length;

  async function create() {
    if (!form.affiliateName.trim()) { setError("Name is required"); return; }
    setCreating(true);
    setError("");
    const res = await fetch("/api/affiliate-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        affiliateName: form.affiliateName.trim(),
        affiliateEmail: form.affiliateEmail.trim() || null,
        commissionPercent: parseInt(form.commissionPercent) || 20,
      }),
    });
    if (res.ok) {
      const created = await res.json();
      setLinks(l => [created, ...l]);
      setForm({ affiliateName: "", affiliateEmail: "", commissionPercent: "20" });
      setShowForm(false);
    } else {
      setError("Failed to create link.");
    }
    setCreating(false);
  }

  async function deactivate(id: string) {
    await fetch(`/api/affiliate-links/${id}`, { method: "DELETE" });
    setLinks(l => l.map(link => link.id === id ? { ...link, active: false } : link));
  }

  return (
    <div className="min-h-screen bg-background p-6 md:p-8">
      <div className="max-w-4xl mx-auto space-y-7">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <Link2 className="w-5 h-5 text-orange-400" />
              <h1 className="text-2xl font-bold text-foreground">Affiliates</h1>
            </div>
            <p className="text-sm text-muted-foreground">Create referral links for partners — they earn a commission on every sale they refer.</p>
          </div>
          <Button onClick={() => setShowForm(v => !v)} size="sm"
            className={cn("gap-1.5 text-xs", showForm ? "bg-muted text-foreground hover:bg-muted" : "bg-orange-500 hover:bg-orange-600 text-white")}>
            {showForm ? <><X className="w-3.5 h-3.5" />Cancel</> : <><Plus className="w-3.5 h-3.5" />Add affiliate</>}
          </Button>
        </div>

        {/* Stats */}
        {links.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Active affiliates", value: activeCount.toString(), icon: Users, color: "text-blue-400", grad: "from-blue-500 to-blue-600" },
              { label: "Total affiliates", value: links.length.toString(), icon: Link2, color: "text-purple-400", grad: "from-purple-500 to-purple-600" },
              { label: "Total commissions", value: `£${(totalCommissionCents / 100).toFixed(2)}`, icon: PoundSterling, color: "text-orange-400", grad: "from-orange-500 to-amber-500" },
            ].map(s => (
              <div key={s.label} className="bg-card border border-border rounded-2xl p-5">
                <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${s.grad} flex items-center justify-center mb-3`}>
                  <s.icon className="w-4 h-4 text-white" />
                </div>
                <p className="text-2xl font-black text-foreground leading-none mb-1">{s.value}</p>
                <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* How it works */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-orange-500/8 border border-orange-500/20">
          <TrendingUp className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
          <div className="text-sm text-foreground/80">
            <strong className="font-semibold text-foreground">How it works:</strong> Affiliates share your store with their unique link{" "}
            <code className="text-xs bg-orange-500/10 px-1.5 py-0.5 rounded font-mono text-orange-400">{storeUrl}?ref=code</code>.
            {" "}When someone buys, their commission is recorded automatically.
          </div>
        </div>

        {/* Create form */}
        {showForm && (
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-foreground">New affiliate link</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Name</Label>
                <Input value={form.affiliateName} onChange={e => setForm(f => ({ ...f, affiliateName: e.target.value }))}
                  placeholder="Jane Smith" onKeyDown={e => e.key === "Enter" && create()} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Email (optional)</Label>
                <Input type="email" value={form.affiliateEmail} onChange={e => setForm(f => ({ ...f, affiliateEmail: e.target.value }))}
                  placeholder="jane@example.com" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Commission %</Label>
                <Input type="number" value={form.commissionPercent} onChange={e => setForm(f => ({ ...f, commissionPercent: e.target.value }))}
                  min="0" max="100" />
              </div>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button onClick={create} disabled={creating} className="bg-orange-500 hover:bg-orange-600 text-white gap-2 h-9">
              {creating ? "Creating…" : "Create Link"}
            </Button>
          </div>
        )}

        {/* Links list */}
        {links.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center">
            <Link2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground font-medium">No affiliate links yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Click &ldquo;Add affiliate&rdquo; above to create your first referral link.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {links.map(l => (
              <div key={l.id} className={cn("bg-card border rounded-xl p-4 flex items-center gap-4 flex-wrap", l.active ? "border-border" : "border-border opacity-50")}>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm text-foreground">{l.affiliateName}</p>
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-bold border", l.active ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-muted text-muted-foreground border-border")}>
                      {l.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  {l.affiliateEmail && <p className="text-xs text-muted-foreground mt-0.5">{l.affiliateEmail}</p>}
                </div>

                {/* Code */}
                <div className="flex items-center gap-2 shrink-0">
                  <code className="text-xs bg-muted px-2.5 py-1.5 rounded-lg font-mono text-foreground/70">?ref={l.code}</code>
                  <CopyButton text={`${storeUrl}?ref=${l.code}`} />
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-center">
                    <p className="text-sm font-bold text-orange-400">{l.commissionPercent}%</p>
                    <p className="text-[10px] text-muted-foreground">commission</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-foreground">£{((l.totalEarnedCents ?? 0) / 100).toFixed(2)}</p>
                    <p className="text-[10px] text-muted-foreground">earned</p>
                  </div>
                </div>

                {/* Deactivate */}
                {l.active && (
                  <button onClick={() => deactivate(l.id)}
                    className="shrink-0 text-xs font-semibold text-muted-foreground hover:text-red-500 border border-border hover:border-red-500/30 px-2.5 py-1.5 rounded-lg transition-all">
                    Deactivate
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
