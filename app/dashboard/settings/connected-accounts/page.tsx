import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import ConnectedAccountsClient from "./ConnectedAccountsClient";
import { Loader2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Connected accounts | Settings | Content Flywheel",
  description: "Connect TikTok, YouTube, Instagram, and Facebook for auto-publishing",
};

export default async function ConnectedAccountsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <main className="p-6 md:p-10">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        Connected accounts
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        Link your social accounts to publish videos automatically from the Content Calendar.
      </p>
      {/* Suspense is required for useSearchParams() to work correctly in App Router */}
      <Suspense fallback={
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
        </div>
      }>
        <ConnectedAccountsClient />
      </Suspense>
    </main>
  );
}
