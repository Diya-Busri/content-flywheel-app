"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Bug, Lightbulb, Star, MessageSquare } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

type FeedbackRow = {
  id: string;
  userId: string;
  rating: number | null;
  category: "bug" | "idea" | "praise" | "other";
  message: string;
  page: string | null;
  status: "new" | "reviewed" | "actioned";
  createdAt: string;
};

const CATEGORY_CONFIG = {
  bug: { icon: <Bug className="w-3.5 h-3.5" />, color: "text-red-500", label: "Bug" },
  idea: { icon: <Lightbulb className="w-3.5 h-3.5" />, color: "text-yellow-500", label: "Idea" },
  praise: { icon: <Star className="w-3.5 h-3.5" />, color: "text-green-500", label: "Praise" },
  other: { icon: <MessageSquare className="w-3.5 h-3.5" />, color: "text-blue-500", label: "Other" },
};

const STATUS_FILTERS = ["all", "new", "reviewed", "actioned"] as const;

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function AdminFeedbackPage() {
  const [items, setItems] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "new" | "reviewed" | "actioned">("all");
  const [updating, setUpdating] = useState<string | null>(null);
  const { toast } = useToast();

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/feedback");
    const data = (await res.json().catch(() => ({}))) as { feedback?: FeedbackRow[] };
    setItems(data.feedback ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function updateStatus(id: string, status: "new" | "reviewed" | "actioned") {
    setUpdating(id);
    await fetch("/api/admin/feedback", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setItems((prev) => prev.map((f) => f.id === id ? { ...f, status } : f));
    setUpdating(null);
    toast({ title: `Marked as ${status}` });
  }

  const filtered = filter === "all" ? items : items.filter((f) => f.status === filter);
  const newCount = items.filter((f) => f.status === "new").length;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Feedback Inbox
            {newCount > 0 && (
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold">{newCount}</span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{items.length} total submissions</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={filter === s ? "default" : "outline"}
            className={filter === s ? "bg-orange-500 hover:bg-orange-600 text-white" : ""}
            onClick={() => setFilter(s)}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
            {s === "new" && newCount > 0 && (
              <span className="ml-1.5 bg-white text-orange-500 rounded-full w-4 h-4 text-[10px] font-bold inline-flex items-center justify-center">{newCount}</span>
            )}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-16 text-center"><p className="text-muted-foreground">No feedback yet 🎉</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((fb) => {
            const cat = CATEGORY_CONFIG[fb.category];
            return (
              <Card key={fb.id} className={fb.status === "new" ? "border-orange-400/50" : ""}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className={`flex items-center gap-1 text-xs font-medium ${cat.color}`}>
                          {cat.icon} {cat.label}
                        </span>
                        {fb.rating && (
                          <span className="text-xs text-yellow-500">{"★".repeat(fb.rating)}{"☆".repeat(5 - fb.rating)}</span>
                        )}
                        <Badge variant={fb.status === "new" ? "default" : "secondary"} className="text-[10px]">
                          {fb.status}
                        </Badge>
                        {fb.page && (
                          <span className="text-xs text-muted-foreground font-mono">{fb.page}</span>
                        )}
                      </div>
                      <p className="text-sm">{fb.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">{timeAgo(fb.createdAt)}</p>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      {fb.status !== "reviewed" && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" disabled={updating === fb.id}
                          onClick={() => void updateStatus(fb.id, "reviewed")}>
                          Reviewed
                        </Button>
                      )}
                      {fb.status !== "actioned" && (
                        <Button size="sm" className="h-7 text-xs bg-orange-500 hover:bg-orange-600 text-white" disabled={updating === fb.id}
                          onClick={() => void updateStatus(fb.id, "actioned")}>
                          Actioned
                        </Button>
                      )}
                    </div>
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
