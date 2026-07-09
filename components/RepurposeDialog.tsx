"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Copy, Check } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const FORMATS = [
  { id: "twitter", label: "𝕏 Thread", icon: "𝕏" },
  { id: "linkedin", label: "LinkedIn Post", icon: "in" },
  { id: "email", label: "Promo Email", icon: "✉" },
  { id: "instagram", label: "Instagram Caption", icon: "📸" },
] as const;

type Format = (typeof FORMATS)[number]["id"];

export function RepurposeDialog({
  open,
  onClose,
  productId,
  productTitle,
}: {
  open: boolean;
  onClose: () => void;
  productId: string;
  productTitle: string;
}) {
  const { toast } = useToast();
  const [format, setFormat] = useState<Format>("twitter");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState("");
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    setResult("");
    try {
      const res = await fetch(`/api/products/${productId}/repurpose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setResult(data.content);
    } catch (err) {
      toast({ title: "Could not generate content", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleClose = () => {
    setResult("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-gray-900 dark:text-white">
            Repurpose: <span className="text-orange-500 font-normal truncate">{productTitle}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Format selector */}
          <div className="grid grid-cols-2 gap-2">
            {FORMATS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => { setFormat(f.id); setResult(""); }}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                  format === f.id
                    ? "bg-orange-500 text-white border-orange-500"
                    : "bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:border-orange-300"
                }`}
              >
                <span className="text-base">{f.icon}</span>
                {f.label}
              </button>
            ))}
          </div>

          <Button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white"
          >
            {generating ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…</>
            ) : (
              "✨ Generate content"
            )}
          </Button>

          {result && (
            <div className="relative">
              <textarea
                value={result}
                onChange={(e) => setResult(e.target.value)}
                rows={10}
                className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-4 text-sm text-gray-800 dark:text-gray-200 font-mono resize-y focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
              <Button
                size="sm"
                variant="outline"
                className="absolute top-2 right-2 h-7 px-2 text-xs"
                onClick={handleCopy}
              >
                {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
