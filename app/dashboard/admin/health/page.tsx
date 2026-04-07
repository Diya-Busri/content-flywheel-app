"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, AlertTriangle, Info, AlertCircle } from "lucide-react";

type HealthLog = {
  id: string;
  level: "error" | "warning" | "info";
  route: string;
  message: string;
  userId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

type HealthData = { logs: HealthLog[]; errorCount: number; warnCount: number };

const LEVEL_OPTIONS = ["all", "error", "warning", "info"] as const;

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const LEVEL_CONFIG = {
  error: { icon: <AlertCircle className="w-3.5 h-3.5" />, color: "text-red-500", badge: "destructive" as const },
  warning: { icon: <AlertTriangle className="w-3.5 h-3.5" />, color: "text-yellow-500", badge: "outline" as const },
  info: { icon: <Info className="w-3.5 h-3.5" />, color: "text-blue-500", badge: "secondary" as const },
};

export default function AdminHealthPage() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState<"all" | "error" | "warning" | "info">("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const params = level !== "all" ? `?level=${level}` : "";
    const res = await fetch(`/api/admin/health${params}`);
    const json = (await res.json().catch(() => null)) as HealthData | null;
    setData(json);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [level]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Platform Health</h1>
          <p className="text-sm text-muted-foreground mt-1">Error logs and API failure tracking</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Summary stats */}
      {data && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-bold text-red-500">{data.errorCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Errors</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-bold text-yellow-500">{data.warnCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Warnings</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-bold">{data.logs.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Total logs</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Level filter */}
      <div className="flex gap-2 flex-wrap">
        {LEVEL_OPTIONS.map((l) => (
          <Button
            key={l}
            size="sm"
            variant={level === l ? "default" : "outline"}
            className={level === l ? "bg-orange-500 hover:bg-orange-600 text-white" : ""}
            onClick={() => setLevel(l)}
          >
            {l.charAt(0).toUpperCase() + l.slice(1)}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : data?.logs.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground">No logs found — platform is healthy ✅</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {data?.logs.map((log) => {
            const cfg = LEVEL_CONFIG[log.level];
            const isOpen = expanded === log.id;
            return (
              <Card key={log.id} className="cursor-pointer" onClick={() => setExpanded(isOpen ? null : log.id)}>
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className={`mt-0.5 shrink-0 ${cfg.color}`}>{cfg.icon}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={cfg.badge} className="text-[10px]">{log.level}</Badge>
                          <code className="text-xs font-mono text-muted-foreground">{log.route}</code>
                        </div>
                        <p className="text-sm mt-0.5 font-medium">{log.message}</p>
                        {log.userId && <p className="text-xs text-muted-foreground mt-0.5 font-mono">{log.userId}</p>}
                        {isOpen && log.metadata && (
                          <pre className="mt-2 text-xs bg-muted rounded p-2 overflow-x-auto whitespace-pre-wrap">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{timeAgo(log.createdAt)}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
