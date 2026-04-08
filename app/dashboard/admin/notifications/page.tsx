"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Bell,
  CheckCircle,
  Info,
  Users,
  User,
  AlertCircle,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

type NotifType = "info" | "success" | "warning";
type Audience = "all" | "specific";

type FormState = {
  title: string;
  message: string;
  type: NotifType;
  linkUrl: string;
  audience: Audience;
  targetUserId: string;
};

const TYPE_OPTIONS: { value: NotifType; label: string; color: string }[] = [
  { value: "info", label: "Info", color: "text-blue-500" },
  { value: "success", label: "Success", color: "text-green-500" },
  { value: "warning", label: "Warning", color: "text-orange-500" },
];

const TYPE_BADGE_COLORS: Record<NotifType, string> = {
  info: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  success: "bg-green-500/10 text-green-600 border-green-500/20",
  warning: "bg-orange-500/10 text-orange-600 border-orange-500/20",
};

type SendResult = {
  sent: number;
  total: number;
};

export default function AdminNotificationsPage() {
  const { toast } = useToast();

  const [form, setForm] = useState<FormState>({
    title: "",
    message: "",
    type: "info",
    linkUrl: "",
    audience: "all",
    targetUserId: "",
  });
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setResult(null);
  }

  function isValid(): boolean {
    if (!form.title.trim() || !form.message.trim()) return false;
    if (form.audience === "specific" && !form.targetUserId.trim()) return false;
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
          targetUserId:
            form.audience === "specific" ? form.targetUserId.trim() : undefined,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        sent?: number;
        total?: number;
        error?: string;
      };

      if (res.ok) {
        const sent = data.sent ?? 0;
        const total = data.total ?? sent;
        setResult({ sent, total });
        toast({
          title: `Notification sent to ${sent} user${sent !== 1 ? "s" : ""}`,
        });
        // Reset form on success
        setForm((f) => ({ ...f, title: "", message: "", linkUrl: "" }));
      } else {
        toast({
          title: "Failed to send",
          description: data.error ?? "Unknown error",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Push Notifications</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Send in-app notifications to users
        </p>
      </div>

      {/* Compose card */}
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
            <Input
              placeholder="e.g. New feature available!"
              value={form.title}
              onChange={(e) => updateForm("title", e.target.value)}
            />
          </div>

          {/* Message */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Message</label>
            <Textarea
              placeholder="Write your message here…"
              value={form.message}
              onChange={(e) => updateForm("message", e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Type selector */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Type</label>
            <div className="flex gap-2">
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => updateForm("type", opt.value)}
                  className={`flex-1 py-2 px-3 rounded-md border text-sm font-medium transition-colors ${
                    form.type === opt.value
                      ? `${TYPE_BADGE_COLORS[opt.value]} border-current`
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Link URL (optional) */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Link URL{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Input
              placeholder="https://app.contentflywheel.com/dashboard/…"
              value={form.linkUrl}
              onChange={(e) => updateForm("linkUrl", e.target.value)}
            />
          </div>

          {/* Audience selector */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Audience</label>
            <div className="flex gap-2">
              <button
                onClick={() => updateForm("audience", "all")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md border text-sm font-medium transition-colors ${
                  form.audience === "all"
                    ? "bg-orange-500/10 text-orange-600 border-orange-500/30"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                <Users className="w-4 h-4" />
                All Users
              </button>
              <button
                onClick={() => updateForm("audience", "specific")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md border text-sm font-medium transition-colors ${
                  form.audience === "specific"
                    ? "bg-orange-500/10 text-orange-600 border-orange-500/30"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                <User className="w-4 h-4" />
                Specific User
              </button>
            </div>
          </div>

          {/* Specific user input */}
          {form.audience === "specific" && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">User ID or Email</label>
              <Input
                placeholder="user_2abc… or user@example.com"
                value={form.targetUserId}
                onChange={(e) => updateForm("targetUserId", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Enter the Clerk user ID (starts with user_) or the user's email
                address stored in the database.
              </p>
            </div>
          )}

          {/* Preview */}
          {(form.title || form.message) && (
            <div className="rounded-lg border border-border p-4 bg-muted/20 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Preview
              </p>
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 ${
                    TYPE_BADGE_COLORS[form.type]
                      .split(" ")
                      .filter((c) => c.startsWith("text-"))
                      .join(" ")
                  }`}
                >
                  {form.type === "info" && <Info className="w-4 h-4" />}
                  {form.type === "success" && <CheckCircle className="w-4 h-4" />}
                  {form.type === "warning" && <AlertCircle className="w-4 h-4" />}
                </div>
                <div>
                  {form.title && (
                    <p className="text-sm font-semibold">{form.title}</p>
                  )}
                  {form.message && (
                    <p className="text-sm text-muted-foreground">{form.message}</p>
                  )}
                  {form.linkUrl && (
                    <p className="text-xs text-orange-500 mt-0.5">{form.linkUrl}</p>
                  )}
                </div>
                <Badge
                  variant="outline"
                  className={`ml-auto text-xs ${TYPE_BADGE_COLORS[form.type]}`}
                >
                  {form.type}
                </Badge>
              </div>
            </div>
          )}

          {/* Success result */}
          {result && (
            <div className="flex items-center gap-2 rounded-md bg-green-500/10 border border-green-500/20 text-green-700 text-sm px-4 py-3">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>
                Sent to <strong>{result.sent}</strong> user
                {result.sent !== 1 ? "s" : ""} successfully.
              </span>
            </div>
          )}

          {/* Send button */}
          <Button
            className="w-full bg-orange-500 hover:bg-orange-600 text-white"
            onClick={() => void handleSend()}
            disabled={sending || !isValid()}
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <Bell className="w-4 h-4 mr-2" />
                {form.audience === "all"
                  ? "Send to All Users"
                  : "Send to User"}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Info card about notification delivery */}
      <Card className="border-dashed">
        <CardContent className="pt-5 pb-5">
          <div className="flex gap-3">
            <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium">How notifications work</p>
              <p className="text-sm text-muted-foreground">
                Notifications are stored in the database and delivered in-app the
                next time the user opens their dashboard. They appear in the
                notification bell in the nav bar. Link URLs are optional — they
                create a clickable action inside the notification.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
