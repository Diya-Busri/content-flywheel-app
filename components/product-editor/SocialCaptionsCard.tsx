"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Copy, RefreshCw, Megaphone } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { SchedulePostReminder } from "@/components/product-editor/SchedulePostReminder";

type Captions = {
  tiktok: string;
  instagram: string;
  twitter: string;
};

const PLATFORMS: Array<{ key: keyof Captions; label: string; emoji: string; charLimit?: number; color: string }> = [
  { key: "tiktok", label: "TikTok", emoji: "🎵", color: "bg-black/5 border-black/10 dark:bg-white/5 dark:border-white/10" },
  { key: "instagram", label: "Instagram", emoji: "📸", color: "bg-pink-50 border-pink-100 dark:bg-pink-950/20 dark:border-pink-900/30" },
  { key: "twitter", label: "Twitter / X", emoji: "✖️", charLimit: 280, color: "bg-sky-50 border-sky-100 dark:bg-sky-950/20 dark:border-sky-900/30" },
];

export function SocialCaptionsCard({ productId, productTitle = "Digital Product" }: { productId: string; productTitle?: string }) {
  const [loading, setLoading] = useState(false);
  const [captions, setCaptions] = useState<Captions | null>(null);
  const { toast } = useToast();

  const generate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/products/${productId}/social-captions`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to generate captions");
      setCaptions(data as Captions);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to generate captions", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: `${label} caption copied!` });
    });
  };

  return (
    <Card className="border-gray-200 dark:border-gray-800">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-orange-500" />
            <CardTitle className="text-sm font-semibold text-gray-900 dark:text-white">Social Media Captions</CardTitle>
          </div>
          <Button
            size="sm"
            variant={captions ? "ghost" : "outline"}
            className="h-7 gap-1.5 text-xs border-gray-200"
            onClick={generate}
            disabled={loading}
            type="button"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : captions ? <RefreshCw className="w-3 h-3" /> : null}
            {loading ? "Generating…" : captions ? "Regenerate" : "Generate Captions"}
          </Button>
        </div>
      </CardHeader>

      {captions && (
        <CardContent className="px-4 pb-4 space-y-3">
          {PLATFORMS.map(({ key, label, emoji, charLimit, color }) => {
            const text = captions[key];
            const overLimit = charLimit ? text.length > charLimit : false;
            return (
              <div key={key} className={`rounded-lg border p-3 ${color}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    {emoji} {label}
                  </span>
                  <div className="flex items-center gap-1">
                    {charLimit && (
                      <span className={`text-xs tabular-nums ${overLimit ? "text-red-500" : "text-gray-400"}`}>
                        {text.length}/{charLimit}
                      </span>
                    )}
                    <SchedulePostReminder
                      productId={productId}
                      productTitle={productTitle}
                      platform={key}
                      caption={text}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 hover:bg-white/50"
                      onClick={() => copy(text, label)}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">{text}</p>
              </div>
            );
          })}
        </CardContent>
      )}
    </Card>
  );
}
