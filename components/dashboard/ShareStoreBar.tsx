"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, Check, ExternalLink } from "lucide-react";

interface ShareStoreBarProps {
  storeUrl: string;
}

export function ShareStoreBar({ storeUrl }: ShareStoreBarProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(storeUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback for older browsers
      const el = document.createElement("textarea");
      el.value = storeUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const displayUrl = storeUrl.replace(/^https?:\/\//, "");

  return (
    <div className="mb-6 flex items-center gap-3 rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-[#2A2A2A] shadow-sm px-4 py-3">
      {/* Label */}
      <div className="shrink-0">
        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Your store</p>
      </div>

      {/* URL */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{displayUrl}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={copy}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              Copy link
            </>
          )}
        </button>
        <Link
          href={storeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center h-8 w-8 rounded-lg border border-gray-200 dark:border-[#2A2A2A] hover:bg-gray-50 dark:hover:bg-white/5 text-gray-400 hover:text-gray-600 transition-colors"
          title="Open store"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
