"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, Sparkles, ExternalLink, RotateCcw } from "lucide-react";
import { useChatCoach } from "@/hooks/useChatCoach";
import { getTaskActions, type TaskContext } from "@/lib/goals/task-ai-actions";
import { getCategoryConfig } from "@/lib/goals/categories";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  task: {
    id: string;
    taskDescription: string;
    category?: string | null;
    estimatedDuration?: number;
    howToComplete?: string;
  };
  goal: {
    id: string;
    title: string;
    currentDay: number;
    totalDays: number;
  };
  completedTaskCount: number;
  totalTaskCount: number;
}

export function TaskAIPanel({ open, onClose, task, goal, completedTaskCount, totalTaskCount }: Props) {
  const pathname = usePathname();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const taskContext: TaskContext = {
    taskDescription: task.taskDescription,
    goalTitle: goal.title,
    category: task.category,
    currentDay: goal.currentDay,
    totalDays: goal.totalDays,
    completedCount: completedTaskCount,
    totalCount: totalTaskCount,
  };

  const { messages, sendMessage, isLoading, clearChat } = useChatCoach(pathname, {
    coachMode: "goals",
    taskContext,
  });

  const actions = getTaskActions(task.category);
  const catConfig = task.category ? getCategoryConfig(task.category as Parameters<typeof getCategoryConfig>[0]) : null;

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Reset chat when a new task is opened
  useEffect(() => {
    if (open) {
      clearChat();
      setInput("");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id, open]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    sendMessage(text);
  }, [input, isLoading, sendMessage]);

  const handleAction = useCallback(
    (prompt: string) => {
      if (isLoading) return;
      sendMessage(prompt);
    },
    [isLoading, sendMessage]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const coachUrl = `/dashboard/ai-coach`;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg p-0 flex flex-col gap-0 bg-slate-950 border-slate-800"
      >
        {/* Header */}
        <SheetHeader className="px-4 pt-4 pb-3 border-b border-slate-800 shrink-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 text-orange-400 shrink-0" />
                <SheetTitle className="text-sm font-semibold text-white">AI Execution Coach</SheetTitle>
              </div>
              <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                {task.taskDescription}
              </p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {catConfig && (
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${catConfig.badgeClass}`}>
                    {catConfig.emoji} {catConfig.label}
                  </span>
                )}
                <span className="text-[10px] text-slate-500">
                  {goal.title} · Day {goal.currentDay}/{goal.totalDays}
                </span>
                {task.estimatedDuration ? (
                  <span className="text-[10px] text-slate-500">{task.estimatedDuration}min</span>
                ) : null}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="shrink-0 text-slate-400 hover:text-white text-xs gap-1"
            >
              <a href={coachUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3 h-3" />
                Full coach
              </a>
            </Button>
          </div>
        </SheetHeader>

        {/* Quick action chips */}
        <div className="px-4 py-3 border-b border-slate-800 shrink-0">
          <p className="text-[10px] uppercase tracking-wide text-slate-500 font-medium mb-2">
            Quick actions
          </p>
          <div className="flex flex-wrap gap-1.5">
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                disabled={isLoading}
                onClick={() => handleAction(action.prompt(taskContext))}
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                  "border-slate-700 bg-slate-900 text-slate-300 hover:border-orange-500 hover:text-orange-300 hover:bg-orange-950/30",
                  "disabled:opacity-40 disabled:cursor-not-allowed"
                )}
              >
                <span>{action.emoji}</span>
                {action.label}
              </button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-4 py-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm text-slate-500">
                  Pick a quick action above or ask anything about this task.
                </p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "flex",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap",
                    msg.role === "user"
                      ? "bg-orange-500 text-white rounded-br-sm"
                      : "bg-slate-800 text-slate-200 rounded-bl-sm"
                  )}
                >
                  {msg.content || (
                    <span className="flex items-center gap-1 text-slate-400">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Thinking…
                    </span>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="px-4 py-3 border-t border-slate-800 shrink-0">
          <div className="flex gap-2 items-end">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about this task…"
              rows={1}
              className="resize-none bg-slate-900 border-slate-700 text-slate-200 placeholder:text-slate-500 text-sm min-h-[38px] max-h-[120px] focus-visible:ring-orange-500"
              style={{ height: "auto", overflowY: "auto" }}
              onInput={(e) => {
                const t = e.currentTarget;
                t.style.height = "auto";
                t.style.height = `${Math.min(t.scrollHeight, 120)}px`;
              }}
            />
            <div className="flex gap-1 shrink-0">
              {messages.length > 0 && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={clearChat}
                  className="h-9 w-9 text-slate-500 hover:text-slate-300"
                  title="Clear chat"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              )}
              <Button
                type="button"
                size="icon"
                disabled={!input.trim() || isLoading}
                onClick={handleSend}
                className="h-9 w-9 bg-orange-500 hover:bg-orange-600 text-white"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
          <p className="text-[10px] text-slate-600 mt-1.5 text-center">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
