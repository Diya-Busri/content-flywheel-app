"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { Send, Loader2, Sparkles, CheckCircle2, Paintbrush } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChatCoach } from "@/hooks/useChatCoach";
import { cn } from "@/lib/utils";

type Section = { id: string; title: string; content: string; order: number; imageUrl?: string };

type AddSectionAction = { type: "add_section"; title: string; content: string };
type UpdateSectionAction = { type: "update_section"; sectionId: string; title?: string; content: string };
type ReplaceAllAction = { type: "replace_all"; sections: { title: string; content: string }[] };
type Action = AddSectionAction | UpdateSectionAction | ReplaceAllAction;

export type DesignCommand = {
  type: "all_text_color" | "heading_color" | "body_color" | "accent_color" | "template";
  value: string;
};

type LocalMessage = {
  role: "user" | "assistant";
  content: string;
  applied?: { count: number; titles: string[] };
  designApplied?: boolean;
};

const WRITE_INTENT_RE =
  /\b(write|create|add|generate|fill|update|rewrite|replace|plan|structure|build|draft|make)\b.{0,50}\b(page|section|chapter|content|text|intro|introduction|outline|pages|sections|chapters|structure|layout|book|guide|template|workbook|worksheet|journal|planner|checklist|product)\b/i;

const DESIGN_INTENT_RE =
  /\b(change|make|set|turn|convert|switch)\b.{0,60}\b(text|colour|color|font|background|theme|dark|light|accent|heading|title|body)\b/i;

const STARTER_CHIPS = [
  "Write an intro page",
  "Add 3 pages about this topic",
  "Plan out my whole product",
  "Rewrite page 1",
  "Make all text black",
  "Give me a TikTok hook",
];

// Named colour map
const COLOR_NAMES: Record<string, string> = {
  black: "#000000", white: "#ffffff", red: "#dc2626", blue: "#2563eb",
  green: "#16a34a", orange: "#f97316", purple: "#7c3aed", pink: "#ec4899",
  teal: "#0d9488", gray: "#6b7280", grey: "#6b7280", yellow: "#eab308",
  brown: "#92400e", navy: "#1e3a8a", gold: "#d97706", silver: "#9ca3af",
  dark: "#1a1a1a", light: "#f9fafb",
};

