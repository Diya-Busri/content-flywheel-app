"use client";

import { useState } from "react";
import { Code, Copy, Check } from "lucide-react";

const APP_URL = "https://contentflywheel.co.uk";

export default function EmbedCodePanel() {
  const [copied, setCopied] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [limit, setLimit] = useState("6");

  const snippet = `<script src="${APP_URL}/api/embed/marketplace?theme=${theme}&limit=${limit}" async></script>`;

  const copy = () => {
    navigator.clipboard.writeText(snippet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-6 mx-6">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-gray-800 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Code size={16} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-gray-900 mb-1">Embed the marketplace on your website</h3>
          <p className="text-xs text-gray-500 mb-3">
            Paste this snippet anywhere on your site to show a live product carousel. Updates automatically.
          </p>

          {/* Options */}
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-500 font-medium">Theme:</label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as "light" | "dark")}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 focus:outline-none"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-500 font-medium">Products:</label>
              <select
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 focus:outline-none"
              >
                <option value="3">3</option>
                <option value="6">6</option>
                <option value="9">9</option>
                <option value="12">12</option>
              </select>
            </div>
          </div>

          {/* Snippet */}
          <div className="relative">
            <pre className="text-xs bg-gray-900 text-green-400 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all select-all font-mono">
              {snippet}
            </pre>
            <button
              onClick={copy}
              className="absolute top-2 right-2 flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md bg-gray-700 text-white hover:bg-gray-600 transition-colors"
            >
              {copied ? <><Check size={11} /> Copied!</> : <><Copy size={11} /> Copy</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
