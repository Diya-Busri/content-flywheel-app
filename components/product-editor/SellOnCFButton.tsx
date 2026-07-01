"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, ShoppingBag, ExternalLink, AlertTriangle } from "lucide-react";
import Link from "next/link";

interface SellOnCFButtonProps {
  productId: string;
  productTitle: string;
  isNativePublished?: boolean;
  nativePrice?: number;
  subscriptionInterval?: "month" | "year" | null;
  payWhatYouWant?: boolean;
  minPrice?: number | null;
  onPublished?: (price: number) => void;
  onUnpublished?: () => void;
}

export function SellOnCFButton({
  productId,
  productTitle,
  isNativePublished: initialPublished = false,
  nativePrice: initialPrice,
  subscriptionInterval: initialInterval,
  payWhatYouWant: initialPWYW = false,
  minPrice: initialMinPrice,
  onPublished,
  onUnpublished,
}: SellOnCFButtonProps) {
  const [open, setOpen] = useState(false);
  const [published, setPublished] = useState(initialPublished);
  const [currentPrice, setCurrentPrice] = useState<number | undefined>(initialPrice);
  const [priceInput, setPriceInput] = useState(
    initialPrice ? (initialPrice / 100).toFixed(2) : ""
  );
  const [billingInterval, setBillingInterval] = useState<"one_time" | "month" | "year">(
    initialInterval === "month" ? "month" : initialInterval === "year" ? "year" : "one_time"
  );
  const [isPWYW, setIsPWYW] = useState(initialPWYW);
  const [minPriceInput, setMinPriceInput] = useState(
    initialMinPrice ? (initialMinPrice / 100).toFixed(2) : "0"
  );
  const [loading, setLoading] = useState(false);
  const [connectChecking, setConnectChecking] = useState(false);
  const [chargesEnabled, setChargesEnabled] = useState<boolean | null>(null);
  const { toast } = useToast();

  const checkConnectStatus = useCallback(async () => {
    setConnectChecking(true);
    try {
      const res = await fetch("/api/stripe/connect/status");
      const data = await res.json();
      setChargesEnabled(data.chargesEnabled ?? false);
    } catch {
      setChargesEnabled(false);
    } finally {
      setConnectChecking(false);
    }
  }, []);

  const handlePublish = async () => {
    const priceNum = parseFloat(priceInput);
    if (isNaN(priceNum) || priceNum < 1) {
      toast({
        title: "Invalid price",
        description: "Please enter a price of at least £1.00.",
        variant: "destructive",
      });
      return;
    }

    const pence = Math.round(priceNum * 100);
    setLoading(true);

    try {
      const res = await fetch(`/api/products/${productId}/native-publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          price: pence,
          subscriptionInterval: billingInterval === "one_time" ? null : billingInterval,
          payWhatYouWant: isPWYW,
          minPrice: isPWYW ? Math.round(parseFloat(minPriceInput || "0") * 100) : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to publish");

      setPublished(true);
      setCurrentPrice(pence);
      toast({
        title: "Published!",
        description: `"${productTitle}" is now live at ${data.priceLabel}`,
      });
      onPublished?.(pence);
      setOpen(false);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to publish",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUnpublish = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/products/${productId}/native-publish`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to unpublish");

      setPublished(false);
      setCurrentPrice(undefined);
      toast({ title: "Unpublished", description: `"${productTitle}" has been removed from sale.` });
      onUnpublished?.();
      setOpen(false);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to unpublish",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => { setOpen(true); void checkConnectStatus(); }}
        title={published ? `Selling at £${(currentPrice! / 100).toFixed(2)}` : "Sell on Content Flywheel"}
        className={published ? "border-green-500/50 text-green-700 dark:text-green-400 hover:border-green-500 hover:text-green-700 dark:hover:text-green-300" : ""}
      >
        <ShoppingBag className="w-3.5 h-3.5" />
        {published && (
          <span className="ml-1 text-xs font-semibold">
            £{(currentPrice! / 100).toFixed(2)}
          </span>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {published ? "Manage sale" : "Sell on Content Flywheel"}
            </DialogTitle>
            <DialogDescription>
              {published
                ? `"${productTitle}" is currently live. Buyers get a 7-day download link via email.`
                : `Set a price and publish "${productTitle}" — buyers pay via Stripe and receive an instant download link.`}
            </DialogDescription>
          </DialogHeader>

          {/* Stripe Connect gate */}
          {connectChecking && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Checking payout setup…
            </div>
          )}
          {!connectChecking && chargesEnabled === false && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700/50 dark:bg-amber-950/30 px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Connect Stripe to receive payments</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                  You need to set up payouts before you can sell. It only takes a couple of minutes.
                </p>
                <Link
                  href="/dashboard/store/payouts"
                  className="mt-2 inline-block text-xs font-semibold text-amber-700 dark:text-amber-300 underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-100"
                  onClick={() => setOpen(false)}
                >
                  Set up payouts →
                </Link>
              </div>
            </div>
          )}

          {!published && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Billing type</label>
              <div className="flex gap-2">
                {(["one_time", "month", "year"] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setBillingInterval(opt)}
                    className={`flex-1 text-xs py-2 rounded-lg border transition-colors ${
                      billingInterval === opt
                        ? "bg-orange-500 text-white border-orange-500 font-semibold"
                        : "border-gray-200 text-gray-600 hover:border-orange-300"
                    }`}
                  >
                    {opt === "one_time" ? "One-time" : opt === "month" ? "Monthly" : "Yearly"}
                  </button>
                ))}
              </div>
              {billingInterval !== "one_time" && (
                <p className="text-xs text-muted-foreground">
                  Buyers will be charged {billingInterval === "month" ? "every month" : "every year"} until they cancel.
                </p>
              )}
            </div>
          )}

          {/* Pay-what-you-want toggle (new publishes only) */}
          {!published && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-foreground">Pay what you want</label>
                  <p className="text-xs text-muted-foreground">Buyer types their own amount at checkout</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPWYW((v) => !v)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${isPWYW ? "bg-orange-500" : "bg-gray-300"}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${isPWYW ? "translate-x-4" : "translate-x-0.5"}`} />
                </button>
              </div>
              {isPWYW && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Minimum price (£)</label>
                  <div className="relative w-36">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">£</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={minPriceInput}
                      onChange={(e) => setMinPriceInput(e.target.value)}
                      className="pl-7"
                      placeholder="0.00"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Set 0 for truly free / donation-only</p>
                </div>
              )}
            </div>
          )}

          {published ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <Badge className="bg-green-500 text-white hover:bg-green-500 shrink-0">Live</Badge>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                    £{(currentPrice! / 100).toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">Selling on Content Flywheel</p>
                </div>
                <Button variant="outline" size="sm" asChild className="ml-auto shrink-0">
                  <a
                    href={`/product/${productId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-1" />
                    View page
                  </a>
                </Button>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Update price (£)</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">£</span>
                    <Input
                      type="number"
                      min="1"
                      step="0.01"
                      value={priceInput}
                      onChange={(e) => setPriceInput(e.target.value)}
                      className="pl-7"
                      placeholder="9.99"
                    />
                  </div>
                  <Button
                    onClick={handlePublish}
                    disabled={loading}
                    className="bg-orange-500 hover:bg-orange-600 text-white shrink-0"
                  >
                    {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Update
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Price (£ GBP)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">£</span>
                <Input
                  type="number"
                  min="1"
                  step="0.01"
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  className="pl-7"
                  placeholder="9.99"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Buyers pay via Stripe Checkout. A download link is emailed to them automatically.
              </p>
            </div>
          )}

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            {published && (
              <Button
                variant="outline"
                onClick={handleUnpublish}
                disabled={loading}
                className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/30 w-full sm:w-auto"
              >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Unpublish
              </Button>
            )}
            <Button variant="outline" onClick={() => setOpen(false)} className="w-full sm:w-auto">
              {published ? "Close" : "Cancel"}
            </Button>
            {!published && (
              <Button
                onClick={handlePublish}
                disabled={loading || chargesEnabled === false}
                title={chargesEnabled === false ? "Connect Stripe first to receive payments" : undefined}
                className="bg-orange-500 hover:bg-orange-600 text-white w-full sm:w-auto disabled:opacity-50"
              >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Publish &amp; start selling
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
