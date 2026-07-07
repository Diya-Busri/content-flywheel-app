"use client";

/**
 * PlatformConnections.tsx
 * ──────────────────────────────────────────────────────────────────────────────
 * Shows connection status for all 7 publishing platforms.
 * Allows users to connect/disconnect and enter credentials.
 */

import { useEffect, useState, useCallback } from "react";
import type { MarketingManagerId } from "@/db/schema/launch-schema";

type ConnectionStatus = {
  connected:   boolean;
  accountName?: string;
  connectedAt?: string;
};

type ConnectionsMap = Partial<Record<MarketingManagerId, ConnectionStatus>>;

type PlatformMeta = {
  id:          MarketingManagerId;
  label:       string;
  emoji:       string;
  description: string;
  oauthReady:  boolean;
  fields:      Array<{ key: string; label: string; placeholder: string; type?: "text" | "email" | "password" }>;
};

const PLATFORMS: PlatformMeta[] = [
  {
    id: "tiktok", label: "TikTok", emoji: "🎵", description: "Short-form video",
    oauthReady: false,
    fields: [{ key: "accountName", label: "Username", placeholder: "@yourhandle" }],
  },
  {
    id: "instagram", label: "Instagram", emoji: "📸", description: "Photos & reels",
    oauthReady: false,
    fields: [{ key: "accountName", label: "Username", placeholder: "@yourhandle" }],
  },
  {
    id: "youtube", label: "YouTube", emoji: "▶️", description: "Long-form video",
    oauthReady: false,
    fields: [{ key: "accountName", label: "Channel name", placeholder: "Your Channel" }],
  },
  {
    id: "x", label: "X", emoji: "✖", description: "Tweets & threads",
    oauthReady: false,
    fields: [{ key: "accountName", label: "Username", placeholder: "@yourhandle" }],
  },
  {
    id: "linkedin", label: "LinkedIn", emoji: "💼", description: "Professional posts",
    oauthReady: false,
    fields: [{ key: "accountName", label: "Profile name", placeholder: "Your Name" }],
  },
  {
    id: "email", label: "Email", emoji: "📧", description: "Direct to list",
    oauthReady: true,
    fields: [
      { key: "accountName", label: "From name", placeholder: "Your Name" },
      { key: "accessToken", label: "Resend API key", placeholder: "re_xxxx...", type: "password" },
      { key: "scopes", label: "Send test to", placeholder: "you@example.com", type: "email" },
    ],
  },
  {
    id: "seo", label: "SEO / Blog", emoji: "🔍", description: "Content publishing",
    oauthReady: false,
    fields: [{ key: "accountName", label: "Website", placeholder: "https://yoursite.com" }],
  },
];

