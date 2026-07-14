"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import {
  Trophy, Search, Loader2, Download, Copy, ExternalLink, ChevronLeft, X,
  FileText, AlertTriangle, CheckCircle2, Mail,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

type Status =
  | "new" | "under_review" | "more_info_required" | "ineligible"
  | "eligible_awaiting_store_link" | "eligible_anonymous" | "store_link_received"
  | "store_link_verified" | "ready_for_production" | "part1_in_production"
  | "part1_published" | "part2_in_production" | "part2_published" | "completed";

type SubmissionListItem = {
  id: string; reference: string; fullName: string; email: string;
  productName: string; productType: string; featureType: "public" | "anonymous";
  status: Status; storeUrl: string | null; storeLinkVerified: boolean;
  episodeNumber: number | null; createdAt: string; updatedAt: string;
};

type UploadedFile = { key: string; originalName: string; size: number; type: string; uploadedAt: string; signedUrl?: string | null };

type SubmissionDetail = SubmissionListItem & {
  creatorOrBusinessName: string | null; socialUsername: string | null; primarySocialPlatform: string | null;
  productDescription: string; targetAudience: string; problemSolved: string; productPrice: string;
  productStatus: string; existingProductUrl: string | null; whatMakesUseful: string; whatToImprove: string;
  marketingStruggles: string[]; marketingTried: string | null; whatStoppingSales: string | null;
  focusRequest: string | null; doNotSayOrShow: string | null;
  anonymousConsent: boolean; ownershipConfirmed: boolean; reviewPermissionConfirmed: boolean;
  queueUnderstandingConfirmed: boolean; publicationOrderConfirmed: boolean; rejectionRiskAcknowledged: boolean;
  termsAgreed: boolean; publicDisplayConsent: boolean | null; storeLinkObligationAck: boolean | null;
  anonymousNoLinkAck: boolean | null; anonymousBlurAck: boolean | null; marketingOptIn: boolean;
  uploadedFiles: UploadedFile[]; ineligibilityReason: string | null; adminNotes: string | null;
  readinessChecklist: Record<string, boolean>; anonymityChecklist: Record<string, boolean>;
  emailHistory: { type: string; sentAt: string }[]; part1Url: string | null; part2Url: string | null;
};

