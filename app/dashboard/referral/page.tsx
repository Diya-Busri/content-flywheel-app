"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, Gift, Users, Zap } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function ReferralPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/email/my-id")
      .then((r) => r.ok ? r.json() : null)
      .then((data: { userId?: string } | null) => {
        if (data?.userId) setUserId(data.userId);
      })
      .catch(() => {});
  }, []);

  const referralUrl = userId
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/sign-up?ref=${userId}`
    : "";

  const handleCopy = () => {
    if (!referralUrl) return;
    void navigator.clipboard.writeText(referralUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Referral link copied!", description: "Share it and earn rewards when friends join." });
    });
  };

  const perks = [
    { icon: Zap, label: "Earn rewards", desc: "Get bonus credits for every creator you refer who signs up." },
    { icon: Users, label: "Build community", desc: "Help fellow creators discover the tools to grow their income." },
    { icon: Gift, label: "Your friends benefit too", desc: "Everyone who signs up via your link gets a head start." },
  ];

  return (
    <main className="p-6 md:p-10 max-w-2xl">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Refer a Creator</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        Share Content Flywheel with other creators and earn rewards together.
      </p>

      {/* Referral link card */}
      <Card className="border-orange-200 dark:border-orange-900/40 bg-orange-50/40 dark:bg-orange-950/10 mb-8">
        <CardHeader>
          <CardTitle className="text-base text-gray-900 dark:text-white flex items-center gap-2">
            <Gift className="w-4 h-4 text-orange-500" />
            Your referral link
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            Share this link — when a creator signs up through it, you both benefit.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={referralUrl || "Loading…"}
              className="flex-1 font-mono text-sm bg-white dark:bg-[#0F0F0F] border-orange-200 dark:border-orange-800/50 text-gray-700 dark:text-gray-300"
            />
            <Button
              size="sm"
              className="shrink-0 bg-orange-500 hover:bg-orange-600 text-white gap-1.5"
              onClick={handleCopy}
              disabled={!referralUrl}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
            Post this in your TikTok bio, Discord, or DMs. Every signup you refer counts.
          </p>
        </CardContent>
      </Card>

      {/* Perks */}
      <div className="grid gap-4">
        {perks.map((perk) => (
          <div
            key={perk.label}
            className="flex items-start gap-4 p-4 rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A]"
          >
            <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0 mt-0.5">
              <perk.icon className="w-4 h-4 text-orange-500" />
            </div>
            <div>
              <p className="font-semibold text-sm text-gray-900 dark:text-white">{perk.label}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">{perk.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
