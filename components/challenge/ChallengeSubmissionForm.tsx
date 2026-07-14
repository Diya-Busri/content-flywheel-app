"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Upload, X, FileText, CheckCircle2, AlertCircle, Check, ChevronDown, Sparkles } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

type UploadedFile = { key: string; originalName: string; size: number; type: string; uploadedAt: string; status: "uploading" | "done" | "error"; error?: string };

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

const STEP_LABELS = ["About", "Product", "Marketing", "Feature", "Uploads", "Review"];

// Rough time-remaining estimate shown in the progress bar — keeps the whole
// form feeling like a fast, bounded task rather than an open-ended form.
const STEP_TIME_LEFT: Record<number, string> = {
  1: "About 3 minutes left",
  2: "About 2 minutes left",
  3: "About 90 seconds left",
  4: "About 1 minute left",
  5: "About 1 minute left",
  6: "Just review and submit",
};

// One line under each step heading answering "why am I being asked this?"
const STEP_WHY: Record<number, string> = {
  1: "So we know who to send your eligibility decision and next steps to.",
  2: "This helps us understand your product so we can create marketing that actually sells it.",
  3: "This helps us build a strategy around what you actually need help with.",
  4: "This lets viewers discover and buy your product — or keeps everything private, your choice.",
  5: "We need the product file to review it properly, and your permission to move forward.",
  6: "Last check before your product joins the queue.",
};

