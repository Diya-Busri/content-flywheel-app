import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import TemplatesClient from "./TemplatesClient";

export const metadata: Metadata = {
  title: "Templates | Content Flywheel",
  description: "Your saved content templates. Use any template to pre-fill the relevant editor.",
};

export default function TemplatesPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <main className="p-6 md:p-10">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        Templates
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        Saved content you can reuse. Click &quot;Use Template&quot; to open the right editor with this content pre-filled.
      </p>
      <TemplatesClient />
    </main>
  );
}
