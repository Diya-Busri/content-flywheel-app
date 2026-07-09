"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { MemoryViewer } from "@/components/memory/MemoryViewer";

export default function MemoryPage() {
  const { launchId } = useParams<{ launchId: string }>();

  return (
    <div className="min-h-dvh bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">

        {/* ── Back nav ── */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href={`/dashboard/projects/${launchId}`}
            className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Project
          </Link>
        </div>

        <MemoryViewer launchId={launchId} />

      </div>
    </div>
  );
}