function resolveColor(raw: string): string | null {
  const lower = raw.toLowerCase().trim();
  if (COLOR_NAMES[lower]) return COLOR_NAMES[lower];
  if (/^#[0-9a-fA-F]{3,6}$/.test(raw.trim())) return raw.trim();
  return null;
}

function parseDesignCommand(text: string): DesignCommand | null {
  // "change/make/set * text * to black"
  const textColorMatch = text.match(
    /(?:change|make|set|turn|convert)\s+(?:the\s+)?(?:\w+\s+)?text\s+(?:on\s+\S+\s+pages?\s+)?(?:all\s+)?(?:to|into|all\s+to)?\s*(\w+)/i
  );
  if (textColorMatch) {
    const color = resolveColor(textColorMatch[1]);
    if (color) return { type: "all_text_color", value: color };
  }

  // "make all text black"
  const allTextMatch = text.match(/make\s+(?:all\s+)?(?:the\s+)?text\s+(\w+)/i);
  if (allTextMatch) {
    const color = resolveColor(allTextMatch[1]);
    if (color) return { type: "all_text_color", value: color };
  }

  // "text/font color to black"
  const colorToMatch = text.match(/(?:text|font)\s+(?:color|colour)\s+(?:to|into)\s+(\w+)/i);
  if (colorToMatch) {
    const color = resolveColor(colorToMatch[1]);
    if (color) return { type: "all_text_color", value: color };
  }

  // "heading/title color to X"
  const headingMatch =
    text.match(/(?:heading|title)s?\s+(?:color|colour)\s+(?:to\s+)?(\w+)/i) ||
    text.match(/(?:change|make|set)\s+(?:the\s+)?(?:heading|title)s?\s+(\w+)/i);
  if (headingMatch) {
    const color = resolveColor(headingMatch[1]);
    if (color) return { type: "heading_color", value: color };
  }

  // Template switches
  const t = text.toLowerCase();
  if (/dark\s*mode|dark\s*theme/.test(t)) return { type: "template", value: "bold" };
  if (/light\s*mode|light\s*theme/.test(t)) return { type: "template", value: "minimal" };
  if (/\bclassic\b/.test(t)) return { type: "template", value: "classic" };
  if (/\belegant\b|\bluxury\b/.test(t)) return { type: "template", value: "elegant" };
  if (/\bmodern\b/.test(t)) return { type: "template", value: "modern" };
  if (/\bcreative\b|\bplayful\b/.test(t)) return { type: "template", value: "creative" };
  if (/\bminimal\b/.test(t)) return { type: "template", value: "minimal" };

  return null;
}

function isWriteIntent(text: string): boolean {
  return WRITE_INTENT_RE.test(text);
}

function isDesignIntent(text: string): boolean {
  return DESIGN_INTENT_RE.test(text);
}

function applyActions(sections: Section[], actions: Action[]): Section[] {
  let result = [...sections];

  for (const action of actions) {
    if (action.type === "add_section") {
      const maxOrder = result.reduce((m, s) => Math.max(m, s.order), 0);
      result.push({
        id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: action.title,
        content: action.content,
        order: maxOrder + 1,
      });
    } else if (action.type === "update_section") {
      result = result.map((s) =>
        s.id === action.sectionId
          ? { ...s, title: action.title ?? s.title, content: action.content }
          : s
      );
    } else if (action.type === "replace_all") {
      const cover = result.find((s) => s.id === "cover");
      const back = result.find((s) => s.id === "back");
      const newSections = action.sections.map((s, i) => ({
        id: `ai-${Date.now()}-${i}`,
        title: s.title,
        content: s.content,
        order: i + 1,
      }));
      result = [
        ...(cover ? [cover] : []),
        ...newSections,
        ...(back ? [back] : []),
      ];
    }
  }

  return result;
}

function summariseActions(actions: Action[]): { count: number; titles: string[] } {
  const titles: string[] = [];
  for (const a of actions) {
    if (a.type === "add_section") titles.push(a.title);
    else if (a.type === "update_section") titles.push(`Updated: ${a.sectionId}`);
    else if (a.type === "replace_all") titles.push(...a.sections.map((s) => s.title));
  }
  return { count: titles.length, titles: titles.slice(0, 5) };
}

export function EditorAIPanel({
  productId,
  sections,
  onSectionsChange,
  onOrientationChange,
  onApplyDesignCommand,
}: {
  productId: string;
  sections: Section[];
  onSectionsChange: (sections: Section[]) => void;
  onOrientationChange?: (orientation: "portrait" | "landscape") => void;
  onApplyDesignCommand?: (cmd: DesignCommand) => void;
}) {
  const { messages: coachMessages, sendMessage: sendCoach, isLoading: coachLoading } =
    useChatCoach("product-editor", { productId, coachMode: "content" });

  const [writeLoading, setWriteLoading] = useState(false);
  const [pendingInstruction, setPendingInstruction] = useState<string | null>(null);
  const [pendingBookType, setPendingBookType] = useState<"coloring" | "childrens" | null>(null);
  const [coloringOrientation, setColoringOrientation] = useState<"portrait" | "landscape">("portrait");
  const [childrensStyle, setChildrensStyle] = useState<"cartoon" | "watercolor" | "illustration">("cartoon");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [displayMessages, setDisplayMessages] = useState<LocalMessage[]>([]);
  const isLoading = coachLoading || writeLoading;

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayMessages]);

  const addMessage = useCallback((msg: LocalMessage) => {
    setDisplayMessages((prev) => [...prev, msg]);
  }, []);

  const COLOURING_RE = /colou?ring\s*book/i;
  const CHILDRENS_RE = /children'?s?\s*(story|picture|illustrated)?\s*book/i;

  const CHILDRENS_STYLE_PROMPTS: Record<string, string> = {
    cartoon: "fun cartoon illustration, bright colours, bold outlines, child-friendly, whimsical",
    watercolor: "watercolour illustration, soft pastel colours, gentle brushstrokes, child-friendly storybook style",
    illustration: "children's book illustration, vibrant colours, detailed, professional picture book style",
  };

  const executeWrite = useCallback(async (value: string, options: { orientation?: "portrait" | "landscape"; style?: string; bookType?: string }) => {
    const { orientation = "portrait", style = "cartoon", bookType } = options;
    setWriteLoading(true);
    addMessage({ role: "assistant", content: "Writing content…" });
    try {
      const res = await fetch(`/api/products/${productId}/ai-write`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instruction: value,
          currentSections: sections.filter((s) => s.id !== "cover" && s.id !== "back"),
        }),
      });
      const data = await res.json().catch(() => ({})) as { actions?: Action[]; message?: string; error?: string; generateImages?: boolean; bookType?: string };

      if (!res.ok || data.error || !Array.isArray(data.actions)) {
        setDisplayMessages((prev) => [
          ...prev.slice(0, -1),
          { role: "assistant", content: `Sorry, I couldn't do that. ${data.error ?? "Please try again."}` },
        ]);
      } else {
        let updated = applyActions(sections, data.actions);
        onSectionsChange(updated);
        const summary = summariseActions(data.actions);
        setDisplayMessages((prev) => [
          ...prev.slice(0, -1),
          { role: "assistant", content: data.message ?? "Done!", applied: summary },
        ]);

        if (data.generateImages) {
          const resolvedType = data.bookType ?? bookType;
          if (resolvedType === "coloring") {
            onOrientationChange?.(orientation === "landscape" ? "landscape" : "portrait");
          }
          const newSections = updated.filter((s) => s.id !== "cover" && s.id !== "back" && !s.imageUrl);
          for (const section of newSections) {
            try {
              const isColoring = resolvedType === "coloring";
              const aspectRatio = isColoring ? (orientation === "portrait" ? "9:16" : "16:9") : "1:1";
              const prompt = isColoring
                ? `${section.title}, colouring page for kids, black and white line art, bold simple outlines, no shading, white background, suitable for printing and colouring in`
                : `${section.title}, ${CHILDRENS_STYLE_PROMPTS[style] ?? CHILDRENS_STYLE_PROMPTS.cartoon}, children's book scene`;
              const imgRes = await fetch("/api/chat/coach/generate-image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt, aspectRatio }),
              });
              const imgData = await imgRes.json().catch(() => ({})) as { url?: string };
              if (imgData.url) {
                updated = updated.map((s) => s.id === section.id ? { ...s, imageUrl: imgData.url } : s);
                onSectionsChange(updated);
              }
            } catch {
              // continue to next
            }
          }
        }
      }
    } catch {
      setDisplayMessages((prev) => [
        ...prev.slice(0, -1),
        { role: "assistant", content: "Something went wrong. Please try again." },
      ]);
    } finally {
      setWriteLoading(false);
      setPendingInstruction(null);
      setPendingBookType(null);
    }
  }, [productId, sections, onSectionsChange, onOrientationChange, addMessage]);

  const handleSend = useCallback(async (overrideValue?: string) => {
    const input = inputRef.current;
    const value = (overrideValue ?? input?.value ?? "").trim();
    if (!value || isLoading) return;
    if (input) input.value = "";

    if (isWriteIntent(value)) {
      // For write intents we manage the full conversation locally
      addMessage({ role: "user", content: value });
      if (COLOURING_RE.test(value)) {
        setPendingInstruction(value);
        setPendingBookType("coloring");
      } else if (CHILDRENS_RE.test(value)) {
        setPendingInstruction(value);
        setPendingBookType("childrens");
      } else {
        await executeWrite(value, {});
      }
    } else if (isDesignIntent(value)) {
      // Try to handle design commands directly
      addMessage({ role: "user", content: value });
      const cmd = parseDesignCommand(value);
      if (cmd && onApplyDesignCommand) {
        onApplyDesignCommand(cmd);
        const descriptions: Record<string, string> = {
          all_text_color: `Changed all text colour to ${value.match(/\b(\w+)$/i)?.[1] ?? "the new colour"}`,
          heading_color: `Updated heading colour`,
          body_color: `Updated body text colour`,
          accent_color: `Updated accent colour`,
          template: `Switched to ${cmd.value} template`,
        };
        addMessage({ role: "assistant", content: `✅ Done! ${descriptions[cmd.type]}. The changes are live on your canvas.`, designApplied: true });
      } else {
        // Couldn't parse it locally — fall back to AI chat
        // Don't add user message again; sendCoach handles it via sync
        setDisplayMessages((prev) => [
          ...prev.slice(0, -1), // remove the user msg we just added
        ]);
        sendCoach(value);
      }
    } else {
      // General Q&A — let coachMessages sync handle adding user + assistant messages
      sendCoach(value);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, executeWrite, addMessage, sendCoach, onApplyDesignCommand]);

  // Sync coach messages into displayMessages
  // - When length grows: add new messages
  // - When content changes (streaming): update the last assistant message
  const prevCoachLenRef = useRef(0);
  useEffect(() => {
    if (coachMessages.length > prevCoachLenRef.current) {
      // New messages arrived (user + initial empty assistant placeholder)
      const newMsgs = coachMessages.slice(prevCoachLenRef.current);
      setDisplayMessages((prev) => [
        ...prev,
        ...newMsgs.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      ]);
      prevCoachLenRef.current = coachMessages.length;
    } else if (coachMessages.length > 0 && prevCoachLenRef.current === coachMessages.length) {
      // Same length but content changed — streaming update on the last message
      const lastCoach = coachMessages[coachMessages.length - 1];
      if (lastCoach.role === "assistant") {
        setDisplayMessages((prev) => {
          if (prev.length === 0) return prev;
          const updated = [...prev];
          const lastDisplay = updated[updated.length - 1];
          // Only update if this is the assistant placeholder we're streaming into
          if (lastDisplay.role === "assistant" && lastDisplay.content !== lastCoach.content) {
            updated[updated.length - 1] = { ...lastDisplay, content: lastCoach.content };
            return updated;
          }
          return prev;
        });
      }
    }
  }, [coachMessages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(undefined);
    }
  };

  const handleChip = (label: string) => {
    handleSend(label);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Style/orientation picker for colouring books */}
      {pendingInstruction && pendingBookType === "coloring" && (
        <div className="mx-4 mt-4 rounded-xl border border-orange-200 bg-orange-50 p-4 space-y-3 shrink-0">
          <p className="text-sm font-medium text-orange-900">Choose page orientation</p>
          <div className="grid grid-cols-2 gap-2">
            {([["portrait", "📄 Portrait", "Tall pages (A4 style)"], ["landscape", "🖼️ Landscape", "Wide pages"]] as const).map(([val, label, desc]) => (
              <button key={val} onClick={() => { setColoringOrientation(val); onOrientationChange?.(val); }}
                className={`rounded-lg border p-3 text-left transition-colors ${coloringOrientation === val ? "border-orange-500 bg-orange-100 text-orange-800" : "border-gray-200 bg-white text-gray-700 hover:border-orange-300"}`}>
                <div className="text-sm font-medium">{label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
              </button>
            ))}
          </div>
          <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white"
            onClick={() => executeWrite(pendingInstruction, { orientation: coloringOrientation, bookType: "coloring" })}
            disabled={writeLoading}>
            {writeLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Generate Colouring Book
          </Button>
        </div>
      )}
      {pendingInstruction && pendingBookType === "childrens" && (
        <div className="mx-4 mt-4 rounded-xl border border-orange-200 bg-orange-50 p-4 space-y-3 shrink-0">
          <p className="text-sm font-medium text-orange-900">Choose illustration style</p>
          <div className="grid grid-cols-3 gap-2">
            {([["cartoon", "🎨 Cartoon", "Bold & fun"], ["watercolor", "💧 Watercolour", "Soft & dreamy"], ["illustration", "✏️ Illustrated", "Detailed & rich"]] as const).map(([val, label, desc]) => (
              <button key={val} onClick={() => setChildrensStyle(val)}
                className={`rounded-lg border p-2.5 text-left transition-colors ${childrensStyle === val ? "border-orange-500 bg-orange-100 text-orange-800" : "border-gray-200 bg-white text-gray-700 hover:border-orange-300"}`}>
                <div className="text-sm font-medium">{label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
              </button>
            ))}
          </div>
          <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white"
            onClick={() => executeWrite(pendingInstruction, { style: childrensStyle, bookType: "childrens" })}
            disabled={writeLoading}>
            {writeLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Generate Children&apos;s Book
          </Button>
        </div>
      )}

      {displayMessages.length === 0 && (
        <div className="px-4 pt-4 pb-2 space-y-3">
          <div className="flex items-center gap-2 text-orange-500">
            <Sparkles className="w-4 h-4" />
            <p className="text-sm font-medium text-gray-900">AI Product Assistant</p>
          </div>
          <p className="text-xs text-gray-500">
            Tell me what to write, or ask me to change design — I&apos;ll apply it directly.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {STARTER_CHIPS.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => handleChip(label)}
                disabled={isLoading}
                className="rounded-full px-3 py-1.5 text-xs font-medium bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 disabled:opacity-50 disabled:pointer-events-none transition-colors"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <ScrollArea className="flex-1 min-h-0 px-4">
        <div className="py-3 space-y-3">
          {displayMessages.map((msg, i) => (
            <div key={i} className={cn("flex flex-col", msg.role === "user" ? "items-end" : "items-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                  msg.role === "user"
                    ? "bg-orange-500 text-white"
                    : "bg-gray-100 text-gray-900"
                )}
              >
                {msg.content || (msg.role === "assistant" && isLoading && i === displayMessages.length - 1 ? "…" : "")}
              </div>
              {msg.applied && msg.applied.count > 0 && (
                <div className="mt-1.5 max-w-[85%] rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700 space-y-1">
                  <div className="flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {msg.applied.count} section{msg.applied.count !== 1 ? "s" : ""} added to your product
                  </div>
                  <ul className="pl-1 space-y-0.5 text-green-600">
                    {msg.applied.titles.map((t, j) => (
                      <li key={j}>· {t}</li>
                    ))}
                  </ul>
                </div>
              )}
              {msg.designApplied && (
                <div className="mt-1.5 max-w-[85%] rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700 flex items-center gap-1.5">
                  <Paintbrush className="w-3.5 h-3.5" />
                  Design updated on canvas
                </div>
              )}
            </div>
          ))}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <div className="p-3 border-t border-gray-200 flex gap-2 shrink-0">
        <Input
          ref={inputRef}
          placeholder='e.g. "Make all text black" or "Write a budgeting page"'
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          className="flex-1 text-sm"
        />
        <Button
          type="button"
          size="icon"
          onClick={() => handleSend(undefined)}
          disabled={isLoading}
          className="bg-orange-500 hover:bg-orange-600 text-white shrink-0"
        >
          {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </Button>
      </div>
    </div>
  );
}
