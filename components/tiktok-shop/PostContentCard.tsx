"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check, Loader2, Share2 } from "lucide-react";
import type { PostContentResponse } from "@/app/api/videos/[videoId]/post-content/route";

type CopyState = Record<string, boolean>;

function CopyableField({
  label,
  value,
  fieldKey,
  copyState,
  onCopy,
}: {
  label: string;
  value: string;
  fieldKey: string;
  copyState: CopyState;
  onCopy: (key: string, text: string) => void;
}) {
  const copied = copyState[fieldKey];
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {label}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 shrink-0"
          onClick={() => onCopy(fieldKey, value)}
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-600" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </Button>
      </div>
      <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">
        {value}
      </p>
    </div>
  );
}

export function PostContentCard({ jobId }: { jobId: string | null }) {
  const [data, setData] = useState<PostContentResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<CopyState>({});

  useEffect(() => {
    if (!jobId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/videos/${jobId}/post-content`)
      .then((r) => r.json())
      .then((res) => {
        if (!res.caption && res.error) {
          setError(res.error);
          setData(null);
        } else {
          setData(res);
          setError(null);
        }
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to load");
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [jobId]);

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopyState((s) => ({ ...s, [key]: true }));
      setTimeout(() => setCopyState((s) => ({ ...s, [key]: false })), 1500);
    });
  };

  if (!jobId) return null;
  if (loading) {
    return (
      <Card className="border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Share2 className="w-4 h-4" />
            Post Content
          </CardTitle>
          <CardDescription>Generating caption, hashtags, and tips…</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </CardContent>
      </Card>
    );
  }
  if (error) {
    return (
      <Card className="border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Share2 className="w-4 h-4" />
            Post Content
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600 dark:text-slate-400">{error}</p>
        </CardContent>
      </Card>
    );
  }
  if (!data) return null;

  const hashtagText = data.hashtags.length > 0
    ? data.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")
    : "";

  return (
    <Card className="border-slate-200 dark:border-slate-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Share2 className="w-4 h-4" />
          Post Content
        </CardTitle>
        <CardDescription>
          Copy caption, hashtags, titles, and posting tips to use when sharing
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <CopyableField
          label="Caption"
          value={data.caption}
          fieldKey="caption"
          copyState={copyState}
          onCopy={handleCopy}
        />
        {data.hashtags.length > 0 && (
          <CopyableField
            label="Hashtags"
            value={hashtagText}
            fieldKey="hashtags"
            copyState={copyState}
            onCopy={handleCopy}
          />
        )}
        {data.titleVariations.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Title variations (A/B test)
            </span>
            <div className="space-y-2">
              {data.titleVariations.map((t, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between gap-2 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-2.5"
                >
                  <p className="text-sm text-slate-700 dark:text-slate-300 flex-1 min-w-0">
                    {t}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 shrink-0"
                    onClick={() => handleCopy(`title-${i}`, t)}
                  >
                    {copyState[`title-${i}`] ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
        {data.platformTips.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Best posting times
            </span>
            <div className="space-y-2">
              {data.platformTips.map((t, i) => {
                const text = `${t.platform}: ${t.bestTimes}`;
                return (
                  <div
                    key={i}
                    className="flex items-start justify-between gap-2 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-2.5"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {t.platform}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {t.bestTimes}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 shrink-0"
                      onClick={() => handleCopy(`platform-${i}`, text)}
                    >
                      {copyState[`platform-${i}`] ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
