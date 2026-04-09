"use client";
import { useState } from "react";

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

export default function DiscountCodesClient({ initialCodes }: { initialCodes: PromoCode[] }) {
  const [codes, setCodes] = useState<PromoCode[]>(initialCodes);
  const [form, setForm] = useState({ code: "", type: "percent", value: "", maxUses: "", expiresAt: "" });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function create() {
    if (!form.code || !form.value) { setError("Code and discount value are required"); return; }
    setCreating(true);
    setError("");
    const body: Record<string, unknown> = {
      code: form.code.toUpperCase().trim(),
      discountPercent: form.type === "percent" ? parseInt(form.value) : null,
      discountAmount: form.type === "fixed" ? Math.round(parseFloat(form.value) * 100) : null,
      maxUses: form.maxUses ? parseInt(form.maxUses) : null,
      expiresAt: form.expiresAt || null,
    };
    const res = await fetch("/api/creator-promo-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const created = await res.json();
      setCodes((c) => [created, ...c]);
      setForm({ code: "", type: "percent", value: "", maxUses: "", expiresAt: "" });
    } else {
      setError("Failed to create code. The code may already exist.");
    }
    setCreating(false);
  }

  async function deactivate(id: string) {
    await fetch(`/api/creator-promo-codes/${id}`, { method: "DELETE" });
    setCodes((c) => c.map((code) => code.id === id ? { ...code, active: false } : code));
  }

  const labelFor = (c: PromoCode) => {
    if (c.discountPercent) return `${c.discountPercent}% off`;
    if (c.discountAmount) return `£${(c.discountAmount / 100).toFixed(2)} off`;
    return "—";
  };

  return (
    <div style={{ padding: "32px 24px", maxWidth: "900px" }}>
      <h1 style={{ margin: "0 0 4px", fontSize: "24px", fontWeight: 800, color: "#111827" }}>🎟️ Discount Codes</h1>
      <p style={{ margin: "0 0 32px", fontSize: "14px", color: "#6b7280" }}>Create promo codes buyers can use at checkout.</p>

      {/* Create form */}
      <div style={{ background: "#fff", borderRadius: "16px", padding: "24px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: "32px" }}>
        <h2 style={{ margin: "0 0 16px", fontSize: "15px", fontWeight: 700, color: "#111827" }}>Create new code</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "12px", marginBottom: "12px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#374151", marginBottom: "4px" }}>Code</label>
            <input
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              placeholder="LAUNCH50"
              style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px", fontWeight: 600, letterSpacing: "0.06em", boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#374151", marginBottom: "4px" }}>Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px", boxSizing: "border-box", background: "#fff" }}
            >
              <option value="percent">% Off</option>
              <option value="fixed">£ Off</option>
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#374151", marginBottom: "4px" }}>
              {form.type === "percent" ? "Percent (%)" : "Amount (£)"}
            </label>
            <input
              type="number"
              value={form.value}
              onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
              placeholder={form.type === "percent" ? "20" : "5.00"}
              min="0"
              max={form.type === "percent" ? "100" : undefined}
              style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px", boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#374151", marginBottom: "4px" }}>Max Uses</label>
            <input
              type="number"
              value={form.maxUses}
              onChange={(e) => setForm((f) => ({ ...f, maxUses: e.target.value }))}
              placeholder="Unlimited"
              min="1"
              style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px", boxSizing: "border-box" }}
            />
          </div>
        </div>
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#374151", marginBottom: "4px" }}>Expiry Date (optional)</label>
          <input
            type="date"
            value={form.expiresAt}
            onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
            style={{ padding: "9px 12px", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px" }}
          />
        </div>
        {error && <p style={{ color: "#dc2626", fontSize: "13px", marginBottom: "12px" }}>{error}</p>}
        <button
          onClick={create}
          disabled={creating}
          style={{ padding: "10px 24px", borderRadius: "10px", background: "linear-gradient(135deg,#f97316,#ea580c)", color: "#fff", fontWeight: 700, fontSize: "14px", border: "none", cursor: "pointer" }}
        >
          {creating ? "Creating…" : "Create Code"}
        </button>
      </div>

      {/* Codes table */}
      {codes.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px", color: "#9ca3af", fontSize: "14px" }}>
          No codes yet. Create your first discount code above.
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: "16px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
                {["Code", "Discount", "Used", "Status", "Expires", ""].map((h) => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => (
                <tr key={c.id} style={{ borderBottom: "1px solid #f9fafb" }}>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "14px", color: "#111827", background: "#f3f4f6", padding: "3px 8px", borderRadius: "6px" }}>
                      {c.code}
                    </span>
                  </td>
                  <td style={{ padding: "14px 16px", fontSize: "14px", fontWeight: 600, color: "#f97316" }}>{labelFor(c)}</td>
                  <td style={{ padding: "14px 16px", fontSize: "14px", color: "#374151" }}>
                    {c.usedCount}{c.maxUses ? ` / ${c.maxUses}` : ""}
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: 700,
                      background: c.active ? "#f0fdf4" : "#f9fafb",
                      color: c.active ? "#16a34a" : "#9ca3af",
                      border: `1px solid ${c.active ? "#86efac" : "#e5e7eb"}` }}>
                      {c.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={{ padding: "14px 16px", fontSize: "13px", color: "#6b7280" }}>
                    {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Never"}
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    {c.active && (
                      <button
                        onClick={() => deactivate(c.id)}
                        style={{ padding: "6px 12px", borderRadius: "8px", border: "1px solid #fee2e2", background: "#fef2f2", color: "#dc2626", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
                      >
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
