"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Package, Star, Trash2, Plus } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const MIN_PRODUCTS = 1;
const MAX_PRODUCTS = 5;

export type CampaignProduct = {
  id: string;
  productName: string;
  productLink: string | null;
  role: "primary" | "comparison";
  orderIndex: number;
};

type CampaignProductsManagerProps = {
  campaignId: string;
  onProductsChange?: (products: CampaignProduct[]) => void;
};

export function CampaignProductsManager({ campaignId, onProductsChange }: CampaignProductsManagerProps) {
  const [products, setProducts] = useState<CampaignProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [addName, setAddName] = useState("");
  const [addLink, setAddLink] = useState("");
  const [addRole, setAddRole] = useState<"primary" | "comparison">("comparison");
  const [addLoading, setAddLoading] = useState(false);
  const { toast } = useToast();

  const fetchProducts = async () => {
    setLoading(true);
    let list: CampaignProduct[] = [];
    try {
      const res = await fetch(`/api/ugc-lab/campaigns/${campaignId}`);
      const data = await res.json();
      list = data.products ?? [];
      setProducts(list);
    } catch {
      setProducts([]);
      list = [];
    } finally {
      setLoading(false);
      onProductsChange?.(list);
    }
  };

  useEffect(() => {
    if (campaignId) fetchProducts();
  }, [campaignId]);

  const handleAdd = async () => {
    const name = addName.trim();
    if (!name) {
      toast({ title: "Product name required", variant: "destructive" });
      return;
    }
    if (products.length >= MAX_PRODUCTS) {
      toast({ title: `Maximum ${MAX_PRODUCTS} products per campaign`, variant: "destructive" });
      return;
    }
    setAddLoading(true);
    try {
      const res = await fetch(`/api/ugc-lab/campaigns/${campaignId}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: name,
          productLink: addLink.trim() || undefined,
          role: products.length === 0 ? "primary" : addRole,
          orderIndex: products.length,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add");
      setAddName("");
      setAddLink("");
      fetchProducts();
      toast({ title: "Product added" });
    } catch (err) {
      toast({
        title: "Add failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setAddLoading(false);
    }
  };

  const handleSetPrimary = async (productId: string) => {
    try {
      const res = await fetch(`/api/ugc-lab/campaigns/${campaignId}/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "primary" }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed");
      }
      fetchProducts();
      toast({ title: "Primary updated" });
    } catch (err) {
      toast({
        title: "Update failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (productId: string) => {
    if (products.length <= MIN_PRODUCTS) {
      toast({ title: `Campaign must have at least ${MIN_PRODUCTS} product`, variant: "destructive" });
      return;
    }
    try {
      const res = await fetch(`/api/ugc-lab/campaigns/${campaignId}/products/${productId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed");
      }
      fetchProducts();
      toast({ title: "Product removed" });
    } catch (err) {
      toast({
        title: "Delete failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card className="flex-shrink-0">
        <CardContent className="py-6 text-center text-sm text-slate-500">Loading products…</CardContent>
      </Card>
    );
  }

  const primaryCount = products.filter((p) => p.role === "primary").length;
  const needsPrimary = primaryCount !== 1;

  return (
    <Card className="flex-shrink-0">
      <CardHeader className="py-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Package className="w-4 h-4" />
          Products ({products.length}/{MAX_PRODUCTS})
        </CardTitle>
        <CardDescription className="text-xs">
          Min 1, max 5. One must be PRIMARY. 2+ enables comparison angles.
        </CardDescription>
        {needsPrimary && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Mark exactly one product as PRIMARY
          </p>
        )}
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <ul className="space-y-2 max-h-[140px] overflow-y-auto">
          {products.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-2 rounded border border-slate-200 dark:border-slate-700 p-2 text-sm"
            >
              <span className="flex-1 truncate font-medium">{p.productName}</span>
              {p.role === "primary" ? (
                <span className="flex-shrink-0 inline-flex items-center gap-1 rounded bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-200">
                  <Star className="w-3 h-3" /> PRIMARY
                </span>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => handleSetPrimary(p.id)}
                >
                  Set primary
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-slate-500 hover:text-red-600"
                onClick={() => handleDelete(p.id)}
                disabled={products.length <= MIN_PRODUCTS}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </li>
          ))}
        </ul>

        {products.length < MAX_PRODUCTS && (
          <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
            <Input
              placeholder="Product name"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              className="h-9 text-sm"
            />
            <Input
              placeholder="Link (optional)"
              value={addLink}
              onChange={(e) => setAddLink(e.target.value)}
              className="h-9 text-sm"
            />
            {products.length > 0 && (
              <select
                value={addRole}
                onChange={(e) => setAddRole(e.target.value as "primary" | "comparison")}
                className="w-full h-9 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm"
              >
                <option value="comparison">Comparison</option>
                <option value="primary">Primary</option>
              </select>
            )}
            <Button
              size="sm"
              className="w-full gap-2"
              onClick={handleAdd}
              disabled={addLoading}
            >
              <Plus className="w-4 h-4" />
              Add product
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
