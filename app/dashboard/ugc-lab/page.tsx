/**
 * UGC Lab - Advanced Creator Lab
 * 3-panel workspace layout: Face/Templates | Script | Video Jobs
 * Locked behind premium membership (user.membership === 'pro').
 */
import type { Metadata } from "next";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getProfileByUserId } from "@/db/queries/profiles-queries";
import UGCLabWorkspace from "./UGCLabWorkspace";

export const metadata: Metadata = {
  title: "UGC Lab | Content Flywheel",
  description: "Advanced UGC creator tools — Face Swap, templates, and more",
};

export default async function UGCLabPage() {
  const { userId } = await auth();
  const profile = userId ? await getProfileByUserId(userId) : null;
  const isPremium = profile?.membership === "pro";

  // Admins bypass the premium gate (their membership is 'free' but they have full access)
  const user = await currentUser();
  const userEmail = user?.emailAddresses?.[0]?.emailAddress ?? "";
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";
  const isAdmin = Boolean(adminEmail && userEmail.toLowerCase() === adminEmail);

  return <UGCLabWorkspace isPremium={isPremium || isAdmin} />;
}
