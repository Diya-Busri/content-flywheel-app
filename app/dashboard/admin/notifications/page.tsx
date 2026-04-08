"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Bell, CheckCircle, Info, Users, User, AlertCircle, Search, ChevronDown, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

type NotifType = "info" | "success" | "warning";
type Audience = "all" | "specific";

type UserRow = {
  userId: string;
  email: string;
  membership: string;
  status: string;
};

type FormState = {
  title: string;
  message: string;
  type: NotifType;
  linkUrl: string;
  audience: Audience;
  targetUserId: string;
  targetEmail: string;
};

const TYPE_OPTIONS: { value: NotifType; label: string }[] = [
  { value: "info", label: "Info" },
  { value: "success", label: "Success" },
  { value: "warning", label: "Warning" },
];

const TYPE_BADGE_COLORS: Record<NotifType, string> = {
  info: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  success: "bg-green-500/10 text-green-600 border-green-500/20",
  warning: "bg-orange-500/10 text-orange-600 border-orange-500/20",
};

type SendResult = { sent: number; total: number };

function UserPicker({ users, selected, onSelect }: {
  users: UserRow[];
  selected: { userId: string; email: string } | null;
  onSelect: (user: UserRow) => void;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.userId.toLowerCase().includes(search.toLowerCase())
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
          <span className="flex items-center gap-2 min-w-0">
            <span className="truncate font-medium">{selected.email}</span>
            <Badge variant="outline" className="shrink-0 text-[10px] py-0">{users.find(u => u.userId === selected.userId)?.membership ?? ""}</Badge>
          </span>
        ) : (
          <span className="text-muted-foreground">Select a user…</span>
        )}
        <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg border border-border bg-popover shadow-xl overflow-hidden">
          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by email…"
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
            />
            {search && (
              <button onClick={() => setSearch("")}><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
            )}
          </div>

          {/* User list */}
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground text-center">No users found</p>
            ) : (
              filtered.map(u => (
                <button
                  key={u.userId}
                  type="button"
                  onClick={() => { onSelect(u); setOpen(false); setSearch(""); }}
                  className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-muted transition-colors ${selected?.userId === u.userId ? "bg-orange-500/5" : ""}`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{u.email}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.userId}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="outline" className={`text-[10px] py-0 ${u.membership === "pro" ? "border-orange-400 text-orange-500" : ""}`}>
                      {u.membership}
                    </Badge>
                    {u.status === "suspended" && (
                      <Badge variant="outline" className="text-[10px] py-0 border-red-400 text-red-500">suspended</Badge>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminNotificationsPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({
    title: "", message: "", type: "info", linkUrl: "",
    audience: "all", targetUserId: "", targetEmail: "",
  });
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);

  // Load users when "Specific User" is selected
  useEffect(() => {
    if (form.audience === "specific" && users.length === 0) {
      setLoadingUsers(true);
      setUsersError(null);
      fetch("/api/admin/user-list")
        .then(async r => {
          const d = await r.json();
          if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
          setUsers(d.users ?? []);
        })
        .catch((e: unknown) => {
          setUsersError(e instanceof Error ? e.message : "Failed to load users");
        })
        .finally(() => setLoadingUsers(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.audience]);

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(f => ({ ...f, [key]: value }));
    setResult(null);
  }

  function isValid(): boolean {
    if (!form.title.trim() || !form.message.trim()) return false;
    if (form.audience === "specific" && !form.targetUserId) return false;
    return true;
  }

  async function handleSend() {
    if (!isValid()) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          message: form.message,
          type: form.type,
          linkUrl: form.linkUrl.trim() || undefined,
          audience: form.audience,
          targetUserId: form.audience === "specific" ? form.targetUserId : undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { sent?: number; total?: number; error?: string };
      if (res.ok) {
        const sent = data.sent ?? 0;
        setResult({ sent, total: data.total ?? sent });
        toast({ title: `Notification sent to ${sent} user${sent !== 1 ? "s" : ""}` });
        setForm(f => ({ ...f, title: "", message: "", linkUrl: "" }));
      } else {
        toast({ title: "Failed to send", description: data.error ?? "Unknown error", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Push Notifications</h1>
        <p className="text-sm text-muted-foreground mt-1">Send in-app notifications to users</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell className="w-5 h-5 text-orange-500" />
            Compose Notification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Title</label>
            <Input placeholder="e.g. New feature available!" value={form.title} onChange={e => updateForm("title", e.target.value)} />
          </div>

          {/* Message */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Message</label>
            <Textarea placeholder="Write your message here…" value={form.message} onChange={e => updateForm("message", e.target.value)} rows={3} className="resize-none" />
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Type</label>
            <div className="flex gap-2">
              {TYPE_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => updateForm("type", opt.value)}
                  className={`flex-1 py-2 px-3 rounded-md border text-sm font-medium transition-colors ${form.type === opt.value ? `${TYPE_BADGE_COLORS[opt.value]} border-current` : "border-border text-muted-foreground hover:bg-muted"}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Link URL */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Link URL <span className="text-muted-foreground font-normal">(optional)</span></label>
            <Input placeholder="https://contentflywheel.co.uk/dashboard/…" value={form.linkUrl} onChange={e => updateForm("linkUrl", e.target.value)} />
          </div>

          {/* Audience */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Audience</label>
            <div className="flex gap-2">
              <button onClick={() => updateForm("audience", "all")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md border text-sm font-medium transition-colors ${form.audience === "all" ? "bg-orange-500/10 text-orange-600 border-orange-500/30" : "border-border text-muted-foreground hover:bg-muted"}`}>
                <Users className="w-4 h-4" /> All Users
              </button>
              <button onClick={() => updateForm("audience", "specific")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md border text-sm font-medium transition-colors ${form.audience === "specific" ? "bg-orange-500/10 text-orange-600 border-orange-500/30" : "border-border text-muted-foreground hover:bg-muted"}`}>
                <User className="w-4 h-4" /> Specific User
              </button>
            </div>
          </div>

          {/* User picker */}
          {form.audience === "specific" && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Select User</label>
              {loadingUsers ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading users…
                </div>
              ) : usersError ? (
                <div className="flex items-center gap-2 text-sm text-red-500 py-2">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {usersError}
                </div>
              ) : (
                <UserPicker
                  users={users}
                  selected={form.targetUserId ? { userId: form.targetUserId, email: form.targetEmail } : null}
                  onSelect={u => { updateForm("targetUserId", u.userId); updateForm("targetEmail", u.email); }}
                />
              )}
              {form.targetEmail && (
                <p className="text-xs text-muted-foreground">Sending to: <span className="font-medium text-foreground">{form.targetEmail}</span></p>
              )}
            </div>
          )}

          {/* Preview */}
          {(form.title || form.message) && (
            <div className="rounded-lg border border-border p-4 bg-muted/20 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Preview</p>
              <div className="flex items-start gap-3">
                <div className={TYPE_BADGE_COLORS[form.type].split(" ").filter(c => c.startsWith("text-")).join(" ")}>
                  {form.type === "info" && <Info className="w-4 h-4" />}
                  {form.type === "success" && <CheckCircle className="w-4 h-4" />}
                  {form.type === "warning" && <AlertCircle className="w-4 h-4" />}
                </div>
                <div>
                  {form.title && <p className="text-sm font-semibold">{form.title}</p>}
                  {form.message && <p className="text-sm text-muted-foreground">{form.message}</p>}
                  {form.linkUrl && <p className="text-xs text-orange-500 mt-0.5">{form.linkUrl}</p>}
                </div>
                <Badge variant="outline" className={`ml-auto text-xs ${TYPE_BADGE_COLORS[form.type]}`}>{form.type}</Badge>
              </div>
            </div>
          )}

          {/* Success */}
          {result && (
            <div className="flex items-center gap-2 rounded-md bg-green-500/10 border border-green-500/20 text-green-700 text-sm px-4 py-3">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>Sent to <strong>{result.sent}</strong> user{result.sent !== 1 ? "s" : ""} successfully.</span>
            </div>
          )}

          {/* Send button */}
          <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white" onClick={() => void handleSend()} disabled={sending || !isValid()}>
            {sending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending…</> : <><Bell className="w-4 h-4 mr-2" />{form.audience === "all" ? "Send to All Users" : "Send to User"}</>}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardContent className="pt-5 pb-5">
          <div className="flex gap-3">
            <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium">How notifications work</p>
              <p className="text-sm text-muted-foreground">
                Notifications are stored in the database and delivered in-app the next time the user opens their dashboard. They appear in the notification bell in the sidebar.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