const PRICE_BANDS = [
  { value: "", label: "Select…" },
  { value: "Free", label: "Free" },
  { value: "Under £10", label: "Under £10" },
  { value: "£10–£25", label: "£10–£25" },
  { value: "£25–£50", label: "£25–£50" },
  { value: "£50–£100", label: "£50–£100" },
  { value: "Over £100", label: "Over £100" },
  { value: "Not sure yet", label: "Not sure yet" },
  { value: "__other__", label: "Other (type exact price)" },
];

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
  { value: "x", label: "X" }, { value: "linkedin", label: "LinkedIn" }, { value: "other", label: "Other" }, { value: "none", label: "I'd rather not say" },
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
const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50MB per file
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif",
  "application/zip", "application/x-zip-compressed",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/epub+zip",
]);
const RECOMMENDED_UPLOADS = [
  { label: "Product file", hint: "PDF, zip, etc." },
  { label: "Cover image" },
  { label: "Product screenshots" },
  { label: "Landing page", hint: "optional" },
  { label: "Product preview", hint: "optional" },
  { label: "Brand assets", hint: "optional" },
];

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function ChallengeSubmissionForm() {
  // Step 0 is the pre-form landing screen ("Start Application"); 1–6 are the
  // form steps as before.
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initialState);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<{ reference: string; id: string } | null>(null);
  const [priceCustomMode, setPriceCustomMode] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step >= 1) headingRef.current?.focus();
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
      if (!form.fullName.trim()) e.push("Your name is required.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.push("A valid email address is required — that's how we'll reach you.");
    }
    if (n === 2) {
      if (!form.productName.trim()) e.push("Product name is required.");
      if (!form.productType) e.push("Select a product type.");
      if (!form.productDescription.trim()) e.push("A short product description is required.");
      if (!form.targetAudience.trim()) e.push("Target audience is required.");
      if (!form.problemSolved.trim()) e.push("Describe the problem the product solves.");
      if (!form.productStatus) e.push("Select the current product status.");
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

      // Client-side pre-checks — fail fast with a clear reason before hitting the network.
      if (file.size === 0) {
        setFiles((f) => f.map((x) => (x.key === tempKey ? { ...x, status: "error", error: "File is empty." } : x)));
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        setFiles((f) => f.map((x) => (x.key === tempKey ? { ...x, status: "error", error: "File is too large (50MB max)." } : x)));
        continue;
      }
      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        setFiles((f) => f.map((x) => (x.key === tempKey ? { ...x, status: "error", error: "That file type isn't supported." } : x)));
        continue;
      }

      try {
        // Step 1: ask the server for a short-lived presigned R2 upload URL.
        const presignRes = await fetch("/api/challenge/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size }),
        });
        const presignData = await presignRes.json();
        if (!presignRes.ok) throw new Error(presignData.error || "Could not prepare upload");

        // Step 2: upload the file bytes straight to R2 — never through our server,
        // so there's no Vercel function body-size limit to hit.
        const putRes = await fetch(presignData.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!putRes.ok) throw new Error("Upload to storage failed. Please try again.");

        setFiles((f) =>
          f.map((x) =>
            x.key === tempKey
              ? { key: presignData.key, originalName: presignData.originalName, size: presignData.size, type: presignData.type, uploadedAt: presignData.uploadedAt, status: "done" }
              : x
          )
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed. Please try again.";
        setFiles((f) => f.map((x) => (x.key === tempKey ? { ...x, status: "error", error: message } : x)));
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeFile(key: string) {
    setFiles((f) => f.filter((x) => x.key !== key));
  }

  // "Select all" covers only the required permission/eligibility acknowledgements —
  // marketingOptIn is a genuine opt-in choice and is deliberately excluded.
  const requiredConsentKeys: (keyof FormState)[] = [
    "ownershipConfirmed", "reviewPermissionConfirmed", "queueUnderstandingConfirmed",
    "publicationOrderConfirmed", "rejectionRiskAcknowledged", "termsAgreed",
    ...(form.featureType === "public" ? (["publicDisplayConsent", "storeLinkObligationAck"] as (keyof FormState)[]) : []),
    ...(form.featureType === "anonymous" ? (["anonymousNoLinkAck", "anonymousBlurAck"] as (keyof FormState)[]) : []),
  ];
  const allRequiredConsentsChecked = requiredConsentKeys.every((k) => form[k] === true);
  function toggleAllConsents(checked: boolean) {
    setForm((f) => {
      const next = { ...f };
      for (const k of requiredConsentKeys) (next as Record<string, unknown>)[k] = checked;
      return next;
    });
  }
  // Queue timing and publish order are one acknowledgement in the UI, stored as two
  // fields for the admin readiness checklist — keep them in sync from a single checkbox.
  function setQueueAndOrder(checked: boolean) {
    setForm((f) => ({ ...f, queueUnderstandingConfirmed: checked, publicationOrderConfirmed: checked }));
  }

  async function handleSubmit() {
    const e = validateStep(5);
    if (e.length > 0) { setErrors(e); return; }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = {
        ...form,
        productPrice: form.productPrice || null,
        whatMakesUseful: form.whatMakesUseful || null,
        whatToImprove: form.whatToImprove || null,
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

  if (step === 0) {
    return <LandingIntro onStart={() => setStep(1)} />;
  }

  return (
    <div
      className="mx-auto bg-white border border-gray-200 px-5 py-6 sm:px-7 sm:py-8"
      style={{ maxWidth: "640px", borderRadius: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
    >
      {/* ── Progress ── */}
      <Stepper step={step} />

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

      <h2 ref={headingRef} tabIndex={-1} className="text-xl font-bold text-gray-900 mb-1.5 outline-none">{stepHeading(step)}</h2>
      <p className="text-sm text-gray-500 mb-5">{STEP_WHY[step]}</p>

      {step === 1 && (
        <div className="space-y-4">
          <Field label="Full name" required><Input value={form.fullName} onChange={(e) => set("fullName", e.target.value)} /></Field>
          <Field label="Email address" required hint="We'll send your eligibility decision and next steps here."><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>

          <OptionalSection>
            <Field label="Creator or business name"><Input value={form.creatorOrBusinessName} onChange={(e) => set("creatorOrBusinessName", e.target.value)} /></Field>
            <Field label="Social media username"><Input value={form.socialUsername} onChange={(e) => set("socialUsername", e.target.value)} /></Field>
            <Field label="Primary social platform">
              <select value={form.primarySocialPlatform} onChange={(e) => set("primarySocialPlatform", e.target.value)} className="w-full h-10 text-sm rounded-lg border border-gray-300 px-3">
                <option value="">Select…</option>
                {SOCIAL_PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </Field>
          </OptionalSection>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <p className="text-xs text-gray-500 -mt-2 mb-2">One product per submission, please — not your whole collection.</p>
          <Field label="Product name" required><Input value={form.productName} onChange={(e) => set("productName", e.target.value)} /></Field>
          <Field label="Product type" required>
            <select value={form.productType} onChange={(e) => set("productType", e.target.value)} className="w-full h-10 text-sm rounded-lg border border-gray-300 px-3">
              <option value="">Select…</option>
              {PRODUCT_TYPES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </Field>
          <Field label="What is it?" required hint="A couple of sentences is plenty.">
            <Textarea rows={3} className="resize-y" placeholder="e.g. A 30-page PDF guide that walks readers through building a morning routine in 7 days." value={form.productDescription} onChange={(e) => set("productDescription", e.target.value)} />
          </Field>
          <Field label="Who is it for?" required>
            <Textarea rows={2} className="resize-y" placeholder="e.g. Busy professionals in their 30s who struggle to wake up early." value={form.targetAudience} onChange={(e) => set("targetAudience", e.target.value)} />
          </Field>
          <Field label="What problem does it solve?" required>
            <Textarea rows={2} className="resize-y" placeholder="e.g. They hit snooze, lose their mornings, and start the day already behind." value={form.problemSolved} onChange={(e) => set("problemSolved", e.target.value)} />
          </Field>
          <Field label="Current status" required>
            <select value={form.productStatus} onChange={(e) => set("productStatus", e.target.value)} className="w-full h-10 text-sm rounded-lg border border-gray-300 px-3">
              <option value="">Select…</option>
              {PRODUCT_STATUSES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </Field>

          <OptionalSection>
            <Field label="Price" hint="Happy to ask by email later if you're not sure">
              <select
                value={priceCustomMode ? "__other__" : (PRICE_BANDS.some((b) => b.value === form.productPrice) ? form.productPrice : "")}
                onChange={(e) => {
                  if (e.target.value === "__other__") { setPriceCustomMode(true); set("productPrice", ""); }
                  else { setPriceCustomMode(false); set("productPrice", e.target.value); }
                }}
                className="w-full h-10 text-sm rounded-lg border border-gray-300 px-3"
              >
                {PRICE_BANDS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              {priceCustomMode && (
                <Input className="mt-2" placeholder="e.g. £27" value={form.productPrice} onChange={(e) => set("productPrice", e.target.value)} />
              )}
            </Field>
            <Field label="Existing product or website link" hint="For our review only, never shown publicly">
              <Input placeholder="https://yourproduct.com" value={form.existingProductUrl} onChange={(e) => set("existingProductUrl", e.target.value)} />
            </Field>
            <Field label="What makes it different?">
              <Textarea rows={2} className="resize-y" placeholder="e.g. It's the only guide written specifically for parents, not just professionals." value={form.whatMakesUseful} onChange={(e) => set("whatMakesUseful", e.target.value)} />
            </Field>
            <Field label="Anything you'd like improved?">
              <Textarea rows={2} className="resize-y" placeholder="e.g. I'm not sure the cover or pricing is working." value={form.whatToImprove} onChange={(e) => set("whatToImprove", e.target.value)} />
            </Field>
          </OptionalSection>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <Field label="What's your biggest marketing challenge right now?" required hint="Pick as many as apply">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {MARKETING_STRUGGLES.map((s) => (
                <label key={s.value} className="flex items-center gap-2 text-sm text-gray-700 border border-gray-200 rounded-lg px-3 py-2 cursor-pointer hover:border-orange-300">
                  <Checkbox checked={form.marketingStruggles.includes(s.value)} onCheckedChange={() => toggleStruggle(s.value)} />
                  {s.label}
                </label>
              ))}
            </div>
          </Field>

          <OptionalSection>
            <Field label="What have you already tried?"><Textarea rows={2} className="resize-y" placeholder="e.g. Instagram posts, a small ad budget, emailing my list" value={form.marketingTried} onChange={(e) => set("marketingTried", e.target.value)} /></Field>
            <Field label="What do you think is holding back sales?"><Textarea rows={2} className="resize-y" placeholder="e.g. Not sure who my ideal customer is" value={form.whatStoppingSales} onChange={(e) => set("whatStoppingSales", e.target.value)} /></Field>
            <Field label="Anything specific you'd like us to focus on?"><Textarea rows={2} className="resize-y" placeholder="e.g. Help me write better hooks for TikTok" value={form.focusRequest} onChange={(e) => set("focusRequest", e.target.value)} /></Field>
            <Field label="Anything we shouldn't say or show publicly?"><Textarea rows={2} className="resize-y" placeholder="e.g. Please don't mention my day job" value={form.doNotSayOrShow} onChange={(e) => set("doNotSayOrShow", e.target.value)} /></Field>
          </OptionalSection>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 mb-2">How would you like your product featured?</p>

          <button
            type="button"
            onClick={() => set("featureType", "public")}
            className={`w-full text-left rounded-xl border-2 p-4 transition-colors ${form.featureType === "public" ? "border-orange-500 bg-orange-50" : "border-gray-200 hover:border-gray-300"}`}
            aria-pressed={form.featureType === "public"}
          >
            <p className="font-semibold text-gray-900 mb-1">Feature me publicly</p>
            <p className="text-sm text-gray-600 leading-relaxed">
              Your name and product get featured across our channels. If you&apos;re selected, we&apos;ll help you
              publish it to your Content Flywheel Store so viewers can discover and buy it directly from your
              feature — no account needed to apply today.
            </p>
          </button>

          <button
            type="button"
            onClick={() => set("featureType", "anonymous")}
            className={`w-full text-left rounded-xl border-2 p-4 transition-colors ${form.featureType === "anonymous" ? "border-orange-500 bg-orange-50" : "border-gray-200 hover:border-gray-300"}`}
            aria-pressed={form.featureType === "anonymous"}
          >
            <p className="font-semibold text-gray-900 mb-1">Keep me anonymous</p>
            <p className="text-sm text-gray-600 leading-relaxed">
              Your product becomes a case study, but identifying details are blurred or removed. No account, store
              or public link required.
            </p>
          </button>

          {form.featureType === "anonymous" && (
            <label className="flex items-start gap-2 text-sm text-gray-700 bg-purple-50 border border-purple-200 rounded-lg p-3">
              <Checkbox checked={form.anonymousConsent} onCheckedChange={(c) => set("anonymousConsent", c === true)} className="mt-0.5" />
              <span>I understand Content Flywheel may discuss the product, audience and strategy while blurring identifying details.</span>
            </label>
          )}
        </div>
      )}

      {step === 5 && (
        <div className="space-y-6">
          <div>
            <Label className="mb-2 block text-sm font-semibold text-gray-900">Recommended uploads</Label>
            <div className="grid grid-cols-2 gap-1.5 mb-4">
              {RECOMMENDED_UPLOADS.map((u) => (
                <div key={u.label} className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-50 rounded-md px-2.5 py-1.5">
                  <Check className="w-3.5 h-3.5 text-green-600 shrink-0" />
                  <span className="truncate">{u.label}{u.hint && <span className="text-gray-400"> ({u.hint})</span>}</span>
                </div>
              ))}
            </div>

            <Label className="mb-1.5 block">Product uploads <span className="text-red-500">*</span></Label>
            <p className="text-xs text-gray-500 mb-3">Up to {MAX_FILES} files, 50MB each. Kept private — only reviewed by admins.</p>
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
                  <div key={f.key} className={`rounded-lg px-3 py-2 ${f.status === "error" ? "bg-red-50" : "bg-gray-50"}`}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 min-w-0"><FileText className="w-4 h-4 text-gray-400 shrink-0" /><span className="truncate">{f.originalName}</span><span className="text-xs text-gray-400 shrink-0">({fmtBytes(f.size)})</span></span>
                      <span className="flex items-center gap-2 shrink-0">
                        {f.status === "uploading" && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                        {f.status === "done" && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                        {f.status === "error" && <AlertCircle className="w-4 h-4 text-red-500" />}
                        <button type="button" onClick={() => removeFile(f.key)} aria-label={`Remove ${f.originalName}`}><X className="w-4 h-4 text-gray-400 hover:text-red-500" /></button>
                      </span>
                    </div>
                    {f.status === "error" && f.error && <p className="text-xs text-red-600 mt-1">{f.error} Remove it and try again.</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 pt-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-900">Permissions</p>
              <label className="flex items-center gap-1.5 text-xs font-medium text-orange-600 cursor-pointer select-none">
                <Checkbox checked={allRequiredConsentsChecked} onCheckedChange={(c) => toggleAllConsents(c === true)} />
                Select all
              </label>
            </div>

            <PermissionGroup title="Legal">
              <ConsentBox checked={form.ownershipConfirmed} onChange={(c) => set("ownershipConfirmed", c)}>I own this product, or have permission to submit it.</ConsentBox>
              <ConsentBox checked={form.termsAgreed} onChange={(c) => set("termsAgreed", c)}>
                I agree to the <Link href="/privacy" className="text-orange-600 underline">Privacy Policy</Link> and <Link href="/terms" className="text-orange-600 underline">Terms</Link>.
              </ConsentBox>
            </PermissionGroup>

            <PermissionGroup title="Marketing">
              <ConsentBox checked={form.reviewPermissionConfirmed} onChange={(c) => set("reviewPermissionConfirmed", c)}>Content Flywheel can review this product and create marketing content about it.</ConsentBox>
            </PermissionGroup>

            <PermissionGroup title="Publication">
              <ConsentBox checked={form.queueUnderstandingConfirmed && form.publicationOrderConfirmed} onChange={setQueueAndOrder}>My submission joins a production queue — publishing takes time and order may vary.</ConsentBox>
              <ConsentBox checked={form.rejectionRiskAcknowledged} onChange={(c) => set("rejectionRiskAcknowledged", c)}>My submission may be turned away if it&apos;s incomplete, unsafe or outside the challenge scope.</ConsentBox>
              {form.featureType === "public" && (
                <>
                  <ConsentBox checked={form.publicDisplayConsent} onChange={(c) => set("publicDisplayConsent", c)}>I&apos;d like Content Flywheel to feature my product, name and Store listing across your channels.</ConsentBox>
                  <ConsentBox checked={form.storeLinkObligationAck} onChange={(c) => set("storeLinkObligationAck", c)}>I&apos;ll share my Content Flywheel Store link once I&apos;m selected, so viewers have somewhere to buy.</ConsentBox>
                </>
              )}
              {form.featureType === "anonymous" && (
                <>
                  <ConsentBox checked={form.anonymousNoLinkAck} onChange={(c) => set("anonymousNoLinkAck", c)}>My identity won&apos;t be shown, and I won&apos;t need a Store link.</ConsentBox>
                  <ConsentBox checked={form.anonymousBlurAck} onChange={(c) => set("anonymousBlurAck", c)}>Identifying details will be blurred or removed before publishing.</ConsentBox>
                </>
              )}
            </PermissionGroup>

            <PermissionGroup title="Communication">
              <ConsentBox checked={form.marketingOptIn} onChange={(c) => set("marketingOptIn", c)}>Send me updates, tips and challenge news.</ConsentBox>
            </PermissionGroup>
          </div>
        </div>
      )}

      {step === 6 && (
        <div className="space-y-5">
          <NextStepsTimeline featureType={form.featureType} />

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Your answers</p>
            <div className="rounded-xl border border-gray-100 divide-y divide-gray-100 overflow-hidden">
              <ReviewRow label="Creator" value={form.fullName} />
              <ReviewRow label="Product" value={form.productName} />
              <ReviewRow label="Audience" value={form.targetAudience} />
              <ReviewRow label="Product type" value={PRODUCT_TYPES.find((t) => t.value === form.productType)?.label ?? ""} />
              <ReviewRow label="Marketing challenge" value={form.marketingStruggles.map((v) => MARKETING_STRUGGLES.find((s) => s.value === v)?.label ?? v).join(", ")} />
              <ReviewRow label="Feature type" value={form.featureType === "public" ? "Public — name shown" : "Anonymous — identity blurred"} />
              <ReviewRow label="Files uploaded" value={`${files.filter((f) => f.status === "done").length}`} />
            </div>
          </div>
        </div>
      )}

      {/* ── Nav ── */}
      <div className="sticky bottom-0 z-10 -mx-5 sm:-mx-7 mt-8 flex items-center justify-between border-t border-gray-100 bg-white/95 backdrop-blur px-5 sm:px-7 py-4 sm:static sm:mx-0 sm:bg-transparent sm:backdrop-blur-0 sm:py-0 sm:pt-5 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-0">
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

function stepHeading(step: number): string {
  switch (step) {
    case 1: return "About you";
    case 2: return "Your product";
    case 3: return "Marketing challenges";
    case 4: return "Public or anonymous?";
    case 5: return "Uploads & permissions";
    case 6: return "Review & submit";
    default: return "";
  }
}

// ── Small building blocks ────────────────────────────────────────────────────

function Stepper({ step }: { step: number }) {
  const percent = Math.round((step / STEP_LABELS.length) * 100);
  return (
    <div className="mb-6">
      <div className="flex items-center">
        {STEP_LABELS.map((label, i) => {
          const idx = i + 1;
          const isDone = idx < step;
          const isCurrent = idx === step;
          return (
            <div key={label} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-colors ${
                    isDone ? "bg-orange-500 text-white" : isCurrent ? "bg-orange-500 text-white ring-4 ring-orange-100" : "bg-gray-100 text-gray-400"
                  }`}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {isDone ? <Check className="w-3.5 h-3.5" /> : idx}
                </div>
                <span className={`mt-1 text-[10px] font-medium text-center leading-tight hidden sm:block ${isCurrent ? "text-orange-600" : isDone ? "text-gray-600" : "text-gray-400"}`}>
                  {label}
                </span>
              </div>
              {idx < STEP_LABELS.length && <div className={`flex-1 h-0.5 mx-1 ${isDone ? "bg-orange-400" : "bg-gray-200"}`} />}
            </div>
          );
        })}
      </div>

      <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden mt-3" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full bg-orange-500 rounded-full transition-all duration-300" style={{ width: `${percent}%` }} />
      </div>
      <p className="text-center text-xs font-medium text-gray-500 mt-2">
        Step {step} of {STEP_LABELS.length} • {STEP_TIME_LEFT[step]} • {percent}% complete
      </p>
    </div>
  );
}

function LandingIntro({ onStart }: { onStart: () => void }) {
  return (
    <div
      className="mx-auto bg-white border border-gray-200 px-6 py-8 sm:px-9 sm:py-10 text-center"
      style={{ maxWidth: "640px", borderRadius: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
    >
      <div className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 border border-orange-100 px-3 py-1 text-xs font-semibold text-orange-600 mb-4">
        <Sparkles className="w-3.5 h-3.5" />100 Product Challenge
      </div>
      <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-3 leading-tight">
        Get Your Digital Product Featured for Free
      </h1>
      <p className="text-sm sm:text-base text-gray-600 leading-relaxed mb-6 max-w-md mx-auto">
        We&apos;ll review your product, create marketing content around it, and feature it across our social channels.
      </p>

      <div className="text-left bg-orange-50 border border-orange-100 rounded-xl p-4 mb-4">
        <p className="text-sm font-semibold text-gray-900 mb-2">What you&apos;ll get</p>
        <ul className="space-y-1.5 text-sm text-gray-700">
          <li className="flex gap-2"><Check className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />Free product review</li>
          <li className="flex gap-2"><Check className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />AI-generated marketing strategy</li>
          <li className="flex gap-2"><Check className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />Exposure to our audience</li>
          <li className="flex gap-2"><Check className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />Permanent listing in the Content Flywheel marketplace (if selected)</li>
        </ul>
      </div>

      <div className="text-left border border-gray-100 rounded-xl p-4 mb-6">
        <p className="text-sm font-semibold text-gray-900 mb-2">Why creators apply with confidence</p>
        <ul className="space-y-1.5 text-sm text-gray-700">
          <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />Free to apply</li>
          <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />No purchase required</li>
          <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />Every product is manually reviewed</li>
          <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />Selected creators receive free marketing</li>
        </ul>
      </div>

      <p className="text-xs text-gray-400 mb-5">Time to apply: ~3 minutes</p>

      <Button type="button" className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 px-8" onClick={onStart}>
        Start Application
      </Button>
    </div>
  );
}

function OptionalSection({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
        aria-expanded={open}
      >
        <span>Additional information (optional)</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-4 pb-4 pt-1 space-y-4 border-t border-gray-100">{children}</div>}
    </div>
  );
}

function NextStepsTimeline({ featureType }: { featureType: "public" | "anonymous" | "" }) {
  const steps = [
    "Submission received",
    "Eligibility review (24–48 hours)",
    featureType === "anonymous"
      ? "Confirmation you're all set — no Store link needed"
      : "Email requesting your Content Flywheel Store link",
    "Product added to the production queue",
    "Marketing campaign created",
    "Featured across our channels",
  ];
  return (
    <div className="rounded-xl border border-orange-100 bg-orange-50 p-4">
      <p className="text-sm font-semibold text-gray-900 mb-3">What happens after you submit</p>
      <ol className="space-y-2.5">
        {steps.map((s, i) => (
          <li key={s} className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
            <span className="text-sm text-gray-700 leading-snug pt-0.5">{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block text-sm">{label} {required && <span className="text-red-500">*</span>}</Label>
      {hint && <p className="text-xs text-gray-400 mb-1.5">{hint}</p>}
      {children}
    </div>
  );
}

function PermissionGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">{title}</p>
      <div className="space-y-2">{children}</div>
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
    <div className="flex items-start justify-between gap-4 text-sm px-4 py-2.5">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="font-medium text-gray-900 text-right">{value || "—"}</span>
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
      <h2 className="text-2xl font-bold text-gray-900 mb-3">You&apos;re in — thanks for submitting</h2>
      <p className="text-sm text-gray-600 leading-relaxed mb-2">
        Your submission is now waiting for a quick eligibility review. Every eligible product joins the 100 Product
        Challenge production queue — publishing time depends on how many are ahead of you.
      </p>
      <p className="text-sm text-gray-600 leading-relaxed mb-6">
        {featureType === "public"
          ? "Once you're eligible, we'll email you to ask for a Content Flywheel Store link for this product."
          : "No account or Store needed — your identifying details will be blurred or removed before publishing."}
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
