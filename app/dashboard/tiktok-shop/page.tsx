/**
 * TikTok Shop flow (Flow 2) - Generate videos for TikTok Shop
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingBag, ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "TikTok Shop | Content Flywheel",
  description: "Generate AI-powered videos for TikTok Shop",
};

export default function TikTokShopPage() {
  return (
    <main className="p-6 md:p-10">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-orange-500 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to dashboard
      </Link>
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
        TikTok Shop
      </h1>
      <p className="text-slate-600 dark:text-slate-400 mb-10">
        Flow 2 — Create videos optimized for TikTok Shop
      </p>
      <div className="max-w-2xl">
        <Card className="border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-orange-500" />
              Generate TikTok Shop Video
            </CardTitle>
            <CardDescription>
              This flow is coming soon. Connect your TikTok Shop products and generate AI videos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="bg-orange-500 hover:bg-orange-600">
              <Link href="/dashboard">Return to dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
