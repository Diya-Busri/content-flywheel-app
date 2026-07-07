"use client";

/**
 * IntegrationSettings — Phase 6.0
 * ──────────────────────────────────────────────────────────────────────────────
 * UI for connecting third-party analytics, email, and store providers.
 * Renders inside the project page (or a dedicated /integrations sub-page).
 *
 * Keys are stored per-project in stageResults.integrations (JSONB).
 * The API route masks actual values so only connected/disconnected state
 * is returned — the component shows a green badge when a key is set and
 * lets the user update or clear it.
 */

import { useEffect, useState, useCallback } from "react";
import {
  Check,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Input }    from "@/components/ui/input";
import { Label }    from "@/components/ui/label";
import { Button }   from "@/components/ui/button";

/* ─── Types ──────────────────────────────────────────────────────────────────── */

type Props = { launchId: string };

// Mirrors the masked response (true = set, false = not set)
type MaskedSettings = Record<string, Record<string, boolean>>;

type FieldDef = {
  key:         string; // nested key like "lemonSqueezy.apiKey"
  label:       string;
  placeholder: string;
  helpUrl?:    string;
  isSecret?:   boolean;
};

type SectionDef = {
  id:     string;
  title:  string;
  desc:   string;
  fields: FieldDef[];
};

/* ─── Config ─────────────────────────────────────────────────────────────────── */

const SECTIONS: SectionDef[] = [
  {
    id:    "revenue",
    title: "Store & Revenue",
    desc:  "Connect your store to track real sales in the Business OS briefing.",
    fields: [
      { key: "lemonSqueezy.apiKey", label: "Lemon Squeezy API Key",      placeholder: "lsv2_...",     isSecret: true, helpUrl: "https://app.lemonsqueezy.com/settings/api" },
      { key: "lemonSqueezy.storeId", label: "Lemon Squeezy Store ID",    placeholder: "12345" },
      { key: "gumroad.accessToken", label: "Gumroad Access Token",        placeholder: "...",          isSecret: true, helpUrl: "https://app.gumroad.com/settings/advanced" },
      { key: "gumroad.productId",   label: "Gumroad Product ID (filter)", placeholder: "leave blank for all" },
    ],
  },
  {
    id:    "analytics",
    title: "Website Analytics",
    desc:  "Fetch page views and traffic data for your landing page.",
    fields: [
      { key: "postHog.apiKey",     label: "PostHog Personal API Key",    placeholder: "phx_...",    isSecret: true, helpUrl: "https://app.posthog.com/me/settings" },
      { key: "postHog.projectId",  label: "PostHog Project ID",          placeholder: "12345" },
      { key: "plausible.apiKey",   label: "Plausible API Key",           placeholder: "...",        isSecret: true, helpUrl: "https://plausible.io/settings/api-keys" },
      { key: "plausible.siteId",   label: "Plausible Site ID",           placeholder: "yourdomain.com" },
    ],
  },
  {
    id:    "email",
    title: "Email Analytics",
    desc:  "Pull open rates, click rates, and unsubscribes into your growth reviews.",
    fields: [
      { key: "resend.apiKey",     label: "Resend API Key",               placeholder: "re_...",     isSecret: true, helpUrl: "https://resend.com/settings/api-keys" },
      { key: "resend.audienceId", label: "Resend Audience ID",           placeholder: "..." },
      { key: "brevo.apiKey",      label: "Brevo (Sendinblue) API Key",   placeholder: "xkeysib-...", isSecret: true, helpUrl: "https://app.brevo.com/settings/keys/api" },
      { key: "brevo.listId",      label: "Brevo List ID",                placeholder: "1" },
      { key: "mailchimp.apiKey",  label: "Mailchimp API Key",            placeholder: "...-us1",    isSecret: true, helpUrl: "https://mailchimp.com/help/about-api-keys/" },
      { key: "mailchimp.listId",  label: "Mailchimp List ID",            placeholder: "abc123def" },
      { key: "mailchimp.server",  label: "Mailchimp Server Prefix",      placeholder: "us1" },
    ],
  },
];

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

/** "lemonSqueezy.apiKey" → ["lemonSqueezy", "apiKey"] */
function splitKey(key: string): [string, string] {
  const [a, b] = key.split(".");
  return [a!, b!];
}

function isConnected(masked: MaskedSettings, key: string): boolean {
  const [section, field] = splitKey(key);
  return Boolean(masked[section!]?.[field!]);
}

