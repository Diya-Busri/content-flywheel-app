"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  X,
  Plus,
  Heading,
  Type,
  Video as VideoIcon,
  Image as ImageIcon,
  Download,
  CheckSquare,
  Minus,
  MessageSquare,
  MousePointerClick,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  type Block,
  type BlockType,
  BLOCK_TYPE_LABELS,
  newBlock,
} from "@/lib/academy-blocks";
import { VideoUploadZone } from "./video-upload-zone";
import { ImageUploadZone } from "./image-upload-zone";
import { FileUploadZone } from "./file-upload-zone";

const BLOCK_TYPES: { type: BlockType; icon: React.ReactNode }[] = [
  { type: "heading", icon: <Heading className="h-4 w-4" /> },
  { type: "text", icon: <Type className="h-4 w-4" /> },
  { type: "video", icon: <VideoIcon className="h-4 w-4" /> },
  { type: "image", icon: <ImageIcon className="h-4 w-4" /> },
  { type: "download", icon: <Download className="h-4 w-4" /> },
  { type: "checklist", icon: <CheckSquare className="h-4 w-4" /> },
  { type: "callout", icon: <MessageSquare className="h-4 w-4" /> },
  { type: "button", icon: <MousePointerClick className="h-4 w-4" /> },
  { type: "divider", icon: <Minus className="h-4 w-4" /> },
];

export function BlockEditor({
  blocks,
  onChange,
}: {
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function update(id: string, patch: Partial<Block>) {
    onChange(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }
  function remove(id: string) {
    onChange(blocks.filter((b) => b.id !== id));
  }
  function add(type: BlockType) {
    onChange([...blocks, newBlock(type)]);
  }
  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = blocks.findIndex((b) => b.id === active.id);
    const newIndex = blocks.findIndex((b) => b.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onChange(arrayMove(blocks, oldIndex, newIndex));
  }

  return (
    <div className="space-y-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {blocks.map((block) => (
              <SortableBlock
                key={block.id}
                block={block}
                onUpdate={(patch) => update(block.id, patch)}
                onRemove={() => remove(block.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {blocks.length === 0 && (
        <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          No content blocks yet. Add one below.
        </p>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Plus className="mr-1.5 h-4 w-4" /> Add Block
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {BLOCK_TYPES.map(({ type, icon }) => (
            <DropdownMenuItem key={type} onClick={() => add(type)} className="gap-2">
              {icon} {BLOCK_TYPE_LABELS[type]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function SortableBlock({
  block,
  onUpdate,
  onRemove,
}: {
  block: Block;
  onUpdate: (patch: Partial<Block>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex gap-2 rounded-lg border bg-card p-2">
      <button
        type="button"
        className="mt-1 cursor-grab text-muted-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">
        <BlockFields block={block} onUpdate={onUpdate} />
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {BLOCK_TYPE_LABELS[block.type]}
        </span>
        <Button size="sm" variant="ghost" onClick={onRemove}>
          <X className="h-4 w-4 text-red-500" />
        </Button>
      </div>
    </div>
  );
}

function BlockFields({
  block,
  onUpdate,
}: {
  block: Block;
  onUpdate: (patch: Partial<Block>) => void;
}) {
  switch (block.type) {
    case "heading":
      return (
        <div className="flex gap-2">
          <Input
            value={block.content ?? ""}
            onChange={(e) => onUpdate({ content: e.target.value })}
            placeholder="Heading text"
            className="flex-1 font-semibold"
          />
          <Select
            value={String(block.level ?? 2)}
            onValueChange={(v) => onUpdate({ level: Number(v) as 1 | 2 | 3 })}
          >
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">H1</SelectItem>
              <SelectItem value="2">H2</SelectItem>
              <SelectItem value="3">H3</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );
    case "text":
      return (
        <Textarea
          value={block.content ?? ""}
          onChange={(e) => onUpdate({ content: e.target.value })}
          placeholder="Write some text…"
          rows={3}
        />
      );
    case "video":
      return (
        <VideoUploadZone
          value={block.videoUrl}
          videoType={block.videoType}
          onChange={(url, type) => onUpdate({ videoUrl: url, videoType: type })}
        />
      );
    case "image":
      return (
        <div className="space-y-2">
          <ImageUploadZone value={block.imageUrl} onChange={(url) => onUpdate({ imageUrl: url })} />
          <Input
            value={block.imageAlt ?? ""}
            onChange={(e) => onUpdate({ imageAlt: e.target.value })}
            placeholder="Caption / alt text (optional)"
          />
        </div>
      );
    case "download":
      return (
        <div className="space-y-2">
          <Input
            value={block.downloadLabel ?? ""}
            onChange={(e) => onUpdate({ downloadLabel: e.target.value })}
            placeholder="Download label (e.g. Worksheet.pdf)"
          />
          <FileUploadZone
            value={block.downloadUrl}
            fileName={block.downloadLabel}
            onChange={(url, meta) =>
              onUpdate({
                downloadUrl: url,
                fileType: meta.fileType,
                downloadLabel: block.downloadLabel || meta.name,
              })
            }
          />
        </div>
      );
    case "checklist": {
      const items = block.items ?? [];
      return (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={item}
                onChange={(e) => {
                  const next = [...items];
                  next[i] = e.target.value;
                  onUpdate({ items: next });
                }}
                placeholder={`Item ${i + 1}`}
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onUpdate({ items: items.filter((_, idx) => idx !== i) })}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => onUpdate({ items: [...items, ""] })}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add item
          </Button>
        </div>
      );
    }
    case "divider":
      return <hr className="my-2 border-border" />;
    case "callout":
      return (
        <div className="space-y-2">
          <Select
            value={block.calloutType ?? "info"}
            onValueChange={(v) => onUpdate({ calloutType: v as Block["calloutType"] })}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="tip">Tip</SelectItem>
            </SelectContent>
          </Select>
          <Textarea
            value={block.content ?? ""}
            onChange={(e) => onUpdate({ content: e.target.value })}
            placeholder="Callout text…"
            rows={2}
          />
        </div>
      );
    case "button":
      return (
        <div className="space-y-2">
          <Input
            value={block.buttonLabel ?? ""}
            onChange={(e) => onUpdate({ buttonLabel: e.target.value })}
            placeholder="Button label"
          />
          <Input
            value={block.buttonUrl ?? ""}
            onChange={(e) => onUpdate({ buttonUrl: e.target.value })}
            placeholder="https://..."
          />
        </div>
      );
    default:
      return null;
  }
}
