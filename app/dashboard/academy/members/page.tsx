import { auth } from "@clerk/nextjs/server";
import { Users } from "lucide-react";
import { getCommunityMembers } from "@/db/queries/academy-queries";
import { MembersDirectory } from "@/components/academy/members-directory";

export const dynamic = "force-dynamic";
export const metadata = { title: "Members | Academy" };

export default async function MembersPage() {
  const { userId } = await auth();
  const members = await getCommunityMembers();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6">
      <div className="mb-4">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Users className="h-6 w-6 text-primary" /> Members
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect with other members of the community.
        </p>
      </div>

      <MembersDirectory members={members} currentUserId={userId} />
    </div>
  );
}
