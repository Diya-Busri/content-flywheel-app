import type { Metadata } from "next";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import EmailMarketingClient from "./EmailMarketingClient";

export const metadata: Metadata = {
  title: "Email Marketing | Content Flywheel",
  description: "Manage your email contacts and campaigns",
};

export default async function EmailMarketingPage() {
  const { userId } = auth();
  if (!userId) redirect("/sign-in");

  const user = await currentUser();
  const userEmail = user?.emailAddresses?.[0]?.emailAddress ?? "";
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";

  if (!adminEmail || userEmail.trim().toLowerCase() !== adminEmail) {
    redirect("/dashboard");
  }

  return <EmailMarketingClient />;
}
