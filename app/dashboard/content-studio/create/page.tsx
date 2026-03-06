import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import CreateWizardClient from "./CreateWizardClient";

export const metadata: Metadata = {
  title: "Create Video | Content Studio | Content Flywheel",
  description: "Create your video step by step: niche, type, script, timeline, publish",
};

export default async function ContentStudioCreatePage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <Suspense
      fallback={
        <main className="min-h-screen p-6 md:p-10">
          <div className="max-w-4xl mx-auto flex items-center justify-center py-20">
            <p className="text-gray-600 dark:text-gray-400">Loading...</p>
          </div>
        </main>
      }
    >
      <CreateWizardClient />
    </Suspense>
  );
}
