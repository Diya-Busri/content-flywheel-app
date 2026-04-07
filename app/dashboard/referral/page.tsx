"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, Users, Clock, CheckCircle2, ExternalLink, Loader2, ArrowRight, XCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import type { SelectCreatorApplication } from "@/db/schema/creator-applications-schema";

type ApplicationStatus = "none" | "pending" | "waitlisted" | "accepted" | "rejected";

type MyStatusResponse = {
  status: ApplicationStatus;
  application?: Pick<SelectCreatorApplication, "id" | "name" | "email" | "followerCount" | "platform" | "niche" | "createdAt">;
};

type InvitedApplication = Pick<SelectCreatorApplication, "id" | "name" | "email" | "platform" | "niche" | "followerCount" | "goal" | "status" | "createdAt">;

const PLATFORM_OPTIONS = [
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "instagram", label: "Instagram / Reels" },
  { value: "other", label: "Other" },
];

const GOAL_OPTIONS = [
  "Grow my audience faster",
  "Monetise my content",
  "Create content consistently",
  "Build a brand / business",
  "Launch a digital product",
];

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: "TikTok",
  youtube: "YouTube",
  instagram: "Instagram",
  other: "Other",
};

const STATUS_META = {
  accepted: { label: "Accepted", color: "bg-green-500/15 text-green-400 border-green-500/30", icon: CheckCircle2 },
  waitlisted: { label: "Waitlisted", color: "bg-orange-500/15 text-orange-400 border-orange-500/30", icon: Clock },
  pending: { label: "Pending", color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30", icon: Clock },
  rejected: { label: "Not accepted", color: "bg-gray-500/15 text-gray-400 border-gray-500/30", icon: XCircle },
};

// ─── Application Form (embedded, for unaccepted users) ───────────────────────
function ApplicationForm({ onSubmitted }: { onSubmitted: (status: ApplicationStatus) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [platform, setPlatform] = useState("");
  const [niche, setNiche] = useState("");
  const [followerCount, setFollowerCount] = useState("");
  const [goal, setGoal] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const count = parseInt(followerCount.replace(/,/g, ""), 10);
    if (isNaN(count) || count < 0) { setError("Please enter a valid follower count."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/creator-acceptance/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), platform, niche: niche.trim(), followerCount: count, goal }),
      });
      const data = (await res.json()) as { status?: ApplicationStatus; error?: string };
      if (!res.ok || data.error) { setError(data.error ?? "Something went wrong."); return; }
      toast({ title: data.status === "accepted" ? "🎉 You're accepted!" : "Application submitted!" });
      onSubmitted(data.status!);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Badge + heading */}
      <div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-500 text-xs font-semibold uppercase tracking-wide mb-3">
          🎬 Creator Acceptance Program
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Apply for access</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
          Creators with <strong className="text-gray-700 dark:text-gray-300">10,000+ followers</strong> are accepted automatically. Others go on our priority waitlist.
        </p>
      </div>

      <Card>
        <CardContent className="pt-5">
          <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1 space-y-1.5">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Your name</label>
                <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alex Turner" />
              </div>
              <div className="col-span-2 sm:col-span-1 space-y-1.5">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Email address</label>
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Primary platform</label>
                <select
                  required
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="" disabled>Select…</option>
                  {PLATFORM_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Follower count</label>
                <Input required value={followerCount} onChange={(e) => setFollowerCount(e.target.value)} placeholder="e.g. 15000" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Your niche</label>
              <Input required value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="e.g. 3D Animation Comedy, Finance, Fitness…" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Main goal</label>
              <div className="grid grid-cols-1 gap-1.5">
                {GOAL_OPTIONS.map((g) => (
                  <label
                    key={g}
                    className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors text-sm ${
                      goal === g
                        ? "border-orange-500 bg-orange-500/10 text-gray-900 dark:text-white"
                        : "border-border text-gray-600 dark:text-gray-400 hover:border-orange-300"
                    }`}
                  >
                    <input type="radio" name="goal" value={g} checked={goal === g} onChange={() => setGoal(g)} className="accent-orange-500" />
                    {g}
                  </label>
                ))}
              </div>
            </div>
            {error && <p className="text-red-500 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
            <Button type="submit" disabled={loading || !goal} className="w-full bg-orange-500 hover:bg-orange-600 gap-2">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Reviewing…</> : <>Submit application <ArrowRight className="w-4 h-4" /></>}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Under Review (pending / waitlisted) ────────────────────────────────────
function UnderReview({ application }: { application?: MyStatusResponse["application"] }) {
  return (
    <div className="space-y-6">
      <div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-500 text-xs font-semibold uppercase tracking-wide mb-3">
          🎬 Creator Acceptance Program
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Application under review</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
          We have received your application and you are on our <strong className="text-gray-700 dark:text-gray-300">priority waitlist</strong>. You will be emailed the moment a spot opens for you.
        </p>
      </div>
      <Card className="border-orange-200 dark:border-orange-900/40 bg-orange-50/40 dark:bg-orange-950/10">
        <CardContent className="pt-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className="font-semibold text-sm text-gray-900 dark:text-white">Application received</p>
              {application?.createdAt && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Submitted {new Date(application.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              )}
            </div>
          </div>
          {application && (
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-orange-200 dark:border-orange-900/30">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-0.5">Platform</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{PLATFORM_LABELS[application.platform] ?? application.platform}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-0.5">Followers</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{application.followerCount.toLocaleString()}</p>
              </div>
              <div className="col-span-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-0.5">Niche</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{application.niche}</p>
              </div>
            </div>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400 pt-1">
            💡 Fast-track tip: creators with <strong>10,000+ followers</strong> are accepted automatically.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Accepted — show invite link + stats ────────────────────────────────────
function AcceptedView() {
  const [userId, setUserId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [applications, setApplications] = useState<InvitedApplication[]>([]);
  const { toast } = useToast();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? (typeof window !== "undefined" ? window.location.origin : "");

  useEffect(() => {
    fetch("/api/email/my-id")
      .then((r) => r.ok ? r.json() : null)
      .then((data: { userId?: string } | null) => { if (data?.userId) setUserId(data.userId); })
      .catch(() => {});

    fetch("/api/creator-acceptance/my-invites")
      .then((r) => r.ok ? r.json() : null)
      .then((data: { applications?: InvitedApplication[] } | null) => { if (data?.applications) setApplications(data.applications); })
      .catch(() => {});
  }, []);

  const inviteUrl = userId ? `${appUrl}/apply?ref=${userId}` : "";
  const acceptedCount = applications.filter((a) => a.status === "accepted").length;
  const waitlistedCount = applications.filter((a) => a.status === "waitlisted").length;

  const handleCopy = () => {
    if (!inviteUrl) return;
    void navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Invite link copied!", description: "Share it with creators you think deserve access." });
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-500 text-xs font-semibold uppercase tracking-wide mb-3">
          ✅ Accepted creator
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Invite Creators</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
          Share your personal invite link. Creators with <strong className="text-gray-700 dark:text-gray-300">10k+ followers</strong> are accepted automatically. Others go on the waitlist.
        </p>
      </div>

      {/* Invite link */}
      <Card className="border-orange-200 dark:border-orange-900/40 bg-orange-50/40 dark:bg-orange-950/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-gray-900 dark:text-white">Your personal invite link</CardTitle>
          <CardDescription>Anyone who clicks this is taken to a branded application form.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Input readOnly value={inviteUrl || "Loading…"} className="flex-1 font-mono text-sm" />
            <Button size="sm" className="shrink-0 bg-orange-500 hover:bg-orange-600 text-white gap-1.5" onClick={handleCopy} disabled={!inviteUrl}>
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <a href={inviteUrl || "#"} target="_blank" rel="noopener noreferrer" className="text-xs text-orange-500 hover:text-orange-400 flex items-center gap-1">
              <ExternalLink className="w-3 h-3" /> Preview page
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Invites sent", value: applications.length, icon: Users },
          { label: "Accepted", value: acceptedCount, icon: CheckCircle2 },
          { label: "Waitlisted", value: waitlistedCount, icon: Clock },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex flex-col items-center justify-center p-4 rounded-xl border border-border bg-card text-center">
            <Icon className="w-4 h-4 text-orange-500 mb-1.5" />
            <p className="text-2xl font-bold text-gray-900 dark:text-white leading-none">{value}</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Applications list */}
      {applications.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Creators you&apos;ve invited</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-4">
            {applications.map((app) => {
              const meta = STATUS_META[app.status as keyof typeof STATUS_META] ?? STATUS_META.pending;
              const Icon = meta.icon;
              return (
                <div key={app.id} className="flex items-center justify-between gap-4 p-3 rounded-lg border border-border bg-background">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{app.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {PLATFORM_LABELS[app.platform] ?? app.platform} · {app.followerCount.toLocaleString()} followers
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold shrink-0 ${meta.color}`}>
                    <Icon className="w-3 h-3" />{meta.label}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : (
        <div className="text-center py-10 rounded-xl border border-dashed border-border">
          <Users className="w-7 h-7 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">No applications yet</p>
          <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">Share your invite link to start seeing creators here</p>
        </div>
      )}
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function ReferralPage() {
  const [status, setStatus] = useState<ApplicationStatus | null>(null);
  const [application, setApplication] = useState<MyStatusResponse["application"] | undefined>(undefined);

  useEffect(() => {
    fetch("/api/creator-acceptance/my-status")
      .then((r) => r.ok ? r.json() : null)
      .then((data: MyStatusResponse | null) => {
        setStatus(data?.status ?? "none");
        setApplication(data?.application);
      })
      .catch(() => setStatus("none"));
  }, []);

  if (status === null) {
    return (
      <main className="p-6 md:p-10 max-w-2xl flex items-center justify-center min-h-[300px]">
        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
      </main>
    );
  }

  return (
    <main className="p-6 md:p-10 max-w-2xl">
      {status === "none" && (
        <ApplicationForm onSubmitted={(s) => setStatus(s)} />
      )}
      {(status === "pending" || status === "waitlisted") && (
        <UnderReview application={application} />
      )}
      {status === "accepted" && (
        <AcceptedView />
      )}
      {status === "rejected" && (
        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Application not accepted</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
            We weren&apos;t able to offer you a spot right now. Keep growing your audience and feel free to reapply.
            If you think this is a mistake, email us at{" "}
            <a href="mailto:contentflywheel@gmail.com" className="text-orange-500 underline">contentflywheel@gmail.com</a>.
          </p>
        </div>
      )}
    </main>
  );
}
