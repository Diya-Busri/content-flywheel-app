"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  Send,
  Sparkles,
  MessageCircleQuestion,
  Lightbulb,
  Wrench,
  ArrowRight,
  RotateCcw,
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  X,
  ImageIcon,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  useAcademyCheckpointChat,
  fetchGeneratedVisual,
  type CheckpointClientMessage,
} from "@/hooks/useAcademyCheckpointChat";
import type { CheckpointHelpOption } from "@/db/schema/academy-checkpoints-schema";
import { resolveApplyToolCta } from "@/lib/academy-checkpoint-routing";
import type { UnderstandingAchievement } from "@/lib/academy-checkpoint-achievements";
import { HELP_OPTION_LABELS, stripBasicMarkdown, extractApplicationOutput } from "@/lib/academy-checkpoint-prompt";
import {
  openCheckpointAction,
  confirmUnderstandingAction,
  skipCheckpointAction,
  logHelpOptionSelectedAction,
  logNextLessonOpenedAction,
  saveApplicationOutputToMemoryAction,
} from "@/actions/academy-checkpoint-actions";
import { cn } from "@/lib/utils";

interface QuickAction {
  key: "understand" | CheckpointHelpOption;
  label: string;
  icon: React.ReactNode;
}

const QUICK_ACTIONS: QuickAction[] = [
  { key: "understand", label: "Yes, I understand", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  { key: "explain_simpler", label: "Explain it more simply", icon: <Sparkles className="h-3.5 w-3.5" /> },
  { key: "example", label: "Show me an example", icon: <Lightbulb className="h-3.5 w-3.5" /> },
  { key: "question", label: "I have a question", icon: <MessageCircleQuestion className="h-3.5 w-3.5" /> },
  { key: "apply", label: "Help me apply this", icon: <Wrench className="h-3.5 w-3.5" /> },
];

interface ApplicationOutput {
  text: string;
  /** One-sentence pointer to a real Content Flywheel tool, if the model gave one — see NEXT STEP: in the prompt. */
  nextStep?: string;
  helpOption?: string;
  generatedAt?: string;
}

export interface UnderstandingCheckPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lessonId: string;
  lessonTitle: string;
  applyToolKey?: string | null;
  /** Called once the panel is done (understood, skipped, or closed) so the parent can reveal its existing next-lesson UI. */
  onDone: () => void;
}

