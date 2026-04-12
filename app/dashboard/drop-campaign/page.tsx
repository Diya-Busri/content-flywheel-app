import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import DropCampaignClient from "./DropCampaignClient";

export const metadata = { title: "Drop Campaign | Content Flywheel" };

export default async function DropCampaignPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  return <DropCampaignClient />;
}
