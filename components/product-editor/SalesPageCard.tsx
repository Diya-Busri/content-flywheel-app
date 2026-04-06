"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Copy, RefreshCw, Globe, ExternalLink, Eye, EyeOff, Link2, Check } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export function SalesPageCard({ productId, initialCheckoutUrl }: { productId: string; initialCheckoutUrl?: string | null }) {
  const [loading, setLoading] = useState(false);
  const [html, setHtml] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState(initialCheckoutUrl ?? "");
  const [urlSaving, setUrlSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    setCheckoutUrl(initialCheckoutUrl ?? "");
  }, [initialCheckoutUrl]);

  const saveCheckoutUrl = (url: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setUrlSaving(true);
      try {
        // Fetch current marketingAssets to merge (avoid wiping other fields)
        const getRes = await fetch(`/api/products/${productId}`);
        const current = getRes.ok ? await getRes.json().catch(() => ({})) : {};
        const merged = { ...(current.marketingAssets ?? {}), checkoutUrl: url.trim() || null };
        const res = await fetch(`/api/products/${productId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ marketingAssets: merged }),
        });
        if (!res.ok) throw new Error("Failed to save");
      } catch {
        toast({ title: "Couldn't save checkout URL", variant: "destructive" });
      } finally {
        setUrlSaving(false);
      }
    }, 800);
  };

  const shareProductPage = () => {
    const url = `${window.location.origin}/product/${productId}`;
    void navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
      toast({ title: "Link copied!", description: "Share it anywhere to promote your product." });
    });
  };

  const generate = async () => {
    setLoading(true);
    setPreview(false);
    try {
      const res = await fetch(`/api/products/${productId}/sales-page`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to generate sales page");
      setHtml(data.html as string);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copyHtml = () => {
    if (!html) return;
    navigator.clipboard.writeText(html).then(() => toast({ title: "HTML copied!", description: "Paste it into your platform's custom page editor." }));
  };

  const downloadHtml = () => {
    if (!html) return;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sales-page.html";
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Downloaded!", description: "sales-page.html saved." });
  };

  return (
    <Card className="border-gray-200 dark:border-gray-800">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-orange-500" />
            <CardTitle className="text-sm font-semibold text-gray-900 dark:text-white">Sales Page Generator</CardTitle>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-xs border-orange-200 text-orange-600 hover:bg-orange-50 dark:border-orange-800/50 dark:text-orange-400"
            onClick={shareProductPage}
          >
            {linkCopied ? <Check className="w-3 h-3 text-green-500" /> : <Link2 className="w-3 h-3" />}
            {linkCopied ? "Copied!" : "Share Product Page"}
          </Button>
          <div className="flex items-center gap-1">
            {html && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={() => setPreview((p) => !p)}
                >
                  {preview ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  {preview ? "Hide" : "Preview"}
                </Button>
                <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={copyHtml}>
                  <Copy className="w-3 h-3" /> Copy HTML
                </Button>
                <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={downloadHtml}>
                  <ExternalLink className="w-3 h-3" /> Download
                </Button>
              </>
            )}
            <Button
              size="sm"
              variant={html ? "ghost" : "outline"}
              className="h-7 gap-1.5 text-xs border-gray-200"
              onClick={generate}
              disabled={loading}
              type="button"
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : html ? <RefreshCw className="w-3 h-3" /> : null}
              {loading ? "Generating…" : html ? "Regenerate" : "Generate Sales Page"}
            </Button>
          </div>
        </div>
        {/* Checkout URL input — always visible */}
        <div className="mt-3 flex items-center gap-2">
          <Label className="text-xs text-gray-500 dark:text-gray-400 shrink-0 w-24">Checkout URL</Label>
          <div className="flex-1 relative">
            <Input
              type="url"
              placeholder="https://gumroad.com/l/… or Beacons link"
              value={checkoutUrl}
              onChange={(e) => {
                setCheckoutUrl(e.target.value);
                saveCheckoutUrl(e.target.value);
              }}
              className="h-7 text-xs pr-8"
            />
            {urlSaving && (
              <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 animate-spin text-gray-400" />
            )}
          </div>
        </div>
        {!checkoutUrl && (
          <p className="text-xs text-orange-500 dark:text-orange-400 mt-1.5">
            Add your checkout URL above — it will replace{" "}
            <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-xs">#BUY_LINK</code> on your public sales page automatically.
          </p>
        )}
      </CardHeader>

      {html && preview && (
        <CardContent className="px-4 pb-4">
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="bg-gray-100 dark:bg-gray-800 px-3 py-1.5 flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <span className="text-xs text-gray-500 ml-1">Preview</span>
            </div>
            <iframe
              srcDoc={html}
              className="w-full h-[500px] bg-white"
              sandbox="allow-same-origin"
              title="Sales page preview"
            />
          </div>
        </CardContent>
      )}

      {html && !preview && (
        <CardContent className="px-4 pb-4">
          <div className="rounded-lg bg-gray-900 dark:bg-gray-950 p-3 max-h-48 overflow-y-auto">
            <pre className="text-xs text-green-400 whitespace-pre-wrap break-all font-mono leading-relaxed">
              {html.slice(0, 800)}
              {html.length > 800 ? "\n…" : ""}
            </pre>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Replace <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">#BUY_LINK</code> with your product checkout URL before publishing.
          </p>
        </CardContent>
      )}
    </Card>
  );
}
