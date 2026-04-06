"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Copy, RefreshCw, Globe, ExternalLink, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export function SalesPageCard({ productId }: { productId: string }) {
  const [loading, setLoading] = useState(false);
  const [html, setHtml] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const { toast } = useToast();

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
        {!loading && !html && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Generates a complete HTML sales page — paste it into Beacons, Gumroad, or your own site. Replace{" "}
            <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-xs">#BUY_LINK</code> with your checkout URL.
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
