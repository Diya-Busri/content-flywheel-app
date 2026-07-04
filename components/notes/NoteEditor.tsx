"use client";

// ─── TipTap ─────────────────────────────────────────────────────────────────
import { useEditor, EditorContent, ReactRenderer, Editor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Underline } from "@tiptap/extension-underline";
import { TaskList, TaskItem } from "@tiptap/extension-list";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { Highlight } from "@tiptap/extension-highlight";
import { Mention } from "@tiptap/extension-mention";
import { Placeholder, CharacterCount } from "@tiptap/extensions";
import { Link } from "@tiptap/extension-link";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { Extension } from "@tiptap/core";
import { Suggestion } from "@tiptap/suggestion";
import tippy from "tippy.js";
import "tippy.js/dist/tippy.css";

// ─── React ──────────────────────────────────────────────────────────────────
import {
  useState, useEffect, useCallback, useRef, forwardRef,
  useImperativeHandle, KeyboardEvent, type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

// ─── Icons ──────────────────────────────────────────────────────────────────
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Code, Link2, Wand2, Sparkles, AlignLeft, AlignCenter, AlignRight,
  AlignJustify, ChevronDown, Check, List, ListOrdered, CheckSquare,
  Quote, Minus, Table2, Type, Heading1, Heading2, Heading3,
  Undo, Redo, Highlighter, MoreHorizontal, Search, X,
  Mic, Layers, Video, Package, Maximize2, Minimize2, BookOpen,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface NoteRef { id: string; title: string; }

export interface NoteEditorProps {
  content: string;
  isLegacy?: boolean;
  onUpdate: (json: string, text: string) => void;
  allNotes: NoteRef[];
  noteId: string;
  placeholder?: string;
  className?: string;
  fontSize?: string;
  fontFamily?: string;
  onAiAction?: (
    action: string,
    selectedText: string,
    replaceCallback: (result: string) => void
  ) => void;
}

interface Range { from: number; to: number; }

// ─────────────────────────────────────────────────────────────────────────────
// OS detection (run once, client-side only)
// ─────────────────────────────────────────────────────────────────────────────

function useIsMac() {
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/i.test(navigator.platform));
  }, []);
  return isMac;
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom extension: text alignment (no extra package needed)
// Uses TipTap globalAttributes + updateAttributes command
// ─────────────────────────────────────────────────────────────────────────────

