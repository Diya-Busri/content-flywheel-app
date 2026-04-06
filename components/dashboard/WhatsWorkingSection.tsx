"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Flame, ArrowRight } from "lucide-react";

type Format = {
  title: string;
  description: string;
  badge: string;
  badgeColor: string;
  href: string;
};

const TOP_FORMATS: Format[] = [
  {
    title: "Kinetic Typography",
    description: "Bold animated text overlays. Highest completion rates — viewers watch to the end.",
    badge: "Best Completion",
    badgeColor: "bg-green-500/10 text-green-700 dark:text-green-400",
    href: "/dashboard/library",
  },
  {
    title: "Problem / Solution Story",
    description: "Emotional hook format that leads with a pain point then reveals the fix. Best for conversions.",
    badge: "Best Conversions",
    badgeColor: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
    href: "/dashboard/digital-products/create",
  },
  {
    title: "Would You Rather",
    description: "Interactive choice format that sparks comments and shares. Highest viral share rate.",
    badge: "Most Viral",
    badgeColor: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
    href: "/dashboard/tiktok-shop",
  },
];

export function WhatsWorkingSection() {
  return (
    <section className="mb-12">
      <div className="flex items-center gap-2 mb-4">
        <Flame className="w-5 h-5 text-orange-500" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">What&apos;s Working 🔥</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {TOP_FORMATS.map((fmt) => (
          <Link key={fmt.title} href={fmt.href} className="group block">
            <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] hover:border-orange-500/50 dark:hover:border-orange-500/40 transition-all h-full">
              <CardContent className="p-5 flex flex-col h-full">
                {/* Badge */}
                <span
                  className={`self-start inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold mb-3 ${fmt.badgeColor}`}
                >
                  {fmt.badge}
                </span>

                {/* Title */}
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-orange-500 transition-colors">
                  {fmt.title}
                </h3>

                {/* Description */}
                <p className="text-sm text-gray-600 dark:text-gray-400 flex-1">{fmt.description}</p>

                {/* CTA */}
                <div className="mt-4 flex items-center gap-1 text-sm font-medium text-orange-500 group-hover:gap-2 transition-all">
                  Try this format
                  <ArrowRight className="w-4 h-4" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
