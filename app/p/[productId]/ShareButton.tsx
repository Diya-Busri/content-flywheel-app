"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export default function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  const pageUrl = typeof window !== "undefined" ? window.location.href : "";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(pageUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the input
    }
  };

  const handleNativeShare = async () => {
    if (!navigator.share) return handleCopy();
    try {
      await navigator.share({ title, url: pageUrl });
    } catch {
      // user cancelled
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          readOnly
          value={pageUrl}
          className="flex-1 rounded-xl border border-gray-200 dark:border-[#2A2A2A] bg-gray-50 dark:bg-[#1A1A1A] px-3 py-2 text-xs text-gray-500 dark:text-gray-400 truncate outline-none"
        />
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-gray-200 dark:border-[#2A2A2A] text-gray-600 dark:text-gray-400 hover:border-orange-300 hover:text-orange-500 transition-all whitespace-nowrap"
        >
          {copied ? <><Check className="w-3.5 h-3.5 text-green-500" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy link</>}
        </button>
      </div>

      <div className="flex gap-2">
        <a
          href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out ${title} 🔥`)}&url=${encodeURIComponent(pageUrl)}`}
          target="_blank"
          rel="noreferrer"
          className="flex-1 text-center text-xs font-medium py-2 rounded-xl border border-gray-200 dark:border-[#2A2A2A] text-gray-500 dark:text-gray-400 hover:border-orange-300 hover:text-orange-500 transition-all"
        >
          Share on X
        </a>
        <button
          type="button"
          onClick={handleNativeShare}
          className="flex-1 text-xs font-medium py-2 rounded-xl border border-gray-200 dark:border-[#2A2A2A] text-gray-500 dark:text-gray-400 hover:border-orange-300 hover:text-orange-500 transition-all"
        >
          More options
        </button>
      </div>
    </div>
  );
}