export function UnderstandingCheckPanel({ open, onOpenChange, lessonId, lessonTitle, applyToolKey, onDone }: UnderstandingCheckPanelProps) {
  const isMobile = useIsMobile();
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [understandingConfirmed, setUnderstandingConfirmed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [applicationOutput, setApplicationOutput] = useState<ApplicationOutput | null>(null);
  const [activeHelpOption, setActiveHelpOption] = useState<CheckpointHelpOption>("question");
  const [showQuestionInput, setShowQuestionInput] = useState(false);
  const [questionInput, setQuestionInput] = useState("");
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const [unlockedAchievement, setUnlockedAchievement] = useState<UnderstandingAchievement | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasLoadedRef = useRef(false);

  const { messages, setMessages, isLoading, error, send, retry, clearError, generateVisual, struggling, setStruggling } =
    useAcademyCheckpointChat({
      lessonId,
      onSendFailed: (text) => setQuestionInput(text), // preserve the user's typed message if sending fails
    });

  // Opt-in visual for the application-output card (outside the message list, so it
  // gets its own small piece of state rather than reusing the per-message hook state).
  const [outputVisual, setOutputVisual] = useState<{ url?: string; loading?: boolean; error?: string }>({});
  const handleVisualizeOutput = useCallback(() => {
    if (!applicationOutput || outputVisual.loading) return;
    setOutputVisual({ loading: true });
    fetchGeneratedVisual(`Simple, clean educational diagram illustrating: ${applicationOutput.text}`).then(({ url, error: err }) => {
      setOutputVisual(url ? { url } : { error: err });
    });
  }, [applicationOutput, outputVisual.loading]);

  // Fetch/create + hydrate the checkpoint every time the panel opens — this is what
  // makes "reopen previous conversations" and "resume where you stopped" work, and
  // is a pure DB read/write (no AI call).
  useEffect(() => {
    if (!open) {
      hasLoadedRef.current = false;
      return;
    }
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    setLoadingInitial(true);
    setLoadError(null);
    openCheckpointAction(lessonId)
      .then((res) => {
        if (!res.isSuccess || !res.data) {
          setLoadError(res.message || "Couldn't load this lesson's checkpoint.");
          return;
        }
        setUnderstandingConfirmed(res.data.checkpoint.understandingConfirmed);
        const output = res.data.checkpoint.applicationOutput as ApplicationOutput | null;
        if (output?.text) setApplicationOutput(output);
        setSaved(!!res.data.checkpoint.applicationOutputSavedAt);
        if (res.data.struggling) setStruggling(true);
        setMessages(
          res.data.messages.map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
            helpOption: (m.helpOption as CheckpointHelpOption) ?? null,
            imageUrl: m.imageUrl ?? undefined,
          }))
        );
      })
      .catch(() => setLoadError("Couldn't load this lesson's checkpoint."))
      .finally(() => setLoadingInitial(false));
  }, [open, lessonId, setMessages, setStruggling]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (showQuestionInput) textareaRef.current?.focus();
  }, [showQuestionInput]);

  // Pick up newly generated application output from the live message stream too
  // (in addition to what's hydrated from the server on open).
  useEffect(() => {
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant" && !m.pending);
    if (!lastAssistant || lastAssistant.helpOption !== "apply") return;
    const output = extractApplicationOutput(lastAssistant.content);
    if (output) setApplicationOutput({ text: output.text, nextStep: output.nextStep, helpOption: "apply" });
  }, [messages]);

  const handleQuickAction = useCallback(
    (key: QuickAction["key"]) => {
      if (isLoading || confirming) return;

      if (key === "understand") {
        setConfirming(true);
        confirmUnderstandingAction(lessonId)
          .then((res) => {
            if (res.isSuccess) {
              setUnderstandingConfirmed(true);
              if (res.data?.unlockedAchievement) setUnlockedAchievement(res.data.unlockedAchievement);
            }
          })
          .finally(() => setConfirming(false));
        return;
      }

      void logHelpOptionSelectedAction(lessonId, key);
      setActiveHelpOption(key);

      if (key === "question") {
        setShowQuestionInput(true);
        return; // no AI call — just reveals + focuses the free-text input
      }

      // "explain_simpler" / "example" / "apply" — structured, immediate AI request.
      // displayText is only for the optimistic UI bubble; the server independently
      // derives the same label from helpOption, never trusting client-sent text for behaviour.
      void send(key, { displayText: HELP_OPTION_LABELS[key] });
    },
    [isLoading, confirming, lessonId, send]
  );

  const handleSendQuestion = useCallback(() => {
    const text = questionInput.trim();
    if (!text || isLoading) return;
    setQuestionInput("");
    void send(activeHelpOption, { message: text });
  }, [questionInput, isLoading, activeHelpOption, send]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendQuestion();
    }
  };

  const handleSkip = useCallback(() => {
    setSkipping(true);
    skipCheckpointAction(lessonId).finally(() => {
      setSkipping(false);
      onOpenChange(false);
      onDone();
    });
  }, [lessonId, onOpenChange, onDone]);

  const handleContinue = useCallback(() => {
    void logNextLessonOpenedAction(lessonId);
    onOpenChange(false);
    onDone();
  }, [lessonId, onOpenChange, onDone]);

  const handleSaveOutput = useCallback(() => {
    setSaving(true);
    saveApplicationOutputToMemoryAction(lessonId)
      .then((res) => {
        if (res.isSuccess) setSaved(true);
      })
      .finally(() => setSaving(false));
  }, [lessonId]);

  // Closing via the X button / backdrop / Escape counts as "skip for now" if the
  // user hasn't confirmed understanding yet — but never overwrites a confirmed state.
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next && !understandingConfirmed) {
        void skipCheckpointAction(lessonId);
      }
      onOpenChange(next);
      if (!next) onDone();
    },
    [understandingConfirmed, lessonId, onOpenChange, onDone]
  );

  const toolCta = applicationOutput ? resolveApplyToolCta(applyToolKey, { promptSeed: applicationOutput.text.slice(0, 200) }) : null;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          "flex flex-col gap-0 p-0",
          isMobile ? "h-[85dvh] rounded-t-2xl" : "w-full sm:max-w-lg"
        )}
        aria-label="Understanding Check"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-3 border-b shrink-0">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-500 mb-0.5">Understanding Check</p>
            <p className="text-sm text-muted-foreground line-clamp-2">{lessonTitle}</p>
          </div>
        </div>

        {loadingInitial ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : loadError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-sm text-muted-foreground">{loadError}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { hasLoadedRef.current = false; setLoadingInitial(true); setLoadError(null); }}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Retry
              </Button>
              <Button size="sm" onClick={handleSkip}>
                Continue anyway
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Intro message + quick actions */}
            <div className="px-4 py-3 border-b shrink-0 space-y-3">
              {unlockedAchievement && (
                <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                  <span className="text-2xl">{unlockedAchievement.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Achievement unlocked!</p>
                    <p className="text-xs text-muted-foreground">{unlockedAchievement.label}</p>
                  </div>
                </div>
              )}
              {understandingConfirmed ? (
                <p className="text-sm text-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  You confirmed you understand this lesson. Continue whenever you&apos;re ready.
                </p>
              ) : (
                <p className="text-sm text-foreground">
                  You&apos;ve completed <span className="font-medium">{lessonTitle}</span>. Do you understand it, or would you like some
                  extra help before continuing?
                </p>
              )}
              {struggling && !understandingConfirmed && !nudgeDismissed && (
                <div className="flex items-start justify-between gap-2 rounded-lg border border-blue-500/30 bg-blue-500/5 px-3 py-2">
                  <p className="text-xs text-blue-700 dark:text-blue-300 leading-snug">
                    This one seems tricky — no rush. If you&apos;d rather talk it through with a real person,{" "}
                    <a href="/dashboard/messages/support" className="font-medium underline underline-offset-2">
                      contact support
                    </a>
                    .
                  </p>
                  <button
                    type="button"
                    onClick={() => setNudgeDismissed(true)}
                    className="shrink-0 text-blue-700/60 hover:text-blue-700 dark:text-blue-300/60 dark:hover:text-blue-300"
                    aria-label="Dismiss"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              {!understandingConfirmed && (
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_ACTIONS.map((action) => (
                    <button
                      key={action.key}
                      type="button"
                      onClick={() => handleQuickAction(action.key)}
                      disabled={isLoading || confirming}
                      aria-busy={action.key === "understand" ? confirming : isLoading && activeHelpOption === action.key}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                        action.key === "understand"
                          ? "border-green-500/40 bg-green-500/10 text-green-600 hover:bg-green-500/20"
                          : "border-orange-500/30 bg-orange-500/[0.06] text-orange-600 hover:bg-orange-500/15",
                        "disabled:opacity-50 disabled:pointer-events-none"
                      )}
                    >
                      {action.key === "understand" && confirming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : action.icon}
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Conversation */}
            <ScrollArea className="flex-1 min-h-0">
              <div className="px-4 py-4 space-y-3">
                {messages.length === 0 && (
                  <p className="text-center text-xs text-muted-foreground py-6">
                    Pick an option above, or ask a question about this lesson.
                  </p>
                )}
                {messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    onVisualize={() =>
                      generateVisual(msg.id, `Simple, clean educational diagram illustrating: ${stripBasicMarkdown(msg.content)}`)
                    }
                  />
                ))}

                {error && (
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2">
                    <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
                    <Button size="sm" variant="outline" onClick={retry} className="h-7 shrink-0 text-xs">
                      <RotateCcw className="mr-1 h-3 w-3" /> Retry
                    </Button>
                  </div>
                )}

                {applicationOutput && (
                  <div className="rounded-xl border-2 border-orange-500/30 bg-orange-500/[0.04] p-4 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-orange-500">Your result</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{stripBasicMarkdown(applicationOutput.text)}</p>
                    {applicationOutput.nextStep && (
                      <div className="flex items-start gap-1.5 rounded-lg bg-orange-500/10 px-3 py-2">
                        <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-500" />
                        <p className="text-xs font-medium text-orange-700 dark:text-orange-300 leading-snug">
                          {stripBasicMarkdown(applicationOutput.nextStep)}
                        </p>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button size="sm" variant="outline" onClick={handleSaveOutput} disabled={saving || saved}>
                        {saved ? (
                          <>
                            <BookmarkCheck className="mr-1.5 h-3.5 w-3.5 text-green-500" /> Saved
                          </>
                        ) : saving ? (
                          <>
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Saving…
                          </>
                        ) : (
                          <>
                            <Bookmark className="mr-1.5 h-3.5 w-3.5" /> Save to Business Brain
                          </>
                        )}
                      </Button>
                      {toolCta && (
                        <Button size="sm" asChild className="bg-orange-500 hover:bg-orange-600">
                          <a href={toolCta.href}>
                            {toolCta.label} <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                          </a>
                        </Button>
                      )}
                      {!outputVisual.url && (
                        <Button size="sm" variant="outline" onClick={handleVisualizeOutput} disabled={outputVisual.loading}>
                          {outputVisual.loading ? (
                            <>
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Generating visual…
                            </>
                          ) : (
                            <>
                              <ImageIcon className="mr-1.5 h-3.5 w-3.5" /> Add a visual
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                    {outputVisual.url && (
                      <div className="rounded-lg overflow-hidden border bg-background max-w-[280px]">
                        <img src={outputVisual.url} alt="Visual explanation of your result" className="w-full h-auto block" />
                      </div>
                    )}
                    {outputVisual.error && <p className="text-xs text-red-600 dark:text-red-400">{outputVisual.error}</p>}
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            </ScrollArea>

            {/* Free-text input — hidden on the calm initial screen, but available as soon as
                either the user asks for it via "I have a question" or any quick action has
                produced a reply, so they can always follow up in their own words. */}
            {(showQuestionInput || messages.length > 0) && !understandingConfirmed && (
              <div className="px-4 py-3 border-t shrink-0">
                <div className="flex gap-2 items-end">
                  <Textarea
                    ref={textareaRef}
                    value={questionInput}
                    onChange={(e) => setQuestionInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask anything about this lesson…"
                    rows={1}
                    className="min-h-[38px] max-h-[120px] resize-none text-sm"
                    disabled={isLoading}
                  />
                  <Button
                    type="button"
                    size="icon"
                    onClick={handleSendQuestion}
                    disabled={!questionInput.trim() || isLoading}
                    className="h-9 w-9 shrink-0 bg-orange-500 hover:bg-orange-600"
                    aria-label="Send"
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}

            {/* Footer — Skip / Continue are always reachable, never blocked by AI state. */}
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-t shrink-0 pb-[calc(env(safe-area-inset-bottom,0px)+12px)]">
              {understandingConfirmed ? (
                <Button onClick={handleContinue} className="w-full bg-orange-500 hover:bg-orange-600">
                  Continue to next lesson <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              ) : (
                <>
                  <Button variant="ghost" size="sm" onClick={handleSkip} disabled={skipping}>
                    {skipping ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <X className="mr-1.5 h-3.5 w-3.5" />}
                    Skip for now
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleContinue}>
                    Continue anyway <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function MessageBubble({ msg, onVisualize }: { msg: CheckpointClientMessage; onVisualize: () => void }) {
  // Opt-in visual is only offered for a completed assistant reply — never auto-generated,
  // never on the user's own bubble, so it never adds latency/cost to a normal answer.
  const canVisualize = msg.role === "assistant" && !msg.pending && !!msg.content.trim();

  return (
    <div className={cn("flex flex-col", msg.role === "user" ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap",
          msg.role === "user"
            ? msg.failed
              ? "bg-red-500/10 text-red-600 border border-red-500/30"
              : "bg-orange-500 text-white"
            : "bg-muted text-foreground"
        )}
      >
        {msg.content
          ? msg.role === "assistant"
            ? stripBasicMarkdown(msg.content)
            : msg.content
          : msg.pending
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : ""}
      </div>

      {canVisualize && !msg.imageUrl && (
        <button
          type="button"
          onClick={onVisualize}
          disabled={msg.visualLoading}
          className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-orange-300 disabled:opacity-60"
        >
          {msg.visualLoading ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" /> Generating visual…
            </>
          ) : (
            <>
              <ImageIcon className="h-3 w-3" /> Add a visual
            </>
          )}
        </button>
      )}
      {msg.visualError && <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{msg.visualError}</p>}
      {msg.imageUrl && (
        <div className="mt-1.5 max-w-[280px] overflow-hidden rounded-lg border bg-background">
          <img src={msg.imageUrl} alt="Visual explanation" className="block h-auto w-full" />
        </div>
      )}
    </div>
  );
}
