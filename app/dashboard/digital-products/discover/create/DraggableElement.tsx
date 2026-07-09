"use client";

import { useCallback } from "react";
import { Rnd } from "react-rnd";
import { X, ChevronUp, ChevronDown } from "lucide-react";

export interface DraggableElementData {
  id: string;
  type: "icon" | "image";
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
  iconName?: string;
  url?: string;
}

interface DraggableElementProps {
  element: DraggableElementData;
  content: React.ReactNode;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, position: { x: number; y: number }, size: { width: number; height: number }) => void;
  onBringToFront: (id: string) => void;
  onSendToBack: (id: string) => void;
  accentColor?: string;
}

export function DraggableElement({
  element,
  content,
  isSelected,
  onSelect,
  onDelete,
  onUpdate,
  onBringToFront,
  onSendToBack,
  accentColor = "#FF6B35",
}: DraggableElementProps) {
  const handleDragStop = useCallback(
    (_e: unknown, d: { x: number; y: number }) => {
      onUpdate(element.id, { x: d.x, y: d.y }, element.size);
    },
    [element.id, element.size, onUpdate]
  );

  const handleResizeStop = useCallback(
    (_e: unknown, _direction: unknown, elementRef: HTMLElement, _delta: unknown, position: { x: number; y: number }) => {
      const width = parseInt(elementRef.style.width, 10) || element.size.width;
      const height = parseInt(elementRef.style.height, 10) || element.size.height;
      onUpdate(element.id, position, { width, height });
    },
    [element.id, element.size, onUpdate]
  );

  return (
    <Rnd
      position={{ x: element.position.x, y: element.position.y }}
      size={{ width: element.size.width, height: element.size.height }}
      onDragStop={handleDragStop}
      onResizeStop={handleResizeStop}
      onDragStart={() => onSelect(element.id)}
      onResizeStart={() => onSelect(element.id)}
      minWidth={24}
      minHeight={24}
      bounds="parent"
      enableResizing={isSelected ? { bottom: true, right: true, bottomRight: true, top: true, left: true, topLeft: true, topRight: true, bottomLeft: true } : false}
      disableDragging={false}
      style={{ zIndex: element.zIndex }}
      className={isSelected ? "ring-2 ring-orange-500 ring-offset-1 rounded" : "rounded"}
      dragHandleClassName="drag-handle"
      resizeHandleStyles={
        isSelected
          ? {
              bottomRight: {
                width: 12,
                height: 12,
                right: -6,
                bottom: -6,
                background: accentColor,
                borderRadius: 2,
              },
            }
          : {}
      }
    >
      <div
        data-draggable-element
        className="w-full h-full flex items-center justify-center bg-white dark:bg-white/95 border border-gray-200 dark:border-[#2A2A2A] rounded overflow-hidden relative group"
        onClick={() => onSelect(element.id)}
      >
        {/* Delete button - top left */}
        {isSelected && (
          <>
            <button
              type="button"
              aria-label="Delete"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(element.id);
              }}
              className="absolute -top-2 -left-2 z-10 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow hover:bg-red-600"
            >
              <X className="w-3 h-3" />
            </button>
            {/* Layer controls - top right */}
            <div className="absolute -top-2 -right-2 z-10 flex flex-col gap-0.5">
              <button
                type="button"
                aria-label="Bring to front"
                onClick={(e) => {
                  e.stopPropagation();
                  onBringToFront(element.id);
                }}
                className="w-6 h-5 rounded-t bg-[#2A2A2A] text-white flex items-center justify-center hover:bg-[#3A3A3A] text-xs"
              >
                <ChevronUp className="w-3 h-3" />
              </button>
              <button
                type="button"
                aria-label="Send to back"
                onClick={(e) => {
                  e.stopPropagation();
                  onSendToBack(element.id);
                }}
                className="w-6 h-5 rounded-b bg-[#2A2A2A] text-white flex items-center justify-center hover:bg-[#3A3A3A] text-xs"
              >
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>
          </>
        )}

        <div className="w-full h-full flex items-center justify-center pointer-events-none [.drag-handle]:pointer-events-auto">
          {content}
        </div>
      </div>
    </Rnd>
  );
}
