"use client";

import { useState, useEffect } from "react";
import { getTrustLevel, TRUST_FACTOR_META } from "@/lib/trust-score-config";

type TrustScoreRow = {
  id: string;
  userId: string;
  totalScore: number;
  level: string;
  breakdown: Record<string, number>;
  recommendations: string[];
  rawSignals: Record<string, number>;
  publicOptIn: boolean;
  adminSuppressed: boolean;
  adminOverrideScore: number | null;
  lastCalculatedAt: string;
};

type EventRow = {
  id: string;
  userId: string;
  eventType: string;
  description: string;
  scoreDelta: number | null;
  adminUserId: string | null;
  createdAt: string;
};

function ShieldIcon({ color = "#f97316", size = 16 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2L3 6V12C3 17.55 6.84 22.74 12 24C17.16 22.74 21 17.55 21 12V6L12 2Z"
        fill={color} fillOpacity="0.15" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 12L11 14L15 10" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ width: "100%", height: "5px", borderRadius: "999px", background: "#f3f4f6", overflow: "hidden" }}>
      <div style={{ width: `${Math.max(2, value)}%`, height: "100%", borderRadius: "999px", background: color }} />
    </div>
  );
}

export default function AdminTrustScoresPage() {
  const [scores, setScores] = useState<TrustScoreRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "events">("overview");
  const [selected, setSelected] = useState<TrustScoreRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [overrideInput, setOverrideInput] = useState("");
  const [overrideReason, setOverrideReason] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/trust-scores");
      const data = await res.json();
      setScores(data.scores ?? []);
      setEvents(data.recentEvents ?? []);
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function action(action: string, userId: string, extra?: Record<string, unknown>) {
    setBusy(`${action}:${userId}`);
    try {
      await fetch("/api/admin/trust-scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, targetUserId: userId, ...extra }),
      });
      await load();
      if (selected?.userId === userId) {
        setSelected((scores.find((s) => s.userId === userId)) ?? null);
      }
    } catch {}
    setBusy(null);
  }

  const factorOrder = ["verifiedSales", "avgRating", "reviewCount", "refundRate", "productCompleteness", "profileCompleteness", "followerGrowth", "accountAge", "communityScore", "responseTime"];

  return (
    <div style={{ padding: "32px 24px", fontFamily: "'Inter', -apple-system, sans-serif", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <ShieldIcon color="#f97316" size={22} />
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 800, color: "#111827" }}>Trust Scores</h1>
          <span style={{ padding: "2px 8px", borderRadius: "6px", background: "#f3f4f6", fontSize: "12px", fontWeight: 600, color: "#6b7280" }}>
            {scores.length} creators
          </span>
        </div>
        <button
          onClick={load}
          style={{ padding: "8px 14px", borderRadius: "9px", background: "#111827", color: "#fff", border: "none", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}
        >
          ↻ Refresh
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "20px", background: "#f9fafb", borderRadius: "10px", padding: "4px", width: "fit-content" }}>
        {(["overview", "events"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "7px 16px", borderRadius: "8px", border: "none",
            background: tab === t ? "#fff" : "transparent",
            boxShadow: tab === t ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
            color: tab === t ? "#111827" : "#6b7280",
            fontSize: "13px", fontWeight: tab === t ? 700 : 500, cursor: "pointer",
          }}>
            {t === "overview" ? "🛡️ All Creators" : "📋 Event Log"}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "48px", color: "#9ca3af" }}>Loading…</div>
      ) : tab === "overview" ? (
        <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 380px" : "1fr", gap: "16px" }}>
          {/* Table */}
          <div>
            <div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #f3f4f6", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f9fafb", borderBottom: "1px solid #f3f4f6" }}>
                    {["Creator", "Score", "Level", "Public", "Suppressed", "Updated", "Actions"].map((h) => (
                      <th key={h} style={{ padding: "10px 14px", fontSize: "11px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "left" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scores.map((s) => {
                    const lv = getTrustLevel(s.adminOverrideScore ?? s.totalScore);
                    const displayScore = Math.round(s.adminOverrideScore ?? s.totalScore);
                    const isSelected = selected?.userId === s.userId;
                    return (
                      <tr
                        key={s.id}
                        onClick={() => setSelected(isSelected ? null : s)}
                        style={{
                          borderBottom: "1px solid #f9fafb", cursor: "pointer",
                          background: isSelected ? "#fef9f0" : undefined,
                          transition: "background 0.1s",
                        }}
                      >
                        <td style={{ padding: "10px 14px", fontSize: "12px", fontFamily: "monospace", color: "#374151" }}>
                          {s.userId.slice(0, 12)}…
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <ShieldIcon color={lv.color} size={14} />
                            <span style={{ fontSize: "14px", fontWeight: 800, color: lv.color }}>{displayScore}</span>
                            {s.adminOverrideScore !== null && (
                              <span style={{ fontSize: "10px", color: "#9ca3af", background: "#fef3c7", padding: "1px 5px", borderRadius: "4px" }}>override</span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <span style={{ fontSize: "12px", fontWeight: 600, color: lv.color }}>{lv.emoji} {lv.label}</span>
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <span style={{ fontSize: "12px", color: s.publicOptIn ? "#10b981" : "#9ca3af" }}>
                            {s.publicOptIn ? "✓ Yes" : "✗ No"}
                          </span>
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <span style={{ fontSize: "12px", color: s.adminSuppressed ? "#ef4444" : "#9ca3af" }}>
                            {s.adminSuppressed ? "⚠ Yes" : "—"}
                          </span>
                        </td>
                        <td style={{ padding: "10px 14px", fontSize: "11px", color: "#9ca3af" }}>
                          {new Date(s.lastCalculatedAt).toLocaleDateString()}
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <div style={{ display: "flex", gap: "4px" }}>
                            <button
                              onClick={(e) => { e.stopPropagation(); action("recalculate", s.userId); }}
                              disabled={busy === `recalculate:${s.userId}`}
                              style={{ padding: "4px 8px", borderRadius: "6px", border: "1px solid #e5e7eb", background: "#fff", fontSize: "11px", fontWeight: 600, cursor: "pointer", color: "#374151" }}
                            >
                              ↻
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); action(s.adminSuppressed ? "unsuppress" : "suppress", s.userId); }}
                              style={{ padding: "4px 8px", borderRadius: "6px", border: "1px solid #e5e7eb", background: s.adminSuppressed ? "#fef2f2" : "#fff", fontSize: "11px", fontWeight: 600, cursor: "pointer", color: s.adminSuppressed ? "#dc2626" : "#374151" }}
                            >
                              {s.adminSuppressed ? "Unsuppress" : "Suppress"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detail panel */}
          {selected && (
            <div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #f3f4f6", padding: "20px", position: "sticky", top: "24px", maxHeight: "80vh", overflowY: "auto" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "#111827" }}>Score Breakdown</p>
                <button onClick={() => setSelected(null)} style={{ width: "24px", height: "24px", borderRadius: "50%", background: "#f3f4f6", border: "none", cursor: "pointer", fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
              </div>

              <p style={{ margin: "0 0 12px", fontSize: "11px", fontFamily: "monospace", color: "#6b7280", wordBreak: "break-all" }}>{selected.userId}</p>

              {/* Factor bars */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
                {factorOrder.map((key) => {
                  const meta = TRUST_FACTOR_META[key];
                  if (!meta) return null;
                  const val = Math.round(selected.breakdown[key] ?? 0);
                  const fc = val >= 70 ? "#10b981" : val >= 40 ? "#f59e0b" : "#ef4444";
                  return (
                    <div key={key}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                        <span style={{ fontSize: "12px", color: "#374151", fontWeight: 600 }}>{meta.icon} {meta.label}</span>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: fc }}>{val}%</span>
                      </div>
                      <ProgressBar value={val} color={fc} />
                    </div>
                  );
                })}
              </div>

              {/* Raw signals */}
              <details style={{ marginBottom: "16px" }}>
                <summary style={{ fontSize: "12px", fontWeight: 700, color: "#6b7280", cursor: "pointer" }}>Raw signals</summary>
                <pre style={{ margin: "8px 0 0", fontSize: "11px", color: "#374151", background: "#f9fafb", padding: "10px", borderRadius: "8px", overflow: "auto" }}>
                  {JSON.stringify(selected.rawSignals, null, 2)}
                </pre>
              </details>

              {/* Admin override */}
              <div style={{ padding: "14px", borderRadius: "12px", background: "#fef9f0", border: "1px solid #fed7aa", marginBottom: "12px" }}>
                <p style={{ margin: "0 0 10px", fontSize: "12px", fontWeight: 700, color: "#92400e" }}>⚙️ Admin Override</p>
                <div style={{ display: "flex", gap: "6px", marginBottom: "6px" }}>
                  <input
                    type="number" min={0} max={100} placeholder="Score (0–100)"
                    value={overrideInput}
                    onChange={(e) => setOverrideInput(e.target.value)}
                    style={{ flex: 1, padding: "6px 10px", borderRadius: "7px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                  />
                  <input
                    type="text" placeholder="Reason"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    style={{ flex: 2, padding: "6px 10px", borderRadius: "7px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                  />
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    onClick={() => action("override", selected.userId, { overrideScore: Number(overrideInput), reason: overrideReason })}
                    style={{ flex: 1, padding: "7px", borderRadius: "7px", background: "#f97316", border: "none", color: "#fff", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
                  >
                    Set override
                  </button>
                  {selected.adminOverrideScore !== null && (
                    <button
                      onClick={() => action("clear-override", selected.userId)}
                      style={{ padding: "7px 10px", borderRadius: "7px", background: "#fff", border: "1px solid #e5e7eb", fontSize: "12px", fontWeight: 600, cursor: "pointer", color: "#374151" }}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Quick actions */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <button onClick={() => action("recalculate", selected.userId)} style={{ padding: "8px", borderRadius: "8px", border: "1px solid #e5e7eb", background: "#fff", fontSize: "13px", fontWeight: 600, cursor: "pointer", color: "#374151" }}>
                  🔄 Recalculate score
                </button>
                <button onClick={() => action(selected.adminSuppressed ? "unsuppress" : "suppress", selected.userId)}
                  style={{ padding: "8px", borderRadius: "8px", border: "1px solid #e5e7eb", background: selected.adminSuppressed ? "#fef2f2" : "#fff", fontSize: "13px", fontWeight: 600, cursor: "pointer", color: selected.adminSuppressed ? "#dc2626" : "#374151" }}
                >
                  {selected.adminSuppressed ? "✓ Remove suppression" : "⚠ Suppress score"}
                </button>
                <button onClick={() => action(selected.publicOptIn ? "hide" : "show", selected.userId)}
                  style={{ padding: "8px", borderRadius: "8px", border: "1px solid #e5e7eb", background: "#fff", fontSize: "13px", fontWeight: 600, cursor: "pointer", color: "#374151" }}
                >
                  {selected.publicOptIn ? "🔒 Hide from public" : "🌐 Make public"}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Events log */
        <div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #f3f4f6", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "1px solid #f3f4f6" }}>
                {["Creator", "Event", "Description", "Delta", "Time"].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", fontSize: "11px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id} style={{ borderBottom: "1px solid #f9fafb" }}>
                  <td style={{ padding: "9px 14px", fontSize: "11px", fontFamily: "monospace", color: "#6b7280" }}>{ev.userId.slice(0, 10)}…</td>
                  <td style={{ padding: "9px 14px" }}>
                    <span style={{ padding: "2px 7px", borderRadius: "5px", background: "#f3f4f6", fontSize: "11px", fontWeight: 600, color: "#374151" }}>
                      {ev.eventType}
                    </span>
                  </td>
                  <td style={{ padding: "9px 14px", fontSize: "12px", color: "#374151", maxWidth: "320px" }}>{ev.description}</td>
                  <td style={{ padding: "9px 14px", fontSize: "12px", fontWeight: 700, color: ev.scoreDelta && ev.scoreDelta > 0 ? "#10b981" : ev.scoreDelta && ev.scoreDelta < 0 ? "#ef4444" : "#9ca3af" }}>
                    {ev.scoreDelta !== null ? `${ev.scoreDelta > 0 ? "+" : ""}${ev.scoreDelta}` : "—"}
                  </td>
                  <td style={{ padding: "9px 14px", fontSize: "11px", color: "#9ca3af" }}>{new Date(ev.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
