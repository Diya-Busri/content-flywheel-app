"use client";

import { useEditor, EditorContent, ReactRenderer, Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/extension-bubble-menu";
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

import {
  useState, useEffect, useCallback, useRef, forwardRef,
  useImperativeHandle, KeyboardEvent,
} from "react";
import { cn } from "@/lib/utils";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Code, Link2, Wand2, Sparkles, AlignLeft, ChevronDown, Check,
  Heading1, Heading2, Heading3, Heading4, List, ListOrdered,
  CheckSquare, Quote, Minus, Table2, Type,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface NoteRef {
  id: string;
  title: string;
}

export interface NoteEditorProps {
  content: string;            // TipTap JSON string (or legacy markdown plain text)
  isLegacy?: boolean;         // If true, treat content as plain text (old note)
  onUpdate: (json: string, text: string) => void;
  allNotes: NoteRef[];        // For @mention lookup
  noteId: string;
  placeholder?: string;
  className?: string;
  fontSize?: string;
  fontFamily?: string;
  onAiAction?: (action: string, selectedText: string, replaceCallback: (result: string) => void) => void;
}

// ─── Slash command items ────────────────────────────────────────────────────────

const SLASH_ITEMS = [
  { title: "Heading 1",      description: "Large section heading", icon: "H1",  group: "Text",   command: (e: Editor, r: Range) => { e.chain().focus().deleteRange(r).setHeading({ level: 1 }).run(); } },
  { title: "Heading 2",      description: "Medium section heading", icon: "H2", group: "Text",   command: (e: Editor, r: Range) => { e.chain().focus().deleteRange(r).setHeading({ level: 2 }).run(); } },
  { title: "Heading 3",      description: "Small section heading",  icon: "H3", group: "Text",   command: (e: Editor, r: Range) => { e.chain().focus().deleteRange(r).setHeading({ level: 3 }).run(); } },
  { title: "Heading 4",      description: "Subtle heading",         icon: "H4", group: "Text",   command: (e: Editor, r: Range) => { e.chain().focus().deleteRange(r).setHeading({ level: 4 }).run(); } },
  { title: "Bullet List",    description: "Unordered list",         icon: "•",  group: "List",   command: (e: Editor, r: Range) => { e.chain().focus().deleteRange(r).toggleBulletList().run(); } },
  { title: "Numbered List",  description: "Ordered list",           icon: "1.", group: "List",   command: (e: Editor, r: Range) => { e.chain().focus().deleteRange(r).toggleOrderedList().run(); } },
  { title: "Task List",      description: "Checklist with checkboxes", icon: "☐", group: "List", command: (e: Editor, r: Range) => { e.chain().focus().deleteRange(r).toggleTaskList().run(); } },
  { title: "Quote",          description: "Blockquote",             icon: "❝",  group: "Block",  command: (e: Editor, r: Range) => { e.chain().focus().deleteRange(r).toggleBlockquote().run(); } },
  { title: "Code Block",     description: "Multiline code",         icon: "</>",group: "Block",  command: (e: Editor, r: Range) => { e.chain().focus().deleteRange(r).toggleCodeBlock().run(); } },
  { title: "Table",          description: "3×3 table",              icon: "⊞",  group: "Block",  command: (e: Editor, r: Range) => { e.chain().focus().deleteRange(r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); } },
  { title: "Divider",        description: "Horizontal rule",        icon: "─",  group: "Block",  command: (e: Editor, r: Range) => { e.chain().focus().deleteRange(r).setHorizontalRule().run(); } },
];

interface Range { from: number; to: number; }

// ─── Slash command list component ──────────────────────────────────────────────

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
        if (event.key === "ArrowUp") { setSelectedIndex(i => (i + items.length - 1) % items.length); return true; }
        if (event.key === "ArrowDown") { setSelectedIndex(i => (i + 1) % items.length); return true; }
        if (event.key === "Enter") { selectItem(selectedIndex); return true; }
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

// ─── Slash command extension ────────────────────────────────────────────────────

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

// ─── @Mention list component ────────────────────────────────────────────────────

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
        if (event.key === "ArrowUp") { setSelectedIndex(i => (i + items.length - 1) % items.length); return true; }
        if (event.key === "ArrowDown") { setSelectedIndex(i => (i + 1) % items.length); return true; }
        if (event.key === "Enter") { selectItem(selectedIndex); return true; }
        return false;
      },
    }));

    useEffect(() => setSelectedIndex(0), [items]);

    const CREATE_ID = "__create__";

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
            onClick={() => command({ id: CREATE_ID, label: query.trim() })}
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

