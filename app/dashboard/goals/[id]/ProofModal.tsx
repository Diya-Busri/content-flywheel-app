"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Image, FileText, Link as LinkIcon } from "lucide-react";
import { validateProof } from "@/app/actions/validateProof";

const MIN_TEXT_TAB_LENGTH = 100;
const MIN_DESCRIPTION_LENGTH = 50;
const URL_REGEX = /^https?:\/\/.+/i;
const REJECTIONS_BEFORE_OVERRIDE = 3;

export type ProofType = "screenshot" | "text" | "link" | "file";

export type ProofPayload = {
  proofType: ProofType;
  proofUrl?: string | null;
  proofText?: string | null;
  proofValidationStatus?: "validated" | "validation_skipped";
};

type TabValue = "screenshot" | "text" | "link";

function getSuggestedProofTab(
  taskDescription: string,
  appLink?: string | null
): TabValue {
  if (appLink) return "screenshot";
  const lower = taskDescription.toLowerCase();
  if (/\b(create|design|build)\b/.test(lower)) return "screenshot";
  if (/\b(write|plan|define)\b/.test(lower)) return "text";
  if (/\b(post|publish|share)\b/.test(lower)) return "link";
  return "screenshot";
}

type ProofModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskDescription: string;
  taskType?: "external" | "app_action";
  category?: string | null;
  appLink?: string | null;
  onSubmit: (payload: ProofPayload) => Promise<void>;
};

async function uploadProofImage(dataUrl: string): Promise<string | null> {
  try {
    const res = await fetch("/api/goals/proof-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64: dataUrl }),
    });
    const data = await res.json();
    if (res.ok && data.url) return data.url;
  } catch {
    // Fallback to base64 if upload fails
  }
  return null;
}

