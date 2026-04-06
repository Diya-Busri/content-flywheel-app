"use client";

/**
 * BookMockupPanel
 * Generates a realistic book-on-desk marketing mockup via DALL-E 3.
 * Drop into the Marketing tab of ProductEditor.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, Download, RefreshCw, BookOpen } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

type BookMockupPanelProps = {
  productId: string;
  existingMockupUrl?: string | null;
  onMockupGenerated?: (url: string) => void;
};

export function BookMockupPanel({ productId, existingMockupUrl, onMockupGenerated }: BookMockupPanelProps) {
  const [generating, setGenerating] = useState(false);
  const [mockupUrl, setMockupUrl] = useState<string | null>(existingMockupUrl ?? null);
  const { toast } = useToast();

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/products/${productId}/book-mockup`, {
        method: "POST",
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "Mockup generation failed");
      }
      setMockupUrl(data.url);
      onMockupGenerated?.(data.url);
      toast({ title: "Book mockup ready!", description: "Your marketing mockup has been generated." });
    } catch (err) {
      toast({
        title: "Mockup failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!mockupUrl) return;
    try {
      const response = await fetch(mockupUrl);
      const blob = await response.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "book-mockup.png";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      // Fallback: open in new tab
      window.open(mockupUrl, "_blank");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-orange-500" />
            Book Mockup (1024×1024)
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Realistic photo of your book on a desk — perfect for Etsy, Gumroad, social.
          </p>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <Button
            type="button"
            size="sm"
            className="bg-orange-500 hover:bg-orange-600 gap-1"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : mockupUrl ? (
              <RefreshCw className="w-3.5 h-3.5" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            {generating ? "Generating…" : mockupUrl ? "Regenerate" : "Generate Mockup"}
          </Button>
          {mockupUrl && !generating && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1 h-8 border-gray-200"
              onClick={handleDownload}
            >
              <Download className="w-3.5 h-3.5" /> Download
            </Button>
          )}
        </div>
      </div>

      {generating && (
        <div className="rounded-xl border border-dashed border-orange-200 bg-orange-50 flex items-center justify-center h-40">
          <div className="text-center space-y-2">
            <Loader2 className="w-6 h-6 animate-spin text-orange-400 mx-auto" />
            <p className="text-xs text-orange-600">Generating your book mockup…</p>
            <p className="text-xs text-gray-400">Usually takes 10–20 seconds</p>
          </div>
        </div>
      )}

      {mockupUrl && !generating && (
        <div className="rounded-xl overflow-hidden border border-gray-100 shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mockupUrl}
            alt="Book mockup"
            className="w-full object-cover rounded-xl"
            style={{ maxHeight: 280 }}
          />
        </div>
      )}

      {!mockupUrl && !generating && (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 flex items-center justify-center h-32">
          <div className="text-center space-y-1">
            <BookOpen className="w-6 h-6 text-gray-300 mx-auto" />
            <p className="text-xs text-gray-400">No mockup yet — click Generate Mockup above</p>
          </div>
        </div>
      )}
    </div>
  );
}