const TextAlignExtension = Extension.create({
  name: "textAlign",
  addGlobalAttributes() {
    return [
      {
        types: ["heading", "paragraph"],
        attributes: {
          textAlign: {
            default: null,
            parseHTML: (el: Element) => (el as HTMLElement).style.textAlign || null,
            renderHTML: (attrs: Record<string, string | null>) =>
              attrs.textAlign ? { style: `text-align: ${attrs.textAlign}` } : {},
          },
        },
      },
    ];
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Slash-command items
// ─────────────────────────────────────────────────────────────────────────────

const SLASH_ITEMS = [
  // Text
  { title: "Paragraph",      description: "Regular paragraph",                icon: "¶",   group: "Text",  command: (e: Editor, r: Range) => e.chain().focus().deleteRange(r).setParagraph().run() },
  { title: "Heading 1",      description: "Large section heading",            icon: "H1",  group: "Text",  command: (e: Editor, r: Range) => e.chain().focus().deleteRange(r).setHeading({ level: 1 }).run() },
  { title: "Heading 2",      description: "Medium section heading",           icon: "H2",  group: "Text",  command: (e: Editor, r: Range) => e.chain().focus().deleteRange(r).setHeading({ level: 2 }).run() },
  { title: "Heading 3",      description: "Small section heading",            icon: "H3",  group: "Text",  command: (e: Editor, r: Range) => e.chain().focus().deleteRange(r).setHeading({ level: 3 }).run() },
  // Lists
  { title: "Bullet List",    description: "Unordered list",                   icon: "•",   group: "List",  command: (e: Editor, r: Range) => e.chain().focus().deleteRange(r).toggleBulletList().run() },
  { title: "Numbered List",  description: "Ordered list",                     icon: "1.",  group: "List",  command: (e: Editor, r: Range) => e.chain().focus().deleteRange(r).toggleOrderedList().run() },
  { title: "Task List",      description: "Checklist with checkboxes",        icon: "☐",   group: "List",  command: (e: Editor, r: Range) => e.chain().focus().deleteRange(r).toggleTaskList().run() },
  // Blocks
  { title: "Quote",          description: "Blockquote callout",               icon: "❝",   group: "Block", command: (e: Editor, r: Range) => e.chain().focus().deleteRange(r).toggleBlockquote().run() },
  { title: "Code Block",     description: "Multiline code with syntax hints", icon: "</>", group: "Block", command: (e: Editor, r: Range) => e.chain().focus().deleteRange(r).toggleCodeBlock().run() },
  { title: "Table",          description: "Insert a 3 × 3 table",            icon: "⊞",   group: "Block", command: (e: Editor, r: Range) => e.chain().focus().deleteRange(r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { title: "Divider",        description: "Horizontal separator line",        icon: "─",   group: "Block", command: (e: Editor, r: Range) => e.chain().focus().deleteRange(r).setHorizontalRule().run() },
];

// ─────────────────────────────────────────────────────────────────────────────
// SlashMenuList
// ─────────────────────────────────────────────────────────────────────────────

interface SlashMenuProps {
  items: typeof SLASH_ITEMS;
  command: (item: typeof SLASH_ITEMS[0]) => void;
}

const SlashMenuList = forwardRef<{ onKeyDown: (e: { event: KeyboardEvent }) => boolean }, SlashMenuProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    const selectItem = useCallback((index: number) => {
      const item = items[index];
      if (item) command(item);
    }, [items, command]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === "ArrowUp")    { setSelectedIndex(i => (i + items.length - 1) % items.length); return true; }
        if (event.key === "ArrowDown")  { setSelectedIndex(i => (i + 1) % items.length); return true; }
        if (event.key === "Enter")      { selectItem(selectedIndex); return true; }
        return false;
      },
    }));

    useEffect(() => setSelectedIndex(0), [items]);

    const groups = Array.from(new Set(items.map(i => i.group)));

    return (
      <div className="slash-menu bg-popover border border-border rounded-xl shadow-xl py-1.5 min-w-[240px] max-h-[340px] overflow-y-auto">
        {groups.map(group => {
          const groupItems = items.filter(i => i.group === group);
          return (
            <div key={group}>
              <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">{group}</p>
              {groupItems.map(item => {
                const idx = items.indexOf(item);
                return (
                  <button key={item.title}
                    onClick={() => selectItem(idx)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 text-left transition-colors",
                      idx === selectedIndex ? "bg-accent text-foreground" : "text-foreground hover:bg-accent/60"
                    )}>
                    <span className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-[11px] font-bold shrink-0 text-muted-foreground">
                      {item.icon}
                    </span>
                    <div>
                      <p className="text-[13px] font-medium">{item.title}</p>
                      <p className="text-[11px] text-muted-foreground/70">{item.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}
        {items.length === 0 && (
          <p className="px-3 py-3 text-xs text-muted-foreground">No matching commands</p>
        )}
      </div>
    );
  }
);
SlashMenuList.displayName = "SlashMenuList";

// ─────────────────────────────────────────────────────────────────────────────
// Slash command TipTap extension
// ─────────────────────────────────────────────────────────────────────────────

function createSlashCommandExtension() {
  return Extension.create({
    name: "slashCommand",
    addProseMirrorPlugins() {
      return [
        Suggestion({
          editor: this.editor,
          char: "/",
          allowSpaces: false,
          startOfLine: false,
          command: ({ editor, range, props }: { editor: Editor; range: Range; props: { command: (e: Editor, r: Range) => void } }) => {
            props.command(editor, range);
          },
          items: ({ query }: { query: string }) =>
            SLASH_ITEMS.filter(item =>
              item.title.toLowerCase().includes(query.toLowerCase()) ||
              item.description.toLowerCase().includes(query.toLowerCase())
            ),
          render: () => {
            let component: ReactRenderer;
            let popup: ReturnType<typeof tippy>;

            return {
              onStart: (props: Record<string, unknown>) => {
                component = new ReactRenderer(SlashMenuList, {
                  props,
                  editor: props.editor as Editor,
                });
                if (!props.clientRect) return;
                popup = tippy("body", {
                  getReferenceClientRect: props.clientRect as () => DOMRect,
                  appendTo: () => document.body,
                  content: component.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: "manual",
                  placement: "bottom-start",
                  theme: "none",
                  arrow: false,
                  maxWidth: "none",
                });
              },
              onUpdate(props: Record<string, unknown>) {
                component.updateProps(props);
                if (!props.clientRect) return;
                (popup as unknown as { setProps: (p: unknown) => void }).setProps({
                  getReferenceClientRect: props.clientRect,
                });
              },
              onKeyDown(props: { event: KeyboardEvent }) {
                if (props.event.key === "Escape") {
                  (popup as unknown as [{ hide: () => void }])[0].hide();
                  return true;
                }
                return (component.ref as unknown as { onKeyDown: (p: unknown) => boolean })?.onKeyDown(props) ?? false;
              },
              onExit() {
                (popup as unknown as [{ destroy: () => void }])[0]?.destroy();
                component.destroy();
              },
            };
          },
        }),
      ];
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// @Mention list
// ─────────────────────────────────────────────────────────────────────────────

interface MentionListProps {
  items: NoteRef[];
  command: (item: { id: string; label: string }) => void;
  query: string;
}

const MentionList = forwardRef<{ onKeyDown: (e: { event: KeyboardEvent }) => boolean }, MentionListProps>(
  ({ items, command, query }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    const selectItem = useCallback((index: number) => {
      const item = items[index];
      if (item) command({ id: item.id, label: item.title });
    }, [items, command]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === "ArrowUp")    { setSelectedIndex(i => (i + items.length - 1) % items.length); return true; }
        if (event.key === "ArrowDown")  { setSelectedIndex(i => (i + 1) % items.length); return true; }
        if (event.key === "Enter")      { selectItem(selectedIndex); return true; }
        return false;
      },
    }));

    useEffect(() => setSelectedIndex(0), [items]);

    return (
      <div className="mention-menu bg-popover border border-border rounded-xl shadow-xl py-1.5 min-w-[220px] max-h-[280px] overflow-y-auto">
        <p className="px-3 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Link Note</p>
        {items.map((note, i) => (
          <button key={note.id} onClick={() => selectItem(i)}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors text-sm",
              i === selectedIndex ? "bg-accent text-foreground" : "text-foreground hover:bg-accent/60"
            )}>
            <span className="text-base leading-none">📝</span>
            <span className="truncate font-medium">{note.title}</span>
          </button>
        ))}
        {query.trim().length > 0 && (
          <button
            onClick={() => command({ id: "__create__", label: query.trim() })}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors text-sm text-orange-500 hover:bg-orange-500/8 border-t border-border mt-1 pt-2">
            <span className="text-base leading-none">✨</span>
            <span>Create &ldquo;{query.trim()}&rdquo;</span>
          </button>
        )}
        {items.length === 0 && !query.trim() && (
          <p className="px-3 py-3 text-xs text-muted-foreground">No notes found</p>
        )}
      </div>
    );
  }
);
MentionList.displayName = "MentionList";

// ─────────────────────────────────────────────────────────────────────────────
// Color presets
// ─────────────────────────────────────────────────────────────────────────────

const TEXT_COLORS = [
  { label: "Default", value: "" },
  { label: "Orange",  value: "#f97316" },
  { label: "Red",     value: "#ef4444" },
  { label: "Pink",    value: "#ec4899" },
  { label: "Purple",  value: "#a855f7" },
  { label: "Blue",    value: "#3b82f6" },
  { label: "Cyan",    value: "#06b6d4" },
  { label: "Green",   value: "#22c55e" },
  { label: "Yellow",  value: "#eab308" },
  { label: "Gray",    value: "#6b7280" },
];

const HIGHLIGHT_COLORS = [
  { label: "None",    value: "" },
  { label: "Yellow",  value: "#fef08a" },
  { label: "Orange",  value: "#fed7aa" },
  { label: "Pink",    value: "#fce7f3" },
  { label: "Purple",  value: "#ede9fe" },
  { label: "Blue",    value: "#dbeafe" },
  { label: "Green",   value: "#dcfce7" },
  { label: "Gray",    value: "#f3f4f6" },
];

// ─────────────────────────────────────────────────────────────────────────────
// ColorPicker dropdown
// ─────────────────────────────────────────────────────────────────────────────

function ColorPicker({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  return (
    <div className="p-3 w-52 space-y-3" onClick={e => e.stopPropagation()}>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Text Color</p>
        <div className="flex flex-wrap gap-1.5">
          {TEXT_COLORS.map(c => (
            <button key={c.value} title={c.label}
              onClick={() => {
                c.value
                  ? editor.chain().focus().setColor(c.value).run()
                  : editor.chain().focus().unsetColor().run();
                onClose();
              }}
              className={cn(
                "w-6 h-6 rounded-full border-2 transition-transform hover:scale-110",
                !c.value ? "bg-gradient-to-br from-gray-200 to-gray-400 border-border" : "border-white dark:border-gray-800"
              )}
              style={c.value ? { backgroundColor: c.value } : {}} />
          ))}
        </div>
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Highlight</p>
        <div className="flex flex-wrap gap-1.5">
          {HIGHLIGHT_COLORS.map(c => (
            <button key={c.value} title={c.label}
              onClick={() => {
                c.value
                  ? editor.chain().focus().setHighlight({ color: c.value }).run()
                  : editor.chain().focus().unsetHighlight().run();
                onClose();
              }}
              className={cn(
                "w-6 h-6 rounded-full border-2 transition-transform hover:scale-110",
                !c.value ? "bg-gradient-to-br from-gray-200 to-gray-400 border-border" : "border-white dark:border-gray-800"
              )}
              style={c.value ? { backgroundColor: c.value } : {}} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AI actions in the floating bubble
// ─────────────────────────────────────────────────────────────────────────────

const AI_WRITING_ACTIONS = [
  { id: "improve-writing", label: "Improve",   icon: <Wand2 className="w-3 h-3" />,    writing: true  },
  { id: "rewrite",         label: "Rewrite",   icon: <BookOpen className="w-3 h-3" />, writing: true  },
  { id: "expand-idea",     label: "Expand",    icon: <Maximize2 className="w-3 h-3" />, writing: true  },
  { id: "shorten",         label: "Shorten",   icon: <Minimize2 className="w-3 h-3" />, writing: true },
  { id: "summarise",       label: "Summarise", icon: <Sparkles className="w-3 h-3" />,  writing: true  },
];

// All AI actions including navigation (used in command palette)
const ALL_AI_ACTIONS = [
  ...AI_WRITING_ACTIONS,
  { id: "turn-into-script",   label: "Turn into Script",          icon: <Mic className="w-3 h-3" />,     writing: false },
  { id: "turn-into-carousel", label: "Turn into Carousel",        icon: <Layers className="w-3 h-3" />,  writing: false },
  { id: "turn-into-video",    label: "Turn into Video Guide",     icon: <Video className="w-3 h-3" />,   writing: false },
  { id: "turn-into-product",  label: "Turn into Digital Product", icon: <Package className="w-3 h-3" />, writing: false },
];

// ─────────────────────────────────────────────────────────────────────────────
// Command Palette
// ─────────────────────────────────────────────────────────────────────────────

interface PaletteItem {
  id: string;
  label: string;
  description?: string;
  group: string;
  icon: ReactNode;
  action: () => void;
}

interface CommandPaletteProps {
  editor: Editor;
  isMac: boolean;
  onAiAction?: (action: string, text: string, cb: (r: string) => void) => void;
  onClose: () => void;
}

function CommandPalette({ editor, isMac, onAiAction, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const mod = isMac ? "⌘" : "Ctrl";

  useEffect(() => { inputRef.current?.focus(); }, []);

  const items: PaletteItem[] = [
    // Formatting
    { id: "bold",      label: "Bold",             description: `${mod}B`, group: "Formatting", icon: <Bold className="w-3.5 h-3.5" />,          action: () => { editor.chain().focus().toggleBold().run(); onClose(); } },
    { id: "italic",    label: "Italic",           description: `${mod}I`, group: "Formatting", icon: <Italic className="w-3.5 h-3.5" />,        action: () => { editor.chain().focus().toggleItalic().run(); onClose(); } },
    { id: "underline", label: "Underline",        description: `${mod}U`, group: "Formatting", icon: <UnderlineIcon className="w-3.5 h-3.5" />, action: () => { editor.chain().focus().toggleUnderline().run(); onClose(); } },
    { id: "strike",    label: "Strikethrough",    description: "",        group: "Formatting", icon: <Strikethrough className="w-3.5 h-3.5" />, action: () => { editor.chain().focus().toggleStrike().run(); onClose(); } },
    { id: "undo",      label: "Undo",             description: `${mod}Z`, group: "Formatting", icon: <Undo className="w-3.5 h-3.5" />,          action: () => { editor.chain().focus().undo().run(); onClose(); } },
    { id: "redo",      label: "Redo",             description: `${mod}⇧Z`, group: "Formatting", icon: <Redo className="w-3.5 h-3.5" />,         action: () => { editor.chain().focus().redo().run(); onClose(); } },
    // Blocks
    ...SLASH_ITEMS.map(s => ({
      id: `block-${s.title}`,
      label: s.title,
      description: s.description,
      group: "Insert Block",
      icon: <span className="text-[11px] font-bold">{s.icon}</span>,
      action: () => {
        const { from, to } = editor.state.selection;
        s.command(editor, { from, to });
        onClose();
      },
    })),
    // AI
    ...ALL_AI_ACTIONS.map(a => ({
      id: `ai-${a.id}`,
      label: a.label,
      description: a.writing ? "Rewrites selected text" : "Navigate",
      group: "AI",
      icon: a.icon,
      action: () => {
        if (!onAiAction) { onClose(); return; }
        const { from, to } = editor.state.selection;
        const selectedText = editor.state.doc.textBetween(from, to, " ");
        onAiAction(a.id, selectedText || "", (result) => {
          if (result && from !== to) {
            editor.chain().focus().insertContentAt({ from, to }, result).run();
          }
        });
        onClose();
      },
    })),
  ];

  const filtered = items.filter(item =>
    !query ||
    item.label.toLowerCase().includes(query.toLowerCase()) ||
    item.description?.toLowerCase().includes(query.toLowerCase()) ||
    item.group.toLowerCase().includes(query.toLowerCase())
  );

  const groups = Array.from(new Set(filtered.map(i => i.group)));

  useEffect(() => setSelectedIndex(0), [query]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, filtered.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
    if (e.key === "Enter")     { e.preventDefault(); filtered[selectedIndex]?.action(); }
    if (e.key === "Escape")    { onClose(); }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[20vh]" onClick={onClose}>
      <div
        className="w-full max-w-[520px] bg-popover border border-border rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search commands…"
            className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground/50"
          />
          <button onClick={onClose} className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Items */}
        <div className="max-h-[360px] overflow-y-auto py-1.5">
          {groups.map(group => {
            const groupItems = filtered.filter(i => i.group === group);
            return (
              <div key={group}>
                <p className="px-4 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">{group}</p>
                {groupItems.map(item => {
                  const globalIdx = filtered.indexOf(item);
                  return (
                    <button
                      key={item.id}
                      onClick={item.action}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-2 text-left transition-colors",
                        globalIdx === selectedIndex ? "bg-accent" : "hover:bg-accent/50"
                      )}
                    >
                      <span className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0 text-muted-foreground">
                        {item.icon}
                      </span>
                      <span className="flex-1 text-[13px] font-medium text-foreground">{item.label}</span>
                      {item.description && (
                        <span className="text-[11px] text-muted-foreground/50 font-mono shrink-0">{item.description}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">No commands found</p>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-border flex items-center gap-3 bg-muted/20">
          <span className="text-[10px] text-muted-foreground/50">↑↓ Navigate</span>
          <span className="text-[10px] text-muted-foreground/50">↵ Select</span>
          <span className="text-[10px] text-muted-foreground/50">Esc Close</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Toolbar button helper
// ─────────────────────────────────────────────────────────────────────────────

function TBtn({
  title, active, onClick, children, className
}: {
  title: string; active?: boolean; onClick: () => void; children: ReactNode; className?: string;
}) {
  return (
    <button
      title={title}
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      className={cn(
        "h-7 px-1.5 rounded-md flex items-center justify-center transition-colors text-xs gap-1 shrink-0",
        active ? "bg-orange-500/12 text-orange-500" : "text-muted-foreground hover:text-foreground hover:bg-accent",
        className
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-4 bg-border/60 shrink-0" />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main NoteEditor
// ─────────────────────────────────────────────────────────────────────────────

export function NoteEditor({
  content,
  isLegacy = false,
  onUpdate,
  allNotes,
  noteId,
  placeholder = "Start writing… type / for commands, @ to link a note",
  className,
  fontSize = "text-base",
  fontFamily = "font-sans",
  onAiAction,
}: NoteEditorProps) {
  const isMac = useIsMac();
  const mod = isMac ? "⌘" : "Ctrl";

  // UI state
  const [showColorPicker, setShowColorPicker]     = useState(false);
  const [showMoreMenu, setShowMoreMenu]           = useState(false);
  const [showBlockMenu, setShowBlockMenu]         = useState(false);
  const [showListMenu, setShowListMenu]           = useState(false);
  const [showCmdPalette, setShowCmdPalette]       = useState(false);
  const [aiLoading, setAiLoading]                 = useState<string | null>(null);
  const [bubbleVisible, setBubbleVisible]         = useState(false);
  const [bubbleCoords, setBubbleCoords]           = useState({ top: 0, left: 0 });

  // Refs
  const bubbleRef    = useRef<HTMLDivElement>(null);
  const moreRef      = useRef<HTMLDivElement>(null);
  const blockRef     = useRef<HTMLDivElement>(null);
  const listRef      = useRef<HTMLDivElement>(null);
  const colorRef     = useRef<HTMLDivElement>(null);
  const allNotesRef  = useRef(allNotes);
  allNotesRef.current = allNotes;

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreRef.current  && !moreRef.current.contains(e.target as Node))   setShowMoreMenu(false);
      if (blockRef.current && !blockRef.current.contains(e.target as Node))  setShowBlockMenu(false);
      if (listRef.current  && !listRef.current.contains(e.target as Node))   setShowListMenu(false);
      if (colorRef.current && !colorRef.current.contains(e.target as Node))  setShowColorPicker(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const getInitialContent = () => {
    if (!content) return "";
    if (isLegacy) return content;
    try { return JSON.parse(content); }
    catch { return content; }
  };

  const SlashCommandExtension = createSlashCommandExtension();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4] }, codeBlock: {} }),
      Underline,
      TaskList,
      TaskItem.configure({ nested: true }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "note-link" } }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      CharacterCount,
      Placeholder.configure({ placeholder }),
      TextAlignExtension,
      Mention.configure({
        HTMLAttributes: { class: "note-mention" },
        suggestion: {
          items: ({ query }: { query: string }) =>
            allNotesRef.current
              .filter(n => n.id !== noteId && n.title.toLowerCase().includes(query.toLowerCase()))
              .slice(0, 8),
          render: () => {
            let component: ReactRenderer;
            let popup: ReturnType<typeof tippy>;
            return {
              onStart: (props: Record<string, unknown>) => {
                component = new ReactRenderer(MentionList, {
                  props: { ...props, query: props.query as string },
                  editor: props.editor as Editor,
                });
                if (!props.clientRect) return;
                popup = tippy("body", {
                  getReferenceClientRect: props.clientRect as () => DOMRect,
                  appendTo: () => document.body,
                  content: component.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: "manual",
                  placement: "bottom-start",
                  theme: "none",
                  arrow: false,
                  maxWidth: "none",
                });
              },
              onUpdate(props: Record<string, unknown>) {
                component.updateProps({ ...props, query: props.query as string });
                if (!props.clientRect) return;
                (popup as unknown as { setProps: (p: unknown) => void }).setProps({
                  getReferenceClientRect: props.clientRect,
                });
              },
              onKeyDown(props: { event: KeyboardEvent }) {
                if (props.event.key === "Escape") {
                  (popup as unknown as [{ hide: () => void }])[0].hide();
                  return true;
                }
                return (component.ref as unknown as { onKeyDown: (p: unknown) => boolean })?.onKeyDown(props) ?? false;
              },
              onExit() {
                (popup as unknown as [{ destroy: () => void }])[0]?.destroy();
                component.destroy();
              },
            };
          },
        },
      }),
      SlashCommandExtension,
    ],
    content: getInitialContent(),
    editorProps: {
      attributes: {
        class: cn(
          "note-editor-content outline-none min-h-[300px] px-8 py-6 focus:outline-none",
          fontSize,
          fontFamily,
        ),
      },
      handleKeyDown: (_view, event) => {
        // ⌘K / Ctrl+K → command palette
        const ctrlOrCmd = isMac ? event.metaKey : event.ctrlKey;
        if (ctrlOrCmd && event.key === "k") {
          event.preventDefault();
          setShowCmdPalette(true);
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      onUpdate(JSON.stringify(editor.getJSON()), editor.getText({ blockSeparator: "\n" }));
    },
    onSelectionUpdate: ({ editor }) => {
      const { empty } = editor.state.selection;
      if (empty) { setBubbleVisible(false); return; }
      try {
        const { from } = editor.state.selection;
        const coords = editor.view.coordsAtPos(from);
        const editorDom = editor.view.dom;
        const rect = editorDom.getBoundingClientRect();
        setBubbleCoords({
          top: coords.top - rect.top - 52,
          left: Math.max(0, Math.min(coords.left - rect.left, rect.width - 400)),
        });
        setBubbleVisible(true);
      } catch { setBubbleVisible(false); }
    },
    immediatelyRender: false,
  }, [noteId]);

  // Global ⌘K / Ctrl+K listener (catches it even when editor not focused)
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;
      if (ctrlOrCmd && e.key === "k") {
        e.preventDefault();
        setShowCmdPalette(v => !v);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isMac]);

  // AI action on selected text
  const handleAiSelection = useCallback(async (actionId: string) => {
    if (!editor || !onAiAction) return;
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, " ");
    setAiLoading(actionId);
    onAiAction(actionId, selectedText, (result) => {
      if (result) editor.chain().focus().insertContentAt({ from, to }, result).run();
      setAiLoading(null);
    });
  }, [editor, onAiAction]);

  // Alignment helper
  const setAlign = useCallback((align: string) => {
    if (!editor) return;
    ["paragraph", "heading"].forEach(type => {
      editor.chain().focus().updateAttributes(type, { textAlign: align }).run();
    });
  }, [editor]);

  // Current block type label
  const blockLabel = (() => {
    if (!editor) return "Text";
    if (editor.isActive("heading", { level: 1 })) return "H1";
    if (editor.isActive("heading", { level: 2 })) return "H2";
    if (editor.isActive("heading", { level: 3 })) return "H3";
    if (editor.isActive("heading", { level: 4 })) return "H4";
    if (editor.isActive("blockquote"))             return "Quote";
    if (editor.isActive("codeBlock"))              return "Code";
    return "Text";
  })();

  if (!editor) return null;

  const charCount = editor.storage.characterCount?.words?.() ?? 0;
  const readMins  = Math.max(1, Math.ceil(charCount / 200));

  return (
    <div className={cn("relative flex-1 flex flex-col overflow-hidden", className)}>

      {/* ── Minimal top toolbar ───────────────────────────────────────────── */}
      <div className="flex items-center gap-1 px-4 py-1.5 border-b border-border/40 bg-background/60 backdrop-blur-sm shrink-0 flex-wrap">

        {/* Block type dropdown */}
        <div className="relative" ref={blockRef}>
          <button
            onMouseDown={e => { e.preventDefault(); setShowBlockMenu(v => !v); }}
            className="flex items-center gap-1 h-7 px-2 rounded-md text-[12px] font-semibold text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            {blockLabel}
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>
          {showBlockMenu && (
            <div className="absolute top-full mt-1 left-0 z-50 bg-popover border border-border rounded-xl shadow-xl py-1 min-w-[180px]">
              {[
                { label: "Text",     icon: <Type className="w-3.5 h-3.5" />,    action: () => editor.chain().focus().setParagraph().run() },
                { label: "Heading 1", icon: <Heading1 className="w-3.5 h-3.5" />, action: () => editor.chain().focus().setHeading({ level: 1 }).run() },
                { label: "Heading 2", icon: <Heading2 className="w-3.5 h-3.5" />, action: () => editor.chain().focus().setHeading({ level: 2 }).run() },
                { label: "Heading 3", icon: <Heading3 className="w-3.5 h-3.5" />, action: () => editor.chain().focus().setHeading({ level: 3 }).run() },
                { label: "Quote",    icon: <Quote className="w-3.5 h-3.5" />,   action: () => editor.chain().focus().toggleBlockquote().run() },
                { label: "Code Block", icon: <Code className="w-3.5 h-3.5" />, action: () => editor.chain().focus().toggleCodeBlock().run() },
              ].map(item => (
                <button key={item.label} onMouseDown={e => { e.preventDefault(); item.action(); setShowBlockMenu(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-[13px] text-left hover:bg-accent transition-colors text-foreground">
                  <span className="text-muted-foreground">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <Divider />

        {/* Bold / Italic */}
        <TBtn title={`Bold (${mod}B)`} active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="w-3.5 h-3.5" />
        </TBtn>
        <TBtn title={`Italic (${mod}I)`} active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="w-3.5 h-3.5" />
        </TBtn>

        <Divider />

        {/* Lists dropdown */}
        <div className="relative" ref={listRef}>
          <button
            onMouseDown={e => { e.preventDefault(); setShowListMenu(v => !v); }}
            className={cn(
              "flex items-center gap-1 h-7 px-1.5 rounded-md transition-colors text-xs shrink-0",
              (editor.isActive("bulletList") || editor.isActive("orderedList") || editor.isActive("taskList"))
                ? "bg-orange-500/12 text-orange-500"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
            title="Lists"
          >
            <List className="w-3.5 h-3.5" />
            <ChevronDown className="w-2.5 h-2.5 opacity-60" />
          </button>
          {showListMenu && (
            <div className="absolute top-full mt-1 left-0 z-50 bg-popover border border-border rounded-xl shadow-xl py-1 min-w-[180px]">
              {[
                { label: "Bullet List",   icon: <List className="w-3.5 h-3.5" />,         active: editor.isActive("bulletList"),  action: () => editor.chain().focus().toggleBulletList().run() },
                { label: "Numbered List", icon: <ListOrdered className="w-3.5 h-3.5" />,  active: editor.isActive("orderedList"), action: () => editor.chain().focus().toggleOrderedList().run() },
                { label: "Checklist",     icon: <CheckSquare className="w-3.5 h-3.5" />,  active: editor.isActive("taskList"),   action: () => editor.chain().focus().toggleTaskList().run() },
              ].map(item => (
                <button key={item.label} onMouseDown={e => { e.preventDefault(); item.action(); setShowListMenu(false); }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 text-[13px] text-left transition-colors",
                    item.active ? "text-orange-500 bg-orange-500/5" : "text-foreground hover:bg-accent"
                  )}>
                  <span className={item.active ? "text-orange-500" : "text-muted-foreground"}>{item.icon}</span>
                  {item.label}
                  {item.active && <Check className="w-3 h-3 ml-auto" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <Divider />

        {/* More → alignment, colors, underline, strike, table, divider */}
        <div className="relative" ref={moreRef}>
          <button
            onMouseDown={e => { e.preventDefault(); setShowMoreMenu(v => !v); }}
            className="flex items-center gap-1 h-7 px-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="More formatting"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
          {showMoreMenu && (
            <div className="absolute top-full mt-1 left-0 z-50 bg-popover border border-border rounded-xl shadow-xl py-1 min-w-[220px]">
              {/* Alignment */}
              <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">Alignment</p>
              <div className="flex items-center gap-1 px-3 pb-2">
                {[
                  { icon: <AlignLeft className="w-3.5 h-3.5" />,    align: "left",    title: "Align Left" },
                  { icon: <AlignCenter className="w-3.5 h-3.5" />,  align: "center",  title: "Align Center" },
                  { icon: <AlignRight className="w-3.5 h-3.5" />,   align: "right",   title: "Align Right" },
                  { icon: <AlignJustify className="w-3.5 h-3.5" />, align: "justify", title: "Justify" },
                ].map(item => (
                  <button key={item.align} title={item.title}
                    onMouseDown={e => { e.preventDefault(); setAlign(item.align); }}
                    className="flex-1 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                    {item.icon}
                  </button>
                ))}
              </div>
              {/* Text formatting */}
              <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">Formatting</p>
              {[
                { label: "Underline",      icon: <UnderlineIcon className="w-3.5 h-3.5" />,  active: editor.isActive("underline"), action: () => editor.chain().focus().toggleUnderline().run() },
                { label: "Strikethrough",  icon: <Strikethrough className="w-3.5 h-3.5" />,  active: editor.isActive("strike"),    action: () => editor.chain().focus().toggleStrike().run() },
                { label: "Inline Code",    icon: <Code className="w-3.5 h-3.5" />,           active: editor.isActive("code"),      action: () => editor.chain().focus().toggleCode().run() },
              ].map(item => (
                <button key={item.label} onMouseDown={e => { e.preventDefault(); item.action(); }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 text-[13px] text-left transition-colors",
                    item.active ? "text-orange-500 bg-orange-500/5" : "text-foreground hover:bg-accent"
                  )}>
                  <span className={item.active ? "text-orange-500" : "text-muted-foreground"}>{item.icon}</span>
                  {item.label}
                  {item.active && <Check className="w-3 h-3 ml-auto text-orange-500" />}
                </button>
              ))}
              {/* Insert */}
              <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">Insert</p>
              {[
                { label: "Table",   icon: <Table2 className="w-3.5 h-3.5" />, action: () => { editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); setShowMoreMenu(false); } },
                { label: "Divider", icon: <Minus className="w-3.5 h-3.5" />,  action: () => { editor.chain().focus().setHorizontalRule().run(); setShowMoreMenu(false); } },
                { label: "Link",    icon: <Link2 className="w-3.5 h-3.5" />,  active: editor.isActive("link"), action: () => {
                  if (editor.isActive("link")) { editor.chain().focus().unsetLink().run(); }
                  else {
                    const url = window.prompt("URL:");
                    if (url) editor.chain().focus().setLink({ href: url }).run();
                  }
                  setShowMoreMenu(false);
                }},
              ].map(item => (
                <button key={item.label} onMouseDown={e => { e.preventDefault(); item.action(); }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 text-[13px] text-left transition-colors",
                    (item as { active?: boolean }).active ? "text-orange-500 bg-orange-500/5" : "text-foreground hover:bg-accent"
                  )}>
                  <span className={cn("text-muted-foreground", (item as { active?: boolean }).active && "text-orange-500")}>{item.icon}</span>
                  {item.label}
                </button>
              ))}
              {/* Color */}
              <div className="relative" ref={colorRef}>
                <button onMouseDown={e => { e.preventDefault(); setShowColorPicker(v => !v); }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-[13px] text-left text-foreground hover:bg-accent transition-colors">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Type className="w-3.5 h-3.5" />
                    <Highlighter className="w-3 h-3" />
                  </span>
                  Colors &amp; Highlight
                  <ChevronDown className="w-3 h-3 ml-auto text-muted-foreground/50" />
                </button>
                {showColorPicker && (
                  <div className="absolute top-0 left-full ml-1 z-50 bg-popover border border-border rounded-xl shadow-xl">
                    <ColorPicker editor={editor} onClose={() => setShowColorPicker(false)} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Undo / Redo */}
        <TBtn title={`Undo (${mod}Z)`} onClick={() => editor.chain().focus().undo().run()}>
          <Undo className="w-3.5 h-3.5" />
        </TBtn>
        <TBtn title={`Redo (${mod}⇧Z)`} onClick={() => editor.chain().focus().redo().run()}>
          <Redo className="w-3.5 h-3.5" />
        </TBtn>

        <Divider />

        {/* Word count + reading time */}
        <span className="text-[10px] text-muted-foreground/40 whitespace-nowrap select-none">
          {charCount}w · {readMins}m
        </span>

        <Divider />

        {/* Command palette trigger */}
        <button
          onMouseDown={e => { e.preventDefault(); setShowCmdPalette(true); }}
          title={`Command Palette (${mod}K)`}
          className="flex items-center gap-1 h-7 px-2 rounded-md text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <Search className="w-3 h-3" />
          <span className="text-[10px] opacity-60">{mod}K</span>
        </button>
      </div>

      {/* ── Floating selection bubble ─────────────────────────────────────── */}
      {bubbleVisible && (
        <div
          ref={bubbleRef}
          style={{ top: bubbleCoords.top, left: bubbleCoords.left }}
          className="absolute z-40 flex items-center flex-wrap gap-px bg-popover border border-border rounded-xl shadow-xl p-1 pointer-events-auto"
          onMouseDown={e => e.preventDefault()}
        >
          {/* Formatting */}
          {[
            { title: `Bold (${mod}B)`,       icon: <Bold className="w-3.5 h-3.5" />,          active: editor.isActive("bold"),      run: () => editor.chain().focus().toggleBold().run() },
            { title: `Italic (${mod}I)`,      icon: <Italic className="w-3.5 h-3.5" />,        active: editor.isActive("italic"),    run: () => editor.chain().focus().toggleItalic().run() },
            { title: `Underline (${mod}U)`,   icon: <UnderlineIcon className="w-3.5 h-3.5" />, active: editor.isActive("underline"), run: () => editor.chain().focus().toggleUnderline().run() },
            { title: "Strikethrough",         icon: <Strikethrough className="w-3.5 h-3.5" />, active: editor.isActive("strike"),    run: () => editor.chain().focus().toggleStrike().run() },
          ].map((btn, i) => (
            <button key={i} title={btn.title} onClick={btn.run}
              className={cn("w-7 h-7 rounded-lg flex items-center justify-center transition-colors",
                btn.active ? "bg-orange-500/15 text-orange-500" : "text-muted-foreground hover:text-foreground hover:bg-accent")}>
              {btn.icon}
            </button>
          ))}

          <div className="w-px h-5 bg-border/60 mx-0.5" />

          {/* Color picker in bubble */}
          <div className="relative">
            <button title="Colors &amp; Highlight" onClick={() => setShowColorPicker(v => !v)}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground hover:bg-accent gap-0.5">
              <Type className="w-3.5 h-3.5" />
              <ChevronDown className="w-2.5 h-2.5" />
            </button>
            {showColorPicker && (
              <div className="absolute top-full mt-1 left-0 z-50 bg-popover border border-border rounded-xl shadow-xl">
                <ColorPicker editor={editor} onClose={() => setShowColorPicker(false)} />
              </div>
            )}
          </div>

          {/* Link */}
          <button title="Link"
            onClick={() => {
              if (editor.isActive("link")) { editor.chain().focus().unsetLink().run(); return; }
              const url = window.prompt("URL:");
              if (url) editor.chain().focus().setLink({ href: url }).run();
            }}
            className={cn("w-7 h-7 rounded-lg flex items-center justify-center transition-colors",
              editor.isActive("link") ? "bg-orange-500/15 text-orange-500" : "text-muted-foreground hover:text-foreground hover:bg-accent")}>
            <Link2 className="w-3.5 h-3.5" />
          </button>

          {/* AI writing actions */}
          {onAiAction && (
            <>
              <div className="w-px h-5 bg-border/60 mx-0.5" />
              {AI_WRITING_ACTIONS.map(action => (
                <button key={action.id}
                  title={`AI: ${action.label}`}
                  onClick={() => handleAiSelection(action.id)}
                  disabled={!!aiLoading}
                  className={cn(
                    "flex items-center gap-1 px-2 h-7 rounded-lg text-[11px] font-medium transition-colors",
                    aiLoading === action.id
                      ? "bg-orange-500/15 text-orange-500"
                      : "text-orange-500 hover:bg-orange-500/10 disabled:opacity-40"
                  )}>
                  {action.icon}
                  {action.label}
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {/* ── Editor content ────────────────────────────────────────────────── */}
      <div
        className="flex-1 overflow-y-auto"
        onClick={() => editor.commands.focus()}
      >
        <EditorContent editor={editor} className="h-full" />
      </div>

      {/* ── Table controls ────────────────────────────────────────────────── */}
      {editor.isActive("table") && (
        <div className="px-8 py-2 border-t border-border/30 flex items-center gap-2 flex-wrap bg-muted/10 shrink-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mr-1">Table</p>
          {[
            { label: "+ Row above",  run: () => editor.chain().focus().addRowBefore().run() },
            { label: "+ Row below",  run: () => editor.chain().focus().addRowAfter().run() },
            { label: "– Row",        run: () => editor.chain().focus().deleteRow().run() },
            { label: "+ Col left",   run: () => editor.chain().focus().addColumnBefore().run() },
            { label: "+ Col right",  run: () => editor.chain().focus().addColumnAfter().run() },
            { label: "– Col",        run: () => editor.chain().focus().deleteColumn().run() },
            { label: "Delete table", run: () => editor.chain().focus().deleteTable().run(), danger: true },
          ].map((btn, i) => (
            <button key={i} onClick={btn.run}
              className={cn(
                "px-2 py-0.5 rounded text-[10px] font-medium border transition-colors",
                (btn as { danger?: boolean }).danger
                  ? "border-red-500/30 text-red-500 hover:bg-red-500/10"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-accent"
              )}>
              {btn.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Command Palette ───────────────────────────────────────────────── */}
      {showCmdPalette && (
        <CommandPalette
          editor={editor}
          isMac={isMac}
          onAiAction={onAiAction}
          onClose={() => setShowCmdPalette(false)}
        />
      )}
    </div>
  );
}