export function ProofModal({
  open,
  onOpenChange,
  taskDescription,
  taskType,
  category,
  appLink,
  onSubmit,
}: ProofModalProps) {
  const [tab, setTab] = useState<TabValue>("screenshot");
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotDescription, setScreenshotDescription] = useState("");
  const [textValue, setTextValue] = useState("");
  const [linkValue, setLinkValue] = useState("");
  const [linkDescription, setLinkDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejectionCount, setRejectionCount] = useState(0);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const [showOverrideConfirm, setShowOverrideConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAppTask = taskType === "app_action";
  const hasAppLink = !!appLink;
  const canOverride = rejectionCount >= REJECTIONS_BEFORE_OVERRIDE;
  const showRejectionBanner = rejectionCount >= REJECTIONS_BEFORE_OVERRIDE;

  useEffect(() => {
    if (open) {
      const suggested = getSuggestedProofTab(taskDescription, appLink);
      setTab(isAppTask && suggested === "text" ? "screenshot" : suggested);
    }
  }, [open, taskDescription, appLink, isAppTask]);

  useEffect(() => {
    if (open && isAppTask && tab === "text") setTab("screenshot");
  }, [open, isAppTask, tab]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file (e.g. PNG, JPEG).");
      return;
    }
    setError(null);
    setScreenshotFile(file);
    const reader = new FileReader();
    reader.onload = () => setScreenshotDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const getPayloadForTab = (): ProofPayload | null => {
    if (tab === "screenshot") {
      if (!screenshotDataUrl) return null;
      const desc = screenshotDescription.trim();
      if (desc.length < MIN_DESCRIPTION_LENGTH) return null;
      return {
        proofType: "screenshot",
        proofUrl: screenshotDataUrl,
        proofText: desc,
      };
    }
    if (tab === "text") {
      const trimmed = textValue.trim();
      if (trimmed.length < MIN_TEXT_TAB_LENGTH) return null;
      return {
        proofType: "text",
        proofUrl: null,
        proofText: trimmed,
      };
    }
    if (tab === "link") {
      const trimmed = linkValue.trim();
      if (!URL_REGEX.test(trimmed)) return null;
      const desc = linkDescription.trim();
      if (desc.length < MIN_DESCRIPTION_LENGTH) return null;
      return {
        proofType: "link",
        proofUrl: trimmed,
        proofText: desc,
      };
    }
    return null;
  };

  const performSubmit = async (validationSkipped: boolean) => {
    const base = getPayloadForTab();
    if (!base) return;
    setError(null);
    setSubmitting(true);
    setLoadingMessage(validationSkipped ? "Submitting..." : "Validating your proof...");

    try {
      if (!validationSkipped) {
        const result = await validateProof({
          taskDescription,
          proofType: base.proofType as "screenshot" | "text" | "link",
          proofImage: base.proofType === "screenshot" ? base.proofUrl : null,
          proofDescription: base.proofText ?? "",
          proofUrl: base.proofType === "link" ? base.proofUrl : null,
        });
        if (!result.valid) {
          setRejectionCount((c) => c + 1);
          setRejectionReason(result.reason);
          setError(null);
          setSubmitting(false);
          setLoadingMessage(null);
          return;
        }
      }

      setLoadingMessage("Submitting...");

      let proofUrl = base.proofUrl;
      if (base.proofType === "screenshot" && base.proofUrl) {
        const uploaded = await uploadProofImage(base.proofUrl);
        if (uploaded) proofUrl = uploaded;
      }

      const payload: ProofPayload = {
        ...base,
        proofUrl,
        proofValidationStatus: validationSkipped ? "validation_skipped" : "validated",
      };
      await onSubmit(payload);
      onOpenChange(false);
      resetForm();
    } catch {
      setError("Failed to submit proof.");
    } finally {
      setSubmitting(false);
      setLoadingMessage(null);
    }
  };

  const handleSubmit = () => performSubmit(false);
  const handleSkipValidation = () => {
    setShowSkipConfirm(false);
    void performSubmit(true);
  };
  const handleOverrideValidation = () => {
    setShowOverrideConfirm(false);
    void performSubmit(true);
  };

  const resetForm = () => {
    setTab("screenshot");
    setScreenshotDataUrl(null);
    setScreenshotFile(null);
    setScreenshotDescription("");
    setTextValue("");
    setLinkValue("");
    setLinkDescription("");
    setError(null);
    setRejectionCount(0);
    setRejectionReason(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const dismissRejection = () => setRejectionReason(null);

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm();
    onOpenChange(next);
  };

  const isScreenshotValid = !!screenshotDataUrl && screenshotDescription.trim().length >= MIN_DESCRIPTION_LENGTH;
  const isTextValid = textValue.trim().length >= MIN_TEXT_TAB_LENGTH;
  const isLinkValid = URL_REGEX.test(linkValue.trim()) && linkDescription.trim().length >= MIN_DESCRIPTION_LENGTH;

  const isSubmitDisabled =
    (tab === "screenshot" && !isScreenshotValid) ||
    (tab === "text" && !isTextValid) ||
    (tab === "link" && !isLinkValid) ||
    submitting;

  const renderSkipLink = () => (
    <button
      type="button"
      onClick={() => setShowSkipConfirm(true)}
      className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 underline underline-offset-2 mt-1"
    >
      My proof is valid, skip check
    </button>
  );

  const renderOverrideLink = () =>
    canOverride ? (
      <button
        type="button"
        onClick={() => setShowOverrideConfirm(true)}
        className="text-xs text-amber-600 dark:text-amber-400 hover:underline underline-offset-2 mt-1"
      >
        Override validation and submit anyway
      </button>
    ) : null;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          {rejectionReason ? (
            <>
              <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 space-y-4">
                <div>
                  <h3 className="font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-2">
                    <span aria-hidden>⚠️</span> Proof Not Validated
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Your submission doesn&apos;t clearly demonstrate task completion.
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">AI Feedback:</p>
                  <blockquote className="text-sm text-slate-600 dark:text-slate-400 border-l-2 border-amber-400 dark:border-amber-600 pl-3 py-0.5 italic">
                    &ldquo;{rejectionReason}&rdquo;
                  </blockquote>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Tips for better proof:</p>
                  <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-0.5 list-disc list-inside">
                    <li>Be specific about what you did</li>
                    <li>Show actual work, not blank screens</li>
                    <li>Explain your process and results</li>
                  </ul>
                </div>
              </div>
              {showRejectionBanner && (
                <p className="text-sm text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/30 rounded-md px-3 py-2">
                  Having trouble? You can skip validation, but this reduces accountability.
                </p>
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={dismissRejection} className="flex-1">
                  Try Again
                </Button>
                <Button onClick={() => setShowSkipConfirm(true)} className="flex-1">
                  Skip Validation
                </Button>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Submit proof</DialogTitle>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-normal">
                  {taskDescription}
                </p>
              </DialogHeader>
              <Tabs
            value={tab}
            onValueChange={(v) => {
              setTab(v as TabValue);
              setError(null);
              setRejectionReason(null);
            }}
          >
            <TabsList className={`grid w-full ${isAppTask ? "grid-cols-2" : "grid-cols-3"}`}>
              <TabsTrigger value="screenshot" className="gap-1.5">
                <Image className="w-4 h-4" />
                Screenshot
              </TabsTrigger>
              {!isAppTask && (
                <TabsTrigger value="text" className="gap-1.5">
                  <FileText className="w-4 h-4" />
                  Text
                </TabsTrigger>
              )}
              <TabsTrigger value="link" className="gap-1.5">
                <LinkIcon className="w-4 h-4" />
                Link
              </TabsTrigger>
            </TabsList>
            <TabsContent value="screenshot" className="space-y-4 mt-4">
              {hasAppLink && (
                <p className="text-xs text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 px-3 py-2 rounded-md">
                  Screenshot from Content Flywheel
                </p>
              )}
              <div>
                <Label className="text-sm">Upload image</Label>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="mt-1"
                  onChange={handleFileChange}
                />
              </div>
              {screenshotDataUrl && (
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-900/50">
                  <img
                    src={screenshotDataUrl}
                    alt="Preview"
                    className="max-h-48 w-full object-contain"
                  />
                </div>
              )}
              <div>
                <Label className="text-sm">Describe what you completed (required)</Label>
                <Textarea
                  placeholder="Explain how this screenshot proves you completed the task. Be specific about what's shown..."
                  value={screenshotDescription}
                  onChange={(e) => setScreenshotDescription(e.target.value)}
                  className="mt-1 min-h-[80px]"
                  maxLength={2000}
                />
                <p className={`text-xs mt-1 ${screenshotDescription.trim().length < MIN_DESCRIPTION_LENGTH ? "text-amber-600 dark:text-amber-400" : "text-slate-500 dark:text-slate-400"}`}>
                  {screenshotDescription.trim().length}/{MIN_DESCRIPTION_LENGTH} minimum
                </p>
                {screenshotDescription.trim().length > 0 && screenshotDescription.trim().length < MIN_DESCRIPTION_LENGTH && (
                  <p className="text-xs text-red-500 mt-0.5">Add at least {MIN_DESCRIPTION_LENGTH - screenshotDescription.trim().length} more characters</p>
                )}
              </div>
              <div>
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitDisabled}
                  className="w-full gap-2"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {loadingMessage || "Submit proof"}
                </Button>
                <div className="flex flex-col items-center">
                  {renderSkipLink()}
                  {renderOverrideLink()}
                </div>
              </div>
            </TabsContent>
            <TabsContent value="text" className="space-y-4 mt-4">
              <div>
                <Label className="text-sm">Describe what you completed</Label>
                <Textarea
                  placeholder="Describe in detail what you completed, what you learned, and your results..."
                  value={textValue}
                  onChange={(e) => setTextValue(e.target.value)}
                  className="mt-1 min-h-[120px]"
                  maxLength={2000}
                />
                <p className={`text-xs mt-1 ${textValue.trim().length < MIN_TEXT_TAB_LENGTH ? "text-amber-600 dark:text-amber-400" : "text-slate-500 dark:text-slate-400"}`}>
                  {textValue.trim().length}/{MIN_TEXT_TAB_LENGTH} minimum
                </p>
              </div>
              <div>
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitDisabled}
                  className="w-full gap-2"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {loadingMessage || "Submit proof"}
                </Button>
                <div className="flex flex-col items-center">
                  {renderSkipLink()}
                  {renderOverrideLink()}
                </div>
              </div>
            </TabsContent>
            <TabsContent value="link" className="space-y-4 mt-4">
              <div>
                <Label className="text-sm">Paste link to your work</Label>
                <Input
                  type="url"
                  placeholder="https://..."
                  value={linkValue}
                  onChange={(e) => setLinkValue(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm">Explain what this link shows (required)</Label>
                <Textarea
                  placeholder="Describe what's at this link and how it proves task completion..."
                  value={linkDescription}
                  onChange={(e) => setLinkDescription(e.target.value)}
                  className="mt-1 min-h-[80px]"
                  maxLength={2000}
                />
                <p className={`text-xs mt-1 ${linkDescription.trim().length < MIN_DESCRIPTION_LENGTH ? "text-amber-600 dark:text-amber-400" : "text-slate-500 dark:text-slate-400"}`}>
                  {linkDescription.trim().length}/{MIN_DESCRIPTION_LENGTH} minimum
                </p>
              </div>
              <div>
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitDisabled}
                  className="w-full gap-2"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {loadingMessage || "Submit proof"}
                </Button>
                <div className="flex flex-col items-center">
                  {renderSkipLink()}
                  {renderOverrideLink()}
                </div>
              </div>
            </TabsContent>
          </Tabs>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-2 whitespace-pre-line">{error}</p>
          )}
          {isAppTask && tab === "text" && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              App tasks require a screenshot or link. Use the Screenshot or Link tab.
            </p>
          )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showSkipConfirm} onOpenChange={setShowSkipConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Skip validation?</AlertDialogTitle>
            <AlertDialogDescription>
              Skipping validation means you&apos;re only accountable to yourself. Your proof will be accepted without AI review.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSkipValidation}>Skip check</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showOverrideConfirm} onOpenChange={setShowOverrideConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Override validation?</AlertDialogTitle>
            <AlertDialogDescription>
              Your proof was rejected {rejectionCount} time{rejectionCount > 1 ? "s" : ""}. You can submit anyway — you&apos;ll be accountable only to yourself.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleOverrideValidation}>Override and submit</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