export function PlatformConnections() {
  const [connections, setConnections]     = useState<ConnectionsMap>({});
  const [loading, setLoading]             = useState(true);
  const [openModal, setOpenModal]         = useState<MarketingManagerId | null>(null);
  const [formValues, setFormValues]       = useState<Record<string, string>>({});
  const [saving, setSaving]               = useState(false);
  const [disconnecting, setDisconnecting] = useState<MarketingManagerId | null>(null);

  const fetchConnections = useCallback(async () => {
    try {
      const res = await fetch("/api/platform-connections");
      if (!res.ok) return;
      const data = await res.json() as { connections: ConnectionsMap };
      setConnections(data.connections ?? {});
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchConnections().finally(() => setLoading(false)); }, [fetchConnections]);

  async function handleConnect(platform: MarketingManagerId) {
    setSaving(true);
    try {
      const body: Record<string, string> = { platform };
      for (const [k, v] of Object.entries(formValues)) { if (v) body[k] = v; }

      const res = await fetch("/api/platform-connections", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      if (res.ok) {
        await fetchConnections();
        setOpenModal(null);
        setFormValues({});
      }
    } finally { setSaving(false); }
  }

  async function handleDisconnect(platform: MarketingManagerId) {
    setDisconnecting(platform);
    try {
      await fetch(`/api/platform-connections/${platform}`, { method: "DELETE" });
      setConnections(prev => { const n = { ...prev }; delete n[platform]; return n; });
    } finally { setDisconnecting(null); }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 animate-pulse">
        {PLATFORMS.map(p => (
          <div key={p.id} className="h-16 rounded-xl bg-muted/30" />
        ))}
      </div>
    );
  }

  const connectedCount = Object.values(connections).filter(c => c?.connected).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-[13px] font-bold text-foreground">Platform Connections</h3>
          <p className="text-[11px] text-muted-foreground/50 mt-0.5">
            {connectedCount > 0
              ? `${connectedCount} of 7 platforms connected`
              : "Connect platforms to publish directly from Content Flywheel"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
        {PLATFORMS.map(p => {
          const conn      = connections[p.id];
          const connected = conn?.connected ?? false;

          return (
            <div
              key={p.id}
              className={`relative rounded-xl border p-2.5 text-center transition-colors ${connected ? "border-green-500/30 bg-green-500/[0.04]" : "border-border/50 bg-card/30"}`}
            >
              <div className="text-xl mb-1">{p.emoji}</div>
              <p className="text-[10px] font-semibold text-foreground/80 truncate">{p.label}</p>
              {connected ? (
                <div className="mt-1.5 space-y-1">
                  {conn?.accountName && (
                    <p className="text-[9px] text-muted-foreground/60 truncate">{conn.accountName}</p>
                  )}
                  <button
                    onClick={() => handleDisconnect(p.id)}
                    disabled={disconnecting === p.id}
                    className="text-[9px] text-red-400/70 hover:text-red-400 transition-colors"
                  >
                    {disconnecting === p.id ? "…" : "Disconnect"}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setOpenModal(p.id); setFormValues({}); }}
                  className="mt-1.5 text-[9px] text-primary/60 hover:text-primary transition-colors font-medium"
                >
                  Connect
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Connect modal */}
      {openModal && (() => {
        const platform = PLATFORMS.find(p => p.id === openModal)!;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm rounded-2xl border border-border bg-background p-5 shadow-xl">
              <div className="flex items-center gap-2.5 mb-4">
                <span className="text-xl">{platform.emoji}</span>
                <div>
                  <h4 className="text-[14px] font-bold text-foreground">Connect {platform.label}</h4>
                  <p className="text-[11px] text-muted-foreground/50">{platform.description}</p>
                </div>
              </div>

              {platform.oauthReady ? (
                <div className="space-y-3">
                  {platform.fields.map(f => (
                    <div key={f.key}>
                      <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">{f.label}</label>
                      <input
                        type={f.type ?? "text"}
                        value={formValues[f.key] ?? ""}
                        onChange={e => setFormValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-muted/20 text-[12px] text-foreground focus:outline-none focus:border-primary/40"
                      />
                    </div>
                  ))}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setOpenModal(null)}
                      className="flex-1 px-3 py-2 rounded-lg border border-border text-[12px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleConnect(openModal)}
                      disabled={saving}
                      className="flex-1 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-[12px] font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                      {saving ? "Connecting…" : "Connect"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.05] p-3 text-[11px] text-amber-400/80">
                    <p className="font-semibold mb-1">OAuth setup required</p>
                    <p>To publish directly to {platform.label}, set up a developer app with OAuth credentials in your environment.</p>
                    <p className="mt-1.5">For now, you can simulate a connection to track content locally.</p>
                  </div>

                  {platform.fields.map(f => (
                    <div key={f.key}>
                      <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">{f.label}</label>
                      <input
                        type={f.type ?? "text"}
                        value={formValues[f.key] ?? ""}
                        onChange={e => setFormValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-muted/20 text-[12px] text-foreground focus:outline-none focus:border-primary/40"
                      />
                    </div>
                  ))}

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setOpenModal(null)}
                      className="flex-1 px-3 py-2 rounded-lg border border-border text-[12px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleConnect(openModal)}
                      disabled={saving || !formValues.accountName}
                      className="flex-1 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-[12px] font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                      {saving ? "Connecting…" : "Connect (Simulated)"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
