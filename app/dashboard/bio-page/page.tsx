import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import BioPageEditor from "./BioPageEditor";

export const metadata: Metadata = {
  title: "Link in Bio | Content Flywheel",
  description: "Create your branded link-in-bio page with email waitlist.",
};

export default function BioPageDashboard() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  return <BioPageEditor />;
}
