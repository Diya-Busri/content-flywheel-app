"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AlertTriangle, Mail, Users, Send, X, CheckCircle2 } from "lucide-react";

type Audience = "all" | "active_7d" | "active_30d" | "inactive_30d";

const AUDIENCE_OPTIONS: { value: Audience; label: string; description: string }[] = [
  { value: "all",          label: "All Users",               description: "Every registered user" },
  { value: "active_7d",    label: "Active Last 7 Days",       description: "Users who logged in recently" },
  { value: "active_30d",   label: "Active Last 30 Days",      description: "Users active this month" },
  { value: "inactive_30d", label: "Inactive 30+ Days",        description: "Re-engagement targets" },
];

type Toast = { msg: string; ok: boolean };

export default function AdminEmailBlastPage() {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<Audience>("all");

  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);

  const [confirmStep, setConfirmStep] = useState(false);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [sentResult, setSentResult] = useState<{ count: number } | null>(null);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  const fetchCount = useCallback(async (aud: Audience) => {
    setCountLoading(true);
    setRecipientCount(null);
    try {
      const res = await fetch(`/api/admin/email-blast?audience=${aud}&countOnly=true`);
      const data = (await res.json().catch(() => ({}))) as { count?: number };
      setRecipientCount(data.count ?? null);
    } catch {
      setRecipientCount(null);
    } finally {
      setCountLoading(false);
    }
  }, []);

  useEffect(() => { void fetchCount(audience); }, [audience, fetchCount]);

  async function handleSend() {
    if (!subject.trim() || !body.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/admin/email-blast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subject.trim(), body: body.trim(), audience }),
      });
      const data = (await res.json().catch(() => ({}))) as { sent?: number; error?: string };
      if (data.sent !== undefined) {
        setSentResult({ count: data.sent });
        setSubject(""); setBody(""); setAudience("all");
        setConfirmStep(false);
        showToast(`Email blast sent to ${data.sent} users`, true);
      } else {
        showToast(data.error ?? "Failed to send email blast", false);
        setConfirmStep(false);
      }
    } catch {
      showToast("Failed to send email blast", false);
      setConfirmStep(false);
    } finally {
      setSending(false);
    }
  }

  const audienceLabel = AUDIENCE_OPTIONS.find((o) => o.value === audience)?.label ?? audience;
  const canSend = subject.trim().length > 0 && body.trim().length > 0;

  // Simple markdown-like preview renderer
  function renderPreview(text: string): string {
    return text
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`(.+?)`/g, '<code class="bg-gray-100 dark:bg-gray-800 px-1 rounded text-sm font-mono">$1</code>')
      .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mt-4 mb-2">$1</h1>')
      .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold mt-3 mb-1">$1</h2>')
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-orange-500 underline">$1</a>')
      .replace(/\n/g, "<br />");
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
            toast.ok ? "bg-green-500 text-white" : "bg-red-500 text-white"
          }`}
        >
          {toast.msg}
          <button onClick={() => setToast(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Email Blast</h1>
        <p className="text-sm text-muted-foreground mt-1">Compose and send bulk emails to your users</p>
      </div>

      {/* Warning banner */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/40 text-yellow-800 dark:text-yellow-300">
        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-sm">This will send real emails.</p>
          <p className="text-sm opacity-80">Double-check your subject, message, and audience before sending.</p>
        </div>
      </div>

      {/* Success state */}
      {sentResult && (
        <div className="flex items-center gap-3 px-4 py-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700/40 text-green-800 dark:text-green-300">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-semibold text-sm">Email blast sent successfully!</p>
            <p className="text-sm opacity-80">Delivered to {sentResult.count} user{sentResult.count !== 1 ? "s" : ""}.</p>
          </div>
          <button className="ml-auto" onClick={() => setSentResult(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left: Compose */}
        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="w-4 h-4 text-orange-500" />
                Compose
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Audience selector */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Audience</Label>
                <div className="grid grid-cols-2 gap-2">
                  {AUDIENCE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setAudience(opt.value)}
                      className={`text-left px-3 py-2.5 rounded-lg border text-sm transition-all ${
                        audience === opt.value
                          ? "border-orange-500 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300"
                          : "border-[#E5E7EB] dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20 text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      <div className="font-medium text-[13px]">{opt.label}</div>
                      <div className="text-xs opacity-60 mt-0.5">{opt.description}</div>
                    </button>
                  ))}
                </div>

                {/* Recipient count */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <Users className="w-4 h-4" />
                  {countLoading ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin" /> Counting recipients…
                    </span>
                  ) : recipientCount !== null ? (
                    <span>
                      Estimated <strong className="text-gray-900 dark:text-white">{recipientCount.toLocaleString()}</strong> recipients
                    </span>
                  ) : (
                    <span>—</span>
                  )}
                </div>
              </div>

              {/* Subject */}
              <div className="space-y-1.5">
                <Label htmlFor="subject" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Subject *
                </Label>
                <Input
                  id="subject"
                  placeholder="Your email subject line"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>

              {/* Body */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="body" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Body *
                  </Label>
                  <span className="text-[11px] text-muted-foreground">Markdown supported</span>
                </div>
                <textarea
                  id="body"
                  className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-card dark:border-white/10 min-h-[220px] resize-y font-mono"
                  placeholder={"Hi {{name}},\n\nWe have an exciting update for you...\n\n**New Feature:** ...\n\nBest,\nThe Content Flywheel Team"}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </div>

              {/* Send / Confirm */}
              {!confirmStep ? (
                <Button
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                  disabled={!canSend || sending}
                  onClick={() => setConfirmStep(true)}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Send Email Blast
                </Button>
              ) : (
                <div className="rounded-lg border border-orange-400/50 bg-orange-50 dark:bg-orange-950/30 p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-sm text-orange-900 dark:text-orange-200">Confirm Send</p>
                      <p className="text-sm text-orange-700 dark:text-orange-300 mt-0.5">
                        Send <strong>{`"${subject}"`}</strong> to{" "}
                        <strong>
                          {recipientCount !== null ? `${recipientCount.toLocaleString()} users` : audienceLabel}
                        </strong>
                        ? This cannot be undone.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="bg-orange-500 hover:bg-orange-600 text-white"
                      disabled={sending}
                      onClick={() => void handleSend()}
                    >
                      {sending ? (
                        <><Loader2 className="w-4 h-4 animate-spin mr-2" />Sending…</>
                      ) : (
                        <><Send className="w-4 h-4 mr-2" />Yes, Send Now</>
                      )}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setConfirmStep(false)} disabled={sending}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Preview */}
        <div className="space-y-5">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                Email Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Mock email frame */}
              <div className="rounded-lg border border-[#E5E7EB] dark:border-white/10 overflow-hidden">
                {/* Email header bar */}
                <div className="bg-gray-50 dark:bg-white/5 px-4 py-3 border-b border-[#E5E7EB] dark:border-white/10 space-y-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium w-12 shrink-0">From:</span>
                    <span>Content Flywheel &lt;hello@contentflywheel.com&gt;</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium w-12 shrink-0">To:</span>
                    <span>{audienceLabel}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-medium w-12 shrink-0 text-muted-foreground">Subject:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {subject || <span className="text-muted-foreground italic font-normal">Your subject here…</span>}
                    </span>
                  </div>
                </div>

                {/* Email body */}
                <div className="bg-white dark:bg-card p-5 min-h-[300px]">
                  {/* Header branding */}
                  <div className="flex items-center gap-2 mb-5 pb-4 border-b border-gray-100 dark:border-white/10">
                    <div className="w-7 h-7 rounded-md bg-orange-500 flex items-center justify-center">
                      <span className="text-white text-xs font-bold">CF</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">Content Flywheel</span>
                  </div>

                  {/* Body content */}
                  {body ? (
                    <div
                      className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: renderPreview(body) }}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Your email body will appear here…</p>
                  )}

                  {/* Footer */}
                  <div className="mt-8 pt-4 border-t border-gray-100 dark:border-white/10 text-xs text-gray-400 dark:text-gray-600">
                    <p>Content Flywheel · You&apos;re receiving this because you signed up for an account.</p>
                    <p className="mt-1">
                      <a href="#" className="text-orange-500 hover:underline">Unsubscribe</a>
                      {" · "}
                      <a href="#" className="text-orange-500 hover:underline">Privacy Policy</a>
                    </p>
                  </div>
                </div>
              </div>

              {/* Recipient count badge */}
              {recipientCount !== null && (
                <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="w-4 h-4" />
                  <span>
                    Will be sent to{" "}
                    <strong className="text-gray-900 dark:text-white">{recipientCount.toLocaleString()}</strong>{" "}
                    recipients
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
