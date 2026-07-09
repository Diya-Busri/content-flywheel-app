"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Package, Loader2, ExternalLink, Copy } from "lucide-react";

type HistoryItem = {
  id: string;
  productId?: string;
  productTitle: string;
  formatType: string;
  status: string;
  createdAt?: string;
};

const FORMAT_LABELS: Record<string, string> = {
  ebook: "Ebook",
  guide: "Guide",
  workbook: "Workbook",
  spreadsheet: "Spreadsheet",
  notion: "Notion",
  course: "Course",
  checklist: "Checklist",
  journal: "Journal",
  planner: "Planner",
  template: "Template",
};

function formatLabel(formatType: string): string {
  return FORMAT_LABELS[formatType] ?? formatType;
}

function formatDate(iso?: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function HistoryClient() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/product-history");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      toast({
        title: "Error",
        description: "Could not load history",
        variant: "destructive",
      });
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleOpen = (productId: string | undefined) => {
    if (!productId) {
      toast({
        title: "Cannot open",
        description: "Use Duplicate to create a new copy you can edit.",
        variant: "destructive",
      });
      return;
    }
    router.push(`/dashboard/digital-products/${productId}/edit`);
  };

  const handleDuplicate = async (historyId: string) => {
    setDuplicatingId(historyId);
    try {
      const res = await fetch("/api/product-history/duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ historyId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Duplicate failed",
          description: data.error ?? "Something went wrong",
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Duplicated", description: "Opening the new product." });
      if (data.productId) {
        router.push(`/dashboard/digital-products/${data.productId}/edit`);
      }
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to duplicate",
        variant: "destructive",
      });
    } finally {
      setDuplicatingId(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No history yet</p>
          <p className="text-sm mt-1">
            Generate a product from Digital Products → Discover to see it here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <Card key={item.id} className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-base truncate" title={item.productTitle}>
              {item.productTitle}
            </CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-2 mt-1">
              <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium">
                {formatLabel(item.formatType)}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDate(item.createdAt)}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 mt-auto flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="default"
              className="flex-1 min-w-0"
              onClick={() => handleOpen(item.productId)}
              disabled={!item.productId}
            >
              <ExternalLink className="w-3.5 h-3.5 mr-2" />
              Open
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 min-w-0"
              onClick={() => handleDuplicate(item.id)}
              disabled={duplicatingId !== null}
            >
              {duplicatingId === item.id ? (
                <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
              ) : (
                <Copy className="w-3.5 h-3.5 mr-2" />
              )}
              Duplicate
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
