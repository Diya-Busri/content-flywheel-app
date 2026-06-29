"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const REASONS = [
  { id: "spam", label: "Spam" },
  { id: "harassment", label: "Harassment" },
  { id: "inappropriate", label: "Inappropriate" },
  { id: "misinformation", label: "Misinformation" },
  { id: "other", label: "Other" },
];

interface ReportButtonProps {
  postId?: string;
  commentId?: string;
  reportedUserId?: string;
  className?: string;
}

export function ReportButton({ postId, commentId, reportedUserId, className }: ReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("spam");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/community/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, commentId, reportedUserId, reason, details }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to report");
      }
      setDone(true);
      setTimeout(() => setOpen(false), 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to report");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className={`inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-red-500 ${className ?? ""}`}
        aria-label="Report"
      >
        <Flag className="h-3.5 w-3.5" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report content</DialogTitle>
          </DialogHeader>
          {done ? (
            <p className="py-4 text-center text-sm text-green-600">Thanks — our team will review this.</p>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">Reason</label>
                <div className="grid grid-cols-2 gap-2">
                  {REASONS.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setReason(r.id)}
                      className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                        reason === r.id
                          ? "border-primary bg-primary/10 text-primary"
                          : "bg-card text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              <Textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Additional details (optional)"
                rows={3}
              />
              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>
          )}
          {!done && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={loading}>
                {loading ? "Submitting…" : "Submit Report"}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
