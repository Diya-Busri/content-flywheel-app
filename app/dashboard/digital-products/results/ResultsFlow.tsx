"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Download, Copy, FileText, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

type ScriptForDisplay = {
  id: string;
  title: string;
  length: number;
  hook: string;
  body: string;
  cta: string;
};

type GeneratedVideo = {
  id: string;
  title: string;
  url: string;
  duration?: number;
};

export default function ResultsFlow() {
  const { toast } = useToast();
  const [scripts, setScripts] = useState<ScriptForDisplay[]>([]);
  const [videos, setVideos] = useState<GeneratedVideo[]>([]);
  const [hasVideos, setHasVideos] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const rawScripts = sessionStorage.getItem("selectedScriptsForVideos");
        if (rawScripts) {
          const parsed = JSON.parse(rawScripts) as ScriptForDisplay[];
          setScripts(Array.isArray(parsed) ? parsed : []);
        }
        const rawVideos = sessionStorage.getItem("digitalProductsGeneratedVideos");
        if (rawVideos) {
          const parsed = JSON.parse(rawVideos) as GeneratedVideo[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            setVideos(parsed);
            setHasVideos(true);
            return;
          }
        }
        const rawContext = sessionStorage.getItem("productContextForVideos");
        if (rawContext) {
          const ctx = JSON.parse(rawContext) as { productId?: string };
          if (ctx?.productId) {
            const res = await fetch(`/api/digital-products/videos?productId=${encodeURIComponent(ctx.productId)}`);
            if (res.ok) {
              const data = await res.json();
              if (Array.isArray(data.videos) && data.videos.length > 0) {
                setVideos(data.videos);
                setHasVideos(true);
              }
            }
          }
        }
      } catch {
        setScripts([]);
      }
    };
    load();
  }, []);

  const copyScript = (script: ScriptForDisplay) => {
    const full = `${script.hook}\n\n${script.body}\n\n${script.cta}`;
    navigator.clipboard.writeText(full).then(
      () => toast({ title: "Copied", description: `"${script.title}" copied to clipboard` }),
      () => toast({ title: "Copy failed", variant: "destructive" })
    );
  };

  const downloadAllScripts = () => {
    if (scripts.length === 0) return;
    const text = scripts
      .map(
        (s) =>
          `=== ${s.title} (${s.length}s) ===\n\nHook:\n${s.hook}\n\nBody:\n${s.body}\n\nCTA:\n${s.cta}\n\n`
      )
      .join("\n---\n\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "video-scripts.txt";
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Downloaded", description: "All scripts saved as video-scripts.txt" });
  };

  if (hasVideos && videos.length > 0) {
    return (
      <main className="min-h-screen bg-[#0F0F0F] text-white p-6 md:p-10">
        <div className="max-w-3xl mx-auto">
          <Link
            href="/dashboard/digital-products/videos"
            className="inline-flex items-center gap-2 text-sm text-[#A0A0A0] hover:text-orange-500 mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Video Customization
          </Link>
          <div className="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center mb-6">
            <Download className="w-8 h-8 text-orange-500" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Your videos are ready</h1>
          <p className="text-[#A0A0A0] mb-8">Download your generated videos below.</p>
          <div className="space-y-6 mb-8">
            {videos.map((v) => (
              <Card key={v.id} className="border-[#2A2A2A] bg-[#1A1A1A] overflow-hidden">
                <div className="aspect-[9/16] max-h-[480px] mx-auto bg-black rounded-lg overflow-hidden">
                  <video
                    src={v.url}
                    controls
                    className="w-full h-full object-contain"
                    preload="metadata"
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-white">{v.title}</p>
                    {v.duration != null && (
                      <p className="text-sm text-[#A0A0A0]">{v.duration}s • MP4</p>
                    )}
                  </div>
                  <Button asChild size="sm" className="bg-orange-500 hover:bg-orange-600 shrink-0">
                    <a href={v.url} download={`${v.title.replace(/\s+/g, "-")}.mp4`}>
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button asChild variant="outline" className="border-[#2A2A2A] text-[#A0A0A0]">
              <Link href="/dashboard/digital-products">Create another product</Link>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  if (scripts.length === 0) {
    return (
      <main className="min-h-screen bg-[#0F0F0F] text-white p-6 md:p-10">
        <div className="max-w-2xl mx-auto text-center">
          <Link
            href="/dashboard/digital-products/videos"
            className="inline-flex items-center gap-2 text-sm text-[#A0A0A0] hover:text-orange-500 mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Video Customization
          </Link>
          <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">No scripts found</h1>
          <p className="text-[#A0A0A0] mb-8">
            Go back to select scripts, then customize and generate. Your scripts will appear here.
          </p>
          <Button asChild variant="outline" className="border-[#2A2A2A] text-[#A0A0A0]">
            <Link href="/dashboard/digital-products/scripts">Back to Scripts</Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0F0F0F] text-white p-6 md:p-10">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/dashboard/digital-products/videos"
          className="inline-flex items-center gap-2 text-sm text-[#A0A0A0] hover:text-orange-500 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Video Customization
        </Link>
        <div className="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center mb-6">
          <FileText className="w-8 h-8 text-orange-500" />
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Your scripts are ready</h1>
        <p className="text-sm text-[#A0A0A0] mb-8">
          Each script includes a hook, body, and CTA optimized for short-form video. Go back to the Videos step and click “Generate Videos” to create MP4s with Creatomate.
        </p>
        <div className="space-y-4 mb-6">
          {scripts.map((script) => (
            <Card key={script.id} className="border-[#2A2A2A] bg-[#1A1A1A]">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <p className="font-medium text-white">{script.title}</p>
                    <p className="text-xs text-[#A0A0A0]">{script.length}s • Hook + Body + CTA</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-[#2A2A2A] text-[#A0A0A0] shrink-0"
                    onClick={() => copyScript(script)}
                  >
                    <Copy className="w-3.5 h-3.5 mr-1.5" />
                    Copy
                  </Button>
                </div>
                <div className="text-sm text-[#B0B0B0] space-y-2 font-mono bg-[#0F0F0F] rounded-lg p-3 overflow-x-auto">
                  <p><span className="text-orange-500">Hook:</span> {script.hook}</p>
                  <p><span className="text-orange-500">Body:</span> {script.body}</p>
                  <p><span className="text-orange-500">CTA:</span> {script.cta}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            className="bg-orange-500 hover:bg-orange-600 gap-2"
            onClick={downloadAllScripts}
          >
            <Download className="w-4 h-4" />
            Download All Scripts (.txt)
          </Button>
          <Button asChild variant="outline" className="border-[#2A2A2A] text-[#A0A0A0]">
            <Link href="/dashboard/digital-products">Create another product</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
