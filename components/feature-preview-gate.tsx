"use client";

import { useState, useEffect } from "react";
import { Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STORAGE_KEY = "feature_preview_access";

type FeaturePreviewGateProps = {
  title: string;
  children: React.ReactNode;
};

export function FeaturePreviewGate({ title, children }: FeaturePreviewGateProps) {
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    try {
      const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      setUnlocked(stored === "1");
    } catch {
      setUnlocked(false);
    }
  }, []);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setVerifying(true);
    try {
      const res = await fetch("/api/feature-preview/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        try {
          localStorage.setItem(STORAGE_KEY, "1");
        } catch {}
        setUnlocked(true);
        setPassword("");
      } else {
        setError(data?.error ?? "Incorrect password");
      }
    } catch {
      setError("Could not verify. Try again.");
    } finally {
      setVerifying(false);
    }
  };

  if (!unlocked) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md rounded-xl border border-white/10 bg-card/90 p-8 shadow-xl backdrop-blur dark:bg-zinc-900/95">
          <div className="flex justify-center mb-6">
            <div className="rounded-full bg-white/10 p-4">
              <Lock className="h-10 w-10 text-muted-foreground" />
            </div>
          </div>
          <h1 className="text-xl font-semibold text-center text-foreground mb-2">{title}</h1>
          <p className="text-sm text-muted-foreground text-center mb-6">
            This feature is coming soon
          </p>
          <form onSubmit={handleVerify} className="space-y-4">
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-white/5 border-white/10 text-foreground placeholder:text-muted-foreground"
              autoFocus
              disabled={verifying}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={verifying}>
              {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Unlock"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
