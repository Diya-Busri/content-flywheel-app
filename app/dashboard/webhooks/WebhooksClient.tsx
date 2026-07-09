"use client";

import { useState } from "react";
import { Trash2, Copy, Check, Plus, Zap, X } from "lucide-react";

type Hook = {
  id: string;
  url: string;
  secret: string;
  events: string;
  active: boolean;
  lastStatus: string | null;
  lastDeliveredAt: Date | null;
  createdAt: Date;
};

const EVENT_OPTIONS = [
  { value: "product_sold", label: "Product sold", desc: "Fires when a buyer completes checkout on any of your products" },
  { value: "bundle_sold", label: "Bundle sold", desc: "Fires when a buyer purchases one of your bundles" },
];

export default function WebhooksClient({ initialHooks }: { initialHooks: Hook[] }) {
  const [hooks, setHooks] = useState<Hook[]>(initialHooks);
  const [showForm, setShowForm] = useState(false);
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>(["product_sold"]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const toggleEvent = (e: string) =>
    setSelectedEvents((prev) => prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]);

  const copySecret = (secret: string, id: string) => {
    navigator.clipboard.writeText(secret).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const handleCreate = async () => {
    setError(null);
    if (!url.trim().startsWith("https://")) { setError("URL must start with https://"); return; }
    if (selectedEvents.length === 0) { setError("Select at least one event"); return; }
    setSaving(true);
    const res = await fetch("/api/creator/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url.trim(), events: selectedEvents }),
    });
    const data = await res.json();
    if (res.ok) {
      setHooks((h) => [...h, data]);
      setUrl(""); setSelectedEvents(["product_sold"]); setShowForm(false);
    } else {
      setError(data.error ?? "Failed to create webhook");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this webhook? Events will stop being sent.")) return;
    await fetch("/api/creator/webhooks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setHooks((h) => h.filter((x) => x.id !== id));
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Webhooks</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Get notified when events happen in your store — pipe data to Zapier, Make, or your own server.
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setError(null); }}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <Plus size={16} /> Add webhook
        </button>
      </div>

      {/* Docs callout */}
      <div className="rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 px-4 py-3 text-xs text-gray-500 space-y-1">
        <p className="font-semibold text-gray-700 dark:text-gray-300">Payload format</p>
        <pre className="overflow-x-auto text-[11px] text-gray-600 dark:text-gray-400">{`POST your-url\nContent-Type: application/json\nX-CF-Event: product_sold\nX-CF-Signature: sha256=<hmac>\n\n{"event":"product_sold","createdAt":"...","data":{...}}`}</pre>
        <p>Verify with: <code>HMAC-SHA256(secret, rawBody)</code>. Your secret is shown once — copy it now.</p>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="rounded-2xl border border-orange-200 dark:border-orange-900/40 bg-orange-50 dark:bg-orange-950/20 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">New webhook</h2>
            <button onClick={() => { setShowForm(false); setError(null); }} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 block">Endpoint URL (HTTPS)</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-server.com/webhook"
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 block">Events to subscribe</label>
              <div className="space-y-2">
                {EVENT_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-start gap-3 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 cursor-pointer hover:border-orange-300 transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedEvents.includes(opt.value)}
                      onChange={() => toggleEvent(opt.value)}
                      className="mt-0.5 accent-orange-500"
                    />
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{opt.label}</p>
                      <p className="text-xs text-gray-500">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            onClick={handleCreate}
            disabled={saving}
            className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {saving ? "Creating…" : "Create webhook"}
          </button>
        </div>
      )}

      {/* Hook list */}
      {hooks.length === 0 && !showForm ? (
        <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 p-12 text-center">
          <Zap className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">No webhooks yet</p>
          <p className="text-xs text-gray-400 mt-1">Add a webhook to receive real-time sale notifications</p>
        </div>
      ) : (
        <div className="space-y-3">
          {hooks.map((hook) => (
            <div key={hook.id} className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{hook.url}</p>
                  <p className="text-xs text-gray-500">
                    Events: <span className="font-medium text-gray-700 dark:text-gray-300">{hook.events.split(",").join(", ")}</span>
                  </p>
                  {hook.lastStatus && (
                    <p className="text-xs text-gray-400">
                      Last delivery: <span className={hook.lastStatus === "ok" ? "text-green-600" : "text-red-500"}>{hook.lastStatus}</span>
                      {hook.lastDeliveredAt && ` · ${new Date(hook.lastDeliveredAt).toLocaleString("en-GB")}`}
                    </p>
                  )}
                  {/* Secret — shown inline, copy button */}
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                    <code className="text-[11px] bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded font-mono truncate max-w-xs">
                      {hook.secret.slice(0, 12)}••••••••••••••••
                    </code>
                    <button
                      onClick={() => copySecret(hook.secret, hook.id)}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-orange-500 transition-colors"
                      title="Copy full secret"
                    >
                      {copied === hook.id ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                      {copied === hook.id ? "Copied" : "Copy secret"}
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(hook.id)}
                  className="p-1.5 text-gray-400 hover:text-red-500 transition-colors shrink-0"
                  title="Remove webhook"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