// ─── Preset colours ─────────────────────────────────────────────────────────────

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

// ─── Colour picker popup ────────────────────────────────────────────────────────

function ColorPicker({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  return (
    <div className="p-3 w-52 space-y-3" onClick={e => e.stopPropagation()}>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Text Color</p>
        <div className="flex flex-wrap gap-1.5">
          {TEXT_COLORS.map(c => (
            <button key={c.value} title={c.label}
              onClick={() => { c.value ? editor.chain().focus().setColor(c.value).run() : editor.chain().focus().unsetColor().run(); onClose(); }}
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
              onClick={() => { c.value ? editor.chain().focus().setHighlight({ color: c.value }).run() : editor.chain().focus().unsetHighlight().run(); onClose(); }}
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

// ─── AI selection actions ────────────────────────────────────────────────────────

const AI_SELECTION_ACTIONS = [
  { id: "improve-writing", label: "Improve", icon: <Wand2 className="w-3 h-3" /> },
  { id: "shorten",         label: "Shorten",  icon: <AlignLeft className="w-3 h-3" /> },
  { id: "expand-idea",     label: "Expand",   icon: <Sparkles className="w-3 h-3" /> },
];

// ─── Main NoteEditor component ──────────────────────────────────────────────────

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
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [aiSelectionLoading, setAiSelectionLoading] = useState<string | null>(null);
  const allNotesRef = useRef(allNotes);
  allNotesRef.current = allNotes;

  // Parse content for the editor
  const getInitialContent = () => {
    if (!content) return "";
    if (isLegacy) {
      // Legacy markdown → plain text paragraph
      return content;
    }
    try {
      return JSON.parse(content);
    } catch {
      // Fallback: treat as plain text
      return content;
    }
  };

  const SlashCommandExtension = createSlashCommandExtension();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
        codeBlock: {},
      }),
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
      Mention.configure({
        HTMLAttributes: { class: "note-mention" },
        suggestion: {
          items: ({ query }: { query: string }) => {
            const filtered = allNotesRef.current
              .filter(n => n.id !== noteId && n.title.toLowerCase().includes(query.toLowerCase()))
              .slice(0, 8);
            return filtered;
          },
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
          "note-editor-content outline-none min-h-[200px] px-8 py-6 focus:outline-none",
          fontSize,
          fontFamily,
        ),
      },
    },
    onUpdate: ({ editor }) => {
      onUpdate(JSON.stringify(editor.getJSON()), editor.getText({ blockSeparator: "\n" }));
    },
    immediatelyRender: false,
  }, [noteId]);

  // Handle AI action on selected text
  const handleAiSelection = useCallback(async (actionId: string) => {
    if (!editor || !onAiAction) return;
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, " ");
    if (!selectedText.trim()) return;
    setAiSelectionLoading(actionId);
    onAiAction(actionId, selectedText, (result) => {
      editor.chain().focus().insertContentAt({ from, to }, result).run();
      setAiSelectionLoading(null);
    });
  }, [editor, onAiAction]);

  if (!editor) return null;

  return (
    <div className={cn("relative flex-1 flex flex-col overflow-hidden", className)}>
      {/* ── Bubble Menu ──────────────────────────────────────────────── */}
      <BubbleMenu
        editor={editor}
        tippyOptions={{ duration: 100, placement: "top", theme: "none", arrow: false }}
        className="bubble-menu flex items-center gap-px bg-popover border border-border rounded-xl shadow-xl p-1 overflow-visible"
      >
        {/* Formatting group */}
        {[
          { title: "Bold (⌘B)",          icon: <Bold className="w-3.5 h-3.5" />,          active: editor.isActive("bold"),         run: () => editor.chain().focus().toggleBold().run() },
          { title: "Italic (⌘I)",         icon: <Italic className="w-3.5 h-3.5" />,        active: editor.isActive("italic"),       run: () => editor.chain().focus().toggleItalic().run() },
          { title: "Underline (⌘U)",      icon: <UnderlineIcon className="w-3.5 h-3.5" />, active: editor.isActive("underline"),    run: () => editor.chain().focus().toggleUnderline().run() },
          { title: "Strikethrough",       icon: <Strikethrough className="w-3.5 h-3.5" />, active: editor.isActive("strike"),       run: () => editor.chain().focus().toggleStrike().run() },
          { title: "Inline Code (⌘K)",    icon: <Code className="w-3.5 h-3.5" />,          active: editor.isActive("code"),         run: () => editor.chain().focus().toggleCode().run() },
        ].map((btn, i) => (
          <button key={i} title={btn.title} onClick={btn.run}
            className={cn(
              "w-7 h-7 rounded-lg flex items-center justify-center transition-colors",
              btn.active ? "bg-orange-500/15 text-orange-500" : "text-muted-foreground hover:text-foreground hover:bg-accent"
            )}>
            {btn.icon}
          </button>
        ))}

        <div className="w-px h-5 bg-border/60 mx-0.5" />

        {/* Color */}
        <div className="relative">
          <button title="Text color & highlight"
            onClick={() => setShowColorPicker(v => !v)}
            className={cn("w-7 h-7 rounded-lg flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground hover:bg-accent gap-0.5")}>
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
        <button title="Add link"
          onClick={() => {
            const url = window.prompt("URL:");
            if (url) editor.chain().focus().setLink({ href: url }).run();
          }}
          className={cn("w-7 h-7 rounded-lg flex items-center justify-center transition-colors",
            editor.isActive("link") ? "bg-orange-500/15 text-orange-500" : "text-muted-foreground hover:text-foreground hover:bg-accent")}>
          <Link2 className="w-3.5 h-3.5" />
        </button>

        {onAiAction && (
          <>
            <div className="w-px h-5 bg-border/60 mx-0.5" />
            {AI_SELECTION_ACTIONS.map(action => (
              <button key={action.id} title={`AI: ${action.label}`}
                onClick={() => handleAiSelection(action.id)}
                disabled={!!aiSelectionLoading}
                className={cn(
                  "flex items-center gap-1 px-2 h-7 rounded-lg text-[11px] font-medium transition-colors",
                  aiSelectionLoading === action.id
                    ? "bg-orange-500/15 text-orange-500"
                    : "text-orange-500 hover:bg-orange-500/10 disabled:opacity-40"
                )}>
                {action.icon}
                {action.label}
              </button>
            ))}
          </>
        )}
      </BubbleMenu>

      {/* ── Editor content ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto" onClick={() => editor.commands.focus()}>
        <EditorContent editor={editor} className="h-full" />
      </div>

      {/* Table controls (shown when cursor is in table) */}
      {editor.isActive("table") && (
        <div className="px-8 py-2 border-t border-border/30 flex items-center gap-2 flex-wrap bg-muted/10">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mr-1">Table</p>
          {[
            { label: "+ Row above", run: () => editor.chain().focus().addRowBefore().run() },
            { label: "+ Row below", run: () => editor.chain().focus().addRowAfter().run() },
            { label: "– Row",       run: () => editor.chain().focus().deleteRow().run() },
            { label: "+ Col left",  run: () => editor.chain().focus().addColumnBefore().run() },
            { label: "+ Col right", run: () => editor.chain().focus().addColumnAfter().run() },
            { label: "– Col",       run: () => editor.chain().focus().deleteColumn().run() },
            { label: "Delete table",run: () => editor.chain().focus().deleteTable().run(), danger: true },
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
    </div>
  );
}
