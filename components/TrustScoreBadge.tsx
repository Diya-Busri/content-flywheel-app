"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { TRUST_FACTOR_META, getTrustLevel } from "@/lib/trust-score-config";

// ─── Types ─────────────────────────────────────────────────────────────────────

type Breakdown = Record<string, number>;

type TrustScoreData = {
  userId: string;
  score: number;
  level: string;
  levelLabel: string;
  levelEmoji: string;
  levelColor: string;
  levelTagline: string;
  publicOptIn: boolean;
  adminSuppressed: boolean;
  breakdown?: Breakdown;
  factorMeta?: typeof TRUST_FACTOR_META;
  lastCalculatedAt?: string;
  message?: string;
};

// ─── Shield Icon ───────────────────────────────────────────────────────────────

function ShieldIcon({ color = "#f97316", size = 20 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 2L3 6V12C3 17.55 6.84 22.74 12 24C17.16 22.74 21 17.55 21 12V6L12 2Z"
        fill={color}
        fillOpacity="0.15"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 12L11 14L15 10"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Progress Bar ──────────────────────────────────────────────────────────────

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ width: "100%", height: "6px", borderRadius: "999px", background: "#f3f4f6", overflow: "hidden" }}>
      <div style={{
        width: `${Math.max(2, value)}%`,
        height: "100%",
        borderRadius: "999px",
        background: color,
        transition: "width 0.6s cubic-bezier(.4,0,.2,1)",
      }} />
    </div>
  );
}

// ─── Trust Score Breakdown Modal ───────────────────────────────────────────────

