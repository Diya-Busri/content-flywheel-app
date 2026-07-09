"use client";

import { useState } from "react";
import { Loader2, Check } from "lucide-react";

export default function WaitlistForm({
  slug,
  cta,
  primaryColor,
}: {
  slug: string;
  cta: string;
  primaryColor: string;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/bio-page/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, email, name }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="flex flex-col items-center gap-2 py-4">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ backgroundColor: primaryColor }}
        >
          <Check className="w-5 h-5 text-white" />
        </div>
        <p className="text-white font-semibold text-sm">You&apos;re on the list 🖤</p>
        <p className="text-gray-500 text-xs">We&apos;ll hit you up when we drop.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <p className="text-xs text-gray-400 text-center mb-3">{cta}</p>
      <input
        type="text"
        placeholder="Your name (optional)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full h-10 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 text-sm px-4 outline-none focus:border-white/20 transition-colors"
      />
      <div className="flex gap-2">
        <input
          type="email"
          required
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 h-10 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 text-sm px-4 outline-none focus:border-white/20 transition-colors"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-5 h-10 rounded-xl text-sm font-semibold text-white flex items-center gap-1.5 transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ backgroundColor: primaryColor }}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Join"}
        </button>
      </div>
      {error && <p className="text-red-400 text-xs text-center">{error}</p>}
    </form>
  );
}
