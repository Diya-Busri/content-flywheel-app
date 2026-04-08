"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  RefreshCw,
  Users,
  AlertTriangle,
  Moon,
  TrendingUp,
  Activity,
  Bell,
  X,
  CheckCircle,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

type RetentionSummary = {
  total: number;
  active7: number;
  active30: number;
  atRisk: number;
  neverActive: number;
  dormant: number;
};

type AtRiskUser = {
  userId: string;
  email: string | null;
  lastActiveAt: string | null;
  createdAt: string;
};

type NeverActiveUser = {
  userId: string;
  email: string | null;
  createdAt: string;
};

type RetentionData = {
  summary: RetentionSummary;
  atRiskUsers: AtRiskUser[];
  neverActiveUsers: NeverActiveUser[];
};

type NotifFormState = {
  title: string;
  message: string;
};

function daysAgo(dateStr: string | null): string {
  if (!dateStr) return "never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function StatCard({
  label,
  value,
  color,
  icon,
  loading,
}: {
  label: string;
  value: number;
  color: string;
  icon: React.ReactNode;
  loading: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-muted-foreground font-medium">{label}</p>
          <span className={color}>{icon}</span>
        </div>
        {loading ? (
          <div className="h-8 w-16 bg-muted animate-pulse rounded" />
        ) : (
          <p className={`text-3xl font-bold ${color}`}>{value}</p>
        )}
      </CardContent>
    </Card>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-border">
      {[1, 2, 3, 4].map((i) => (
        <td key={i} className="py-3 px-4">
          <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
        </td>
      ))}
    </tr>
  );
}

type InlineNotifFormProps = {
  userId: string;
  email: string | null;
  onClose: () => void;
};

