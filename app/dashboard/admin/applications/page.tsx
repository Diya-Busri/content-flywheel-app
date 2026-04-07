"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, Clock, XCircle, Users, RefreshCw, ChevronDown } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import type { SelectCreatorApplication } from "@/db/schema/creator-applications-schema";

type Application = SelectCreatorApplication;
type StatusFilter = "all" | "pending" | "accepted" | "waitlisted" | "rejected";

const STATUS_META = {
  accepted: { label: "Accepted", color: "bg-green-500/15 text-green-400 border-green-500/30" },
  waitlisted: { label: "Waitlisted", color: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
  pending: { label: "Pending", color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  rejected: { label: "Rejected", color: "bg-gray-500/15 text-gray-400 border-gray-500/30" },
};

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: "TikTok",
  youtube: "YouTube",
  instagram: "Instagram",
  other: "Other",
};

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "waitlisted", label: "Waitlisted" },
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
];

export default function AdminApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const load = useCallback(async (f: StatusFilter) => {
    setLoading(true);
    try {
      const url = f === "all"
        ? "/api/admin/creator-applications"
        : `/api/admin/creator-applications?status=${f}`;
      const res = await fetch(url);
      if (res.status === 403) {
        toast({ title: "Access denied", description: "Admin only.", variant: "destructive" });
        setApplications([]);
        return;
      }
      const data = (await res.json()) as { applications?: Application[] };
      setApplications(data.applications ?? []);
    } catch {
      toast({ title: "Failed to load applications", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(filter); }, [filter, load]);

  const handleReview = async (id: string, status: "accepted" | "rejected" | "waitlisted") => {
    setReviewingId(id + status);
    try {
      const res = await fetch(`/api/admin/creator-applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reviewNote: reviewNote[id] ?? "" }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: `Application ${status}`, description: "Email sent to applicant." });
      setApplications((prev) =>
        prev.map((a) => a.id === id ? { ...a, status, reviewedAt: new Date() } : a)
      );
      setExpandedId(null);
    } catch {
      toast({ title: "Failed to update", variant: "destructive" });
    } finally {
      setReviewingId(null);
    }
  };

  const counts = {
    all: applications.length,
    waitlisted: applications.filter((a) => a.status === "waitlisted").length,
    pending: applications.filter((a) => a.status === "pending").length,
    accepted: applications.filter((a) => a.status === "accepted").length,
    rejected: applications.filter((a) => a.status === "rejected").length,
  };

  return (
    <main className="p-6 md:p-10 max-w-4xl">
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">Creator Applications</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Review and manage all creator acceptance applications.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void load(filter)}
          disabled={loading}
          className="gap-1.5 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              filter === opt.value
                ? "bg-orange-500 text-white border-orange-500"
                : "border-[#E5E7EB] dark:border-[#2A2A2A] text-gray-600 dark:text-gray-400 hover:border-orange-300"
            }`}
          >
            {opt.label}
            {opt.value !== "all" && (
              <span className="ml-1.5 text-xs opacity-70">
                ({filter === "all" ? counts[opt.value] : applications.filter(a => a.status === opt.value).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
        </div>
      ) : applications.length === 0 ? (
        <div className="text-center py-16 rounded-xl border border-dashed border-[#E5E7EB] dark:border-[#2A2A2A]">
          <Users className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">No applications {filter !== "all" ? `with status "${filter}"` : "yet"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {applications.map((app) => {
            const meta = STATUS_META[app.status] ?? STATUS_META.pending;
            const isExpanded = expandedId === app.id;
            const isReviewing = reviewingId?.startsWith(app.id);

            return (
              <div
                key={app.id}
                className="rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] overflow-hidden"
              >
                {/* Summary row */}
                <div className="flex items-center gap-4 p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{app.name}</p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold ${meta.color}`}>
                        {meta.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {app.email} · {PLATFORM_LABELS[app.platform] ?? app.platform} · <strong className="text-gray-700 dark:text-gray-300">{app.followerCount.toLocaleString()}</strong> followers · {app.niche}
                    </p>
                  </div>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : app.id)}
                    className="shrink-0 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2A2A2A] transition-colors"
                  >
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  </button>
                </div>

                {/* Expanded panel */}
                {isExpanded && (
                  <div className="border-t border-[#E5E7EB] dark:border-[#2A2A2A] px-4 pb-4 pt-3 space-y-4 bg-gray-50/50 dark:bg-[#111]">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-0.5">Goal</p>
                        <p className="text-gray-700 dark:text-gray-300">{app.goal}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-0.5">Applied</p>
                        <p className="text-gray-700 dark:text-gray-300">{new Date(app.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
                      </div>
                      {app.referrerUserId && (
                        <div className="col-span-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-0.5">Referred by</p>
                          <p className="text-gray-700 dark:text-gray-300 font-mono text-xs">{app.referrerUserId}</p>
                        </div>
                      )}
                    </div>

                    {/* Review note */}
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
                        Note to send with decision (optional)
                      </label>
                      <textarea
                        value={reviewNote[app.id] ?? ""}
                        onChange={(e) => setReviewNote((prev) => ({ ...prev, [app.id]: e.target.value }))}
                        placeholder="e.g. Great niche — we'd love to have you!"
                        rows={2}
                        className="w-full bg-white dark:bg-[#1A1A1A] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-orange-500 resize-none"
                      />
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 flex-wrap">
                      {app.status !== "accepted" && (
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
                          disabled={!!isReviewing}
                          onClick={() => void handleReview(app.id, "accepted")}
                        >
                          {isReviewing && reviewingId === app.id + "accepted" ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )}
                          Accept
                        </Button>
                      )}
                      {app.status !== "waitlisted" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          disabled={!!isReviewing}
                          onClick={() => void handleReview(app.id, "waitlisted")}
                        >
                          {isReviewing && reviewingId === app.id + "waitlisted" ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Clock className="w-3.5 h-3.5" />
                          )}
                          Move to waitlist
                        </Button>
                      )}
                      {app.status !== "rejected" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-red-500 border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-950/20"
                          disabled={!!isReviewing}
                          onClick={() => void handleReview(app.id, "rejected")}
                        >
                          {isReviewing && reviewingId === app.id + "rejected" ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5" />
                          )}
                          Reject
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
