"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Users, CreditCard, Flag, Activity, FileCheck, TrendingUp, AlertCircle, Loader2, BarChart2, Inbox, Timer } from "lucide-react";

type QuickStats = {
  totalUsers: number;
  proUsers: number;
  creditsPurchased: number;
  creditsUsed: number;
  errorCount: number;
  pendingApplications: number;
};

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<QuickStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [revenueRes, healthRes, appsRes] = await Promise.allSettled([
        fetch("/api/admin/revenue").then((r) => r.json()),
        fetch("/api/admin/health").then((r) => r.json()),
        fetch("/api/admin/creator-applications?status=pending").then((r) => r.json()),
      ]);

      const revenue = revenueRes.status === "fulfilled" ? (revenueRes.value as { totalUsers?: number; proUsers?: number; creditsPurchased?: number; creditsUsed?: number }) : {};
      const health = healthRes.status === "fulfilled" ? (healthRes.value as { errorCount?: number }) : {};
      const apps = appsRes.status === "fulfilled" ? (appsRes.value as { applications?: unknown[] }) : {};

      setStats({
        totalUsers: revenue.totalUsers ?? 0,
        proUsers: revenue.proUsers ?? 0,
        creditsPurchased: revenue.creditsPurchased ?? 0,
        creditsUsed: revenue.creditsUsed ?? 0,
        errorCount: health.errorCount ?? 0,
        pendingApplications: (apps.applications ?? []).length,
      });
      setLoading(false);
    }
    void load();
  }, []);

  const sections = [
    {
      href: "/dashboard/admin/users",
      icon: <Users className="w-6 h-6" />,
      label: "User Management",
      description: "View all users, grant or revoke video credits, check activity",
      stat: stats ? `${stats.totalUsers} users` : null,
      color: "text-blue-500",
    },
    {
      href: "/dashboard/admin/revenue",
      icon: <TrendingUp className="w-6 h-6" />,
      label: "Revenue & Business",
      description: "Credit purchases, Stripe charges, usage by video type",
      stat: stats ? `${stats.creditsPurchased} credits sold` : null,
      color: "text-green-500",
    },
    {
      href: "/dashboard/admin/applications",
      icon: <FileCheck className="w-6 h-6" />,
      label: "Creator Applications",
      description: "Review and accept or reject creator applications",
      stat: stats ? `${stats.pendingApplications} pending` : null,
      color: "text-orange-500",
      badge: stats?.pendingApplications ? stats.pendingApplications : undefined,
    },
    {
      href: "/dashboard/admin/analytics",
      icon: <BarChart2 className="w-6 h-6" />,
      label: "Analytics",
      description: "DAU/WAU/MAU, top features, most active users, engagement trends",
      stat: null,
      color: "text-cyan-500",
    },
    {
      href: "/dashboard/admin/trial",
      icon: <Timer className="w-6 h-6" />,
      label: "Trial Analytics",
      description: "Who cancels, when they cancel, conversion rates, active trials",
      stat: null,
      color: "text-orange-500",
    },
    {
      href: "/dashboard/admin/feedback",
      icon: <Inbox className="w-6 h-6" />,
      label: "Feedback Inbox",
      description: "User-submitted bugs, ideas, and praise with status tracking",
      stat: null,
      color: "text-indigo-500",
    },
    {
      href: "/dashboard/admin/feature-flags",
      icon: <Flag className="w-6 h-6" />,
      label: "Feature Flags",
      description: "Toggle features on/off globally or per user without deploying",
      stat: null,
      color: "text-purple-500",
    },
    {
      href: "/dashboard/admin/health",
      icon: <Activity className="w-6 h-6" />,
      label: "Platform Health",
      description: "Error logs, failed video generations, API issues",
      stat: stats ? `${stats.errorCount} errors` : null,
      color: stats?.errorCount ? "text-red-500" : "text-emerald-500",
      badge: stats?.errorCount ? stats.errorCount : undefined,
    },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Content Flywheel internal tools</p>
      </div>

      {/* Quick stats bar */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Users", value: stats.totalUsers },
            { label: "Pro Users", value: stats.proUsers },
            { label: "Credits Sold", value: stats.creditsPurchased },
            { label: "Pending Apps", value: stats.pendingApplications },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Nav cards */}
      <div className="grid sm:grid-cols-2 gap-4">
        {sections.map((s) => (
          <Link key={s.href} href={s.href}>
            <Card className="h-full hover:border-orange-400/60 transition-colors cursor-pointer">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-start gap-4">
                  <div className={`shrink-0 mt-0.5 ${s.color}`}>{s.icon}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{s.label}</p>
                      {s.badge !== undefined && (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-bold">
                          {s.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{s.description}</p>
                    {s.stat && <p className={`text-xs mt-1.5 font-medium ${s.color}`}>{s.stat}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
