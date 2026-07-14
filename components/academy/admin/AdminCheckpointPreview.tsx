"use client";

import { useCallback, useState } from "react";
import { Eye, Loader2, Send, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { CheckpointHelpOption } from "@/db/schema/academy-checkpoints-schema";
import { HELP_OPTION_LABELS, stripBasicMarkdown } from "@/lib/academy-checkpoint-prompt";
import { cn } from "@/lib/utils";

interface PreviewMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
}

const PREVIEW_ACTIONS: { key: CheckpointHelpOption; label: string }[] = [
  { key: "explain_simpler", label: "Explain it more simply" },
  { key: "example", label: "Show me an example" },
  { key: "question", label: "I have a question" },
  { key: "apply", label: "Help me apply this" },
];

let idCounter = 0;
function nextId() {
  idCounter += 1;
  return `preview-${idCounter}`;
}

export interface AdminCheckpointPreviewProps {
  /** Current in-editor DRAFT values — deliberately not the saved lesson row, so admins can test before saving. */
  lessonTitle: string;
  lessonContent: string;
  learningObjectives: string;
  keyConcepts: string;
}

/**
 * Lets an admin exercise the Understanding Check assistant against whatever is
 * currently in the lesson editor — including unsaved changes — without
 * creating a real checkpoint record, without affecting analytics, and without
 * needing to "complete" the lesson as a learner. Talks to a dedicated
 * admin-only, non-persisting endpoint (/api/academy/admin/checkpoint-preview)
 * rather than the real checkpoint chat route.
 */
export function AdminCheckpointPreview({ lessonTitle, lessonContent, learningObjectives, keyConcepts }: AdminCheckpointPreviewProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<PreviewMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questionInput, setQuestionInput] = useState("");

  const send = useCallback(
    async (helpOption: CheckpointHelpOption, message?: string) => {
      if (isLoading) return;
      setIsLoading(true);
      setError(null);

      const displayText = message ?? HELP_OPTION_LABELS[helpOption];
      const history = messages.filter((m) => !m.pending).map((m) => ({ role: m.role, content: m.content }));
      const userMsg: PreviewMessage = { id: nextId(), role: "user", content: displayText };
      const assistantMsg: PreviewMessage = { id: nextId(), role: "assistant", content: "", pending: true };
      setMessages((prev) => [...prev, userMsg, assistantMsg]);

      try {
        const res = await fetch("/api/academy/admin/checkpoint-preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            helpOption,
            message,
            lessonTitle,
            lessonContent,
            learningObjectives,
            keyConcepts,
            history,
          }),
        });
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error((errBody as { error?: string }).error || `Request failed (${res.status})`);
        }
        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response stream");
        const decoder = new TextDecoder();
        let accumulated = "";
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split("\n\n");
          buffer = chunks.pop() ?? "";
          for (const chunk of chunks) {
            if (!chunk.startsWith("data: ")) continue;
            const payload = chunk.slice(6);
            if (payload === "[DONE]") continue;
            try {
              const parsed = JSON.parse(payload) as { content?: string };
              if (parsed.content) {
                accumulated += parsed.content;
                setMessages((prev) => {
                  const next = [...prev];
                  const idx = next.findIndex((m) => m.id === assistantMsg.id);
                  if (idx !== -1) next[idx] = { ...next[idx], content: accumulated, pending: true };
                  return next;
                });
              }
            } catch {
              // skip malformed chunk
            }
          }
        }
        setMessages((prev) => {
          const next = [...prev];
          const idx = next.findIndex((m) => m.id === assistantMsg.id);
          if (idx !== -1) next[idx] = { ...next[idx], content: accumulated || "No response received.", pending: false };
          return next;
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
        setMessages((prev) => prev.filter((m) => m.id !== assistantMsg.id && m.id !== userMsg.id));
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, messages, lessonTitle, lessonContent, learningObjectives, keyConcepts]
  );

  const handleSendQuestion = () => {
    const text = questionInput.trim();
    if (!text || isLoading) return;
    setQuestionInput("");
    void send("question", text);
  };

  const handleReset = () => {
    setMessages([]);
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Eye className="mr-1.5 h-3.5 w-3.5" /> Preview Understanding Check
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Understanding Check preview</DialogTitle>
          <DialogDescription>
            Tests against your current unsaved draft — nothing here is saved, logged to analytics, or shown to learners. No learner
            personalisation is applied.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5">
          {PREVIEW_ACTIONS.map((action) => (
            <button
              key={action.key}
              type="button"
              onClick={() => void send(action.key)}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/30 bg-orange-500/[0.06] px-3 py-1.5 text-xs font-medium text-orange-600 transition-colors hover:bg-orange-500/15 disabled:opacity-50 disabled:pointer-events-none"
            >
              {action.label}
            </button>
          ))}
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleReset}
              disabled={isLoading}
              className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          )}
        </div>

        <div className="max-h-[40vh] min-h-[80px] overflow-y-auto space-y-2 rounded-lg border bg-muted/30 p-3">
          {messages.length === 0 && (
            <p className="py-4 text-center text-xs text-muted-foreground">Pick an option above to see how the assistant responds.</p>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-1.5 text-sm leading-relaxed",
                  msg.role === "user" ? "bg-orange-500 text-white" : "bg-background border"
                )}
              >
                {msg.content ? (msg.role === "assistant" ? stripBasicMarkdown(msg.content) : msg.content) : msg.pending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  ""
                )}
              </div>
            </div>
          ))}
        </div>

        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex items-end gap-2">
          <Textarea
            value={questionInput}
            onChange={(e) => setQuestionInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendQuestion();
              }
            }}
            placeholder="Ask a test question…"
            rows={1}
            className="min-h-[38px] max-h-[100px] resize-none text-sm"
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
      </DialogContent>
    </Dialog>
  );
}
