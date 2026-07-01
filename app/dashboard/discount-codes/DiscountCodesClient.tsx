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
  a.href = url;
  a.download = `promo-codes-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DiscountCodesClient({ initialCodes }: { initialCodes: PromoCode[] }) {
  const [codes, setCodes] = useState<PromoCode[]>(initialCodes);

  // Single code form
  const [form, setForm] = useState({ code: "", type: "percent", value: "", maxUses: "", expiresAt: "" });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  // Bulk form
  const [showBulk, setShowBulk] = useState(false);
  const [bulk, setBulk] = useState({ prefix: "LAUNCH", count: "10", type: "percent", value: "", maxUses: "", expiresAt: "" });
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [lastBatch, setLastBatch] = useState<PromoCode[]>([]);

  async function create() {
    if (!form.code || !form.value) { setError("Code and discount value are required"); return; }
    setCreating(true);
    setError("");
    const body: Record<string, unknown> = {
      code: form.code.toUpperCase().trim(),
      discountPercent: form.type === "percent" ? parseInt(form.value) : null,
      discountAmount: form.type === "fixed" ? parseFloat(form.value) : null,
      maxUses: form.maxUses ? parseInt(form.maxUses) : null,
      expiresAt: form.expiresAt || null,
    };
    const res = await fetch("/api/creator/promo-codes", {
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

  async function bulkGenerate() {
    if (!bulk.value) { setBulkError("Discount value is required"); return; }
    const count = parseInt(bulk.count) || 10;
    if (count < 1 || count > 100) { setBulkError("Count must be 1–100"); return; }
    setBulkGenerating(true);
    setBulkError("");
    setLastBatch([]);
    const body: Record<string, unknown> = {
      prefix: bulk.prefix.trim() || "CODE",
      count,
      discountPercent: bulk.type === "percent" ? parseInt(bulk.value) : null,
      discountAmount: bulk.type === "fixed" ? parseFloat(bulk.value) : null,
      maxUses: bulk.maxUses ? parseInt(bulk.maxUses) : null,
      expiresAt: bulk.expiresAt || null,
    };
    const res = await fetch("/api/creator/promo-codes/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (res.ok && data.codes) {
      setCodes((c) => [...data.codes, ...c]);
      setLastBatch(data.codes);
    } else {
      setBulkError(data.error ?? "Failed to generate codes");
    }
    setBulkGenerating(false);
  }

  async function deactivate(id: string) {
    await fetch("/api/creator/promo-codes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setCodes((c) => c.map((code) => code.id === id ? { ...code, active: false } : code));
  }

  const labelFor = (c: PromoCode) => {
    if (c.discountPercent) return `${c.discountPercent}% off`;
    if (c.discountAmount) return `£${(c.discountAmount / 100).toFixed(2)} off`;
    return "—";
  };

  return (
    <div style={{ padding: "32px 24px", maxWidth: "900px" }}>
      <h1 style={{ margin: "0 0 4px", fontSize: "24px", fontWeight: 800, color: "#111827" }}>🎟️ Store Discount Codes</h1>
      <p style={{ margin: "0 0 32px", fontSize: "14px", color: "#6b7280" }}>Create discount codes your customers use at checkout — e.g. <strong>LAUNCH50</strong> for 50% off.</p>

      {/* Single code form */}
      <div style={{ background: "#fff", borderRadius: "16px", padding: "24px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#111827" }}>Create single code</h2>
          <button
            onClick={() => { setShowBulk((v) => !v); setBulkError(""); setLastBatch([]); }}
            style={{ padding: "7px 16px", borderRadius: "8px", border: "1px solid #e5e7eb", background: showBulk ? "#fff7ed" : "#fff", color: showBulk ? "#f97316" : "#374151", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}
          >
            {showBulk ? "✕ Close bulk" : "⚡ Bulk generate"}
          </button>
        </div>
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
          style={{ padding: "10px 24px", borderRadius: "10px", background: "linear-gradient(135deg,#f97316,#ea580c)", color: "#fff", fontWeight: 700, fontSize: "14px", border: "none", cursor: "pointer", opacity: creating ? 0.7 : 1 }}
        >
          {creating ? "Creating…" : "Create Code"}
        </button>
      </div>

      {/* Bulk generator */}
      {showBulk && (
        <div style={{ background: "#fff7ed", borderRadius: "16px", padding: "24px", border: "1px solid #fed7aa", marginBottom: "20px" }}>
          <h2 style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 700, color: "#c2410c" }}>⚡ Bulk code generator</h2>
          <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#9a3412" }}>Generate up to 100 unique codes at once. Download as CSV to share with your audience.</p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: "12px", marginBottom: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#374151", marginBottom: "4px" }}>Prefix</label>
              <input
                value={bulk.prefix}
                onChange={(e) => setBulk((b) => ({ ...b, prefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") }))}
                placeholder="LAUNCH"
                maxLength={16}
                style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #fed7aa", background: "#fff", fontSize: "13px", fontWeight: 600, letterSpacing: "0.05em", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#374151", marginBottom: "4px" }}>Count (1–100)</label>
              <input
                type="number"
                value={bulk.count}
                onChange={(e) => setBulk((b) => ({ ...b, count: e.target.value }))}
                min="1"
                max="100"
                style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #fed7aa", background: "#fff", fontSize: "13px", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#374151", marginBottom: "4px" }}>Type</label>
              <select
                value={bulk.type}
                onChange={(e) => setBulk((b) => ({ ...b, type: e.target.value }))}
                style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #fed7aa", background: "#fff", fontSize: "13px", boxSizing: "border-box" }}
              >
                <option value="percent">% Off</option>
                <option value="fixed">£ Off</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#374151", marginBottom: "4px" }}>
                {bulk.type === "percent" ? "Percent (%)" : "Amount (£)"}
              </label>
              <input
                type="number"
                value={bulk.value}
                onChange={(e) => setBulk((b) => ({ ...b, value: e.target.value }))}
                placeholder={bulk.type === "percent" ? "20" : "5.00"}
                min="0"
                max={bulk.type === "percent" ? "100" : undefined}
                style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #fed7aa", background: "#fff", fontSize: "13px", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#374151", marginBottom: "4px" }}>Max Uses/Code</label>
              <input
                type="number"
                value={bulk.maxUses}
                onChange={(e) => setBulk((b) => ({ ...b, maxUses: e.target.value }))}
                placeholder="1 (recommended)"
                min="1"
                style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #fed7aa", background: "#fff", fontSize: "13px", boxSizing: "border-box" }}
              />
            </div>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#374151", marginBottom: "4px" }}>Expiry Date (optional)</label>
            <input
              type="date"
              value={bulk.expiresAt}
              onChange={(e) => setBulk((b) => ({ ...b, expiresAt: e.target.value }))}
              style={{ padding: "9px 12px", borderRadius: "8px", border: "1px solid #fed7aa", background: "#fff", fontSize: "13px" }}
            />
          </div>

          {bulkError && <p style={{ color: "#dc2626", fontSize: "13px", marginBottom: "12px" }}>{bulkError}</p>}

          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <button
              onClick={bulkGenerate}
              disabled={bulkGenerating}
              style={{ padding: "10px 24px", borderRadius: "10px", background: "linear-gradient(135deg,#f97316,#ea580c)", color: "#fff", fontWeight: 700, fontSize: "14px", border: "none", cursor: "pointer", opacity: bulkGenerating ? 0.7 : 1 }}
            >
              {bulkGenerating ? "Generating…" : `Generate ${bulk.count || 10} codes`}
            </button>
            {lastBatch.length > 0 && (
              <button
                onClick={() => downloadCsv(lastBatch)}
                style={{ padding: "10px 20px", borderRadius: "10px", border: "1px solid #f97316", background: "#fff", color: "#f97316", fontWeight: 700, fontSize: "14px", cursor: "pointer" }}
              >
                ⬇ Download CSV ({lastBatch.length} codes)
              </button>
            )}
          </div>

          {lastBatch.length > 0 && (
            <div style={{ marginTop: "16px", background: "#fff", borderRadius: "10px", border: "1px solid #fed7aa", padding: "12px 16px", maxHeight: "160px", overflowY: "auto" }}>
              <p style={{ margin: "0 0 8px", fontSize: "12px", fontWeight: 600, color: "#374151" }}>Generated codes preview:</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {lastBatch.map((c) => (
                  <span key={c.id} style={{ fontFamily: "monospace", fontSize: "12px", fontWeight: 700, background: "#f3f4f6", padding: "3px 8px", borderRadius: "6px", color: "#111827" }}>
                    {c.code}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Codes table */}
      {codes.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px", color: "#9ca3af", fontSize: "14px" }}>
          No codes yet. Create your first discount code above.
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: "16px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #f3f4f6" }}>
            <span style={{ fontSize: "14px", fontWeight: 600, color: "#374151" }}>{codes.filter((c) => c.active).length} active codes</span>
            <button
              onClick={() => downloadCsv(codes.filter((c) => c.active))}
              style={{ padding: "6px 14px", borderRadius: "8px", border: "1px solid #e5e7eb", background: "#fff", color: "#374151", fontWeight: 600, fontSize: "12px", cursor: "pointer" }}
            >
              ⬇ Export all active
            </button>
          </div>
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