function TrustScoreModal({
  data,
  onClose,
}: {
  data: TrustScoreData;
  onClose: () => void;
}) {
  const levelMeta = getTrustLevel(data.score ?? 0);
  const color = levelMeta.color;

  const factorOrder = [
    "verifiedSales", "avgRating", "reviewCount", "refundRate",
    "productCompleteness", "profileCompleteness", "followerGrowth",
    "accountAge", "communityScore", "responseTime",
  ];

  useEffect(() => {
    const close = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [onClose]);

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 99999,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: "24px",
          padding: "0", maxWidth: "480px", width: "100%",
          boxShadow: "0 24px 80px rgba(0,0,0,0.25)",
          overflow: "hidden",
          maxHeight: "90vh",
          display: "flex", flexDirection: "column",
        }}
      >
        {/* Header */}
        <div style={{
          background: `linear-gradient(135deg, ${color}18 0%, ${color}08 100%)`,
          borderBottom: `1px solid ${color}20`,
          padding: "24px 24px 20px",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div style={{
                width: "56px", height: "56px", borderRadius: "16px",
                background: `${color}15`, border: `1.5px solid ${color}30`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <ShieldIcon color={color} size={28} />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                  <span style={{ fontSize: "32px", fontWeight: 900, color: "#111827", letterSpacing: "-1px" }}>
                    {data.score}
                  </span>
                  <span style={{ fontSize: "16px", fontWeight: 600, color: "#6b7280" }}>/100</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                  <span style={{ fontSize: "18px" }}>{levelMeta.emoji}</span>
                  <span style={{ fontSize: "15px", fontWeight: 700, color }}>{levelMeta.label}</span>
                </div>
                <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#9ca3af" }}>{levelMeta.tagline}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                width: "32px", height: "32px", borderRadius: "50%",
                background: "#f3f4f6", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "16px", color: "#6b7280", flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", padding: "20px 24px 24px" }}>
          <p style={{ margin: "0 0 18px", fontSize: "13px", fontWeight: 600, color: "#374151", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Score Breakdown
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {factorOrder.map((key) => {
              const meta = (data.factorMeta ?? TRUST_FACTOR_META)[key];
              if (!meta) return null;
              const value = Math.round(data.breakdown?.[key] ?? 0);
              return (
                <div key={key}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                      <span style={{ fontSize: "16px" }}>{meta.icon}</span>
                      <div>
                        <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "#111827" }}>{meta.label}</p>
                        <p style={{ margin: 0, fontSize: "11px", color: "#9ca3af", lineHeight: 1.4 }}>{meta.description}</p>
                      </div>
                    </div>
                    <span style={{
                      fontSize: "13px", fontWeight: 800, color: value >= 70 ? "#10b981" : value >= 40 ? "#f59e0b" : "#ef4444",
                      minWidth: "32px", textAlign: "right",
                    }}>
                      {value}%
                    </span>
                  </div>
                  <ProgressBar value={value} color={value >= 70 ? "#10b981" : value >= 40 ? "#f59e0b" : "#ef4444"} />
                </div>
              );
            })}
          </div>

          {/* Footer note */}
          <div style={{ marginTop: "20px", padding: "12px 14px", background: "#f9fafb", borderRadius: "12px", border: "1px solid #f3f4f6" }}>
            <p style={{ margin: 0, fontSize: "11px", color: "#9ca3af", lineHeight: 1.5 }}>
              🛡️ Trust Score is calculated from verified sales, customer reviews, refund rate, profile completeness, and community activity. It updates automatically.
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Main TrustScoreBadge Component ───────────────────────────────────────────

type BadgeSize = "sm" | "md" | "lg";

interface TrustScoreBadgeProps {
  /** Creator user ID to fetch score for */
  userId: string;
  /** Size variant */
  size?: BadgeSize;
  /** If true, data is already passed in (no fetch needed) */
  prefetchedData?: TrustScoreData | null;
  /** Extra style overrides */
  style?: React.CSSProperties;
}

export function TrustScoreBadge({
  userId,
  size = "md",
  prefetchedData,
  style,
}: TrustScoreBadgeProps) {
  const [data, setData] = useState<TrustScoreData | null>(prefetchedData ?? null);
  const [loading, setLoading] = useState(!prefetchedData);
  const [modalOpen, setModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (prefetchedData !== undefined) { setData(prefetchedData); setLoading(false); return; }
    let active = true;
    setLoading(true);
    fetch(`/api/trust-score/${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((d) => { if (active) setData(d); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId, prefetchedData]);

  if (loading) {
    const h = size === "sm" ? "24px" : size === "lg" ? "40px" : "32px";
    return (
      <div style={{
        display: "inline-flex", alignItems: "center", gap: "6px",
        padding: "4px 10px", borderRadius: "999px",
        background: "#f3f4f6", border: "1px solid #e5e7eb",
        height: h, ...style,
      }}>
        <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#e5e7eb", animation: "pulse 1.5s infinite" }} />
        <div style={{ width: "60px", height: "10px", borderRadius: "4px", background: "#e5e7eb" }} />
      </div>
    );
  }

  // Not opted in
  if (!data?.publicOptIn || data?.adminSuppressed) {
    if (size === "sm") return null; // don't clutter small contexts
    return (
      <div style={{
        display: "inline-flex", alignItems: "center", gap: "6px",
        padding: "5px 12px", borderRadius: "999px",
        background: "#f9fafb", border: "1px solid #e5e7eb",
        fontSize: "11px", color: "#9ca3af", fontWeight: 600,
        ...style,
      }}>
        <ShieldIcon color="#9ca3af" size={14} />
        No reputation stats
      </div>
    );
  }

  const levelMeta = getTrustLevel(data.score);
  const color = levelMeta.color;

  const sizeStyles = {
    sm: { padding: "3px 8px", gap: "5px", fontSize: "11px", shieldSize: 12 },
    md: { padding: "5px 12px", gap: "7px", fontSize: "13px", shieldSize: 15 },
    lg: { padding: "8px 16px", gap: "9px", fontSize: "15px", shieldSize: 20 },
  }[size];

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        style={{
          display: "inline-flex", alignItems: "center", gap: `${sizeStyles.gap}px`,
          padding: sizeStyles.padding, borderRadius: "999px",
          background: `${color}12`, border: `1px solid ${color}30`,
          cursor: "pointer", transition: "all 0.15s",
          fontSize: sizeStyles.fontSize, fontWeight: 700, color,
          letterSpacing: "-0.1px", whiteSpace: "nowrap",
          ...style,
        }}
        title={`${levelMeta.label} — Click for details`}
      >
        <ShieldIcon color={color} size={sizeStyles.shieldSize} />
        <span>{data.score}</span>
        {size !== "sm" && <span style={{ fontWeight: 600, opacity: 0.7 }}>{levelMeta.emoji} {levelMeta.label}</span>}
      </button>

      {mounted && modalOpen && (
        <TrustScoreModal data={data} onClose={() => setModalOpen(false)} />
      )}
    </>
  );
}

// ─── Full Trust Score Card (for store pages) ───────────────────────────────────

interface TrustScoreCardProps {
  userId: string;
  accentColor?: string;
  /** Pre-fetched data from server side (server components only) */
  prefetchedData?: TrustScoreData | null;
}

export function TrustScoreCard({ userId, accentColor = "#f97316", prefetchedData }: TrustScoreCardProps) {
  const [data, setData] = useState<TrustScoreData | null>(prefetchedData ?? null);
  const [loading, setLoading] = useState(!prefetchedData);
  const [modalOpen, setModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (prefetchedData !== undefined) { setData(prefetchedData); setLoading(false); return; }
    let active = true;
    fetch(`/api/trust-score/${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((d) => { if (active) setData(d); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId, prefetchedData]);

  if (loading) return null;
  if (!data?.publicOptIn || data?.adminSuppressed) return null;

  const levelMeta = getTrustLevel(data.score);
  const color = levelMeta.color;

  // Show 4 top signal stats
  const rawSignals = (data as any).rawSignals ?? {};

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        style={{
          display: "flex", flexDirection: "column", gap: "10px",
          padding: "16px 18px", borderRadius: "16px",
          background: `${color}0A`, border: `1px solid ${color}25`,
          cursor: "pointer", textAlign: "left", width: "100%",
          transition: "all 0.15s",
        }}
      >
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <ShieldIcon color={color} size={18} />
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#374151" }}>Trust Score</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "3px" }}>
            <span style={{ fontSize: "22px", fontWeight: 900, color, letterSpacing: "-0.8px" }}>{data.score}</span>
            <span style={{ fontSize: "12px", color: "#9ca3af", fontWeight: 600 }}>/100</span>
          </div>
        </div>

        {/* Level badge */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: "4px",
            padding: "2px 10px", borderRadius: "999px",
            background: `${color}18`, border: `1px solid ${color}30`,
            fontSize: "12px", fontWeight: 700, color,
          }}>
            {levelMeta.emoji} {levelMeta.label}
          </span>
        </div>

        {/* Quick stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
          {rawSignals.verifiedSales > 0 && (
            <div style={{ fontSize: "12px", color: "#374151" }}>
              <span style={{ fontWeight: 700 }}>{rawSignals.verifiedSales}</span>
              <span style={{ color: "#9ca3af" }}> verified sales</span>
            </div>
          )}
          {rawSignals.avgRating > 0 && rawSignals.reviewCount >= 1 && (
            <div style={{ fontSize: "12px", color: "#374151" }}>
              <span style={{ fontWeight: 700 }}>★ {Number(rawSignals.avgRating).toFixed(1)}</span>
              <span style={{ color: "#9ca3af" }}> avg rating</span>
            </div>
          )}
          {rawSignals.refundRatePct !== undefined && (
            <div style={{ fontSize: "12px", color: "#374151" }}>
              <span style={{ fontWeight: 700 }}>{Math.round(100 - rawSignals.refundRatePct)}%</span>
              <span style={{ color: "#9ca3af" }}> satisfaction</span>
            </div>
          )}
          {rawSignals.reviewCount > 0 && (
            <div style={{ fontSize: "12px", color: "#374151" }}>
              <span style={{ fontWeight: 700 }}>{rawSignals.reviewCount}</span>
              <span style={{ color: "#9ca3af" }}> reviews</span>
            </div>
          )}
        </div>

        <p style={{ margin: 0, fontSize: "11px", color: "#9ca3af" }}>Click to see full breakdown →</p>
      </button>

      {mounted && modalOpen && (
        <TrustScoreModal data={data} onClose={() => setModalOpen(false)} />
      )}
    </>
  );
}
