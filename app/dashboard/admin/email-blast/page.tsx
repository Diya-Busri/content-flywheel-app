"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, AlertTriangle, Mail, Users, Send, X, CheckCircle2,
  User, Search, ChevronDown, Clock, Calendar, Trash2, RefreshCw
} from "lucide-react";

type Audience = "all" | "active_7d" | "active_30d" | "inactive_30d" | "specific";
type SendMode = "now" | "scheduled";

const AUDIENCE_OPTIONS: { value: Audience; label: string; description: string }[] = [
  { value: "all",          label: "All Users",           description: "Every registered user" },
  { value: "active_7d",    label: "Active Last 7 Days",   description: "Users who logged in recently" },
  { value: "active_30d",   label: "Active Last 30 Days",  description: "Users active this month" },
  { value: "inactive_30d", label: "Inactive 30+ Days",    description: "Re-engagement targets" },
  { value: "specific",     label: "Specific User",        description: "Send to one person" },
];

type UserRow = { userId: string; email: string; firstName?: string; lastName?: string };
type Toast = { msg: string; ok: boolean };

type ScheduledBlast = {
  id: string;
  subject: string;
  audience: string;
  targetEmail: string | null;
  scheduledFor: string;
  status: string;
  recipientCount: number | null;
  sentAt: string | null;
};

