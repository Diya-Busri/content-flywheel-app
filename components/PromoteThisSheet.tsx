"use client";

import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Copy, Check, Megaphone, Link2 } from "lucide-react";

type ContentBundle = {
  productName: string;
  oneLiner: string;
  tiktok: { hook: string; script: string };
  instagram: { caption: string };
  email: { subject: string; preview: string; body: string };
  twitter: { thread: string[] };
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      title="Copy"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{title}</p>
      {children}
    </div>
  );
}

function ContentBlock({ label, text }: { label?: string; text: string }) {
  return (
    <div className="group relative">
      {label && <p className="text-xs text-muted-foreground mb-1">{label}</p>}
      <div className="flex items-start gap-2">
        <p className="text-sm text-foreground whitespace-pre-wrap flex-1">{text}</p>
        <CopyButton text={text} />
      </div>
    </div>
  );
}

export function PromoteThisSheet({ open, onOpenChange, prefillUrl, productId, productTitle }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prefillUrl?: string;
  productId?: string;
  productTitle?: string;
}) {
  const [url, setUrl] = useState(prefillUrl ?? "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ContentBundle | null>(null);
  const { toast } = useToast();

  // When opened for a specific product, auto-generate immediately
  useEffect(() => {
    if (open && productId) {
      generateFromProduct();
    } else if (open && prefillUrl) {
      setUrl(prefillUrl);
    }
    if (!open) { setResult(null); setUrl(""); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, productId]);

  const generateFromProduct = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/promote-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setResult(data.result as ContentBundle);
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Something went wrong", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const generate = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/promote-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setResult(data.result as ContentBundle);
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Something went wrong", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const reset = () => { setResult(null); setUrl(""); };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <Megaphone className="h-5 w-5 text-orange-500" />
            Promote This
          </SheetTitle>
        </SheetHeader>

        {!result ? (
          <div className="flex flex-col gap-4">
            {/* Product mode: just show loading, no URL input */}
            {productId ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                <p className="text-sm">Writing promo content for <span className="font-medium text-foreground">{productTitle ?? "your product"}</span>…</p>
              </div>
            ) : (
              <>
                <div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Paste any URL — your app, product, or link in bio. We&apos;ll read the page and generate a full content bundle ready to post.
                  </p>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="contentflywheel.co.uk"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && generate()}
                        className="pl-9"
                        disabled={loading}
                      />
                    </div>
                    <Button
                      onClick={generate}
                      disabled={loading || !url.trim()}
                      className="bg-orange-500 hover:bg-orange-600 text-white shrink-0"
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate"}
                    </Button>
                  </div>
                </div>

                {loading && (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                    <p className="text-sm">Reading the page and writing your content…</p>
                  </div>
                )}

                <div className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">What you&apos;ll get</p>
                  <p>TikTok/Reels script · Instagram caption · Email copy · Twitter thread</p>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Header */}
            <div className="rounded-xl bg-orange-500/10 border border-orange-500/20 px-4 py-3">
              <p className="font-semibold text-foreground">{result.productName}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{result.oneLiner}</p>
            </div>

            {/* TikTok */}
            <Section title="TikTok / Reels">
              <div className="flex flex-col gap-3">
                <ContentBlock label="Hook (first 3 seconds)" text={result.tiktok.hook} />
                <div className="border-t border-border pt-3">
                  <ContentBlock label="Full script" text={result.tiktok.script} />
                </div>
              </div>
            </Section>

            {/* Instagram */}
            <Section title="Instagram Caption">
              <ContentBlock text={result.instagram.caption} />
            </Section>

            {/* Email */}
            <Section title="Email">
              <div className="flex flex-col gap-3">
                <ContentBlock label="Subject line" text={result.email.subject} />
                <ContentBlock label="Preview text" text={result.email.preview} />
                <div className="border-t border-border pt-3">
                  <ContentBlock label="Body" text={result.email.body} />
                </div>
              </div>
            </Section>

            {/* Twitter */}
            <Section title="Twitter / X Thread">
              <div className="flex flex-col gap-2">
                {result.twitter.thread.map((tweet, i) => (
                  <div key={i} className="flex items-start gap-2 pb-2 border-b border-border last:border-0 last:pb-0">
                    <span className="text-xs font-mono text-muted-foreground mt-0.5 w-4 shrink-0">{i + 1}</span>
                    <p className="text-sm flex-1">{tweet}</p>
                    <CopyButton text={tweet} />
                  </div>
                ))}
              </div>
            </Section>

            {productId ? (
              <Button variant="outline" onClick={generateFromProduct} className="w-full">
                Regenerate
              </Button>
            ) : (
              <Button variant="outline" onClick={reset} className="w-full">
                Try a different URL
              </Button>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
