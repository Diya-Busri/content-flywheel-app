"use client";
import { useState, useMemo } from "react";
import { useDashboardTheme } from "@/components/dashboard-theme-provider";

type Expense = {
  id: string;
  amountPence: number;
  category: string;
  description: string;
  date: string;
  createdAt: string;
};

type Note = {
  id: string;
  content: string;
  createdAt: string;
};

const CATEGORIES = [
  { value: "hosting", label: "🖥️ Hosting & Infrastructure" },
  { value: "tools", label: "🔧 Tools & Software" },
  { value: "subscriptions", label: "📦 Subscriptions" },
  { value: "marketing", label: "📣 Marketing & Ads" },
  { value: "design", label: "🎨 Design & Assets" },
  { value: "legal", label: "⚖️ Legal & Compliance" },
  { value: "tax", label: "🧾 Tax & Accountancy" },
  { value: "other", label: "💼 Other" },
];

const CAT_COLORS: Record<string, string> = {
  hosting: "#6366f1",
  tools: "#f59e0b",
  subscriptions: "#3b82f6",
  marketing: "#ec4899",
  design: "#8b5cf6",
  legal: "#14b8a6",
  tax: "#ef4444",
  other: "#6b7280",
};

const UK_PERSONAL_ALLOWANCE = 12570_00; // in pence
const UK_BASIC_RATE = 0.20;
const UK_HIGHER_RATE = 0.40;
const UK_HIGHER_THRESHOLD = 50270_00; // in pence

function calcTax(profitPence: number): number {
  if (profitPence <= 0) return 0;
  if (profitPence <= UK_PERSONAL_ALLOWANCE) return 0;
  const taxable = profitPence - UK_PERSONAL_ALLOWANCE;
  const basicBand = Math.min(taxable, UK_HIGHER_THRESHOLD - UK_PERSONAL_ALLOWANCE);
  const higherBand = Math.max(0, taxable - (UK_HIGHER_THRESHOLD - UK_PERSONAL_ALLOWANCE));
  return Math.round(basicBand * UK_BASIC_RATE + higherBand * UK_HIGHER_RATE);
}

