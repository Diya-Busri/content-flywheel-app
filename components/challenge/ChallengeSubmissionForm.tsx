"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Loader2, Upload, X, FileText, CheckCircle2, AlertCircle } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

type UploadedFile = { key: string; originalName: string; size: number; type: string; uploadedAt: string; status: "uploading" | "done" | "error" };

type FormState = {
  fullName: string; email: string; creatorOrBusinessName: string; socialUsername: string; primarySocialPlatform: string;
  productName: string; productType: string; productDescription: string; targetAudience: string; problemSolved: string;
  productPrice: string; productStatus: string; existingProductUrl: string; whatMakesUseful: string; whatToImprove: string;
  marketingStruggles: string[]; marketingTried: string; whatStoppingSales: string; focusRequest: string; doNotSayOrShow: string;
  featureType: "public" | "anonymous" | ""; anonymousConsent: boolean;
  ownershipConfirmed: boolean; reviewPermissionConfirmed: boolean; queueUnderstandingConfirmed: boolean;
  publicationOrderConfirmed: boolean; rejectionRiskAcknowledged: boolean; termsAgreed: boolean;
  publicDisplayConsent: boolean; storeLinkObligationAck: boolean; anonymousNoLinkAck: boolean; anonymousBlurAck: boolean;
  marketingOptIn: boolean;
  website: string; // honeypot — must stay empty
};

const initialState: FormState = {
  fullName: "", email: "", creatorOrBusinessName: "", socialUsername: "", primarySocialPlatform: "",
  productName: "", productType: "", productDescription: "", targetAudience: "", problemSolved: "",
  productPrice: "", productStatus: "", existingProductUrl: "", whatMakesUseful: "", whatToImprove: "",
  marketingStruggles: [], marketingTried: "", whatStoppingSales: "", focusRequest: "", doNotSayOrShow: "",
  featureType: "", anonymousConsent: false,
  ownershipConfirmed: false, reviewPermissionConfirmed: false, queueUnderstandingConfirmed: false,
  publicationOrderConfirmed: false, rejectionRiskAcknowledged: false, termsAgreed: false,
  publicDisplayConsent: false, storeLinkObligationAck: false, anonymousNoLinkAck: false, anonymousBlurAck: false,
  marketingOptIn: false,
  website: "",
};

const STEP_LABELS = ["About you", "Your product", "Marketing challenges", "Public or anonymous", "Uploads & permissions", "Review & submit"];

