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
import Link from "next/link";
import { GripVertical, Plus, Trash2, Pencil, Loader2, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createModuleAction,
  updateModuleAction,
  deleteModuleAction,
  reorderModulesAction,
  createLessonAction,
  updateLessonAction,
  deleteLessonAction,
  reorderLessonsAction,
} from "@/actions/academy-actions";
import { BlockEditor } from "./block-editor";
import {
  type Block,
  parseLessonBlocks,
  serializeLessonBlocks,
} from "@/lib/academy-blocks";

type AnyRow = Record<string, any>;
type Run = (
  fn: () => Promise<{ isSuccess: boolean; message: string }>,
  msg?: string
) => Promise<boolean>;

export function SortableModuleList({
  course,
  modules,
  lessons,
  pending,
  run,
}: {
  course: AnyRow;
  modules: AnyRow[];
  lessons: AnyRow[];
  pending: boolean;
  run: Run;
}) {
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const sorted = [...modules].sort((a, b) => a.orderIndex - b.orderIndex);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = sorted.findIndex((m) => m.id === active.id);
    const newIndex = sorted.findIndex((m) => m.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(sorted, oldIndex, newIndex);
    run(() => reorderModulesAction(reordered.map((m) => m.id)), "Reordered");
  }

  return (
    <div className="rounded-lg border bg-background/50 p-3">
      <h3 className="mb-2 text-sm font-semibold text-foreground">Modules</h3>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sorted.map((m) => m.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {sorted.map((mod) => (
              <SortableModule
                key={mod.id}
                course={course}
                mod={mod}
                lessons={lessons.filter((l) => l.moduleId === mod.id)}
                pending={pending}
                run={run}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="mt-3 flex items-end gap-2">
        <div className="flex-1">
          <label className="text-xs text-muted-foreground">New module</label>
          <Input
            value={newModuleTitle}
            onChange={(e) => setNewModuleTitle(e.target.value)}
            placeholder="Module title"
          />
        </div>
        <Button
          disabled={pending || !newModuleTitle.trim()}
          onClick={async () => {
            const ok = await run(
              () => createModuleAction({ courseId: course.id, title: newModuleTitle.trim() }),
              "Module added"
            );
            if (ok) setNewModuleTitle("");
          }}
        >
          <Plus className="mr-1 h-4 w-4" />Add
        </Button>
      </div>
    </div>
  );
}

function SortableModule({
  course,
  mod,
  lessons,
  pending,
  run,
}: {
  course: AnyRow;
  mod: AnyRow;
  lessons: AnyRow[];
  pending: boolean;
  run: Run;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: mod.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="cursor-grab text-muted-foreground active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <Input
          defaultValue={mod.title}
          className="flex-1"
          onBlur={(e) => {
            if (e.target.value !== mod.title)
              run(() => updateModuleAction(mod.id, { title: e.target.value }), "Module updated");
          }}
        />
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            if (confirm("Delete module and its lessons?")) run(() => deleteModuleAction(mod.id));
          }}
        >
          <Trash2 className="h-4 w-4 text-red-500" />
        </Button>
      </div>

      <LessonList course={course} moduleId={mod.id} lessons={lessons} pending={pending} run={run} />
    </div>
  );
}

function LessonList({
  course,
  moduleId,
  lessons,
  pending,
  run,
}: {
  course: AnyRow;
  moduleId: string;
  lessons: AnyRow[];
  pending: boolean;
  run: Run;
}) {
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const sorted = [...lessons].sort((a, b) => a.orderIndex - b.orderIndex);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = sorted.findIndex((l) => l.id === active.id);
    const newIndex = sorted.findIndex((l) => l.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(sorted, oldIndex, newIndex);
    run(() => reorderLessonsAction(reordered.map((l) => l.id)), "Reordered");
  }

  return (
    <div className="ml-6 mt-2 space-y-2 border-l pl-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sorted.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          {sorted.map((lesson) => (
            <SortableLesson
              key={lesson.id}
              lesson={lesson}
              course={course}
              isEditing={editing === lesson.id}
              onToggleEdit={() => setEditing(editing === lesson.id ? null : lesson.id)}
              pending={pending}
              run={run}
              onSaved={() => setEditing(null)}
            />
          ))}
        </SortableContext>
      </DndContext>

      {showNew ? (
        <LessonForm
          initial={{}}
          pending={pending}
          onSave={async (data) => {
            const ok = await run(
              () => createLessonAction({ ...data, courseId: course.id, moduleId, title: data.title } as any),
              "Lesson added"
            );
            if (ok) setShowNew(false);
          }}
          onCancel={() => setShowNew(false)}
        />
      ) : (
        <Button size="sm" variant="outline" onClick={() => setShowNew(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" />Add lesson
        </Button>
      )}
    </div>
  );
}

function SortableLesson({
  lesson,
  course,
  isEditing,
  onToggleEdit,
  pending,
  run,
  onSaved,
}: {
  lesson: AnyRow;
  course: AnyRow;
  isEditing: boolean;
  onToggleEdit: () => void;
  pending: boolean;
  run: Run;
  onSaved: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lesson.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="rounded-md border bg-background/50 p-2">
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="cursor-grab text-muted-foreground active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <span className="flex-1 text-sm text-foreground">{lesson.title}</span>
        {!lesson.isPublished && <span className="text-[10px] text-muted-foreground">(draft)</span>}
        <Button asChild size="sm" variant="ghost" title="Open full lesson editor">
          <Link href={`/dashboard/academy/admin/courses/${course.id}/lessons/${lesson.id}`}>
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </Button>
        <Button size="sm" variant="ghost" onClick={onToggleEdit}>
          {isEditing ? <ChevronUp className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            if (confirm("Delete lesson?")) run(() => deleteLessonAction(lesson.id));
          }}
        >
          <Trash2 className="h-3.5 w-3.5 text-red-500" />
        </Button>
      </div>

      {isEditing && (
        <LessonForm
          initial={lesson}
          pending={pending}
          onSave={async (data) => {
            const ok = await run(() => updateLessonAction(lesson.id, data as any), "Lesson updated");
            if (ok) onSaved();
          }}
        />
      )}
    </div>
  );
}