function UserPicker({ users, selected, onSelect }: {
  users: UserRow[];
  selected: UserRow | null;
  onSelect: (u: UserRow) => void;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    `${u.firstName ?? ""} ${u.lastName ?? ""}`.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-md border border-input bg-background text-sm hover:bg-muted transition-colors text-left"
      >
        {selected ? (
          <span className="truncate font-medium">{selected.email}</span>
        ) : (
          <span className="text-muted-foreground">Select a user…</span>
        )}
        <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg border border-border bg-popover shadow-xl overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by email or name…"
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
            />
            {search && <button onClick={() => setSearch("")}><X className="w-3.5 h-3.5 text-muted-foreground" /></button>}
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground text-center">No users found</p>
            ) : filtered.map(u => (
              <button
                key={u.userId}
                type="button"
                onClick={() => { onSelect(u); setOpen(false); setSearch(""); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted transition-colors ${selected?.userId === u.userId ? "bg-orange-500/5" : ""}`}
              >
                <div className="min-w-0">
                  {(u.firstName || u.lastName) && (
                    <p className="text-sm font-medium truncate">{[u.firstName, u.lastName].filter(Boolean).join(" ")}</p>
                  )}
                  <p className={`truncate ${(u.firstName || u.lastName) ? "text-xs text-muted-foreground" : "text-sm font-medium"}`}>{u.email}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const AUDIENCE_LABELS: Record<string, string> = {
  all: "All Users",
  active_7d: "Active 7d",
  active_30d: "Active 30d",
  inactive_30d: "Inactive 30d+",
  specific: "Specific User",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  sent: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  cancelled: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

export default function AdminEmailBlastPage() {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<Audience>("all");
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [sendMode, setSendMode] = useState<SendMode>("now");
  const [scheduledFor, setScheduledFor] = useState("");

  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);

  const [confirmStep, setConfirmStep] = useState(false);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [sentResult, setSentResult] = useState<{ count: number } | null>(null);

  // Scheduled blasts list
  const [scheduledBlasts, setScheduledBlasts] = useState<ScheduledBlast[]>([]);
  const [blastsLoading, setBlastsLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  async function loadScheduledBlasts() {
    setBlastsLoading(true);
    try {
      const res = await fetch("/api/admin/email-blast/scheduled");
      const data = (await res.json().catch(() => ({}))) as { blasts?: ScheduledBlast[] };
      setScheduledBlasts(data.blasts ?? []);
    } catch { /* silent */ } finally {
      setBlastsLoading(false);
    }
  }

  useEffect(() => { void loadScheduledBlasts(); }, []);

  // Load users when Specific User is selected
  useEffect(() => {
    if (audience === "specific" && users.length === 0) {
      setLoadingUsers(true);
      fetch("/api/admin/user-list")
        .then(r => r.json())
        .then((d: { users?: UserRow[] }) => setUsers(d.users ?? []))
        .catch(() => {})
        .finally(() => setLoadingUsers(false));
    }
  }, [audience, users.length]);

  const fetchCount = useCallback(async (aud: Audience) => {
    if (aud === "specific") { setRecipientCount(null); return; }
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
    if (audience === "specific" && !selectedUser) return;

    if (sendMode === "scheduled") {
      if (!scheduledFor) return;
      // Schedule it
      setSending(true);
      try {
        const res = await fetch("/api/admin/email-blast/scheduled", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject: subject.trim(),
            htmlBody: body.trim(),
            audience,
            targetEmail: audience === "specific" ? selectedUser?.email : undefined,
            scheduledFor,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as { blast?: ScheduledBlast; error?: string };
        if (data.blast) {
          setScheduledBlasts(prev => [data.blast!, ...prev]);
          setSubject(""); setBody(""); setAudience("all"); setSelectedUser(null); setScheduledFor("");
          setConfirmStep(false);
          showToast("Email blast scheduled!", true);
        } else {
          showToast(data.error ?? "Failed to schedule", false);
          setConfirmStep(false);
        }
      } catch {
        showToast("Failed to schedule", false);
        setConfirmStep(false);
      } finally {
        setSending(false);
      }
      return;
    }

    // Send now
    setSending(true);
    try {
      const res = await fetch("/api/admin/email-blast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim(),
          htmlBody: body.trim(),
          audience,
          targetEmail: audience === "specific" ? selectedUser?.email : undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { sent?: number; error?: string };
      if (data.sent !== undefined) {
        setSentResult({ count: data.sent });
        setSubject(""); setBody(""); setAudience("all"); setSelectedUser(null);
        setConfirmStep(false);
        showToast(`Email blast sent to ${data.sent} user${data.sent !== 1 ? "s" : ""}`, true);
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

  async function cancelBlast(id: string) {
    setCancellingId(id);
    try {
      await fetch(`/api/admin/email-blast/scheduled/${id}`, { method: "DELETE" });
      setScheduledBlasts(prev => prev.map(b => b.id === id ? { ...b, status: "cancelled" } : b));
      showToast("Scheduled blast cancelled", true);
    } catch {
      showToast("Failed to cancel", false);
    } finally {
      setCancellingId(null);
    }
  }

  const audienceLabel = audience === "specific"
    ? (selectedUser?.email ?? "Specific User")
    : (AUDIENCE_OPTIONS.find((o) => o.value === audience)?.label ?? audience);

  const canSend = subject.trim().length > 0 && body.trim().length > 0 &&
    (audience !== "specific" || !!selectedUser) &&
    (sendMode === "now" || !!scheduledFor);

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

  const pendingBlasts = scheduledBlasts.filter(b => b.status === "pending");
  const pastBlasts = scheduledBlasts.filter(b => b.status !== "pending");

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${toast.ok ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
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
                      onClick={() => { setAudience(opt.value); setSelectedUser(null); }}
                      className={`text-left px-3 py-2.5 rounded-lg border text-sm transition-all flex items-start gap-2 ${
                        audience === opt.value
                          ? "border-orange-500 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300"
                          : "border-[#E5E7EB] dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20 text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {opt.value === "specific" && <User className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
                      <div>
                        <div className="font-medium text-[13px]">{opt.label}</div>
                        <div className="text-xs opacity-60 mt-0.5">{opt.description}</div>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Specific user picker */}
                {audience === "specific" && (
                  <div className="mt-2">
                    {loadingUsers ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> Loading users…
                      </div>
                    ) : (
                      <UserPicker users={users} selected={selectedUser} onSelect={setSelectedUser} />
                    )}
                    {selectedUser && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Sending to: <span className="font-medium text-foreground">{selectedUser.email}</span>
                      </p>
                    )}
                  </div>
                )}

                {/* Recipient count */}
                {audience !== "specific" && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <Users className="w-4 h-4" />
                    {countLoading ? (
                      <span className="flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> Counting…</span>
                    ) : recipientCount !== null ? (
                      <span>Estimated <strong className="text-gray-900 dark:text-white">{recipientCount.toLocaleString()}</strong> recipients</span>
                    ) : <span>—</span>}
                  </div>
                )}
              </div>

              {/* Subject */}
              <div className="space-y-1.5">
                <Label htmlFor="subject" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Subject *</Label>
                <Input id="subject" placeholder="Your email subject line" value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>

              {/* Body */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="body" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Body *</Label>
                  <span className="text-[11px] text-muted-foreground">Markdown supported</span>
                </div>
                <textarea
                  id="body"
                  className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-card dark:border-white/10 min-h-[180px] resize-y font-mono"
                  placeholder={"Hi {{name}},\n\nWe have an exciting update for you...\n\nBest,\nThe Content Flywheel Team"}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </div>

              {/* Send mode toggle */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">When to send</Label>
                <div className="flex rounded-lg border border-input overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setSendMode("now")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors ${sendMode === "now" ? "bg-orange-500 text-white" : "bg-background text-muted-foreground hover:bg-muted dark:bg-card"}`}
                  >
                    <Send className="w-3.5 h-3.5" /> Send Now
                  </button>
                  <button
                    type="button"
                    onClick={() => setSendMode("scheduled")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors ${sendMode === "scheduled" ? "bg-orange-500 text-white" : "bg-background text-muted-foreground hover:bg-muted dark:bg-card"}`}
                  >
                    <Clock className="w-3.5 h-3.5" /> Schedule
                  </button>
                </div>

                {sendMode === "scheduled" && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Date &amp; time *</Label>
                    <Input
                      type="datetime-local"
                      value={scheduledFor}
                      onChange={(e) => setScheduledFor(e.target.value)}
                      min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                      className="dark:[color-scheme:dark]"
                    />
                  </div>
                )}
              </div>

              {/* Send / Confirm */}
              {!confirmStep ? (
                <Button
                  className={`w-full text-white ${sendMode === "scheduled" ? "bg-blue-500 hover:bg-blue-600" : "bg-orange-500 hover:bg-orange-600"}`}
                  disabled={!canSend || sending}
                  onClick={() => setConfirmStep(true)}
                >
                  {sendMode === "scheduled"
                    ? <><Calendar className="w-4 h-4 mr-2" />Schedule Email Blast</>
                    : <><Send className="w-4 h-4 mr-2" />Send Email Blast</>}
                </Button>
              ) : (
                <div className="rounded-lg border border-orange-400/50 bg-orange-50 dark:bg-orange-950/30 p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-sm text-orange-900 dark:text-orange-200">
                        {sendMode === "scheduled" ? "Confirm Schedule" : "Confirm Send"}
                      </p>
                      <p className="text-sm text-orange-700 dark:text-orange-300 mt-0.5">
                        {sendMode === "scheduled"
                          ? <>Schedule <strong>{`"${subject}"`}</strong> to <strong>{audienceLabel}</strong> for <strong>{new Date(scheduledFor).toLocaleString()}</strong>?</>
                          : <>Send <strong>{`"${subject}"`}</strong> to <strong>{audience === "specific" ? selectedUser?.email : recipientCount !== null ? `${recipientCount.toLocaleString()} users` : audienceLabel}</strong>? This cannot be undone.</>
                        }
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white" disabled={sending} onClick={() => void handleSend()}>
                      {sending ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Processing…</> : <><Send className="w-4 h-4 mr-2" />Yes, Confirm</>}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setConfirmStep(false)} disabled={sending}>Cancel</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Preview */}
        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                Email Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-[#E5E7EB] dark:border-white/10 overflow-hidden">
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
                  {sendMode === "scheduled" && scheduledFor && (
                    <div className="flex items-center gap-2 text-xs text-blue-500">
                      <Clock className="w-3 h-3" />
                      <span>Scheduled: {new Date(scheduledFor).toLocaleString()}</span>
                    </div>
                  )}
                </div>

                <div className="bg-white dark:bg-card p-5 min-h-[240px]">
                  <div className="flex items-center gap-2 mb-5 pb-4 border-b border-gray-100 dark:border-white/10">
                    <div className="w-7 h-7 rounded-md bg-orange-500 flex items-center justify-center">
                      <span className="text-white text-xs font-bold">CF</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">Content Flywheel</span>
                  </div>
                  {body ? (
                    <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed" dangerouslySetInnerHTML={{ __html: renderPreview(body) }} />
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Your email body will appear here…</p>
                  )}
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

              <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="w-4 h-4" />
                <span>Will be sent to <strong className="text-gray-900 dark:text-white">
                  {audience === "specific" ? (selectedUser ? "1 recipient" : "—") : recipientCount !== null ? `${recipientCount.toLocaleString()} recipients` : "—"}
                </strong></span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Scheduled Blasts */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-orange-500" />
              Scheduled &amp; Sent Blasts
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => void loadScheduledBlasts()} disabled={blastsLoading}>
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${blastsLoading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {blastsLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : scheduledBlasts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No scheduled blasts yet.</p>
          ) : (
            <div className="space-y-4">
              {/* Pending */}
              {pendingBlasts.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Upcoming</p>
                  <div className="space-y-2">
                    {pendingBlasts.map(b => (
                      <div key={b.id} className="flex items-center justify-between gap-4 p-3 rounded-lg border border-blue-200 dark:border-blue-800/40 bg-blue-50/50 dark:bg-blue-900/10">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{b.subject}</p>
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {new Date(b.scheduledFor).toLocaleString()}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              → {b.audience === "specific" ? b.targetEmail : AUDIENCE_LABELS[b.audience] ?? b.audience}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge className={`text-[10px] ${STATUS_COLORS[b.status]}`}>{b.status}</Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive h-7 w-7 p-0"
                            disabled={cancellingId === b.id}
                            onClick={() => void cancelBlast(b.id)}
                          >
                            {cancellingId === b.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Past */}
              {pastBlasts.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">History</p>
                  <div className="space-y-2">
                    {pastBlasts.map(b => (
                      <div key={b.id} className="flex items-center justify-between gap-4 p-3 rounded-lg border border-[#E5E7EB] dark:border-white/10">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{b.subject}</p>
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                            <span className="text-xs text-muted-foreground">
                              {b.sentAt ? `Sent ${new Date(b.sentAt).toLocaleString()}` : new Date(b.scheduledFor).toLocaleString()}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              → {b.audience === "specific" ? b.targetEmail : AUDIENCE_LABELS[b.audience] ?? b.audience}
                            </span>
                            {b.recipientCount != null && (
                              <span className="text-xs text-muted-foreground">{b.recipientCount} recipients</span>
                            )}
                          </div>
                        </div>
                        <Badge className={`text-[10px] shrink-0 ${STATUS_COLORS[b.status] ?? ""}`}>{b.status}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