const PRODUCT_TYPES = [
  { value: "ebook", label: "Ebook" }, { value: "workbook", label: "Workbook" }, { value: "template", label: "Template" },
  { value: "planner", label: "Planner" }, { value: "course", label: "Course" }, { value: "membership", label: "Membership" },
  { value: "digital_download", label: "Digital download" }, { value: "software_app", label: "Software or app" }, { value: "other", label: "Other" },
];
const PRODUCT_STATUSES = [
  { value: "finished_not_launched", label: "Finished but not launched" }, { value: "launched_no_sales", label: "Launched but no sales" },
  { value: "some_sales", label: "Has made some sales" }, { value: "selling_consistently", label: "Selling consistently" },
];
const SOCIAL_PLATFORMS = [
  { value: "tiktok", label: "TikTok" }, { value: "instagram", label: "Instagram" }, { value: "youtube", label: "YouTube" },
  { value: "x", label: "X" }, { value: "linkedin", label: "LinkedIn" }, { value: "other", label: "Other" }, { value: "none", label: "I do not want to share one" },
];
const MARKETING_STRUGGLES = [
  { value: "positioning", label: "Positioning" }, { value: "understanding_audience", label: "Understanding the audience" },
  { value: "content_ideas", label: "Content ideas" }, { value: "writing_hooks", label: "Writing hooks" },
  { value: "short_form_videos", label: "Creating short-form videos" }, { value: "carousels", label: "Creating carousels" },
  { value: "launch_strategy", label: "Launch strategy" }, { value: "getting_traffic", label: "Getting traffic" },
  { value: "turning_views_into_sales", label: "Turning views into sales" }, { value: "product_messaging", label: "Product messaging" },
  { value: "product_page", label: "Product page" }, { value: "other", label: "Other" },
];
const ACCEPTED_TYPES = ".pdf,.png,.jpg,.jpeg,.webp,.gif,.zip,.docx,.pptx,.xlsx,.epub";
const MAX_FILES = 6;

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function ChallengeSubmissionForm() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(initialState);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<{ reference: string; id: string } | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleStruggle(value: string) {
    setForm((f) => ({
      ...f,
      marketingStruggles: f.marketingStruggles.includes(value)
        ? f.marketingStruggles.filter((v) => v !== value)
        : [...f.marketingStruggles, value],
    }));
  }

  function validateStep(n: number): string[] {
    const e: string[] = [];
    if (n === 1) {
      if (!form.fullName.trim()) e.push("Full name is required.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.push("A valid email address is required.");
    }
    if (n === 2) {
      if (!form.productName.trim()) e.push("Product name is required.");
      if (!form.productType) e.push("Select a product type.");
      if (!form.productDescription.trim()) e.push("Product description is required.");
      if (!form.targetAudience.trim()) e.push("Target audience is required.");
      if (!form.problemSolved.trim()) e.push("Describe the problem the product solves.");
      if (!form.productPrice.trim()) e.push("Product price is required.");
      if (!form.productStatus) e.push("Select the current product status.");
      if (!form.whatMakesUseful.trim()) e.push("Describe what makes the product useful or different.");
      if (!form.whatToImprove.trim()) e.push("Let me know what you'd most like improved.");
      if (form.existingProductUrl.trim()) {
        try { new URL(form.existingProductUrl.trim()); } catch { e.push("The product/website link is not a valid URL."); }
      }
    }
    if (n === 3) {
      if (form.marketingStruggles.length === 0) e.push("Select at least one thing you're struggling with.");
    }
    if (n === 4) {
      if (!form.featureType) e.push("Choose public or anonymous.");
      if (form.featureType === "anonymous" && !form.anonymousConsent) e.push("Please confirm the anonymous consent checkbox.");
    }
    if (n === 5) {
      if (files.filter((f) => f.status === "done").length === 0) e.push("Upload at least one file for review.");
      if (files.some((f) => f.status === "uploading")) e.push("Please wait for uploads to finish.");
      if (!form.ownershipConfirmed) e.push("Confirm you own this product or have permission to submit it.");
      if (!form.reviewPermissionConfirmed) e.push("Confirm permission to review and create marketing content.");
      if (!form.queueUnderstandingConfirmed) e.push("Confirm you understand the production queue.");
      if (!form.publicationOrderConfirmed) e.push("Confirm you understand publication order may vary.");
      if (!form.rejectionRiskAcknowledged) e.push("Confirm you understand the rejection criteria.");
      if (!form.termsAgreed) e.push("You must agree to the Privacy Policy and Terms.");
      if (form.featureType === "public") {
        if (!form.publicDisplayConsent) e.push("Public submissions require permission to display your details.");
        if (!form.storeLinkObligationAck) e.push("Public submissions require acknowledging the Store link requirement.");
      }
      if (form.featureType === "anonymous") {
        if (!form.anonymousNoLinkAck) e.push("Confirm you understand there will be no public purchase link.");
        if (!form.anonymousBlurAck) e.push("Confirm you understand identifying details will be removed or blurred.");
      }
    }
    return e;
  }

  function goNext() {
    const e = validateStep(step);
    if (e.length > 0) { setErrors(e); return; }
    setErrors([]);
    setStep((s) => Math.min(6, s + 1));
  }
  function goBack() {
    setErrors([]);
    setStep((s) => Math.max(1, s - 1));
  }

  async function handleFileSelect(fileList: FileList | null) {
    if (!fileList) return;
    const remaining = MAX_FILES - files.length;
    const toUpload = Array.from(fileList).slice(0, remaining);
    for (const file of toUpload) {
      const tempKey = `temp-${Date.now()}-${file.name}`;
      setFiles((f) => [...f, { key: tempKey, originalName: file.name, size: file.size, type: file.type, uploadedAt: "", status: "uploading" }]);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/challenge/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");
        setFiles((f) => f.map((x) => (x.key === tempKey ? { ...data, status: "done" } : x)));
      } catch {
        setFiles((f) => f.map((x) => (x.key === tempKey ? { ...x, status: "error" } : x)));
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeFile(key: string) {
    setFiles((f) => f.filter((x) => x.key !== key));
  }

  async function handleSubmit() {
    const e = validateStep(5);
    if (e.length > 0) { setErrors(e); return; }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = {
        ...form,
        marketingTried: form.marketingTried || null,
        whatStoppingSales: form.whatStoppingSales || null,
        focusRequest: form.focusRequest || null,
        doNotSayOrShow: form.doNotSayOrShow || null,
        creatorOrBusinessName: form.creatorOrBusinessName || null,
        socialUsername: form.socialUsername || null,
        primarySocialPlatform: form.primarySocialPlatform || null,
        existingProductUrl: form.existingProductUrl || null,
        uploadedFiles: files.filter((f) => f.status === "done").map(({ status, ...rest }) => rest),
      };
      const res = await fetch("/api/challenge/submit", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed. Please check your answers and try again.");
      setResult({ reference: data.reference, id: data.id });
    } catch (err) {
      // Preserve all form state — just surface the error so the creator can fix and retry.
      setSubmitError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setForm(initialState);
    setFiles([]);
    setErrors([]);
    setSubmitError(null);
    setResult(null);
    setStep(1);
  }

  if (result) {
    return <SuccessScreen reference={result.reference} productName={form.productName} featureType={form.featureType as "public" | "anonymous"} email={form.email} onSubmitAnother={resetForm} />;
  }

  const progressPct = (step / 6) * 100;

  return (
    <div style={{ maxWidth: "640px", margin: "0 auto", background: "#fff", borderRadius: "20px", border: "1px solid #e5e7eb", padding: "32px 28px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      {/* ── Progress ── */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-orange-600">Step {step} of 6</span>
          <span className="text-xs text-gray-500">{STEP_LABELS[step - 1]}</span>
        </div>
        <Progress value={progressPct} className="h-1.5" />
      </div>

      {/* ── Error announcements ── */}
      {errors.length > 0 && (
        <div role="alert" aria-live="assertive" className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-red-700 mb-1"><AlertCircle className="w-4 h-4" />Please fix the following:</div>
          <ul className="text-sm text-red-600 list-disc pl-5 space-y-0.5">{errors.map((er, i) => <li key={i}>{er}</li>)}</ul>
        </div>
      )}
      {submitError && (
        <div role="alert" aria-live="assertive" className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{submitError}</div>
      )}

      {/* Honeypot — hidden from sighted users and screen readers, real users never fill this in */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: "1px", height: "1px", overflow: "hidden" }}>
        <label htmlFor="website">Leave this field blank</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => set("website", e.target.value)} />
      </div>

      <h2 ref={headingRef} tabIndex={-1} className="text-xl font-bold text-gray-900 mb-5 outline-none">{STEP_LABELS[step - 1]}</h2>

      {step === 1 && (
        <div className="space-y-4">
          <Field label="Full name" required><Input value={form.fullName} onChange={(e) => set("fullName", e.target.value)} /></Field>
          <Field label="Email address" required><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field label="Creator or business name" hint="Optional"><Input value={form.creatorOrBusinessName} onChange={(e) => set("creatorOrBusinessName", e.target.value)} /></Field>
          <Field label="Social media username" hint="Optional"><Input value={form.socialUsername} onChange={(e) => set("socialUsername", e.target.value)} /></Field>
          <Field label="Primary social platform" hint="Optional — a social account is never required">
            <select value={form.primarySocialPlatform} onChange={(e) => set("primarySocialPlatform", e.target.value)} className="w-full h-10 text-sm rounded-lg border border-gray-300 px-3">
              <option value="">Select…</option>
              {SOCIAL_PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </Field>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <p className="text-xs text-gray-500 -mt-2 mb-2">Submit one product per form — please don&apos;t attach your entire collection.</p>
          <Field label="Product name" required><Input value={form.productName} onChange={(e) => set("productName", e.target.value)} /></Field>
          <Field label="Product type" required>
            <select value={form.productType} onChange={(e) => set("productType", e.target.value)} className="w-full h-10 text-sm rounded-lg border border-gray-300 px-3">
              <option value="">Select…</option>
              {PRODUCT_TYPES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </Field>
          <Field label="Product description" required><Textarea rows={3} value={form.productDescription} onChange={(e) => set("productDescription", e.target.value)} /></Field>
          <Field label="Target audience" required><Textarea rows={2} value={form.targetAudience} onChange={(e) => set("targetAudience", e.target.value)} /></Field>
          <Field label="What problem does the product solve?" required><Textarea rows={2} value={form.problemSolved} onChange={(e) => set("problemSolved", e.target.value)} /></Field>
          <Field label="Product price" required><Input placeholder="e.g. £27" value={form.productPrice} onChange={(e) => set("productPrice", e.target.value)} /></Field>
          <Field label="Current product status" required>
            <select value={form.productStatus} onChange={(e) => set("productStatus", e.target.value)} className="w-full h-10 text-sm rounded-lg border border-gray-300 px-3">
              <option value="">Select…</option>
              {PRODUCT_STATUSES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </Field>
          <Field label="Existing product or website link" hint="Optional — for internal review only, never shown publicly"><Input value={form.existingProductUrl} onChange={(e) => set("existingProductUrl", e.target.value)} /></Field>
          <Field label="What makes this product useful or different?" required><Textarea rows={2} value={form.whatMakesUseful} onChange={(e) => set("whatMakesUseful", e.target.value)} /></Field>
          <Field label="What would you most like me to improve?" required><Textarea rows={2} value={form.whatToImprove} onChange={(e) => set("whatToImprove", e.target.value)} /></Field>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <Field label="What are you currently struggling with?" required hint="Select all that apply">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {MARKETING_STRUGGLES.map((s) => (
                <label key={s.value} className="flex items-center gap-2 text-sm text-gray-700 border border-gray-200 rounded-lg px-3 py-2 cursor-pointer hover:border-orange-300">
                  <Checkbox checked={form.marketingStruggles.includes(s.value)} onCheckedChange={() => toggleStruggle(s.value)} />
                  {s.label}
                </label>
              ))}
            </div>
          </Field>
          <Field label="What marketing have you already tried?" hint="Optional"><Textarea rows={2} value={form.marketingTried} onChange={(e) => set("marketingTried", e.target.value)} /></Field>
          <Field label="What do you think is currently stopping the product from selling?" hint="Optional"><Textarea rows={2} value={form.whatStoppingSales} onChange={(e) => set("whatStoppingSales", e.target.value)} /></Field>
          <Field label="Is there anything specific you want me to focus on?" hint="Optional"><Textarea rows={2} value={form.focusRequest} onChange={(e) => set("focusRequest", e.target.value)} /></Field>
          <Field label="Is there anything I must not say or show publicly?" hint="Optional"><Textarea rows={2} value={form.doNotSayOrShow} onChange={(e) => set("doNotSayOrShow", e.target.value)} /></Field>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 mb-2">How would you like your product to be featured?</p>

          <button
            type="button"
            onClick={() => set("featureType", "public")}
            className={`w-full text-left rounded-xl border-2 p-4 transition-colors ${form.featureType === "public" ? "border-orange-500 bg-orange-50" : "border-gray-200 hover:border-gray-300"}`}
            aria-pressed={form.featureType === "public"}
          >
            <p className="font-semibold text-gray-900 mb-1">Show my product and creator identity</p>
            <p className="text-sm text-gray-600 leading-relaxed">
              Your creator or business name, social username, product name, product visuals and Content Flywheel Store
              product page may be shown publicly in the challenge series. Public creators do not need a Content
              Flywheel account when submitting. After your submission passes eligibility review, you&apos;ll get an
              email asking you to create a Content Flywheel Store product listing and reply with the link — for the
              exact product being promoted only.
            </p>
          </button>

          <button
            type="button"
            onClick={() => set("featureType", "anonymous")}
            className={`w-full text-left rounded-xl border-2 p-4 transition-colors ${form.featureType === "anonymous" ? "border-orange-500 bg-orange-50" : "border-gray-200 hover:border-gray-300"}`}
            aria-pressed={form.featureType === "anonymous"}
          >
            <p className="font-semibold text-gray-900 mb-1">Keep my identity and product details anonymous</p>
            <p className="text-sm text-gray-600 leading-relaxed mb-2">
              Your product will still be used as a marketing case study, but identifying details will be removed or
              blurred. You will not need a Content Flywheel account, a store, a public product link, or to reveal your
              social profile. The case study may still discuss the general product type, audience, problem, marketing
              challenges, strategy, improvements and lessons learned.
            </p>
          </button>

          {form.featureType === "anonymous" && (
            <label className="flex items-start gap-2 text-sm text-gray-700 bg-purple-50 border border-purple-200 rounded-lg p-3">
              <Checkbox checked={form.anonymousConsent} onCheckedChange={(c) => set("anonymousConsent", c === true)} className="mt-0.5" />
              <span>I understand that Content Flywheel may discuss the general product type, audience, marketing challenges, strategy and improvements while removing or blurring identifying information.</span>
            </label>
          )}
        </div>
      )}

      {step === 5 && (
        <div className="space-y-6">
          <div>
            <Label className="mb-1.5 block">Product uploads <span className="text-red-500">*</span></Label>
            <p className="text-xs text-gray-500 mb-3">PDF, product cover, screenshots, workbook, template preview, course outline, digital download preview, brand assets, or supporting images. Up to {MAX_FILES} files, 50MB each. Files are kept private — only reviewed by admins.</p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={files.length >= MAX_FILES}
              className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl py-6 text-sm text-gray-600 hover:border-orange-400 hover:text-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="w-4 h-4" />Choose files to upload
            </button>
            <input ref={fileInputRef} type="file" multiple accept={ACCEPTED_TYPES} className="hidden" onChange={(e) => handleFileSelect(e.target.files)} />

            {files.length > 0 && (
              <div className="mt-3 space-y-2">
                {files.map((f) => (
                  <div key={f.key} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                    <span className="flex items-center gap-2 min-w-0"><FileText className="w-4 h-4 text-gray-400 shrink-0" /><span className="truncate">{f.originalName}</span><span className="text-xs text-gray-400 shrink-0">({fmtBytes(f.size)})</span></span>
                    <span className="flex items-center gap-2 shrink-0">
                      {f.status === "uploading" && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                      {f.status === "done" && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                      {f.status === "error" && <AlertCircle className="w-4 h-4 text-red-500" />}
                      <button type="button" onClick={() => removeFile(f.key)} aria-label={`Remove ${f.originalName}`}><X className="w-4 h-4 text-gray-400 hover:text-red-500" /></button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 pt-5 space-y-2.5">
            <p className="text-sm font-semibold text-gray-900 mb-1">Permissions and eligibility</p>
            <ConsentBox checked={form.ownershipConfirmed} onChange={(c) => set("ownershipConfirmed", c)}>I confirm that I own this product or have permission to submit it.</ConsentBox>
            <ConsentBox checked={form.reviewPermissionConfirmed} onChange={(c) => set("reviewPermissionConfirmed", c)}>I give Content Flywheel permission to review this product and create marketing content about it.</ConsentBox>
            <ConsentBox checked={form.queueUnderstandingConfirmed} onChange={(c) => set("queueUnderstandingConfirmed", c)}>I understand that every eligible submission will enter the production queue, but publishing may take time.</ConsentBox>
            <ConsentBox checked={form.publicationOrderConfirmed} onChange={(c) => set("publicationOrderConfirmed", c)}>I understand that the publication order may differ from the submission order.</ConsentBox>
            <ConsentBox checked={form.rejectionRiskAcknowledged} onChange={(c) => set("rejectionRiskAcknowledged", c)}>I understand that my submission may be rejected if it is incomplete, unsafe, unlawful, fraudulent, inappropriate or outside the challenge scope.</ConsentBox>
            <ConsentBox checked={form.termsAgreed} onChange={(c) => set("termsAgreed", c)}>
              I agree to the <Link href="/privacy" className="text-orange-600 underline">Privacy Policy</Link> and <Link href="/terms" className="text-orange-600 underline">Terms</Link>.
            </ConsentBox>

            {form.featureType === "public" && (
              <>
                <ConsentBox checked={form.publicDisplayConsent} onChange={(c) => set("publicDisplayConsent", c)}>I give Content Flywheel permission to publicly display my selected product, creator details and Content Flywheel Store listing.</ConsentBox>
                <ConsentBox checked={form.storeLinkObligationAck} onChange={(c) => set("storeLinkObligationAck", c)}>I understand that I will need to provide a Content Flywheel Store product link before production begins.</ConsentBox>
              </>
            )}
            {form.featureType === "anonymous" && (
              <>
                <ConsentBox checked={form.anonymousNoLinkAck} onChange={(c) => set("anonymousNoLinkAck", c)}>I understand that my product will not receive a public purchase or discovery link.</ConsentBox>
                <ConsentBox checked={form.anonymousBlurAck} onChange={(c) => set("anonymousBlurAck", c)}>I understand that identifying information will be removed or blurred before publishing.</ConsentBox>
              </>
            )}

            <div className="border-t border-gray-100 pt-2.5 mt-2.5">
              <ConsentBox checked={form.marketingOptIn} onChange={(c) => set("marketingOptIn", c)}>Send me Content Flywheel updates, marketing tips and challenge news.</ConsentBox>
            </div>
          </div>
        </div>
      )}

      {step === 6 && (
        <div className="space-y-5">
          <ReviewRow label="Full name" value={form.fullName} />
          <ReviewRow label="Email" value={form.email} />
          <ReviewRow label="Product" value={form.productName} />
          <ReviewRow label="Product type" value={PRODUCT_TYPES.find((t) => t.value === form.productType)?.label ?? ""} />
          <ReviewRow label="Feature type" value={form.featureType === "public" ? "Public — identity shown" : "Anonymous — identity blurred"} />
          <ReviewRow label="Files" value={`${files.filter((f) => f.status === "done").length} uploaded`} />
          <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-lg p-4">
            After you submit, your product goes through a basic eligibility review. Every eligible submission is added
            to the production queue — publishing may take time and won&apos;t necessarily follow submission order.
          </p>
        </div>
      )}

      {/* ── Nav ── */}
      <div className="flex items-center justify-between mt-8 pt-5 border-t border-gray-100">
        <Button type="button" variant="ghost" onClick={goBack} disabled={step === 1 || submitting}>Back</Button>
        {step < 6 ? (
          <Button type="button" className="bg-orange-500 hover:bg-orange-600" onClick={goNext}>Next</Button>
        ) : (
          <Button type="button" className="bg-orange-500 hover:bg-orange-600 gap-2" onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}Submit
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Small building blocks ────────────────────────────────────────────────────

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block text-sm">{label} {required && <span className="text-red-500">*</span>}</Label>
      {hint && <p className="text-xs text-gray-400 mb-1.5">{hint}</p>}
      {children}
    </div>
  );
}

function ConsentBox({ checked, onChange, children }: { checked: boolean; onChange: (c: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex items-start gap-2 text-sm text-gray-700">
      <Checkbox checked={checked} onCheckedChange={(c) => onChange(c === true)} className="mt-0.5" />
      <span>{children}</span>
    </label>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm border-b border-gray-100 pb-2">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900 text-right">{value}</span>
    </div>
  );
}

function SuccessScreen({ reference, productName, featureType, email, onSubmitAnother }: {
  reference: string; productName: string; featureType: "public" | "anonymous"; email: string; onSubmitAnother: () => void;
}) {
  return (
    <div style={{ maxWidth: "560px", margin: "0 auto", background: "#fff", borderRadius: "20px", border: "1px solid #e5e7eb", padding: "40px 32px", textAlign: "center" }}>
      <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
        <CheckCircle2 className="w-7 h-7 text-green-600" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-3">Your product has been submitted</h2>
      <p className="text-sm text-gray-600 leading-relaxed mb-2">
        Your submission is now waiting for an eligibility review. Every eligible product will be added to the 100
        Product Challenge production queue. Publishing times will depend on the number of submissions currently
        waiting.
      </p>
      <p className="text-sm text-gray-600 leading-relaxed mb-6">
        {featureType === "public"
          ? "Once your product passes the review, you'll receive an email asking you to create a Content Flywheel Store listing for the product you submitted."
          : "You will not be required to create a Content Flywheel account or store, and your product will not receive a public purchase or discovery link. Your identifying details will be removed or blurred before publication."}
      </p>

      <div className="bg-gray-50 rounded-xl p-4 text-left text-sm space-y-2 mb-8">
        <div className="flex justify-between"><span className="text-gray-500">Reference</span><span className="font-mono font-semibold text-gray-900">{reference}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Product name</span><span className="font-medium text-gray-900">{productName}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Feature type</span><span className="font-medium text-gray-900 capitalize">{featureType}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Email</span><span className="font-medium text-gray-900">{email}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Status</span><span className="font-medium text-orange-600">Under eligibility review</span></div>
      </div>

      <div className="flex flex-col gap-2.5">
        <a href="https://tiktok.com/@contentflywheelofficial" target="_blank" rel="noopener noreferrer" className="inline-block w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm">Follow Content Flywheel</a>
        <button type="button" onClick={onSubmitAnother} className="w-full py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold text-sm hover:border-gray-400">Submit Another Product</button>
        <Link href="/" className="w-full py-3 rounded-xl text-gray-500 font-medium text-sm hover:text-gray-700 text-center">Return to Homepage</Link>
      </div>
    </div>
  );
}
