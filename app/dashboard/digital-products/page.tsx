/**
 * Digital Products flow (Flow 1) - Create AI videos for digital products
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Digital Products | Content Flywheel",
  description: "Create AI-powered videos for your digital products",
};

export default function DigitalProductsPage() {
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
        Digital Products
      </h1>
      <p className="text-slate-600 dark:text-slate-400 mb-10">
        Flow 1 — Turn your digital products into sales-driving videos
      </p>
      <div className="max-w-2xl">
        <Card className="border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-orange-500" />
              Create Digital Product Video
            </CardTitle>
            <CardDescription>
              This flow is coming soon. You&apos;ll be able to connect your digital products and generate AI videos for TikTok, Instagram, and YouTube.
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
