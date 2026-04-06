"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Zap, Target, CalendarCheck } from "lucide-react";

type DashboardStats = {
  videosThisWeek: number;
  videosThisMonth: number;
  totalVideos: number;
  totalProducts: number;
  topTemplates: Array<{ templateType: string; count: number }>;
};

function formatTemplateLabel(raw: string): string {
  return raw
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function getTopFormat(topTemplates: Array<{ templateType: string; count: number }>): string {
  if (topTemplates.length > 0) return formatTemplateLabel(topTemplates[0].templateType);
  return "Kinetic Text";
}

function getConsistencyLabel(videosThisWeek: number): string {
  return `${Math.min(videosThisWeek, 7)}/7 days posted`;
}

export function AnalyticsWidget() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((r) => r.json())
      .then((data: DashboardStats) => setStats(data))
      .catch(() => {/* silently ignore */})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <section className="mb-12">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Insights</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-gray-100 dark:bg-[#1A1A1A] animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  const videosThisWeek = stats?.videosThisWeek ?? 0;
  const topFormat = getTopFormat(stats?.topTemplates ?? []);

  const insightCards = [
    {
      icon: TrendingUp,
      label: "Top performing format",
      value: topFormat,
      sub: "most used template type",
    },
    {
      icon: Zap,
      label: "Products created",
      value: String(stats?.totalProducts ?? 0),
      sub: stats?.totalProducts === 1 ? "digital product" : "digital products",
    },
    {
      icon: Target,
      label: "Videos this week",
      value: String(videosThisWeek),
      sub: "last 7 days",
    },
    {
      icon: CalendarCheck,
      label: "Consistency score",
      value: getConsistencyLabel(videosThisWeek),
      sub: videosThisWeek >= 5 ? "🔥 Great streak!" : videosThisWeek >= 3 ? "Keep it up" : "Post daily to grow faster",
    },
  ];

  return (
    <section className="mb-12">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Insights</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {insightCards.map((card) => (
          <Card
            key={card.label}
            className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] hover:border-orange-400/50 dark:hover:border-orange-500/30 transition-colors"
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                <card.icon className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                {card.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                {card.value}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{card.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