const STATUS_META: Record<Status, { label: string; color: string }> = {
  new: { label: "New", color: "bg-gray-100 text-gray-700 border-gray-200" },
  under_review: { label: "Under eligibility review", color: "bg-blue-50 text-blue-700 border-blue-200" },
  more_info_required: { label: "More information required", color: "bg-amber-50 text-amber-700 border-amber-200" },
  ineligible: { label: "Ineligible", color: "bg-red-50 text-red-700 border-red-200" },
  eligible_awaiting_store_link: { label: "Eligible — awaiting store link", color: "bg-orange-50 text-orange-700 border-orange-200" },
  eligible_anonymous: { label: "Eligible — anonymous", color: "bg-purple-50 text-purple-700 border-purple-200" },
  store_link_received: { label: "Store link received", color: "bg-blue-50 text-blue-700 border-blue-200" },
  store_link_verified: { label: "Store link verified", color: "bg-teal-50 text-teal-700 border-teal-200" },
  ready_for_production: { label: "Ready for production", color: "bg-green-50 text-green-700 border-green-200" },
  part1_in_production: { label: "Part 1 in production", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  part1_published: { label: "Part 1 published", color: "bg-green-50 text-green-700 border-green-200" },
  part2_in_production: { label: "Part 2 in production", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  part2_published: { label: "Part 2 published", color: "bg-green-50 text-green-700 border-green-200" },
  completed: { label: "Completed", color: "bg-green-100 text-green-800 border-green-300" },
};
const STATUS_ORDER: Status[] = Object.keys(STATUS_META) as Status[];

const PUBLIC_READINESS: { id: string; label: string }[] = [
  { id: "eligibility_approved", label: "Eligibility approved" },
  { id: "ownership_permission_confirmed", label: "Ownership permission confirmed" },
  { id: "public_publishing_permission_confirmed", label: "Public publishing permission confirmed" },
  { id: "store_link_received", label: "Content Flywheel Store link received" },
  { id: "store_link_verified", label: "Store link verified" },
  { id: "product_page_publicly_accessible", label: "Product page publicly accessible" },
  { id: "product_name_confirmed", label: "Product name confirmed" },
  { id: "product_cover_confirmed", label: "Product cover confirmed" },
  { id: "creator_display_name_confirmed", label: "Creator display name confirmed" },
  { id: "social_username_confirmed_or_omitted", label: "Social username confirmed or intentionally omitted" },
  { id: "cta_confirmed", label: "CTA confirmed" },
  { id: "uploaded_product_reviewed", label: "Uploaded product reviewed" },
  { id: "restricted_information_reviewed", label: "Restricted information reviewed" },
];
const ANONYMOUS_READINESS: { id: string; label: string }[] = [
  { id: "eligibility_approved", label: "Eligibility approved" },
  { id: "ownership_permission_confirmed", label: "Ownership permission confirmed" },
  { id: "anonymous_consent_confirmed", label: "Anonymous consent confirmed" },
  { id: "restricted_information_reviewed", label: "Restricted information reviewed" },
  { id: "creator_identity_marked_for_removal", label: "Creator identity marked for removal" },
  { id: "product_identity_marked_for_removal", label: "Product identity marked for removal where required" },
  { id: "product_cover_reviewed", label: "Product cover reviewed" },
  { id: "screenshots_reviewed", label: "Screenshots reviewed" },
  { id: "names_and_usernames_identified", label: "Names and usernames identified" },
  { id: "logos_identified", label: "Logos identified" },
  { id: "urls_identified", label: "URLs identified" },
  { id: "qr_codes_identified", label: "QR codes identified" },
  { id: "personal_details_identified", label: "Personal details identified" },
  { id: "customer_information_identified", label: "Customer information identified" },
  { id: "public_safe_assets_prepared", label: "Public-safe assets prepared" },
];
const FINAL_ANONYMITY: { id: string; label: string }[] = [
  { id: "creator_identity_removed", label: "Creator identity removed" },
  { id: "business_identity_removed", label: "Business identity removed" },
  { id: "product_name_removed_where_required", label: "Product name removed where required" },
  { id: "social_usernames_removed", label: "Social usernames removed" },
  { id: "store_links_removed", label: "Store links removed" },
  { id: "external_links_removed", label: "External links removed" },
  { id: "logos_removed_or_blurred", label: "Logos removed or blurred" },
  { id: "screenshots_checked", label: "Screenshots checked" },
  { id: "qr_codes_removed", label: "QR codes removed" },
  { id: "personal_information_removed", label: "Personal information removed" },
  { id: "final_asset_reviewed", label: "Final asset reviewed" },
];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function ChallengeSubmissionsAdminPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<SubmissionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [featureFilter, setFeatureFilter] = useState<"all" | "public" | "anonymous">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (featureFilter !== "all") params.set("featureType", featureFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      params.set("pageSize", "100");
      const res = await fetch(`/api/admin/challenge-submissions?${params.toString()}`);
      const data = await res.json();
      setRows(data.submissions ?? []);
    } catch {
      toast({ title: "Failed to load submissions", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [q, featureFilter, statusFilter, toast]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const exportCsv = () => {
    const headers = ["Reference", "Full Name", "Email", "Product Name", "Product Type", "Feature Type", "Status", "Store URL", "Store Verified", "Episode", "Created"];
    const csvRows = rows.map((r) => [
      r.reference, r.fullName, r.email, r.productName, r.productType, r.featureType,
      STATUS_META[r.status]?.label ?? r.status, r.storeUrl ?? "", r.storeLinkVerified ? "Yes" : "No",
      r.episodeNumber ?? "", fmtDate(r.createdAt),
    ]);
    const csv = [headers, ...csvRows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `challenge-submissions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-transparent p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center gap-2.5 mb-1.5">
        <div className="w-8 h-8 rounded-xl bg-orange-100 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800/40 flex items-center justify-center">
          <Trophy className="w-4 h-4 text-orange-600 dark:text-orange-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">100 Product Challenge — Submissions</h1>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Every eligible submission enters the production queue. Review, verify store links, and track production.</p>

      {/* ── Filters ── */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search reference, name, email, product…" className="pl-9 h-9 text-sm" />
        </div>
        <select value={featureFilter} onChange={(e) => setFeatureFilter(e.target.value as typeof featureFilter)} className="h-9 text-sm rounded-lg border border-gray-300 dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] px-3">
          <option value="all">Public + Anonymous</option>
          <option value="public">Public only</option>
          <option value="anonymous">Anonymous only</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="h-9 text-sm rounded-lg border border-gray-300 dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] px-3">
          <option value="all">All statuses</option>
          {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
        </select>
        <Button size="sm" variant="outline" className="h-9 gap-2" onClick={exportCsv} disabled={rows.length === 0}>
          <Download className="w-3.5 h-3.5" />Export CSV
        </Button>
      </div>

      {/* ── List ── */}
      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-orange-500" /></div>
      ) : rows.length === 0 ? (
        <div className="text-center py-20 text-sm text-gray-500">No submissions match these filters.</div>
      ) : (
        <div className="rounded-2xl border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-[#141414] text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-2.5">Reference</th>
                <th className="text-left px-4 py-2.5">Creator</th>
                <th className="text-left px-4 py-2.5">Product</th>
                <th className="text-left px-4 py-2.5">Type</th>
                <th className="text-left px-4 py-2.5">Status</th>
                <th className="text-left px-4 py-2.5">Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} onClick={() => setSelectedId(r.id)} className="border-t border-gray-100 dark:border-[#2A2A2A] hover:bg-orange-50/50 dark:hover:bg-orange-950/10 cursor-pointer">
                  <td className="px-4 py-3 font-mono text-xs">{r.reference}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-white">{r.fullName}</div>
                    <div className="text-xs text-gray-500">{r.email}</div>
                  </td>
                  <td className="px-4 py-3">{r.productName}</td>
                  <td className="px-4 py-3 capitalize text-xs text-gray-600 dark:text-gray-400">{r.featureType}</td>
                  <td className="px-4 py-3"><Badge className={`text-[10px] border ${STATUS_META[r.status]?.color}`}>{STATUS_META[r.status]?.label ?? r.status}</Badge></td>
                  <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedId && (
        <SubmissionDetailPanel id={selectedId} onClose={() => setSelectedId(null)} onChanged={fetchList} />
      )}
    </div>
  );
}

// ── Detail panel ─────────────────────────────────────────────────────────────

function SubmissionDetailPanel({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { toast } = useToast();
  const [row, setRow] = useState<SubmissionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<UploadedFile[] | null>(null);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [showMoreInfo, setShowMoreInfo] = useState(false);
  const [moreInfoMessage, setMoreInfoMessage] = useState("");
  const [storeUrlInput, setStoreUrlInput] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/challenge-submissions/${id}`);
      const data = await res.json();
      setRow(data);
      setNotes(data.adminNotes ?? "");
      setStoreUrlInput(data.storeUrl ?? "");
    } catch {
      toast({ title: "Failed to load submission", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => { load(); }, [load]);

  const patch = async (action: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/challenge-submissions/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      setRow(data);
      onChanged();
      return true;
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const loadFiles = async () => {
    if (files) return;
    try {
      const res = await fetch(`/api/admin/challenge-submissions/${id}/files`);
      const data = await res.json();
      setFiles(data.files ?? []);
    } catch {
      toast({ title: "Failed to load files", variant: "destructive" });
    }
  };

  if (loading || !row) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-end z-50">
        <div className="w-full max-w-2xl h-full bg-white dark:bg-[#111] flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
        </div>
      </div>
    );
  }

  const isPublic = row.featureType === "public";
  const readinessItems = isPublic ? PUBLIC_READINESS : ANONYMOUS_READINESS;

  return (
    <div className="fixed inset-0 bg-black/40 flex justify-end z-50">
      <div className="w-full max-w-2xl h-full bg-white dark:bg-[#111] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-[#111] border-b border-gray-200 dark:border-[#2A2A2A] px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={onClose} className="gap-1.5"><ChevronLeft className="w-4 h-4" />Back</Button>
            <span className="font-mono text-xs text-gray-500">{row.reference}</span>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{row.productName}</h2>
              <Badge className={`text-[10px] border ${STATUS_META[row.status]?.color}`}>{STATUS_META[row.status]?.label}</Badge>
              <Badge className="text-[10px] capitalize">{row.featureType}</Badge>
            </div>
            <p className="text-sm text-gray-500">{row.productType.replace(/_/g, " ")} · {row.productStatus.replace(/_/g, " ")} · {row.productPrice}</p>
          </div>

          {row.status === "ineligible" && row.ineligibilityReason && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /><span>{row.ineligibilityReason}</span>
            </div>
          )}
          {!isPublic && (
            <div className="rounded-lg bg-purple-50 border border-purple-200 p-3 text-xs text-purple-800">
              Anonymous submission — all identifying information must be removed or blurred before publishing. No public purchase or product-discovery CTA.
            </div>
          )}

          {/* ── Creator ── */}
          <Section title="Creator">
            <Row label="Full name" value={row.fullName} />
            <Row label="Email" value={row.email} action={<Button size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1" onClick={() => { navigator.clipboard.writeText(row.email); toast({ title: "Email copied" }); }}><Copy className="w-3 h-3" />Copy</Button>} />
            <Row label="Creator/business name" value={row.creatorOrBusinessName ?? "—"} />
            <Row label="Social username" value={row.socialUsername ?? "—"} />
            <Row label="Primary platform" value={row.primarySocialPlatform ?? "—"} />
          </Section>

          {/* ── Product ── */}
          <Section title="Product">
            <Row label="Description" value={row.productDescription} multiline />
            <Row label="Target audience" value={row.targetAudience} multiline />
            <Row label="Problem solved" value={row.problemSolved} multiline />
            <Row label="What makes it useful/different" value={row.whatMakesUseful} multiline />
            <Row label="What to improve" value={row.whatToImprove} multiline />
            {row.existingProductUrl && <Row label="Existing link (internal review only)" value={row.existingProductUrl} />}
          </Section>

          {/* ── Marketing ── */}
          <Section title="Marketing">
            <Row label="Struggling with" value={row.marketingStruggles.map((s) => s.replace(/_/g, " ")).join(", ") || "—"} />
            {row.marketingTried && <Row label="Already tried" value={row.marketingTried} multiline />}
            {row.whatStoppingSales && <Row label="What's stopping sales" value={row.whatStoppingSales} multiline />}
            {row.focusRequest && <Row label="Focus request" value={row.focusRequest} multiline />}
            {row.doNotSayOrShow && <Row label="Must NOT say/show" value={row.doNotSayOrShow} multiline highlight />}
          </Section>

          {/* ── Permissions ── */}
          <Section title="Permissions">
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <PermFlag label="Ownership confirmed" v={row.ownershipConfirmed} />
              <PermFlag label="Review permission" v={row.reviewPermissionConfirmed} />
              <PermFlag label="Queue understanding" v={row.queueUnderstandingConfirmed} />
              <PermFlag label="Publication order ack" v={row.publicationOrderConfirmed} />
              <PermFlag label="Rejection risk ack" v={row.rejectionRiskAcknowledged} />
              <PermFlag label="Terms agreed" v={row.termsAgreed} />
              <PermFlag label="Marketing opt-in" v={row.marketingOptIn} />
              {isPublic && <PermFlag label="Public display consent" v={!!row.publicDisplayConsent} />}
              {isPublic && <PermFlag label="Store link obligation ack" v={!!row.storeLinkObligationAck} />}
              {!isPublic && <PermFlag label="Anonymous consent" v={row.anonymousConsent} />}
              {!isPublic && <PermFlag label="No public link ack" v={!!row.anonymousNoLinkAck} />}
              {!isPublic && <PermFlag label="Blur ack" v={!!row.anonymousBlurAck} />}
            </div>
          </Section>

          {/* ── Files ── */}
          <Section title="Uploaded files (private — admin only)">
            {!files ? (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={loadFiles}><FileText className="w-3.5 h-3.5" />Load files ({row.uploadedFiles.length})</Button>
            ) : files.length === 0 ? (
              <p className="text-xs text-gray-500">No files uploaded.</p>
            ) : (
              <div className="space-y-1.5">
                {files.map((f) => (
                  <div key={f.key} className="flex items-center justify-between text-xs bg-gray-50 dark:bg-[#1A1A1A] rounded-lg px-3 py-2">
                    <span className="truncate flex-1">{f.originalName} <span className="text-gray-400">({fmtBytes(f.size)})</span></span>
                    {f.signedUrl ? (
                      <a href={f.signedUrl} target="_blank" rel="noopener noreferrer" className="text-orange-600 flex items-center gap-1 shrink-0 ml-2"><ExternalLink className="w-3 h-3" />Open (5 min link)</a>
                    ) : <span className="text-red-500 shrink-0 ml-2">Link failed</span>}
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* ── Status actions ── */}
          <Section title="Status">
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <select
                value={row.status}
                onChange={(e) => patch({ type: "set-status", status: e.target.value })}
                disabled={busy}
                className="h-8 text-xs rounded-lg border border-gray-300 dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] px-2"
              >
                {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
              </select>
              {(row.status === "new" || row.status === "under_review" || row.status === "more_info_required") && (
                <>
                  <Button size="sm" className="h-8 text-xs bg-orange-500 hover:bg-orange-600" disabled={busy} onClick={() => patch({ type: "mark-eligible" })}>
                    <Mail className="w-3.5 h-3.5 mr-1" />Mark eligible (sends email)
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs" disabled={busy} onClick={() => setShowMoreInfo((v) => !v)}>
                    <Mail className="w-3.5 h-3.5 mr-1" />Request more info
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs text-red-600 border-red-200" disabled={busy} onClick={() => setShowReject((v) => !v)}>Reject</Button>
                </>
              )}
            </div>
            {showReject && (
              <div className="flex items-center gap-2 mb-3">
                <Input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Internal rejection reason (sent to the creator)" className="h-8 text-xs flex-1" />
                <Button size="sm" className="h-8 text-xs bg-red-500 hover:bg-red-600 text-white" disabled={busy || !rejectReason.trim()} onClick={async () => { if (await patch({ type: "reject", reason: rejectReason })) { setShowReject(false); setRejectReason(""); } }}>Confirm reject (sends email)</Button>
              </div>
            )}
            {showMoreInfo && (
              <div className="flex items-center gap-2 mb-3">
                <Input value={moreInfoMessage} onChange={(e) => setMoreInfoMessage(e.target.value)} placeholder="What do you need from the creator?" className="h-8 text-xs flex-1" />
                <Button size="sm" className="h-8 text-xs bg-orange-500 hover:bg-orange-600 text-white" disabled={busy || !moreInfoMessage.trim()} onClick={async () => { if (await patch({ type: "request-more-info", message: moreInfoMessage })) { setShowMoreInfo(false); setMoreInfoMessage(""); } }}>Send request</Button>
              </div>
            )}
          </Section>

          {/* ── Store link (public only) ── */}
          {isPublic && (
            <Section title="Content Flywheel Store link">
              <p className="text-xs text-gray-400 mb-2">Must be a contentflywheel.co.uk product page — external storefront links (Gumroad, Etsy, Stan Store, Beacons, Shopify, Payhip, etc.) are rejected.</p>
              <div className="flex items-center gap-2 mb-2">
                <Input value={storeUrlInput} onChange={(e) => setStoreUrlInput(e.target.value)} placeholder="https://contentflywheel.co.uk/product/…" className="h-8 text-xs flex-1" />
                <Button size="sm" className="h-8 text-xs bg-orange-500 hover:bg-orange-600" disabled={busy || !storeUrlInput.trim()} onClick={() => patch({ type: "record-store-link", storeUrl: storeUrlInput })}>Store Link Received</Button>
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                <Checkbox checked={row.storeLinkVerified} onCheckedChange={(c) => patch({ type: "verify-store-link", verified: c === true })} disabled={!row.storeUrl || busy} />
                Store link verified (publicly accessible, correct product)
              </label>
            </Section>
          )}

          {/* ── Readiness checklist ── */}
          <Section title={`${isPublic ? "Public" : "Anonymous"} readiness checklist`}>
            <div className="space-y-1.5">
              {readinessItems.map((item) => (
                <label key={item.id} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                  <Checkbox checked={!!row.readinessChecklist[item.id]} onCheckedChange={(c) => patch({ type: "update-checklist", checklist: "readiness", itemId: item.id, checked: c === true })} disabled={busy} />
                  {item.label}
                </label>
              ))}
            </div>
            <Button size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white mt-3 gap-1.5" disabled={busy} onClick={() => patch({ type: "mark-ready-for-production" })}>
              <CheckCircle2 className="w-3.5 h-3.5" />Mark ready for production
            </Button>
          </Section>

          {/* ── Final anonymity checklist (anonymous only) ── */}
          {!isPublic && (
            <Section title="Final anonymity checklist (required before publishing)">
              <div className="space-y-1.5">
                {FINAL_ANONYMITY.map((item) => (
                  <label key={item.id} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                    <Checkbox checked={!!row.anonymityChecklist[item.id]} onCheckedChange={(c) => patch({ type: "update-checklist", checklist: "anonymity", itemId: item.id, checked: c === true })} disabled={busy} />
                    {item.label}
                  </label>
                ))}
              </div>
            </Section>
          )}

          {/* ── Production ── */}
          <Section title="Production">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-gray-500 w-20 shrink-0">Episode #</span>
              <Input type="number" defaultValue={row.episodeNumber ?? ""} onBlur={(e) => patch({ type: "record-episode", episodeNumber: e.target.value ? parseInt(e.target.value) : null })} className="h-8 text-xs w-24" />
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-gray-500 w-20 shrink-0">Part 1 URL</span>
              <Input defaultValue={row.part1Url ?? ""} onBlur={(e) => patch({ type: "record-parts", part1Url: e.target.value || null })} className="h-8 text-xs flex-1" />
              <Button size="sm" variant="outline" className="h-8 text-xs shrink-0" disabled={busy || !row.part1Url} onClick={() => patch({ type: "mark-published", part: 1 })}>Mark Part 1 published</Button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-20 shrink-0">Part 2 URL</span>
              <Input defaultValue={row.part2Url ?? ""} onBlur={(e) => patch({ type: "record-parts", part2Url: e.target.value || null })} className="h-8 text-xs flex-1" />
              <Button size="sm" variant="outline" className="h-8 text-xs shrink-0" disabled={busy || !row.part2Url} onClick={() => patch({ type: "mark-published", part: 2 })}>Mark Part 2 published</Button>
            </div>
          </Section>

          {/* ── Admin notes ── */}
          <Section title="Admin notes (internal — never shown to creator)">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="text-xs" />
            <Button size="sm" className="h-8 text-xs bg-gray-800 hover:bg-gray-900 text-white mt-2" disabled={savingNotes} onClick={async () => { setSavingNotes(true); await patch({ type: "add-note", note: notes }); setSavingNotes(false); }}>
              {savingNotes ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save notes"}
            </Button>
          </Section>

          {/* ── Email history ── */}
          {row.emailHistory.length > 0 && (
            <Section title="Email activity">
              <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                {row.emailHistory.map((e, i) => <div key={i}>{e.type.replace(/_/g, " ")} — {fmtDate(e.sentAt)}</div>)}
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-gray-100 dark:border-[#2A2A2A] pt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2.5">{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, value, multiline, highlight, action }: { label: string; value: string; multiline?: boolean; highlight?: boolean; action?: React.ReactNode }) {
  return (
    <div className="mb-2.5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-gray-400 uppercase tracking-wide">{label}</p>
        {action}
      </div>
      <p className={`text-sm ${multiline ? "whitespace-pre-wrap" : ""} ${highlight ? "text-red-600 font-medium" : "text-gray-800 dark:text-gray-200"}`}>{value}</p>
    </div>
  );
}

function PermFlag({ label, v }: { label: string; v: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${v ? "text-green-700 bg-green-50" : "text-gray-400 bg-gray-50"}`}>
      {v ? <CheckCircle2 className="w-3 h-3" /> : <X className="w-3 h-3" />}{label}
    </div>
  );
}