function fmt(pence: number) {
  const abs = Math.abs(pence);
  return `${pence < 0 ? "-" : ""}£${(abs / 100).toFixed(2)}`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function FinancesClient({
  initialExpenses,
  initialNotes,
  revenueFromOrders,
}: {
  initialExpenses: Expense[];
  initialNotes: Note[];
  revenueFromOrders: number; // pence
}) {
  const { theme } = useDashboardTheme();
  const dark = theme === "dark";

  // Theme-aware colour tokens
  const c = {
    text:       dark ? "#f9fafb"  : "#111827",
    textMuted:  dark ? "#9ca3af"  : "#6b7280",
    textSub:    dark ? "#d1d5db"  : "#374151",
    card:       dark ? "#1f2937"  : "#ffffff",
    border:     dark ? "#374151"  : "#e5e7eb",
    barTrack:   dark ? "#374151"  : "#f3f4f6",
    inputBg:    dark ? "#111827"  : "#ffffff",
    inputBorder:dark ? "#4b5563"  : "#d1d5db",
  };

  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [tab, setTab] = useState<"overview" | "expenses" | "notes">("overview");

  // Expense form
  const [form, setForm] = useState({ amount: "", category: "hosting", description: "", date: new Date().toISOString().slice(0, 10) });
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState("");

  // Note form
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  const totalExpensesPence = useMemo(() => expenses.reduce((s, e) => s + e.amountPence, 0), [expenses]);
  const profitPence = revenueFromOrders - totalExpensesPence;
  const taxOwedPence = calcTax(profitPence);
  const netAfterTaxPence = profitPence - taxOwedPence;
  const payYourselfBackPence = totalExpensesPence - revenueFromOrders;

  async function addExpense() {
    if (!form.amount || !form.description || !form.date) { setFormError("All fields required"); return; }
    const amountPence = Math.round(parseFloat(form.amount) * 100);
    if (isNaN(amountPence) || amountPence <= 0) { setFormError("Enter a valid amount"); return; }
    setAdding(true); setFormError("");
    const res = await fetch("/api/admin/finances/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountPence, category: form.category, description: form.description, date: form.date }),
    });
    if (res.ok) {
      const created = await res.json();
      setExpenses((prev) => [created, ...prev]);
      setForm({ amount: "", category: "hosting", description: "", date: new Date().toISOString().slice(0, 10) });
    } else {
      setFormError("Failed to add expense");
    }
    setAdding(false);
  }

  async function deleteExpense(id: string) {
    await fetch(`/api/admin/finances/expenses/${id}`, { method: "DELETE" });
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }

  async function addNote() {
    if (!noteText.trim()) return;
    setAddingNote(true);
    const res = await fetch("/api/admin/finances/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: noteText }),
    });
    if (res.ok) {
      const created = await res.json();
      setNotes((prev) => [created, ...prev]);
      setNoteText("");
    }
    setAddingNote(false);
  }

  async function deleteNote(id: string) {
    await fetch(`/api/admin/finances/notes/${id}`, { method: "DELETE" });
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  const expensesByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of expenses) {
      map[e.category] = (map[e.category] ?? 0) + e.amountPence;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  return (
    <div style={{ padding: "32px 24px", maxWidth: "1000px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: "8px" }}>
        <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 800, color: c.text }}>💰 Finance Tracker</h1>
        <p style={{ margin: "4px 0 0", fontSize: "14px", color: c.textMuted }}>Private admin view — expenses, revenue, tax & notes</p>
      </div>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px", margin: "28px 0" }}>
        {[
          { label: "Total Spent", value: fmt(totalExpensesPence), color: "#ef4444", bg: "#fef2f2", sub: "Your card spending" },
          { label: "Revenue In", value: fmt(revenueFromOrders), color: "#16a34a", bg: "#f0fdf4", sub: "From product orders" },
          { label: "Net P&L", value: fmt(profitPence), color: profitPence >= 0 ? "#16a34a" : "#ef4444", bg: profitPence >= 0 ? "#f0fdf4" : "#fef2f2", sub: profitPence >= 0 ? "You're in profit 🎉" : "Still in the red" },
          { label: "Est. Tax Owed", value: fmt(taxOwedPence), color: "#f59e0b", bg: "#fffbeb", sub: "UK self-assessment" },
          { label: "After Tax", value: fmt(netAfterTaxPence), color: "#6366f1", bg: "#eef2ff", sub: "What you actually keep" },
          { label: "Pay Yourself Back", value: payYourselfBackPence > 0 ? fmt(payYourselfBackPence) : "£0.00 ✅", color: payYourselfBackPence > 0 ? "#f97316" : "#16a34a", bg: payYourselfBackPence > 0 ? "#fff7ed" : "#f0fdf4", sub: payYourselfBackPence > 0 ? "Still owed to you" : "Fully paid back!" },
        ].map(({ label, value, color, bg, sub }) => (
          <div key={label} style={{ background: bg, borderRadius: "16px", padding: "20px", border: `1px solid ${color}22` }}>
            <p style={{ margin: "0 0 6px", fontSize: "11px", fontWeight: 700, color: c.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
            <p style={{ margin: "0 0 4px", fontSize: "22px", fontWeight: 800, color, lineHeight: 1 }}>{value}</p>
            <p style={{ margin: 0, fontSize: "11px", color: c.textMuted }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* Tax note */}
      <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: "12px", padding: "12px 16px", marginBottom: "24px", fontSize: "13px", color: "#92400e" }}>
        ⚠️ <strong>Tax estimate</strong> uses UK 2024/25 rates: £12,570 personal allowance, 20% basic rate up to £50,270, 40% above. For self-assessment guidance speak to an accountant.
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "24px", borderBottom: `1px solid ${c.border}`, paddingBottom: "0" }}>
        {(["overview", "expenses", "notes"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "10px 20px", borderRadius: "10px 10px 0 0", border: "none", cursor: "pointer", fontSize: "14px", fontWeight: 600,
              background: tab === t ? c.card : "transparent",
              color: tab === t ? c.text : c.textMuted,
              borderBottom: tab === t ? "2px solid #f97316" : "2px solid transparent",
            }}
          >
            {t === "overview" ? "📊 Overview" : t === "expenses" ? "💳 Expenses" : "📝 Notes"}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {tab === "overview" && (
        <div>
          <h2 className="text-gray-900 dark:text-white" style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 700 }}>Spending by Category</h2>
          {expensesByCategory.length === 0 ? (
            <p style={{ color: c.textMuted, fontSize: "14px" }}>No expenses logged yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {expensesByCategory.map(([cat, pence]) => {
                const catLabel = CATEGORIES.find((c) => c.value === cat)?.label ?? cat;
                const pct = totalExpensesPence > 0 ? (pence / totalExpensesPence) * 100 : 0;
                const color = CAT_COLORS[cat] ?? "#6b7280";
                return (
                  <div key={cat}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: c.textSub }}>{catLabel}</span>
                      <span style={{ fontSize: "13px", fontWeight: 700, color }}>{fmt(pence)} <span style={{ color: c.textMuted, fontWeight: 400 }}>({pct.toFixed(1)}%)</span></span>
                    </div>
                    <div className="bg-gray-100 dark:bg-gray-700" style={{ height: "8px", borderRadius: "999px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: "999px", transition: "width 0.5s ease" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Monthly breakdown */}
          <h2 className="text-gray-900 dark:text-white" style={{ margin: "32px 0 16px", fontSize: "16px", fontWeight: 700 }}>Monthly Spending</h2>
          {(() => {
            const monthly: Record<string, number> = {};
            for (const e of expenses) {
              const month = e.date.slice(0, 7);
              monthly[month] = (monthly[month] ?? 0) + e.amountPence;
            }
            const months = Object.entries(monthly).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12);
            if (months.length === 0) return <p style={{ color: c.textMuted, fontSize: "14px" }}>No expenses yet.</p>;
            const max = Math.max(...months.map((m) => m[1]));
            const avg = months.reduce((s, m) => s + m[1], 0) / months.length;
            return (
              <div>
                {/* Average callout */}
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                  Average per month: <strong style={{ color: "#f97316" }}>{fmt(Math.round(avg))}</strong>
                  {" · "}Total tracked: <strong className="text-gray-900 dark:text-white">{months.length} months</strong>
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {months.map(([month, pence]) => (
                    <div key={month} className="flex items-center gap-3">
                      <span className="text-gray-500 dark:text-gray-400 text-xs shrink-0" style={{ width: "76px" }}>
                        {new Date(month + "-01").toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
                      </span>
                      <div className="flex-1 rounded-md overflow-hidden bg-gray-100 dark:bg-gray-700 min-w-0" style={{ height: "22px" }}>
                        <div style={{ height: "100%", width: `${(pence / max) * 100}%`, background: "linear-gradient(90deg, #f97316, #ea580c)", borderRadius: "6px", minWidth: "4px" }} />
                      </div>
                      <span className="text-gray-900 dark:text-white font-bold text-sm text-right shrink-0" style={{ minWidth: "90px" }}>{fmt(pence)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* EXPENSES TAB */}
      {tab === "expenses" && (
        <div>
          {/* Add form */}
          <div style={{ background: c.card, borderRadius: "16px", padding: "24px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: "24px" }}>
            <h2 style={{ margin: "0 0 16px", fontSize: "15px", fontWeight: 700, color: c.text }}>Log an expense</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 120px", gap: "12px", marginBottom: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: c.textSub, marginBottom: "4px" }}>Description</label>
                <input
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Vercel Pro subscription"
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: `1px solid ${c.inputBorder}`, fontSize: "13px", boxSizing: "border-box", background: c.inputBg, color: c.text }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: c.textSub, marginBottom: "4px" }}>Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: `1px solid ${c.inputBorder}`, fontSize: "13px", boxSizing: "border-box", background: c.inputBg, color: c.text }}
                >
                  {CATEGORIES.map((cat) => <option key={cat.value} value={cat.value}>{cat.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: c.textSub, marginBottom: "4px" }}>Date</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: `1px solid ${c.inputBorder}`, fontSize: "13px", boxSizing: "border-box", background: c.inputBg, color: c.text }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: c.textSub, marginBottom: "4px" }}>Amount (£)</label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="20.00"
                  min="0"
                  step="0.01"
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: `1px solid ${c.inputBorder}`, fontSize: "13px", boxSizing: "border-box", background: c.inputBg, color: c.text }}
                />
              </div>
            </div>
            {formError && <p style={{ color: "#dc2626", fontSize: "13px", marginBottom: "8px" }}>{formError}</p>}
            <button
              onClick={addExpense}
              disabled={adding}
              style={{ padding: "10px 24px", borderRadius: "10px", background: "linear-gradient(135deg,#f97316,#ea580c)", color: "#fff", fontWeight: 700, fontSize: "14px", border: "none", cursor: "pointer" }}
            >
              {adding ? "Adding…" : "Add Expense"}
            </button>
          </div>

          {/* Expenses table */}
          {expenses.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px", color: c.textMuted, fontSize: "14px" }}>No expenses yet.</div>
          ) : (
            <div style={{ background: c.card, borderRadius: "16px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${c.border}` }}>
                    {["Date", "Description", "Category", "Amount", ""].map((h) => (
                      <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", fontWeight: 700, color: c.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e) => {
                    const catLabel = CATEGORIES.find((c) => c.value === e.category)?.label ?? e.category;
                    const color = CAT_COLORS[e.category] ?? "#6b7280";
                    return (
                      <tr key={e.id} style={{ borderBottom: `1px solid ${c.border}` }}>
                        <td style={{ padding: "13px 16px", fontSize: "13px", color: c.textMuted, whiteSpace: "nowrap" }}>{fmtDate(e.date)}</td>
                        <td style={{ padding: "13px 16px", fontSize: "14px", fontWeight: 500, color: c.text }}>{e.description}</td>
                        <td style={{ padding: "13px 16px" }}>
                          <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: 700, background: color + "15", color, border: `1px solid ${color}33` }}>
                            {catLabel}
                          </span>
                        </td>
                        <td style={{ padding: "13px 16px", fontSize: "15px", fontWeight: 700, color: "#ef4444" }}>{fmt(e.amountPence)}</td>
                        <td style={{ padding: "13px 16px" }}>
                          <button
                            onClick={() => deleteExpense(e.id)}
                            style={{ padding: "4px 10px", borderRadius: "6px", border: "1px solid #fee2e2", background: "#fef2f2", color: "#dc2626", fontSize: "12px", cursor: "pointer" }}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: `2px solid ${c.border}`, background: c.card }}>
                    <td colSpan={3} style={{ padding: "13px 16px", fontSize: "13px", fontWeight: 700, color: c.textSub }}>Total</td>
                    <td style={{ padding: "13px 16px", fontSize: "16px", fontWeight: 800, color: "#ef4444" }}>{fmt(totalExpensesPence)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* NOTES TAB */}
      {tab === "notes" && (
        <div>
          <div style={{ background: c.card, borderRadius: "16px", padding: "24px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: "24px" }}>
            <h2 style={{ margin: "0 0 12px", fontSize: "15px", fontWeight: 700, color: c.text }}>Add a note</h2>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="e.g. Need to repay £340 card spend from Nov. Waiting on Stripe payout. Remember to set aside 20% of next month's revenue for tax..."
              rows={4}
              style={{ width: "100%", padding: "12px", borderRadius: "10px", border: `1px solid ${c.inputBorder}`, fontSize: "14px", resize: "vertical", boxSizing: "border-box", lineHeight: 1.6, background: c.inputBg, color: c.text }}
            />
            <button
              onClick={addNote}
              disabled={addingNote || !noteText.trim()}
              style={{ marginTop: "10px", padding: "10px 24px", borderRadius: "10px", background: "linear-gradient(135deg,#f97316,#ea580c)", color: "#fff", fontWeight: 700, fontSize: "14px", border: "none", cursor: "pointer", opacity: !noteText.trim() ? 0.5 : 1 }}
            >
              {addingNote ? "Saving…" : "Save Note"}
            </button>
          </div>

          {notes.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px", color: c.textMuted, fontSize: "14px" }}>No notes yet. Add your first financial note above.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {notes.map((n) => (
                <div key={n.id} style={{ background: c.card, borderRadius: "14px", padding: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", border: `1px solid ${c.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                    <p style={{ margin: 0, fontSize: "14px", color: c.textSub, lineHeight: 1.7, whiteSpace: "pre-wrap", flex: 1 }}>{n.content}</p>
                    <button
                      onClick={() => deleteNote(n.id)}
                      style={{ flexShrink: 0, padding: "4px 10px", borderRadius: "6px", border: "1px solid #fee2e2", background: "#fef2f2", color: "#dc2626", fontSize: "12px", cursor: "pointer" }}
                    >
                      Delete
                    </button>
                  </div>
                  <p style={{ margin: "10px 0 0", fontSize: "11px", color: c.textMuted }}>{fmtDate(n.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
