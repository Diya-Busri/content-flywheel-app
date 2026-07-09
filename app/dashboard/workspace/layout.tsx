import { auth, currentUser } from "@clerk/nextjs/server";
import { WorkspaceAdminProvider } from "@/components/workspace-admin-context";
import { ReactNode } from "react";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const { userId } = await auth();
  let isAdmin = false;

  if (userId) {
    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";
    if (adminEmail.length > 0) {
      const user = await currentUser();
      const userEmail = user?.emailAddresses?.[0]?.emailAddress?.trim().toLowerCase() ?? "";
      isAdmin = userEmail === adminEmail;
    }
  }

  return (
    <WorkspaceAdminProvider isAdmin={isAdmin}>
      {children}
    </WorkspaceAdminProvider>
  );
}