function InlineNotifForm({ userId, email, onClose }: InlineNotifFormProps) {
  const { toast } = useToast();
  const [form, setForm] = useState<NotifFormState>({ title: "", message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSend() {
    if (!form.title.trim() || !form.message.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          message: form.message,
          type: "info",
          audience: "specific",
          targetUserId: userId,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { sent?: number; error?: string };
      if (res.ok) {
        setSent(true);
        toast({ title: `Notification sent to ${email ?? userId}` });
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

  if (sent) {
    return (
      <tr className="bg-green-500/5 border-b border-border">
        <td colSpan={4} className="py-3 px-4">
          <div className="flex items-center gap-2 text-green-600 text-sm">
            <CheckCircle className="w-4 h-4" />
            <span>Notification sent successfully.</span>
            <button onClick={onClose} className="ml-auto text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="bg-muted/30 border-b border-border">
      <td colSpan={4} className="py-3 px-4">
        <div className="flex flex-col gap-2 max-w-xl">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Send notification to {email ?? userId}
            </p>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <Input
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="h-8 text-sm"
          />
          <Textarea
            placeholder="Message…"
            value={form.message}
            onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
            className="text-sm resize-none"
            rows={2}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              className="h-8 bg-orange-500 hover:bg-orange-600 text-white"
              onClick={() => void handleSend()}
              disabled={sending || !form.title.trim() || !form.message.trim()}
            >
              {sending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Bell className="w-3 h-3 mr-1" />}
              Send
            </Button>
            <Button size="sm" variant="ghost" className="h-8" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </td>
    </tr>
  );
}

export default function AdminRetentionPage() {
  const [data, setData] = useState<RetentionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [openNotifId, setOpenNotifId] = useState<string | null>(null);
  const { toast } = useToast();

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/retention");
      const json = (await res.json()) as RetentionData;
      setData(json);
    } catch {
      toast({ title: "Failed to load retention data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const summary = data?.summary ?? {
    total: 0,
    active7: 0,
    active30: 0,
    atRisk: 0,
    neverActive: 0,
    dormant: 0,
  };

  const statCards = [
    {
      label: "Total Pro Users",
      value: summary.total,
      color: "text-foreground",
      icon: <Users className="w-5 h-5" />,
    },
    {
      label: "Active (Last 7 days)",
      value: summary.active7,
      color: "text-green-500",
      icon: <TrendingUp className="w-5 h-5" />,
    },
    {
      label: "Active (Last 30 days)",
      value: summary.active30,
      color: "text-blue-500",
      icon: <Activity className="w-5 h-5" />,
    },
    {
      label: "At Risk (30+ days inactive)",
      value: summary.atRisk,
      color: "text-orange-500",
      icon: <AlertTriangle className="w-5 h-5" />,
    },
    {
      label: "Never Active",
      value: summary.neverActive,
      color: "text-red-500",
      icon: <Users className="w-5 h-5" />,
    },
    {
      label: "Dormant (60+ days inactive)",
      value: summary.dormant,
      color: "text-muted-foreground",
      icon: <Moon className="w-5 h-5" />,
    },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Retention Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pro user activity and churn risk analysis
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {statCards.map((s) => (
          <StatCard
            key={s.label}
            label={s.label}
            value={s.value}
            color={s.color}
            icon={s.icon}
            loading={loading}
          />
        ))}
      </div>

      {/* At-Risk Users */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            <CardTitle className="text-lg">At-Risk Users</CardTitle>
            {!loading && data && (
              <Badge
                variant="outline"
                className="ml-auto text-orange-500 border-orange-500/40"
              >
                {data.atRiskUsers.length} shown
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Pro users who have not been active in 30+ days
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left py-2 px-4 font-medium text-muted-foreground">
                    Email
                  </th>
                  <th className="text-left py-2 px-4 font-medium text-muted-foreground">
                    Last Active
                  </th>
                  <th className="text-left py-2 px-4 font-medium text-muted-foreground">
                    Joined
                  </th>
                  <th className="text-left py-2 px-4 font-medium text-muted-foreground">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                ) : !data || data.atRiskUsers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-12 text-center text-muted-foreground"
                    >
                      No at-risk users found.
                    </td>
                  </tr>
                ) : (
                  data.atRiskUsers.flatMap((user) => {
                    const rows = [
                      <tr
                        key={user.userId}
                        className="border-b border-border hover:bg-muted/30 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <span className="font-medium">
                            {user.email ?? (
                              <span className="text-muted-foreground italic">
                                no email
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-orange-500 font-medium">
                            {daysAgo(user.lastActiveAt)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {formatDate(user.createdAt)}
                        </td>
                        <td className="py-3 px-4">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() =>
                              setOpenNotifId(
                                openNotifId === user.userId ? null : user.userId
                              )
                            }
                          >
                            <Bell className="w-3 h-3 mr-1" />
                            {openNotifId === user.userId
                              ? "Cancel"
                              : "Send Notification"}
                          </Button>
                        </td>
                      </tr>,
                    ];
                    if (openNotifId === user.userId) {
                      rows.push(
                        <InlineNotifForm
                          key={`${user.userId}-notif`}
                          userId={user.userId}
                          email={user.email}
                          onClose={() => setOpenNotifId(null)}
                        />
                      );
                    }
                    return rows;
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Never Active Users */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Moon className="w-5 h-5 text-red-500" />
            <CardTitle className="text-lg">Never Active</CardTitle>
            {!loading && data && (
              <Badge
                variant="outline"
                className="ml-auto text-red-500 border-red-500/40"
              >
                {data.neverActiveUsers.length} shown
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Pro users who joined but have never used the platform
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left py-2 px-4 font-medium text-muted-foreground">
                    Email
                  </th>
                  <th className="text-left py-2 px-4 font-medium text-muted-foreground">
                    Joined
                  </th>
                  <th className="text-left py-2 px-4 font-medium text-muted-foreground">
                    Days Since Joining
                  </th>
                  <th className="text-left py-2 px-4 font-medium text-muted-foreground">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
                ) : !data || data.neverActiveUsers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-12 text-center text-muted-foreground"
                    >
                      No never-active users found.
                    </td>
                  </tr>
                ) : (
                  data.neverActiveUsers.flatMap((user) => {
                    const rows = [
                      <tr
                        key={user.userId}
                        className="border-b border-border hover:bg-muted/30 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <span className="font-medium">
                            {user.email ?? (
                              <span className="text-muted-foreground italic">
                                no email
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {formatDate(user.createdAt)}
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-red-500 font-medium">
                            {daysAgo(user.createdAt)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() =>
                              setOpenNotifId(
                                openNotifId === user.userId ? null : user.userId
                              )
                            }
                          >
                            <Bell className="w-3 h-3 mr-1" />
                            {openNotifId === user.userId
                              ? "Cancel"
                              : "Send Notification"}
                          </Button>
                        </td>
                      </tr>,
                    ];
                    if (openNotifId === user.userId) {
                      rows.push(
                        <InlineNotifForm
                          key={`${user.userId}-notif`}
                          userId={user.userId}
                          email={user.email}
                          onClose={() => setOpenNotifId(null)}
                        />
                      );
                    }
                    return rows;
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
