"use client";

import { useState } from "react";
import { Download, Info, AlertTriangle, CheckCircle2, Lightbulb, CheckSquare, Square, ExternalLink } from "lucide-react";
import type { Block } from "@/lib/academy-blocks";
import { youTubeEmbedUrl } from "@/lib/academy";

const CALLOUT_STYLES: Record<string, { box: string; icon: React.ReactNode }> = {
  info: {
    box: "border-blue-500/30 bg-blue-500/10 text-blue-900 dark:text-blue-100",
    icon: <Info className="h-5 w-5 text-blue-500" />,
  },
  warning: {
    box: "border-yellow-500/30 bg-yellow-500/10 text-yellow-900 dark:text-yellow-100",
    icon: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
  },
  success: {
    box: "border-green-500/30 bg-green-500/10 text-green-900 dark:text-green-100",
    icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
  },
  tip: {
    box: "border-purple-500/30 bg-purple-500/10 text-purple-900 dark:text-purple-100",
    icon: <Lightbulb className="h-5 w-5 text-purple-500" />,
  },
};

function InteractiveChecklist({ items }: { items: string[] }) {
  const filtered = items.filter((i) => i.trim());
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const toggle = (i: number) =>
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  const allDone = checked.size === filtered.length && filtered.length > 0;
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-foreground">Action Checklist</p>
        <span className="text-xs text-muted-foreground">{checked.size}/{filtered.length}</span>
      </div>
      <ul className="space-y-2">
        {filtered.map((item, i) => (
          <li
            key={i}
            onClick={() => toggle(i)}
            className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted/50 transition-colors"
          >
            {checked.has(i) ? (
              <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
            ) : (
              <Square className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <span className={`text-sm ${checked.has(i) ? "text-muted-foreground line-through" : "text-foreground"}`}>
              {item}
            </span>
          </li>
        ))}
      </ul>
      {allDone && (
        <p className="mt-3 text-xs font-semibold text-green-600 flex items-center gap-1">
          <CheckCircle2 className="h-3.5 w-3.5" /> All done — great work!
        </p>
      )}
    </div>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "heading": {
      const text = block.content ?? "";
      if (block.level === 1) return <h1 className="mt-6 text-2xl font-bold text-foreground">{text}</h1>;
      if (block.level === 3) return <h3 className="mt-5 text-lg font-semibold text-foreground">{text}</h3>;
      return <h2 className="mt-6 text-xl font-bold text-foreground">{text}</h2>;
    }
    case "text":
      return (
        <p className="whitespace-pre-wrap leading-relaxed text-foreground">{block.content}</p>
      );
    case "video": {
      if (block.videoType === "youtube") {
        const embed = youTubeEmbedUrl(block.videoUrl);
        if (!embed) return null;
        return (
          <iframe
            src={embed}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="aspect-video w-full rounded-lg border bg-black"
            title="Lesson video"
          />
        );
      }
      if (!block.videoUrl) return null;
      return (
        <video src={block.videoUrl} controls className="w-full rounded-lg border bg-black" />
      );
    }
    case "image": {
      if (!block.imageUrl) return null;
      return (
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={block.imageUrl} alt={block.imageAlt ?? ""} className="w-full rounded-lg border" />
          {block.imageAlt && (
            <figcaption className="mt-1 text-center text-xs text-muted-foreground">
              {block.imageAlt}
            </figcaption>
          )}
        </figure>
      );
    }
    case "download": {
      if (!block.downloadUrl) return null;
      return (
        <a
          href={block.downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          download
          className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 hover:bg-muted"
        >
          <Download className="h-5 w-5 text-muted-foreground" />
          <span className="flex-1 text-sm font-medium text-foreground">
            {block.downloadLabel || "Download file"}
          </span>
          {block.fileType && (
            <span className="text-[11px] uppercase text-muted-foreground">{block.fileType}</span>
          )}
        </a>
      );
    }
    case "checklist": {
      return <InteractiveChecklist items={block.items ?? []} />;
    }
    case "divider":
      return <hr className="border-border" />;
    case "callout": {
      const style = CALLOUT_STYLES[block.calloutType ?? "info"] ?? CALLOUT_STYLES.info;
      return (
        <div className={`flex gap-3 rounded-lg border p-4 ${style.box}`}>
          <div className="shrink-0 mt-0.5">{style.icon}</div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{block.content}</p>
        </div>
      );
    }
    case "button": {
      if (!block.buttonUrl) return null;
      const isInternal = block.buttonUrl.startsWith("/");
      return (
        <div>
          <a
            href={block.buttonUrl}
            target={isInternal ? undefined : "_blank"}
            rel={isInternal ? undefined : "noopener noreferrer"}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            {block.buttonLabel || "Open"}
            {!isInternal && <ExternalLink className="h-3.5 w-3.5" />}
          </a>
        </div>
      );
    }
    default:
      return null;
  }
}

export function BlockViewer({ blocks }: { blocks: Block[] }) {
  if (!blocks.length) return null;
  return (
    <div className="space-y-4">
      {blocks.map((block) => (
        <BlockView key={block.id} block={block} />
      ))}
    </div>
  );
}
