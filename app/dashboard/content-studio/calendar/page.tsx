import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import StudioCalendarClient from "./StudioCalendarClient";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Calendar | Content Studio | Content Flywheel",
  description: "Monthly and weekly calendar, drag-and-drop scheduling, color by platform, optimal posting times, batch schedule",
};

export default function StudioCalendarPage() {
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
        Calendar
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        Monthly and weekly views, drag-and-drop scheduling, color-coded by platform. Status: draft, scheduled, published. Optimal posting times, batch schedule a week, auto-repost best performers.
      </p>
      <StudioCalendarClient />
    </main>
  );
}
