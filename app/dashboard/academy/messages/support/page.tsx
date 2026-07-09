import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrCreateSupportConversation } from "@/db/queries/messaging-queries";

export const dynamic = "force-dynamic";

export default async function AcademySupportPage() {
  const { userId } = await auth();
  if (!userId) return redirect("/sign-in");

  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress ?? "";
  const conv = await getOrCreateSupportConversation(userId, email);

  return redirect(`/dashboard/academy/messages/${conv.id}`);
}
