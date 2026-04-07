import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import EmailMarketingClient from "./EmailMarketingClient";

export const metadata: Metadata = {
  title: "Email Marketing | Content Flywheel",
  description: "Manage your email contacts and campaigns",
};

export default async function EmailMarketingPage() {
  const { userId } = auth();
  if (!userId) redirect("/sign-in");

  return <EmailMarketingClient userId={userId} />;
}
