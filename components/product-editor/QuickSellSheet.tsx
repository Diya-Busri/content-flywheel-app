"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ShoppingCart } from "lucide-react";
import { SellItNowPanel } from "@/components/product-editor/SellItNowPanel";

export function QuickSellSheet({
  productId,
  productTitle,
}: {
  productId: string;
  productTitle: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs border-orange-200 text-orange-600 hover:bg-orange-50 hover:text-orange-700 dark:border-orange-900/40 dark:text-orange-400 dark:hover:bg-orange-950/30"
        onClick={() => setOpen(true)}
        title="Quick Sell — get platform copy"
        type="button"
      >
        <ShoppingCart className="w-3.5 h-3.5" />
        Sell
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-base">Sell it now</SheetTitle>
            <SheetDescription className="text-xs">
              Pick a platform, generate copy, and go live with{" "}
              <span className="font-medium text-gray-700 dark:text-gray-300">{productTitle}</span>.
            </SheetDescription>
          </SheetHeader>
          <SellItNowPanel productId={productId} />
        </SheetContent>
      </Sheet>
    </>
  );
}
