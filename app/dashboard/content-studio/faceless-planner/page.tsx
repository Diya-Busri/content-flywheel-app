import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import FacelessPlannerClient from "./FacelessPlannerClient";

export const metadata: Metadata = {
  title: "Faceless Content Planner | Content Studio | Content Flywheel",
  description: "Generate a 7-day faceless content plan for TikTok and Instagram — text scripts, captions, hashtags and production tips.",
};

export default function FacelessPlannerPage() {
  const { userId } = auth();
  if (!userId) redirect("/sign-in");

  return (
    <main className="p-6 md:p-10">
      <Link
        href="/dashboard/content-studio"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Content Studio
      </Link>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        Faceless Content Planner
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        A 7-day plan of TikTok + Instagram content — <strong className="text-foreground">no face required.</strong> Text scripts, product reveals, teasers, quote cards. Everything written and ready to film.
      </p>
      <FacelessPlannerClient />
    </main>
  );
}
