"use client";
import { useState } from "react";

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
  const [copied, setCopied] = useState<string | null>(null);

  const storeUrl = `${BASE_URL}/c/${creatorUserId}`;

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
      setLinks((l) => [created, ...l]);
      setForm({ affiliateName: "", affiliateEmail: "", commissionPercent: "20" });
    } else {
      setError("Failed to create link.");
    }
    setCreating(false);
  }

  async function deactivate(id: string) {
    await fetch(`/api/affiliate-links/${id}`, { method: "DELETE" });
    setLinks((l) => l.map((link) => link.id === id ? { ...link, active: false } : link));
  }

  function copyLink(code: string) {
    const url = `${storeUrl}?ref=${code}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(code);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  const totalCommissionCents = links.reduce((s, l) => s + (l.totalEarnedCents ?? 0), 0);

  return (
    <div style={{ padding: "32px 24px", maxWidth: "960px" }}>
      <h1 style={{ margin: "0 0 4px", fontSize: "24px", fontWeight: 800, color: "#111827" }}>🔗 Affiliates</h1>
      <p style={{ margin: "0 0 20px", fontSize: "14px", color: "#6b7280" }}>
        Create referral links for partners. They earn a commission on every sale they refer.
      </p>

      {/* Summary stats */}
      {links.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "28px" }}>
          {[
            { label: "Active affiliates", value: links.filter(l => l.active).length.toString() },
            { label: "Total affiliates", value: links.length.toString() },
            { label: "Total commissions earned", value: `£${(totalCommissionCents / 100).toFixed(2)}` },
          ].map((s) => (
            <div key={s.label} style={{ background: "#fff", borderRadius: "12px", padding: "16px 20px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", border: "1px solid #f3f4f6" }}>
              <p style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</p>
              <p style={{ margin: 0, fontSize: "22px", fontWeight: 800, color: "#111827" }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* How it works */}
      <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: "10px", padding: "12px 16px", marginBottom: "28px" }}>
        <p style={{ margin: 0, fontSize: "13px", color: "#92400e" }}>
          💡 <strong>How it works:</strong> Affiliates share your store link with their unique code
          (e.g. <code style={{ background: "#fef3c7", padding: "1px 4px", borderRadius: "4px" }}>{storeUrl}?ref=their-code</code>).
          When someone clicks and buys, the commission is recorded automatically.
        </p>
      </div>

      {/* Create form */}
      <div style={{ background: "#fff", borderRadius: "16px", padding: "24px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: "32px" }}>
        <h2 style={{ margin: "0 0 16px", fontSize: "15px", fontWeight: 700, color: "#111827" }}>Add affiliate</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 120px", gap: "12px", marginBottom: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#374151", marginBottom: "4px" }}>Name</label>
            <input
              value={form.affiliateName}
              onChange={(e) => setForm((f) => ({ ...f, affiliateName: e.target.value }))}
              placeholder="Jane Smith"
              style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px", boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#374151", marginBottom: "4px" }}>Email (optional)</label>
            <input
              value={form.affiliateEmail}
              onChange={(e) => setForm((f) => ({ ...f, affiliateEmail: e.target.value }))}
              placeholder="jane@example.com"
              type="email"
              style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px", boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#374151", marginBottom: "4px" }}>Commission %</label>
            <input
              type="number"
              value={form.commissionPercent}
              onChange={(e) => setForm((f) => ({ ...f, commissionPercent: e.target.value }))}
              min="0" max="100"
              style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px", boxSizing: "border-box" }}
            />
          </div>
        </div>
        {error && <p style={{ color: "#dc2626", fontSize: "13px", marginBottom: "12px" }}>{error}</p>}
        <button onClick={create} disabled={creating}
          style={{ padding: "10px 24px", borderRadius: "10px", background: "linear-gradient(135deg,#f97316,#ea580c)", color: "#fff", fontWeight: 700, fontSize: "14px", border: "none", cursor: "pointer" }}>
          {creating ? "Creating…" : "Create Link"}
        </button>
      </div>

      {/* Links table */}
      {links.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px", color: "#9ca3af", fontSize: "14px" }}>
          No affiliate links yet. Create one above to get started.
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: "16px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
                {["Affiliate", "Referral Link", "Commission", "Earned", "Status", ""].map((h) => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {links.map((l) => (
                <tr key={l.id} style={{ borderBottom: "1px solid #f9fafb" }}>
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ fontWeight: 600, fontSize: "14px", color: "#111827" }}>{l.affiliateName}</div>
                    {l.affiliateEmail && <div style={{ fontSize: "12px", color: "#9ca3af" }}>{l.affiliateEmail}</div>}
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <code style={{ fontSize: "12px", background: "#f3f4f6", padding: "3px 8px", borderRadius: "6px", color: "#374151" }}>
                        ?ref={l.code}
                      </code>
                      <button onClick={() => copyLink(l.code)}
                        style={{ padding: "4px 10px", borderRadius: "6px", border: "1px solid #e5e7eb", background: "#fff", fontSize: "12px", cursor: "pointer", color: copied === l.code ? "#16a34a" : "#6b7280", fontWeight: 600 }}>
                        {copied === l.code ? "✓ Copied" : "Copy"}
                      </button>
                    </div>
                  </td>
                  <td style={{ padding: "14px 16px", fontSize: "14px", fontWeight: 600, color: "#f97316" }}>{l.commissionPercent}%</td>
                  <td style={{ padding: "14px 16px", fontSize: "14px", color: "#374151" }}>
                    £{((l.totalEarnedCents ?? 0) / 100).toFixed(2)}
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: 700,
                      background: l.active ? "#f0fdf4" : "#f9fafb",
                      color: l.active ? "#16a34a" : "#9ca3af",
                      border: `1px solid ${l.active ? "#86efac" : "#e5e7eb"}` }}>
                      {l.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    {l.active && (
                      <button onClick={() => deactivate(l.id)}
                        style={{ padding: "6px 12px", borderRadius: "8px", border: "1px solid #fee2e2", background: "#fef2f2", color: "#dc2626", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
