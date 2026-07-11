"use client";

/**
 * Template Builder — scene list with drag-and-drop reordering (dnd-kit,
 * matching the pattern already used in components/academy/sortable-module-list.tsx).
 */

import React from "react";
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
import { Button } from "@/components/ui/button";
import { GripVertical, Plus, Copy, Trash2 } from "lucide-react";
import type { Scene } from "@/lib/motion-graphics/types";

function sceneSwatch(scene: Scene): string {
  if (scene.background.type === "color" || scene.background.type === "gradient") return scene.background.value;
  return "linear-gradient(135deg,#333,#111)";
}

const SortableSceneItem: React.FC<{
  scene: Scene;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}> = ({ scene, index, selected, onSelect, onDuplicate, onDelete }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: scene.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`rounded-lg border p-2.5 cursor-pointer transition-colors ${
        selected ? "border-orange-500 bg-orange-50 dark:bg-orange-500/10" : "hover:bg-black/5 dark:hover:bg-white/5"
      }`}
    >
      <div className="flex items-center gap-2">
        <button type="button" className="cursor-grab text-muted-foreground shrink-0" {...attributes} {...listeners}>
          <GripVertical size={14} />
        </button>
        <div className="w-9 h-14 rounded shrink-0" style={{ background: sceneSwatch(scene) }} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">
            {index + 1}. {scene.name}
          </p>
          <p className="text-[11px] text-muted-foreground">{(scene.durationInFrames / 30).toFixed(1)}s</p>
        </div>
        <div className="flex flex-col gap-0.5 shrink-0">
          <button onClick={(e) => { e.stopPropagation(); onDuplicate(); }} className="p-1 text-muted-foreground hover:text-foreground" title="Duplicate scene">
            <Copy size={12} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1 text-muted-foreground hover:text-destructive" title="Delete scene">
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  );
};

export const SceneList: React.FC<{
  scenes: Scene[];
  selectedSceneId: string | null;
  onSelect: (id: string) => void;
  onReorder: (scenes: Scene[]) => void;
  onAdd: () => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}> = ({ scenes, selectedSceneId, onSelect, onReorder, onAdd, onDuplicate, onDelete }) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = scenes.findIndex((s) => s.id === active.id);
    const newIndex = scenes.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(scenes, oldIndex, newIndex).map((s, i) => ({ ...s, order: i }));
    onReorder(reordered);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Scenes</p>
        <Button size="sm" variant="outline" onClick={onAdd}>
          <Plus size={13} className="mr-1" />
          Add
        </Button>
      </div>

      {scenes.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">No scenes yet — add one to get started.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={scenes.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-1.5">
              {scenes.map((scene, i) => (
                <SortableSceneItem
                  key={scene.id}
                  scene={scene}
                  index={i}
                  selected={scene.id === selectedSceneId}
                  onSelect={() => onSelect(scene.id)}
                  onDuplicate={() => onDuplicate(scene.id)}
                  onDelete={() => onDelete(scene.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
};