/* ─── Component ──────────────────────────────────────────────────────────────── */

export function IntegrationSettings({ launchId }: Props) {
  const [masked,    setMasked]    = useState<MaskedSettings>({});
  const [drafts,    setDrafts]    = useState<Record<string, string>>({});
  const [expanded,  setExpanded]  = useState<Record<string, boolean>>({ revenue: true });
  const [saving,    setSaving]    = useState<Record<string, boolean>>({});
  const [loading,   setLoading]   = useState(true);

  const { toast } = useToast();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${launchId}/integrations`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json() as { integrations: MaskedSettings };
      setMasked(data.integrations ?? {});
    } catch {
      toast({ title: "Error", description: "Could not load integrations", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [launchId, toast]);

  useEffect(() => { void load(); }, [load]);

  async function save(sectionId: string) {
    setSaving(s => ({ ...s, [sectionId]: true }));
    try {
      // Collect all drafts that belong to this section
      const section = SECTIONS.find(s => s.id === sectionId);
      if (!section) return;

      // Build nested patch object from flat draft keys
      const patch: Record<string, Record<string, string>> = {};
      for (const field of section.fields) {
        const val = drafts[field.key];
        if (val === undefined) continue; // not changed
        const [parent, child] = splitKey(field.key);
        if (!patch[parent!]) patch[parent!] = {};
        patch[parent!]![child!] = val;
      }

      const res = await fetch(`/api/projects/${launchId}/integrations`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Save failed");
      const data = await res.json() as { integrations: MaskedSettings };
      setMasked(data.integrations ?? {});

      // Clear saved drafts
      setDrafts(d => {
        const next = { ...d };
        for (const f of section.fields) delete next[f.key];
        return next;
      });
      toast({ title: "Saved", description: `${section.title} integration updated.` });
    } catch {
      toast({ title: "Error", description: "Could not save", variant: "destructive" });
    } finally {
      setSaving(s => ({ ...s, [sectionId]: false }));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-gray-500 dark:text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading integrations…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {SECTIONS.map(section => {
        const open    = expanded[section.id] ?? false;
        const isSaving = saving[section.id] ?? false;
        const anyConnected = section.fields.some(f => isConnected(masked, f.key));
        const hasDraft = section.fields.some(f => drafts[f.key] !== undefined);

        return (
          <div
            key={section.id}
            className="rounded-xl border border-[#E5E7EB] dark:border-[#1E1E1E] overflow-hidden"
          >
            {/* Section header */}
            <button
              type="button"
              onClick={() => setExpanded(e => ({ ...e, [section.id]: !e[section.id] }))}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50/80 dark:bg-[#111] hover:bg-gray-100 dark:hover:bg-[#161616] transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                {open ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{section.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{section.desc}</p>
                </div>
              </div>
              {anyConnected && (
                <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 rounded-full px-2 py-0.5">
                  <Check className="h-2.5 w-2.5" />
                  Connected
                </span>
              )}
            </button>

            {open && (
              <div className="px-4 py-4 space-y-4 bg-white dark:bg-[#0D0D0D]">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {section.fields.map(field => {
                    const connected = isConnected(masked, field.key);
                    const draft     = drafts[field.key] ?? "";
                    return (
                      <div key={field.key} className="space-y-1">
                        <Label className="text-xs text-gray-700 dark:text-gray-300 flex items-center gap-2">
                          {field.label}
                          {connected && (
                            <span className="flex items-center gap-0.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                              <Check className="h-2.5 w-2.5" />
                              Set
                            </span>
                          )}
                          {!connected && (
                            <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
                              <AlertCircle className="h-2.5 w-2.5" />
                              Not set
                            </span>
                          )}
                          {field.helpUrl && (
                            <a
                              href={field.helpUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-auto text-orange-500 hover:text-orange-600"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </Label>
                        <Input
                          type={field.isSecret ? "password" : "text"}
                          placeholder={connected ? "••••••••••• (saved)" : field.placeholder}
                          value={draft}
                          onChange={e => setDrafts(d => ({ ...d, [field.key]: e.target.value }))}
                          className="text-sm h-8"
                        />
                      </div>
                    );
                  })}
                </div>

                {hasDraft && (
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      className="bg-orange-500 hover:bg-orange-600 h-8 text-xs"
                      disabled={isSaving}
                      onClick={() => void save(section.id)}
                    >
                      {isSaving ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : null}
                      Save {section.title}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
