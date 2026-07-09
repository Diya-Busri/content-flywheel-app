import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrCreateSupportConversation } from "@/db/queries/messaging-queries";

export const dynamic = "force-dynamic";

// Convenience shortcut: get/create the support conversation and redirect into it.
export default async function SupportRedirectPage() {
  const { userId } = auth();
  if (!userId) return redirect("/sign-in");
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress ?? null;
  const conv = await getOrCreateSupportConversation(userId, email);
  return redirect(`/dashboard/messages/${conv.id}`);
}
