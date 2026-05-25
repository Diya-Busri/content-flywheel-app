import { currentUser } from "@clerk/nextjs/server";
import AICoachPageClient from "./AICoachPageClient";

export default async function AICoachPage() {
  const user = await currentUser();
  const userEmail = user?.emailAddresses?.[0]?.emailAddress?.trim().toLowerCase() ?? "";
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";
  const isAdmin = !!adminEmail && userEmail === adminEmail;

  return <AICoachPageClient isAdmin={isAdmin} />;
}
