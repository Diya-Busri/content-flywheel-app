import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import CampaignModeClient from "./CampaignModeClient";

export const metadata: Metadata = {
  title: "Campaign Mode | Content Flywheel",
  description: "Brand workspaces and campaigns",
};

export default function CampaignModePage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <main className="min-h-screen bg-background text-foreground p-6 md:p-10">
      <CampaignModeClient />
    </main>
  );
}