function LessonForm({
  initial,
  pending,
  onSave,
  onCancel,
}: {
  initial: AnyRow;
  pending: boolean;
  onSave: (data: AnyRow) => void;
  onCancel?: () => void;
}) {
  const [title, setTitle] = useState(initial.title ?? "");
  const [lessonType, setLessonType] = useState(initial.lessonType ?? "mixed");
  const [durationMinutes, setDurationMinutes] = useState(
    initial.durationMinutes != null ? String(initial.durationMinutes) : ""
  );
  const [isPublished, setIsPublished] = useState(initial.isPublished ?? true);
  const [blocks, setBlocks] = useState<Block[]>(() => parseLessonBlocks(initial.content));

  return (
    <div className="mt-2 grid gap-3">
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Lesson title" />

      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Content</label>
        <BlockEditor blocks={blocks} onChange={setBlocks} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={lessonType} onValueChange={setLessonType}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="video">Video</SelectItem>
            <SelectItem value="text">Text</SelectItem>
            <SelectItem value="mixed">Mixed</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="number"
          value={durationMinutes}
          onChange={(e) => setDurationMinutes(e.target.value)}
          placeholder="Minutes"
          className="w-28"
        />
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={isPublished}
            onChange={(e) => setIsPublished(e.target.checked)}
          />
          Published
        </label>
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={pending || !title.trim()}
          onClick={() =>
            onSave({
              title: title.trim(),
              content: serializeLessonBlocks(blocks),
              lessonType,
              durationMinutes: durationMinutes ? Number(durationMinutes) : null,
              isPublished,
            })
          }
        >
          {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Save
        </Button>
        {onCancel && (
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
