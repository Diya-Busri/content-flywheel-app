import type { Metadata } from "next";
import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import TemplateStudioClient from "./TemplateStudioClient";

export const metadata: Metadata = {
  title: "Template Studio | Content Flywheel",
  description: "Create and manage template packs for quotes, tips, affirmations, product promos, and tutorials",
};

/** Fallback for Suspense: avoids hydration mismatch when TemplateStudioClient uses useSearchParams(). */
function TemplateStudioFallback() {
  return (
    <div className="flex items-center justify-center min-h-[40vh] text-muted-foreground">
      Loading Template Studio…
    </div>
  );
}

export default async function TemplateStudioPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <div className="min-w-0 max-w-full p-6 md:p-10">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        Template Studio
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        Create template packs with slides and captions for quotes, tips, affirmations, product promos, and tutorials.
      </p>
      <Suspense fallback={<TemplateStudioFallback />}>
        <TemplateStudioClient />
      </Suspense>
    </div>
  );
}
