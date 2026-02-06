"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Bold, Italic, List, ListOrdered, Heading2 } from "lucide-react";

const extensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
  }),
];

function Toolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;
  return (
    <div className="flex flex-wrap items-center gap-1 p-2 border-b border-[#2A2A2A] bg-[#0F0F0F] rounded-t-lg">
      <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-[#E0E0E0]" onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className={`w-4 h-4 ${editor.isActive("bold") ? "text-orange-500" : ""}`} />
      </Button>
      <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-[#E0E0E0]" onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className={`w-4 h-4 ${editor.isActive("italic") ? "text-orange-500" : ""}`} />
      </Button>
      <span className="w-px h-5 bg-[#2A2A2A] mx-0.5" />
      <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-[#E0E0E0]" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 className={`w-4 h-4 ${editor.isActive("heading", { level: 2 }) ? "text-orange-500" : ""}`} />
      </Button>
      <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-[#E0E0E0]" onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List className={`w-4 h-4 ${editor.isActive("bulletList") ? "text-orange-500" : ""}`} />
      </Button>
      <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-[#E0E0E0]" onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className={`w-4 h-4 ${editor.isActive("orderedList") ? "text-orange-500" : ""}`} />
      </Button>
    </div>
  );
}

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

export function RichTextEditor({ value, onChange, placeholder, className, minHeight = "200px" }: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: value,
    editorProps: {
      attributes: {
        class: "prose prose-invert max-w-none min-h-[120px] px-3 py-2 text-[#E0E0E0] focus:outline-none",
      },
      handleDOMEvents: {
        paste: (view, event) => {
          const text = event.clipboardData?.getData("text/plain");
          if (text) {
            event.preventDefault();
            const { state } = view;
            const tr = state.tr.insertText(text);
            view.dispatch(tr);
            return true;
          }
          return false;
        },
      },
    },
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const next = value || "";
    if (current !== next) {
      editor.commands.setContent(next, false);
    }
  }, [value, editor]);

  return (
    <div className={`rounded-lg border border-[#2A2A2A] bg-[#0F0F0F] overflow-hidden ${className ?? ""}`}>
      <Toolbar editor={editor} />
      <div style={{ minHeight }}>
        <EditorContent editor={editor} />
      </div>
      <style jsx global>{`
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #666;
          pointer-events: none;
        }
        .ProseMirror ul,
        .ProseMirror ol {
          padding-left: 1.5rem;
        }
      `}</style>
    </div>
  );
}

/** Use in preview: render body as HTML if it looks like HTML, else plain text with newlines */
export function sectionBodyToHtml(body: string): string | null {
  const t = body.trimStart();
  if (t.startsWith("<")) return body;
  return null;
}
