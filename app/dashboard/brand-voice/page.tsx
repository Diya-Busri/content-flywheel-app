import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import BrandVoiceClient from "./BrandVoiceClient";

export const metadata: Metadata = {
  title: "Brand voice | Content Flywheel",
  description: "Set your brand voice, tone, and writing style for AI-generated content",
};

export default function BrandVoicePage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <main className="p-6 md:p-10">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        Brand voice
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        Define how your brand sounds so AI can match your tone, audience, and style in scripts and copy.
      </p>
      <BrandVoiceClient />
    </main>
  );
}
