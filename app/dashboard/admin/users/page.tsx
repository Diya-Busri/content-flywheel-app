"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, CreditCard, Users, RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

type UserRow = {
  userId: string;
  email: string;
  membership: string;
  videoCredits: number;
  status: string;
  createdAt: string;
  stats: { purchased: number; used: number; videoCount: number };
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [grantingId, setGrantingId] = useState<string | null>(null);
  const [grantAmount, setGrantAmount] = useState<Record<string, string>>({});
  const [grantNote, setGrantNote] = useState<Record<string, string>>({});
  const [suspending, setSuspending] = useState<string | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const { toast } = useToast();

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/users");
    const data = (await res.json().catch(() => ({}))) as { users?: UserRow[] };
    setUsers(data.users ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  const filtered = users.filter((u) =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.userId.toLowerCase().includes(search.toLowerCase())
  );

  async function handleSuspend(userId: string, currentlySuspended: boolean) {
    setSuspending(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/suspend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suspend: !currentlySuspended, reason: suspendReason || undefined }),
      });
      if (res.ok) {
        setUsers(prev => prev.map(u => u.userId === userId
          ? { ...u, status: !currentlySuspended ? "suspended" : "active" }
          : u
        ));
        setSuspendReason("");
      }
    } catch {}
    setSuspending(null);
  }

  async function handleGrant(userId: string, amount: number) {
    setGrantingId(userId);
    const res = await fetch(`/api/admin/users/${userId}/credits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, note: grantNote[userId] ?? "" }),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; newBalance?: number; error?: string };
    setGrantingId(null);
    if (data.ok) {
      toast({ title: `Credits updated — new balance: ${data.newBalance}` });
      void load();
    } else {
      toast({ title: "Failed", description: data.error, variant: "destructive" });
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-sm text-muted-foreground mt-1">{users.length} total users</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by email or user ID…"
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-3">
          {filtered.map((user) => (
            <Card key={user.userId}>
              <CardContent className="pt-4 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* User info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{user.email}</span>
                      <Badge variant={user.membership === "pro" ? "default" : "secondary"} className="text-xs">
                        {user.membership}
                      </Badge>
                      {user.status !== "active" && (
                        <Badge variant="destructive" className="text-xs">{user.status}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Joined {new Date(user.createdAt).toLocaleDateString()} · {user.stats.videoCount} videos generated
                    </p>
                    <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                      <span>💳 Balance: <strong className="text-foreground">{user.videoCredits}</strong></span>
                      <span>Purchased: {user.stats.purchased}</span>
                      <span>Used: {user.stats.used}</span>
                    </div>
                  </div>

                  {/* Grant credits */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Input
                      type="number"
                      placeholder="±credits"
                      className="w-24 h-8 text-sm"
                      value={grantAmount[user.userId] ?? ""}
                      onChange={(e) => setGrantAmount((p) => ({ ...p, [user.userId]: e.target.value }))}
                    />
                    <Input
                      placeholder="note (optional)"
                      className="w-36 h-8 text-sm hidden sm:block"
                      value={grantNote[user.userId] ?? ""}
                      onChange={(e) => setGrantNote((p) => ({ ...p, [user.userId]: e.target.value }))}
                    />
                    <Button
                      size="sm"
                      className="h-8 bg-orange-500 hover:bg-orange-600 text-white"
                      disabled={grantingId === user.userId || !grantAmount[user.userId]}
                      onClick={() => void handleGrant(user.userId, Number(grantAmount[user.userId] ?? 0))}
                    >
                      {grantingId === user.userId ? <Loader2 className="w-3 h-3 animate-spin" /> : <CreditCard className="w-3 h-3" />}
                      <span className="ml-1">Apply</span>
                    </Button>
                    <button
                      className={`text-xs px-2 py-1 rounded font-medium transition-colors disabled:opacity-50 ${
                        user.status === "suspended"
                          ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50"
                          : "bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:hover:bg-rose-900/50"
                      }`}
                      disabled={suspending === user.userId}
                      onClick={() => void handleSuspend(user.userId, user.status === "suspended")}
                    >
                      {suspending === user.userId
                        ? <Loader2 className="w-3 h-3 animate-spin inline" />
                        : user.status === "suspended" ? "Unsuspend" : "Suspend"
                      }
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground py-12">No users found.</p>
          )}
        </div>
      )}
    </div>
  );
}
