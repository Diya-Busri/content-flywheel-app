import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import HistoryClient from "./HistoryClient";

export const metadata: Metadata = {
  title: "History | Content Flywheel",
  description: "Past generated products. Open or duplicate any product.",
};

export default async function HistoryPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <main className="p-6 md:p-10">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        History
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        All your generated products. Open to edit or duplicate to create a new copy.
      </p>
      <HistoryClient />
    </main>
  );
}
