import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import NicheResearchClient from "./NicheResearchClient";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Niche research | Content Studio | Content Flywheel",
  description: "Input interests/skills; AI suggests 5–10 profitable niches with scores and successful channels. Save your niche to affect all future content suggestions.",
};

export default function NicheResearchPage() {
  const { userId } = await auth();
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
        Niche research
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        Helps you pick a profitable niche. Enter your interests and skills; AI suggests 5–10 niches with profitability scores and successful channels in each. Save your chosen niche—it affects all future content suggestions (Video Ideas, SEO, trends, and more).
      </p>
      <NicheResearchClient />
    </main>
  );
}
