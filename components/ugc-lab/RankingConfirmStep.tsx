"use client";

import { useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GripVertical, Sparkles, Check, Star } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { getRankBadge } from "@/lib/ugc/ranking-templates";

export type RankingProduct = {
  id: string;
  productName: string;
  role: "primary" | "comparison";
  orderIndex: number;
};

type RankingConfirmStepProps = {
  campaignId: string;
  products: RankingProduct[];
  productContext?: string;
  onProductsChange: () => void;
  onRankingConfirmed: () => void;
  isConfirmed: boolean;
};

function SortableRankItem({
  product,
  rankIndex,
}: {
  product: RankingProduct;
  rankIndex: number;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: product.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded border p-2 text-sm bg-white dark:bg-slate-900 ${
        isDragging ? "opacity-50 shadow-lg z-10" : ""
      } border-slate-200 dark:border-slate-700`}
    >
      <button
        type="button"
        className="touch-none cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 p-1 -ml-1"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <span className="text-lg flex-shrink-0" aria-hidden>
        {getRankBadge(rankIndex)}
      </span>
      <span className="flex-1 truncate font-medium text-slate-900 dark:text-white">
        {product.productName}
      </span>
      {product.role === "primary" && (
        <span className="flex-shrink-0 inline-flex items-center gap-1 rounded bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-200">
          <Star className="w-3 h-3" /> Winner
        </span>
      )}
    </div>
  );
}

export function RankingConfirmStep({
  campaignId,
  products,
  productContext,
  onProductsChange,
  onRankingConfirmed,
  isConfirmed,
}: RankingConfirmStepProps) {
  const [items, setItems] = useState<RankingProduct[]>(() =>
    [...products].sort((a, b) => a.orderIndex - b.orderIndex)
  );
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((p) => p.id === active.id);
    const newIndex = items.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(items, oldIndex, newIndex);
    setItems(reordered);

    const productIds = reordered.map((p) => p.id);
    try {
      const res = await fetch(`/api/ugc-lab/campaigns/${campaignId}/products/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed");
      }
      onProductsChange();
    } catch (err) {
      toast({
        title: "Reorder failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
      setItems(products.sort((a, b) => a.orderIndex - b.orderIndex));
    }
  };

  const handleSuggest = async () => {
    setSuggestLoading(true);
    try {
      const res = await fetch(`/api/ugc-lab/campaigns/${campaignId}/suggest-ranking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productContext: productContext?.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      const ids = data.productIds as string[] | undefined;
      if (!Array.isArray(ids) || ids.length === 0) return;

      const ordered = ids
        .map((id) => items.find((p) => p.id === id))
        .filter((p): p is RankingProduct => !!p);
      const missing = items.filter((p) => !ids.includes(p.id));
      const newOrder = [...ordered, ...missing];

      setItems(newOrder);

      const reorderRes = await fetch(`/api/ugc-lab/campaigns/${campaignId}/products/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds: newOrder.map((p) => p.id) }),
      });
      if (reorderRes.ok) onProductsChange();
      toast({ title: "AI suggested order applied" });
    } catch (err) {
      toast({
        title: "Suggest failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSuggestLoading(false);
    }
  };

  const handleConfirm = async () => {
    setConfirmLoading(true);
    try {
      const productIds = items.map((p) => p.id);
      const res = await fetch(`/api/ugc-lab/campaigns/${campaignId}/products/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed");
      }
      onRankingConfirmed();
      toast({ title: "Ranking confirmed" });
    } catch (err) {
      toast({
        title: "Confirm failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setConfirmLoading(false);
    }
  };

  const productsKey = [...products]
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((p) => `${p.id}:${p.orderIndex}`)
    .join("|");
  useEffect(() => {
    const sorted = [...products].sort((a, b) => a.orderIndex - b.orderIndex);
    setItems(sorted);
  }, [campaignId, productsKey]);

  if (products.length < 2) return null;

  return (
    <Card className="flex-shrink-0">
      <CardHeader className="py-3">
        <CardTitle className="text-sm font-medium">Ranking order</CardTitle>
        <CardDescription className="text-xs">
          Drag to reorder. Confirm before generating.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={items.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {items.map((product, i) => (
                <SortableRankItem key={product.id} product={product} rankIndex={i} />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 gap-2"
            onClick={handleSuggest}
            disabled={suggestLoading}
          >
            {suggestLoading ? "Suggesting…" : (
              <>
                <Sparkles className="w-4 h-4" />
                Suggest order
              </>
            )}
          </Button>
          <Button
            size="sm"
            className="flex-1 gap-2"
            onClick={handleConfirm}
            disabled={confirmLoading || isConfirmed}
          >
            {confirmLoading ? "Confirming…" : (
              <>
                <Check className="w-4 h-4" />
                {isConfirmed ? "Confirmed" : "Confirm ranking"}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
