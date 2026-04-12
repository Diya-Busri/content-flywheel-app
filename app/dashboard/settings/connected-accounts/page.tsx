import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import ConnectedAccountsClient from "./ConnectedAccountsClient";

export const metadata: Metadata = {
  title: "Connected accounts | Settings | Content Flywheel",
  description: "Connect TikTok, YouTube, Instagram, and Facebook for auto-publishing",
};

export default function ConnectedAccountsPage() {
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
      <ConnectedAccountsClient />
    </main>
  );
}
