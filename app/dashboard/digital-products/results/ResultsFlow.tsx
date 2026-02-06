"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Check } from "lucide-react";

export default function ResultsFlow() {
  return (
    <main className="min-h-screen bg-[#0F0F0F] text-white p-6 md:p-10">
      <div className="max-w-2xl mx-auto text-center">
        <Link
          href="/dashboard/digital-products/videos"
          className="inline-flex items-center gap-2 text-sm text-[#A0A0A0] hover:text-orange-500 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Video Customization
        </Link>
        <div className="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center mx-auto mb-6">
          <Check className="w-8 h-8 text-orange-500" />
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Your videos are ready</h1>
        <p className="text-[#A0A0A0] mb-8">Download your generated videos below.</p>
        <div className="space-y-4">
          <Button className="w-full bg-orange-500 hover:bg-orange-600 gap-2 h-12" size="lg">
            <Download className="w-4 h-4" />
            Download All
          </Button>
          <Button variant="outline" asChild className="w-full border-[#2A2A2A] text-[#A0A0A0]">
            <Link href="/dashboard/digital-products">Create another product</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
