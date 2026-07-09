"use client";

import { useState, useEffect } from "react";
import { TRUST_FACTOR_META, getTrustLevel, TRUST_LEVELS } from "@/lib/trust-score-config";

// ─── Types ─────────────────────────────────────────────────────────────────────

type Breakdown = Record<string, number>;
type TrustLevel = "building" | "developing" | "trusted" | "excellent" | "elite";

type TrustScoreData = {
  score: number;
  level: TrustLevel;
  breakdown: Breakdown;
  recommendations: string[];
  publicOptIn: boolean;
  adminSuppressed: boolean;
  adminOverrideScore: number | null;
  lastCalculatedAt: string;
};

type HistoryEntry = {
  score: number;
  level: string;
  trigger: string;
  calculatedAt: string;
};

type ReputationEvent = {
  id: string;
  eventType: string;
  description: string;
  scoreDelta: number | null;
  createdAt: string;
};

// ─── Shield Icon ───────────────────────────────────────────────────────────────

function ShieldIcon({ color = "#f97316", size = 20 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2L3 6V12C3 17.55 6.84 22.74 12 24C17.16 22.74 21 17.55 21 12V6L12 2Z"
        fill={color} fillOpacity="0.15" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 12L11 14L15 10" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Progress Bar ──────────────────────────────────────────────────────────────

function ProgressBar({ value, color, height = 8 }: { value: number; color: string; height?: number }) {
  return (
    <div style={{ width: "100%", height: `${height}px`, borderRadius: "999px", background: "#f3f4f6", overflow: "hidden" }}>
      <div style={{
        width: `${Math.max(2, value)}%`, height: "100%", borderRadius: "999px",
        background: color, transition: "width 0.8s cubic-bezier(.4,0,.2,1)",
      }} />
    </div>
  );
}

function factorColor(value: number) {
  if (value >= 70) return "#10b981";
  if (value >= 40) return "#f59e0b";
  return "#ef4444";
}

// ─── Score Donut ───────────────────────────────────────────────────────────────

function ScoreDonut({ score, color }: { score: number; color: string }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg width="140" height="140" viewBox="0 0 140 140">
      <circle cx="70" cy="70" r={r} fill="none" stroke="#f3f4f6" strokeWidth="12" />
      <circle
        cx="70" cy="70" r={r} fill="none"
        stroke={color} strokeWidth="12"
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeDashoffset={circ * 0.25}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 1s cubic-bezier(.4,0,.2,1)" }}
      />
      <text x="70" y="64" textAnchor="middle" fontSize="28" fontWeight="900" fill="#111827">{score}</text>
      <text x="70" y="82" textAnchor="middle" fontSize="12" fontWeight="600" fill="#9ca3af">/100</text>
    </svg>
  );
}

// ─── Mini Sparkline ────────────────────────────────────────────────────────────

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 10);
  const min = Math.min(...data);
  const w = 200, h = 48;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / (max - min + 1)) * (h - 8) - 4;
    return `${x},${y}`;
  });
  return (
    <svg width={w} height={h} style={{ overflow: "visible" }}>
      <polyline
        points={pts.join(" ")}
        fill="none" stroke={color} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"
      />
      <circle cx={pts[pts.length - 1].split(",")[0]} cy={pts[pts.length - 1].split(",")[1]} r={3} fill={color} />
    </svg>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function TrustScoreDashboardPage() {
  const [scoreData, setScoreData] = useState<TrustScoreData | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [events, setEvents] = useState<ReputationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [activeTab, setActiveTab] = useState<"breakdown" | "history" | "tips">("breakdown");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/trust-score/opt-in");
      const data = await res.json();
      setScoreData(data.score ?? null);
      setHistory(data.history ?? []);
      setEvents(data.events ?? []);
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleRecalculate() {
    setRecalculating(true);
    try {
      await fetch("/api/trust-score/recalculate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trigger: "manual" }) });
      await load();
    } catch {}
    setRecalculating(false);
  }

  async function handleToggleOptIn() {
    if (!scoreData) return;
    setToggling(true);
    try {
      await fetch("/api/trust-score/opt-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicOptIn: !scoreData.publicOptIn }),
      });
      await load();
    } catch {}
    setToggling(false);
  }

  if (loading) return (
    <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "32px", marginBottom: "12px" }}>🛡️</div>
        <p style={{ color: "#6b7280", fontSize: "15px" }}>Loading your Trust Score…</p>
      </div>
    </div>
  );

  const score = scoreData?.score ?? 0;
  const levelMeta = getTrustLevel(score);
  const color = levelMeta.color;
  const breakdown = scoreData?.breakdown ?? {};
  const recommendations = scoreData?.recommendations ?? [];
  const historyScores = history.map((h) => h.score);

  const factorOrder = [
    "verifiedSales", "avgRating", "reviewCount", "refundRate",
    "productCompleteness", "profileCompleteness",
    "followerGrowth", "accountAge", "communityScore", "responseTime",
  ];

  // What changed since last score
  const prevScore = history.length >= 2 ? history[history.length - 2].score : null;
  const scoreDelta = prevScore !== null ? score - prevScore : null;

  return (
    <div style={{ maxWidth: "760px", margin: "0 auto", padding: "32px 24px 64px", fontFamily: "'Inter', -apple-system, sans-serif" }}>

      {/* Page header */}
      <div style={{ marginBottom: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
          <ShieldIcon color={color} size={24} />
          <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 800, color: "#111827", letterSpacing: "-0.5px" }}>
            Trust Score
          </h1>
        </div>
        <p style={{ margin: 0, fontSize: "14px", color: "#6b7280" }}>
          Build buyer confidence. Understand your reputation and improve your visibility.
        </p>
      </div>

      {/* Score hero card */}
      <div style={{
        background: `linear-gradient(135deg, ${color}10 0%, ${color}05 100%)`,
        border: `1px solid ${color}25`,
        borderRadius: "20px", padding: "28px",
        display: "flex", alignItems: "center", gap: "28px",
        flexWrap: "wrap", marginBottom: "24px",
      }}>
        <ScoreDonut score={score} color={color} />

        <div style={{ flex: 1, minWidth: "200px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", flexWrap: "wrap" }}>
            <span style={{
              padding: "4px 12px", borderRadius: "999px",
              background: `${color}18`, border: `1px solid ${color}35`,
              fontSize: "13px", fontWeight: 700, color,
            }}>
              {levelMeta.emoji} {levelMeta.label}
            </span>
            {scoreDelta !== null && (
              <span style={{
                padding: "4px 10px", borderRadius: "999px",
                background: scoreDelta >= 0 ? "#f0fdf4" : "#fef2f2",
                border: `1px solid ${scoreDelta >= 0 ? "#bbf7d0" : "#fecaca"}`,
                fontSize: "12px", fontWeight: 700,
                color: scoreDelta >= 0 ? "#16a34a" : "#dc2626",
              }}>
                {scoreDelta >= 0 ? "↑" : "↓"} {Math.abs(scoreDelta)} pts since last update
              </span>
            )}
          </div>

          <p style={{ margin: "0 0 14px", fontSize: "14px", color: "#6b7280" }}>{levelMeta.tagline}</p>

          {/* Level ladder */}
          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
            {TRUST_LEVELS.map((l) => (
              <span key={l.id} style={{
                padding: "3px 9px", borderRadius: "999px",
                fontSize: "11px", fontWeight: 600,
                background: l.id === levelMeta.id ? `${l.color}18` : "#f3f4f6",
                color: l.id === levelMeta.id ? l.color : "#9ca3af",
                border: l.id === levelMeta.id ? `1px solid ${l.color}30` : "1px solid #f3f4f6",
              }}>
                {l.emoji} {l.label}
              </span>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "flex-end", flexShrink: 0 }}>
          <button
            onClick={handleRecalculate}
            disabled={recalculating}
            style={{
              padding: "9px 16px", borderRadius: "10px",
              background: "#111827", border: "none", color: "#fff",
              fontSize: "13px", fontWeight: 700, cursor: "pointer",
              opacity: recalculating ? 0.6 : 1,
            }}
          >
            {recalculating ? "Recalculating…" : "🔄 Recalculate"}
          </button>

          <button
            onClick={handleToggleOptIn}
            disabled={toggling}
            style={{
              padding: "9px 16px", borderRadius: "10px",
              background: scoreData?.publicOptIn ? "#fef2f2" : "#f0fdf4",
              border: `1px solid ${scoreData?.publicOptIn ? "#fecaca" : "#bbf7d0"}`,
              color: scoreData?.publicOptIn ? "#dc2626" : "#16a34a",
              fontSize: "13px", fontWeight: 700, cursor: "pointer",
              opacity: toggling ? 0.6 : 1,
            }}
          >
            {scoreData?.publicOptIn ? "🔒 Hide from public" : "🌐 Show publicly"}
          </button>

          {scoreData?.lastCalculatedAt && (
            <p style={{ margin: 0, fontSize: "11px", color: "#9ca3af" }}>
              Updated {new Date(scoreData.lastCalculatedAt).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>

      {/* Public opt-in notice */}
      {!scoreData?.publicOptIn && (
        <div style={{
          padding: "12px 16px", borderRadius: "12px",
          background: "#fffbeb", border: "1px solid #fde68a",
          fontSize: "13px", color: "#92400e", marginBottom: "20px",
          display: "flex", alignItems: "center", gap: "8px",
        }}>
          <span>⚠️</span>
          <span>Your Trust Score is <strong>private</strong>. Enable it publicly to build buyer confidence and unlock more visibility.</span>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "20px", background: "#f9fafb", borderRadius: "12px", padding: "4px" }}>
        {(["breakdown", "history", "tips"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1, padding: "9px 12px", borderRadius: "9px", border: "none",
              background: activeTab === tab ? "#fff" : "transparent",
              boxShadow: activeTab === tab ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              color: activeTab === tab ? "#111827" : "#6b7280",
              fontSize: "13px", fontWeight: activeTab === tab ? 700 : 500,
              cursor: "pointer", transition: "all 0.15s",
            }}
          >
            {tab === "breakdown" ? "📊 Breakdown" : tab === "history" ? "📈 History" : "💡 How to Improve"}
          </button>
        ))}
      </div>

      {/* ── Tab: Breakdown ── */}
      {activeTab === "breakdown" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {factorOrder.map((key) => {
            const meta = TRUST_FACTOR_META[key];
            if (!meta) return null;
            const value = Math.round(breakdown[key] ?? 0);
            const fc = factorColor(value);
            return (
              <div key={key} style={{
                padding: "16px", borderRadius: "14px",
                background: "#fff", border: "1px solid #f3f4f6",
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{
                      width: "36px", height: "36px", borderRadius: "10px",
                      background: `${fc}15`, display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "18px", flexShrink: 0,
                    }}>
                      {meta.icon}
                    </div>
                    <div>
                      <p style={{ margin: "0 0 2px", fontSize: "14px", fontWeight: 700, color: "#111827" }}>{meta.label}</p>
                      <p style={{ margin: 0, fontSize: "12px", color: "#9ca3af" }}>{meta.description}</p>
                    </div>
                  </div>
                  <span style={{ fontSize: "18px", fontWeight: 800, color: fc, minWidth: "40px", textAlign: "right" }}>
                    {value}%
                  </span>
                </div>
                <ProgressBar value={value} color={fc} />
                {value < 70 && (
                  <p style={{ margin: "10px 0 0", fontSize: "12px", color: "#6b7280", paddingLeft: "46px" }}>
                    💡 {meta.tip}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Tab: History ── */}
      {activeTab === "history" && (
        <div>
          {history.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 24px", color: "#9ca3af", fontSize: "14px" }}>
              No history yet — recalculate your score to start tracking.
            </div>
          ) : (
            <>
              {/* Sparkline */}
              {historyScores.length >= 2 && (
                <div style={{ padding: "20px", borderRadius: "14px", background: "#fff", border: "1px solid #f3f4f6", marginBottom: "16px" }}>
                  <p style={{ margin: "0 0 12px", fontSize: "13px", fontWeight: 700, color: "#374151" }}>Score over time</p>
                  <Sparkline data={historyScores} color={color} />
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
                    <span style={{ fontSize: "11px", color: "#9ca3af" }}>{history[0] ? new Date(history[0].calculatedAt).toLocaleDateString() : ""}</span>
                    <span style={{ fontSize: "11px", color: "#9ca3af" }}>{history[history.length - 1] ? new Date(history[history.length - 1].calculatedAt).toLocaleDateString() : ""}</span>
                  </div>
                </div>
              )}

              {/* Event log */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {events.map((ev) => (
                  <div key={ev.id} style={{
                    padding: "12px 14px", borderRadius: "12px",
                    background: "#fff", border: "1px solid #f3f4f6",
                    display: "flex", alignItems: "flex-start", gap: "10px",
                  }}>
                    <div style={{
                      width: "32px", height: "32px", borderRadius: "8px", flexShrink: 0,
                      background: ev.scoreDelta && ev.scoreDelta > 0 ? "#f0fdf4" : ev.scoreDelta && ev.scoreDelta < 0 ? "#fef2f2" : "#f9fafb",
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px",
                    }}>
                      {ev.scoreDelta && ev.scoreDelta > 0 ? "↑" : ev.scoreDelta && ev.scoreDelta < 0 ? "↓" : "•"}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: "13px", color: "#374151" }}>{ev.description}</p>
                      <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#9ca3af" }}>{new Date(ev.createdAt).toLocaleString()}</p>
                    </div>
                    {ev.scoreDelta !== null && (
                      <span style={{
                        fontSize: "12px", fontWeight: 700,
                        color: ev.scoreDelta > 0 ? "#16a34a" : "#dc2626",
                      }}>
                        {ev.scoreDelta > 0 ? "+" : ""}{ev.scoreDelta} pts
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Tab: Tips ── */}
      {activeTab === "tips" && (
        <div>
          <div style={{ padding: "16px 18px", borderRadius: "14px", background: `${color}08`, border: `1px solid ${color}20`, marginBottom: "20px" }}>
            <p style={{ margin: "0 0 6px", fontSize: "14px", fontWeight: 700, color: "#111827" }}>
              🎯 Ways to increase your Trust Score
            </p>
            <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>
              Focus on these to build buyer confidence and unlock more visibility on the marketplace.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {recommendations.length > 0 ? recommendations.map((rec, i) => (
              <div key={i} style={{
                padding: "14px 16px", borderRadius: "12px",
                background: "#fff", border: "1px solid #f3f4f6",
                display: "flex", alignItems: "flex-start", gap: "10px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              }}>
                <div style={{
                  width: "28px", height: "28px", borderRadius: "8px", flexShrink: 0,
                  background: `${color}15`, color, fontWeight: 800, fontSize: "13px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {i + 1}
                </div>
                <p style={{ margin: 0, fontSize: "14px", color: "#374151", lineHeight: 1.55 }}>{rec}</p>
              </div>
            )) : (
              <div style={{ textAlign: "center", padding: "32px", color: "#9ca3af" }}>
                Recalculate your score to get personalised improvement tips.
              </div>
            )}
          </div>

          {/* Business Brain integration hint */}
          <div style={{
            marginTop: "20px", padding: "16px", borderRadius: "14px",
            background: "linear-gradient(135deg, #f97316, #ea580c)",
            color: "#fff",
          }}>
            <p style={{ margin: "0 0 6px", fontSize: "14px", fontWeight: 700 }}>🧠 Business Brain</p>
            <p style={{ margin: "0 0 12px", fontSize: "13px", opacity: 0.9 }}>
              Get AI-powered suggestions tailored to your store — from product improvements to marketing ideas.
            </p>
            <a href="/dashboard/store" style={{
              display: "inline-flex", alignItems: "center", gap: "6px",
              padding: "8px 16px", borderRadius: "8px",
              background: "rgba(255,255,255,0.2)", color: "#fff",
              fontSize: "13px", fontWeight: 700, textDecoration: "none",
              border: "1px solid rgba(255,255,255,0.3)",
            }}>
              Open Business Brain →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
